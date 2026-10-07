"""Human summaries for the live feed -- turn a raw LiveEvent@1 (or the whole
ledger state) into prose that actually explains what's going on.

event_summary(kind, data) renders one event as a sentence. state_summary()
reads the on-disk ledgers the way the QC does and returns a current
"what's going on" picture: counts, phase, open gaps, verdicts, learned
rules, latest events -- enough for the feed page to speak like a status
report instead of a JSON dump.
"""

from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _cnt(path: Path) -> int:
    try:
        return sum(1 for _ in open(path))
    except OSError:
        return 0


def _jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out = []
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line:
                    out.append(json.loads(line))
    except (OSError, json.JSONDecodeError):
        pass
    return out


def _now_local(iso: str) -> str:
    try:
        from datetime import datetime
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone().strftime("%H:%M:%S")
    except ValueError:
        return iso


def event_summary(ev: dict) -> str:
    kind = ev.get("kind", "")
    d = {k: v for k, v in ev.items() if k not in ("schema", "kind", "at")}
    t = _now_local(ev.get("at", ""))
    tok = d.get("epav_token", "")
    num = d.get("contract_number", "")
    dept = d.get("department", "") or d.get("subject", "")
    c = f"contract {num}" if num else f"token {tok}"
    dpt = f" ({dept})" if dept and dept != num else ""

    if kind == "fetched":
        return f"[{t}] Pulled {c} from {dept or 'ePAV'}: PDF + extracted text + eoreader7 read staged locally; waiting for upload."
    if kind == "destroyed-stub":
        return f"[{t}] {c}{dpt} is a records-destruction stub (destroyed per GRS 102/RDA 287) — kept as the official record of its destruction."
    if kind == "gap":
        return f"[{t}] Enumeration gap: a search shard for {d.get('subject', 'an unknown shard')} is still capped at 1000 rows and can't be subdivided further — surfaced, never silently dropped."
    if kind == "uploaded":
        return f"[{t}] Uploaded {c} to archive.org: {d.get('archive_url', 'item')} recorded in the manifest."
    if kind == "dropped-local-pdf":
        return f"[{t}] archive.org confirmed {c} — local PDF deleted; the durable copy now lives remotely."
    if kind == "missing-home":
        return f"[{t}] DATA-INVARIANT VIOLATION for {c}: no manifest record AND no local PDF. No durable copy exists. Surfaced to QC (durable_home)."
    if kind == "upload-failed":
        return f"[{t}] Upload of {c} failed: {str(d.get('error',''))[:100]} — left queued, retried next drain."
    if kind == "fetch-failed":
        return f"[{t}] Fetch of a document failed: {str(d.get('error',''))[:100]} — skipped, enumeration retries."
    if kind == "qc":
        return f"[{t}] QC grade {d.get('grade','?')} on {d.get('check','check')} for {d.get('subject','')} ({d.get('n',0)} finding(s))." + (" Needs attention." if d.get("grade") in ("defect", "suspicious") else " Clean.")
    if kind == "qc-run":
        return f"[{t}] QC run done: {d.get('checks',0)} checks, {d.get('defects',0)} defect(s), {d.get('suspicious',0)} suspicious."
    if kind == "verdict":
        v = d.get("standing", "?")
        return f"[{t}] Completeness verdict for {d.get('subject','')}: {v} ({d.get('reason','')})."
    if kind == "falsify-run":
        cts = ", ".join(f"{k}={v}" for k, v in d.items() if k in ("complete", "incomplete", "contested", "unexamined"))
        return f"[{t}] Falsification round finished: {cts}."
    if kind == "legislation":
        return f"[{t}] Legistar: matter {d.get('matter_file','')} is {d.get('change','changed')} — the associated legislation moved."
    if kind == "roundup":
        top = list(d.get("departments", {}).items())[:3]
        vtops = list(d.get("vendors", {}).items())[:3]
        return (f"[{t}] ROUNDUP ({d.get('range','')}/{d.get('hours','')}h): "
                f"acquired {d.get('contracts',0)} contract(s), uploaded {d.get('uploaded',0)}. "
                f"Departments: {', '.join(f'{k} ({v})' for k, v in top) or 'none'}. "
                f"Vendors: {', '.join(f'{k} ({v})' for k, v in vtops) or 'none'}.")
    if kind == "snapshot":
        return f"[{t}] State snapshot: {d.get('prose','')}"
    return f"[{t}] {kind}: {json.dumps(d)[:200]}"


def _iso_dt(s: str | None):
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except ValueError:
        return None


def period_summary(name: str, hours: int, *, root: Path | None = None) -> dict:
    """Contracts over a given period: how many were acquired (fetched_at) and
    uploaded (archived_at) in the window, split by department and vendor, and
    bucketed by day. 'fWhat about contracts over a period' -- answered from
    the recorded ledgers, never guessed."""
    root = Path(root) if root else ROOT
    q = lambda *p: root.joinpath("data", *p)
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)

    fetched = [r for r in _jsonl(q("epav-fetched.jsonl"))
               if (dt := _iso_dt(r.get("fetched_at"))) and dt >= cutoff]
    uploaded = [m for m in _jsonl(q("epav-manifest.jsonl"))
                if (dt := _iso_dt(m.get("archived_at"))) and dt >= cutoff]

    deps = Counter((r.get("department") or "?") for r in fetched)
    vendors = Counter((r.get("contracting_party") or "?") for r in fetched)
    by_day: dict[str, int] = {}
    for r in fetched:
        day = (r.get("fetched_at") or "")[:10]
        if day:
            by_day[day] = by_day.get(day, 0) + 1

    return {
        "range": name, "hours": hours,
        "contracts": len(fetched), "uploaded": len(uploaded),
        "departments": dict(deps.most_common(8)),
        "vendors": dict(vendors.most_common(10)),
        "by_day": dict(sorted(by_day.items())),
    }


def state_summary(root: Path | None = None) -> dict:
    root = Path(root) if root else ROOT
    q = lambda *p: root.joinpath("data", *p)

    fetched = _cnt(q("epav-fetched.jsonl"))
    uploaded = _cnt(q("epav-manifest.jsonl"))
    deployed = len([p for p in q("deployed").iterdir()]) if q("deployed").is_dir() else 0
    gaps = _jsonl(q("gaps.jsonl"))
    open_gaps = [g for g in gaps if g.get("kind") == "capped-shard"]
    verdicts = _jsonl(q("verdicts.jsonl"))
    vc = Counter(v.get("standing") for v in verdicts[-8000:]) if verdicts else {}
    qc = _jsonl(q("qc", "reports.jsonl"))
    qc_grades = Counter(r.get("grade") for r in qc[-8000:])
    events = _jsonl(q("live", "events.jsonl"))
    rules = {}
    try:
        rules = json.loads((q("learning", "derived-rules.json")).read_text()) if q("learning", "derived-rules.json").exists() else {}
    except (OSError, json.JSONDecodeError):
        rules = {}
    adopted = [v for v in rules.values() if v.get("standing") == "adopted"]
    conceded = [v for v in rules.values() if v.get("standing") == "conceded"]
    changes = _cnt(q("legislation", "changes.jsonl"))

    if not fetched:
        phase = "booting — the first exhaustive enumeration has not produced documents yet"
    elif uploaded < fetched:
        phase = f"fetching faster than uploading: {fetched - uploaded} contract(s) staged locally, waiting on the archive.org drain"
    else:
        phase = "in sync: everything fetched has been uploaded to archive.org"

    prose = [
        f"Held {fetched} contract(s) in the ledger; {uploaded} uploaded to archive.org ({deployed} with small files staged for GitHub). {phase}.",
    ]
    if open_gaps:
        prose.append(f"{len(open_gaps)} unresolved enumeration gap(s) — completeness verdicts will stay contested until they close.")
    elif fetched:
        prose.append("No unresolved enumeration gaps: every capped shard has been subdivided to the point of disclosure.")
    if vc:
        prose.append("Completeness verdicts: " + ", ".join(f"{k} {v}" for k, v in vc.items()) + ".")
    if qc_grades:
        worst = "clean" if not qc_grades.get("defect") and not qc_grades.get("suspicious") else "flagging problems"
        prose.append(f"Last QC pass: {worst} ({qc_grades.get('ok',0)} ok, {qc_grades.get('suspicious',0)} suspicious, {qc_grades.get('defect',0)} defects).")
    if adopted:
        prose.append(f"The pipeline has learned {len(adopted)} rule(s) from recurring problems (e.g. {adopted[0].get('class','')}:{adopted[0].get('probe','')}); {len(conceded)} rule(s) conceded by the proteasome as no longer evidenced.")
    if changes:
        prose.append(f"{changes} legislation change(s) tracked from Legistar.")

    return {
        "counts": {"fetched": fetched, "uploaded": uploaded, "deployed": deployed,
                   "gaps": len(open_gaps), "legislation_changes": changes},
        "phase": phase,
        "verdicts": dict(vc),
        "qc": dict(qc_grades),
        "rules": {"adopted": len(adopted), "conceded": len(conceded)},
        "prose": prose,
        "latest": [event_summary(ev) for ev in events[-5:]],
    }