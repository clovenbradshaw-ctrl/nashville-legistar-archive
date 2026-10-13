#!/usr/bin/env python3
"""Build the real county list from what the VM probe actually measured.

Reads data/counties/FALSIFY-coverage.vm.json (the verdicts from the run on the VM; a laptop run
is NOT accepted, because the laptop's network produced false connection failures) and writes:

    data/counties/PULLABLE.csv         one row per county (95): tier, contracts listed?, best source, next action
    data/counties/PULLABLE-SEEDS.csv   one row per registered source: status, document links, platforms

Nothing is taken from the registry's expectations: a source is "pullable" only if the probe reached it
and found a document link. Re-run after every probe (`deploy_counties_vm.sh probe` then `coverage`).
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
import counties as C

SRC = C.COUNTIES_DIR / "FALSIFY-coverage.vm.json"

RANK = {"LISTS": 0, "SYSTEM": 1, "POINTERS": 2, "BLOCKED": 3, "UNREACHED": 4, "NONE": 5}

ACTION = {
    "HAVE": "held by the Metro (ePAV/Legistar) pipeline; completeness not measured",
    "LISTS": "pull: crawler ready",
    "POINTERS": "share-drive or video links only: needs a person to export, or an adapter policy decision",
    "BLOCKED": "needs a person: bot check, access wall or robots.txt",
    "UNREACHED": "no answer: re-probe from the VM, check the domain",
    "NONE": "reached but no document links: likely JavaScript-rendered or wrong page; find the real source",
}


def main():
    if not SRC.exists():
        sys.exit(f"{SRC.name} missing: run `deploy_counties_vm.sh probe` then `coverage` first")
    d = json.loads(SRC.read_text())
    reg = {r["fips"]: r for r in C.load()}
    counties_rows, seed_rows = [], []
    for c in sorted(d["counties"], key=lambda x: x["fips"]):
        seeds = c["seeds"]
        listing = sorted((s for s in seeds if s["docs"] > 0), key=lambda s: -s["docs"])
        blocked = [s for s in seeds if s["tier"] == "BLOCKED"]
        kinds = sorted({s["kind"] for s in listing})
        plats = sorted({p for s in seeds for p in s["platforms"]})
        r = reg[c["fips"]]
        # what the SOURCE offers, separate from what we already hold (a county we hold rows for
        # would otherwise read as "HAVE" and hide whether its source can actually be pulled)
        src_tier = "HAVE" if r["legacy"] else min((x["tier"] for x in seeds), key=lambda t: RANK.get(t, 9), default="NONE")
        action = ACTION[src_tier]
        if c.get("unregistered"):
            action = "no source registered: needs research"
        counties_rows.append({
            "fips": c["fips"], "county": c["county"], "tier": src_tier,
            "rows_held": c.get("have_rows") if c.get("have_rows") is not None else ("legacy" if r["legacy"] else 0),
            "pullable_now": "yes" if src_tier == "LISTS" else ("held" if src_tier == "HAVE" else "no"),
            "contract_or_bid_docs_listed": "yes" if c.get("contracts_seed_listed") else "no",
            "kinds_listing_docs": "+".join(kinds),
            "doc_links_seen": sum(s["docs"] for s in seeds),
            "best_source": listing[0]["url"] if listing else "",
            "sources_registered": len(seeds),
            "sources_listing_docs": len(listing),
            "sources_needing_a_person": len(blocked),
            "platforms_seen": "+".join(plats),
            "workbook_verification": r["verification"],
            "workbook_bids_online": r["bids_online"],
            "next_action": action,
            "probed_at": d["probed_at"],
        })
        for s in seeds:
            seed_rows.append({"fips": c["fips"], "county": c["county"], "kind": s["kind"], "url": s["url"],
                              "tier": s["tier"], "http_status": s["status"], "doc_links": s["docs"],
                              "platforms": "+".join(s["platforms"])})
    # where each county's legislation lives online, for a person to open and watch
    disc = json.loads((C.COUNTIES_DIR / "seeds-discovered.json").read_text()) if (C.COUNTIES_DIR / "seeds-discovered.json").exists() else {}
    why_none = {x["county"]: x["why"] for x in disc.get("not_found", [])}
    found_by = {(x["county"], x["url"].rstrip("/")): x.get("verified", "") for x in disc.get("added", [])}
    pointers = []
    for c in sorted(d["counties"], key=lambda x: x["fips"]):
        legs = [x for x in c["seeds"] if x["kind"] in ("legislation", "site")]
        legs.sort(key=lambda x: -x["docs"])
        if not legs:
            pointers.append({"fips": c["fips"], "county": c["county"], "legislation_url": "", "reached": "no", "http_status": "",
                             "document_links": 0, "found_by": "", "note": why_none.get(c["county"], "no legislation source known")})
        for x in legs:
            fb = found_by.get((c["county"], x["url"].rstrip("/")))
            pointers.append({"fips": c["fips"], "county": c["county"], "legislation_url": x["url"],
                             "reached": "yes" if x["tier"] == "LISTS" else "no", "http_status": x["status"],
                             "document_links": x["docs"],
                             "found_by": ("researcher:" + fb) if fb is not None else "workbook",
                             "note": why_none.get(c["county"], "") if x["tier"] != "LISTS" else ""})
    out3 = C.COUNTIES_DIR / "legislation-pointers.csv"
    with out3.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(pointers[0]))
        w.writeheader()
        w.writerows(pointers)
    out1, out2 = C.COUNTIES_DIR / "PULLABLE.csv", C.COUNTIES_DIR / "PULLABLE-SEEDS.csv"
    for path, rows in ((out1, counties_rows), (out2, seed_rows)):
        with path.open("w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=list(rows[0]))
            w.writeheader()
            w.writerows(rows)
    t: dict[str, int] = {}
    for r in counties_rows:
        t[r["tier"]] = t.get(r["tier"], 0) + 1
    contracts = sum(1 for r in counties_rows if r["contract_or_bid_docs_listed"] == "yes" and r["tier"] != "HAVE")
    print(f"{len(counties_rows)} counties -> {out1.name}; {len(seed_rows)} sources -> {out2.name}; {len(pointers)} legislation pointers -> {out3.name}")
    print("tiers:", t, "| pullable with contract/bid docs listed (excl. Davidson):", contracts)


if __name__ == "__main__":
    main()
