#!/usr/bin/env python3
"""Build docs/public/datasheets/index.json from the KiCad schematics.

Reads every placed symbol in hardware/opentone/*.kicad_sch, groups them by
'Part number', merges datasheets/overrides.json and writes the index.

  python3 scripts/datasheets.py              # write index.json
  python3 scripts/datasheets.py --download   # also fetch missing PDFs into datasheets/<category>/
  python3 scripts/datasheets.py --check      # verify every indexed file exists, report orphans
"""
import argparse
import datetime
import fnmatch
import glob
import json
import os
import re
import sys
import urllib.request
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCH_GLOB = os.path.join(ROOT, "hardware/opentone/*.kicad_sch")
OVERRIDES = os.path.join(ROOT, "datasheets/overrides.json")
INDEX = os.path.join(ROOT, "docs/public/datasheets/index.json")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

# lib_id prefix -> category, for parts without an explicit override.
# Plain R/C/L are matched exactly so Device:Crystal / Device:LED don't land in passives.
LIB_EXACT = {"Device:R": "passives", "Device:C": "passives", "Device:L": "passives"}
LIB_CATEGORIES = [
    ("Device:Ferrite", "passives"),
    ("Device:LED", "discretes"),
    ("Device:D_", "discretes"),
    ("Device:Polyfuse", "discretes"),
    ("Device:Crystal", "discretes"),
    ("Transistor_FET:", "discretes"),
    ("Connector", "connectors"),
    ("Switch:", "input"),
]


def placed_symbols(path):
    """Yield (lib_id, properties) for every placed symbol in a schematic."""
    s = open(path, encoding="utf-8").read()
    for m in re.finditer(r'\n\t\(symbol\s*\(lib_id "([^"]+)"', s):
        depth, i = 0, m.start() + 1
        while True:
            if s[i] == "(":
                depth += 1
            elif s[i] == ")":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        props = dict(re.findall(r'\(property "([^"]+)" "([^"]*)"', s[m.start():i]))
        if not props.get("Reference", "#").startswith("#"):
            yield m.group(1), props


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def category_for(lib_id):
    if lib_id in LIB_EXACT:
        return LIB_EXACT[lib_id]
    for prefix, cat in LIB_CATEGORIES:
        if lib_id.startswith(prefix):
            return cat
    return "misc"


def collect():
    groups = {}
    for path in sorted(glob.glob(SCH_GLOB)):
        sheet = os.path.basename(path)[: -len(".kicad_sch")]
        for lib_id, p in placed_symbols(path):
            url = p.get("Datasheet", "").strip()
            if url in ("", "~"):
                continue
            mpn = p.get("Part number", "").strip() or p.get("Value", "")
            g = groups.setdefault(mpn, {
                "lib_id": lib_id, "mpn": mpn, "manufacturer": "", "lcsc": "",
                "description": "", "values": [], "refs": [], "sheets": [], "urls": Counter(),
                "urlRefs": {},
            })
            g["manufacturer"] = g["manufacturer"] or p.get("Manufacturer", "")
            g["lcsc"] = g["lcsc"] or p.get("LCSC", "")
            g["description"] = g["description"] or p.get("Description", "")
            for key, val in (("values", p.get("Value", "")), ("sheets", sheet)):
                if val and val not in g[key]:
                    g[key].append(val)
            g["refs"].append(p["Reference"])
            g["urls"][url] += 1
            g["urlRefs"].setdefault(url, []).append(p["Reference"])
    return groups


def ref_key(ref):
    m = re.match(r"([A-Za-z_-]+)(\d*)", ref)
    return (m.group(1), int(m.group(2) or 0)) if m else (ref, 0)


def build(download):
    ov = json.load(open(OVERRIDES, encoding="utf-8"))
    part_ov = ov.get("parts", {})
    parts, warnings, failed = [], [], []
    url_files = {}

    for mpn, g in sorted(collect().items()):
        o = part_ov.get(mpn, {})
        url, _ = g["urls"].most_common(1)[0]
        if len(g["urls"]) > 1:
            others = {u: g["urlRefs"][u] for u in g["urls"] if u != url}
            warnings.append(f"{mpn}: refs {others} use a different datasheet URL than the rest")
        if url.startswith("${KIPRJMOD}"):
            url = None  # local path in the schematic; file comes from overrides
        url = o.get("url") or url
        category = o.get("category") or category_for(g["lib_id"])
        if category == "misc":
            warnings.append(f"{mpn}: no category (lib_id {g['lib_id']}), add one to overrides.json")
        file = o.get("file") or next(
            (f for f, pats in ov.get("shared", {}).items() if any(fnmatch.fnmatchcase(mpn, pat) for pat in pats)),
            None,
        )
        if not file and url:
            file = url_files.get(url) or f"datasheets/{category}/{slug(mpn)}.pdf"
            url_files.setdefault(url, file)
        entry = {
            "id": slug(mpn),
            "mpn": mpn,
            "manufacturer": g["manufacturer"],
            "lcsc": g["lcsc"],
            "category": category,
            "description": o.get("description") or g["description"],
            "values": g["values"],
            "refs": sorted(g["refs"], key=ref_key),
            "sheets": g["sheets"],
            "inBom": True,
            "url": url,
            "file": file,
        }
        if o.get("extra"):
            entry["extra"] = o["extra"]
        parts.append(entry)

    for r in ov.get("reference", []):
        parts.append({"inBom": False, "url": None, "refs": [], **r})

    if download:
        for mpn, url, file in documents(parts):
            if url and not os.path.exists(os.path.join(ROOT, file)):
                err = fetch(url, os.path.join(ROOT, file))
                if err:
                    failed.append((mpn, url, file, err))

    parts.sort(key=lambda p: (p["category"], not p["inBom"], p["mpn"].lower()))
    index = {
        "generated": datetime.date.today().isoformat(),
        "source": "hardware/opentone/*.kicad_sch + datasheets/overrides.json",
        "generator": "scripts/datasheets.py",
        "categories": sorted({p["category"] for p in parts}),
        "parts": parts,
    }
    os.makedirs(os.path.dirname(INDEX), exist_ok=True)
    with open(INDEX, "w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"wrote {os.path.relpath(INDEX, ROOT)}: {len(parts)} parts")

    for w in warnings:
        print("warning:", w)
    missing = [d for d in documents(parts) if d[1] and not os.path.exists(os.path.join(ROOT, d[2]))]
    if failed:
        print("\nCould not download these (grab them in a browser, save to the given path):")
        for mpn, url, file, err in failed:
            print(f"  {mpn}\n    {url}\n    -> {file}  ({err})")
    elif missing and not download:
        print(f"\n{len(missing)} datasheet(s) not downloaded yet, run with --download")


def documents(parts):
    """Yield (mpn, url, file) for every part's datasheet and its extra documents."""
    for p in parts:
        if p.get("file"):
            yield p["mpn"], p.get("url"), p["file"]
        for e in p.get("extra", []):
            yield p["mpn"], e.get("url"), e["file"]


def fetch(url, dest):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/pdf,*/*"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
    except Exception as e:  # noqa: BLE001 - report every failure the same way
        return str(e)
    if not data.startswith(b"%PDF"):
        return f"not a PDF ({len(data)} bytes)"
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(data)
    print(f"  downloaded {os.path.relpath(dest, ROOT)} ({len(data) // 1024} KiB)")
    return None


def check():
    index = json.load(open(INDEX, encoding="utf-8"))
    ok, indexed = True, set()
    for mpn, url, f in documents(index["parts"]):
        indexed.add(f)
        path = os.path.join(ROOT, f)
        if not os.path.exists(path):
            if url:
                print(f"missing: {f} ({mpn}), run --download")
                ok = False
            else:
                print(f"local-only, no source URL: {f} ({mpn})")
        elif f.endswith(".pdf") and not open(path, "rb").read(4) == b"%PDF":
            print(f"not a PDF: {f}")
            ok = False
    for path in glob.glob(os.path.join(ROOT, "datasheets/**/*"), recursive=True):
        rel = os.path.relpath(path, ROOT)
        if os.path.isfile(path) and rel not in indexed and rel != "datasheets/overrides.json":
            print(f"orphan (not in index): {rel}")
    print("ok" if ok else "check failed")
    return ok


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--download", action="store_true", help="fetch missing datasheets")
    ap.add_argument("--check", action="store_true", help="verify the index against datasheets/")
    args = ap.parse_args()
    if args.check:
        sys.exit(0 if check() else 1)
    build(args.download)
