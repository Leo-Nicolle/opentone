# Screens

## Current screen

A cheap AliExpress 2.4" 320×240 ILI9341 LCD (TN panel), connected over the 16-bit parallel interface. It has a 40-pin FPC at 0.5 mm pitch.
Sold by [JR E-Shop](https://www.aliexpress.com/store/1110377) for €3.39 a piece (Sept 2026).

Works great, and with my double buffering I think I have a great pipeline: refreshing the screen is negligible in my loop timing.

### Pinout

| FPC | Reverse | Function        | STM32F4         |
| --- | ------- | --------------- | --------------- |
| 1   | 40      | X- (touch)      | ignored         |
| 2   | 39      | Y- (touch)      | ignored         |
| 3   | 38      | X+ (touch)      | ignored         |
| 4   | 37      | Y+ (touch)      | ignored         |
| 5   | 36      | GND             | GND             |
| 6   | 35      | VDDI (2.8-3.3V) | 3.3V            |
| 7   | 34      | VDD (2.8-3.3V)  | 3.3V            |
| 8   | 33      | NC/FMARK (TE)   | ignored         |
| 9   | 32      | CSX (SPI CS)    | GND             |
| 10  | 31      | DCX (DC, A0)    | PB8             |
| 11  | 30      | WRX             | PB9             |
| 12  | 29      | RDX             | PB10            |
| 13  | 28      | SPI SDI (MOSI)  | ignored         |
| 14  | 27      | SPI SDO (MISO)  | ignored         |
| 15  | 26      | RESX (RESET)    | PB12            |
| 16  | 25      | GND             | GND             |
| 17  | 24      | DB0             | PC0             |
| 18  | 23      | DB1             | PC1             |
| 19  | 22      | DB2             | PC2             |
| 20  | 21      | DB3             | PC3             |
| 21  | 20      | DB4             | PC4             |
| 22  | 19      | DB5             | PC5             |
| 23  | 18      | DB6             | PC6             |
| 24  | 17      | DB7             | PC7             |
| 25  | 16      | DB8             | PC8             |
| 26  | 15      | DB9             | PC9             |
| 27  | 14      | DB10            | PC10            |
| 28  | 13      | DB11            | PC11            |
| 29  | 12      | DB12            | PC12            |
| 30  | 11      | DB13            | PC13            |
| 31  | 10      | DB14            | PC14            |
| 32  | 9       | DB15            | PC15            |
| 33  | 8       | LED-A           | 3.3V            |
| 34  | 7       | LED-K           | pulldown 10 Ω   |
| 35  | 6       | LED-K           | pulldown 10 Ω   |
| 36  | 5       | LED-K           | pulldown 10 Ω   |
| 37  | 4       | GND             | GND             |
| 38  | 3       | IM0             | GND             |
| 39  | 2       | IM1             | GND             |
| 40  | 1       | IM2             | GND             |

### Pros/cons

- **Current draw:** to be measured. The listing says 60 mA for the 4-LED backlight, but AliExpress figures are loose (it could be a max, a typical value, or copied from another listing).
- **Brightness:** seems fine to me. Not specified; my guess is ~200–300 nits.
- **Viewing angle:** fine from one side, bad from the other. Be careful when designing the PCB: mount the panel the right way round for good viewing angles.
- **Colors:** I heard these panels have color inversions on mid-greys, but I would need a reference to compare against. I have never been good at judging colors.

## Alternatives: Newhaven Display IPS panels

IPS panels give a much wider viewing angle. I found some (not on AliExpress, with this size, resolution and pin count; maybe I lost my AliExpress search mojo?) from Newhaven Display for €13–18. Are they worth ~4–5× the price?

Datasheets (the AF-CSXP one is also in `datasheets/display/NHD-2.4-240320AF-CSXP.pdf`):
[AF-CSXP](https://newhavendisplay.com/content/specs/NHD-2.4-240320AF-CSXP.pdf) ·
[AF-CSXP-T](https://newhavendisplay.com/content/specs/NHD-2.4-240320AF-CSXP-T.pdf) ·
[AF-CTXP](https://newhavendisplay.com/content/specs/NHD-2.4-240320AF-CTXP.pdf) ·
[AF-CTXP-T](https://newhavendisplay.com/content/specs/NHD-2.4-240320AF-CTXP-T.pdf) ·
[DB-CTXP](https://newhavendisplay.com/content/specs/NHD-2.4-240320DB-CTXP.pdf)

All are 2.4" 240×320 IPS, normally black, 80° viewing angle in every direction (CR ≥ 10).

### Overview

| Model (NHD-2.4-240320…) | Controller | Brightness (typ.) | Touch     | Interface                              | FPC         | Size W×H×T (mm)       | Logic current (typ.) | Price (1 pc) | Stock |
| ----------------------- | ---------- | ----------------- | --------- | -------------------------------------- | ----------- | --------------------- | -------------------- | ------------ | ----- |
| AF-CSXP                 | ST7789VI   | 1200 nits         | none      | 8/16-bit 8080, 3/4-wire SPI            | 40p, 0.5 mm | 42.80 × 59.91 × 2.55  | 10 mA                | €13.64       | 1021  |
| AF-CSXP-T               | ST7789VI   | 960 nits          | resistive | 8/16-bit 8080, 3-wire SPI              | 40p, 0.5 mm | 42.80 × 59.91 × 3.85  | 10 mA                | €17.39       | 111   |
| AF-CTXP                 | ST7789VI   | 350 nits          | none      | 8/16-bit 8080, 3-wire SPI              | 40p, 0.5 mm | 42.80 × 59.91 × 2.55  | 6 mA                 | €14.47       | 12    |
| AF-CTXP-T               | ST7789VI   | 280 nits          | resistive | 8/16-bit 8080, 3-wire SPI              | 40p, 0.5 mm | 42.80 × 59.91 × 3.93¹ | 6 mA                 | €17.44       | 82    |
| DB-CTXP                 | ILI9341V   | 450 nits          | none      | 8/9/16/18-bit 8080, RGB, 3/4-wire SPI  | 45p, 0.5 mm | 42.72 × 59.46 × 2.2   | 10 mA                | €16.84       | 274   |

¹ Including the protective film.

Prices and stock are from the shop listing (not in the datasheets).

### Backlight

| Model          | LEDs           | Current min / typ / max | Forward voltage (min / typ / max) | Brightness at typ. current | Nits per mA | Lifetime (to half brightness) |
| -------------- | -------------- | ----------------------- | --------------------------------- | -------------------------- | ----------- | ----------------------------- |
| AF-CSXP(-T)    | 4 in parallel  | 80 / 160 / 200 mA       | 2.7 / 3.0 / 3.4 V                 | 1200 (960 for -T) nits     | ~7.5        | 30,000 h min, 50,000 h typ.   |
| AF-CTXP(-T)    | 4 in parallel  | 40 / 80 / 100 mA        | 2.7 / 3.1 / 3.5 V                 | 350 (280 for -T) nits      | ~4.4        | 30,000 h min                  |
| DB-CTXP        | 4 in series    | 10 / 15 / 25 mA         | 10.8 / 12 / 13.6 V                | 450 nits                   | ~30         | 30,000 h min, 50,000 h typ.   |

The bright CSXP looks like the better choice on battery than the CTXP: its backlight is more efficient. Reaching 350 nits would take roughly 47 mA on the CSXP (linear estimate) against 80 mA on the CTXP. LED efficiency isn't perfectly linear, and 47 mA is below the CSXP's 80 mA rated minimum, so in practice that means PWM dimming.

Nits per mA is misleading for the DB-CTXP: its LEDs are in series at 12 V, so compare power instead. That's 15 mA × 12 V ≈ 180 mW for 450 nits, against 160 mA × 3.0 V ≈ 480 mW for 1200 nits (CSXP) and 80 mA × 3.1 V ≈ 250 mW for 350 nits (CTXP). Per watt they're about the same (~2.5 nits/mW for the CSXP and DB-CTXP, ~1.4 for the CTXP). But the DB-CTXP needs a 12 V boost LED driver.

**Driving the backlight:**

- The backlight current differs by 2× between CSXP and CTXP. A circuit sized for the CSXP's 160 mA would push the CTXP well past its 100 mA max. For tests, drive at 80 mA: that's the CTXP's typical current and the CSXP's minimum rated current, so you compare at equal power.
- A plain series resistor from 3.3 V doesn't work: the forward voltage can reach 3.4–3.5 V, above the rail, so the current would vary a lot from unit to unit. Use a constant-current sink (low-side MOSFET + sense resistor + op-amp, or a dedicated LED driver). That also lets you set the current per panel.

### Pinout differences (AF-* family)

All four AF-* panels use the same 40-pin 0.5 mm FPC (recommended connector: Molex 54132-4062).

| Pin    | AF-CSXP                    | AF-CSXP-T          | AF-CTXP | AF-CTXP-T          |
| ------ | -------------------------- | ------------------ | ------- | ------------------ |
| 2–5    | NC                         | Touch YD/XL/YU/XR  | NC      | Touch YD/XL/YU/XR  |
| 12     | WRX (DCX in 4-wire SPI)    | WRX                | WRX     | WRX                |
| 31     | IM0                        | IM0                | IM0     | IM0                |
| 32     | IM1                        | IM2                | IM2     | IM2                |
| 33     | IM2                        | GND                | GND     | GND                |
| Others | identical                  | identical          | identical | identical        |

For 16-bit parallel, tie all IM pins low (IM0 = IM1 = IM2 = 0).

The DB-CTXP has a different, 45-pin layout (recommended connector: Molex 0512964594).

### Mechanical

- The AF-* outline is 42.80 × 59.91 mm on all four, so only the depth changes in an enclosure: 2.55 mm for the non-touch versions, 3.85–3.93 mm for touch.
- The DB-CTXP is slightly smaller (42.72 × 59.46 mm) and thinner (2.2 mm).

### Versus the current ILI9341 panel

None of them is a drop-in replacement:

- **AF-* panels:** same 40-pin 0.5 mm FPC as my current panel, but a completely different pin order, so the board needs rerouting. The controller also changes from ILI9341 to ST7789, so the init sequence changes too (including `0x21` display inversion, which IPS panels need).
- **DB-CTXP:** same ILI9341(V) controller, so the driver stays mostly the same, but it has a 45-pin connector and a 12 V backlight. Its single VDD rail is rated 2.5–3.3 V max, so running it from the STM32's 3.3 V puts it at the top of its range.

Once a test board with the right connector exists, all four AF-* panels plug in, so buying one of each to test is straightforward.

### Power comparison with the current panel

At full brightness, my current panel draws less: 60 mA (listing) for the backlight, against 80 mA for the CTXP and 160 mA for the CSXP. But it's probably also dimmer, so the fairer comparison is current at equal brightness:

| Panel        | Backlight current | Brightness                  | Nits per mA      |
| ------------ | ----------------- | --------------------------- | ---------------- |
| Current TN   | 60 mA (listing)   | not stated, ~200–300 (guess) | ~3–5 (guess)    |
| AF-CTXP      | 80 mA             | 350 nits                    | ~4.4             |
| AF-CSXP      | 160 mA            | 1200 nits                   | ~7.5             |

I'd expect the current panel to land roughly level with the CTXP and behind the CSXP. TN panels usually let more backlight through than IPS, so a 60 mA TN panel can be fairly bright, but cheap modules often use weaker LEDs.

The logic side is similar on all of them (ILI9341 and ST7789 draw a few mA, 6–10 mA typ. per the datasheets), so the backlight decides everything.

**How to find out for sure:** put a multimeter in series with LED-A on the current panel and note the current at a comfortable indoor brightness. When the new panels arrive, dim each one until it looks equally comfortable and read the current again. That captures what the datasheets can't: TN vs IPS transmittance, anti-glare coating, and how bright each panel needs to be for me to read it easily.

### Expected draw (estimates, to be measured)

**Current panel:** LED-A goes straight to 3.3 V, with 10 Ω on each cathode pin. White LEDs drop ~2.9–3.2 V, so each resistor sees only 0.1–0.4 V and the current can be anywhere between ~30 and 90 mA, depending on the LEDs' forward voltage and their temperature. Best guess: ~40–60 mA backlight + ~5 mA logic ≈ 150–200 mW, always at full brightness (there is no dimming).

**Newhaven panels at a comfortable indoor brightness (~200 nits),** dimmed with PWM:

| Panel      | Avg backlight current  | Total from 3.3 V rail |
| ---------- | ---------------------- | --------------------- |
| Current TN | ~40–60 mA (no dimming) | ~150–200 mW           |
| AF-CSXP    | ~27 mA                 | ~120 mW               |
| AF-CTXP    | ~46 mA                 | ~170 mW               |
| DB-CTXP    | ~7 mA at 12 V          | ~125 mW               |

LEDs are slightly more efficient at low average current, so the Newhaven figures are probably a bit pessimistic.

So the best panel saves maybe 10–25 mA. That helps, but it isn't dramatic: the main reason to switch is the viewing angle.

### What to buy

- **AF-CSXP (one or two):** the most efficient, the best brightness range for outdoors, and the cheapest of the five.
- **DB-CTXP (maybe):** about the same power as the CSXP. It keeps the ILI9341 controller (almost no driver change) and is the thinnest, but it needs a 45-pin connector and a 12 V boost converter, and 3.3 V is the top of its rated VDD range.
- **Skip the AF-CTXP:** it costs more than the CSXP and is worse at everything.
- **Skip the touch versions:** they're thicker and dimmer, and I don't need touch.

## Reducing backlight power (any panel)

Order of impact: **idle timeout > dimming > panel choice > driver efficiency.**

### Dimming: the big saving

LED power is roughly proportional to brightness, and right now the backlight is always at 100%. If 35% is enough indoors, the backlight uses about 35% of the power: ~50 mA → ~18 mA. That's a bigger saving than switching panels.

- **PWM dimming:** switch the LEDs fully on and off fast, so average current = full current × duty cycle. On the current panel, this only takes an N-MOSFET between the cathode resistors and GND, with its gate driven by an STM32 timer PWM pin.
  - **Careful, this is an audio device:** switching tens of mA at kHz frequencies can couple into the audio path as a whine, and it can make ceramic capacitors sing. Run the PWM above 20 kHz, and keep the LED current loop small and away from the audio ground.
- **Analog dimming:** lower a steady DC current instead. White LEDs give slightly more light per mA at low current, and there is no switching noise, which is attractive for audio. The color can shift slightly at very low currents. PWM filtered into a DC current also works.

### Wasted voltage: smaller than it sounds

A linear driver (a resistor or a transistor current sink) burns (Vsupply − Vf) × I as heat. From 3.3 V with Vf ≈ 3.0 V, efficiency ≈ Vf / Vsupply ≈ 91%, so only ~9% is wasted.

What matters is where the 3.3 V comes from (Li-ion ~3.7 V average):

| Backlight power path                                     | Battery → light efficiency |
| -------------------------------------------------------- | -------------------------- |
| 3.3 V from an LDO, then a linear sink                     | ≈ 3.0 / 3.7 ≈ 80%          |
| 3.3 V from a buck converter (~90%), then a linear sink    | ≈ 82%                      |
| Switching LED driver running from the battery             | ≈ 85–90%                   |

So a switching LED driver only gains ~5–10% of the backlight power (1–3 mA once dimmed). It isn't worth the extra parts and switching noise for the 3 V parallel-LED panels. The exception is the DB-CTXP: its LEDs are in series at 12 V, so it needs a boost driver anyway.

The real reason to use a **constant-current** driver is control, not efficiency: with only ~0.3 V across the 10 Ω resistors, the current swings with the LEDs' forward voltage and temperature. A current sink keeps brightness and power predictable and can be set per panel. It's also required for the Newhaven panels, whose forward voltage can reach 3.4–3.5 V, above the 3.3 V rail.

### Other savings

- **Turn the backlight off when idle,** like the iPod does, and send the controller Display OFF + Sleep In. A music player's screen is off most of the time, so this likely saves more than everything else combined.
- **Ambient light sensor for auto-brightness:** dim indoors, bright outdoors.
- **A dark UI doesn't help on an LCD:** the backlight is always on and the liquid crystal only blocks the light. That trick only works on OLED.

### How to: backlight dimming with a MOSFET + PWM

The simplest dimming: a low-side N-MOSFET switching the LED cathodes, driven by a timer PWM pin. It works for the current panel and the AF-* panels (parallel LEDs, common anode). The DB-CTXP (12 V series LEDs) needs a boost driver instead.

#### Parts

| Ref | Part | Why |
| --- | ---- | --- |
| Q1  | **AO3400A** (SOT-23). Alternatives: Si2302, DMG2302U | Logic-level N-MOSFET with RDS(on) of tens of mΩ at VGS = 2.5 V. It must be specified at 2.5 V: the current panel only has ~0.3 V of margin (3.3 V − ~3.0 V LED drop), and whatever the FET drops dims the backlight. **Not a 2N7002:** a few Ω at 3.3 V gate drive drops ~0.15 V at 50 mA. |
| R1  | 100 Ω, gate series | Slows the edges a little: less noise coupled into the audio. |
| R2  | 100 kΩ, gate to GND | Keeps the backlight off while the MCU boots and its pins float. |
| FB1 | Ferrite bead, low DCR (< 0.1 Ω) | Isolates the LED current pulses from the 3V3 rail. |
| C1  | 10 µF + 100 nF, at LED-A | Local reservoir: the pulses come from here, not from the rail. |

#### Circuit

```
3V3 ── FB1 ──┬── LED-A
             C1
             │
            GND

LED-K1 ── 10 Ω ──┐
LED-K2 ── 10 Ω ──┼── Q1 drain
LED-K3 ── 10 Ω ──┘   Q1 source ── GND

PB10 ── R1 (100 Ω) ──┬── Q1 gate
                     R2 (100 kΩ)
                     │
                    GND
```

- Current panel: keep the existing 10 Ω cathode resistors, but join their bottom ends to Q1's drain instead of GND.
- AF-* panels (4 cathodes, LED-K1..K4): add one resistor per cathode to share the current. Size them after measuring: 80 mA total for tests, see [Backlight](#backlight).
- Keep the LED-A → LEDs → Q1 → GND → C1 loop short, and route its ground return away from the audio ground (VS1053, headphone amp).

#### Pin

**PB10 = TIM2_CH3** (AF1), as planned in `notes/next-step-pinout.md`. PB10 is `TFT_RD` today (`software/src/rendering/ILI9341_driver.h:43`): tie the display's RD to 3V3 first. TIM2 isn't used anywhere else in the firmware.

#### Firmware (STM32duino)

```cpp
// 25 kHz: above hearing range. TIM2 runs at 90 MHz on the F446 (APB1 x2),
// so there are 3600 steps per period, plenty for smooth dimming.
static HardwareTimer *backlight = nullptr;

void backlightBegin() {
  backlight = new HardwareTimer(TIM2);
  backlight->setPWM(3, PB10, 25000, 0);  // channel 3, 25 kHz, starts off
}

// level: 0..255 (perceived brightness). Squared to approximate the eye's
// response (gamma ~2), so low levels stay usable.
void backlightSet(uint8_t level) {
  uint32_t duty = (uint32_t)level * level;  // 0..65025
  backlight->setCaptureCompare(3, duty >> 4, RESOLUTION_12B_COMPARE_FORMAT);
}
```

- **Don't use `analogWrite()`:** its default frequency is 1 kHz, right in the audio band.
- Turn the backlight on only after the first frame has been drawn, so the screen never shows uninitialized RAM at boot.
- With the idle timeout: `backlightSet(0)`, then Display OFF (`0x28`) + Sleep In (`0x10`) on the controller.

#### Testing

1. **Current:** put a multimeter in series with LED-A and record the current at 100%, then at a comfortable indoor level. Note the duty cycle you need.
2. **Noise:** with headphones at high volume, play silence and quiet passages and sweep the brightness from 0 to 100%. Listen for whine and look for anything at 25 kHz or its harmonics on the audio output with a scope.
3. **If you hear whine:** try another frequency (20–50 kHz), check the C1/FB1 placement and ground routing, and only then consider analog dimming (op-amp current sink). Leave an unpopulated footprint for it on the next board.

### Next step

Add a dimming MOSFET (PWM above 20 kHz, or analog) to the current panel and measure again before deciding whether switching panels is worth it for power. The viewing angle remains a good reason to switch either way.

Done differently on the test board: see below. A constant-current sink replaces the plain MOSFET, for both panels.

## On the test board

`hardware/opentone/screens.kicad_sch` (2026-10-18) has both panels on the same 16-bit 8080 bus:

| | J201: current TN panel | J301: NHD-2.4-240320AF-CSXP |
| --- | --- | --- |
| Controller | ILI9341 | ST7789VI |
| Pinout | [Pinout](#pinout) above, "FPC" column (pin 1 = X- touch) | Datasheet p. 4 (pin 1 = GND) |
| Chip select | `TFT_CS1` (PB8) | `TFT_CS2` (PB9) |
| Backlight PWM | `TFT_BL` (PB10, TIM2_CH3) | `TFT_BL2` (PA3, TIM2_CH4) |
| Backlight current | ~58 mA (56k/1k reference, 1 Ω sense) | ~82 mA (39k/1k reference, 1 Ω sense) |
| Cathodes | 3, 4.7 Ω ballast each | 4, 4.7 Ω ballast each |
| Drain jumper | JP201 | JP301 |

Common to both:

- Connector: Hirose FH12-40S-0.5SH (bottom contact). **Check the contact side against each panel's FPC before
  ordering.**
- Bus: `TFT_D0`-`TFT_D15` (PC0-PC7 + PD8-PD15), `TFT_DC` (PD0), `TFT_WR` (PD1). Never pull both CS low.
- RDX tied to the panel's rail (no read-back), RESX on `NRST`, IM0-IM2 low (16-bit 8080), SDI/SDA low,
  SDO / TE / FMARK / touch left open.
- Supply: +3.3V through the drain jumper to VDD + VDDI. No load switch: an unpowered panel would be back-powered
  by the shared bus, so idle = backlight off + Display OFF / Sleep In.
- Backlight: anode from +3.3V (default) or VSYS through a 3-pad jumper, a ferrite bead and 10u + 100n at LED-A.
  The cathodes go through their ballast resistors to an MCP6001 + AO3400A sink with a 1 Ω sense resistor.
  The PWM pin feeds the op-amp reference through a divider, so a high PWM level means a fixed current
  (I = 3.3 V × 1k / (Rtop + 1k) / 1 Ω) and the duty cycle sets the brightness. The divider pulls the reference
  low while the MCU boots, so the backlight stays off.
- Analog dimming option: fit C206 / C306 (1 µF, DNP) to filter the PWM into a DC reference. No LED switching
  then, which is the fallback if the PWM whines in the audio.
- Headroom: at ~82 mA the IPS LEDs drop ~2.9-3.0 V, leaving ~0.2 V for the sink from +3.3V. If the measured
  current comes out low, move JP302 to VSYS (at the cost of more heat in the MOSFET).

Firmware changes this implies: two CS lines instead of a grounded CSX, `TFT_RD`/`TFT_RST` pins gone (tied on the
board), the ST7789 init sequence for panel 2, and the PWM code of [Firmware (STM32duino)](#firmware-stm32duino)
on both TIM2 channels.
