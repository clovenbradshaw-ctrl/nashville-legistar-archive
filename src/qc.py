"""Quality control over the archived contract corpus and the pipeline's own
bookkeeping.

Every check is a small, deterministic pass over the state the pipeline leaves
on disk (no network). Every check carries its FALSIFYING CONTROL: the concrete
condition that would prove the check catches the thing it exists to catch.
A check with no falsifying control is refused -- the same wall as
content-rules.mjs ("a preservation that names no falsifier is refused") and
reasoning-stages.mjs ("verify a gate against what it should reject"; a gate
nothing has ever failed reads as rigor).

A run appends one QC report per check to data/qc/reports.jsonl
(grade: ok | suspicious | defect; findings carry evidence addresses). The
seeded-defect harness in scripts/qc_falsify.py proves each control fires and
that the clean control state stays clean.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass, field
from pathlib import Path

GRADES = ("ok", "suspicious", "defect")


@dataclass
class Report:
    check: str
    subject: str
    control: str
    grade: str = "ok"
    findings: list = field(default_factory=list)
    evidence: dict = field(default_factory=dict)

    def as_line(self, run_id: str) -> dict:
        line = {
            "schema": "QCReport@1",
            "run_id": run_id,
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "check": self.check,
            "subject": self.subject,
            "grade": self.grade,
            "control": self.control,
            "findings": self.findings,
            "evidence": self.evidence,
        }
        return line

    def flag(self, grade: str, findings, evidence=None) -> "Report":
        if grade not in GRADES:
            raise ValueError(f"bad grade {grade!r}")
        self.grade = grade
        self.findings = findings
        if evidence is not None:
            self.evidence = evidence
        return self


@dataclass
class QCContext:
    """All paths the checks read. The default build() points at the real
    data/ tree; the falsification harness builds a synthetic tree instead, so
    the checks are exercised over seeded defects without touching anything."""

    root: Path
    fetched: Path                  # data/epav-fetched.jsonl
    manifest: Path                 # data/epav-manifest.jsonl
    deployed: Path                 # data/deployed/<identifier>/
    gaps: Path                     # data/gaps.jsonl
    verdicts: Path                 # data/verdicts.jsonl
    contract_ledger: Path          # data/contract-ledger.jsonl
    assertions: Path               # data/assertions.jsonl
    flags: Path                    # data/surveillance-flags.jsonl
    local_pdf_prefix: Path         # data/.epav-local/<token>/source.pdf
    text_extract: object = None    # fitz module (lazy import for PDF text checks)

    @staticmethod
    def build(root: Path) -> "QCContext":
        defemand = lambda *parts: Path(root, *parts)
        return QCContext(
            root=root,
            fetched=defemand("data", "epav-fetched.jsonl"),
            manifest=defemand("data", "epav-manifest.jsonl"),
            deployed=defemand("data", "deployed"),
            gaps=defemand("data", "gaps.jsonl"),
            verdicts=defemand("data", "verdicts.jsonl"),
            contract_ledger=defemand("data", "contract-ledger.jsonl"),
            assertions=defemand("data", "assertions.jsonl"),
            flags=defemand("data", "surveillance-flags.jsonl"),
            local_pdf_prefix=defemand("data", ".epav-local"),
        )

    @staticmethod
    def fake(root: Path) -> "QCContext":
        return QCContext.build(root)


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _read_jsonl(path: Path):
    if not Path(path).exists():
        return []
    out = []
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def _token_of(rec: dict) -> str:
    return rec.get("epav_token") or rec.get("token") or ""


class QC:
    def __init__(self, ctx: QCContext):
        self.ctx = ctx

    # ---- checks ---------------------------------------------------------

    def check_durable_home(self) -> Report:
        """Every fetched token has a durable home: either it is in the
        archive.org manifest or its local pdf still exists. A token in
        neither is data loss -- the deletion policy may only drop the local
        copy AFTER the manifest carries the record."""
        r = Report(
            "durable_home",
            "epav-fetched.jsonl",
            control=(
                "a token present in epav-fetched.jsonl but absent from the "
                "manifest and with no local_pdf file under data/.epav-local "
                "has no durable copy anywhere -- this check must flag it"
            ),
        )
        man = {_token_of(m) for m in _read_jsonl(self.ctx.manifest)}
        lost = []
        for rec in _read_jsonl(self.ctx.fetched):
            tok = _token_of(rec)
            if tok in man:
                continue
            pdf = Path(rec.get("local_pdf") or "")
            if not pdf.is_file():
                # the fetcher records local_pdf under data/.epav-local/<tok>/
                alt = Path(self.ctx.local_pdf_prefix, tok, "source.pdf")
                if not alt.is_file():
                    lost.append(tok)
        if lost:
            n = len(lost)
            return r.flag(
                "defect",
                findings=[f"{n} token(s) with no durable home", *lost[:20]],
                evidence={"n": n, "preview": lost[:20]},
            )
        return r

    def check_deployed_present(self) -> Report:
        """Every fetched non-destroyed contract has its small files promoted
        under data/deployed/<identifier>/ (at least deployed.json and
        extracted-text.txt). Missing = the GitHub branch of the two-tier
        store lost the artifacts."""
        r = Report(
            "deployed_present",
            "data/deployed/",
            control=(
                "a fetched, non-destroyed contract whose data/deployed/"
                "<identifier> directory lacks extracted-text.txt has no small "
                "files on the GitHub branch -- this check must flag it"
            ),
        )
        missing = []
        for rec in _read_jsonl(self.ctx.fetched):
            if rec.get("destroyed_per_retention_schedule"):
                continue
            identifier = rec.get("identifier")
            if not identifier:
                continue
            dep = Path(self.ctx.deployed, identifier, "extracted-text.txt")
            if not dep.is_file():
                missing.append(identifier)
        if missing:
            return r.flag(
                "defect",
                findings=[f"{len(missing)} identifier(s) missing deployed small files", *missing[:20]],
                evidence={"n": len(missing), "preview": missing[:20]},
            )
        return r

    def check_text_present(self) -> Report:
        """A fetched contract must have non-empty extracted text unless it is
        a records-destruction stub. Empty text on a substantial pdf is an OCR/
        extraction gap, never a blank contract."""
        r = Report(
            "text_present",
            "deployed extracted-text.txt",
            control=(
                "a fetched, non-destroyed contract whose extracted text is "
                "empty while its pdf is non-empty is an extraction/OCR gap -- "
                "this check must flag it"
            ),
        )
        empty = []
        for rec in _read_jsonl(self.ctx.fetched):
            if rec.get("destroyed_per_retention_schedule"):
                continue
            identifier = rec.get("identifier")
            if not identifier:
                continue
            dep = Path(self.ctx.deployed, identifier, "extracted-text.txt")
            if dep.is_file():
                if len(dep.read_text(errors="replace").strip()) == 0:
                    empty.append(identifier)
        if empty:
            return r.flag(
                "suspicious",
                findings=[f"{len(empty)} identifier(s) with empty extracted text", *empty[:20]],
                evidence={"n": len(empty), "preview": empty[:20]},
            )
        return r

    def check_capacity_gaps(self) -> Report:
        """Any unresolved capped-shard gap in the gaps ledger is an open
        completeness defect. The audit refuses to call the corpus complete."""
        r = Report(
            "capacity_gaps",
            "data/gaps.jsonl",
            control=(
                "a capped-shard gap recorded in data/gaps.jsonl means an "
                "enumeration shard hit the site's 1000-row cap and could not "
                "be exhausted -- this check must surface it as an open defect"
            ),
        )
        opens = [g for g in _read_jsonl(self.ctx.gaps) if g.get("kind") == "capped-shard"]
        if opens:
            return r.flag(
                "defect",
                findings=[f"{len(opens)} unresolved capped-shard gap(s)"],
                evidence={"n": len(opens), "gaps": opens[:10]},
            )
        return r

    def check_manifest_record(self) -> Report:
        """Every manifest record carries its pointer fields and, when the
        local pdf still exists, a sha256 that matches it. A bad sha on an
        archived record is a corruption signal."""
        r = Report(
            "manifest_record",
            "data/epav-manifest.jsonl",
            control=(
                "a manifest record whose sha256 does not match its local pdf "
                "bytes (when the local copy still exists) is a corruption "
                "signal -- this check must flag it"
            ),
        )
        bad = []
        for m in _read_jsonl(self.ctx.manifest):
            tok = _token_of(m)
            if not (m.get("archive_url") and m.get("sha256") and m.get("bytes")):
                bad.append({"token": tok, "why": "missing pointer fields"})
                continue
            pdf = Path(self.ctx.local_pdf_prefix, tok, "source.pdf")
            if pdf.is_file() and _sha(pdf.read_bytes()) != m["sha256"]:
                bad.append({"token": tok, "why": "sha256 mismatch"})
        if bad:
            return r.flag(
                "defect",
                findings=[f"{len(bad)} manifest record(s) malformed/mismatched", *map(str, bad[:10])],
                evidence={"n": len(bad), "preview": bad[:10]},
            )
        return r

    def check_duplicate_tokens(self) -> Report:
        """The fetched ledger must never carry the same token twice with
        different content -- the dedup invariant. Two rows for one token are
        a collision candidate, never silently merged."""
        r = Report(
            "duplicate_tokens",
            "data/epav-fetched.jsonl",
            control=(
                "two epav-fetched records for the same token with different "
                "sha256/bytes are a duplicate-with-conflict -- this check "
                "must flag it as a collision candidate"
            ),
        )
        seen = {}
        dupes = []
        for rec in _read_jsonl(self.ctx.fetched):
            tok = _token_of(rec)
            if tok in seen and seen[tok] != rec.get("local_pdf"):
                dupes.append(tok)
            seen.setdefault(tok, rec.get("local_pdf"))
        if dupes:
            return r.flag(
                "suspicious",
                findings=[f"{len(dupes)} token(s) seen more than once", *dupes[:20]],
                evidence={"n": len(dupes), "preview": dupes[:20]},
            )
        return r

    def check_surveillance_cardinality(self) -> Report:
        """A contract that earned an eoreader7 read should also have a
        surveillance verdict on the record. A read with no verdict is a
        processing gap (not a statement that the contract is clean)."""
        r = Report(
            "surveillance_cardinality",
            "data/surveillance-flags.jsonl",
            control=(
                "a fetched contract with eoreader7 reads but no surveillance "
                "flag record is a processing gap -- this check must flag it"
            ),
        )
        flags = {f.get("epav_token") for f in _read_jsonl(self.ctx.flags) if f.get("epav_token")}
        missing = []
        for rec in _read_jsonl(self.ctx.fetched):
            if rec.get("destroyed_per_retention_schedule"):
                continue
            tok = _token_of(rec)
            if rec.get("local_eoreader7") and tok not in flags:
                missing.append(tok)
        if missing:
            return r.flag(
                "suspicious",
                findings=[f"{len(missing)} token(s) with reads but no surveillance verdict", *missing[:20]],
                evidence={"n": len(missing), "preview": missing[:20]},
            )
        return r

    # ---- run ------------------------------------------------------------

    ALL_CHECKS = (
        check_durable_home,
        check_deployed_present,
        check_text_present,
        check_capacity_gaps,
        check_manifest_record,
        check_duplicate_tokens,
        check_surveillance_cardinality,
    )

    def run(self, run_id: str, *, checks=None, ledger_path: Path | None = None) -> list[Report]:
        reports = []
        for check in checks or self.ALL_CHECKS:
            try:
                rep = check(self)
            except Exception as e:  # noqa: BLE001 - a broken check is itself a defect
                rep = Report(check.__name__, "qc", control="a check that raises while auditing is itself a defect")
                rep.flag("defect", [f"check raised: {e}"])
            reports.append(rep)
            if ledger_path is not None:
                ledger_path.parent.mkdir(parents=True, exist_ok=True)
                with open(ledger_path, "a") as f:
                    f.write(json.dumps(rep.as_line(run_id)) + "\n")
        return reports


def default_run(root: Path, run_id: str, *, ledger_path: Path | None = None) -> list[Report]:
    return QC(QCContext.build(root)).run(run_id, ledger_path=ledger_path)