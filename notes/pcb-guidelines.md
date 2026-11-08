# PCB layout guidelines (opentone main board)

Rules for the opentone 4-layer board (`hardware/opentone/opentone.kicad_pcb`),
written after an expert review of the first routing (Nov 2026). The board is
being re-routed from scratch under these rules. Rules marked **[DRC]** are
enforced by `opentone.kicad_pro` netclasses / `opentone.kicad_dru`; the others
are checked by eye (see the review checklist at the end).

## 1. Manufacturing target

- **Single-sided assembly**: every component on **F.Cu**. B.Cu is copper only.
  Cheaper (one paste/pick-and-place pass) and no reflow-twice parts.
- Fab: JLCPCB 4-layer, 1.6 mm, stackup **JLC04161H-3313**.

## 2. Stackup and impedance (the "abaque")

| Layer | Role | Thickness |
|---|---|---|
| F.Cu | signals, **vertical (Y)** runs + all components | 35 µm (1 oz) |
| prepreg 3313 | εr 4.1 | 0.0994 mm |
| In1.Cu | **solid GND**, never cut | 15.2 µm |
| core | εr 4.6 | 1.265 mm |
| In2.Cu | power pours (+3V3, VSYS, +3.3VA), GND fill elsewhere | 15.2 µm |
| prepreg 3313 | εr 4.1 | 0.0994 mm |
| B.Cu | signals, **horizontal (X)** runs | 35 µm (1 oz) |

Microstrip impedance on F.Cu / B.Cu over the adjacent plane (Hammerstad-Jensen,
no solder mask — mask lowers Z by ~2–3 Ω):

| Width (mm) | 3313 stackup (h = 0.099) | old 7628 stackup (h = 0.210) |
|---|---|---|
| 0.10 | 63 Ω | 86 Ω |
| **0.15** | **53 Ω → ≈ 50 Ω with mask** | 75 Ω |
| 0.20 | 46 Ω | 67 Ω |
| 0.35 | 33 Ω | 51 Ω |

Why 3313: with 7628, 50 Ω needs 0.35 mm, which does not fit 0.4 mm-pitch QFN
pads. With 3313 the 0.15 mm signal width *is* 50 Ω, and the closer reference
plane lowers crosstalk, which is what lets traces be packed tightly.
Current capacity is unchanged (outer copper is still 1 oz).

- **USB D+/D−**: differential pair, 0.15 mm wide, **0.2 mm gap** ≈ 90 Ω
  (≈ 89–93 Ω estimated; confirm with KiCad Calculator → Transmission lines →
  coupled microstrip). Route together, same length, no vias if possible.
- Every signal must run over unbroken In1 GND (its return path). Never route a
  signal on B.Cu over an In2 power-pour split without a stitching cap/via nearby.

## 3. Track widths — two only [DRC]

| Use | Width | Net classes |
|---|---|---|
| **Signal** | **0.15 mm** | Default, Touch, USB, Analog |
| **Power** | **0.5 mm** | Power, AnalogPower, GND |

- **One width per route.** A route never changes width between two pads. [DRC]
- **Necking (power only)**: a 0.5 mm power track may narrow to 0.15 mm *only*
  to enter a pad narrower than 0.5 mm, *inside that IC's courtyard*, ≤ 1 mm long,
  centred on the pad. Never mid-route. [DRC: 0.15 allowed for power only inside
  IC courtyards]
- **Width changes at a crossroad**: when a power net goes from a trunk to a
  branch, the change happens at the branch point (T junction / via / cap pad),
  not as a bottleneck along a single path.
- **High-current loops** (TPS63802 switch nodes, VSYS, VBAT, VBUS) are copper
  **pours**, not tracks. Tracks are for distribution only.
- Prefer feeding fine-pitch power pins through their decoupling cap:
  plane via → cap pad (0.5 mm) → short neck into the IC pin.
- **Decoupling topology: pin → cap → via → plane.** Never pin → via → plane →
  via → cap: two vias in the loop make the cap useless for that pin. If a
  0.5 mm track can't reach the cap, link pin → cap at 0.15 mm end to end
  (one width for the whole link) [DRC: `mcu_decoupling_links`].

## 4. Vias — two only [DRC]

| Use | Diameter / drill |
|---|---|
| **Signal** | 0.45 / 0.25 mm |
| **Power + GND stitching** | 0.6 / 0.3 mm |

- No via-in-pad except EP thermal arrays (tented).
- A power/GND pad gets its via within 0.5 mm, one via per pad (two for EPs and
  bulk caps).

## 5. Clearances [DRC]

| Net class | Clearance |
|---|---|
| Default, Power, GND, USB | 0.15–0.2 mm |
| Analog, AnalogPower | 0.25 mm |
| Touch (wheel electrodes) | 0.3 mm |
| Copper ↔ board edge | 0.3 mm |
| Inside fine-pitch IC courtyards | 0.15 mm (pad spacing set by the footprint) |
| Pad ↔ pad | 0.1 mm |

## 6. Layers and direction

- **F.Cu = Y-axis (vertical) runs, B.Cu = X-axis (horizontal) runs.** Change
  direction by changing layer through a via, not by bending on one layer.
  Short pad escapes are the exception.
- In1.Cu is **solid GND, no tracks, no slots**.
- In2.Cu holds power pours only; no signal tracks except as a last resort.
- **Pack traces**: parallel signals run as a bus at 0.3 mm pitch (0.15 track +
  0.15 gap), same layer, same bends. Leave room for vias at the ends.

## 7. Ground

- **GND everywhere**: GND fill on F.Cu, In1, In2 (leftover areas) and B.Cu,
  each filled **to the board edge** (0.3 mm setback) — the zone outline is the
  board outline, on the same grid.
- **Stitching**: GND vias (0.6/0.3) every ~5 mm over the board and every
  ~2.5 mm along the edge; also next to every signal via that changes layer.
- Remove isolated copper islands (zone setting: always).
- **Thermal reliefs** on GND pads: gap 0.3 mm, spoke 0.3 mm, ≥ 2 spokes, so
  pads solder evenly. [zone settings + DRC]
- **Exposed pads (EP)**: solid connection + via array, not thermal reliefs.
- **Edge and fine-pitch connector GND pads** (U101, J201, USB1): solid connection
  [DRC: `solid_gnd_edge_pads`]. The pour reaches them from one side only, so a
  thermal relief can't get 2 spokes. They are reflowed, not hand-soldered.
- **Under MCUs**: GND pour keeps 0.3 mm from the MCU pads (thermal isolation
  distance). [DRC]

## 8. Keep-outs [DRC]

- **Under U401 (STM32F446) and VS1 (VS1053b)**: tracks and fan-out vias are
  allowed. In1 is solid between F.Cu and everything below, so what matters is
  not slotting In1: keep fan-out vias from merging into long rows.
- **BT module U101 (FSC-BT1035)**: no signal vias under it [DRC], and no copper
  at all under/around the antenna end (follow the module datasheet keep-out).
  It sits at the board edge by design, so it is exempt from the edge clearance.
- **No traces under crystals** Y401 (8 MHz), Y402 (32.768 kHz), Y1 (12.288 MHz)
  except their own two nets and GND. Keep the crystal next to its IC, its two
  traces short and equal, surrounded by GND.

## 9. Geometry

- **Exit pads straight** (along the pad's long axis), then bend. No track
  entering a pad at an angle — easier to manufacture and inspect.
- **Angles only at fine-pitch MCU pads**, where a 45° fan-out is unavoidable.
- **45° bends only**: no 90° corners on tracks, no acute (< 90°) angles
  (acid traps, etching problems).
- **No stubs**: no dangling track or via, no T-branch left over from a reroute.
  [DRC: dangling track/via = error]
- **Teardrops** on pads and vias (generated after routing: Edit → Edit
  Teardrops → Apply).

## 10. Grid

The old board had half its parts on 0.0125 / 0.025 mm offsets (mixed grids)
and the In1 GND zone drawn as a rectangle inset 0.4 mm from the edge, so parts
and the GND fill never lined up. Now every footprint origin is on the 0.05 mm
grid and every GND zone outline *is* the board outline.

- Board outline corner = **(31.5, 79.5)**; **grid origin** and **drill/place
  origin** are set there.
- **Placement grid 0.25 mm**: every footprint origin on it. Use 0.05 mm only
  when a fine-pitch part must line up with a neighbour.
- **Routing grid 0.05 mm** (0.3 mm track pitch = 6 steps).
- Rotate parts in 90° steps only.

How to set it up in pcbnew:
1. View → Grid Settings → Grid origin = (31.5, 79.5) (or Place → Grid Origin and
   click the board corner).
2. Grid list: add 0.25 mm and 0.05 mm; assign them to fast-grid 1 / 2
   (Alt-1 / Alt-2 switch between them).
3. To snap one part: press M on it and drop it with grid snapping on. To snap
   every footprint in bulk (KiCad closed):
   `python3 scripts/pcb-snap-grid.py hardware/opentone/opentone.kicad_pcb 0.25`.

## 11. Router settings (pcbnew)

- Board Setup → Net Classes: widths/vias as above; track width dropdown set to
  "use netclass values".
- Interactive Router Settings: walk-around mode, "Optimize pad connections" on,
  "Remove redundant tracks" on, corner style 45°.

## 12. Review checklist (things DRC does not see)

- [ ] F runs vertical, B runs horizontal; no long diagonal runs.
- [ ] No power width changes mid-route, only at branches / at the pad.
- [ ] Pads exited straight; angles only at MCU pins.
- [ ] Buses packed, consistent bend points.
- [ ] Every signal via has a GND stitching via within ~1 mm.
- [ ] GND fill reaches the edge everywhere, no long thin GND fingers.
- [ ] Crystal traces short, symmetric, guarded by GND.
- [ ] USB pair coupled, matched, over solid GND.
