"""Autonomous learning for the pipeline: standing rules, derived rules,
learned corrections, and a dead-ends refusal list.

Mirrors The Fold's own learning stores, small and domain-loaded:

- data/learning/rules.json -- standing rules per problem TYPE (the content
  rules layer, keyed by the signal that made the work hard; each carries a
  falsifying control; a preservation that names no falsifier is REFUSED;
  a rule is sharpened, never duplicated, never deleted).
- data/learning/derived-rules.json -- operational recurrence rules keyed
  "class:probe", minted only after a floor of recurrences, carrying a control
  and a half-life; a proteasome pass concedes rules that outlived their
  evidence instead of letting them stand forever.
- data/learning/corrections.jsonl -- append-only caught-and-corrected pairs;
  only the positive corrected statement is handed back (learned.js).
- data/learning/refusals.jsonl -- measured dead ends not to retry (the
  NEXT-PASSES pattern).

A rule is only ever what survived the runs that could have killed it.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
L_DIR = ROOT / "data" / "learning"
RULES = L_DIR / "rules.json"
DERIVED = L_DIR / "derived-rules.json"
CORRECTIONS = L_DIR / "corrections.jsonl"
REFUSALS = L_DIR / "refusals.jsonl"

DERIVED_FLOOR = 3
DERIVED_HALF_LIFE_MS = 7 * 24 * 3600 * 1000

# The probe classes the pipeline currently knows how to turn into derived
# rules. A recurrence whose class has no declared control is NOT mintable --
# that is the heimdall wall (deriveRule refuses a class with no template).
DERIVED_TEMPLATES = {
    ("enumeration", "capped_residual_recur"): {
        "control": "a re-enumeration of the same shard returns under the cap with every token already held",
        "rule": "a shard keeps hitting the 1000-row cap even after a full re-enumeration -- recurse deeper or surface it",
    },
    ("extraction", "empty_text"): {
        "control": "a re-extraction of the same pdf yields non-empty text",
        "rule": "a non-destroyed contract keeps coming back with empty extracted text -- route it to OCR/second-pass reading",
    },
    ("deletion", "missing_home"): {
        "control": "the token is found in either the archive.org manifest or as a local pdf",
        "rule": "a fetched token with neither an upload record nor its local pdf means the deletion policy ran before the durable home was recorded",
    },
    ("upload", "503_rate"): {
        "control": "the same upload succeeds on a later run under backoff",
        "rule": "archive.org throttles this account/credential -- keep the two-phase drain queue and slow the batch",
    },
}


def _load(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _save(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(path)


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ---- standing rules ------------------------------------------------------
def preserve_rule(*, type_: str, signal: str, read: str, falsifying: str, giver: str, basis: str | None = None) -> dict:
    L_DIR.mkdir(parents=True, exist_ok=True)
    rules = _load(RULES, {})
    if not falsifying:
        return {"refused": {"type": "no_falsifier"}}
    prior = rules.get(type_)
    now = now_iso()
    if prior is None:
        rules[type_] = {
            "type": type_, "signal": signal, "read": read, "falsifying": falsifying,
            "basis": basis, "giver": giver, "standing": "disclosed",
            "firstAdoptedAt": now, "lastSharpenAt": now,
        }
        _save(RULES, rules)
        return {"adopted": rules[type_]}
    # sharpen only if strictly more specific (names the signal AND extends)
    more_specific = signal and prior.get("signal") != signal and len(read) > len(prior.get("read") or "")
    if falsifying != prior.get("falsifying"):
        prior["falsifying"] = falsifying  # a new control sharpens the rule
    if more_specific:
        prior["read"] = read
        prior["signal"] = signal
        prior["lastSharpenAt"] = now
    _save(RULES, rules)
    return {"stands": prior}


def standing_rules() -> dict:
    return _load(RULES, {})


# ---- derived rules (recurrence + proteasome) -----------------------------
def observe(class_: str, probe: str, *, at_ms: int | None = None) -> dict:
    """One recurrence of class:probe. Mintes a derived rule once the floor is
    cleared and the class has a declared control; otherwise only tallies."""
    L_DIR.mkdir(parents=True, exist_ok=True)
    now_ms = at_ms if at_ms is not None else int(time.time() * 1000)
    key = f"{class_}:{probe}"
    derived = _load(DERIVED, {})
    ent = derived.get(key, {"class": class_, "probe": probe, "count": 0,
                            "first_ms": now_ms, "last_ms": now_ms, "standing": "observed"})
    ent["count"] += 1
    ent["last_ms"] = now_ms
    if ent.get("first_ms") is None:
        ent["first_ms"] = now_ms
    derived[key] = ent
    _save(DERIVED, derived)

    tpl = DERIVED_TEMPLATES.get((class_, probe))
    if ent["standing"] in ("adopted", "conceded"):
        return ent
    if ent["count"] < DERIVED_FLOOR:
        return ent
    if not tpl:
        return ent
    ent["standing"] = "adopted"
    ent["rule"] = tpl["rule"]
    ent["control"] = tpl["control"]
    ent["adoptedAt"] = now_iso()
    _save(DERIVED, derived)
    return ent


def proteasome(*, now_ms: int | None = None) -> list[dict]:
    """Concede adopted rules that outlived their evidence: no recurrence in
    the window since adoption. A conceded rule stays on the record -- it WAS
    a rule -- but no longer stands.""" 
    L_DIR.mkdir(parents=True, exist_ok=True)
    now_ms = now_ms if now_ms is not None else int(time.time() * 1000)
    derived = _load(DERIVED, {})
    conceded = []
    for key, ent in derived.items():
        if ent.get("standing") != "adopted":
            continue
        age = now_ms - int(ent.get("adopted_ms", ent.get("last_ms") or 0))
        # an adopted rule is re-earned when recurrences keep arriving; a rule
        # whose last recurrence predates the half-life is no longer evidenced
        if age >= DERIVED_HALF_LIFE_MS and not ent.get("recurrences_since_adopt"):
            ent["standing"] = "conceded"
            ent["concededReason"] = "proteasome: rule outlived its evidence"
            ent["concededAt"] = now_iso()
            conceded.append(ent)
    _save(DERIVED, derived)
    return conceded


def derived_rules() -> dict:
    return _load(DERIVED, {})


# ---- corrections (learned.js pattern) ------------------------------------
def record_correction(*, claimed: str, corrected: str, caught: str, ref: str) -> dict:
    """Append-only caught-and-corrected record. Handed back later ONLY as the
    positive corrected statement -- never by naming the false thing (learned.js:
    'a draft that named the false claim capitulated to it')."""
    L_DIR.mkdir(parents=True, exist_ok=True)
    line = {
        "schema": "LearnedCorrection@1",
        "claimed": claimed, "corrected": corrected, "caught": caught, "ref": ref,
        "recorded_at": now_iso(),
    }
    with CORRECTIONS.open("a") as f:
        f.write(json.dumps(line) + "\n")
    return line


# ---- dead-ends refusal list ----------------------------------------------
def record_refusal(*, strategy: str, why: str, falsifying: str) -> dict:
    if not falsifying:
        return {"refused": {"type": "no_falsifier"}}
    L_DIR.mkdir(parents=True, exist_ok=True)
    line = {
        "schema": "MeasuredRefusal@1", "strategy": strategy, "why": why,
        "falsifying": falsifying, "recorded_at": now_iso(),
    }
    with REFUSALS.open("a") as f:
        f.write(json.dumps(line) + "\n")
    return line


if __name__ == "__main__":
    print(json.dumps({"rules": standing_rules(), "derived": derived_rules()}, indent=2))