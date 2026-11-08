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
- **EasyEDA / LCSC 3D models** used by the board (`hardware/opentone/3dmodels/opentone.3dshapes/`)
  have no license allowing redistribution. Fetch them with `node scripts/fetch-3d-models.mjs`.
- **CUI / Same Sky SJ-43515TS-SMT-TR 3D model** (`hardware/opentone/jack/SJ-43515TS-SMT-TR.step`):
  the SnapMagic license restricts distributing it. Download it from SnapMagic.

## Included in the repository

| Path | Origin | Terms |
|---|---|---|
| `hardware/opentone/jack/` | CUI / Same Sky SJ-43515TS-SMT-TR symbol and footprint, via SnapMagic | SnapMagic design license, see `hardware/opentone/jack/License.txt` |
| `hardware/opentone/3dmodels/*.3dshapes/` (except `opentone.3dshapes/`) | [KiCad packages3D](https://gitlab.com/kicad/libraries/kicad-packages3D) | CC-BY-SA 4.0 with the KiCad libraries exception, see `hardware/opentone/3dmodels/README.md` |
| `hardware/3dmodels/ESP32-S3-WROOM.step` | Espressif | manufacturer CAD model |
| `hardware/3dmodels/NHD-2.4-240320CF-Cxxx#-F.STEP` | Newhaven Display | manufacturer CAD model |
| `hardware/3dmodels/SKQGAF.STEP` | Alps Alpine | manufacturer CAD model |
| `hardware/3dmodels/Same_Sky_SJ-43514-SMT-TR.step` | Same Sky (CUI Devices) | manufacturer CAD model |
| `hardware/3dmodels/hirose-connector-*.stp` | Hirose Electric | manufacturer CAD model |
| KiCad standard library symbols and footprints used in the schematics | KiCad project | CC-BY-SA 4.0 with the KiCad libraries exception (designs using them are not affected) |
