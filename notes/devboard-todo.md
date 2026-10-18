# Dev board schematics: state and TODO

State of `hardware/opentone/opentone.kicad_sch` (the test board of `plans/test-board.md`) on 2026-10-18.
Checked from the exported netlist and ERC (`kicad-cli sch erc`: 532 items, most of them pins not wired yet on the
MCU side).

## Sheets at a glance

| Sheet | File | State |
|---|---|---|
| Root | `opentone.kicad_sch` | **Old MCU**: U1 is still the STM32F446RCTx (LQFP64), nothing wired |
| Power | `power.kicad_sch` | **Done, wired, ERC clean** (one expected error, see below). Tidied by hand |
| Audio | `audio.kicad_sch` | VS1053 wired and fixed. **No footprints** on 35 of 36 parts. CS43131 path not started |
| Screens | `screens.kicad_sch` | Two FPC connectors (TN + Newhaven IPS) + backlight sinks, wired to global labels |
| Bluetooth | `bluetooth.kicad_sch` | FSC-BT1035 on the board, wired to global labels for the MCU |
| Buttons | `buttons.kicad_sch` | MPR121 + click wheel + 5 buttons, from the breakout days |
| click-wheel-base-devboard | `click-wheel-base-devboard.kicad_sch` | Button header (J2) + 10k pull-ups |

## Power (`power.kicad_sch`)

Design and part numbers: `plans/usb-power.md`.

- USB-C: CC 5.1k, polyfuse ASMD1206-075, USBLC6-2SC6 ESD, shield RC, 0R to `USB_DP`/`USB_DM` (PA12/PA11), VBUS
  divider to `VBUS_SENSE` (PA9). CP2102N removed.
- Charger MCP73831 (JP3: 500/100 mA), load sharing D7 (B5819W) + Q1 (AO3401A) → `VSYS`, LiPo on J3 through JP1.
- MAX17048 gauge on VBAT, I2C1, `FG_ALRT`.
- TPS63802 buck-boost → JP2 → `+3.3V`. AP7312 from VSYS → `+1V8` and, through JP4, `+3.3VA`.
- Global nets: `VBUS`, `VSYS`, `VBAT`, `USB_DP`, `USB_DM`, `VBUS_SENSE`, `CHG_STAT`, `FG_ALRT`, `I2C1_SCL`, `I2C1_SDA`.

TODO

- [ ] Order the TPS63802 and the MAX17048 (TDFN) outside JLC (not stocked there)
- [ ] Check the L3 footprint (borrowed XAL4020) against the Coilcraft XFL4015 land pattern
- [ ] PCB: tie the MCP73831 exposed pad to GND (the KiCad symbol has no EP pin)
- [ ] R5/R6/R7 can become 47k / 100k (delete R6), see the VBUS_SENSE discussion
- [ ] Optional: name the nets the tidy pass left unnamed (`3V3_REG`, `3V3_FB`, `PROG_2K`)
- Expected ERC error: MAX17048 SCL "not driven" until the MCU is wired

## Audio (`audio.kicad_sch`)

Fixed on 2026-10-18:

- GPIO0-GPIO7 were all shorted together on `GPIO_PULL`: now one 100k pull-down each (R16, R17, R41-R46), as the
  VS1053 datasheet asks (GPIO0 must be pulled down or it tries to boot from SPI).
- XTALI was shorted to XRESET: XTALI is now only on the crystal network, XRESET on `VSRESET` with its own 100k
  pull-down (R47).
- XCS and XDCS were not connected: now `MP3_XCS` and `MP3_XDCS` global labels.
- I2S out as global nets: `I2S_MCLK` (GPIO5), `I2S_SCLK` (GPIO6), `I2S_LRCK` (GPIO4), `I2S_SDATA` (GPIO7).
  VS1053 I2S: 48/96/192 kHz, MCLK = 12.288 MHz, 16 bits per channel, 3.3 V levels.

TODO

- [ ] Footprints for every part of the sheet (only the jack has one)
- [ ] VS_EN load switch (TPS22917, PA6) on the VS1053 supplies, and a drain jumper
- [ ] Check the jack 1 wiring (GBUF on the sleeve: never measure it with the laptop's line-in while on USB)
- [ ] CS43131 path, on its own sheet (on hold). Decided so far:
  - CS43131-CNZ (QFN-40 5x5, footprint `TQFN-40-1EP_5x5mm_P0.4mm_EP3.5x3.5mm`), I2C address 0x30 (ADR to GND)
  - VA/VCP/VD/VL all 1.8 V: AP2112K-1.8 from +3.3V, EN = `DAC_EN` (PE2), replaces the planned load switch
  - VP from VSYS (needed for the 2 Vrms mode) or +3.3V, picked by a jumper. VP must come up first, so RESET stays
    low (100k pull-down on PE1) until the 1.8 V rail is up
  - VL pins take at most VL + 0.3 V: SN74AVC4T245 for I2S (3.3 → 1.8 V), PCA9306 for I2C, its EN from `DAC_EN` so
    the DAC leaves the bus when it is off
  - MCLK from the VS1053 (12.288 MHz, the CS43131 PLL accepts it), no crystal
  - INT to PA2 (spare, EXTI2), jack 2 detect on the DAC's HP_DETECT (frees PA10)
  - Open question: the datasheet gives no input threshold for RESET (VP domain). Fine with VP = 3.3 V, to check with
    VP = VSYS
  - Decoupling per Fig. 2-1 of `datasheets/cs43131.pdf`

## Bluetooth (`bluetooth.kicad_sch`)

Redone on 2026-10-18: the FSC-BT1035 sits on the test board (it was a separate devboard plugged in through
headers). `bt_devboard.kicad_sch` became this sheet, the old connector sheet and the standalone `bt_devboard`
project are gone.

- Supply: +3.3V → JP5 (drain jumper) → TPS22917 (U102, `BT_EN` = PD7, 100k pull-up) → VBAT_IN / VDD_IO. JP101
  bypasses the switch. Auto power-on on SYS_CTRL (Q101) kept.
- UART: `BT_RX`, `BT_TX`, `BT_CTS`, `BT_RTS` global labels (USART2, PD3-PD6). `BT_RESET` global label (PE0,
  open-drain).
- I2S from the VS1053: `I2S_SCLK` / `I2S_LRCK` / `I2S_SDATA` → R51-R53 (0R, unfit to free the bus for the DAC) →
  PCM_CLK / PCM_SYNC / PCM_IN. PCM_MCLK_OUT is left open.
- Removed: USB-C (VCHG, VCHG_SENSE, USB_D± open: no USB firmware update path), line-in jack and its dividers
  (MIC inputs open), debug header (PIO6-8 open), reset button, the Nucleo/UART/I2S headers.
- Kept: status LEDs D101/D102, bypass jumper JP101.

TODO

- [ ] Wire the global labels on the MCU sheet (ERC: dangling `BT_*` labels, U101 RESET "not driven" until then)
- [ ] Firmware: before pulling `BT_EN` low, put USART2, `BT_RESET` and the I2S lines in analog mode (back-powering)

## Screens (`screens.kicad_sch`)

Added on 2026-10-18 (replaces the old screen symbol + connector on the root sheet):

- J201: cheap ILI9341 TN panel, pinout from `notes/screens.md` ("FPC" column: pin 1 = X- touch). J301: Newhaven
  NHD-2.4-240320AF-CSXP (ST7789VI, `datasheets/NHD-2.4-240320AF-CSXP.pdf`). Both on Hirose FH12-40S-0.5SH.
- Shared 16-bit 8080 bus as global labels: `TFT_D0`-`TFT_D15`, `TFT_DC`, `TFT_WR`; `TFT_CS1` (TN), `TFT_CS2` (IPS).
  RDX tied to the panel rail, RESX on `NRST`, IM0-IM2 low, SDI/SDA low, SDO/TE/FMARK/touch open.
- Each panel: +3.3V → drain jumper (JP201 / JP301) → VDD + VDDI, 10u + 100n. No load switch: both stay powered.
- Backlight per panel: anode from +3.3V or VSYS (3-pad jumper JP202 / JP302) → ferrite → LED-A + 10u/100n;
  4.7 Ω ballast per cathode; constant-current sink MCP6001 + AO3400A + 1 Ω. Reference = `TFT_BL` / `TFT_BL2` PWM
  through 56k/1k (TN, ~58 mA) or 39k/1k (IPS, ~82 mA). C206 / C306 (DNP 1u) turn it into analog dimming.

TODO

- [ ] Check the FH12 contact side (bottom contact) against both panels' FPC before ordering
- [ ] Wire `TFT_*` and `NRST` on the MCU sheet
- [ ] Tune the ballast and reference resistors after measuring each panel
- [ ] Optional: ERC flags Q201/Q301 as "differs from library" (embedded AO3400A copy): update the symbol from the
  library in KiCad

## Not started (from `plans/test-board.md`)

- [ ] **MCU sheet**: replace U1 with the STM32F446VET6 (LQFP100), pinout from `docs/public/pinout/LQFP100/mapping.json`
  - SWD header (PA13, PA14, NRST, SWO PB3), reset button, BOOT0 pull-down + button (DFU)
  - 8 MHz HSE, 32.768 kHz LSE, VCAP_1, VDDA filter, decoupling on every VDD, a drain jumper on the MCU VDD
  - Wire every global label of the other sheets: USB, VBUS_SENSE, CHG_STAT, FG_ALRT, I2C1, I2S (none on the MCU),
    VS1053 SPI2 + XCS/XDCS/DREQ/XRESET, BT UART + EN/RESET
- [ ] PSRAM (APS6404L) on QUADSPI bank 2, with 22-33 Ω series footprints
- [ ] SD card on SDIO 1-bit (PC12, PD2, PC8), TPS22917 (`SD_EN`, PA7), card detect (PA8), pull-ups on the switched
  rail
- [ ] DRV2605L haptics (EN on PB5)
- [ ] Load switches + VDD drain jumpers for each block (STM32, display, BT, SD, MPR121, VS1053, DAC)
- [ ] Back-powering rules (`plans/test-board.md`, Design gotchas): pull-ups on switched rails, no load switch on an
  I2C device unless isolated
