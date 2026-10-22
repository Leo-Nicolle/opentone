# Licensing and third-party material

| Path | License |
|---|---|
| everything outside `hardware/` (firmware, `syncer/`, `indexer/`, `docs/`, scripts…) | MIT, see [`LICENSE`](LICENSE) |
| `hardware/` (OpenTone schematics, PCB, symbols, footprints, mechanical parts) | CERN-OHL-P v2, see [`hardware/LICENSE`](hardware/LICENSE) |

Source location for the hardware: https://github.com/Leo-Nicolle/open-pod

Neither license covers the third-party material below. It keeps its own terms.

## Not redistributed

- **Datasheets, reference manuals and app notes** are copyright of their manufacturers.
  They are not stored in this repository. `docs/public/datasheets/index.json` lists every one
  with its source URL. Fetch them with `python3 scripts/datasheets.py --download`.

## Included in the repository

| Path | Origin | Terms |
|---|---|---|
| `hardware/opentone/jack/` | CUI / Same Sky SJ-43515TS-SMT-TR symbol, footprint and 3D model, via SnapMagic | SnapMagic design license, see `hardware/opentone/jack/License.txt` |
| `hardware/3dmodels/ESP32-S3-WROOM.step` | Espressif | manufacturer CAD model |
| `hardware/3dmodels/NHD-2.4-240320CF-Cxxx#-F.STEP` | Newhaven Display | manufacturer CAD model |
| `hardware/3dmodels/SKQGAF.STEP` | Alps Alpine | manufacturer CAD model |
| `hardware/3dmodels/Same_Sky_SJ-43514-SMT-TR.step` | Same Sky (CUI Devices) | manufacturer CAD model |
| `hardware/3dmodels/hirose-connector-*.stp` | Hirose Electric | manufacturer CAD model |
| KiCad standard library symbols and footprints used in the schematics | KiCad project | CC-BY-SA 4.0 with the KiCad libraries exception (designs using them are not affected) |
