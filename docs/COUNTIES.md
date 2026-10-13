# Tennessee county records pull

An extension of the Metro contract database to Tennessee's 95 counties. Davidson (Metro Nashville) is
the existing ePAV/Legistar pipeline; the other 94 counties publish through whatever their website uses,
so this is a registry-driven crawler, not 94 adapters.

## What is here

| piece | file |
|---|---|
| county identity (name, FIPS 47001-47189) | `src/counties.py`, `data/counties/registry.json` |
| where each county publishes (workbook + researcher-found, with provenance) | `data/counties/seeds-discovered.json`, `scripts/build_county_registry.py` |
| the crawler | `scripts/county_pull.py` |
| legislation watcher (no downloads) | `scripts/county_watch.py` |
| live coverage probe, scoreboard, lists | `scripts/county_coverage.py`, `scripts/build_scoreboard.py`, `scripts/build_pullable_list.py`, `data/counties/PULLABLE*.csv`, `data/counties/legislation-pointers.csv` |
| text + proof instead of bytes | `scripts/county_digest.py` |
| pointer verification and archive.org lookup | `scripts/county_reacquire.py`, `scripts/county_archive.py` |
| append-only operator log and its fold | `src/eo_log.py` (events judged by khora's cube via `scripts/eo_check_county_ops.mjs`) |
| derived index and read-only service | `scripts/build_county_db.py`, `scripts/county_query_server.py` |
| pages | `docs/counties.html`, `docs/scoreboard.html` |
| deploy and operate on the VM | `scripts/deploy_counties_vm.sh` |

## Rules the code keeps

- **robots.txt is honoured**, one request per host per few seconds, identifying User-Agent.
- **A bot check is queued for a person and never worked around.** Platforms whose terms forbid automation
  (Vendor Registry) are recorded as pointers and not fetched.
- **Provenance is the foundation.** Every row records the URL, the response status, redirect chain, selected
  headers, fetch time, the crawler's code hash, and the sha256. The county's file at its URL and the
  archive.org capture are the sources of truth; an original may be dropped only after its provenance record
  and text read-back exist (`--drop-originals`, off by default).
- **archive.org is looked up, never written to** by this code. A lookup records "none" only after a
  positive control shows the index can answer.
- **Everything runs under one directory on a mounted data volume**, never the root disk.

## Measured (2026-10-13)

- Index and service hold their latency budget (p95 <= 50 ms) on a replica 95 times today's corpus; the
  first run of that test failed and found two real defects (see `data/counties/FALSIFY-95x.json`).
- The coverage claim "we hold the real database for every county" is **false**: see
  `data/counties/FALSIFY-coverage.vm.json` and `PULLABLE.csv`. Most counties publish agendas, minutes
  and bid notices; very few publish executed contracts.
- 89% of pages in sampled PDFs are scans with no text layer, so OCR throughput, not disk, is the limit.

## Known gaps

- A file overwritten at a fixed URL (e.g. Obion's monthly agenda) is seen once; versions are not kept.
- Sullivan's document library is only reachable through a sitemap the crawler does not read yet.
- Blount publishes on Legistar with a public API; a generic Legistar adapter would give real
  resolution-to-attachment links.
- OCR worker not built here (tesseract is installed on the VM under its tools directory).
- Davidson's completeness is not measured by this code.
