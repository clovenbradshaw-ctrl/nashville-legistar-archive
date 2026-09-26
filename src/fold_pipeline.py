"""Shared plumbing between backfill.py (Legistar legislation) and
backfill_epav.py (ePAV contracts): small env/hash helpers and the periodic
fold+lint+corroborate cadence. Factored out so both scripts call the same
one implementation against the same corpus-wide assertions/companies/
lint-log/corroborated-notes files instead of drifting duplicate copies --
the assertions log, company fold, and reasoning lint are one thing
regardless of which scraper is currently appending to them."""

from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import company_index


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def sha256_of(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fold_and_lint_now(
    *,
    assertions_path: Path,
    companies_path: Path,
    lint_log_path: Path,
    eowork_dir: Path,
    corroborate_mjs: Path,
    corroborated_path: Path,
    corroborate_budget: int,
) -> None:
    """Reads the append-only assertions log FRESH and folds it -- the
    registry is never carried in memory across documents, only ever derived
    from the log on disk at this moment."""
    assertions = company_index.read_assertions(assertions_path)
    if not assertions:
        return
    registry = company_index.fold_companies(assertions)
    company_index.write_companies_snapshot(companies_path, registry, derived_from=str(assertions_path))
    spec = company_index.build_lint_spec(registry)
    result = company_index.run_lint(spec, eowork_dir / "company-lint-spec.json") if spec["claims"] else {"ok": None, "errors": 0}
    with lint_log_path.open("a") as lf:
        lf.write(json.dumps({
            "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "ok": result.get("ok"),
            "errors": result.get("errors"),
            "nCompanies": len(registry),
            "nClaims": len(spec["claims"]),
        }) + "\n")
    print(f"  lint: ok={result.get('ok')} errors={result.get('errors')} companies={len(registry)}", file=sys.stderr)

    # The PROPER cross-document pass: the-fold's relation reader + a real
    # local-model witness (organs/corroboration.js), not a string or
    # co-occurrence match. Best-effort -- a missing Ollama or a subprocess
    # crash is logged and never blocks archiving.
    try:
        proc = subprocess.run(
            ["node", str(corroborate_mjs), "--dir", str(eowork_dir), "--out", str(corroborated_path), "--budget", str(corroborate_budget)],
            capture_output=True, text=True, timeout=600,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            print(f"  corroborate: {proc.stdout.strip()}", file=sys.stderr)
        elif proc.stderr:
            print(f"  corroborate: {proc.stderr.strip()[-500:]}", file=sys.stderr)
    except Exception as e:  # noqa: BLE001 - additive, never blocks archiving
        print(f"  corroborate FAILED: {e}", file=sys.stderr)
