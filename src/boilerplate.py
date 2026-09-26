"""Page-level boilerplate detection across the whole corpus.

The same page text recurs, verbatim, across many Nashville Legistar
documents -- a cooperative-purchasing resolution's statutory WHEREAS
clauses, say. Full eoreader7 resolution is only worth paying for the FIRST
time a page's exact text is ever seen; every later sighting is an appended
"shadow" pointer to that first read, never a fresh full read and never a
second stored copy of the boilerplate text itself.

Append-only, same discipline as company_index.py: data/page-sightings.jsonl
is the only source of truth (one PageSighting@1 line per page, every time,
never mutated); load_index() FOLDS it into a hash -> {count, first_seen}
index once per run. Refolding the whole log on every single page would get
slower as the corpus grows, so classify_pages() updates that same in-memory
index incrementally as new pages are seen within the run -- the log stays
authoritative across runs, the index is just a cache of its fold."""

from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path

SIGHTING_SCHEMA = "PageSighting@1"


def page_hash(text: str) -> str:
    norm = re.sub(r"\s+", " ", (text or "").strip().lower())
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()


def load_index(sightings_path: Path) -> dict[str, dict]:
    """Folds the append-only sightings log into hash -> {count, first_seen}."""
    index: dict[str, dict] = {}
    if not sightings_path.exists():
        return index
    with sightings_path.open() as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            s = json.loads(line)
            entry = index.setdefault(s["hash"], {"count": 0, "first_seen": s["context"]})
            entry["count"] += 1
    return index


def append_sighting(sightings_path: Path, h: str, context: dict) -> None:
    sightings_path.parent.mkdir(parents=True, exist_ok=True)
    with sightings_path.open("a") as fh:
        fh.write(json.dumps({
            "schema": SIGHTING_SCHEMA,
            "hash": h,
            "context": context,
            "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }) + "\n")


def classify_pages(pages: list[str], index: dict[str, dict], context: dict) -> tuple[list[str], list[dict]]:
    """Updates `index` in place. Returns (novel_pages_text, per_page_records).
    A page is novel -- gets a full eoreader7 read -- only the first time its
    exact hash is seen (in this run or any prior one, via the folded index);
    every later sighting is a shadow record pointing at that first-seen
    context, with a running seen_count."""
    novel_pages, records = [], []
    for i, page in enumerate(pages):
        h = page_hash(page)
        entry = index.setdefault(h, {"count": 0, "first_seen": None})
        is_first = entry["count"] == 0
        if is_first:
            entry["first_seen"] = context
        entry["count"] += 1
        if is_first:
            novel_pages.append(page)
            records.append({"index": i, "hash": h, "status": "novel"})
        else:
            records.append({
                "index": i, "hash": h, "status": "shadow",
                "shadow_of": entry["first_seen"], "seen_count": entry["count"],
            })
    return novel_pages, records
