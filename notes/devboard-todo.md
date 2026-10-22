# Dev board schematics: state and TODO

State of `hardware/opentone/opentone.kicad_sch` (the test board of `plans/test-board.md`) on 2026-10-22.
Checked from the exported netlist and ERC (`kicad-cli sch erc`: 3 items, the CS43131 labels waiting for their sheet:
`DAC_EN`, `DAC_RESET`, `HP2_DET`). The audio sheet was snapped to the 1.27 mm grid (netlist unchanged), and the
unused VS1053 TX (`VTX`) now has a no-connect flag.

## Sheets at a glance

| Sheet | File | State |
|---|---|---|
| Root | `opentone.kicad_sch` | Sheet blocks only (old STM32F446RCTx U1 removed) |
| MCU | `mcu.kicad_sch` | **STM32F446VET6 placed and wired** to every existing global label, ERC clean on its side |
| Power | `power.kicad_sch` | **Done, wired, ERC clean**. VS1053 LDO on `VS_EN` + drain jumper, GND/GNDA net tie |
| Audio | `audio.kicad_sch` | **VS1053 done**: switched by `VS_EN`, `HP1_DET` read by the ADC. CS43131 path on hold |
| Screens | `screens.kicad_sch` | Two FPC connectors (TN + Newhaven IPS) + backlight sinks, wired to global labels |
| Bluetooth | `bluetooth.kicad_sch` | FSC-BT1035 on the board, wired to global labels for the MCU |
| Buttons | `buttons.kicad_sch` | **MPR121 + 5 SKQG buttons + OFF/HOLD/ON slider + DRV2605L haptics, wired** |
| Memory | `memory.kicad_sch` | **APS6404L PSRAM (QUADSPI bank 2) + microSD (SDIO 1-bit, TPS22917), wired**, ERC clean |

## Power (`power.kicad_sch`)

Design and part numbers: `plans/usb-power.md`.

- USB-C: CC 5.1k, polyfuse ASMD1206-075, USBLC6-2SC6 ESD, shield RC, 0R to `USB_DP`/`USB_DM` (PA12/PA11), VBUS
  divider to `VBUS_SENSE` (PA9). CP2102N removed.
- Charger MCP73831 (JP3: 500/100 mA), load sharing D7 (B5819W) + Q1 (AO3401A) → `VSYS`, LiPo on J3 through JP1.
- MAX17048 gauge on VBAT, I2C1, `FG_ALRT`.
- TPS63802 buck-boost → JP2 → `+3.3V`, enabled by `3V3_EN` (R39 470k to VSYS, global label): the OFF position of
  the slider on the Buttons sheet pulls it low.
- Two TI TPS7A20 LDOs (SOT-23-5, replaced the NRND AP7312 on 2026-10-22) feed only the VS1053: VSYS → JP6 (drain
  jumper) → `VS_VIN` → U14 TPS7A2018 → `+1V8` (core) and U13 TPS7A2033 → `AVDD_LDO` → JP4 → `+3.3VA` (analog
  **and IO**). Both EN on `VS_EN` (PA6) with R8 100k pull-down: the MCU switches the whole VS1053, and it is off
  whenever the MCU is. 1 µF in (C65, C68) and out (C52, C69) per the datasheet. With JP4 on 2-3 (+3.3V through FB3) the VS1053 is no longer
  switched.
- GND and GNDA meet at NT1 (net tie, was the FB2 ferrite): place it under the VS1053 AGND pins. A ferrite in the
  ground return adds audio-frequency ground bounce.
- Named nets: `3V3_REG`, `3V3_FB`, `PROG`, `PROG_2K`, `PROG_10K`, `VS_VIN`. PWR_FLAGs on the rails fed through
  jumpers.
- Global nets: `VBUS`, `VSYS`, `VBAT`, `USB_DP`, `USB_DM`, `VBUS_SENSE`, `CHG_STAT`, `FG_ALRT`, `I2C1_SCL`, `I2C1_SDA`.

TODO

- [ ] Order the TPS63802 and the MAX17048 (TDFN) outside JLC (not stocked there)
- [x] L3 is now a Murata DFE252012P-R47M (2.5x2.0 mm, end terminals like a 1008 chip: hand-solderable, JLC C237552).
  The XFL4015 had its terminals under the body only. 0.47 µH, Isat 5.7 A, 27 mΩ (the XFL4015 had 7.6 mΩ: ≈25 mW more
  at 1 A). Footprint `L_1008_2520Metric_Pad1.43x2.20mm_HandSolder`
- [x] MCP73831 exposed pad: own symbol `opentone:MCP73831-2-MC_EP` with pin 9 (EP) on GND, so F8 gives the pad its
  net. ~1 W at the start of a 500 mA charge ((5 − 3.0 V) × 0.5 A)
- [ ] PCB: GND copper under the MCP73831 EP with 4-6 vias to the ground plane
- [x] VBUS_SENSE divider: R6 removed, R5 47k / R7 100k (≈3.4 V at 5 V, 3.57 V at 5.25 V)
- [x] Name the nets the tidy pass left unnamed (`3V3_REG`, `3V3_FB`, `PROG`, `PROG_2K`, `PROG_10K`)
- [x] VS1053 switch (`VS_EN` on the TPS7A20 EN pins) and drain jumper JP6

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

- [x] Footprints for every part of the sheet (2026-10-22, see "Parts and BOM" below)
- [x] `HP1_DET` read by the ADC (PB1 = ADC12_IN9): R4 47k pull-up to **+3.3VA**. The tip switch (Jack1 pin 5)
  touches the tip with no plug (pin reads LEFT, ≈1.2 V bias) and opens with a plug (pin reads ≈3.3 V). Threshold
  ≈2.2 V, sample time 480 cycles (47k is under the 50k RAIN limit). The pull-up is on the switched rail, so it
  never back-powers the VS1053; the reading is only valid while `VS_EN` is high. In analog mode the STM32
  pull-ups/downs are off, hence the external resistor
- [x] `VS_EN` switches the whole VS1053 through the LDO EN pins (no extra IC). IOVDD, XTEST, their decoupling
  (C40, C42, C44, C45) and the RX pull-up R3 moved from +3.3V to +3.3VA. Drain jumper JP6 on the LDO inputs
  (power sheet)
- [ ] Firmware: before pulling `VS_EN` low, put SPI2 (PB13-PB15), `MP3_XCS`, `MP3_XDCS` and `VSRESET` in analog
  mode, and stop I2S toward the BT module
- [ ] Option, not done: drop the GPIO4-GPIO7 pull-downs (R43-R46). See "GPIO4-7 pull-downs" below
- [x] Jack 1 wiring checked against the SJ-43515TS-SMT-TR drawing: 1 sleeve and 4 ring 2 → GBUF, 2 tip → LEFT,
  3 ring 1 → RIGHT, 5 tip switch → `HP1_DET`. Ring 2 is the mic on OMTP headsets but the **ground** on CTIA ones
  (Apple, most current headsets), where the sleeve is the mic. We have no mic input, so both go to GBUF: any plug
  gets its return (a TRS plug's sleeve spans both contacts anyway) and the unused mic is just shorted to GBUF
  (no bias, no current). Leaving ring 2 open would cut the return of CTIA headsets (only L-R left: no voice).
  Never measure GBUF with the laptop's line-in while on USB. The old SJ1-3524NG had no switch: its pad 10 (HP1_DET) did not exist
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
  - Decoupling per Fig. 2-1 of `datasheets/audio/cs43131.pdf`

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
  NHD-2.4-240320AF-CSXP (ST7789VI, `datasheets/display/NHD-2.4-240320AF-CSXP.pdf`). Both on Hirose FH12-40S-0.5SH.
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
- [x] Q201/Q301 (and D4) updated from the library: ERC no longer flags them

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
- Global labels for blocks that have no sheet yet (ERC `isolated_pin_label`, expected): `DAC_RESET`, `DAC_EN`,
  `HP2_DET`. `VS_EN` and `DRV_EN` now land on the Power and Buttons sheets, `PSRAM_*` and `SD_*` on Memory.

TODO

- [x] Crystals picked: HSE KYX K3A080001010 (8 MHz, CL 10 pF, 15 pF caps), LSE Epson FC-135 32.7680KA-E (CL 6 pF,
  6.8 pF caps). Check the LSE drive level / gm margin (AN2867) once the board runs
- [x] Reset/boot buttons C&K PTS810SJG250SMTRLFS, SWD header Amphenol 20021121-00010C4LF (SMD 2x5 1.27 mm)

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
- SW506 power / hold slider, C&K PCM13SMTR (SMD right-angle SP3T, on the board edge like the iPod hold switch, not
  at JLC: hand-solder), order OFF - HOLD - ON, common on GND:
  - OFF pulls `3V3_EN` low: TPS63802 off, so the MCU is off and `VS_EN` (pull-down) turns the VS1053 LDOs off too.
    The charger and the gauge stay on the battery (charging over USB still works); the DRV2605L goes off with
    +3.3V. ~9 µA in R39 plus the gauge.
  - HOLD pulls `LOCK_SW` (PE3, 10k pull-up R508) low.
  - ON: both open.
  - ON → OFF passes HOLD: the firmware saves the state and finishes the SD writes on the `LOCK_SW` falling edge.
  - Symbol `opentone:SW_SP3T_PCM13`, footprint `Button_Switch_SMD:SW_SP3T_PCM13`: common on 3, positions 1-3,
    2-3, 3-4 (C&K PCM catalog). Pin 1 = `3V3_EN`, 2 = `LOCK_SW`, 4 not connected. The THT OS103 symbol stays in
    the library, unused
- U502 DRV2605L haptics (added 2026-10-22), driving the 10 mm coin ERM the firmware already uses
  (`software/src/Haptics.hpp`, ERM library effects):
  - +3.3V → JP502 (drain jumper) → `DRV_VDD` (pins 6 and 10), 1u + 100n. REG 1u. Moved from VSYS on 2026-10-22
    (see the absolute max item below): same rail as the I2C pull-ups and the MCU, so its pins can never sit above
    VDD + 0.3 V. The motor peaks (~100 mA) now come from the TPS63802; the 3 V coin ERM runs fine at 3.3 V
    (less overdrive headroom than VSYS).
  - `I2C1_SCL`/`I2C1_SDA`, address 0x5A (fixed). Pull-ups on +3.3V, the same rail as its VDD.
  - EN = `DRV_EN` (PB5) with R509 100k pull-down: shutdown while the MCU is off or booting. IN/TRIG on GND
    (internal trigger, as the firmware does).
  - Motor on two solder pads TP501 (M+) / TP502 (M-), out of the BOM.
  - DRV2605LDGSR is not at JLC: self-sourced.
- Removed: the electrode pattern (Clickwheel1) and the two 8-pin FH12 connectors of the wheel-board design.

TODO

- [ ] Check J501's contact side against the wheel's flex
- [ ] SW506 (PCM13SMTR): place it on the board edge, actuator out, and check where the slider sits in the case
- [ ] Firmware: `LOCK_SW` HOLD handling (save + SD flush on the falling edge), `WHEEL_CENTER` on ELE4 if needed
- [x] DRV2605L input levels checked (`datasheets/input/drv2605l.pdf`): VIH = 1.3 V and VIL = 0.5 V, fixed, so the 3.3 V bus
  reads fine whatever its VDD
- [x] DRV2605L absolute max on SDA, SCL, EN, IN/TRIG is **VDD + 0.3 V**. On VSYS this broke when the battery sank
  below ≈3.0 V with +3.3V still up (the buck-boost holds 3.3 V down to an empty cell). Fixed on 2026-10-22: `DRV_VDD`
  now comes from +3.3V. Only case left: JP502 cut while the bus is powered (back-feed through SDA/SCL), so measure
  its drain with the meter in place, never with the jumper open
- [ ] Firmware: drive `DRV_EN` high before talking to the DRV2605L (the pull-down keeps it in shutdown)

## Memory (`memory.kicad_sch`)

Added on 2026-10-22, pinout from `docs/public/pinout/LQFP100/mapping.json`.

- U601 APS6404L-3SQN-SN (3.3 V, SOIC-8). +3.3V → JP601 (drain jumper) → `PSRAM_VDD`, 100n + 4.7u. No load
  switch (decided): the PSRAM holds the page cache, it stays powered.
- R601-R606 0R in series on `PSRAM_CS`, `PSRAM_CLK`, `PSRAM_IO0`-`IO3` (MCU side) → `PSRAM_CE`, `PSRAM_SCLK`,
  `PSRAM_SIO0`-`SIO3` (chip side). Become 22-33 Ω if the edges ring. Place them next to the MCU.
- 10k pull-up on CE# only. Datasheet section 7: CE# high, CLK and SIO0-SIO3 low from the power ramp until
  tPU = 150 µs, then a RESET (0x66 + 0x99). So no pull-ups on SIO2/SIO3 (they were there at first, removed); the
  chip ignores them in SPI mode anyway.
- SPI fallback: no second routing. QUADSPI runs single-line (plain SPI) on the same pins: SI = IO0 (PE7),
  SO = IO1 (PE8). PE7-PE10 have no SPI alternate function, so the last resort is bit-banging the same pins.
- J601 Hirose DM3AT-SF-PEJM5 microSD. +3.3V → JP602 (drain jumper) → TPS22917 (U602, ON = `SD_EN` with a
  100k pull-down: off through reset, CT 1n, QOD through R611 0R, JP603 bypass) → `SD_VDD`, 10u + 100n. Same
  scheme as the Bluetooth switch.
- R612-R614 0R in series on `SD_CK`, `SD_CMD`, `SD_D0`. 47k pull-ups on CMD and DAT0-DAT3 to `SD_VDD` (switched
  rail, see back-powering). DAT3 pulled up = SD mode at CMD0.
- Card detect: DET_A on GND, DET_B on `SD_CD` (PA8) with R620 100k to the always-on +3.3V: works while the card is
  off. The DM3AT switch is normally open, closed with a card in (`datasheets/memory/hirose-sd-card.pdf` p. 3): low = card
  in.
- J601 footprint: KiCad's `microSD_HC_Hirose_DM3AT-SF-PEJM5`, checked against the land pattern on p. 3 (1.1 mm
  pitch, pad 9 = switch B, pad 10 = switch A, 4 shell pads on GND). Its keepouts carry the datasheet's "no
  conductive traces" areas: no tracks or vias under the card slot.

TODO

- [ ] Line resistors (R601-R606 on the PSRAM, R612-R614 on the SD card): fitted as 0R. They are source
  termination, so on the PCB they go right next to the MCU pins, not next to the PSRAM / card. On the bench, probe
  the PSRAM CLK and the SD CLK at the far pin (short ground spring, not the long clip): if they overshoot or ring
  past ~10 % of 3.3 V, first lower the GPIO speed (OSPEEDR), then swap in 22 Ω, 33 Ω if still needed. Do the
  six PSRAM lines at once to keep their delays matched. Re-run the QUADSPI benchmark after each change.
- [ ] Firmware: QUADSPI driver (indirect writes, memory-mapped reads, split transfers for tCEM = 8 µs), single-line
  mode as the fallback. Wait 150 µs after power-up and send RESET (0x66 + 0x99) before the first access
- [ ] Firmware: `SD_EN` sequence, PC12/PD2/PC8 in analog mode before cutting the card

## Parts and BOM

Assigned on 2026-10-22: every part has `Footprint`, `Manufacturer`, `Part number`, `LCSC` and `Datasheet` fields
(datasheets are the manufacturer PDF, the JLC copy of it, or a file in `datasheets/`). Solder jumpers and TP1 are out
of the BOM.

- Passives in 0603, JLC Basic parts (UNI-ROYAL 0603WAF resistors, Samsung/Yageo MLCCs, Sunlord GZ1608D601TF
  ferrites, KT-0603R LEDs). Exceptions: bulk caps on VBUS/VBAT/VSYS and the TPS63802 output stay 0805 25 V
  (`plans/usb-power.md`), F2 1206, L3 DFE252012P (1008), C9 1206.
- Audio grade only in the jack path: C3/C29 (10 nF) Murata GRM1885C1H103JA01D and C9 (47 nF, 1206)
  GRM31M5C1H473JA01L, all C0G. RCAP (C34) and the VS1053 supply caps are regular X5R/X7R. The polarized
  C33/C35/C40 became 10 µF X5R MLCCs.
- VS1053 crystal: Y1 (was `Cristal1`) TXM12.288M0004322FBCDO00T, 12.288 MHz 3225 CL 12 pF, 4-pin symbol with the
  case pins on GND. C36/C38 33 pF → 18 pF.
- U10 is now ST's USBLC6-2SC6 (C7519), not the GOODWORK copy (C21713975).
- Not at JLC (self-sourced, `LCSC` empty): TPS63802DLAR, MAX17048G+T10, TPS22917DBVR (U102/U602),
  APS6404L-3SQN-SN, FSC-BT1035, PCM13SMTR, DRV2605LDGSR,
  TPS7A2033PDBVR + TPS7A2018PDBVR (JLC only lists unbranded "-TP" SOT-23 copies; genuine TI is in X2SON 1x1 only). The jack (C5353507) is on LCSC but not in the JLC assembly snapshot:
  check its stock when ordering.
- The 2.54 mm debug headers J402-J404 are out of the BOM (THT, generic, hand-solder or DNP).
- The PCB still has the old footprints: run Update PCB from Schematic (F8) and check the 0805 → 0603 swaps.

## Design review fixes (2026-10-22)

From an external schematic review (pasted 2026-10-22), checked against the netlist and datasheets:
- [x] **Jack ESD**: U15 TPD4E05U06DQAR (TI, C138714, 4 ch, 0.5 pF, 10 nA) on `HP_L`, `HP_R`, `HP_GBUF` and
  `HP1_DET`, return on GNDA. PCB: right at Jack1, short ground path. The lines go straight from the jack to the
  VS1053 (R13/R2/R14 are the RC networks to GNDA, not series resistors), so this is their only protection.
- [x] **VBUS clamp**: D8 SMF5.0A (Littelfuse, C151296, SOD-123FL) from VBUS to GND after F2. Catches hot-plug
  spikes; a sustained overvoltage makes it conduct until F2 trips. PCB: next to USB1/F2.
- [x] **MCP73831 EP** on GND (see the Power section).
- [x] **Backlight sink compensation**, both panels: R216/R316 0R between the source node (Q201/Q301, R212/R312) and
  `TFTn_BL_S` (the op-amp -IN), C207/C307 4n7 **DNP** from the op-amp output to `TFTn_BL_S`. If the sink rings
  at bring-up (scope the gate and the sense node), make R216/R316 1k and fit 1-10 nF.
- [x] **Rail test pads** TP2-TP6 on VSYS, VBAT, +3.3V, +1V8, +3.3VA (power sheet, out of BOM).
- [x] **Status LED** D401 (red) + R404 1k from `MCU_3V3` into PC13 (`STATUS_LED`, active low, ~1.4 mA; PC13 can
  only sink 3 mA). Still on J404 pin 6.
- [x] **Battery reverse polarity**: Q2 AO3401A in series between J3+ and JP1/VBAT (drain on J3, source on the
  board side, gate to GND through R6 100k). With a correct pack the body diode conducts first, then Vgs = −VBAT
  turns the channel on (~60 mΩ, both directions, so charging still works). With a reversed pack the body diode
  blocks and Vgs = 0: the MCP73831 and the MAX17048 never see −3.7 V. Cost: the gauge reads the cell through the
  FET, ≈5-20 mV low while discharging (0.1-0.3 A) and ≈30 mV high while charging at 0.5 A, on top of the cell's own
  100-200 mΩ. No error at rest. Still on a deeply discharged cell (2.5 V): Rds(on) ≈ 85 mΩ, fine.
- [ ] Battery polarity, still: buy packs with a protection PCM (Q2 does not limit over-discharge or short
  circuit), put a "+" on the silkscreen next to J3, and write the polarity in the J3 BOM line.
- [ ] **Enclosure**: the iPod back plate (`hardware/3dmodels/`) is metal. The FSC-BT1035 antenna needs a plastic
  window or an edge facing out.
- Not changed, on purpose: VBUS inrush with no battery (~15 µF, the PTC limits it), both panels' RESX on NRST, no
  BT USB recovery pads, backlight offset (±4.5 mV on a 58 mV setpoint: use PWM dimming at low levels).

## Drain jumpers and switches

Every block has a VDD drain jumper (solder jumper, bridged, cut it to put a meter in series), never on GND:

| Block | Jumper | Switch | Rail |
|---|---|---|---|
| Battery | JP1 | - | VBAT |
| 3.3 V buck-boost | JP2 | `3V3_EN` (slider) | +3.3V |
| VS1053 | JP6 | `VS_EN` (PA6, U13/U14 EN) | +1V8, +3.3VA |
| MCU | JP401 | - | `MCU_3V3` |
| Panels | JP201 / JP301 | - (always on) | `TFT1_VDD` / `TFT2_VDD` |
| Bluetooth | JP5 | `BT_EN` (PD7, TPS22917) | `BT_3V3` |
| MPR121 | JP501 | - (shares I2C1, see below) | `MPR_VDD` |
| Haptics | JP502 | `DRV_EN` (PB5, chip shutdown) | `DRV_VDD` |
| PSRAM | JP601 | - (holds the page cache) | `PSRAM_VDD` |
| SD card | JP602 | `SD_EN` (TPS22917) | `SD_VDD` |
| CS43131 | later | `DAC_EN` | on hold with its sheet |

- [ ] CS43131: drain jumper and switch when its sheet is drawn

## AVDD source A/B test (JP4)

The VS1053 analog supply `+3.3VA` (AVDD and, since 2026-10-22, IOVDD) can come from two sources. JP4 picks one,
so we can find out at bring-up whether the dedicated LDO is worth keeping on the final board.

| | **A: dedicated LDO (pads 1-2, default)** | **B: filtered buck-boost (pads 2-3)** |
|---|---|---|
| Source | U13 TPS7A2033, fed from VSYS (`VS_VIN`) | main `+3.3V` (TPS63802) → FB3 600 Ω ferrite + C66 10 µF |
| Noise | 7 µVrms, 95 dB PSRR at 1 kHz | what gets through the ferrite: 2 MHz ripple, plus the power-save bursts (MODE to GND), which can land in the audio band at light load |
| Low battery | follows VBAT below ≈3.35 V (dropout): needs the 3.2 V cutoff | stays at 3.3 V down to an empty cell (buck-boost) |
| `VS_EN` | switches AVDD/IOVDD and the core | switches only the 1.8 V core (U14), AVDD/IOVDD always on |
| Final board | keeps U13 (U14 stays in both cases) | drops U13 + C52 |

How to switch: the footprint ships with a copper trace on 1-2 (`SolderJumper_3_Bridged12`). For B, cut that trace
first, then bridge 2-3. **Never bridge all three pads**: U13 and the TPS63802 would fight on the same net
(either one back-feeds the other), and with `VS_EN` low the U13 output discharge (150 Ω) would load the main rail
through FB3 (≈22 mA).

- [ ] Bring-up test, same setup for A and B:
  - Play digital silence and a −60 dBFS 1 kHz tone. Record the headphone output with a sound card (noise floor,
    hum, whine, spurs), and listen with sensitive in-ear monitors.
  - Scope `+3.3VA` (AC coupled, short ground spring): 2 MHz ripple and power-save bursts.
  - Repeat under load (backlight on, Bluetooth streaming, SD reads), at light load (power-save bursts are worst
    there), on USB and on battery near 3.3 V.
  - Check the VS1053 still behaves at the low end in A (battery 3.2-3.3 V: AVDD and IOVDD below 3.3 V).
- [ ] Decide for the final board: B clean enough → drop U13/C52 and the 3.2 V cutoff constraint; otherwise keep A
  and drop JP4/FB3/C66. Either way JP4 goes.

## Back-powering check

Rules in `plans/test-board.md` (Design gotchas). Re-run this check after any change to a supply or a pull-up.

### Procedure

1. **List the domains.** Export the netlist (`kicad-cli sch export netlist`) and list every supply net with what
   feeds it and what switches it (table above, plus the always-on ones: VBUS, VSYS, VBAT, +3.3V).
2. **Find the crossings.** For each switched domain, list every signal net that has a pin in that domain and a pin
   in another domain (MCU, another block, a pull-up to another rail).
3. **Check each crossing**:
   - a pull-up on that net goes to the switched rail, never to an always-on rail;
   - a pull-down is fine anywhere (it can't feed a dead rail);
   - an open-drain line shared with an always-on device (I2C) stays powered: no switch on such a device unless
     it is isolated from the bus;
   - the MCU lines toward the block have a firmware rule: analog mode (or driven low) before the rail is cut.
4. **Look the other way.** Find always-on drivers that can push current into a dead rail: an output of a
   powered chip, or a divider from VBUS/VSYS, into a block whose VDD is off. Check the current through the
   path (V / R) and the clamp diode it lands on.
5. **At bring-up**, for each switched block: cut its supply in firmware, leave everything else running, and check
   that its rail stays under ~0.3 V and that the current through its drain jumper is ≈0. Repeat with the slider in
   OFF and USB plugged (the only state where VBUS-powered parts run with +3.3V down).

### Findings (2026-10-22)

Fixed in the schematic:
- VS1053 RX pull-up R3 was on the always-on +3.3V: now on +3.3VA (switched with the VS1053).
- VS1053 IOVDD and XTEST were on the always-on +3.3V while AVDD/CVDD were switched: now all on the switched rails,
  so `VS_EN` turns the whole chip off.
- New `HP1_DET` pull-up R4 goes to +3.3VA, not +3.3V.

OK as is:
- SD: CMD/DAT pull-ups R615-R619 on `SD_VDD` (switched). `SD_CD` pull-up R620 on +3.3V only reaches the
  connector's mechanical switch, not the card.
- PSRAM: CE# pull-up R607 on `PSRAM_VDD` (never switched).
- I2C1 pull-ups (R402/R403) on +3.3V. The MAX17048 (VBAT) stays powered when +3.3V is down:
  a powered device on a dead bus, the safe direction. The MPR121 and the DRV2605L are on +3.3V like the pull-ups.
- Bluetooth: `BT_EN` pull-up R101 is on the switch input (always on), which is what it should be.
- Backlights with JP202/JP302 on VSYS: the sink gate has a 100k pull-down (R213/R313), so the LEDs stay dark when
  +3.3V (and the MCP6001) is off.
- Pull-downs `VS_EN` (R8), `DRV_EN` (R509), `SD_EN`, `VSRESET` (R47): keep their blocks off while the MCU boots
  or is off.

Firmware rules (not schematic issues):
- [ ] VS1053: SPI2, `MP3_XCS`, `MP3_XDCS`, `VSRESET` to analog before `VS_EN` goes low.
- [ ] VS1053 → BT I2S (`I2S_SCLK`, `I2S_LRCK`, `I2S_SDATA` through R51-R53): when the VS1053 is off and the BT
  module on, make sure the module does not drive or pull up its PCM pins. Measure at bring-up; R51-R53 can be
  left unfit.
- [ ] Bluetooth and SD card: already in their sections (analog mode before cutting the rail).
- [ ] Low-battery cutoff at **3.2 V or higher** (gauge reading). +3.3VA (VS1053 AVDD and IOVDD) comes from U13,
  which follows VBAT once the battery drops under ~3.35 V (dropout ~40 mV at ~65 mA). IOVDD must stay ≥ 3.0 V
  so the VS1053 inputs still see the MCU's 3.3 V highs as valid (VIH max = IOVDD + 0.31 V) and AVDD keeps its
  headroom. Below ~3.3 V expect slightly lower output swing, below 3.1 V stop playback.

Open:
- [x] Charger status into a dead +3.3V: with the slider in OFF, USB plugged and the charge done, the MCP73831 STAT
  pin drives high (VBUS) through R34 and R35 into the dead +3.3V rail. Was ≈45 µA with 10k/100k; now R34 100k +
  R35 1M (same 10:1 ratio, so charging still reads 0.3 V): ≈4.5 µA. R34 alone at 100k would have put the
  charging level at 1.65 V (invalid). Check the +3.3V rail voltage in that state at bring-up.

## GPIO4-7 pull-downs (option, not done)

- **Where it comes from**: the VS1053 datasheet (pin table and section "Unused pins"): "Unused GPIO pins should
  have a pull-down resistor", and GPIO0 needs 100k to stop the SPI boot. The 2026-10-18 fix put one 100k on
  each GPIO0-GPIO7 (R16, R17, R41-R46).
- **Why remove R43-R46** (GPIO4-GPIO7): those pins are not unused, they are the I2S outputs (`I2S_LRCK`,
  `I2S_MCLK`, `I2S_SCLK`, `I2S_SDATA`). Once I2S is enabled the VS1053 drives them, so the pull-downs only add a
  small load (33 µA each at 3.3 V) and four placements. The Adafruit board only pulls down GPIO0/GPIO1.
- **Why keep them**: before the firmware enables I2S, and whenever the VS1053 is off (`VS_EN` low), those lines
  float. They go to the BT module's PCM inputs (and later the CS43131): defined low levels avoid floating CMOS
  inputs and noise there. They also cost almost nothing (0603 Basic parts).
- Decision for now: keep them. Remove them on the final board if the BT/DAC inputs have their own pull-downs.
