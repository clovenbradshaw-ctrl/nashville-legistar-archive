"""A believed-assertion log for organizations mentioned across Nashville's
Legistar corpus, and the fold that projects it into a browsable registry.

Every entry here is a BELIEVED ASSERTION, not a fact: something eoreader7's
own reading of one specific document claimed, with its giver and full
provenance back to that document's archive.org copy. This module never
mutates or summarizes anything in place -- it only ever appends to
data/assertions.jsonl (the source of truth) and, separately, FOLDS that log
fresh, on demand, into a company registry ("the page is a fold of the log
taken at a point," never itself stored as state that could drift from what
was actually logged). data/companies.json, when written, is only ever that
fold's full output, regenerated wholesale, labelled as derived.

WHY REF, NOT SURFACE (measured, not assumed): a real read of a real
Nashville contract split "Motorola Solutions, Inc." into THREE separate
occurrences with a single-word surface each ("Motorola", "Solutions",
"Inc") -- but eoreader7's own referent resolution gave two of them the
SAME multi-word ref, ref:auto:motorola_solutions, and gave "Inc" its own
bare ref:auto:inc. Filtering on the raw single-word surface against
ORG_SUFFIXES therefore matched "Solutions", "Inc", "Group", "Partners" as
if each were its own company -- confirmed as a real bug against that read,
not a hypothetical one. looks_like_org() now requires either a multi-word
surface, or a `ref:auto:...` whose slug has more than one underscore-
separated part -- a bare suffix word alone is never enough."""

from __future__ import annotations

import json
import re
import subprocess
import time
from pathlib import Path

# A declared table of organizational-name suffixes, never a tuned score.
ORG_SUFFIXES = (
    "inc", "llc", "corp", "corporation", "co", "company", "lp", "ltd",
    "solutions", "group", "partners", "pllc", "pc", "plc", "associates",
    "enterprises",
)

# A NARROWER table, legal-entity-type abbreviations only -- deliberately
# excludes generic business words ("Solutions", "Group", "Partners",
# "Associates", "Enterprises") that are legitimate SUBSTANCE of many real
# company names (Motorola Solutions, Omnia Partners), not a trailing legal
# fragment. Using the broader ORG_SUFFIXES table here was a real, measured
# bug: "Solutions" matched as a "bare suffix" on the Motorola Solutions/Inc
# edge too, firing the trivial-connector rule in BOTH directions and
# scrambling merges across the corpus (Omnia Partners' own assertions
# vanished as collateral damage). Only these are ever bare legal fragments.
LEGAL_SUFFIX_TOKENS = ("inc", "llc", "corp", "corporation", "co", "lp", "ltd", "pllc", "pc", "plc")

REASON_MJS = Path("/Users/mlacy/Documents/3.0/eoreader7/cli/reason.mjs")
ASSERTION_SCHEMA = "BelievedAssertion@1"
MAX_CLAIMS_PER_ORG_PER_LINT = 50  # a resource bound, not an accuracy threshold


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def _ref_parts(ref) -> list[str]:
    if not ref or not ref.startswith("ref:auto:"):
        return []
    return ref[len("ref:auto:"):].split("_")


def looks_like_org(surface: str, ref: str | None = None) -> bool:
    """True only when there is more than one word of evidence: a
    multi-word surface ending in an org suffix, or a ref whose slug has
    more than one part and ends in one. A bare "Inc"/"Solutions"/"Group"
    alone is never enough -- that was the real, measured bug."""
    parts = _ref_parts(ref)
    if len(parts) > 1:
        return parts[-1].rstrip(".,") in ORG_SUFFIXES
    words = _norm(surface).rstrip(".,;: ").lower().split()
    if len(words) > 1:
        return words[-1].rstrip(".,") in ORG_SUFFIXES
    return False


def canonical_org(surface: str, ref: str | None = None) -> str:
    """Prefer the ref's own multi-word slug (it already unified every
    occurrence eoreader7 itself judged to be the same referent) over the
    single-occurrence surface."""
    parts = _ref_parts(ref)
    if len(parts) > 1:
        return " ".join(w.capitalize() for w in parts)
    return _norm(surface)


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "org"


TRIVIAL_CONNECTORS = (",", "", "and")
_NUMBERED_REF = re.compile(r"^(.*):\d+$")


def self_merge_map(hyperedges: list[dict]) -> dict[str, str]:
    """Merges WE mint ourselves, on top of eoreader7's own, each backed by
    direct measured evidence -- never applied to guess at the genuinely
    uncertain case eoreader7 itself flagged as needing a supplied prior
    (bare "Motorola" binding to "Motorola Solutions"; left unmerged here).

    1. Trivial-connector rule: a hyperedge whose relation, stripped, is a
       bare connector (comma, nothing, "and") means its two ends are
       textually adjacent with nothing between them -- measured directly:
       the real edge "Motorola Solutions -- , --> Inc" has relation exactly
       ",". When one end's surface is exactly a bare org-suffix word, it
       folds into the other end's ref.
    2. Same-base-slug rule: eoreader7 mints "ref:auto:X:NNN" when a later
       occurrence looks like the same name but it wasn't confident enough
       to merge automatically (confirmed real: motorola_solutions:150 and
       motorola_solutions share the identical base). Folded into the bare
       base ref when one exists in this same read.
    """
    merges: dict[str, str] = {}
    all_refs = set()
    for e in hyperedges:
        for k in ("end1_ref", "end2_ref"):
            if e.get(k):
                all_refs.add(e[k])

    for e in hyperedges:
        rel = (e.get("relation") or "").strip()
        if rel in TRIVIAL_CONNECTORS:
            for suf_key, other_key in (("end1", "end2"), ("end2", "end1")):
                surf = _norm(e.get(f"{suf_key}_surface")).rstrip(".,").lower()
                suf_ref, other_ref = e.get(f"{suf_key}_ref"), e.get(f"{other_key}_ref")
                if surf in LEGAL_SUFFIX_TOKENS and suf_ref and other_ref and suf_ref != other_ref:
                    merges[suf_ref] = other_ref

    for ref in all_refs:
        m = _NUMBERED_REF.match(ref or "")
        if m and m.group(1) in all_refs:
            merges[ref] = m.group(1)

    return merges


def _resolve_through(ref, merges: dict[str, str]):
    seen = set()
    while ref in merges and ref not in seen:
        seen.add(ref)
        ref = merges[ref]
    return ref


def append_assertions(log_path: Path, hyperedges: list[dict], context: dict, giver: str) -> int:
    """context: {matter_id, attachment_id, archive_url, legistar_url,
    intro_date}. Pure append -- never reads or rewrites the log. Returns
    how many BelievedAssertion@1 lines were appended."""
    merges = self_merge_map(hyperedges)
    self_giver = "nashville-legistar-archive/company_index.py: self_merge_map (trivial-connector + same-base-slug rules)"
    added = 0
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a") as fh:
        for edge in hyperedges:
            # Both ends must be resolved referents, not just the org side --
            # measured against real data: pairing a resolved entity with
            # whatever unresolved noun-phrase fragment fell on the hyperedge's
            # other end ("proposal", "Agency", "corporation") was the actual
            # source of the noisy, not-meaningful satellite nodes.
            if edge.get("end1_standing") != "referent" or edge.get("end2_standing") != "referent":
                continue
            r1 = _resolve_through(edge.get("end1_ref"), merges)
            r2 = _resolve_through(edge.get("end2_ref"), merges)
            if r1 and r2 and r1 == r2:
                continue  # both ends folded into the same entity -- no longer says anything
            resolved = {**edge, "end1_ref": r1, "end2_ref": r2}
            for org_key, other_key in (("end1", "end2"), ("end2", "end1")):
                surface = resolved.get(f"{org_key}_surface")
                ref = resolved.get(f"{org_key}_ref")
                if not surface or not looks_like_org(surface, ref):
                    continue
                self_merged = ref != edge.get(f"{org_key}_ref")
                fh.write(json.dumps({
                    "schema": ASSERTION_SCHEMA,
                    "subject": canonical_org(surface, ref),
                    "subject_surface": surface,
                    "subject_ref": ref,
                    "relation": resolved.get("relation"),
                    "object": resolved.get(f"{other_key}_surface"),
                    "object_ref": resolved.get(f"{other_key}_ref"),
                    "giver": self_giver if self_merged else giver,
                    "source": {**context, "at": edge.get("at")},
                    "recorded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }) + "\n")
                added += 1
    return added


def verify_assertions(assertions: list[dict], text_by_key: dict) -> dict:
    """Conformance gate, same spirit as nashville-plans-surface.md's own
    rule ('every ledger ref resolves to non-null verbatim'): for every
    assertion carrying a byte span, slice [start,end] out of the actual
    document text and confirm it's real, non-empty text -- never trust the
    span without checking it. `text_by_key` maps a source key to full
    document text -- `source["doc_key"]` when the source set one (any
    non-Legistar source, e.g. ePAV's "epav:<token>"), else the original
    (matter_id, attachment_id) tuple so existing Legistar-shaped sources
    keep working unchanged. Returns {resolved, unresolved, no_span, bad[]}."""
    resolved = unresolved = no_span = 0
    bad = []
    for a in assertions:
        src = a.get("source") or {}
        at = src.get("at")
        if not at or at[0] is None or at[1] is None:
            no_span += 1
            continue
        key = src.get("doc_key") or (src.get("matter_id"), src.get("attachment_id"))
        text = text_by_key.get(key)
        if text is None:
            unresolved += 1
            bad.append({"subject": a.get("subject"), "reason": "no cached text for source", "key": key})
            continue
        start, end = at
        snippet = text[start:end] if 0 <= start < end <= len(text) else ""
        if snippet.strip():
            resolved += 1
        else:
            unresolved += 1
            bad.append({"subject": a.get("subject"), "reason": "span resolved empty/out of range", "at": at, "len": len(text)})
    return {"resolved": resolved, "unresolved": unresolved, "no_span": no_span, "bad": bad[:20]}


def read_assertions(log_path: Path) -> list[dict]:
    if not log_path.exists():
        return []
    out = []
    with log_path.open() as fh:
        for line in fh:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


FOLD_SAMPLE_SIZE = 5  # a resource bound on the fold's per-company sample, not an accuracy threshold


def fold_companies(assertions: list[dict], *, sample_size: int = FOLD_SAMPLE_SIZE) -> dict:
    """The fold: groups the raw log by canonical subject. first_seen/
    last_seen/mentions are computed from the log every time this runs --
    never stored, so they can never drift from what was actually logged.

    BOUNDED SIZE, on purpose: this used to keep entry['assertions'] = every
    single assertion for that subject, which makes the on-disk snapshot
    grow as large as the raw log itself -- at tens of thousands of records
    that defeats the point of a small index. Only `mentions` (a count) and
    a capped `sample` of assertions are kept per company; full detail
    always stays in the real source of truth, data/assertions.jsonl, which
    is expected to grow with corpus size -- the fold does not have to."""
    registry: dict[str, dict] = {}
    for a in assertions:
        entry = registry.setdefault(a["subject"], {"mentions": 0, "sample": [], "_dates": []})
        entry["mentions"] += 1
        if len(entry["sample"]) < sample_size:
            entry["sample"].append(a)
        date = a["source"].get("intro_date")
        if date:
            entry["_dates"].append(date)
    for entry in registry.values():
        dates = entry.pop("_dates")
        entry["first_seen"] = min(dates) if dates else None
        entry["last_seen"] = max(dates) if dates else None
    return registry


def write_companies_snapshot(path: Path, registry: dict, *, derived_from: str) -> None:
    """A convenience view only -- always the fold's full, fresh output,
    never partially patched. Explicitly labelled as derived, never a
    record itself."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({
        "_derived_from": derived_from,
        "_generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "_note": "A fold of the append-only log, not a record itself. Every assertion is a belief eoreader7's reading attributed to one document, not a verified fact -- see source.archive_url on each one.",
        "companies": registry,
    }, indent=1, sort_keys=True))


def build_lint_spec(registry: dict) -> dict:
    """One GFP claim per sampled assertion (grounded at /companies/<org>),
    plus one arrow-of-time 'order' item chain per company with 2+ dated
    occurrences: its own occurrences, chronologically. A reversed or
    corrupted date shows up as a cycle reason.mjs's own check catches --
    not a number anyone tuned. Reads from fold_companies()'s bounded
    `sample`, not every assertion ever logged -- lint is a spot-check on
    the index, not a full audit; the full log stays in assertions.jsonl."""
    claims, items, before, order_claims = [], [], [], []
    cid = 0
    for org, entry in registry.items():
        ground = f"/companies/{_slug(org)}"
        dated = sorted((a for a in entry["sample"] if a["source"].get("intro_date")), key=lambda a: a["source"]["intro_date"])
        for a in dated[:MAX_CLAIMS_PER_ORG_PER_LINT]:
            cid += 1
            claims.append({
                "ground": ground,
                "rel": a["relation"] or "relates-to",
                "roles": {"ARG0": org, "ARG1": a.get("object") or "?"},
                "polarity": "+",
                "force": "default",
                "id": f"c{cid}",
                "said": f"{org} -- {a['relation']} -- {a.get('object')} (matter {a['source'].get('matter_id')}, {a['source'].get('intro_date')}, giver {a.get('giver')})",
            })
        if len(dated) >= 2:
            tags = [f"{org}@{a['source']['intro_date']}#{i}" for i, a in enumerate(dated)]
            items.extend(tags)
            before.extend([tag_a, tag_b] for tag_a, tag_b in zip(tags, tags[1:]))
            order_claims.append({"ref": f"order-{_slug(org)}", "first": tags[0], "then": tags[-1]})
    spec = {"claims": claims}
    if items:
        spec["order"] = {"items": items, "before": before, "claims": order_claims}
    return spec


def run_lint(spec: dict, spec_path: Path, *, timeout: int = 60) -> dict:
    """subprocess-runs cli/reason.mjs on `spec`, unpiped, so its own
    writeReasoningRecord call still lands on eoreader7's permanent
    reasoning-record ledger regardless of who called it. Best-effort:
    {"ok": False, "error": ...} rather than raising, on any failure."""
    try:
        spec_path.parent.mkdir(parents=True, exist_ok=True)
        spec_path.write_text(json.dumps(spec))
        proc = subprocess.run(
            ["node", str(REASON_MJS), str(spec_path), "--json"],
            capture_output=True, text=True, timeout=timeout,
        )
        return json.loads(proc.stdout)
    except Exception as e:  # noqa: BLE001 - best-effort, never blocks the backfill
        return {"ok": False, "error": str(e)}
