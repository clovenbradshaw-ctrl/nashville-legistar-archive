#!/usr/bin/env python3
"""Falsify: "we hold the real database for every Tennessee county."

For each county this probes its registered seeds LIVE (robots.txt honoured, one
request per host per --delay seconds, no document downloads) and judges what is
actually there. The judgment is an EVA on the county's own operator log, so the
verdict is a replayable event, not a one-off print.

Tiers (strongest first; a county takes the best tier any of its seeds earns):
  HAVE      records for this county are already in our log (legacy Davidson or a prior pull)
  LISTS     a reachable page lists >= 1 document we could pull today with the crawler as-is
  SYSTEM    a known records platform is identified (BidNet, PlanetBids, Legistar, ...) but it
            renders client-side or needs its own adapter -- present, not yet ours
  POINTERS  only share-drive / video links (Dropbox, Drive, YouTube): not fetchable by policy
  BLOCKED   robots.txt, HTTP 401/403/429, or a 202 challenge page stops us: needs a human or
            browser check, NOT a "nothing there"
  UNREACHED connection error or 5xx: we could not tell (retry from another network before concluding)
  NONE      reached, HTTP 200, and the page lists no documents, no known platform and no share links
            (may still be JavaScript-rendered -- reached-and-empty is not proof of absence)
  (no seed registered is also NONE, but is reported separately as "unregistered")

The claim is falsified if ANY county is below HAVE. The tiers say how far, and what kind
of work closes the gap, per county.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin, urldefrag

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import counties as C
import county_pull as P
import eo_log

PLATFORM = [
    ("legistar", r"legistar\.com"), ("granicus", r"granicus\.com"), ("civicclerk", r"civicclerk"),
    ("municode", r"municode|library\.amlegal"), ("bidnet", r"bidnet"), ("planetbids", r"planetbids"),
    ("bonfire", r"bonfirehub"), ("publicpurchase", r"publicpurchase"), ("opengov", r"opengov"),
    ("govdeals", r"govdeals"), ("civicplus", r"civicplus|/DocumentCenter/|Archive\.aspx"),
    ("revize", r"revize\.com"), ("wordpress", r"wp-content|wp-json"), ("wix", r"wixstatic|wix\.com"),
]
SYSTEMS = {"legistar", "granicus", "civicclerk", "municode", "bidnet", "planetbids", "bonfire", "publicpurchase", "opengov"}
RANK = {"HAVE": 0, "LISTS": 1, "SYSTEM": 2, "POINTERS": 3, "BLOCKED": 4, "UNREACHED": 5, "NONE": 6}
DOC_HINT = ("/DocumentCenter/View/", "/AgendaCenter/ViewFile", "ViewFile", "/Archive.aspx?ADID=")


def probe_seed(pull: P.Pull, seed: dict) -> dict:
    u = seed["url"]
    r = {"url": u, "kind": seed["kind"], "tier": "NONE", "platforms": [], "docs": 0, "status": None}
    h = P.host(u)
    if any(h.endswith(b) for b in P.POINTER_HOSTS) or any(h.endswith(b) for b in P.TERMS_HOSTS):
        r["tier"] = "POINTERS"             # share links, and platforms whose terms forbid automation
        return r
    if any(h.endswith(b) for b in P.BROWSER_HOSTS):
        r["tier"] = "SYSTEM"
        r["platforms"] = [p for p, rx in PLATFORM if re.search(rx, u, re.I)]
        return r
    try:
        if not pull.allowed(u):
            r["tier"], r["status"] = "BLOCKED", "robots"
            return r
        resp = pull.get(u)
    except Exception as e:
        r["status"], r["tier"] = f"error:{type(e).__name__}", "UNREACHED"
        return r
    r["status"] = resp.status_code
    if resp.status_code in (202, 401, 403, 429):
        r["tier"] = "BLOCKED"                     # 202 is a challenge interstitial, not an empty site
        return r
    if resp.status_code >= 500:
        r["tier"] = "UNREACHED"
        return r
    if resp.status_code != 200:
        return r
    body = resp.text if "html" in resp.headers.get("content-type", "") else ""
    plats = {p for p, rx in PLATFORM if re.search(rx, body[:400000], re.I) or re.search(rx, resp.url, re.I)}
    lp = P.Links()
    lp.feed(body)
    docs = pointers = 0
    for a in lp.out:
        href = urldefrag(urljoin(resp.url, a["href"]))[0]
        if not href.startswith("http"):
            continue
        if any(P.host(href).endswith(x) for x in P.POINTER_HOSTS):
            pointers += 1
        elif P.is_doc(href):
            docs += 1
        for p, rx in PLATFORM:
            if p in SYSTEMS and re.search(rx, href, re.I):
                plats.add(p)
    r["docs"], r["pointers"], r["platforms"] = docs, pointers, sorted(plats)
    if docs:
        r["tier"] = "LISTS"
    elif plats & SYSTEMS:
        r["tier"] = "SYSTEM"
    elif pointers:
        r["tier"] = "POINTERS"
    return r


def county_verdict(reg: dict, delay: float) -> dict:
    pull = P.Pull(delay, 0, 0, lambda m: None)
    seeds = [probe_seed(pull, s) for s in reg["seeds"]]
    have = None if reg["legacy"] else eo_log.count_inserts(reg["slug"])
    tier = min((s["tier"] for s in seeds), key=lambda t: RANK[t], default="NONE")
    unregistered = not seeds
    if reg["legacy"] or have:
        tier = "HAVE"            # Davidson: the ePAV/Legistar pipeline owns it (checked separately)
    contracts = [s for s in seeds if s["kind"] == "contracts"]
    return {"county": reg["county"], "fips": reg["fips"], "slug": reg["slug"], "tier": tier, "have_rows": have,
            "unregistered": unregistered,
            "contracts_seed_listed": any(s["tier"] == "LISTS" for s in contracts),
            "workbook": {"verification": reg["verification"], "bids_online": reg["bids_online"]}, "seeds": seeds}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--delay", type=float, default=3.0)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--county", action="append")
    a = ap.parse_args()
    regs = [r for r in C.load() if not a.county or r["slug"] in a.county]
    t0 = time.time()
    with ThreadPoolExecutor(a.workers) as ex:
        out = list(ex.map(lambda r: county_verdict(r, a.delay), regs))
    for v in out:
        eo_log.emit(v["slug"], "EVA", "Figure", anchor=eo_log.county_anchor(v["fips"]),
                    criterion="machine_pullable_records", result=v["tier"],
                    evidence={"seeds": [{k: s.get(k) for k in ("url", "kind", "tier", "status", "docs", "platforms")} for s in v["seeds"]],
                              "have_rows": v["have_rows"]})
    counts: dict[str, int] = {}
    for v in out:
        counts[v["tier"]] = counts.get(v["tier"], 0) + 1
    res = {"schema": "CountyCoverage@1", "probed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
           "claim": "we hold the real database for every Tennessee county",
           "falsified": any(v["tier"] != "HAVE" for v in out), "tiers": counts,
           "counties_with_contract_docs_listed": [v["county"] for v in out if v["contracts_seed_listed"]],
           "elapsed_s": round(time.time() - t0), "counties": out}
    (C.COUNTIES_DIR / "FALSIFY-coverage.json").write_text(json.dumps(res, indent=1))
    print(json.dumps({k: res[k] for k in ("claim", "falsified", "tiers", "elapsed_s")}, indent=1))
    print("contract documents listed on a reachable page in:", res["counties_with_contract_docs_listed"])


if __name__ == "__main__":
    main()
