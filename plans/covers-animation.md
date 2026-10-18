# Cover art during the Now Playing slide

## Why
The slide into Now Playing (`transitionToNowPlaying`,
`software/src/ui/ui_engine_transitions.hpp:7`) draws the screen in ~7 px
wide column strips, one per frame, over 800 ms. The cover only appears once
the slide ends: `renderBodyChunk` blits it only when a strip spans all 160
art columns (`software/src/ui/nowplaying.hpp`, the `overlapLeft == artLeft &&
overlapRight == artRight` test), because covers are stored **row-major**.

A narrow column strip of a row-major cover still touches all 160 rows:
SD reads are 512 B sectors, so each frame would read the whole 51 KB cover
(~25 ms idle, up to ~130 ms with audio refills, see `AlbumArt.h`), ~45
times per slide. Pre-loading doesn't fit either: 51 KB of SRAM is too much
on the F446, and PSRAM (~78 ms per 32 KB written) would delay the slide's
start by ~125 ms. GRAM has no off-screen area to pre-draw into.

**Column-major covers** make a strip of `w` columns one contiguous read of
`w * 320` bytes (~2.2 KB for 7 px, ~2 ms at ~1.3 MB/s), cheap enough for
every frame.

## Format: `raw565c` (format byte 2)
Same as `raw565` (160×160, little-endian RGB565, no header, 51 200 bytes)
but **column-major**: column 0 top-to-bottom, then column 1, ... Byte
offset of pixel (col, row) = `(col * 160 + row) * 2`.

`album_cover_entry_t.format` already carries the format byte
(`syncer/.../thumbs.rs` `Format::byte`, `Music_lookup.h`), so firmware picks
the path per cover and old cards (format 1) keep working: they just keep
the placeholder during the slide, like today.

## 1. Syncer (`syncer/crates/core/src/index/thumbs.rs`)
- Add `Format::Raw565Col` (name `"raw565c"`, byte `2`) and make it the
  `#[default]`. `encode_raw565_col(rgb)`: same packing as `encode_raw565`,
  iterating `x` outer, `y` inner.
- `generate()`: match the new variant. Placeholder covers go through the
  same path (uniform colour, so order doesn't matter, but keep it uniform).
- `src_hash` already hashes `format.name()`, so existing thumbnails are
  regenerated on the next sync; still bump `PIPELINE_VERSION` to 3 and update
  the module doc ("Firmware contract") for both layouts.
- CLI (`syncer/crates/cli/src/main.rs` `FormatArg`): add `Raw565c` and make it
  the default `--thumb-format`; keep `raw565` / `qoi` selectable.
- Podcasts (`syncer/crates/core/src/podcasts/mod.rs:301-307`) use the same
  `thumbs::generate`/`pack` with `thumbs_cfg`, so `podcast_thumbs.bin` follows
  automatically; check that its config defaults to the same format.
- Test: `encode_raw565_col` of a small gradient equals the transpose of
  `encode_raw565`; `Format::Raw565Col.byte() == 2`.
- Legacy `indexer/` (TS) is only kept for fixtures/benchmarks: leave it on
  raw565 and note it in its README.

## 2. Firmware: column reads (`software/src/storage/AlbumArt.h`)
`bool blitCoverColumns(uint16_t *dest, int destStride, int destRow0,
int destCol0, uint32_t coverOffset, uint32_t coverLength, int colStart,
int colCount, bool podcast = false)`:
- bounds-check `(colStart + colCount) * 320 <= coverLength`, like
  `blitCoverRows`;
- one `seekSet(coverOffset + colStart * 320)`, then for each column one
  sequential 320-byte `read()` into a stack `uint16_t col[160]` and scatter
  it into `dest[(destRow0 + r) * destStride + destCol0 + c]` (no big
  temporary; sequential reads need no further seeks);
- `audioYield()` every 8 columns, as the row path does every 8 rows;
- returns false on any failure so the caller falls back to the placeholder.

Rename the existing doc comment's stale "128x128" to 160 while there.

## 3. Firmware: draw the art column region on its own (`software/src/ui/nowplaying.hpp`)
For a column-major cover the art can't be drawn inside the 30-row bands
(each band would need 160 short column reads). So split the body into:
- **art region**: x ∈ [`ALBUM_ART_X`, `ALBUM_ART_X + 160`), y ∈ [`BODY_Y`,
  `BOTTOM_BAND_Y`) - the cover, its 1 px `COLOR_LINE` border, and the plain
  background above/below it;
- **everything else**: the existing banded `renderBodyChunk` (left margin,
  metadata column), which never covers the art columns any more.

New `renderArtColumns(display, x, width, tx)`: renders the art region's
columns [x, x+width) for all its rows as one rect. Buffer limit:
`SCREEN_WIDTH * CHUNK_HEIGHT` = 9600 px / 180 rows → at most 53 columns per
push, so loop in pieces of ≤ 53 columns (a full render = 4 pieces of 40).
Per piece: fill `COLOR_BG`, blit the cover columns (or `COLOR_SURFACE`
placeholder on failure / no cover), draw the border, push.

New `renderBodySlice(display, x, width, tx)` used by both `render()` and the
slide, splitting [x, x+width) into: left of the art (banded), the art
columns (`renderArtColumns`), right of the art (banded). The bottom band
stays as is.

- `render()`: the `artUnchanged` shortcut becomes "skip the art piece";
  everything else unchanged (`artOnScreen`/`drawnCover*` bookkeeping).
- Format 1 (row-major) covers: keep the current banded blit path untouched,
  chosen by `coverFormat`, so un-resynced cards render as today.
- QOI (format 0) is unsupported today, unchanged.

## 4. Firmware: the slide (`ui_engine_transitions.hpp:41-44`)
Replace the per-band `nowPlaying.renderChunk` loop with
`nowPlaying.renderBodySlice(display, lastDrawnOffset, width)` plus the bottom
band chunk. Each frame then reads only the cover columns it reveals. The
strip is drawn into columns the scroll offset hasn't revealed yet, so the
order of the art/band pushes within a frame is invisible.

Mark the art as drawn at the end of the slide (it was drawn whole, piece by
piece) so the final `renderCurrentState()` skips re-reading it: set
`artOnScreen`/`drawnCover*` once the slide's last strip lands, or simply let
the final render redraw it once (~25 ms) - start with the latter, it's
simpler and already correct.

Back-to-list slide needs nothing: the cover is already on screen.

## Verification
- `cargo test -p <core crate>` for the encoder; resync a card.
- `pio test -e test_native`: extend `software/test/test_album_art.cpp` with
  `blitCoverColumns` cases mirroring the row ones (right bytes to the right
  place at a destStride ≠ width, length bound, missing file, colCount <= 0).
- On hardware, with the bench/UI perf log (`measurePerformance`, LOG UI):
  - the cover slides in with the screen, no stutter; compare frame times
    against a format-1 card (target: per-frame max within a few ms of it);
  - while a track is playing: no audio dropout during the slide;
  - steady Now Playing: cover, border and the background above/below it
    look as before; next track on the same album doesn't re-read the art;
  - an old format-1 card still shows covers (placeholder during the slide).
- `graft build`.
