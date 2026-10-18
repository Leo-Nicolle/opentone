# Dev board schematics: state and TODO

State of `hardware/opentone/opentone.kicad_sch` (the test board of `plans/test-board.md`) on 2026-10-18.
Checked from the exported netlist and ERC (`kicad-cli sch erc`: 532 items, most of them pins not wired yet on the
MCU side).

## Sheets at a glance

| Sheet | File | State |
|---|---|---|
| Root | `opentone.kicad_sch` | Sheet blocks only (old STM32F446RCTx U1 removed) |
| MCU | `mcu.kicad_sch` | **STM32F446VET6 placed and wired** to every existing global label, ERC clean on its side |
| Power | `power.kicad_sch` | **Done, wired, ERC clean** (one expected error, see below). Tidied by hand |
| Audio | `audio.kicad_sch` | VS1053 wired and fixed. **No footprints** on 35 of 36 parts. CS43131 path not started |
| Screens | `screens.kicad_sch` | Two FPC connectors (TN + Newhaven IPS) + backlight sinks, wired to global labels |
| Bluetooth | `bluetooth.kicad_sch` | FSC-BT1035 on the board, wired to global labels for the MCU |
| Buttons | `buttons.kicad_sch` | **MPR121 + 5 SKQG buttons + OFF/HOLD/ON slider, wired**, wheel on a 6-pin FPC or header |

## Power (`power.kicad_sch`)

Design and part numbers: `plans/usb-power.md`.

- USB-C: CC 5.1k, polyfuse ASMD1206-075, USBLC6-2SC6 ESD, shield RC, 0R to `USB_DP`/`USB_DM` (PA12/PA11), VBUS
  divider to `VBUS_SENSE` (PA9). CP2102N removed.
- Charger MCP73831 (JP3: 500/100 mA), load sharing D7 (B5819W) + Q1 (AO3401A) → `VSYS`, LiPo on J3 through JP1.
- MAX17048 gauge on VBAT, I2C1, `FG_ALRT`.
- TPS63802 buck-boost → JP2 → `+3.3V`. AP7312 from VSYS → `+1V8` and, through JP4, `+3.3VA`.
- Both enabled by `3V3_EN` (R39 470k to VSYS, global label): the OFF position of the slider on the Buttons sheet
  pulls it low. The AP7312 EN pins used to be tied to VSYS (always on).
- Global nets: `VBUS`, `VSYS`, `VBAT`, `USB_DP`, `USB_DM`, `VBUS_SENSE`, `CHG_STAT`, `FG_ALRT`, `I2C1_SCL`, `I2C1_SDA`.

TODO

- [ ] Order the TPS63802 and the MAX17048 (TDFN) outside JLC (not stocked there)
- [ ] Check the L3 footprint (borrowed XAL4020) against the Coilcraft XFL4015 land pattern
- [ ] PCB: tie the MCP73831 exposed pad to GND (the KiCad symbol has no EP pin)
- [ ] R5/R6/R7 can become 47k / 100k (delete R6), see the VBUS_SENSE discussion
- [ ] Optional: name the nets the tidy pass left unnamed (`3V3_REG`, `3V3_FB`, `PROG_2K`)

## Audio (`audio.kicad_sch`)

Fixed on 2026-10-18:

- GPIO0-GPIO7 were all shorted together on `GPIO_PULL`: now one 100k pull-down each (R16, R17, R41-R46), as the
  VS1053 datasheet asks (GPIO0 must be pulled down or it tries to boot from SPI).
- XTALI was shorted to XRESET: XTALI is now only on the crystal network, XRESET on `VSRESET` with its own 100k
  pull-down (R47).
- XCS and XDCS were not connected: now `MP3_XCS` and `MP3_XDCS` global labels.
- SPI2 and jack detect renamed to match the MCU sheet: `SPI2_SCK`, `SPI2_MISO`, `SPI2_MOSI` (were `CLK`,
  `MISO`, `MOSI`), `HP1_DET` (was `JACK_SWITCH`). `VTX` (VS1053 UART TX) stays unconnected.
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

- [x] Wire the global labels on the MCU sheet
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
- [x] Wire `TFT_*` and `NRST` on the MCU sheet
- [ ] Tune the ballast and reference resistors after measuring each panel
- [ ] Optional: ERC flags Q201/Q301 as "differs from library" (embedded AO3400A copy): update the symbol from the
  library in KiCad

## MCU (`mcu.kicad_sch`)

Added on 2026-10-18, pinout from `docs/public/pinout/LQFP100/mapping.json`:

- U401 STM32F446VET6 (LQFP100). +3.3V → JP401 (drain jumper, bridged) → `MCU_3V3`: 6 × 100n (one per VDD) +
  4.7u, VBAT tied to VDD with its own 100n. VDDA/VREF+ through FB401 + 1u/100n (`MCU_VDDA`). VCAP_1/VCAP_2:
  2.2u each (DS10693 table 18).
- HSE 8 MHz (Y401, 3225 4-pin, 15p) and LSE 32.768 kHz (Y402, 3215, 6.8p).
- NRST: 100n + SW401, also on the panels' RESX. BOOT0: 10k pull-down + SW402 to `MCU_3V3` (DFU).
- J401 SWD 2x5 1.27 mm (SWO on PB3, RESET on NRST), J402 6-pin 2.54 mm matching the Nucleo's ST-LINK CN4,
  J403 log UART4 (PA0 TX, PA1 RX), J404 spare GPIO header (PA2, PA15, PB4, PC9, PC10, PC13).
- I2C1 pull-ups R402/R403 4.7k on the always-on +3.3V (there were none anywhere).
- Global labels for blocks that have no sheet yet (ERC `global_label_dangling`, expected): `PSRAM_*`, `SD_CK`,
  `SD_CMD`, `SD_D0`, `SD_EN`, `SD_CD`, `VS_EN`, `DRV_EN`, `DAC_RESET`, `DAC_EN`, `HP2_DET`.

TODO

- [ ] Pick the crystals and recompute the load caps (2 × (CL − stray), AN2867). HSE assumed CL 10 pF, LSE 6 pF
- [ ] Footprints for the reset/boot buttons (SW_SPST_PTS810 for now) and the SWD header (SMD 2x5) to confirm

## Buttons (`buttons.kicad_sch`)

Redone on 2026-10-18: the MPR121 moved from the click-wheel board to the test board. Same core as the Adafruit
breakout (`github.com/adafruit/Adafruit-MPR121-PCB`), without its regulator and level shifter (3.3 V only):

- U501 MPR121QR2 on +3.3V → JP501 (drain jumper) → `MPR_VDD`, 100n + 1u. VREG 100n, REXT 75k 1%.
- ADDR on VDD: address 0x5B (0x5A is the DRV2605L). `I2C1_SCL`/`I2C1_SDA` (pull-ups on the MCU sheet), `~IRQ`
  → `MPR121_IRQ` (PE4) with a 10k pull-up on +3.3V.
- Wheel electrodes on ELE0 right, ELE1 left, ELE2 top, ELE3 bottom, as the firmware reads them
  (`software/src/ClickWheel.hpp`; the old wheel-board sheet used ELE1/7/8/11), plus ELE4 = `WHEEL_CENTER`, a
  spare center electrode (not used by the firmware yet). ELE5-ELE11 not connected.
- Two wheel connectors in parallel: 1 top, 2 right, 3 bottom, 4 left, 5 GND (as the `clickwheel` symbol),
  6 center. J501 6-pin 0.5 mm FPC, J502 6-pin 2.54 mm header. Use one at a time.
  J501 is the Jushuo AFC07-S06FCA-00 (LCSC C262553, bottom contact, slide lock, stock KiCad footprint).
- SW501-SW505 SKQGAFE010 (center, top, right, bottom, left), soldered on the board under the wheel: pins 1-2 on
  `BTN_*` (PE11-PE15) with a 10k pull-up on +3.3V, pins 3-4 on GND. Active low, as on the old click-wheel devboard
  (its `click-wheel-base-devboard` project was deleted on 2026-10-18, it's in git history).
- SW506 power / hold slider, C&K OS103011MS8QP1 (SP3T, LCSC C221831), order OFF - HOLD - ON, common on GND:
  - OFF pulls `3V3_EN` low: TPS63802 and AP7312 off, the charger and the gauge stay on the battery (charging
    over USB still works). ~9 µA in R39 plus the gauge.
  - HOLD pulls `LOCK_SW` (PE3, 10k pull-up R508) low.
  - ON: both open.
  - ON → OFF passes HOLD: the firmware saves the state and finishes the SD writes on the `LOCK_SW` falling edge.
  - Symbol `opentone:SW_SP3T_OS103`: KiCad's `SW_SP3T` has the common on pin 3, the OS103 has it on 2
    (datasheet: positions 1-2, 2-3, 2-4).
- Removed: the electrode pattern (Clickwheel1) and the two 8-pin FH12 connectors of the wheel-board design.

TODO

- [ ] Check J501's contact side against the wheel's flex
- [ ] SW506 footprint is KiCad's OS103012MU1QP1 (same 1 / 2-3-4 terminal layout): check it against the
  OS103011MS8QP1 drawing, and where the slider sits in the case
- [ ] Firmware: `LOCK_SW` HOLD handling (save + SD flush on the falling edge), `WHEEL_CENTER` on ELE4 if needed

## Not started (from `plans/test-board.md`)


- [ ] PSRAM (APS6404L) on QUADSPI bank 2, with 22-33 Ω series footprints
- [ ] SD card on SDIO 1-bit (PC12, PD2, PC8), TPS22917 (`SD_EN`, PA7), card detect (PA8), pull-ups on the switched
  rail
- [ ] DRV2605L haptics (EN on PB5)
- [ ] Load switches + VDD drain jumpers for each block (STM32, display, BT, SD, MPR121, VS1053, DAC)
- [ ] Back-powering rules (`plans/test-board.md`, Design gotchas): pull-ups on switched rails, no load switch on an
  I2C device unless isolated
