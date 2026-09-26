"""Run the eoreader7 reading pipeline (installed globally as `eoreader7`)
over extracted document text, and pull out its subject-relation-object
assertions (EOHyperedge@1) -- eoreader7's own "what is what" ledger."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import Optional

EOREADER7 = "eoreader7"


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "doc"


def read_document(text: str, name: str, workdir: Path, *, timeout: int = 600, limit: Optional[int] = 1500) -> Optional[dict]:
    """Writes `text` to workdir/<slug>.txt, runs the eoreader7 CLI, and
    returns {"main": <EOReader7CLIRead@1 dict>, "main_path", "fold_path",
    "log_path"}. None on any failure -- missing binary, timeout, bad JSON --
    so a failed read never blocks archiving.

    `limit` caps the eoreader7 CLI's own --limit (encounters read), a
    disclosed tradeoff: a real 573,576-character Nashville contract
    attachment took over 5 minutes inside eoreader7's reading pipeline with
    no OCR running, so an unbounded read on the largest outliers would
    stall a backfill of thousands of documents. Pass limit=None for no cap."""
    workdir.mkdir(parents=True, exist_ok=True)
    slug = _slug(name)
    txt_path = workdir / f"{slug}.txt"
    txt_path.write_text(text or " ")
    cmd = [EOREADER7, str(txt_path), "--out", str(workdir)]
    if limit is not None:
        cmd += ["--limit", str(limit)]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True, text=True, timeout=timeout,
        )
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None
    if proc.returncode != 0:
        return None
    read_path = workdir / f"{slug}.eoreader7.json"
    if not read_path.exists():
        return None
    try:
        main = json.loads(read_path.read_text())
    except json.JSONDecodeError:
        return None
    return {
        "main": main,
        "main_path": read_path,
        "fold_path": workdir / f"{slug}.eoreader7.fold.json",
        "log_path": workdir / f"{slug}.eoreader7.log.json",
    }


def _canonical_map(graph_entries: list[dict]) -> dict[str, str]:
    """eoreader7 mints referents freely and folds them together LATER as
    evidence accumulates (EOReferentMerge@1: kept <- folded[*]) -- it never
    rewrites earlier occurrences to use the kept id (measured directly: a
    folded id kept appearing dozens of times elsewhere in the same read
    after its own merge record). A consumer has to apply the merge itself.
    Chains (A folded into B, B later folded into C) are followed to their
    end; a span is not a referent, and neither is one merge record --
    identity here is whatever the chain of mint/merge facts resolves to."""
    parent = {}
    for e in graph_entries:
        if e.get("schema") != "EOReferentMerge@1":
            continue
        kept = e.get("kept")
        for folded in e.get("folded") or []:
            if kept and folded:
                parent[folded] = kept

    def resolve(ref):
        seen = set()
        while ref in parent and ref not in seen:
            seen.add(ref)
            ref = parent[ref]
        return ref

    return {folded: resolve(folded) for folded in parent}


def _encounter_anchors(log_path: Optional[Path]) -> dict[int, list[int]]:
    """sequencePosition -> [start, end], the ABSOLUTE byte span (into the
    source .txt) each encounter covers, from the sibling .log.json's
    Encounter@1 entries. Verified against real data: sequencePosition 7 ->
    {start:594,end:907} in nashville-legistar-att-40781.txt, exactly the
    sentence a real hyperedge citing that sequencePosition came from. This
    is the same file#start-end addressing cli/holograph.mjs's parseRef/
    resolveSnippet/snipAt already use elsewhere -- reused, not invented."""
    if not log_path or not log_path.exists():
        return {}
    try:
        log = json.loads(log_path.read_text())
    except json.JSONDecodeError:
        return {}
    anchors = {}
    for e in log:
        if e.get("schema") == "Encounter@1" and "sequencePosition" in e and e.get("anchor"):
            a = e["anchor"]
            anchors[e["sequencePosition"]] = [a.get("start"), a.get("end")]
    return anchors


def hyperedges_of(main: dict, log_path: Optional[Path] = None) -> list[dict]:
    """Every EOHyperedge@1 entry in a read's graph, as a compact
    subject-relation-object record. This is eoreader7's own assertion
    ledger: `relation` is the predicate; end1/end2 are its two participants,
    each with the surface form actually witnessed and, once resolved, a
    stable `ref` (e.g. "ref:auto:metropolitan_nashville_department") --
    canonicalized through any EOReferentMerge@1 records in the same read.
    When `log_path` is given, each edge also carries `at`: the ABSOLUTE
    [start, end] byte span of the encounter it came from, in the source
    .txt -- a real, verbatim-checkable citation, not a bare claim."""
    entries = main.get("holograph", {}).get("graphEntries", [])
    canon = _canonical_map(entries)
    anchors = _encounter_anchors(log_path)
    out = []
    for e in entries:
        if e.get("schema") != "EOHyperedge@1":
            continue
        participants = e.get("participants") or []
        ends = {p.get("role"): p for p in participants}
        end1, end2 = ends.get("end1"), ends.get("end2")
        if not end1 or not end2:
            continue
        r1, r2 = end1.get("ref"), end2.get("ref")
        seq = (e.get("scope") or {}).get("sequencePosition")
        out.append({
            "relation": e.get("relation"),
            "end1_surface": end1.get("surface"),
            "end1_ref": canon.get(r1, r1),
            "end1_standing": end1.get("standing"),
            "end2_surface": end2.get("surface"),
            "end2_ref": canon.get(r2, r2),
            "end2_standing": end2.get("standing"),
            "at": anchors.get(seq),
        })
    return out


def summarize_referents(result: dict, *, max_surfaces: int = 40) -> dict:
    """A compact, git-friendly slice of a read: counts, the deduplicated
    surface forms (referents) the document mentions, and its hyperedges --
    never the full multi-megabyte graph."""
    main = result["main"]
    holograph = main.get("holograph", {})
    surfaces, seen = [], set()
    for entry in holograph.get("graphEntries", []):
        sk = entry.get("surfaceKey") or entry.get("surface")
        if sk and sk not in seen:
            seen.add(sk)
            surfaces.append(entry.get("surface") or sk)
        if len(surfaces) >= max_surfaces:
            break
    return {
        "schema": main.get("schema"),
        "encounters": main.get("declared", {}).get("encounters"),
        "relationEdges": holograph.get("relationEdges"),
        "referentBindings": holograph.get("referentBindings"),
        "chainSites": holograph.get("chainSites"),
        "surfaces": surfaces,
        "hyperedges": hyperedges_of(main, result.get("log_path")),
    }
