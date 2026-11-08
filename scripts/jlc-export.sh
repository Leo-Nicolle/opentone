#!/usr/bin/env bash
# Generate the JLCPCB assembly files in hardware/opentone/exports/:
#   opentone-bom-jlc.csv      BOM built from the schematic (DNP parts left out)
#   opentone-all-cpl-jlc.csv  placement file holding exactly the BOM's parts
#
# Positions are read from the board with the same origin as the Gerber plot
# settings, so parts line up with the Gerbers. Export the Gerbers from KiCad.
# Usage: scripts/jlc-export.sh

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
project="$repo_root/hardware/opentone"
exports="$project/exports"
board="$project/opentone.kicad_pcb"
bom="$exports/opentone-bom-jlc.csv"
cpl="$exports/opentone-all-cpl-jlc.csv"
gerber="$exports/opentone-Edge_Cuts.gbr"

if [[ ! -f "$gerber" ]]; then
  echo "Warning: $gerber not found; export the Gerbers from KiCad too." >&2
elif [[ "$board" -nt "$gerber" ]]; then
  echo "Warning: the board was saved after the Gerbers were exported; re-export them." >&2
fi

origin_args=()
if grep -q '(useauxorigin yes)' "$board"; then
  origin_args=(--use-drill-file-origin)
fi

positions="$(mktemp --suffix=.csv)"
trap 'rm -f "$positions"' EXIT

kicad-cli sch export bom \
  --fields 'Value,Reference,Footprint,LCSC' \
  --labels 'Comment,Designator,Footprint,LCSC' \
  --group-by 'Value,Footprint,LCSC' \
  --ref-range-delimiter '' \
  --exclude-dnp \
  -o "$bom" \
  "$project/opentone.kicad_sch"

kicad-cli pcb export pos \
  --format csv \
  --units mm \
  --side both \
  "${origin_args[@]}" \
  -o "$positions" \
  "$board"

node "$repo_root/scripts/kicad-cpl-to-jlc.mjs" "$positions" "$cpl" --bom "$bom"
