# Replacing the MPR121 with the Azoteq IQS7222A

The MPR121 is not recommended for new designs. The replacement is the Azoteq IQS7222A, order code **102**
(`IQS7222A102QFR`, QFN20 3 x 3 mm, 0.4 mm pitch). Datasheet: `datasheets/input/iqs7222a.pdf` (v1.7).

Why this one:

- 12 channels, up to 8 self-capacitance buttons: the wheel uses 5 (4 ring pads + center).
- Talks over I2C (up to 1 MHz) plus one RDY line, so it takes the MPR121's place on I2C1 and its pin.
- 1.8 V to 3.5 V supply, runs from +3.3V.
- Steps down to its low-power modes by itself when nothing touches it. Order code 102, typical at 3.3 V:
  426 µA (16 ms report rate), 110 µA (60 ms), 9.8 µA (150 ms). MPR121: 29 µA at 16 ms.

What it does not do:

- **No wheel mode.** The built-in slider is linear, 4 elements max. The wheel angle stays on the MCU
  (`getWheelAngle()` in `software/src/ClickWheel.hpp`), as it is with the MPR121.
- No driven shield: Azoteq recommends grounding the inactive Rx pins. Long interleaved pad borders cost
  sensitivity (matters for the clickwheel designer).
- Its settings are not stored in the chip: the firmware writes them over I2C after every reset.
- It talks only during the communication windows it opens: it pulls RDY low when it is ready to talk,
  and it can stretch the clock while it fetches data. The STM32 I2C handles clock stretching.

Rejected alternatives: the AT42QT2120 and CAP1206/CAP1208 (real touch controllers, but old and no
lifecycle info found), the CY8CMBR3xxx (family partly discontinued), the MC11 and ZSSC3230 (capacitance
converters for level/pressure sensors, 1-2 channels per chip, no touch logic).

## Dev board: both chips

Keep **both** on the dev board, as long as the space allows it:

- The MPR121 has working firmware today. The IQS7222A needs a new driver (communication windows, settings
  written at boot), and the wheel must keep working while that driver is written.
- The dev board is there to compare: sensitivity on the same wheel flex, smoothness of the angle, and power
  (each chip gets its own drain jumper).
- The cost is small: one QFN20, 5 resistors, 6 capacitors, a pull-up, and one MCU pin.

The two chips must not see the same pads at the same time. Each chip's pins load the pads, and the
MPR121 drives the unused electrodes, which would disturb the other chip's readings. Each wheel line goes through a
3-pad solder jumper (`Jumper:SolderJumper_3_Bridged12`): middle pad to the wheel connector, one side
to the MPR121, the other side to the IQS7222A. Ship it bridged to the MPR121. Five jumpers: top, right,
bottom, left, center.

(Other option: split the two wheel connectors, J501 FPC to one chip and J502 header to the other. No
jumpers, but the two chips would not be tested with the same connector and flex.)

Final board: IQS7222A only, the MPR121 and the jumpers go away, the IQS7222A takes the MPR121's IRQ pin (PE4).

## Steps

### 1. Symbol and footprint

- [ ] Create `opentone:IQS7222A` from the QFN20 pinout (datasheet section 2) with the exposed pad to GND.
- [ ] Footprint QFN-20 3 x 3 mm, 0.4 mm pitch, exposed pad (check the land pattern in the datasheet, the
  0.4 mm pitch is finer than the MPR121's QFN).
- [ ] Find the LCSC part number for `IQS7222A102QFR` and set `Part number`, `Manufacturer`, `LCSC` like the
  other parts. Not in the local JLCPCB database: check LCSC stock before ordering.
- [ ] Don't use the WLCSP18 version: no CRX4 pin, sensitive to infrared light, hard to rework.

### 2. Schematic (`hardware/opentone/buttons.kicad_sch`)

Following the 8-button self-capacitance reference schematic (datasheet figure 2.1) and section 12:

- [ ] VDD: 4.7 µF + 100 pF to GND, within a few mm of the pins. Powered through its own solder jumper
  `JP50x "IQS drain"` (net `IQS_VDD`), like JP501 for the MPR121.
- [ ] VREGA and VREGD: 2.2 µF each to GND, right next to the IC. The reference schematic also puts 100 pF on each.
- [ ] CRX0-CRX4: 470 Ω in series on each, close to the IC. Mapping: CRX0 top, CRX1 right,
  CRX2 bottom, CRX3 left, CRX4 center (any order works, the firmware maps them).
- [ ] Unused CRX5-CRX7, TX8, OUTA0: leave unconnected (no-connect flags), check the pin table.
- [ ] RDY: open drain with no internal pull-up, so add 4.7 kΩ to `IQS_VDD`, then label `IQS_RDY` to the MCU.
- [ ] MCLR: it has an internal pull-up, so leave it on a test point for a hardware reset (or wire it to the MCU later).
- [ ] SDA / SCL to `I2C1_SDA` / `I2C1_SCL`. The bus already has its pull-ups.
- [ ] Add the 5 three-pad solder jumpers between `WHEEL_*` and the two chips (dev board only).

### 3. Pin and address

- [ ] I2C address: order code 102 is **0x57**. No clash on I2C1: MAX17048 0x36, MPR121 0x5B, DRV2605L
  0x5A, CS43131 (check its address, it is behind the PCA9306).
- [ ] Dev board: `IQS_RDY` on **PA2 (EXTI2)**. Free pin, and EXTI2 is unused (EXTI lines in use: 0, 1, 3-6,
  8-15). PB4, PA15 and PC10 would share EXTI4/15/10 with PE4, PE15 and PA10.
- [ ] Final board: `IQS_RDY` on PE4 (EXTI4), PA2 goes back to the free pins.
- [ ] Update `docs/public/pinout/LQFP100/mapping.json` (new `IQS7222A` block on I2C1, PA2 RDY) and
  `datasheets/mcu/lqfp100-pins.md`.
- [ ] Add `IQS7222A102QFR` to `datasheets/overrides.json` `parts` (category `input`, file
  `datasheets/input/iqs7222a.pdf`) once it is in the schematic, and remove the `reference` entry.

### 4. PCB

- [ ] Place the IQS7222A close to the wheel connector, short CRX traces after the 470 Ω resistors.
- [ ] Keep the CRX traces away from the screen data bus (PC0-PC7, PD8-PD15) and the SDIO/QUADSPI clocks.
- [ ] Ground hatched under the pads per the clickwheel designer, no solid pour right under the
  electrodes. Inactive pads grounded by the chip (no shield).

### 5. Firmware

- [ ] Split the sensor out of `ClickWheel`: it uses only `filteredData(i)` and `touched()` from
  `Adafruit_MPR121` (plus `begin()`). Make a small interface with both, and an MPR121 implementation that
  wraps the Adafruit driver.
- [ ] IQS7222A driver on `Wire3` / I2C1:
  - Wait for RDY low, check the product number, write the settings (exported from Azoteq's
    configuration tool as a header), then ack the reset.
  - On each RDY falling edge: read the counts / deltas for CRX0-CRX4 and the touch flags, then let the
    window close.
  - Low-power mode timeouts: start with the defaults, tune them against the wheel's responsiveness.
- [ ] Pick the driver at boot: probe 0x57, fall back to 0x5B (dev board with either chip selected).
- [ ] Re-check the `getWheelAngle()` gains and thresholds: the counts and noise floor differ from the MPR121's.

### 6. Tests on the dev board

- [ ] Same wheel flex, same jumpers: compare sensitivity (delta at touch / noise), angle smoothness, and
  false touches while the screen draws and the SD card writes.
- [ ] Drain through each chip's jumper: idle, wheel touched, and in each IQS7222A power mode.
- [ ] Wake-up: RDY wakes the MCU from stop mode on touch.
- [ ] Decide the final report rate / low-power timeout, then drop the MPR121 for the final board.
