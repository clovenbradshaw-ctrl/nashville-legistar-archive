"""Two-tier routing for archived contracts.

The big file of a record -- the original PDF -- is the only thing uploaded to
archive.org. Everything small (extracted text, eoreader7 reads) is promoted
into the committed tree at data/deployed/<identifier>/ so a git push publishes
it to GitHub, and the local copy of the big file is deleted once archive.org
has confirmed it. Neither promotion nor deletion can ever lose bytes that
already landed in their durable home; the policy is keep-local-until-durable,
then drop the large copy when possible.

ROUTING RULE (recorded, not assumed):
    large  (source PDF)               -> archive.org, then delete local copy
    small  (text, eoreader7 reads)    -> data/deployed/  (git push -> GitHub)
An identifier is deterministic (nashville-epav-contract-<token>), so the
archive.org URL and the deployed/ path name the same record everywhere.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEPLOYED = ROOT / "data" / "deployed"


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def deployed_dir(identifier: str) -> Path:
    return DEPLOYED / identifier


def promote_small_artifacts(identifier: str, *, text: str | None = None, reads_dir: Path | None = None, pdf_bytes: int | None = None, record: dict | None = None) -> list[Path]:
    """Copy the small artifacts for one identifier from wherever the fetch
    phase left them into the committed data/deployed/<identifier>/ tree.
    Returns the list of files written. Skipped artifacts are simply absent --
    nothing partial is ever committed as if it were the whole truth."""
    out_dir = deployed_dir(identifier)
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    if text:
        p = out_dir / "extracted-text.txt"
        p.write_text(text, encoding="utf-8")
        written.append(p)

    if reads_dir is not None and reads_dir.is_dir():
        for fname in ("eoreader7.json", "eoreader7.fold.json", "eoreader7.log.json"):
            src = reads_dir / fname
            if src.exists():
                dst = out_dir / fname
                dst.write_bytes(src.read_bytes())
                written.append(dst)

    # A small manifest stub of what belongs at this address -- lets the pull
    # side know whether this contract's small files are complete on GitHub
    # without having to guess from a directory listing.
    meta = {
        "schema": "DeployedContract@1",
        "identifier": identifier,
        "small_files": [w.name for w in written],
        "pdf_bytes": pdf_bytes,
        "promoted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **(record or {}),
    }
    mp = out_dir / "deployed.json"
    mp.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    written.append(mp)
    return written


def delete_large_after_upload(cache_dir: Path) -> bool:
    """Delete the large local copy (source.pdf) now that archive.org holds it.
    Returns True if the pdf was removed. The small cache files may remain --
    they are tiny and deletion is optional for them."""
    pdf = Path(cache_dir) / "source.pdf"
    if pdf.exists():
        pdf.unlink()
        return True
    return False