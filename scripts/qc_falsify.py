"""Falsify the QC: prove the quality-control checks actually catch problems.

For every check in src/qc.py we seed the exact defect its falsifying control
names into a synthetic corpus and assert the check flags it (suspicious or
defect). We also run a clean control state and assert NOTHING is flagged --
a checker that raises alarms on healthy data is as broken as one that sleeps
on corruption. This is the "verify a gate against what it should reject"
discipline (reasoning-stages.mjs): a QC with no seeded-defect proof reads as
rigor, not as rigor verified.

Exit 0 iff every seeded defect is caught and the clean control stays clean.
"""
from __future__ import annotations

import json
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "src"))

import qc as qcmod  # noqa: E402

PASS, FAIL = 0, 1


def write(jsonl_path, rows):
    if rows is None:
        return
    jsonl_path.parent.mkdir(parents=True, exist_ok=True)
    with open(jsonl_path, "a") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")


def make_root():
    return pathlib.Path(tempfile.mkdtemp(prefix="qc-falsify-"))


def fetched_row(token, *, local_pdf=True, destroyed=False, reads=True):
    row = {
        "epav_token": token,
        "contract_number": f"C-{token}",
        "contracting_party": "TEST PARTY",
        "department": "TEST",
        "status": "active",
        "expiration_date": None,
        "identifier": f"nashville-epav-contract-{token}",
        "archive_url": f"https://archive.org/details/nashville-epav-contract-{token}",
        "epav_url": f"http://documents.nashville.gov/Request/Document/{token}",
        "destroyed_per_retention_schedule": destroyed,
        "fetched_at": "2026-10-07T00:00:00Z",
    }
    if reads and not destroyed:
        row["local_eoreader7"] = f"/mnt/cache/{token}"
    row["local_pdf"] = f"/mnt/cache/{token}/source.pdf"
    return row


def manifest_row(token, *, sha, bytes_, local_pdf=True):
    row = {
        "epav_token": token,
        "contract_number": f"C-{token}",
        "contracting_party": "TEST PARTY",
        "department": "TEST",
        "archive_id": f"nashville-epav-contract-{token}",
        "archive_url": f"https://archive.org/details/nashville-epav-contract-{token}",
        "sha256": sha,
        "bytes": bytes_,
        "archived_at": "2026-10-07T00:00:00Z",
    }
    if local_pdf:
        row["local_pdf"] = f"/mnt/cache/{token}/source.pdf"
    return row


def deployed_for(root, ctx, token, *, text="SCOPE OF WORK\nTermination clause."):
    dep = ctx.deployed / f"nashville-epav-contract-{token}"
    dep.mkdir(parents=True, exist_ok=True)
    (dep / "extracted-text.txt").write_text(text)
    (dep / "deployed.json").write_text(json.dumps({"identifier": f"nashville-epav-contract-{token}"}))
    return dep


def local_pdf_for(root, ctx, token, data=b"%PDF-1.4 clean control"):
    p = ctx.local_pdf_prefix / token
    p.mkdir(parents=True, exist_ok=True)
    (p / "source.pdf").write_bytes(data)
    return p


def scenario_clean(tmp):
    """A fully healthy state: one uploaded token (deployed+flag, pdf gone),
    one fetched-not-yet-uploaded token (pdf+deployed+flag present). Nothing
    may be flagged."""
    txt = pathlib.Path(__file__).resolve().parent.parent
    import qc as m
    ctx = m.QCContext.build(tmp)
    pdf_a = b"%PDF-1.4 A"
    sha_a = __import__("hashlib").sha256(pdf_a).hexdigest()
    write(ctx.fetched, [fetched_row("A", local_pdf=True), fetched_row("B", destroyed=False)])
    write(ctx.manifest, [manifest_row("A", sha=sha_a, bytes_=len(pdf_a))])
    deployed_for(tmp, ctx, "A"); deployed_for(tmp, ctx, "B")
    # A: uploaded -> pdf deleted (local gone). B: still local -> pdf present.
    local_pdf_for(tmp, ctx, "B", b"%PDF-1.4 B")
    write(ctx.flags, [{"epav_token": "A", "label": "background"}, {"epav_token": "B", "label": "background"}])
    return tmp


SCENARIOS = {}


def seed(name, build, expect):
    SCENARIOS[name] = (build, expect)


# 1. durable_home: token fetched, not in manifest, local pdf gone.
def s_durable(tmp):
    import qc as m
    ctx = m.QCContext.build(tmp)
    write(ctx.fetched, [fetched_row("LOST", local_pdf=True)])
    # no manifest, no local pdf
    return tmp
seed("durable_home", s_durable, "defect")

# 2. deployed_present: fetched non-destroyed, no data/deployed files.
def s_deployed(tmp):
    import qc as m
    ctx = m.QCContext.build(tmp)
    write(ctx.fetched, [fetched_row("NODEP", destroyed=False)])
    return tmp
seed("deployed_present", s_deployed, "defect")

# 3. text_present: extracted text empty on a non-destroyed contract.
def s_text(tmp):
    import qc as m
    ctx = m.QCContext.build(tmp)
    write(ctx.fetched, [fetched_row("EMPTY", destroyed=False)])
    deployed_for(tmp, ctx, "EMPTY", text="")
    return tmp
seed("text_present", s_text, "suspicious")

# 4. capacity_gaps: an unresolved capped-shard gap in the gaps ledger.
def s_gaps(tmp):
    import qc as m
    ctx = m.QCContext.build(tmp)
    write(ctx.gaps, [{"schema": "EnumerationGap@1", "kind": "capped-shard", "subject": "POLICE",
                      "falsifying": "control", "detail": "cap"}])
    return tmp
seed("capacity_gaps", s_gaps, "defect")

# 5. manifest_record: sha mismatch against a still-present local pdf.
def s_manifest(tmp):
    import qc as m, hashlib
    ctx = m.QCContext.build(tmp)
    pdf_b = b"%PDF-1.4 ACTUAL-BYTES"
    local_pdf_for(tmp, ctx, "M1", pdf_b)
    write(ctx.fetched, [fetched_row("M1", destroyed=False)])
    write(ctx.manifest, [manifest_row("M1", sha=hashlib.sha256(b"wrong").hexdigest(), bytes_=len(pdf_b))])
    return tmp
seed("manifest_record", s_manifest, "defect")

# 6. duplicate_tokens: same token twice with different content pointers.
def s_dupes(tmp):
    import qc as m
    ctx = m.QCContext.build(tmp)
    a, b = dict(fetched_row("DUP")), dict(fetched_row("DUP"))
    a["local_pdf"], b["local_pdf"] = "/mnt/cache/DUP/a.pdf", "/mnt/cache/DUP/b.pdf"
    write(ctx.fetched, [a, b])
    return tmp
seed("duplicate_tokens", s_dupes, "suspicious")

# 7. surveillance_cardinality: eoreader7 reads but no flag record.
def s_flags(tmp):
    import qc as m
    ctx = m.QCContext.build(tmp)
    write(ctx.fetched, [fetched_row("NOFLAG", destroyed=False)])
    deployed_for(tmp, ctx, "NOFLAG")
    # no flags written
    return tmp
seed("surveillance_cardinality", s_flags, "suspicious")


def main() -> int:
    import qc as m
    failures = 0

    # Clean control first: nothing may be flagged.
    clean_tmp = scenario_clean(make_root())
    qc = m.QC(m.QCContext.build(clean_tmp))
    for check in m.QC.ALL_CHECKS:
        rep = check(qc)
        if rep.grade != "ok":
            print(f"  FAIL clean-control {check.__name__}: flagged {rep.grade}: {rep.findings[:3]}")
            failures += 1
    print(f"clean control ({len(m.QC.ALL_CHECKS)} checks): "
          f"{'ALL OK' if failures == 0 else f'{failures} false alarms'}")

    for name, (build, expect) in SCENARIOS.items():
        tmp = build(make_root())
        ctx = m.QCContext.build(tmp)
        rep = getattr(m.QC(ctx), f"check_{name}")()
        got = rep.grade
        ok = got == expect
        # a defect-falsifying control must be present structurally
        has_control = bool(rep.control.strip())
        if not ok or not has_control:
            failures += 1
            print(f"  FAIL {name}: expected {expect!r} got {got!r} control={'yes' if has_control else 'MISSING'}")
        else:
            print(f"  ok   {name}: caught as {got} (control: '{rep.control[:70]}...')")

    if failures == 0:
        print(f"\nQC FALSIFIED-ROBUST: {len(SCENARIOS)} seeded defects caught, "
              f"{len(m.QC.ALL_CHECKS)} clean-control checks clean.")
        return 0
    print(f"\n{failures} falsification failure(s).")
    return 1


if __name__ == "__main__":
    sys.exit(main())