"""Flags whether an archived document involves surveillance technology,
using the proven classifier from the sibling legistar-surveillance-scanner
project (real goldens, tuned lexicons, a documented anti-false-positive
CORE-ANCHOR rule) -- reused directly via sys.path, never forked/copied, so
this repo never drifts from the maintained original.

WHY THE FULL SURFACE SET, NOT THE CAPPED SUMMARY (measured, not assumed):
this repo's own summarize_referents() caps surfaces at 40 for a small,
git-friendly referents.jsonl. Fed that capped list, the classifier scored
RS2026-2264 (Motorola Solutions cooperative agreement) at 1.5, "background".
Fed the FULL 2,403 distinct surfaces from the same cached read, it scored
60.4, "surveillance" -- matching the scanner's own documented golden case
for this exact matter. The 40-surface cap was silently discarding the very
terms ("surveillance", "video") this whole project cares about most. The
fix here: compute the verdict from the FULL, uncapped read every time, but
store only the small bounded verdict -- never the full surface list -- so
the index stays small without losing the signal that actually matters."""

from __future__ import annotations

import sys
from pathlib import Path

_SCANNER_SRC = "/Users/mlacy/Documents/3.0/legistar-surveillance-scanner/src"
if _SCANNER_SRC not in sys.path:
    sys.path.insert(0, _SCANNER_SRC)
import classify  # noqa: E402


def flag_document(main: dict, *, title: str, text: str, file: str) -> dict:
    """`main` is the full EOReader7CLIRead@1 dict (not the capped summary).
    Returns a small, bounded verdict -- never the full surface list."""
    entries = main.get("holograph", {}).get("graphEntries", [])
    all_surfaces = sorted({e.get("surfaceKey") or e.get("surface") for e in entries if e.get("surfaceKey") or e.get("surface")})
    verdict = classify.classify_surfaces(
        all_surfaces,
        title=title or "",
        text=text or "",
        relation_edges=main.get("holograph", {}).get("relationEdges", 0),
        n_entries=len(entries),
        file=file,
    )
    return {
        "file": verdict.file,
        "label": verdict.label,
        "score": verdict.score,
        "evidence": verdict.evidence[:15],  # a resource bound, not an accuracy threshold
        "giver": "legistar-surveillance-scanner/src/classify.py:classify_surfaces",
    }


def flag_title(title: str, *, file: str = "") -> dict:
    """The cheap title-only screen -- no eoreader7 read needed."""
    verdict = classify.classify_title(title or "", file=file)
    return {
        "file": verdict.file,
        "label": verdict.label,
        "score": verdict.score,
        "evidence": verdict.evidence,
        "giver": "legistar-surveillance-scanner/src/classify.py:classify_title",
    }
