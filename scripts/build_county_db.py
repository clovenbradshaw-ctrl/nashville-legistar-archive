#!/usr/bin/env python3
"""Derive the query index from the append-only logs. The DB is disposable:
delete it and this rebuilds it from the logs; nothing is ever written back.

Incremental by construction: `checkpoints` stores, per log file, the byte
offset already folded in (plus a hash of the file's first 4 KB so a rewritten
or truncated log is detected and re-read from 0, not silently skipped). A
daily run after one county's visit reads only that county's new bytes.

County is part of the *index*, not just a column: every FTS row carries a
`c<fips>` token, so `cty:c47003 AND bid*` is answered from the inverted index
at the same cost whether the corpus holds one county or ninety-five.

Sources folded in:
  data/counties/<slug>/manifest.jsonl   CountyDoc@1   (the county pull)
  data/epav-fetched.jsonl               Davidson/Metro (legacy, read-only)
"""
from __future__ import annotations

import argparse, hashlib, json, os, re, sqlite3, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))
import counties as C

STORE = Path(os.environ.get("COUNTY_STORE") or C.COUNTIES_DIR)
DEFAULT_DB = STORE / "county.sqlite"
LEGACY = C.ROOT / "data" / "epav-fetched.jsonl"

SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS docs(
  id INTEGER PRIMARY KEY, fips TEXT NOT NULL, county TEXT NOT NULL, src TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE, title TEXT, kind TEXT, number TEXT, party TEXT, dept TEXT,
  description TEXT, status TEXT, expires TEXT, bytes INTEGER, sha256 TEXT,
  found_on TEXT, fetched_at TEXT, file TEXT);
CREATE INDEX IF NOT EXISTS docs_county_recent ON docs(fips, id DESC);
CREATE INDEX IF NOT EXISTS docs_county_kind   ON docs(fips, kind, id DESC);
CREATE INDEX IF NOT EXISTS docs_sha          ON docs(sha256);
CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
  title, party, dept, number, description, cty, kd,
  content='docs', content_rowid='id', tokenize='unicode61 remove_diacritics 2', prefix='2 3');
CREATE TABLE IF NOT EXISTS county_stats(fips TEXT PRIMARY KEY, county TEXT, n_docs INTEGER, n_bytes INTEGER, last_fetch TEXT, coverage TEXT);
CREATE TABLE IF NOT EXISTS needs_human(fips TEXT, county TEXT, url TEXT, status TEXT, kind TEXT, noted TEXT, PRIMARY KEY(fips,url));
CREATE TABLE IF NOT EXISTS checkpoints(log TEXT PRIMARY KEY, off INTEGER, head TEXT);
"""

KIND_RULES = [
    ("minutes", r"minute"), ("agenda", r"agenda|packet"), ("award", r"award|tabulation|notice of intent"),
    ("bid", r"\bbid|rfp|rfq|rfi|solicit|invitation|proposal|procure"),
    ("contract", r"contract|agreement|lease|mou\b|amendment"),
    ("resolution", r"resolution|ordinance|motion"), ("budget", r"budget|appropriation"),
]


def kind_of(*parts) -> str:
    s = " ".join(p or "" for p in parts).lower()
    for k, rx in KIND_RULES:
        if re.search(rx, s): return k
    return "other"


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.executescript(SCHEMA)
    if "file" not in {r[1] for r in db.execute("PRAGMA table_info(docs)")}:
        db.execute("ALTER TABLE docs ADD COLUMN file TEXT")               # index predates on-device file serving
    if "coverage" not in {r[1] for r in db.execute("PRAGMA table_info(county_stats)")}:
        db.execute("ALTER TABLE county_stats ADD COLUMN coverage TEXT")   # index predates the operator log
    return db


def add(db, row: dict) -> bool:
    cur = db.execute(
        "INSERT OR IGNORE INTO docs(fips,county,src,url,title,kind,number,party,dept,description,status,expires,bytes,sha256,found_on,fetched_at,file)"
        " VALUES(:fips,:county,:src,:url,:title,:kind,:number,:party,:dept,:description,:status,:expires,:bytes,:sha256,:found_on,:fetched_at,:file)", row)
    if cur.rowcount != 1: return False
    db.execute("INSERT INTO docs_fts(rowid,title,party,dept,number,description,cty,kd) VALUES(?,?,?,?,?,?,?,?)",
               (cur.lastrowid, row["title"], row["party"], row["dept"], row["number"], row["description"],
                "c" + row["fips"], "k" + (row["kind"] or "other")))
    # running per-county totals: O(1) per row, so a daily run never re-counts the corpus
    db.execute("INSERT INTO county_stats(fips,county,n_docs,n_bytes,last_fetch) VALUES(?,?,1,?,?)"
               " ON CONFLICT(fips) DO UPDATE SET n_docs=n_docs+1, n_bytes=n_bytes+excluded.n_bytes,"
               " last_fetch=max(coalesce(last_fetch,''),coalesce(excluded.last_fetch,''))",
               (row["fips"], row["county"], row["bytes"] or 0, row["fetched_at"]))
    return True


def blank(**kw):
    base = dict(title=None, number=None, party=None, dept=None, description=None, status=None, expires=None,
                bytes=None, sha256=None, found_on=None, fetched_at=None, file=None)
    base.update(kw); return base


def from_county_doc(r: dict) -> dict:
    return blank(fips=r["fips"], county=r["county"], src="county-pull", url=r["url"],
                 title=r.get("title") or Path(r["url"]).name, kind=kind_of(r.get("title"), r["url"], r.get("seed_kind")),
                 bytes=r.get("bytes"), sha256=r.get("sha256"), found_on=r.get("found_on"), fetched_at=r.get("fetched_at"), file=r.get("file"))


def from_legacy(r: dict, reg: dict) -> dict:
    return blank(fips=reg["fips"], county=reg["county"], src="epav", url=r.get("epav_url") or r["epav_token"],
                 title=f"{r.get('contract_number','')} {r.get('contracting_party','')}".strip(),
                 kind="contract", number=r.get("contract_number"), party=r.get("contracting_party"),
                 dept=r.get("department"), description=r.get("description"), status=r.get("status"),
                 expires=r.get("expiration_date"), fetched_at=r.get("fetched_at"))


def fold(db, log: Path, conv, key: str, sink=None) -> int:
    """Fold one append-only log from its checkpoint. Only whole lines are consumed."""
    if not log.exists(): return 0
    size = log.stat().st_size
    with log.open("rb") as f:
        head = hashlib.sha256(f.read(4096)).hexdigest()
        row = db.execute("SELECT off, head FROM checkpoints WHERE log=?", (key,)).fetchone()
        off = row[0] if row and row[1] == head and row[0] <= size else 0
        f.seek(off); n = 0
        while True:
            line = f.readline()
            if not line.endswith(b"\n"): break          # partial tail: leave for next run
            off += len(line)
            try: rec = json.loads(line)
            except ValueError: continue
            n += (sink or add)(db, conv(rec))
    db.execute("INSERT OR REPLACE INTO checkpoints VALUES(?,?,?)", (key, off, head))
    return n


def apply_op(db, ev: dict) -> bool:
    """Fold one county operator event into the index. Only the latest coverage judgment is kept
    here; the full history stays in ops.jsonl, which is the record."""
    if ev.get("op") == "EVA" and (ev.get("content") or {}).get("criterion") == "machine_pullable_records":
        db.execute("INSERT INTO county_stats(fips,county,n_docs,n_bytes,last_fetch,coverage) VALUES(?,?,0,0,NULL,?)"
                   " ON CONFLICT(fips) DO UPDATE SET coverage=excluded.coverage", (ev["fips"], ev["county"], ev["content"]["result"]))
        # latest judgment replaces the queue for this county: a seed that now passes leaves it
        db.execute("DELETE FROM needs_human WHERE fips=?", (ev["fips"],))
        for sd in (ev["content"].get("evidence") or {}).get("seeds", []):
            if sd.get("tier") == "BLOCKED":
                db.execute("INSERT OR REPLACE INTO needs_human VALUES(?,?,?,?,?,?)",
                           (ev["fips"], ev["county"], sd["url"], str(sd.get("status")), sd.get("kind"), ev.get("ts")))
        return True
    return False


def refresh_stats(db):
    """Full recount -- a repair tool (--recount), not part of a normal run. Keeps coverage."""
    db.execute("UPDATE county_stats SET n_docs=0, n_bytes=0, last_fetch=NULL")
    db.execute("INSERT INTO county_stats(fips,county,n_docs,n_bytes,last_fetch)"
               " SELECT fips, county, count(*), coalesce(sum(bytes),0), max(fetched_at) FROM docs GROUP BY fips"
               " ON CONFLICT(fips) DO UPDATE SET n_docs=excluded.n_docs, n_bytes=excluded.n_bytes, last_fetch=excluded.last_fetch")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", type=Path, default=DEFAULT_DB)
    ap.add_argument("--no-legacy", action="store_true")
    ap.add_argument("--recount", action="store_true", help="recompute county_stats from docs (repair)")
    a = ap.parse_args()
    t0 = time.time()
    db = connect(a.db)
    regs = C.load()
    total = 0
    for reg in regs:
        if reg["legacy"]: continue
        n = fold(db, STORE / reg["slug"] / "manifest.jsonl", from_county_doc, f"{reg['slug']}/manifest.jsonl")
        db.commit(); total += n
    if not a.no_legacy:
        dav = next(r for r in regs if r["legacy"])
        total += fold(db, LEGACY, lambda r: from_legacy(r, dav), "legacy/epav-fetched.jsonl")
    for reg in regs:            # every county is a row, including the ones we hold nothing for yet
        db.execute("INSERT OR IGNORE INTO county_stats(fips,county,n_docs,n_bytes,last_fetch,coverage) VALUES(?,?,0,0,NULL,NULL)",
                   (reg["fips"], reg["county"]))
        fold(db, STORE / reg["slug"] / "ops.jsonl", lambda r: r, f"{reg['slug']}/ops.jsonl", sink=apply_op)
    for reg in regs:
        if reg["legacy"]:
            db.execute("UPDATE county_stats SET coverage='HAVE' WHERE fips=?", (reg["fips"],))
    if a.recount: refresh_stats(db)
    db.commit()
    db.execute("PRAGMA optimize")
    n_all = db.execute("SELECT count(*) FROM docs").fetchone()[0]
    print(f"+{total} docs this run ({n_all} total) in {time.time()-t0:.2f}s -> {a.db}")


if __name__ == "__main__":
    main()
