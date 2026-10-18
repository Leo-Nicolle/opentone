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
- [ ] Check the L3 land pattern against the Coilcraft XFL4015 doc
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
USB-C VBUS ─ F2 ─┬─ MCP73831 VDD ─── VBAT ─ JP1 ─ J3 JST-PH LiPo
  (USBLC6 clamp) │                    │
                 └─ D7 Schottky ─┐    ├─ U12 MAX17048 (VDD, CELL)
                                 │    │
             Q1 P-MOSFET (G=VBUS)┴────┘
                                 │
                               VSYS ─┬─ U11 TPS63802 → 3V3_REG ─ JP2 ─ +3.3V
                                     └─ AP7312 → +1V8, AVDD_LDO ─ JP4 ─ +3.3VA

USB-C D+/D- ─ U10 USBLC6-2SC6 ─ R30/R31 0 Ω ─ USB_DP / USB_DM (PA12 / PA11)
VBUS ─ R5∥R6 / R7 divider ─ VBUS_SENSE (PA9)
```

Load sharing (as on the Adafruit Feathers): with USB plugged, Q1 is off, the system runs from VBUS through D7 and
the charger only sees the battery, so it terminates properly. Without USB, the gate is pulled to GND by R36 and the
battery feeds VSYS through Q1 (a few mV lost, not 0.3 V).

Cross-sheet nets (global labels): `VBUS`, `VSYS`, `VBAT`, `USB_DP`, `USB_DM`, `VBUS_SENSE`, `CHG_STAT`, `FG_ALRT`,
`I2C1_SCL`, `I2C1_SDA`. Rails are power symbols: `+3.3V`, `+1V8`, `+3.3VA`, `GND`, `GNDA` (the audio sheet already
uses `+3.3VA` and `GNDA`). The I2C pull-ups are already on the click-wheel sheet (R8-R12).

## Components

LCSC numbers checked in the JLC database (2026-10-18). Basic parts have free assembly at JLC.

### Polyfuse and circuit protection

| Ref | Part | LCSC | Notes |
|---|---|---|---|
| F2 | ASMD1206-075 (750 mA hold, 1.5 A trip, 6 V) | C135339 | 500 mA charge + ~200 mA system |
| U10 | USBLC6-2SC6 (SOT-23-6) | C21713975 | ESD on D+/D-, pin 5 on VBUS_IN |
| R32 / C60 | 1 MΩ ∥ 4.7 nF, shield to GND | C17514 / C1744 (basic) | |
| J3 | JST-PH 2-pin S2B-PH-SM4-TB | C295747 | buy cells with their own protection PCM. Check the cell polarity before plugging: it is not standard |

### USB bus management: not required

- No hub and no PD controller: the two 5.1 kΩ Rd (R19/R20, C27834 basic) give 5 V at the default USB current,
  enough for 500 mA charging.
- The CP2102N is gone: D+/D- go to PA12/PA11 through R30/R31 (0 Ω, C17477 basic, swap to 22 Ω if signal
  integrity needs it). The F446 OTG_FS has its PHY and D+ pull-up on chip.
- R5/R6/R7 (47k, C17713 basic) now drive VBUS_SENSE on PA9 (OTG_FS_VBUS, FT pin): ~3.3 V with USB plugged. The
  firmware sees the cable plug/unplug and can stop playback before exposing the SD card as mass storage.
- Flashing: the ST system bootloader does DFU over OTG_FS (`datasheets/an2606-...pdf`, it needs the HSE crystal).
  BOOT0 button + 10k pull-down and a reset button, already in the "MCU on the board" section of test-board.md.
  The firmware can also jump to the bootloader itself, so no button is needed in normal use.
- Logs stay on UART4 (PA0/PA1) through the ST-LINK VCP or a USB-UART dongle.

### Battery management

| Ref | Part | LCSC | Notes |
|---|---|---|---|
| bat-man1 | MCP73831-2ACI/MC (DFN-8) | C150772 | `datasheets/MCP73831.pdf`. The SOT-23-5 version (C14879) has more stock if we change the footprint |
| R21 / R33 + JP3 | 2 kΩ / 10 kΩ + 3-pad jumper | C17604 / C17414 (basic) | I = 1000 V / R_PROG: JP3 1-2 = 500 mA (default, 0.55 C on the 900 mAh cell), 2-3 = 100 mA |
| D7 | B5819W (SOD-123) | C8598 (basic) | VBUS → VSYS |
| Q1 | AO3401A (SOT-23) | C15127 (basic) | drain on VBAT, source on VSYS, gate on VBUS. 85 mΩ at Vgs = -2.5 V |
| R36 | 100 kΩ | C149504 (basic) | Q1 gate pull-down |
| D4 + R22 | STAT LED, 470 Ω | | unchanged |
| R34 + R35 | 10 kΩ series + 100 kΩ pull-up to 3V3 | C17414 / C149504 (basic) | STAT → CHG_STAT (PB0). STAT drives up to VDD (5 V): PB0 is FT (`datasheets/stm32f446re.pdf`), R34 limits the current if the MCU is not powered. R35 reads the Hi-Z state (no battery / shutdown) |
| U12 | MAX17048G+T10 (TDFN-8 2x2) | not at JLC (only the WLP C7497002) | **self-sourced**. VDD and CELL on VBAT (after JP1, so its drain is measured too), CTG/QSTRT/EP to GND, I2C1 at 0x36, ALRT → FG_ALRT (PE6). ~23 µA active, 4 µA hibernate. SCL/SDA have internal pull-downs (disconnect detection) |
| C67 | 0.1 µF | C49678 (basic) | datasheet value on VDD |
| R40 | 10 kΩ ALRT pull-up | C17414 (basic) | |
| C61 / C47 | 10 µF / 4.7 µF on VBAT | C15850 (basic) | C61 replaces the polarized C48 |

Removed: the R4/R1 divider (the gauge measures VBAT).

The MCP73831 has no thermistor input. If it becomes a problem, the alternative is the MCP73871 (power path,
thermistor, used by Tangara): it replaces both the charger and the load-sharing parts.

### Voltage regulation

| Ref | Part | LCSC | Notes |
|---|---|---|---|
| U11 | TPS63802DLAR buck-boost (replaces the LM3671) | not at JLC | **self-sourced**. 1.3-5.5 V in, 2 A, 11 µA Iq. `datasheets/tps63802.pdf`. Footprint `opentone:Texas_DLA0010A_VSON-HR-10_2x3mm_P0.5mm` (from the datasheet land pattern) |
| L3 | 0.47 µH Coilcraft XFL4015-471ME | C18221164 | footprint borrowed from the XAL4020 (same 4x4 body): check it |
| R37 / R38 | 511 kΩ / 91 kΩ | C101775 / C104555 | 3.3 V (VFB = 500 mV, table 10-5). Low stock in 0805, plenty in 0402 (C64042 / C100696) |
| C62 / C63 / C64 | 10 µF in / 22 µF out / 22 µF out DNP | C15850 / C45783 (basic) | the datasheet says a single 22 µF is enough at 3.3 V |
| MODE | to GND | | power save mode |
| R39 + TP1 | 100 kΩ EN pull-up to VSYS + test pad 3V3_EN | C149504 (basic) | fixes the EN bug, room for a future soft-power latch |
| JP2 | bridged solder jumper 3V3_REG → +3.3V | | cut it to measure the whole 3V3 drain |
| AP7312 | AP7312-1833W6-7, **input moved from +3.3V to VSYS** | C195066 | OUT1 1.8 V (VS1053 CVDD, later the CS43131), OUT2 3.3 V analog. C65 1 µF (C28323, basic) on its input |
| JP4 + FB3 + C66 | 3-pad jumper, 600 Ω ferrite, 10 µF | | +3.3VA (VS1053 AVDD) picks AP7312 OUT2 (default) or the +3.3V through FB3. Below ~3.5 V of battery OUT2 follows the battery, so we compare both |
| JP1 | bridged solder jumper on VBAT | | cut it to measure the battery drain. The per-block jumpers go on each block's sheet (test-board.md) |

## Reference designs

Downloaded into `hardware/examples/` (see its README):

- Adafruit Feather STM32F405 Express: closest match, STM32F4 USB-C DFU + SDIO SD + MCP73831 + load sharing
- SparkFun Thing Plus ESP32-S3 (KiCad): MCP73831 + MAX17048 + USB-C ESD
- Adafruit MAX17048 breakout
- Tangara mainboard: an open-source music player, MCP73871 + TLV75533

Datasheets: `datasheets/tps63802.pdf`, `datasheets/MCP73831.pdf`, `datasheets/MAX17048-MAX17049.pdf`,
`datasheets/DS_usblc6-2.pdf`, `datasheets/an2606-introduction-to-system-memory-boot-mode-on-stm32-mcus-stmicroelectronics.pdf`.

## Pinout

No change: USB on PA9/PA11/PA12, STAT on PB0, ALRT on PE6, I2C1 on PB6/PB7 are already in
`docs/public/pinout/LQFP100/mapping.json`. The MCU sheet still has the old STM32F446RC (LQFP64): the global labels
above are waiting for the F446VE.

## Tests

- USB enumerates as DFU with BOOT0 held, and as mass storage from the firmware
- The charger terminates while the firmware runs (load sharing works)
- 3.3 V holds down to a 3.0 V battery
- The gauge reads a plausible SOC (log one full discharge, ModelGauge needs a few cycles)
