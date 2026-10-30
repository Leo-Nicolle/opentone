# opentone — Low-power playback on STM32F446 + VS1053 + PSRAM

Implementation note / context for Claude Code.
Goal: **maximize battery life** by keeping the F446 core asleep as much as
possible while a VS1053 handles decoding. Decode stays in hardware (VS1053);
the MCU's only job is to move data down a buffer hierarchy (SD → PSRAM →
SRAM → VS1053), in a few large bursts, so the core and the SD card sleep in
between.

## Hardware context

- MCU: STM32F446 (Cortex-M4F, 180 MHz, 128 KB SRAM).
- Decoder: VS1053 (hardware MP3/FLAC/etc decode + DAC + headphone amp).
- PSRAM: APS6404L, **8 MB** on **SPI2** (CLK PB13, MISO PB14, MOSI PB15,
  CS PD2). Plain SPI, not QSPI (see pinout check below).
- Storage: SD card on **SPI1**, **shared with the VS1053** (CS PA4; VS1053
  XCS PA11, XDCS PA9). SDIO is not possible with the current pinout. Bus
  access is arbitrated by `spi1bus::Lock` (`software/src/sound/Spi1Bus.h`).
- VS1053 **DREQ** on PB3 (today polled; can be EXTI3).
- Today the VS1053 is fed by a **1 kHz TIM7 interrupt** that polls DREQ and
  CPU-writes 32-byte bursts (`AudioPlayer::feederIsr`, `FEEDER_HZ`).

## Buffer hierarchy (what the firmware already does)

```
SD card ──SPI1──► 4 KB SRAM scratch ──SPI2──► PSRAM ring, 4 MB
   (refill to 3.5 MB, then idle)                     │
                                                     ▼ SPI2, CPU
                      VS1053 ◄──SPI1── L1 AudioFifo, 32 KB SRAM
                    (2 KB FIFO)   32 B bursts while DREQ high
```

| Tier | Size | Source |
|---|---|---|
| PSRAM audio ring | 4 MB, refilled to 3.5 MB | `AUDIO_BUFFER_SIZE`, `AUDIO_TARGET_BUFFERED_BYTES` |
| PSRAM next-track prefetch | 1 MB | `NEXT_TRACK_BUFFER_SIZE` |
| L1 fifo (SRAM) | 32 KB | `AudioFifo::CAPACITY` |
| VS1053 input FIFO | 2048 B | VS1053b datasheet (the sound README's "8 KB" is wrong) |

PSRAM map (8 MB): 4 MB audio ring, 1 MB cover, 1 MB next-track prefetch,
2 MB music index / podcast state (`software/src/storage/PSRAM_controller.hpp`).

## Key timing facts (why sleeping works)

Drain time of each tier at the stream rate:

| Stream | Rate | VS1053 FIFO (2 KB) | L1 fifo (32 KB) | PSRAM (3.5 MB) |
|---|---|---|---|---|
| MP3 128 kbps | 16 KB/s | ~125 ms | ~2 s | **~230 s** |
| MP3 320 kbps | 40 KB/s | ~51 ms | ~0.8 s | **~90 s** |
| FLAC CD | ~110–140 KB/s | ~15–18 ms | ~230–290 ms | **~25–33 s** |

- The **SD card is touched once every 0.5–4 minutes**, not every few seconds:
  a refill (`RefillPolicy.h`: starts below 5 s of runway, runs to the 3.5 MB
  target) is a burst of a few seconds, then the card sits in its own idle state.
  The old version of this note (64 KB SRAM ring, an SD read every 1.6–4 s) no
  longer applies: SD is now a rare cost, not the main recurring one.
- The **PSRAM → L1** refill is the recurring "heavy" job: ~20–25 ms of SPI2
  traffic per 32 KB at full clock, i.e. ~1 % duty @128 kbps, ~10 % for CD FLAC.
- The VS1053 feed itself is microseconds of work per burst.

## PSRAM constraint: tCEM (hard, shapes the design)

- APS6404L: **CS# may stay low at most 8 µs** (tCEM, standard temp), or
  self-refresh is blocked and data is lost. A linear burst may also cross a
  1 KB page only once.
- At SPI2's max (22.5 MHz: APB1 45 MHz / 2) that's ~22 bytes per CS cycle,
  ~18 bytes of payload after the 4-byte command/address. The driver already
  splits every access (`SPI_PSRAM::TCEM_US`, `probeSpeed()`), and falls back
  to out-of-spec unbounded bursts below ~12 useful bytes (slower SPI2).
- Consequences:
  - **DMA on SPI2 is not worth it**: CS must be toggled every ~18 bytes, so
    PSRAM reads/writes stay CPU-driven.
  - **PSRAM transfers must run at full clock** (APB1 = 45 MHz). A slower APB1
    shrinks bursts or pushes the driver out of spec.
  - Do PSRAM → L1 in **one large burst** (fill the 32 KB fifo from a
    low-water mark), not in small frequent top-ups.
- Power: PSRAM standby ~100 µA typical (CLK held low), ~5.5 mA active at
  133 MHz (much less at 22.5 MHz). It keeps its data while the MCU is in Stop.

## Core architecture: event-driven, DMA-fed, sleep in between

Target steady-state loop (replaces the 1 kHz TIM7 polling):

```
WFI ──► DREQ rises (EXTI3) ──► 32 B SPI1 DMA burst ──► TC IRQ: DREQ still high?
 ▲                                                        │ yes: next 32 B burst
 │                                                        │ no (VS1053 FIFO full)
 └──── timer fires (~50–60 % of FIFO drain time) ◄── mask EXTI3, arm timer
```

1. **VS1053 feed: SPI1 TX DMA + DREQ.** DMA (DMA2 Stream3 or Stream5, ch3)
   sends from the L1 fifo; the core arms it and sleeps. The DMA burst must
   hold `spi1bus` and release it in the TC IRQ (SD shares SPI1); the existing
   `spi1bus::onFreed` retrigger keeps working.
2. **Burst size: 32 bytes per DREQ check.** DREQ high only guarantees 32 B of
   free FIFO space, and its hysteresis is tiny: it rises again as soon as
   32 B are free (~2 ms @128 kbps). Bigger blind bursts can overflow the FIFO.
3. **Cut wakeups by ignoring DREQ while the FIFO drains.** After a run of
   bursts fills the FIFO (DREQ low ≈ 2 KB buffered), mask EXTI3 and arm a
   one-shot timer for ~50–60 % of the drain time from the rate estimate
   (~60–75 ms @128 kbps, ~8 ms for CD FLAC). Then refill with 32 B bursts
   until DREQ drops again. That's ~15 feed wakeups/s @128 kbps instead of
   1000 timer ticks/s.
4. **L1 refill from PSRAM** in the main loop, at full clock, when the fifo
   drops below a low-water mark (to choose by measurement: enough to cover a
   32 KB PSRAM read, ~25 ms, plus UI work).
5. **SD → PSRAM refill** stays governed by `RefillPolicy.h`; between refills
   the SD card is idle.

## Sleep mode: use Sleep (WFI), NOT Stop  ← hard constraint

- **Sleep mode (`WFI`)** gates only the core clock; **peripheral clocks keep
  running**, so SPI + DMA continue mid-transfer while the core is asleep.
  This is the mode to use during playback.
- **Stop mode halts everything, including DMA and SPI.** Do NOT enter Stop
  mid-stream. Stop is for long idles: paused playback, menu idle with nothing
  playing. **On pause the buffered audio stays in PSRAM**, so resuming needs
  no SD access. Wake sources: click-wheel buttons (EXTI), MPR121 IRQ, DREQ.
- STM32duino's 1 kHz SysTick wakes WFI every ms anyway. That's acceptable
  (a tiny ISR); the real gain is that `loop()` stops busy-looping: `WFI` when
  the L1 fifo is above its low mark and no refill/UI work is pending.

## Clock strategy: run slow, burst fast (phase 2)

- No need for 180 MHz to push 16–140 KB/s over SPI. Run current is about
  **200 µA/MHz**: ~5 mA at 24 MHz vs ~36 mA at 180 MHz (core, flash exec,
  peripherals off).
- VS1053 SDI tolerates SPI up to CLKI/4 (~6 MHz at the 2.0× multiplier set
  by `configureOptimalClock()`), plenty for the feed even at a low HCLK.
- **But PSRAM and SD work needs full speed**: burst to 180 MHz (APB1 45 MHz →
  SPI2 22.5 MHz, see tCEM) for PSRAM → L1, SD → PSRAM, FAT and UI redraws,
  then drop back.
- Runtime clock changes under STM32duino touch SysTick/`millis()`, UART baud
  rates (Bluetooth USART1), I2C3 timing, SPI prescalers and timer bases. Do
  this only after the DMA feeder and WFI work, and measure if it's worth it.

## Steady-state power picture (target)

- Core in WFI most of the time; 1 kHz SysTick plus ~15–100 feed wakeups/s.
- PSRAM → L1 burst of ~25 ms every ~2 s (128 kbps) to ~250 ms (CD FLAC).
- SD → PSRAM burst of a few seconds every ~0.5–4 min; SD idle otherwise.
- On pause: Stop mode, PSRAM holds the buffer, no SD on resume.
- This is the same duty-cycling an iPod relies on: the VS1053 plays the role
  of its decode DSP, and the PSRAM the role of its large RAM buffer that
  lets the hard drive spin down.

## Pinout check (LQFP64, `docs/public/pinout/LQFP64/mapping.json`)

| Need | Status |
|---|---|
| DREQ on EXTI | ✅ PB3 → EXTI3. No other EXTI3 user (PC3 is TFT D3, an output; PA3 free). |
| SPI1 TX DMA → VS1053 | ✅ DMA2 Stream3 or Stream5, channel 3, unused today. (SPI1 RX for SD DMA: DMA2 Stream0/2 ch3, optional.) |
| SPI2 DMA → PSRAM | ⚠️ Streams free (DMA1 S3/S4 ch0), but tCEM makes it pointless. |
| Timer for "sleep while FIFO drains" | ✅ TIM7 (already ours) can be reused; TIM6 free. |
| SDIO for the SD card | ❌ SDIO_CMD is only on PD2 (PSRAM_CS); D0/CK on PC8/PC12 (TFT data). SD stays on shared SPI1. |
| QUADSPI for the PSRAM | ❌ IO0/IO1 on PC9/PC10 (TFT data), CLK on PB2 (Left button). PSRAM stays on SPI2. |
| Power-gating SD / PSRAM | ❌ No load switch on the board. PA0–PA3 are free if a later rev adds one. |
| Side note: EXTI line 1 | ⚠️ PB1 (Right button, interrupt) and PH1 (MPR121 IRQ, polled today) share EXTI1. Don't turn the MPR121 IRQ into an interrupt without moving one of them. |

**Verdict: testable on the current board/Nucleo with no pin change.** DREQ
EXTI + SPI1 DMA feeder + WFI in `loop()` only need firmware. Only SDIO,
QSPI and power-gating are blocked, and none of them is required.

## Next board (LQFP100, `docs/public/pinout/LQFP100/mapping.json`)

The LQFP100 layout removes most of the constraints above: every hop of the
buffer chain can be DMA-driven, and the PSRAM no longer needs a fast APB1.

| Hop | Interface | DMA | Notes |
|---|---|---|---|
| SD → SRAM | SDIO 1-bit (CK PC12, CMD PD2, D0 PC8), 48 MHz kernel clock | DMA2 Stream3 or Stream6, ch4 | ~24 MHz bus, ~3 MB/s: a full 3.5 MB refill ≈ 1.5 s (vs ~9 s on SPI1 today). |
| SRAM ↔ PSRAM | QUADSPI bank 2 (CLK PB2, NCS PC11, IO PE7–PE10) | DMA2 Stream7, ch3 | See tCEM chunking below. |
| L1 fifo → VS1053 | SPI2 (PB13/14/15), **not shared** | DMA1 Stream4, ch0 | No `spi1bus` lock needed. DREQ on PE5 (EXTI5). |

- **CPU cost**: ~0.1 µs/byte in total (only DMA IRQs) → the core is
  asleep **~97–99 % of the time even for CD FLAC**. Time asleep stops
  mattering; Sleep-mode *current* (clock speed, gated peripheral clocks)
  and powered-off rails are what's left to optimize.

### PSRAM on QUADSPI: tCEM still applies

The F446 QUADSPI has no "max CS low time" feature (unlike newer OCTOSPI),
and memory-mapped mode keeps CS low through sequential reads. Use
**indirect mode, page-aligned chunks**, one DMA transfer per chunk:

- Quad read `EBh` in QPI: 2 clk command + 6 clk address + 6 dummy + 2 clk/byte.
- ≤ **256 B** per chunk when the QSPI clock is ≥ 64 MHz (256 B ≈ 5.8 µs at
  90 MHz); **128 B** at 42 MHz (≈ 6.4 µs). Both divide the 1 KB page, so a
  chunk never crosses a page (no 84 MHz page-crossing limit to worry about).
- The QSPI clock comes from HCLK (prescaler 0 is allowed), so the PSRAM keeps
  working at the low playback clock: the SPI2/APB1 problem of the current
  board disappears. 32 KB PSRAM → L1 ≈ 1 ms instead of ~25 ms.

### Clock profiles (all software, no crystal change)

8 MHz HSE (accurate 48 MHz for USB) + 32.768 kHz LSE (RTC, wake from Stop).

| Profile | Setting | Sleep current (DS, typ, peripheral clocks off) |
|---|---|---|
| Burst (SD/PSRAM refill, UI) | PLL 168 MHz, AHB /1, APB1 /4 = 42 MHz, APB2 /2 | ~7.3 mA |
| Playback | same PLL, **AHB /4 = 42 MHz**, APB1 /1 = 42 MHz, APB2 /1 | ~2.5–3 mA |
| Pause / idle | Stop mode, low-power regulator, flash deep power-down | ~0.12–0.23 mA |

- **168 MHz rather than 180 MHz**: 8 MHz / 4 × 168 = 336 MHz → /2 = 168 MHz
  SYSCLK, /7 = exactly 48 MHz for USB and SDIO from the main PLL, and no
  over-drive mode (which can't be toggled quickly). 180 MHz would need
  over-drive plus PLLSAI for 48 MHz.
- **Switch with the AHB prescaler**: instant, glitch-free, PLL keeps
  running, 48 MHz domain untouched. Fine to do several times per second.
- `setClockProfile()` (STM32duino won't do it for us):
  - flash wait states: raise *before* going up, lower *after* going down;
  - write HPRE and PPRE1 in **one** `RCC_CFGR` write so APB1 stays at 42 MHz
    (SPI2, I2C1, USART2, UART4 timings unchanged);
  - TIM2 (backlight PWM) runs at 2×PCLK1 when PPRE1 ≠ 1: 84 MHz in burst,
    42 MHz in playback → rewrite its prescaler on each switch;
  - SysTick reload (`millis()`), `SystemCoreClock`;
  - USB OTG FS needs HCLK ≥ 14.2 MHz while in use;
  - SDIO needs PCLK2 ≥ 3/8 × SDIO_CK (42 MHz ≫ 9 MHz, fine).
- **Gate peripheral clocks in Sleep**: at 180 MHz the datasheet gives
  ~51 mA in Sleep with all peripheral clocks on vs ~8 mA with them off. All
  `RCC_AHBxLPENR` / `RCC_APBxLPENR` bits are set at reset: clear everything
  except what playback uses (DMA1/2, SPI2, SDIO/QSPI while active, TIM2,
  SRAM). EXTI edge detection works without the GPIO clocks.

### Power switches and what to do with them

- `SD_EN` (PA7, TPS22917): power the card off between refills. Put
  PC12/PD2/PC8 in analog mode first (back-powering). A card re-init costs
  ~100–300 ms: clearly worth it at 128 kbps (a refill every ~4 min); measure
  for FLAC (every ~30 s).
- `VS_EN` (PA6): whole VS1053. Only for long pauses: resume needs a full
  re-init, the FLAC plugin reload, and a restart from a frame boundary. Put
  SPI2/XCS/XDCS/XRESET in analog mode first.
- `DAC_EN` (PE2), `BT_EN` (PD7), DRV2605L `EN` (PB5): off whenever unused.
- PSRAM has no switch, on purpose: ~100 µA keeps the buffered audio across
  Stop, so a resume needs no SD access.

### Pinout check

- EXTI lines all distinct (0, 3, 4, 5, 6, 8, 10–15). DREQ (PE5), ALRT (PE6)
  and card detect (PA8) share the EXTI9_5 vector: check pending bits.
- DMA clash: **UART4_TX (log) is also on DMA1 Stream4** (ch4) → keep the
  log UART interrupt-driven. USART2 (DMA1 S5/S6 ch4) would clash with I2C1
  DMA (S5/S6 ch1), but `Wire` doesn't use DMA.
- VS1053 SDI: SPI2 at 42 MHz / 4 = 10.5 MHz, under CLKI/4 at a 3.5×
  multiplier (10.75 MHz); use /8 (5.25 MHz) at 2.0×.
- Current measurement points are planned on this board: all power figures
  in this note get validated there.

## Implementation tasks

- [ ] SPI1 TX DMA (DMA2 S3/S5 ch3) to VS1053 SDI from the L1 fifo, 32 B per
      burst; hold `spi1bus` during the burst, release in the TC IRQ.
- [ ] DREQ (PB3) on EXTI3; ISR starts a burst run.
- [ ] Drain timer: on DREQ low, mask EXTI3 and arm a one-shot from the rate
      estimate; replaces the 1 kHz TIM7 polling.
- [ ] L1 low-water mark; PSRAM → L1 in one burst at full clock.
- [ ] Main loop: `WFI` when L1 is above its low mark and nothing is pending.
- [ ] Stop mode on pause / idle, keeping PSRAM contents; never mid-stream.
- [ ] Phase 2: clock scaling (low HCLK for the feed, full speed for PSRAM/SD/UI).

## Open decisions / to verify on hardware

- L1 low-water mark vs PSRAM refill time and the slowest UI pass.
- Drain-timer fraction (50–60 %) vs underrun margin, especially for CD FLAC.
- Power is measured on the next board's measurement points (MCU, VS1053/DAC
  and SD rails): 1 kHz feeder vs EXTI+DMA feeder, with/without WFI, each
  clock profile; feed wakeups/s and L1 underruns via `AudioProfiler`.
- SD refill burst current/duration, and SD idle current between refills, to
  compute the mA-weighted average and projected runtime.
- Whether a later board rev should add load switches for SD and/or PSRAM.
