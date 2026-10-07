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
        if d.get("standing") == "unexamined":
            if d.get("subject") == "MULTIPLE":
                return (f"[{t}] {d.get('n_unexamined', len(d.get('departments', [])))} department(s) "
                        f"not examined yet (nothing pulled from them — not counted complete).")
            return f"[{t}] Not examined yet: {d.get('subject','')} — nothing pulled from it, so it can't be called complete."
        v = d.get("standing", "?")
        if v == "complete":
            return f"[{t}] Scanned {d.get('subject','')} — every token the portal still shows we already hold. Lower bound checks out."
        if v == "incomplete":
            return f"[{t}] {d.get('subject','')} has holes ({d.get('reason','')})."
        return f"[{t}] {d.get('subject','')} is {v}: {d.get('reason','')}."
    if kind == "falsify-run":
        cts = ", ".join(f"{k}={v}" for k, v in d.items() if k in ("complete", "incomplete", "contested", "unexamined"))
        return f"[{t}] Falsification round finished: {cts}."
    if kind == "legislation":
        return f"[{t}] Legistar: matter {d.get('matter_file','')} is {d.get('change','changed')} — the associated legislation moved."
    if kind == "roundup":
        top = list(d.get("departments", {}).items())[:3]
        vtops = list(d.get("vendors", {}).items())[:3]
        return (f"[{t}] Roundup — last {d.get('hours', d.get('range','?'))}h: pulled {d.get('contracts',0)} contract(s), "
                f"archived {d.get('uploaded',0)}. Busiest departments: " +
                (", ".join(f"{k.lower()} ({v})" for k, v in top) or "none") + ". "
                f"Top vendors: " + (", ".join(f"{k.lower()} ({v})" for k, v in vtops) or "none") + ".")
    if kind == "snapshot":
        return f"[{t}] State snapshot: {d.get('prose','')}"
    if kind == "missing":
        return (f"[{t}] Missing check {d.get('department','')}: {d.get('standing','?')} — "
                f"{d.get('missing',0)} contract(s) the portal still shows we don't hold yet.")
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

    fetched_rows = _jsonl(q("epav-fetched.jsonl"))
    man_tokens = {m.get("epav_token") for m in _jsonl(q("epav-manifest.jsonl"))}
    staged = len(fetched_rows)                      # the current VM queue
    pending = sum(1 for r in fetched_rows if (r.get("epav_token") or "") not in man_tokens)
    uploaded = len(man_tokens)                       # all-time archive.org manifest
    deployed = len([p for p in q("deployed").iterdir()]) if q("deployed").is_dir() else 0

    # The processing ladder: pulled -> archived -> read -> small-files-on-GitHub.
    # "Fully processed" = the whole circle: PDF on archive.org (manifest) AND the
    # deployed set is complete (extracted text + eoreader7 read) on GitHub.
    read_done = 0
    full_ids: set[str] = set()
    deployed_dir = q("deployed")
    if deployed_dir.is_dir():
        for d in deployed_dir.iterdir():
            if not d.is_dir():
                continue
            if (d / "eoreader7.json").is_file():
                read_done += 1
            if (d / "eoreader7.json").is_file() and (d / "extracted-text.txt").is_file():
                full_ids.add(d.name)
    man_ids = {f"nashville-epav-contract-{t}" for t in man_tokens if t}
    fully_processed = len(man_ids & full_ids)
    gaps = _jsonl(q("gaps.jsonl"))
    open_gaps = [g for g in gaps if g.get("kind") == "capped-shard"]
    verdicts = _jsonl(q("verdicts.jsonl"))
    vc = Counter()
    if verdicts:
        latest_v = {}
        for v in verdicts[-20000:]:
            latest_v[v.get("subject")] = v.get("standing")
        vc = Counter(latest_v.values())
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

    missing = {}
    try:
        from missing import latest_per_department
        md = list(latest_per_department().values())
        missing_total = sum(r.get("missing", 0) for r in md if r.get("standing") == "incomplete")
        missing = {
            "standing_counts": dict(Counter(r.get("standing") for r in md)),
            "missing_total": missing_total,
            "top_departments": [
                {"department": r.get("department"), "missing": r.get("missing", 0), "standing": r.get("standing")}
                for r in sorted(md, key=lambda x: -(x.get("missing") or 0))[:8]
                if r.get("missing")
            ],
            # every department, not just the top handful -- the audit answers
            # "ALL departments" (unexamined = not crawled yet, not zero)
            "all_departments": [
                {"department": r.get("department"), "missing": r.get("missing", 0), "standing": r.get("standing")}
                for r in sorted(md, key=lambda x: (-(x.get("missing") or 0), x.get("department")))
            ],
        }
    except Exception:  # noqa: BLE001 - the summary survives a missing-module failure
        missing = {}

    try:
        p24 = period_summary("24h", 24)
    except Exception:  # noqa: BLE001
        p24 = {"contracts": 0, "uploaded": 0, "departments": {}, "vendors": {}, "by_day": {}}

    if not fetched_rows:
        phase = "booting — the first exhaustive enumeration has not produced documents yet"
    elif pending:
        phase = f"we're pulling faster than archive.org can take it right now ({pending} staged)"
    else:
        phase = "in sync: everything staged has been archived"

    pulled_accounted = uploaded + pending  # all-time: every archived one + what's staged today
    prose = [
        f"Where we are: {pulled_accounted} contracts pulled all-time "
        f"({uploaded} archived on archive.org, {deployed} small-file sets on GitHub — earlier sessions' work included); "
        f"{pending} staged and waiting on the drain. In the last 24h: {p24['contracts']} pulled, {p24['uploaded']} archived. {phase}.",
    ]
    if open_gaps:
        prose.append(
            f"{len(open_gaps)} department(s) still sit behind the portal's 1,000-row search wall "
            f"(the enumeration gaps) — completeness stays contested there until the deep lane subdivides past the cap."
        )
    if vc:
        prose.append(
            "Completeness verdicts across departments: "
            + ", ".join(f"{vc.get(k, 0)} {k}" for k in ("complete", "incomplete", "contested", "unexamined"))
            + " (unexamined means not crawled yet — never counted as a pass)."
        )
    if qc_grades:
        worst = "clean" if not qc_grades.get("defect") and not qc_grades.get("suspicious") else "flagging problems"
        prose.append(f"Last QC pass: {worst} ({qc_grades.get('ok',0)} clean, {qc_grades.get('suspicious',0)} suspicious, {qc_grades.get('defect',0)} defect).")
    if adopted:
        prose.append(f"The pipeline has learned {len(adopted)} rule(s) from recurring problems; {len(conceded)} conceded by the proteasome as no longer evidenced.")
    if changes:
        prose.append(f"{changes} legislation change(s) tracked from Legistar.")
    prose.append(
        f"Processing ladder: {fully_processed} of {pulled_accounted} pulled are fully processed — "
        f"PDF archived on archive.org, text extracted, read by eoreader7, small files on GitHub "
        f"({uploaded} archived, {read_done} read)."
    )
    if missing:
        mt = missing.get("missing_total", 0)
        tops = missing.get("top_departments", [])
        if tops:
            prose.append(
                f"Missing: recount found {mt} contract(s) the portal still shows that we don't hold yet — "
                + "; ".join(f"{d['department']} −{d['missing']}" for d in tops) + ". Every count is a concrete lower bound; caps are declared, never hidden."
            )
        else:
            prose.append(f"Missing: {mt} contract(s) surfaced by the recount — every studied department is complete or unexamined.")
    oversight = _jsonl(q("oversight", "actions.jsonl"))
    if oversight:
        prose.append(f"Self-healing: {len(oversight)} oversight action(s) on record (restart/ream/timer arms, fetch pauses on disk pressure) — each with a falsifying control.")
    prose.append("Note: every total here is the live picture at this moment — they grow as the crawl discovers and archives more contracts.")

    return {
        "counts": {"fetched": staged, "staged": staged, "pending": pending,
                   "uploaded": uploaded, "pulled_accounted": pulled_accounted,
                   "deployed": deployed, "read_done": read_done,
                   "fully_processed": fully_processed,
                   "gaps": len(open_gaps), "legislation_changes": changes,
                   "missing_total": missing.get("missing_total", 0)},
        "phase": phase,
        "verdicts": dict(vc),
        "qc": dict(qc_grades),
        "rules": {"adopted": len(adopted), "conceded": len(conceded)},
        "missing": missing,
        "last24h": {"pulled": p24.get("contracts", 0), "archived": p24.get("uploaded", 0)},
        "oversight": {"n": len(oversight), "latest": oversight[-6:]},
        "prose": prose,
        "latest": [event_summary(ev) for ev in events[-5:]],
    }