"""Best-effort cross-reference between an ePAV contract and Nashville
Legistar legislation, keyed on the contracting party's name -- not either
system's own contract-number/file-number scheme.

Confirmed live 2026-09-26 before building this: raw ePAV contract numbers
(e.g. "16160") never appear anywhere in Legistar's MatterFile/MatterTitle,
so number-based matching is a dead end. A distinctive vendor name does find
real matches -- "MOTOROLA SOLUTIONS" finds 3 real Legistar matters,
including two that name Metro's own internal contract numbers, which are in
a completely different scheme than ePAV's. A short/generic name (e.g. "AYC"
after stripping the "LTD" suffix) produces false-positive substring
collisions inside unrelated legislation text, so every API hit here is
re-verified with a word-boundary regex on the real returned title before
being trusted -- the substring search alone is not enough.

This will come back empty for the large majority of small individual
contracts (most never went through Council legislation at all -- that's
the expected, correct answer, not a bug). Never claim a match is a
guaranteed link; it's a disclosed best-effort lookup."""

from __future__ import annotations

import re

_SUFFIX_RE = re.compile(r"\b(LLC|LTD|INC|CORP|CORPORATION|CO|LP|LLP|PLLC|PC|PLC)\b\.?", re.IGNORECASE)
MIN_DISTINCTIVE_LEN = 6  # below this, after suffix-stripping, a name is too generic to search safely


def _distinctive_core(name: str) -> str | None:
    core = _SUFFIX_RE.sub("", name or "").strip()
    core = re.sub(r"\s+", " ", core)
    if len(core) < MIN_DISTINCTIVE_LEN:
        return None
    return core


def _word_bounded(needle: str, haystack: str) -> bool:
    pat = re.compile(r"(?<![A-Za-z0-9])" + re.escape(needle) + r"(?![A-Za-z0-9])", re.IGNORECASE)
    return bool(pat.search(haystack or ""))


def legistar_matches_for(api, contracting_party: str) -> list[dict]:
    """`api` is a legistar_client.Legistar instance. Returns a (possibly
    empty) list of {matter_id, matter_file, matter_title, legistar_url}."""
    core = _distinctive_core(contracting_party)
    if not core:
        return []
    escaped = core.replace("'", "''")  # OData string-literal escaping
    try:
        hits = api._get("matters", **{"$filter": f"substringof('{escaped}', MatterTitle)"})
    except Exception:  # noqa: BLE001 - best-effort, never blocks the caller
        return []
    if not isinstance(hits, list):
        return []
    out = []
    seen_ids = set()
    for m in hits:
        if not _word_bounded(core, m.get("MatterTitle") or ""):
            continue
        mid = m.get("MatterId")
        if mid in seen_ids:
            continue
        seen_ids.add(mid)
        out.append({
            "matter_id": mid,
            "matter_file": m.get("MatterFile"),
            "matter_title": m.get("MatterTitle"),
            "legistar_url": api.detail_url(mid, m.get("MatterGuid") or ""),
        })
    return out


def epav_matches_for(api, contracting_party: str) -> list[dict]:
    """`api` is an epav_client.EPAV instance. Returns a (possibly empty)
    list of {contract_number, token, epav_url, department} -- the reverse
    direction, for a Legistar matter's own believed-organization surfaces."""
    core = _distinctive_core(contracting_party)
    if not core:
        return []
    try:
        rows = api.search(contracting_party=core)
    except Exception:  # noqa: BLE001 - best-effort, never blocks the caller
        return []
    out = []
    for row in rows:
        if not _word_bounded(core, row.get("contracting_party") or ""):
            continue
        out.append({
            "contract_number": row["contract_number"],
            "token": row["token"],
            "epav_url": api.detail_url(row["token"]),
            "department": row["department"],
        })
    return out
