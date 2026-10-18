# The test board

Right now we have a nucleo F446RE, connected to a vs1053 adafruit breakout, a mpr121 breakout,
a PSRAM breakout, a screen breakout, a click buttons breakout.

Let's design a PCB with the MCU directly on it: a bare STM32F446VET6 (same chip as the F446RE, LQFP100 instead
of LQFP64, so more pins), flashed over SWD with a standalone ST-LINK or the F446RE Nucleo's one. Same package
and pinout as the final board (`docs/public/pinout/LQFP100/`, `datasheets/lqfp100-pins.md`). It should let us:

- Test the QuadSPI PSRAM routing
- Test putting the SD card on its own SPI bus
- Measure the drain of each key component (0 Ω resistor or solder jumper on the VDD supply of each, never on GND: see [Design gotchas](#design-gotchas))
- Allow to switch off programmatically the heavy components (constant-current sink for the screen LEDs and TPS22917 for the SD card, Cyrrus DAC? MPR121? )
- Test the battery charging / gauge monitoring
- Test a couple of screens on two FPC connectors: the current cheap AliExpress TN one and a Newhaven NHD-2.4-240320AF-CSXP
  (IPS), to see the difference between IPS and TN panels and measure the drain pros/cons (`hardware/opentone/screens.kicad_sch`).
- Test the USB route: files transferts, firmware flashing of the STM32 and battery charging: have a dedicated ubs-C connector on the board that goes through our MCP73831-2-MC, etc. See `hardware/opentone/power.kicad_sch`
- Test the difference between audio from the vs1053 directly and from a DAC (Cyrrus CS43131-CWZR): have two Jacks, one coming from the vs01053b and one from the cyrrus (connected via I2s to the vs1053)
- Have the Bluetooth module (FSC-BT1035) on the board, wired to the MCU (`hardware/opentone/bluetooth.kicad_sch`)

## Breakouts or not Breakouts

Untill now everything was a breakout: easy to swap and I had no PCB design to do.
Now that I have multiple parts to tests, I would either:

- Create just a big PCB, with everything on it, YOLO
- Create a PCB on which I would still attach some breakouts

### There are parts I am sure of already, since all the breakouts I have are opensource

- VS1053 and audio route from it
- MPR121 click wheel and buttons
- Bluetooth chip
- Screens routing

Since I have all the opensource files of the breakouts I used to test theese,

- should I make my PCB include all thoose directly ? =>highger assembly cost/BOM but also a test closer from the end board
- Should I keep the breakouts design, with the mainboard having mainly traces to breakout boards? => Less prone to errors, faster to design, cheaper, but not really close from the final board.

### The parts I m not sure about are

- The DAC audio route
- The batterry management

I am sure I can find opensource PCB design for each one and just reuse it, so is it really a problem?
Do I need to create a breakout for each (more assembly/pcb printing cost) or just integrate them directly to the board ?

## Design gotchas

### Back-powering through IO pins

When we cut the supply of a block (SD card, VS1053, Bluetooth, DAC, MPR121...) but the MCU still drives its
IO lines high, the block gets powered through the ESD clamp diodes of its IO pins. It half-runs, leaks
current, can latch up, and it ruins the drain measurements.

- Before switching a block off, put all its lines in analog/high-Z mode, or drive them low (see the
  `SD_EN` / `VS_EN` notes in `docs/public/pinout/LQFP100/mapping.json`)
- Pull-ups on lines going to a switched block must be tied to the switched rail, not to the always-on 3.3V
- Open-drain lines shared with an always-on block (I2C) cannot be driven low: if the MPR121 or the DAC
  gets a load switch, isolate it from the I2C bus or keep it on the always-on rail
- Same rule for measuring current: jumpers go on the VDD side. Opening GND makes the return current flow
  through the signal lines instead.

### MCU on the board

No Nucleo means we design what it gave us for free:

- SWD header (SWDIO PA13, SWCLK PA14, NRST, SWO PB3, 3V3, GND), 2x5 1.27 mm or Tag-Connect
- Reset button, BOOT0 pulled down with a button to 3V3 (needed for USB DFU flashing)
- 8 MHz HSE crystal (USB needs it) and 32.768 kHz LSE crystal (RTC, wake-up from stop mode)
- Decoupling on every VDD pin, the VCAP_1 capacitor, VDDA filtered (ferrite + caps): follow the datasheet
- The STM32 gets its own VDD jumper like the other blocks, so its drain is measured the same way

Done in `hardware/opentone/mcu.kicad_sch` (2026-10-18, details in `notes/devboard-todo.md`): JP401 on the MCU
VDD, 6 × 100n + 4.7u, VDDA through a ferrite, 2 × 2.2u on VCAP_1/VCAP_2 (the LQFP100 has two), 8 MHz HSE and
32.768 kHz LSE, reset and BOOT0 buttons, a 2x5 1.27 mm SWD header plus a 6-pin header matching the Nucleo's
ST-LINK (CN4), the UART4 log header, a spare GPIO header and the I2C1 pull-ups.

### SD card: SPI or SDIO

The F446 has SDIO (1 or 4-bit, up to 48 MHz) and it fits the board better than SPI: reads are faster, so the
card can go back to standby (or be switched off) sooner, SPI1 is freed, and DMA does the work instead of the CPU.
It does not speed up USB though: USB is Full Speed only on the F446 (12 Mbit/s, ~1 MB/s in practice), so
copying 1 GB over USB takes ~15-20 min whatever the SD bus.

The catch is the pins: SDIO_CMD only exists on PD2 (screen D2, the screen takes the whole port D) and SDIO_D3
only on PC11 (PSRAM CS, and QUADSPI bank 2 has no other NCS pin).

#### Screen on two byte lanes

Instead of one 16-bit port, the screen data goes on two 8-bit halves: low byte on PC0-PC7, high byte on PD8-PD15.
"The GPIO registers can be accessed by byte (8 bits), half-words (16 bits) or words (32 bits)"
(`datasheets/rm0390-stm32f446xx.pdf`, §7.4), so each half is one `STRB` to the right byte of `ODR`, no masking,
the other pins of the port are untouched (and the PD0-PD7 pins in alternate function mode ignore `ODR` anyway;
TFT_DC/TFT_WR on PD0/PD1 go through the atomic `BSRR`):

```c
*(volatile uint8_t *)&GPIOC->ODR       = px;       // D0-D7  on PC0-PC7
*(volatile uint8_t *)((uintptr_t)&GPIOD->ODR + 1) = px >> 8; // D8-D15 on PD8-PD15
```

One more store per pixel than the full-port version, but the panel is the bottleneck anyway: the ILI9341 write
cycle is 66 ns min (`datasheets/ILI9341.pdf`, tWC), 12 CPU cycles at 180 MHz, enough for 4 stores.
It frees PD0-PD7, which gives:

- PD2 for SDIO_CMD
- USART2 with full hardware flow control on PD3-PD6 for the Bluetooth module

The lanes can be any byte-aligned half port. PC0-PC7 + PD8-PD15 is the one that costs the least: PE0-7 and
PA0-7 hold QUADSPI IO2/IO3 candidates, PB has SWO, BOOT1 and I2C, PC8-15 has SDIO and the slow PC13-15.

#### 4-bit or 1-bit SDIO

| | SDIO 1-bit | SDIO 4-bit |
|---|---|---|
| Pins | CK PC12, CMD PD2, D0 PC8 | + D1 PB0, D2 PB1, D3 PC11 |
| Bus speed (48 MHz, theoretical) | ~6 MB/s | ~24 MB/s (cards give ~10-20) |
| PSRAM | stays on bank 2: PB2, PC11, PE7-PE10, pins 37-41 + 79, compact | moves to bank 1: PB2, PB6, PC9, PC10, PE2, PA1, pins 1, 24, 37, 66, 78, 92: all around the package, bad for 90 MHz |
| Other moves | none | I2C1 to PB7/PB8, logs to UART5 (PE7/PE8) |

For reference, SPI at 25 MHz is ~3 MB/s and audio needs < 0.2 MB/s (even WAV is 176 KB/s). With the card
drawing ~50-100 mA while reading, going from 1-bit to 4-bit saves a fraction of a mA on average.
**Choice: 1-bit SDIO.** Twice the SPI speed, DMA, and the PSRAM (the one bus where speed matters) keeps its short
routing. DAT1-DAT3 still need pull-ups on the card side (to the switched SD rail, see back-powering).

#### Resulting allocation

What changes compared to `docs/public/pinout/LQFP100/mapping.json`:

| Block | Signal | Old | New | Why |
|---|---|---|---|---|
| Screen | D0-D7 | PD0-PD7 | PC0-PC7 | byte lanes |
| Screen | D8-D15 | PD8-PD15 | PD8-PD15 | |
| Screen | TFT_DC / TFT_WR | PB8 / PB9 | PD0 / PD1 | fast pins, freed by the lanes |
| Screen | TFT_CS1 / TFT_CS2 | tied low | PB8 / PB9 | two panels on the same bus need their own CS |
| Screen | Backlight 2 PWM | - | PA3 (TIM2_CH4) | same timer as backlight 1 (PB10, TIM2_CH3) |
| SD | CK / CMD / D0 | SPI1 PA4-PA7 | PC12 / PD2 / PC8 | SDIO 1-bit |
| SD | SD_EN / card detect | PC0 / - | PA7 / PA8 (EXTI8) | |
| VS1053 | XDCS / RESET / VS_EN | PC2 / PC3 / PC4 | PA4 / PA5 / PA6 | freed by SPI1 |
| DRV2605L | EN | PC6 | PB5 | |
| Bluetooth | TX / RX / CTS / RTS | UART4 PA0 / PA1 / PB0 / PA15 | USART2 PD5 / PD6 / PD3 / PD4 | full flow control |
| Bluetooth | BT_EN / BT_RESET | PC7 / PC8 | PD7 / PE0 | |
| Logs | TX / RX | USART2 PA2 / PA3 | UART4 PA0 / PA1 | freed by Bluetooth |
| DAC | RESET / DAC_EN | - | PE1 / PE2 | |
| Audio | Headphone detect 1 / 2 | - | PB1 (EXTI1) / PA10 (EXTI10) | |
| Charger | MCP73831 STAT | - | PB0 (EXTI0) | |

Unchanged: PSRAM (PB2, PC11, PE7-PE10), VS1053 SPI2 (PB12-PB15) and DREQ (PE5), I2C1 (PB6/PB7), MPR121 IRQ (PE4),
MAX17048 ALRT (PE6), buttons (PE11-PE15), lock (PE3), USB (PA9, PA11, PA12), HSE, SWD + SWO.
New: LSE crystal on PC14/PC15. EXTI lines stay unique (0, 1, 3-6, 8-15). Spare: PA2, PA15, PB4, PC9, PC10,
PC13 (slow). Applied to `docs/public/pinout/LQFP100/mapping.json` and `datasheets/lqfp100-pins.md`.

Signal speed: every moved signal is on a 100 MHz FT pin. SDIO runs at 48 MHz max (clock shared with USB from
the 48 MHz PLL output), the screen bus at ~15 MHz, USART2 sits on APB1 (45 MHz, up to ~2.8 Mbaud).

## Datasheets

Here is the list of the Datasheets of the components we ll be using

- Nucleo
- MPR121 ()

## Opensource PCB files

Here are the design files for the breakouts I used and for other open source projects that use parts we will use.

## Tests I want to run

### QuadSPI

route the PSRAM via quadSPI, update the firmware, compare the speeds.
We should have a fallback on SPI (annother routing ) to make sure the board is usable for other tests in case this fails.

Notes:

- The fallback does not need a second routing: the QUADSPI peripheral can run single-line (plain SPI) on
  the same pins. Better to add footprints for 22-33 Ω series resistors on the lines, to fix signal
  integrity if needed.
- On the F4, memory-mapped mode is read-only: writes have to go through indirect mode.
- The APS6404L has a max CS low time (tCEM, ~8 µs) that the F4 does not enforce: the firmware has to split
  long transfers into chunks.

### SD card

So the SD card stores audio files at different bitrates. The idea is to copy chunks of the current playing file, and try to save power while we are not reading from the SD card.
There are two things to compare/test:

- Switch it off completlly using a TPS22917 when not reading
- Use the sleep mode of the SD card when not reading

We need to see which one saves most power, is the TPS22917 route worth the complexity/space on the
board. Is the sleep mode reliable ? (not all SD card has it if I understand)

Notes:

- SD cards have no real sleep command in SPI mode (CMD5 sleep is MMC only). Once CS goes high the card
  drops to standby on its own, typically ~100-500 µA depending on the card. So the real comparison is
  power-off vs idle standby, and we should test a few different cards.
- Powering it back costs a full re-init plus a FatFs remount (tens to hundreds of ms): the chunk buffer
  must cover that.
- Never cut the power while a write is running (wait for the card to release busy). Reads are safe.

Having the SD card on its own SPI bus is necessary to switch it off and put it alseep, for now it shares everything with the vs1053 on the breakout, but it should also speed up the whole audio stream process, we will measure it.

### Battery charging/monitoring

On the current dev board we do not have any battery management, we need to test this block.

- See if our routing is correct, if the battery charges/discharges correctly
- See if the gauge info we get on the MCU is correct

Notes:

- The MCP73831 has no power path: when the device runs while charging, the charger sees the system current
  as charge current and may never terminate. Done: `power.kicad_sch` now has P-MOSFET + Schottky load sharing
  (Q1 AO3401A + D7 B5819W → `VSYS`), see `plans/usb-power.md`.
- The MCP73831 has no thermistor input: no battery temperature protection while charging.
- The MAX17048 gauge is on the power sheet (I2C1, `FG_ALRT` on PE6), wired to the MCU.
- To test the gauge: log one full discharge and compare it with a known load or the power profiler.
  ModelGauge needs a few cycles to converge.

### Drain measures

For each block (VBAT,STM32, display, bluetooth, SD, capacitive,vs1053, DAC) we will have a solder jumper on VDD, and use it to measure drainage on different scenarios. This will help us measuring the battery capacity.

Notes:

- A multimeter in series misses the short peaks and drops voltage across itself. Use a power profiler
  (Nordic PPK2, ~100 €).
- Unplug the ST-LINK (or at least its 3V3) while measuring, otherwise it powers or loads the board.

### Screen tests

So I have this cheap TN and I want to buy a fancy IPS screen, see how they compare in terms of drainage, luminosity, colors and view angle.

Notes:

- The IPS panel is the Newhaven NHD-2.4-240320AF-CSXP (`datasheets/NHD-2.4-240320AF-CSXP.pdf`): ST7789VI
  controller, same 40-pin 0.5 mm FPC size but another pin order. It runs 16-bit 8080 like the ILI9341 (IM0-IM2
  low), so both panels share the bus with one CS each. The driver needs the ST7789 init sequence (`0x21` inversion).
- Designed in `hardware/opentone/screens.kicad_sch` (see `notes/screens.md`, "On the test board"):
  - One drain jumper per panel on VDD/VDDI. No load switch: both panels stay powered while the bus runs.
  - Backlight per panel: constant-current sink (MCP6001 + AO3400A + 1 Ω) gated by the PWM pin (PB10 / PA3),
    ~58 mA (TN) and ~82 mA (IPS). The anode comes from +3.3V or VSYS (jumper), a DNP cap turns the PWM into
    analog dimming.
- Compare the luminosity at the same backlight current, with a lux meter. The sink sets the current, so change
  the reference resistors (or the PWM duty) to compare at equal current or equal brightness.
- PWM noise: run TIM2 above 20 kHz and listen on the headphones while sweeping the duty (`notes/screens.md`,
  Testing). If it whines, fit the DNP cap and compare with analog dimming.
- Before ordering: check the FH12 (bottom contact) against both panels' FPC.

### USB

The board will have a usb-C port which should:

- Charge the battery
- Allow flashing the firmware on the STM32
- Allow file transferts (be recognised as a storage device and transfert files directly to the SD card)

We need to design the proper routing for all of that, let's find some opensource projects who did it before me.

Notes:

- Done: the CP2102N is gone, the USB-C data lines go straight to PA11/PA12 (OTG_FS) through 0R, VBUS sense on
  PA9. That gives both mass storage and DFU flashing; the BOOT0 button (SW402) is on the MCU sheet.
- The CC resistors are right: two separate 5.1 kΩ (a single shared one fails with C-to-C chargers).
- While the SD card is mounted as a USB drive, the player cannot touch it: the firmware has to stop playback.

## DAC vs vs1053

I have seen many projects are using this fancy cyrrus DAC. Let's have two audio output routes with one jack each, and see how each performs (the vs1053 output and the cyrrus).

- I m by no means an audiophile but I do have an accoustician friend who has a lots of hardware, he might be able to loan me some and help me measure things. He told me about measuring the Impulse response to see distortions. Why not, maybe I can do it with the laptop directly?
- Let's also measure the draw current on each
- Let's see which types of headphones each can handle, I heard the cyrrus is good for big gredy headphones?

Notes:

- CS43131-CWZR is (I think) the WLCSP package: 0.4 mm pitch, no hand soldering. The QFN one is
  CS43131-CNZ. Check before ordering.
- The DAC needs a 1.8 V rail, an I2C address on the shared bus and a RESET pin: decided (AP2112K-1.8 on
  `DAC_EN` PE2, address 0x30, RESET on PE1), see `notes/devboard-todo.md`. The sheet is not drawn yet.
- The VS1053 has a single I2S output, already going to the BT module. It now has to reach both the BT
  module and the DAC: add jumpers to pick the route.
- The VS1053 jack ground is GBUF, not GND. If the board is powered over USB by the laptop and the jack goes
  into the same laptop's line-in, GBUF gets shorted to ground. Measure on battery, or through a USB audio
  interface (also better than the laptop's own input).
- Tools: REW is free. Measure frequency response, THD+N, noise and crosstalk, into a 32 Ω dummy load and
  into real headphones. Impulse response is more a speaker/room measurement.
- Big headphones: high impedance ones (300 Ω) need voltage swing, low sensitivity ones need current. Check
  the CS43131 output voltage/power in its datasheet rather than its reputation.
