#!/usr/bin/env python3
"""Falsify the claim "the county database stays fast at 95x what we have today".

Method (so a pass means something):
  * Corpus: every real row we hold today (Davidson/ePAV, ~4.4k) replicated across
    all 95 counties = the user's pessimistic "95x everything" case, built into the
    same schema the real index uses (build_county_db.add), not a toy table.
  * Queries are drawn, seeded, from the corpus's own vocabulary -- common and rare
    terms -- never hand-picked words that happen to be quick.
  * Budgets are perceptual, not tuned to pass: a response should land well inside
    the ~100 ms "instant" band once a mobile round trip is added, so the SERVER
    budget is p95 <= 50 ms. First-page payload budget: <= 20 KB uncompressed.
  * A POSITIVE CONTROL runs beside the real arms: a naive LIKE '%q%' scan of the
    whole corpus. If the control does NOT blow the budget, the harness is blind
    and its verdict is void -- that outcome is reported, not hidden.
  * A NULL arm times what the pipeline does today (linear scan of the jsonl per
    lookup) at 1x and extrapolates to 95x, so "better" has a reference.
Writes data/counties/FALSIFY-95x.json (small, committed evidence).
"""
from __future__ import annotations

import json
import random
import re
import sqlite3
import statistics
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "scripts"))
import counties as C
import build_county_db as B
import county_query_server as S

SCALE = 95
BUDGET_P95_MS = 50.0
BUDGET_FIRST_PAGE_BYTES = 20 * 1024
N = 150


def build_replica(path: Path, rows: list[dict], regs: list[dict]) -> dict:
    db = B.connect(path)
    t0 = time.time()
    dav = next(r for r in regs if r["legacy"])
    base = [B.from_legacy(r, dav) for r in rows]
    with db:
        for reg in regs:
            batch = []
            for b in base:
                x = dict(b)
                x["fips"], x["county"] = reg["fips"], reg["county"]
                x["src"] = "replica"
                x["url"] = f'{b["url"]}#{reg["fips"]}'
                batch.append(x)
            db.executemany(
                "INSERT INTO docs(fips,county,src,url,title,kind,number,party,dept,description,status,expires,bytes,sha256,found_on,fetched_at)"
                " VALUES(:fips,:county,:src,:url,:title,:kind,:number,:party,:dept,:description,:status,:expires,:bytes,:sha256,:found_on,:fetched_at)",
                batch)
        db.execute("INSERT INTO docs_fts(rowid,title,party,dept,number,description,cty,kd)"
                   " SELECT id,title,party,dept,number,description,'c'||fips,'k'||coalesce(kind,'other') FROM docs")
    B.refresh_stats(db)
    db.commit()
    db.execute("PRAGMA optimize")
    n = db.execute("SELECT count(*) FROM docs").fetchone()[0]
    db.close()
    return {"rows": n, "build_s": round(time.time() - t0, 2), "db_mb": round(path.stat().st_size / 1e6, 1)}


def vocab(rows):
    words = {}
    for r in rows:
        for f in ("contracting_party", "description", "department"):
            for w in re.findall(r"[A-Za-z]{4,}", r.get(f) or ""):
                words[w.lower()] = words.get(w.lower(), 0) + 1
    common = [w for w, c in sorted(words.items(), key=lambda x: -x[1])[:60]]
    rare = [w for w, c in words.items() if c <= 3]
    return common, rare


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))]


def timed(url):
    t = time.perf_counter()
    with urllib.request.urlopen(url, timeout=30) as r:
        body = r.read()
    return (time.perf_counter() - t) * 1000, len(body)


def run_shape(name, urls):
    lat, sizes = [], []
    for u in urls:
        ms, n = timed(u)
        lat.append(ms)
        sizes.append(n)
    return {"shape": name, "n": len(lat), "p50_ms": round(pct(lat, 50), 2), "p95_ms": round(pct(lat, 95), 2),
            "p99_ms": round(pct(lat, 99), 2), "max_ms": round(max(lat), 2), "median_bytes": int(statistics.median(sizes)),
            "max_bytes": max(sizes)}


def main():
    regs = C.load()
    rows = [json.loads(l) for l in open(ROOT / "data" / "epav-fetched.jsonl")]
    rng = random.Random(7)
    common, rare = vocab(rows)
    tmp = Path(tempfile.mkdtemp(prefix="county95x-"))
    dbp = tmp / "county95x.sqlite"
    built = build_replica(dbp, rows, regs)
    print("built", built, flush=True)

    svc = S.Svc(dbp)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), S.make_handler(svc))
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{port}/api"
    fips = [r["fips"] for r in regs]
    mid_id = built["rows"] // 2

    def term(kind):
        w = rng.choice(common if kind == "common" else rare)
        return w[: max(3, len(w) - rng.randint(0, 2))]      # sometimes a prefix, as typed live

    shapes = {
        "counties_list": [f"{base}/counties"] * N,
        "browse_county_first_page": [f"{base}/search?county={rng.choice(fips)}&limit=25" for _ in range(N)],
        "browse_county_deep_keyset": [f"{base}/search?county={rng.choice(fips)}&after={rng.randint(5000, built['rows'])}&limit=25" for _ in range(N)],
        "search_county_common": [f"{base}/search?q={term('common')}&county={rng.choice(fips)}" for _ in range(N)],
        "search_county_rare": [f"{base}/search?q={term('rare')}&county={rng.choice(fips)}" for _ in range(N)],
        "search_all_counties_common": [f"{base}/search?q={term('common')}" for _ in range(N)],
        "search_all_counties_rare": [f"{base}/search?q={term('rare')}" for _ in range(N)],
        "search_county_relevance_top50": [f"{base}/search?q={term('common')}&county={rng.choice(fips)}&sort=relevance&limit=50" for _ in range(N)],
        "search_all_relevance_falls_back": [f"{base}/search?q={term('common')}&sort=relevance&limit=50" for _ in range(N)],
        "kind_filter_county": [f"{base}/search?county={rng.choice(fips)}&kind=contract" for _ in range(N)],
        "kind_filter_all_counties": [f"{base}/search?kind=contract&q={term('common')}" for _ in range(N)],
        "two_word_all_counties": [f"{base}/search?q={term('common')}+{term('common')}" for _ in range(N)],
    }
    for u in [f"{base}/counties", f"{base}/search?q={common[0]}", f"{base}/search?county={fips[0]}"]:
        timed(u)                                   # warm: first touch of the file/page cache is not the steady state
    cold_note = "first-touch costs excluded from shapes below; a cold phone request pays one extra disk read, not a scan"
    results = [run_shape(k, v) for k, v in shapes.items()]
    for r in results:
        r["budget_ok"] = r["p95_ms"] <= BUDGET_P95_MS and r["max_bytes"] <= BUDGET_FIRST_PAGE_BYTES
        print(r, flush=True)

    # concurrency: 8 clients at once, mixed shapes
    pool_urls = [u for v in shapes.values() for u in v[:40]]
    rng.shuffle(pool_urls)
    t0 = time.perf_counter()
    errs = 0
    lat = []
    def hit(u):
        nonlocal errs
        try:
            lat.append(timed(u)[0])
        except Exception:
            errs += 1
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(hit, pool_urls))
    conc = {"clients": 8, "requests": len(pool_urls), "errors": errs, "p95_ms": round(pct(lat, 95), 2),
            "wall_s": round(time.perf_counter() - t0, 2)}
    conc["budget_ok"] = errs == 0 and conc["p95_ms"] <= BUDGET_P95_MS * 3   # 8 contending clients: 3x headroom stated
    print("concurrency", conc, flush=True)

    # POSITIVE CONTROL: a naive scan on a term that forces a FULL scan (rare: few matches, so
    # LIMIT never exits early -- a common word would early-exit and make the control look fast,
    # which is exactly how the first run of this harness went blind). Must blow the budget.
    c = sqlite3.connect(f"file:{dbp}?mode=ro", uri=True)
    ctl = []
    for _ in range(10):
        w = rng.choice(rare)
        t = time.perf_counter()
        c.execute("SELECT id,title FROM docs WHERE title LIKE ? OR description LIKE ? ORDER BY id DESC LIMIT 25",
                  (f"%{w}%", f"%{w}%")).fetchall()
        ctl.append((time.perf_counter() - t) * 1000)
    control = {"shape": "CONTROL naive LIKE scan", "p50_ms": round(pct(ctl, 50), 1), "p95_ms": round(pct(ctl, 95), 1)}
    control["blows_budget"] = control["p95_ms"] > BUDGET_P95_MS
    print(control, flush=True)

    # NULL arm: what runs today -- linear scan of the whole jsonl for one token
    token = rows[len(rows) // 2]["epav_token"]
    t = time.perf_counter()
    for _ in range(5):
        with open(ROOT / "data" / "epav-fetched.jsonl") as fh:
            for line in fh:
                if f'"epav_token": "{token}"' in line:
                    break
    one_x = (time.perf_counter() - t) / 5 * 1000
    null_arm = {"shape": "NULL today: linear jsonl scan per lookup", "ms_1x": round(one_x, 2), "ms_95x_extrapolated": round(one_x * SCALE, 1)}
    print(null_arm, flush=True)

    # incremental index: one new row on top of 414k should cost ~nothing
    log = tmp / "x" / "manifest.jsonl"
    log.parent.mkdir()
    dav = next(r for r in regs if not r["legacy"])
    rec = lambda i: json.dumps({"county": dav["county"], "fips": dav["fips"], "url": f"https://x.test/{i}.pdf", "title": f"doc {i}", "seed_kind": "legislation", "fetched_at": "2026-10-13T00:00:00Z"}) + "\n"
    log.write_text("".join(rec(i) for i in range(100)))
    db = B.connect(dbp)
    B.fold(db, log, B.from_county_doc, "t/manifest.jsonl"); db.commit()
    with log.open("a") as f:
        f.write(rec(101))
    t = time.perf_counter()
    n_new = B.fold(db, log, B.from_county_doc, "t/manifest.jsonl"); db.commit()
    inc = {"new_rows_folded": n_new, "ms": round((time.perf_counter() - t) * 1000, 1), "corpus_rows": built["rows"] + 101}

    verdict = {
        "all_shapes_within_budget": all(r["budget_ok"] for r in results),
        "concurrency_within_budget": conc["budget_ok"],
        "control_blew_budget_so_harness_can_see_slowness": control["blows_budget"],
    }
    out = {"schema": "Falsify95x@1", "scale": SCALE, "budgets": {"server_p95_ms": BUDGET_P95_MS, "first_page_bytes": BUDGET_FIRST_PAGE_BYTES},
           "built": built, "shapes": results, "concurrency": conc, "control": control, "null_arm": null_arm,
           "incremental_index": inc, "verdict": verdict, "ran_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    (C.COUNTIES_DIR / "FALSIFY-95x.json").write_text(json.dumps(out, indent=1))
    print("incremental", inc)
    print("VERDICT", verdict)
    print("replica db kept at", dbp)


if __name__ == "__main__":
    main()
