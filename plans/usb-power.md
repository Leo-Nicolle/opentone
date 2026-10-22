# USB and power management

Let's plan out the USB routing and the battery management for the board.

## TODO

- [x] Read the test-board.md to get the specs
- [x] Read the current hardware/opentone/opentone.kicad_sch to see the current status of the wiring (not complete)
- [x] Browse online for other opensource projects with similar specs: usb-C with file transferts, stm32 firware flashing and battery management schematics, download them into hardware/examples/
- [x] Propose a list of components for each purpose:
- [x] Polyfuse and circuit protection
- [x] Usb bus management (required ?)
- [x] Battery management
- [x] Voltage regulation
- [x] Check the LCSC/JLC part numbers
- [x] Update `hardware/opentone/power.kicad_sch`
- [ ] Cosmetic pass on the power sheet in the KiCad GUI (it is wired with labels, some of them overlap)
- [ ] Order the TPS63802 and the MAX17048 (TDFN) outside JLC
- [x] L3 replaced by the hand-solderable Murata DFE252012P-R47M (1008, end terminals)
- [ ] PCB: tie the MCP73831 exposed pad to GND (the KiCad symbol has no EP pin)

## Before: `power.kicad_sch` at the start

From the exported netlist:

| Part | Wiring | Problem |
|---|---|---|
| USB1 USB-C, R19/R20 5.1k on CC1/CC2 | OK | no ESD protection, SHIELD unconnected |
| F2 polyfuse on VBUS | OK | no rating |
| UART_BRIDGE1 CP2102N on D+/D- | USB data → UART | no mass storage, no USB DFU |
| R5/R6/R7 47k | VBUS sense divider for the CP2102N | |
| bat-man1 MCP73831-2, R21 2k (500 mA), D4 + R22 STAT LED | OK | STAT does not reach the MCU (PB0) |
| D5/D6 Schottky OR (VBUS / VBAT) → buck Vin | | no real power path, ~0.3 V lost on battery |
| Buck-converter2 LM3671 (3.3 V) | **EN is tied to Vout/FB**: it never starts | drops out below ~3.5 V of battery |
| AP7312 dual LDO, fed from +3.3V | +1V8 and "3.3-audio" | a 3.3 V output from a 3.3 V input: no headroom |
| R4/R1 200k divider → LIPO_CHARGE | | 10 µA of constant drain, the gauge already measures it |
| BT2 cell, C48 polarized "???" | | no connector footprint, no value |
| MAX17048 | missing | |

## Architecture

```
USB-C VBUS ─ F2 ─┬─ MCP73831 VDD ─── VBAT ─ JP1 ─ Q2 (reverse guard) ─ J3 JST-PH LiPo
  (USBLC6 clamp) │                    │
                 └─ D7 Schottky ─┐    ├─ U12 MAX17048 (VDD, CELL)
                                 │    │
             Q1 P-MOSFET (G=VBUS)┴────┘
                                 │
                               VSYS ─┬─ U11 TPS63802 → 3V3_REG ─ JP2 ─ +3.3V ─┬─ MCU, screens, BT, SD, PSRAM, MPR121…
                                     │                                         └─ JP502 ─ DRV_VDD ─ DRV2605L (buttons sheet)
                                     └─ JP6 ─ VS_VIN ─┬─ U14 TPS7A2018 → +1V8 (VS1053 only)
                                                       └─ U13 TPS7A2033 → AVDD_LDO ─ JP4 ─ +3.3VA (VS1053 only)
                          3V3_EN (R39 to VSYS) ─ TPS63802 EN, pulled low by the slider in OFF
                          VS_EN (PA6, R8 100k pull-down) ─ U13/U14 EN

USB-C D+/D- ─ U10 USBLC6-2SC6 ─ R30/R31 0 Ω ─ USB_DP / USB_DM (PA12 / PA11)
VBUS ─ R5 47k / R7 100k divider ─ VBUS_SENSE (PA9)
```

Load sharing (as on the Adafruit Feathers): with USB plugged, Q1 is off, the system runs from VBUS through D7 and
the charger only sees the battery, so it terminates properly. Without USB, the gate is pulled to GND by R36 and the
battery feeds VSYS through Q1 (a few mV lost, not 0.3 V).

Cross-sheet nets (global labels): `VBUS`, `VSYS`, `VBAT`, `USB_DP`, `USB_DM`, `VBUS_SENSE`, `CHG_STAT`, `FG_ALRT`,
`I2C1_SCL`, `I2C1_SDA`. Rails are power symbols: `+3.3V`, `+1V8`, `+3.3VA`, `GND`, `GNDA` (the audio sheet already
uses `+3.3VA` and `GNDA`). The I2C pull-ups are already on the click-wheel sheet (R8-R12).

## Components

LCSC numbers checked in the JLC database (2026-10-18), moved to 0603 on 2026-10-22: resistors and small caps are
0603 JLC Basic parts. The bulk caps on VBUS/VBAT/VSYS and the TPS63802 output (C46, C47, C61-C64) stay 0805 25 V:
in 0603 they lose most of their capacitance from DC bias at 4-5 V. Every part carries `Manufacturer`, `Part number`,
`LCSC` and `Datasheet` fields in the schematic. Basic parts have free assembly at JLC.

### Polyfuse and circuit protection

| Ref | Part | LCSC | Notes |
|---|---|---|---|
| F2 | ASMD1206-075 (750 mA hold, 1.5 A trip, 6 V) | C135339 | 500 mA charge + ~200 mA system |
| U10 | USBLC6-2SC6 (SOT-23-6), ST | C7519 | ESD on D+/D-, pin 5 on VBUS_IN |
| D8 | SMF5.0A TVS (SOD-123FL), Littelfuse | C151296 | VBUS transient clamp after F2 (2026-10-22): 5 V standoff, 9.2 V clamp. A sustained overvoltage makes it conduct until F2 trips. Place it next to USB1 |
| R32 / C60 | 1 MΩ ∥ 4.7 nF, shield to GND | C22935 / C53987 (basic) | |
| J3 | JST-PH 2-pin S2B-PH-SM4-TB | C295747 | buy cells with their own protection PCM. Check the cell polarity before plugging: it is not standard |
| Q2 + R6 | AO3401A + 100 kΩ gate pull-down | C15127 / C25803 (basic) | reverse-polarity guard (2026-10-22): drain on J3+, source on JP1/VBAT, gate to GND. On (~60 mΩ) both ways with a correct pack, off with a reversed one. The gauge reads through it: ≈5-20 mV low on discharge, ≈30 mV high while charging, nothing at rest |

### USB bus management: not required

- No hub and no PD controller: the two 5.1 kΩ Rd (R19/R20, C23186 basic) give 5 V at the default USB current,
  enough for 500 mA charging.
- The CP2102N is gone: D+/D- go to PA12/PA11 through R30/R31 (0 Ω, C21189 basic, swap to 22 Ω if signal
  integrity needs it). The F446 OTG_FS has its PHY and D+ pull-up on chip.
- R5 47k / R7 100k (C25819 / C25803 basic, R6 removed on 2026-10-22) drive VBUS_SENSE on PA9 (OTG_FS_VBUS, FT
  pin): ~3.4 V with USB plugged (3.57 V at 5.25 V). The
  firmware sees the cable plug/unplug and can stop playback before exposing the SD card as mass storage.
- Flashing: the ST system bootloader does DFU over OTG_FS (`datasheets/an2606-...pdf`, it needs the HSE crystal).
  BOOT0 button + 10k pull-down and a reset button, already in the "MCU on the board" section of test-board.md.
  The firmware can also jump to the bootloader itself, so no button is needed in normal use.
- Logs stay on UART4 (PA0/PA1) through the ST-LINK VCP or a USB-UART dongle.

### Battery management

| Ref | Part | LCSC | Notes |
|---|---|---|---|
| bat-man1 | MCP73831-2ACI/MC (DFN-8) | C150772 | `datasheets/power/MCP73831.pdf`. Symbol `opentone:MCP73831-2-MC_EP` (EP pin 9 on GND, 2026-10-22): ~1 W at the start of a charge, needs GND copper and vias. The SOT-23-5 version (C14879) has more stock if we change the footprint |
| R21 / R33 + JP3 | 2 kΩ / 10 kΩ + 3-pad jumper | C22975 / C25804 (basic) | I = 1000 V / R_PROG: JP3 1-2 = 500 mA (default, 0.55 C on the 900 mAh cell), 2-3 = 100 mA |
| D7 | B5819W (SOD-123) | C8598 (basic) | VBUS → VSYS |
| Q1 | AO3401A (SOT-23) | C15127 (basic) | drain on VBAT, source on VSYS, gate on VBUS. 85 mΩ at Vgs = -2.5 V |
| R36 | 100 kΩ | C25803 (basic) | Q1 gate pull-down |
| D4 + R22 | STAT LED (red KT-0603R), 470 Ω | C2286 / C23179 (basic) | |
| R34 + R35 | 100 kΩ series + 1 MΩ pull-up to 3V3 (were 10k/100k) | C25803 / C22935 (basic) | STAT → CHG_STAT (PB0). STAT drives up to VDD (5 V): PB0 is FT (`datasheets/mcu/stm32f446re.pdf`), R34 limits the current if the MCU is not powered. R35 reads the Hi-Z state (no battery / shutdown). 100k/1M since 2026-10-22: same 10:1 ratio (charging reads 0.3 V), back-feed into a dead +3.3V ≈4.5 µA instead of 45 µA |
| U12 | MAX17048G+T10 (TDFN-8 2x2) | not at JLC (only the WLP C7497002) | **self-sourced**. VDD and CELL on VBAT (after JP1, so its drain is measured too), CTG/QSTRT/EP to GND, I2C1 at 0x36, ALRT → FG_ALRT (PE6). ~23 µA active, 4 µA hibernate. SCL/SDA have internal pull-downs (disconnect detection) |
| C67 | 0.1 µF | C14663 (basic) | datasheet value on VDD |
| R40 | 10 kΩ ALRT pull-up | C25804 (basic) | |
| C61 / C47 (+ C46 on VBUS) | 10 µF / 4.7 µF on VBAT, 0805 25 V | C15850 / C1779 (basic) | C61 replaces the polarized C48 |

Removed: the R4/R1 divider (the gauge measures VBAT).

The MCP73831 has no thermistor input. If it becomes a problem, the alternative is the MCP73871 (power path,
thermistor, used by Tangara): it replaces both the charger and the load-sharing parts.

### Voltage regulation

| Ref | Part | LCSC | Notes |
|---|---|---|---|
| U11 | TPS63802DLAR buck-boost (replaces the LM3671) | not at JLC | **self-sourced**. 1.3-5.5 V in, 2 A, 11 µA Iq. `datasheets/power/tps63802.pdf`. Footprint `opentone:Texas_DLA0010A_VSON-HR-10_2x3mm_P0.5mm` (from the datasheet land pattern) |
| L3 | 0.47 µH Murata DFE252012P-R47M=P2 (2.5x2.0x1.2 mm) | C237552 | Isat 5.7 A, 4.0 A thermal, 27 mΩ. Replaced the XFL4015 (TI's first pick, terminals only under the body, not hand-solderable). End terminals like a 1008 chip; footprint `L_1008_2520Metric_Pad1.43x2.20mm_HandSolder`. TI also lists the DFE201612E (2.0x1.6) |
| R37 / R38 | 511 kΩ / 91 kΩ | C23194 / C23265 (UNI-ROYAL 0603WAF5113T5E extended / 0603WAF9102T5E preferred, 1 %) | 3.3 V (VFB = 500 mV, table 10-5). Same series as every other resistor |
| C62 / C63 / C64 | 10 µF in / 22 µF out / 22 µF out DNP | C15850 / C45783 (basic) | the datasheet says a single 22 µF is enough at 3.3 V |
| MODE | to GND | | power save mode |
| R39 + TP1 | 470 kΩ EN pull-up to VSYS + test pad 3V3_EN | C23178 (basic) | fixes the EN bug. 3V3_EN is a global label: the OFF / HOLD / ON slider (SW506, `buttons.kicad_sch`) pulls it low. 470k: ~9 µA in OFF. Since 2026-10-22 it only drives the TPS63802 EN (the VS1053 LDOs are on VS_EN) |
| JP2 | bridged solder jumper 3V3_REG → +3.3V | | cut it to measure the whole 3V3 drain |
| U13 / U14 | TPS7A2033PDBVR (3.3 V) / TPS7A2018PDBVR (1.8 V), TI, SOT-23-5, fed from VSYS | self-sourced | Replaced the AP7312 (Diodes NRND) on 2026-10-22: active TI family (2020), 300 mA, 7 µVrms, 95 dB PSRR at 1 kHz, 6.5 µA IQ, dropout 145 mV max at 300 mA (≈40 mV at our ~65 mA). U14 → +1V8 (VS1053 CVDD, 10-25 mA, later the CS43131), U13 → AVDD_LDO → JP4 → +3.3VA (AVDD + IOVDD, ≤65 mA). 1 µF in (C65, C68) and 1 µF out (C52, C69), COUT 1-200 µF. Both EN on `VS_EN` (PA6) with R8 100k pull-down (the chips also have a 500k internal one): the MCU switches the whole VS1053, and it's off whenever the MCU is (OFF slider included). The P suffix adds active output discharge (150 Ω), so the rails drop fast when VS_EN goes low. JP6 on their input measures the VS1053 drain. JLC only has unbranded "-TP" SOT-23 copies: buy genuine TI (or switch to the X2SON TPS7A2033PDQNR / TPS7A2018PDQNRM3, which JLC stocks) |
| JP4 + FB3 + C66 | 3-pad jumper, 600 Ω ferrite, 10 µF | C1002 / C19702 (basic) | +3.3VA (VS1053 AVDD and, since 2026-10-22, IOVDD) picks U13 (default, switched by VS_EN) or the +3.3V through FB3 (always on). Below ~3.35 V of battery U13 follows the battery: firmware cutoff ≥ 3.2 V (IOVDD must stay ≥ 3.0 V) |
| JP1 | bridged solder jumper on VBAT | | cut it to measure the battery drain. The per-block jumpers go on each block's sheet (test-board.md) |

## Reference designs

Downloaded into `hardware/examples/` (see its README):

- Adafruit Feather STM32F405 Express: closest match, STM32F4 USB-C DFU + SDIO SD + MCP73831 + load sharing
- SparkFun Thing Plus ESP32-S3 (KiCad): MCP73831 + MAX17048 + USB-C ESD
- Adafruit MAX17048 breakout
- Tangara mainboard: an open-source music player, MCP73871 + TLV75533

Datasheets: `datasheets/power/tps63802.pdf`, `datasheets/power/MCP73831.pdf`, `datasheets/power/MAX17048-MAX17049.pdf`,
`datasheets/power/DS_usblc6-2.pdf`, `datasheets/mcu/an2606-introduction-to-system-memory-boot-mode-on-stm32-mcus-stmicroelectronics.pdf`.

## Pinout

No change: USB on PA9/PA11/PA12, STAT on PB0, ALRT on PE6, I2C1 on PB6/PB7 are already in
`docs/public/pinout/LQFP100/mapping.json`. The global labels above are wired to the STM32F446VE on
`hardware/opentone/mcu.kicad_sch` (2026-10-18), with the BOOT0 button for DFU.

## Tests

- USB enumerates as DFU with BOOT0 held, and as mass storage from the firmware
- The charger terminates while the firmware runs (load sharing works)
- 3.3 V holds down to a 3.0 V battery
- The gauge reads a plausible SOC (log one full discharge, ModelGauge needs a few cycles)
