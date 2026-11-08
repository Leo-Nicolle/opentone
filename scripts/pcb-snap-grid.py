#!/usr/bin/env python3
"""Snap every footprint origin of a KiCad board to a grid.

Usage (KiCad must be closed):
    python3 scripts/pcb-snap-grid.py <board.kicad_pcb> [grid_mm=0.05] [--dry-run]

The grid is measured from the board's grid origin (Place -> Grid Origin), so
set that to the board outline corner first. Locked footprints are snapped too.
Prints every footprint that moved and the largest displacement.
"""
import sys

import pcbnew


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    path = args[0]
    grid = pcbnew.FromMM(float(args[1]) if len(args) > 1 else 0.05)

    board = pcbnew.LoadBoard(path)
    origin = board.GetDesignSettings().GetGridOrigin()
    worst = 0.0
    moved = 0
    for fp in board.GetFootprints():
        pos = fp.GetPosition()
        nx = origin.x + round((pos.x - origin.x) / grid) * grid
        ny = origin.y + round((pos.y - origin.y) / grid) * grid
        if (nx, ny) == (pos.x, pos.y):
            continue
        d = max(abs(nx - pos.x), abs(ny - pos.y))
        worst = max(worst, pcbnew.ToMM(d))
        moved += 1
        if pcbnew.ToMM(d) > 0.01:
            print(f"{fp.GetReference():8} moved {pcbnew.ToMM(d):.4f} mm")
        if not dry:
            fp.SetPosition(pcbnew.VECTOR2I(int(nx), int(ny)))
    print(f"{moved} footprints snapped, max displacement {worst:.4f} mm")
    if not dry and moved:
        board.Save(path)


if __name__ == "__main__":
    main()
