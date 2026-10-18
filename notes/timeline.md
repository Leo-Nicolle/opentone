# Timeline and completion state

Where OpenTone (formerly OpenPod) comes from, what each part of the project
looks like today, and how far it is from done. Written 2026-10-18 from the git
history (127 commits), `docs/blog/`, `notes/`, `plans/TODO.md` and
`plans/roadmap.md`.

The percentages are estimates ("magic hat" numbers): they weigh what works
on the bench against what is still listed in the TODOs and plans. They aren't
measured.

## At a glance

**Global completion: ~55 %.**

- **Software: ~80 %.** Firmware, UI, syncer, docs, tests and the bench are all
  in daily use. What's left is polish (settings, playlists, bug list) and the
  firmware for parts that don't exist yet (power, battery, USB).
- **Hardware: ~20 %.** Every module is validated on a Nucleo-F446RE plus a
  perfboard, but there is no PCB yet beyond the dev boards. Power, battery and
  USB haven't been validated, and the case is barely started.

The hardware is the long tail: the next steps (NUCLEO-F446ZE port, carrier PCB,
current measurements, iPod-sized board, case) are sequential, and each needs a
PCB order.

## Activity

Commits per month (squashed PRs count as one, so 2025 is under-represented:
the "Rebirth" PRs hold ~90k added lines between them):

```
2019-07  ████████                                                    8
2020-01  ██                                                          2
2020-03  █                                                           1
2020-04  ████████                                                    8
   ...   (5 years in the drawer)
2025-05  ███████████                                                11
2025-07  █                                                           1  (squash of Apr–Jul work)
   ...   (14 months in the drawer)
2026-09  ██████████████████████████████████████                     38
2026-10  ██████████████████████████████████████████████████████████ 58
```

## Past steps

### 1. First attempt (Jul 2019 – Apr 2020)

19 commits, then shelved for five years.

- Plays an MP3 from the SD card. Browses files and menus, with a "back"
  action (Jul 2019).
- Rewiring, then a new display with touch, and a refactor around it. Draws a
  battery icon (Jan–Apr 2020).
- First version of a sensing wheel for scrolling (Apr 2020).

### 2. Rebirth (Apr – Jul 2025)

12 commits, two big PRs. Then shelved for 14 months.

- **Click wheel designer** (blog 15-04): an SVG/PNG generator for KiCad and a
  finger-touch simulator. A 4-pad design was picked.
- **Docs site** (VitePress), deploy scripts, svg2mod export (May 2025).
- **ILI9341 on 16-bit parallel** to the Nucleo-F446RE (blog 31-05).
- **Custom UI renderer**, after Adafruit GFX proved too slow. A font
  converter script (blog 01-06).
- **Hardware scrolling** and partial buffering (blog 03-06), then
  **1/2/4-bit-per-pixel screen buffers** for fast list scrolling (blog 14-06).
- **Music indexer** (Node.js): relationship `.bin` files and a prefix trie for
  search (blog 01-07).

### 3. The big return: a real player (18 – 22 Sep 2026)

~38 commits in five days.

- Player, settings, breadcrumb, accented names, navigation and track
  selection, seeking, track lengths from the index.
- Ring buffer with next-file prefetch into PSRAM. The full test suite is
  back on PlatformIO.
- **Album covers** (blog 20-09): Lanczos resize, on-device QOI vs raw565
  benchmark (raw565 won), `track_to_album` / `album_to_cover` indexes.
- Research: new Nucleo summary, chip recaps (VS1053/63/73, BT modules,
  STM32U5).
- Tools: pinout viewer and generator, UI builder (sprites, theme, logo),
  thinner fonts.
- First Bluetooth dev board footprint.
- First attempt at heavy FLAC playback ("not sure it is perfect").

### 4. Click wheel hardware and smooth FLAC (4 – 10 Oct 2026)

- Pinout and mapping moved to `docs/public/`. Blender files and printed parts
  for the click wheel dev holder.
- Physical buttons added to the wheel. **Haptic motor** (DRV2605L) wired.
  Better scrolling and long-name handling.
- **Smooth FLAC** (blog 09-10, the reference write-up):
  - bus speeds measured;
  - the VS1053 is fed from a **timer interrupt** out of a RAM FIFO;
  - an SPI1 bus lock fixes the breadboard crosstalk;
  - 24-bit FLAC plays, with a smarter refill policy.
- UI: log volume curve, Now Playing shows artist/album, **search**, overlay
  on long lists, **boot animation and sound**, tidy-up.

### 5. Bluetooth, syncer and podcasts (11 – 12 Oct 2026)

- **Bluetooth validated** (blog 11-10): the FSC-BT1035 streams the VS1053's
  I2S output over A2DP. The last big technical unknown is gone.
- BT driver, model (`BtModel`), full Settings › Bluetooth UI and host tests.
  The code was trimmed from 4 KB to 1.4 KB of static RAM.
- **LQFP100 pinout** for the final board. Next-board plan
  (`notes/new-nucleo-plan.md`).
- **Rust syncer** (`syncer/`): replaces `sync.sh` and the Node indexer. It
  ships as a CLI, a desktop app and a browser app, with GitHub Actions
  releases.
- **Podcasts**: syncer support, menu, UI builder screens, listening state.
- Lists with no length limit (windowed loading). Research on USB speed.
- Docs reorganised and restyled.

### 6. Measure everything (15 – 17 Oct 2026)

- Faster card reads, and sync is safer to exclude from while it runs. New
  logo.
- **Bench and e2e tests** (blog 16-10): the device is driven over serial,
  scenarios are measured, and reports are compared on a docs page. The bench
  found the blocking screen transition that starved audio.
- **Paged index** (blog 17-10):
  - a single `index.pack` on the SD card, read through a 4-way PSRAM page
    cache;
  - boot takes 3.1 s at 100k tracks, against 5.6 s at 6k before;
  - 0 underruns.
- **Fast-scroll gearbox**: letter jumps in three gears, plus a live Scroll
  Tuning page over Web Serial.
- Project renamed **OpenPod → OpenTone** (PR #3).

## Breakdown by part

| Part | State | Done | What's left |
| --- | --- | --- | --- |
| **Firmware: audio** | MP3, FLAC up to 24-bit, interrupt-fed FIFO, 0 underruns on the bench | 85 % | Rough seek transition. Gapless vs gap setting. Hi-res (24/96) needs a better MCU. The refill margin is thin after the memory tightening (TODO) |
| **Firmware: library and storage** | Paged `index.pack`, search trie, covers, podcasts, 100k tracks | 85 % | Pre-warm the cache after boot (cold keystroke 179 ms, open a list 1 s p95). Playlists. Shuffle |
| **Firmware: system** | Logging macros, bench hooks, haptics | 45 % | Power management, battery gauge, USB file transfer, port to the F446ZE/LQFP100 pinout |
| **UI** | Menus, Now Playing, search, overlay, gears, boot screen, BT screens, podcasts, UI builder | 80 % | Settings screen. Goto from Now Playing. Scrolling breadcrumb. Accented glyphs. Bugs: covers missing in Now Playing, play vs center button, seek-mode capture, rounded bars. Covers animation (`plans/covers-animation.md`). Dimmed BT icon |
| **Input: click wheel** | Capacitive wheel (MPR121), buttons, haptics, scroll gears tuned | 70 % | Decide whether the center button stays capacitive. Check the wheel fits the iPod case. Center/ring articulation. Final PCB version |
| **Bluetooth** | Validated, driver, UI, tests | 85 % | BT1035 is EOL: move to the FSC-BT1026x footprint. Receiver drop/reconnect. VBAT decoupling |
| **Indexer / syncer** | Rust CLI + desktop + web app, CI releases, podcasts, pack file | 85 % | Keep .m4a unconverted. Tests for every input format. Live "on the card" counter. Check the remove/blacklist flow. Auto-remove listened podcasts |
| **Docs / website** | VitePress, 11 blog posts, tools (click wheel, UI builder, pinout studio, bench, scroll tuning, sync) | 70 % | User manual (`docs/manual/` is a stub). `docs/about.md` still lists the old BOM. Timeline page with charts (TODO). Flash-from-the-website button |
| **Tests** | 23 host test files (PlatformIO), `cargo test`, on-device e2e via the bench | 70 % | Bench dataset without covers. Bench compare tool misreports "worse" entries. Nothing covers power or USB yet |
| **Validation / benchmarks** | Screen, VS1053, SD, PSRAM, wheel, haptics, buttons and BT validated. Full bench at 6k and 100k tracks | 60 % | Power buttons, power management, battery, USB. Current draw per part, and a battery size from it |
| **Electronics / PCB** | Hand-soldered perfboard. KiCad schematics (audio, power, BT, buttons). BT and click-wheel dev boards. LQFP100 allocation | 25 % | Buy a NUCLEO-F446ZE and port. Carrier PCB (charger, TPS22917 switches, MAX17048, USB, test points). XRESET pull-up and anti-pop stage. Final iPod-sized board |
| **Power / battery / USB** | Pin plan (`notes/next-step-pinout.md`), USB speed research | 10 % | All of it: circuits, measurements, firmware |
| **Case / mechanical** | Printed click-wheel holder and buttons. iPod 5th-gen faceplate/back plate reference models just added | 10 % | Fit the board, screen, wheel and battery in the iPod-classic case. Mount the screen for its good viewing angle |

## How the global number is computed

Each part is weighted by the effort it will likely still take, not by what
has been spent on it:

| Part | Weight | Done | Contribution |
| --- | --- | --- | --- |
| Firmware (audio, library, system) | 17 % | 75 % | 12.8 |
| UI | 10 % | 80 % | 8.0 |
| Click wheel | 7 % | 70 % | 4.9 |
| Bluetooth | 5 % | 85 % | 4.3 |
| Indexer / syncer | 9 % | 85 % | 7.7 |
| Docs | 5 % | 70 % | 3.5 |
| Tests | 5 % | 70 % | 3.5 |
| Validation | 5 % | 60 % | 3.0 |
| Electronics / PCB | 17 % | 25 % | 4.3 |
| Power / battery / USB | 10 % | 10 % | 1.0 |
| Case | 10 % | 10 % | 1.0 |
| **Total** | 100 % | | **≈ 54 %** |

## What's next (from `notes/new-nucleo-plan.md`)

1. NUCLEO-F446ZE: port the firmware to the LQFP100 pinout.
2. Carrier PCB: power, battery, USB, real connectors and test points.
3. Measure each subsystem's current, then write the power, battery and USB
   firmware.
4. iPod-sized final board with the LQFP100, then the case.

`plans/TODO.md` asks for deadlines on these, "instead of putting it back in
the drawer for a year again". This timeline is the starting point for that.
