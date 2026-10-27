
# Rup feedback

My friend who has experience in creating boards had a quick look at my schema, here is what he said:

- Fuse F2 750mA: higher value would protect the computer, lower would protect the board, for the production schema, it could be removed.
- Diode D7: It eats 0.5V, not a problem it seems since VSYS is boosted back up next?
- Diode D8: It protects the circuit when tension is >5V? Can we remove it?
- R34 and R35 are verry high? Was it to consume less power? The measurement will be verry sensitive to parasites, his board has 470l and 200k.
- Why not connect the LDO after the Buck/Boost ?
- Why not cascading the two LDOs? (1.8V after the 3.3V), since the more they lower voltage, the more they consume, so we would consume less?
- The ON/OFF switch should be on the VBAT, not on the 3.3V
- Are SDA and SCL pulled up? Since we have level shifters on thoose, do we need to pull up after the shifters?
- Clickwheel Buttons: add an hardware debounce with a C +R? (1kOhm and 100nF)
- Double check the BT auto power on: why thoose values etc
- Check if each module has a SLEEP or EN pin, which would shut them down (then no need for switches and MOSFET etc)
- Add header pins at the begining and end of some parts of the circuit (eg the screens LED control circuit), to be able to cut it out and replace it later easily if I make a mistake
- Why a ferrite bead on the screens LED backlight circuit? Can we remove it?
- Make the power LED driven by the MCU? Anyway make sure that when the circuit is shut for low battery, nothing is powered otherwise the battery will continue being drained till the last drop (LED, modules etc), not good
- DAC and other modules: use the INT or EN pins to shut them down rather than physical switches
- Have a look at Analog buffers, and whether they could be usefull to us
- Have a look at the NTS0104 level shifter, see how it compares to ours
- After the level shifter 1.8 i2C, should we pull up?
- ESD protection on the audio lines, is it worth it? Would it ruin the signal? Stupid no?

# Answers

Checked against a fresh netlist export and the datasheets in `datasheets/` (2026-10-26).

## Fuse F2 750mA: higher value would protect the computer, lower would protect the board, for the production schema, it could be removed

**Partly agree.** F2 is a resettable PTC fuse (ASMD1206-075) between the USB-C VBUS pin and the board's VBUS net: 0.75 A hold, about 1.5 A trip. The computer's USB port already has its own current limit, so F2 mainly protects **our** board and the cable. It trips on a short on our side, such as a solder bridge on a prototype or the TVS diode D8 failing shorted after a surge. Its value isn't a trade-off between protecting the board and protecting the computer.

The real problem is the **current budget**. The charger alone is set to 500 mA (JP3 → 2k on PROG). Through D7, USB also powers the whole system: buck-boost, backlights (~58 mA each), BT, DAC, VS1053. Charging while playing can therefore reach about 0.7 A, which is right at the hold current. PTC fuses also derate when warm, to roughly 0.6 A at 50 °C inside an enclosed case, so it could trip when it shouldn't. That draw also exceeds the default 500 mA a USB-C source allows (CC1/CC2 only have 5.1k Rd to GND, and the MCU never reads them).

**Next steps:** keep F2. It costs cents and pairs with D8. Either move to a ~1.1 A hold part, or lower the charge current to ~300 mA. Optionally route CC1/CC2 to MCU ADC pins so firmware can tell a 500 mA source from a 1.5 A or 3 A one. Removing F2 in production saves nothing worth having.

**Done (2026-10-26):** F2 = Littelfuse 1206L110THYR (C126818): 1.1 A hold / 2.2 A trip, 8 V, same 1206 footprint. It derates to 0.83 A at 50 °C, still above the ~0.7 A charge + play worst case.

## Diode D7: It eats 0.5V, not a problem it seems since VSYS is boosted back up next?

**Confirmed, it's not a problem.** D7 (B5819W Schottky) drops about 0.3–0.45 V, not 0.5 V, so VSYS sits around 4.6 V on USB. The TPS63802 buck-boost then runs in buck mode and outputs 3.3 V.

D7 can't be removed. It is half of the load-sharing circuit with Q1 (AO3401A, gate on VBUS): USB feeds VSYS through D7, and the battery feeds VSYS through Q1. Without D7, the battery would feed VBUS through Q1's body diode. That would back-feed the USB connector, keep Q1 switched off, and make VBUS_SENSE always read "USB present".

**Alternative:** only worth it if the drop starts to matter, for example for heat when charging: an ideal-diode or power-mux IC such as LM66100 or TPS2116.

## Diode D8: It protects the circuit when tension is >5V? Can we remove it?

**Not quite.** D8 (SMF5.0A TVS diode) doesn't conduct at 5 V. It starts at 6.4 V minimum and clamps at about 9.2 V at 21.7 A. Its job is fast transients: ESD on the connector, and the voltage spike when a USB cable is plugged in, which can approach twice VBUS because of the cable's inductance and the board's ceramic input capacitors. The charger chip is rated 7 V absolute max and the buck-boost about 6 V, so that spike is exactly what kills them.

It only leaks current while USB is plugged in (400 µA max at 5 V, typically much less), so it never drains the battery. It works together with F2: during a sustained overvoltage D8 conducts and F2 trips.

**Verdict:** you could leave it unpopulated (DNP) with no functional change, but keep it. It's a few cents and prevents hard-to-explain dead boards.

## R34 and R35 are very high? Was it to consume less power? The measurement will be very sensitive to parasites, his board has 470k and 200k

**These aren't a measurement divider.** Your friend's 470k/200k is a battery voltage divider for an ADC. Here the battery is measured by the MAX17048 fuel gauge (U12), with no divider.

R34 (100k) and R35 (1M) belong to the charge-status line:

- the charger's STAT pin goes through R34 to CHG_STAT (PB0, pin 35, a digital EXTI input);
- R35 pulls that node up to +3.3V.

**But the remark points at a real problem.** STAT is push-pull to VBUS, so it outputs 5 V when charging is done. Today that puts the PB0 node at about 4.85 V with the MCU on. With the device off and charging finished, the 3.3 V rail is at 0 V and the node sits at about 4.55 V. STM32 5 V-tolerant pins are only allowed up to VDD + 4 V, and positive current injection into them isn't allowed (datasheet abs-max table), so this exceeds the rating. The 1M pull-up is also a weak, noise-prone node, which is what your friend noticed.

**Proposal:** use the same pattern as VBUS_SENSE (R5 47k / R7 100k): STAT → 47k → PB0 → 100k → GND. That gives about 3.4 V high and 0 V low. The catch is that "high-Z" (fault or no battery) then reads the same as "charging". Detect that case in firmware instead: VBUS present, "charging", but VCELL from the MAX17048 isn't rising.

**Done (2026-10-26):** R34 = 47k (0603WAF4702T5E), R35 = 100k (0603WAF1003T5E) from CHG_STAT to GND. CHG_STAT (PB0) reads high = charge done, low = charging, or no USB / fault (STAT Hi-Z). Firmware must AND it with VBUS_SENSE.

## Why not connect the LDO after the Buck/Boost ?

Two LDOs (low-dropout linear regulators) sit on VS_VIN, which comes from VSYS (battery or USB, 3.0–4.6 V):

- **U13**, 3.3 V, for the VS1053 analog supply;
- **U14**, 1.8 V, for the VS1053 core.

- **U13 (3.3 V) can't go after the 3.3 V buck-boost:** an LDO needs its input above its output. From VSYS it stays in regulation down to VBAT ≈ 3.35 V, then tracks the battery, which degrades gently.
- **U14 (1.8 V) could.** The efficiency is about the same either way. Measured at the battery, 1.8 V at ~11–15 mA costs ~VSYS × I fed from VSYS, versus ~3.3 V × I / 0.9 fed from the buck-boost, which is nearly identical. The benefit of moving it would be that the LDO's ripple rejection cleans up the buck-boost's switching noise. The cost is that VS1053 core noise ends up on the digital 3.3 V rail.
- The DAC already uses this arrangement: U702 (1.8 V) takes its input from +3.3V through JP701.

**Next step (optional):** turn JP6 into a 3-pad jumper that selects VSYS or +3.3V for VS_VIN, then compare noise on the bench.

## Why not cascading the two LDOs? (1.8V after the 3.3V), since the more they lower voltage, the more they consume, so we would consume less?

**Not correct: cascading saves nothing.** An LDO passes its load current straight through from input to output, so battery current equals load current whatever the chain looks like. Cascading only moves the heat from the 1.8 V LDO into the 3.3 V one. Total loss stays (VSYS − 1.8 V) × I.

The only real gain would come from a switching regulator for 1.8 V, such as a TPS62840 buck (60 nA quiescent current). That saves about 25 mW at ~15 mA. One backlight alone uses ~200 mW, so the saving is under 10 %, and you'd add switching noise next to the audio. Not worth it now.

## The ON/OFF switch should be on the VBAT, not on the 3.3V

**It's already effectively on the battery side, and it doesn't carry the 3.3 V current.** SW506 is a 3-position switch (PCM13, rated 0.3 A). In the OFF position it pulls 3V3_EN to GND, which shuts down the TPS63802 buck-boost (shutdown current 45 nA). Everything on +3.3V then loses power.

Putting the switch in series with VBAT would be worse:

- 0.3 A is below the system's peak battery current;
- you'd lose charging while the device is off, which works today because VSYS still gets VBUS while EN is low.

**What actually stays on when OFF:**

| Part | Current |
| --- | --- |
| R39 (470k from VSYS to 3V3_EN, shorted to GND by the switch) | **~8 µA, the biggest** |
| MAX17048 in hibernate | 3 µA |
| Charger reverse leakage | < 2 µA |
| D7 reverse leakage | a few µA |

The total is about 15–20 µA, so a 1000 mAh battery would last years. That's fine, and it ties in with item 19.

## Are SDA and SCL pulled up? Since we have level shifters on those, do we need to pull up after the shifters?

**Yes on both sides, and that's correct.**

- 3.3 V side: R402 and R403 (4.7k) on I2C1.
- 1.8 V side: R703 and R704 (4.7k to DAC_1V8) on DAC_SCL and DAC_SDA.

The PCA9306 is a pass-transistor shifter with no drive of its own, so it **needs** pull-ups on both sides. EN/VREF2 goes through a 200k resistor (R702), matching the datasheet. See also item 23.

## Clickwheel Buttons: add an hardware debounce with a C +R? (1kOhm and 100nF)

The five buttons (SW501–505) have 10k pull-ups and no capacitors. Firmware already debounces them with a 20 ms window (`software/src/ClickWheel.hpp:483`), and the bench tests cover it (`software/bench/e2e/buttons.spec.ts`). STM32 inputs also have Schmitt triggers. Hardware debounce isn't needed.

**Next step (cheap insurance):** add footprints left unpopulated (DNP): 1k in series into the MCU pin and 100 nF to GND. The series 1k also helps against ESD. Watch board space.

## Double check the BT auto power on: why those values etc

**The values come from the Feasycom reference schematic** (FSC-BT1035 datasheet §11: R6 2K, C17 1µF, R7 100K, 2SK3018 "or equivalent"), and our Q101/R111/C113/R112 copy it exactly.

How it works:

1. When BT_3V3 comes up, C113 kicks Q101's gate.
2. SYS_CTRL is held **low** for about τ·ln(3.3/Vth) ≈ 100k × 1 µF × ~0.9 ≈ 90 ms.
3. Then R111 (2k) pulls it **high for good**.

The module needs SYS_CTRL high for more than 20 ms from OFF, so it boots. The 2k only draws current (1.65 mA) during that pulse, because SYS_CTRL has no internal pull.

**Caveats:**

- SYS_CTRL stays high forever. Firmware can't put the module into OFF or DORMANT and wake it with a press; that's fine, since we cut its power with U102 and BT_EN.
- Check on the bench that the Feasycom firmware doesn't treat a held SYS_CTRL as a long press (pairing or power-off).

**Alternative:** drive SYS_CTRL from a spare MCU GPIO with a 100k pull-down, like on the Nucleo bench (PA15). That removes 3 parts and gives firmware control.

## Check if each module has a SLEEP or EN pin, which would shut them down (then no need for switches and MOSFET etc)

| Module | EN/sleep available? | Current design | Verdict |
| --- | --- | --- | --- |
| BT FSC-BT1035 | No EN; only SYS_CTRL/RESET; idle current not specified | U102 TPS22917 load switch on BT_EN | **Keep the switch** |
| SD card | No sleep pin; card idle current ~100s of µA | U602 load switch on SD_EN | **Keep** |
| VS1053 | XRESET + SCI_VOL=0xFFFF analog power-down; no EN | LDO EN = VS_EN (R8 pull-down) | Already "free": the LDO enable is the EN |
| CS43131 DAC | RESET pin (R705 pull-down) | LDO U702 EN = DAC_EN, plus shifters isolate the buses | Fine: no back-powering through I²S/I²C |
| DRV2605L haptic | **EN pin** | DRV_EN from MCU, R509 pull-down | Already done |
| MPR121 touch | No pin; stop mode through the ECR register (µA) | On +3.3V | Firmware |
| MAX17048 | Auto-hibernate, 3 µA | — | OK |
| ILI9341 screens | Sleep-in command; backlight off through the op-amp sink | — | Firmware |
| PSRAM APS6404 | Half-sleep command | — | Firmware |

The only "switches" are the 2 load switches, and they're justified.

## Add header pins at the beginning and end of some parts of the circuit (eg the screens LED control circuit), to be able to cut it out and replace it later easily if I make a mistake

**Mostly already done.** Every rail has a bridged solder jumper you can cut and use for current measurement: JP1, JP2, JP5, JP6, JP201/301, JP401, JP501/502, JP601/602, JP701. The backlight sink already has R216/R316 0R, and JP202/302 select the backlight supply.

2.54 mm headers don't fit an iPod-sized board. **Next step:** add 0R resistors or bridged jumpers on the *signal* entries of risky blocks, such as TFT_BL to R214 and the gate drive, plus test pads.

## Why a ferrite bead on the screens LED backlight circuit? Can we remove it?

**It can be removed (replace it with 0R).** TFT_BL's PWM is already filtered by R214/R215 and C206 (1 µF, ~160 Hz cut-off), so the op-amp drives a **DC** current through the LEDs. There are no PWM edges for FB201/FB301 to block.

A 600 Ω @ 100 MHz bead is also only ~0.3–0.5 Ω at audio and PWM frequencies, so it does nothing there. Together with C203 (10 µF) it can even form a small resonance.

**Next step:** keep the 0603 footprint and fit 0R. Its only real use would be as a cut point (see item 17).

**Done (2026-10-26):** FB201 and FB301 became R217 and R317, 0R 0603 (0603WAF0000T5E) with an R_Small symbol so the wiring is unchanged. FB3 (VS1053 AVDD filter) and FB401 (MCU VDDA) stay ferrite beads.

## Make the power LED driven by the MCU? Anyway make sure that when the circuit is shut for low battery, nothing is powered otherwise the battery will continue being drained till the last drop (LED, modules etc), not good

**LEDs are fine:**

- D4 (charge LED) is powered from **VBUS** through R22, so it never uses the battery.
- D401 (status) is already MCU-driven.
- D101 and D102 are on the BT load-switched rail.

**The real gap:** nothing can *automatically* shut the device down at low battery.

- 3V3_EN is controlled only by SW506.
- The MCU can't cut it.
- The TPS63802 keeps running down to 1.25 V input (its UVLO), so it drains the LiPo until the pack's protection circuit trips.

**Proposal:** use the TPS63802 EN pin's precise thresholds (1.1 V rising, 1.0 V falling, ±3 %) as a hardware low-battery cutoff:

- Replace R39 with a divider from VSYS, for example about 2.2M over 1M, which cuts at ~3.2 V and restarts at ~3.5 V. Tune it, and maybe add a 100 nF capacitor.
- SW506 still shorts EN to GND for OFF.
- The OFF current also drops, because R39 becomes ~2.2M instead of 470k.
- Firmware does a clean shutdown earlier (MAX17048 ALRT at ~3.4 V, then STOP mode). The divider is the hardware backstop.

**Done (2026-10-26), with different values than proposed:** the EN pin can leak up to 0.2 µA, which would shift a 2.2M/1M divider by up to ~14 %. Used R39 = 1M (VSYS to 3V3_EN) and new R48 = 470k (3V3_EN to GND), plus C70 = 100 nF on EN. Both resistor values were already in the BOM.

- Cutoff (EN falling, 0.97–1.03 V): VSYS ≈ 3.13 V (3.04–3.22 V).
- Restart (EN rising, 1.07–1.13 V): VSYS ≈ 3.44 V (3.35–3.54 V).
- Divider current when on: ~2.5 µA. Current when OFF (switch shorts EN): VSYS/1M ≈ 3.7 µA, down from ~8 µA.
- On USB, VSYS ≈ 4.6 V puts EN at 1.47 V, so the device runs while charging.
- C70 with the ~320k divider gives about 32 ms of turn-on delay, which filters switching noise on EN.

Firmware still needs a clean shutdown above the cutoff: watch the MAX17048 ALRT at ~3.4 V, then STOP mode.

## DAC and other modules: use the INT or EN pins to shut them down rather than physical switches

**Already the case for the DAC.** U702's EN is DAC_EN, the CS43131 is held in RESET by R705, and the PCA9306 EN follows DAC_EN, so the DAC drops off I2C1. INT (DAC_INT) is an interrupt **output**, not a shutdown input. The same applies to VS1053 (VS_EN on the LDOs) and DRV2605 (DRV_EN). See the table in item 16.

## Have a look at Analog buffers, and whether they could be useful to us

There are few uses here:

- **Headphone output:** the CS43131 has its own Class H headphone amp. The VS1053 drives 30 Ω headphones directly with GBUF.
- **Backlight:** already uses an op-amp (MCP6001) as a current sink.
- **ADC inputs:** nothing measures a high-impedance divider with the ADC. The battery goes through the MAX17048, VBUS_SENSE is digital (PA9), and CHG_STAT is digital.

If a high-impedance analog sense is added later, a 100 nF capacitor at the ADC pin plus a long sample time is cheaper than a buffer.

**Verdict:** not needed.

## Have a look at the NTS0104 level shifter, see how it compares to ours

NTS0104 (NXP) is a 4-bit level shifter that senses direction automatically, the same family as TI's TXS0104. It uses weak one-shot drivers, and its supply rule is VCC(A) ≤ VCC(B), with A at 1.65–3.6 V and B at 2.3–5.5 V.

| | SN74AVC4T245 (I²S) | PCA9306 (I²C) | NTS0104 |
| --- | --- | --- | --- |
| Direction | Fixed (DIR pins) | Bidirectional pass-FET | Auto-sense |
| Drive | Strong push-pull | None (needs pull-ups) | Weak one-shot accelerators |
| 12.288 MHz MCLK | Comfortable | — | Marginal; sensitive to load and pull-ups |
| Off isolation | Ioff + Hi-Z when either VCC is off | EN | OE + VCC isolation |

**Verdict:** keep ours. The AVC4T245 is the right choice for I²S clocks, and the PCA9306 is designed for I²C. Auto-sense parts are known to misbehave with I²C pull-ups and with clock loads. The NTS0104 would only make sense to shift a few slow GPIOs.

## After the level shifter 1.8 i2C, should we pull up?

**Yes, and it's already done:** R703 and R704 (4.7k to DAC_1V8). The PCA9306 requires pull-ups on both sides. See item 13.

## ESD protection on the audio lines, is it worth it? Would it ruin the signal? Stupid no?

**Worth it, and it doesn't hurt the signal.**

- The 3.5 mm jack is the most exposed contact on a handheld device: the plug touches the user.
- Jack1 (VS1053) uses U15 (TPD4E05U06, 0.5 pF, 10 nA) on L, R, GBUF and detect.
- Jack2 (DAC) uses D701–703 (TPD1E10B06). These are **bidirectional**, which is required because the CS43131 output swings below ground.
- ~12 pF at 20 kHz is about 660 kΩ, and it sits on outputs with impedance under 1 Ω. The diode's voltage-dependent capacitance therefore draws negligible current, so there is no audible distortion.

**Verdict:** keep both. Place them right at the jack, with a short path to GND.

## Board space (follow-up to items 14 and 17)

Several answers above add footprints (DNP debounce RC, 0R cut points, test pads), so board space was measured in `notes/bom-surface.md`. The BOM takes 3854 mm² of courtyard on a ≈ 5804 mm² outline. Connectors, the BT module and switches are 55 % of that and can't shrink.

What we could get back:

- passives 0603 → 0402: ~550 mm², the best value; the new DNP RCs and 0R cut points then cost ~1.7 mm² each instead of 4.3;
- same-die smaller packages (PSRAM USON-8, AVC4T245 UQFN-16, TPS7A20 X2SON-4, ...): ~130 mm²;
- MCU in UFBGA-144: 222 mm² alone, but it needs a 4-layer board.

The 2.54 mm debug headers (J402, J403, J404, J502) take 220 mm², which backs up item 17: use pads or a Tag-Connect footprint instead.

---
