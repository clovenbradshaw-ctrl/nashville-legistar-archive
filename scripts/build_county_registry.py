#!/usr/bin/env python3
"""Build data/counties/registry.json from the researched county workbook.

Stdlib only (zipfile + xml) -- the VM has no openpyxl and this must not add a
dependency. The workbook is kept beside the output as the source of record.
Free-text 'where it lives' cells are parsed into seed URLs; the raw text is
kept on every row so a seed the heuristic missed is visible, not lost.
"""
import json, re, sys, zipfile, xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import counties as C

M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
SRC = C.COUNTIES_DIR / "source" / "TN_county_legislation_and_contracts.xlsx"
URL_RE = re.compile(r"(?:https?://)?(?:[a-z0-9-]+\.)+(?:gov|com|org|net|us|tn|info|edu)(?:/[^\s;,()]*)?", re.I)


def read_sheet():
    z = zipfile.ZipFile(SRC)
    ss = [''.join(t.text or '' for t in si.iter(f'{{{M}}}t'))
          for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(f'{{{M}}}si')]
    rows = []
    for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).iter(f'{{{M}}}row'):
        d = {}
        for c in row.findall(f'{{{M}}}c'):
            col = re.match(r'[A-Z]+', c.get('r')).group()
            v = c.find(f'{{{M}}}v')
            d[col] = ss[int(v.text)] if c.get('t') == 's' and v is not None else (v.text if v is not None else '')
        rows.append(d)
    return rows


def urls(text: str) -> list[str]:
    out = []
    for m in URL_RE.findall(text or ""):
        u = m.rstrip(".:'\"")
        if not u.lower().startswith("http"):
            u = "https://" + u
        if u not in out:
            out.append(u)
    return out


DISCOVERED = C.COUNTIES_DIR / "seeds-discovered.json"


def apply_discovered(recs: list[dict]) -> tuple[int, int]:
    """Merge reviewed researcher findings over the workbook: add sources (with provenance), drop
    sources that were not the county's own. The workbook is never edited."""
    if not DISCOVERED.exists():
        return 0, 0
    d = json.loads(DISCOVERED.read_text())
    by = {r["county"]: r for r in recs}
    added = dropped = 0
    for x in d.get("dropped", []):
        r = by[x["county"]]
        before = len(r["seeds"])
        r["seeds"] = [s for s in r["seeds"] if s["url"].rstrip("/") != x["url"].rstrip("/")]
        dropped += before - len(r["seeds"])
    for x in d.get("added", []):
        r = by[x["county"]]
        if any(s["url"].rstrip("/") == x["url"].rstrip("/") for s in r["seeds"]):
            continue
        r["seeds"].append({"kind": x["kind"], "url": x["url"], "provenance": "researcher", "verified": x.get("verified")})
        added += 1
    return added, dropped


def main():
    rows = read_sheet()
    hdr = rows[0]
    recs = []
    for r in rows[1:]:
        r = {hdr[k]: v for k, v in r.items() if k in hdr}
        if not r.get("County"):
            continue
        name = C.canonical(r["County"])
        leg_raw = r["Where legislation lives (agendas, minutes, resolutions, code)"]
        con_raw = r["Where contracts and bids live"]
        site = urls(r["Official county site"])[:1]
        seeds = []
        for kind, raw in (("legislation", leg_raw), ("contracts", con_raw)):
            for u in urls(raw):
                seeds.append({"kind": kind, "url": u})
        # a bare site root is only a seed when nothing more specific was found
        if not seeds and site:
            seeds.append({"kind": "site", "url": site[0]})
        recs.append({
            "county": name, "slug": C.slug_of(name), "fips": C.fips_of(name),
            "site": site[0] if site else None,
            "legacy": name == "Davidson",           # Metro Nashville: lives in data/*.jsonl
            "verification": r["Verification"],
            "bids_online": r["Bids/purchasing online?"],
            "platforms": r["Platform(s)"],
            "seeds": seeds,
            "raw": {"legislation": leg_raw, "contracts": con_raw, "notes": r.get("Notes", "")},
        })
    added, dropped = apply_discovered(recs)
    names = [c["county"] for c in recs]
    missing = sorted(set(C.NAMES) - set(names))
    assert not missing and len(set(names)) == 95, f"registry incomplete: missing={missing}"
    recs.sort(key=lambda c: c["fips"])
    out = {"schema": "TNCountyRegistry@1", "source": SRC.name, "counties": recs}
    C.REGISTRY.write_text(json.dumps(out, indent=1))
    n_seed = sum(len(c["seeds"]) for c in recs)
    no_seed = [c["county"] for c in recs if not c["seeds"]]
    print(f"{len(recs)} counties, {n_seed} seed URLs (+{added} discovered, -{dropped} dropped); no seeds: {no_seed}")


if __name__ == "__main__":
    main()
