"""Operators and the fold, for the county records.

A county's state is never stored; it is the fold of its append-only log.

  manifest.jsonl  CountyDoc@1 rows. Each one IS an INS at Figure: a document came
                  into being for this county. They are not copied into the ops log;
                  `events()` reads them as INS so there is one record, not two.
  ops.jsonl       every other operator event for the county: DEF (a reading of a
                  document or source), CON (document -> vendor / page / document),
                  SEG (document -> a kind partition), EVA (a judgment, e.g. the
                  coverage probe's verdict on whether this county has a pullable
                  source), REC (the county's frame changed: a platform migration).

An event carries `op` and `grain` and nothing else about where it lands. Terrain and
stance are DERIVED from (op, grain) by the kernel's cube (`cellOf`), never typed here,
so they cannot disagree. This module does not judge events; scripts/eo_check_county_ops.mjs
asks the real kernel. The fold below only enforces the helix's dependency order (nothing
is defined, connected, segmented or evaluated before it exists) and records violations
instead of dropping them.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Iterable, Iterator

import counties as C

STORE = Path(os.environ.get("COUNTY_STORE") or C.COUNTIES_DIR)
OPS = ("NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC")
GRAINS = ("Ground", "Figure", "Pattern")


def doc_anchor(fips: str, url: str) -> str:
    """Content-addressed and idempotent: the same document of the same county is the same entity."""
    return "doc_" + hashlib.sha256(f"{fips}\0{url}".encode()).hexdigest()[:16]


def county_anchor(fips: str) -> str:
    return f"county_{fips}"


def _reg(slug: str) -> dict:
    return C.by_slug()[slug]


def ops_path(slug: str) -> Path:
    return STORE / slug / "ops.jsonl"


def emit(slug: str, op: str, grain: str, anchor: str | None = None, **content) -> dict:
    if op not in OPS:
        raise ValueError(f"not an operator: {op}")
    if grain not in GRAINS:
        raise ValueError(f"not a grain: {grain}")
    reg = _reg(slug)
    p = ops_path(slug)
    p.parent.mkdir(parents=True, exist_ok=True)
    ev = {"schema": "CountyOp@1", "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
          "county": reg["county"], "fips": reg["fips"], "op": op, "grain": grain, "anchor": anchor, "content": content}
    with p.open("a") as f:
        f.write(json.dumps(ev, separators=(",", ":")) + "\n")
    return ev


def count_inserts(slug: str) -> int:
    m = STORE / slug / "manifest.jsonl"
    if not m.exists():
        return 0
    with m.open("rb") as f:
        return sum(1 for _ in f)


def events(slug: str) -> Iterator[dict]:
    """INS events (from the manifest) then operator events (from ops.jsonl), in log order."""
    m = STORE / slug / "manifest.jsonl"
    if m.exists():
        for line in m.open():
            try:
                r = json.loads(line)
            except ValueError:
                continue
            yield {"op": "INS", "grain": "Figure", "anchor": doc_anchor(r["fips"], r["url"]), "ts": r.get("fetched_at", ""),
                   "county": r["county"], "fips": r["fips"], "content": {"entity_type": "county_doc", "payload": r}}
    p = ops_path(slug)
    if p.exists():
        for line in p.open():
            try:
                yield json.loads(line)
            except ValueError:
                continue


def initial(slug: str | None = None) -> dict:
    return {"entities": {}, "partitions": {}, "links": [], "evaluations": {}, "frames": [], "violations": [], "n_events": 0}


def dispatch(state: dict, ev: dict) -> dict:
    op, a, c = ev["op"], ev.get("anchor"), ev.get("content", {})
    state["n_events"] += 1
    rooms = a is not None and a.startswith("county_")        # the county room exists by registry, not by INS
    if op == "INS":
        state["entities"].setdefault(a, {"payload": c.get("payload", {}), "fields": {}, "partition": None, "evals": []})
    elif op in ("DEF", "SEG", "EVA") and a is not None and a not in state["entities"] and not rooms:
        state["violations"].append({"op": op, "anchor": a, "why": "missing_ins"})
    elif op == "DEF":
        if rooms:
            state.setdefault("room", {})[c.get("path", "?")] = c.get("value")
        else:
            state["entities"][a]["fields"][c.get("path", "?")] = c.get("value")
    elif op == "SEG":
        state["entities"][a]["partition"] = c.get("partition")
        state["partitions"].setdefault(c.get("partition"), set()).add(a)
    elif op == "EVA":
        rec = {"result": c.get("result"), "evidence": c.get("evidence"), "ts": ev.get("ts")}
        state["evaluations"][(a, c.get("criterion"))] = rec          # latest verdict wins; history stays in the log
        if not rooms:
            state["entities"][a]["evals"].append(c.get("criterion"))
    elif op == "CON":
        s, t = c.get("source_anchor"), c.get("target_anchor")
        if any(x not in state["entities"] and not (x or "").startswith("county_") for x in (s, t)):
            state["violations"].append({"op": op, "anchor": s, "why": "missing_ins"})
        else:
            state["links"].append((s, t, c.get("relation_type")))
    elif op == "REC":
        state["frames"].append({"scope": c.get("scope"), "before": c.get("before_frame"), "after": c.get("after_frame"), "ts": ev.get("ts")})
    return state


def fold(evs: Iterable[dict], state: dict | None = None) -> dict:
    s = state if state is not None else initial()
    for ev in evs:
        dispatch(s, ev)
    return s


def county_state(slug: str) -> dict:
    return fold(events(slug))


def coverage(state: dict, fips: str) -> dict | None:
    """The county's current judged coverage: the latest EVA of criterion machine_pullable_records."""
    return state["evaluations"].get((county_anchor(fips), "machine_pullable_records"))
