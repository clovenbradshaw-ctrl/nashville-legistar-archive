#!/usr/bin/env python3
"""The county scoreboard: falsifiable claims per county, rebuilt from the logs as they grow.

A claim is stated so evidence can refute it, and carries its verdict and the evidence:

  source_registered      the county has at least one registered source
  legislation_online     a legislation page was reached and listed at least one document
  legislation_held       we hold at least one agenda, minutes or resolution document
  contracts_held         we hold at least one contract, bid or award document
  files_intact           every held file exists on disk at its recorded size

Verdicts are PASS, FAIL (with why), or PENDING (not yet measurable, e.g. no check has run). A claim
is never PASS by default. Counters (documents, bytes, newest fetch, links seen on the legislation
pages, documents appeared since watching began) are numbers, not claims, and carry no threshold.

The builder refuses to run unless its own control behaves: a county with nothing registered MUST
fail `source_registered`, and a county whose recorded file is missing MUST fail `files_intact`.
A scoreboard that cannot fail is not a scoreboard.

Reads  <STORE>/<slug>/{manifest.jsonl, ops.jsonl, watch.json, watch.jsonl}
Writes <STORE>/scoreboard.json (latest) and <STORE>/scoreboard-history.jsonl (growth, one line per run
that changed anything).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import counties as C
import build_county_db as B
import eo_log

STORE = Path(os.environ.get("COUNTY_STORE") or C.COUNTIES_DIR)
LEGISLATION = {"agenda", "minutes", "resolution"}
CONTRACTS = {"contract", "bid", "award"}
HISTORY_KEEP = 4000


def now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def read_jsonl(path: Path):
    if not path.exists():
        return
    with path.open() as f:
        for line in f:
            try:
                yield json.loads(line)
            except ValueError:
                continue


def claim(cid: str, text: str, verdict: str, evidence: str) -> dict:
    assert verdict in ("PASS", "FAIL", "PENDING")
    return {"id": cid, "claim": text, "verdict": verdict, "evidence": evidence}


def card(reg: dict, store: Path, db_counts: dict | None = None) -> dict:
    slug = reg["slug"]
    rows = list(read_jsonl(store / slug / "manifest.jsonl"))
    # digests recorded after the fact (retrofit) live in the operator log, keyed by document anchor
    digests, verified, archived = {}, {}, {}
    for ev in read_jsonl(store / slug / "ops.jsonl"):
        c0 = ev.get("content") or {}
        if ev.get("op") == "DEF" and c0.get("path") == "digest":
            digests[ev.get("anchor")] = c0["value"]
        elif ev.get("op") == "DEF" and c0.get("path") == "verification":
            verified[ev.get("anchor")] = c0["value"]
        elif ev.get("op") == "DEF" and c0.get("path") == "archive":
            archived[ev.get("anchor")] = c0["value"]            # latest lookup wins
    legacy_n = (db_counts or {}).get(reg["fips"]) if reg["legacy"] else None
    n = len(rows) if not reg["legacy"] else (legacy_n or 0)
    total_bytes = sum(r.get("bytes") or 0 for r in rows)
    kinds: dict[str, int] = {}
    missing, wrong_size = [], []
    n_pages = scan_pages = text_only = 0
    for r in rows:
        k = B.kind_of(r.get("title"), r.get("url"), r.get("seed_kind"))
        kinds[k] = kinds.get(k, 0) + 1
        dg = r if r.get("text_file") else digests.get(eo_log.doc_anchor(r.get("fips", reg["fips"]), r["url"]))
        if dg:
            n_pages += dg.get("pages") or 0
            scan_pages += dg.get("scan_pages") or 0
        f = r.get("file")
        if f and (store / f).is_file() is False and dg and dg.get("text_file") and (store / dg["text_file"]).is_file():
            text_only += 1                               # original dropped on purpose; the text is what we hold
        elif f:
            p = store / f
            if not p.is_file():
                missing.append(f)
            elif r.get("bytes") is not None and p.stat().st_size != r["bytes"]:
                wrong_size.append(f)
        elif dg and dg.get("text_file"):
            if (store / dg["text_file"]).is_file():
                text_only += 1
            else:
                missing.append(dg["text_file"])
        else:
            missing.append(r["url"])
    last_fetch = max((r.get("fetched_at") or "" for r in rows), default="") or None
    # provenance: each row must say what was asked, who answered and with which headers (at fetch time
    # or by a later verification); and where archive.org stands for it
    no_prov, arch = [], {"match": 0, "captured_unverified": 0, "other": 0, "none": 0, "error": 0, "unchecked": 0}
    for r in rows:
        a_ = eo_log.doc_anchor(r.get("fips", reg["fips"]), r["url"])
        has = bool((r.get("provenance") or {}).get("headers") is not None and (r.get("provenance") or {}).get("status")) or a_ in verified
        if not (has and r.get("url") and r.get("sha256") and r.get("fetched_at")):
            no_prov.append(r["url"])
        arch[(archived.get(a_) or {}).get("status", "unchecked")] += 1

    cov = None
    for ev in read_jsonl(store / slug / "ops.jsonl"):
        if ev.get("op") == "EVA" and (ev.get("content") or {}).get("criterion") == "machine_pullable_records":
            cov = ev["content"]                              # latest judgment wins
    watch = {}
    wf = store / slug / "watch.json"
    if wf.exists():
        try:
            watch = json.loads(wf.read_text())
        except ValueError:
            watch = {}
    pages = watch.get("pages", {})
    leg_pages = [{"url": u, "status": p.get("status"), "n_links": p.get("n_links"), "checked_at": p.get("checked_at"),
                  "last_change_at": p.get("last_change_at"), "added_since_watching": p.get("added_total", 0)}
                 for u, p in pages.items()]
    reached = [p for p in leg_pages if p["status"] == "ok" and (p["n_links"] or 0) > 0]

    claims = []
    seeds = reg.get("seeds", [])
    claims.append(claim("source_registered", "this county has at least one registered source",
                        "PASS" if seeds else "FAIL", f"{len(seeds)} source(s)" if seeds else "no source registered"))
    if reg["legacy"]:
        claims.append(claim("legislation_online", "a legislation page was reached and lists documents", "PENDING",
                            "Davidson's legislation is held by the Metro Legistar pipeline, not this watcher"))
    elif not leg_pages:
        claims.append(claim("legislation_online", "a legislation page was reached and lists documents", "PENDING", "no watch cycle has run yet"))
    elif reached:
        claims.append(claim("legislation_online", "a legislation page was reached and lists documents", "PASS",
                            f"{len(reached)} page(s), {sum(p['n_links'] for p in reached)} document link(s)"))
    else:
        why = "; ".join(f"{p['url']} -> {p['status']}" for p in leg_pages[:3])
        claims.append(claim("legislation_online", "a legislation page was reached and lists documents", "FAIL", why or "no legislation page"))
    if reg["legacy"] and not rows:
        claims.append(claim("legislation_held", "we hold at least one agenda, minutes or resolution document", "PENDING", "held by the Metro Legistar pipeline"))
        claims.append(claim("contracts_held", "we hold at least one contract, bid or award document",
                            "PASS" if n else "PENDING", f"{n} contract record(s) in the legacy ePAV index" if n else "legacy index not present here"))
    else:
        nl = sum(kinds.get(k, 0) for k in LEGISLATION)
        nc = sum(kinds.get(k, 0) for k in CONTRACTS)
        claims.append(claim("legislation_held", "we hold at least one agenda, minutes or resolution document",
                            "PASS" if nl else ("FAIL" if n else "PENDING"), f"{nl} document(s)" if nl else ("held documents, none legislative" if n else "nothing pulled yet")))
        claims.append(claim("contracts_held", "we hold at least one contract, bid or award document",
                            "PASS" if nc else ("FAIL" if n else "PENDING"), f"{nc} document(s)" if nc else ("held documents, none a contract or bid" if n else "nothing pulled yet")))
    if rows:
        bad = len(missing) + len(wrong_size)
        claims.append(claim("files_intact", "every held document has its original or its text on disk, intact",
                            "FAIL" if bad else "PASS", f"{bad} of {len(rows)} wrong: " + ", ".join((missing + wrong_size)[:3]) if bad
                            else f"{len(rows)} of {len(rows)} verified ({text_only} held as text only)"))
    else:
        claims.append(claim("files_intact", "every held file exists on disk at its recorded size", "PENDING", "no files held yet"))
    if rows:
        claims.append(claim("provenance_complete", "every held document records its URL, hash, fetch time and the county's response headers",
                            "FAIL" if no_prov else "PASS",
                            f"{len(no_prov)} of {len(rows)} lack it, e.g. {no_prov[0]}" if no_prov else f"{len(rows)} of {len(rows)} complete"))
        checked = len(rows) - arch["unchecked"]
        have = arch["match"] + arch["captured_unverified"]
        claims.append(claim("archived_on_archive_org", "every held document has a capture on archive.org",
                            "PENDING" if not checked else ("PASS" if have == len(rows) else "FAIL"),
                            "not looked up yet" if not checked else
                            f"{have} of {len(rows)} have a capture ({arch['match']} verified same file, {arch['captured_unverified']} unverified); "
                            f"{arch['other']} differ from every capture, {arch['none']} not archived"
                            + (f", {arch['unchecked']} unchecked" if arch["unchecked"] else "")))

    return {
        "fips": reg["fips"], "county": reg["county"], "slug": slug,
        "source_tier": (cov or {}).get("result"),
        "documents": n, "bytes": total_bytes, "kinds": kinds, "last_fetch": last_fetch,
        "doc_pages": n_pages, "scan_pages_waiting_ocr": scan_pages, "held_as_text_only": text_only,
        "legislation": {"pages": leg_pages,
                        "links_visible": sum(p["n_links"] or 0 for p in leg_pages),
                        "added_since_watching": sum(p["added_since_watching"] for p in leg_pages),
                        "last_change_at": max((p["last_change_at"] or "" for p in leg_pages), default="") or None,
                        "last_checked_at": max((p["checked_at"] or "" for p in leg_pages), default="") or None},
        "claims": claims,
        "score": {"pass": sum(c["verdict"] == "PASS" for c in claims), "fail": sum(c["verdict"] == "FAIL" for c in claims),
                  "pending": sum(c["verdict"] == "PENDING" for c in claims), "of": len(claims)},
    }


def selftest() -> None:
    """The control. If the scoreboard cannot fail, refuse to publish one."""
    with tempfile.TemporaryDirectory() as td:
        store = Path(td)
        empty = {"county": "Nowhere", "fips": "47999", "slug": "nowhere", "legacy": False, "seeds": []}
        c = card(empty, store)
        got = {x["id"]: x["verdict"] for x in c["claims"]}
        assert got["source_registered"] == "FAIL", f"blind: empty county passed source_registered ({got})"
        assert got["files_intact"] == "PENDING", got
        d = store / "ghost"
        d.mkdir()
        (d / "manifest.jsonl").write_text(json.dumps({"url": "https://x.test/a.pdf", "title": "Agenda", "file": "ghost/files/ab/missing.pdf",
                                                      "bytes": 10, "fetched_at": "2026-01-01T00:00:00Z", "seed_kind": "legislation"}) + "\n")
        ghost = {"county": "Ghost", "fips": "47998", "slug": "ghost", "legacy": False, "seeds": [{"kind": "legislation", "url": "https://x.test"}]}
        g = {x["id"]: x["verdict"] for x in card(ghost, store)["claims"]}
        assert g["files_intact"] == "FAIL", f"blind: a missing file passed files_intact ({g})"
        assert g["legislation_held"] == "PASS", g           # and the positive path still passes


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--loop", type=int, default=0, help="seconds between rebuilds; 0 = once")
    a = ap.parse_args()
    selftest()
    while True:
        t0 = time.time()
        db_counts = None
        dbp = STORE / "county.sqlite"
        if dbp.exists():
            import sqlite3
            try:
                c = sqlite3.connect(f"file:{dbp}?mode=ro", uri=True)
                db_counts = {fips: n for fips, n in c.execute("SELECT fips, n_docs FROM county_stats")}
            except sqlite3.Error:
                db_counts = None
        cards = [card(r, STORE, db_counts) for r in C.load()]
        board = {"schema": "CountyScoreboard@1", "built_at": now(), "selftest": "passed",
                 "totals": {"counties": len(cards), "documents": sum(c["documents"] for c in cards),
                            "bytes": sum(c["bytes"] for c in cards),
                            "counties_with_documents": sum(1 for c in cards if c["documents"]),
                            "claims_pass": sum(c["score"]["pass"] for c in cards), "claims_fail": sum(c["score"]["fail"] for c in cards),
                            "claims_pending": sum(c["score"]["pending"] for c in cards)},
                 "counties": cards}
        tmp = STORE / "scoreboard.json.tmp"
        tmp.write_text(json.dumps(board, separators=(",", ":")))
        tmp.replace(STORE / "scoreboard.json")           # atomic: a reader never sees half a file
        # growth: one compact line per run in which any county's document count moved
        hist = STORE / "scoreboard-history.jsonl"
        counts = {c["fips"]: c["documents"] for c in cards}
        last = None
        for last in read_jsonl(hist):
            pass
        if last is None or last.get("counts") != counts:
            with hist.open("a") as f:
                f.write(json.dumps({"ts": board["built_at"], "total": board["totals"]["documents"], "counts": counts}, separators=(",", ":")) + "\n")
            lines = hist.read_text().splitlines()
            if len(lines) > HISTORY_KEEP:
                hist.write_text("\n".join(lines[-HISTORY_KEEP:]) + "\n")
        print(f"{board['built_at']} scoreboard: {board['totals']['documents']} docs, "
              f"{board['totals']['claims_pass']}P/{board['totals']['claims_fail']}F/{board['totals']['claims_pending']}? "
              f"in {time.time() - t0:.1f}s", flush=True)
        if not a.loop:
            break
        time.sleep(a.loop)


if __name__ == "__main__":
    main()
