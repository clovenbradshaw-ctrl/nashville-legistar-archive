# nashville-legistar-archive

A public, append-only pointer index from Metro Nashville's Legistar
legislative record — every matter (bill, resolution, ordinance) and every
attachment on it (contracts, MOUs, amendments, exhibits) — to permanent
copies on [archive.org](https://archive.org).

Nashville's Legistar record is the single source for both: matter metadata
*is* the legislation, and its attachments *are* the procurement contracts.
Source: `https://webapi.legistar.com/v1/nashville` (public web API); the
human-readable equivalent of a matter is
`https://nashville.legistar.com/LegislationDetail.aspx?ID={id}&GUID={guid}`.

## What this does

`scripts/backfill.py` walks every matter in Legistar. For each one it:

1. Uploads the matter's raw JSON record to archive.org as its own item
   (`nashville-legistar-matter-{MatterId}`).
2. Downloads every attachment on the matter and uploads each as its own
   item (`nashville-legistar-att-{MatterAttachmentId}`).
3. Appends one line to [`data/manifest.jsonl`](data/manifest.jsonl) recording
   every pointer: the Legistar source URL, the archive.org item URL, and a
   sha256 of the archived bytes.
4. Extracts the attachment's text page-by-page (PyMuPDF's text layer,
   tesseract OCR for scanned pages). The FULL text — every page, always —
   is uploaded to archive.org as `extracted-text.txt` on that same
   attachment item and pointed to from `data/referents.jsonl`, so it's
   permanently queryable regardless of how deeply it gets read below.
   Nothing about a page's treatment in step 5 ever removes or shortens
   what's archived here.
5. Checks each page against a corpus-wide cache (`src/boilerplate.py`) of
   exact page-content hashes. A page only earns "boilerplate" status by
   actually recurring, verbatim, somewhere else in the corpus — never by
   assertion — recorded in the append-only
   [`data/page-sightings.jsonl`](data/page-sightings.jsonl). The `eoreader7`
   reading pipeline (a separate CLI on `PATH`, not vendored here) runs the
   deep, expensive parse only on pages seen for the first time; a repeat
   page gets a cheap shadow record pointing at the document that read it in
   full instead. This is deliberately reversible: since step 4 already
   archived the full text of every page regardless, a page skipped here can
   always be read in full later if it turns out to matter — nothing is
   lost, only deferred. eoreader7's own full output (raw read, fold, log
   JSON) is uploaded alongside the source file, and a compact summary —
   referent surfaces plus every subject-relation-object assertion it found
   (`EOHyperedge@1`) — is appended to `data/referents.jsonl`.
6. Every organization-looking end of one of those assertions
   (`src/company_index.py`'s `looks_like_org`: a declared suffix table —
   Inc, LLC, Corp, Solutions... — matched against a multi-word surface or
   eoreader7's own multi-word resolved `ref`, never a bare suffix word
   alone) is appended, as a **believed assertion** — never a fact — to
   [`data/assertions.jsonl`](data/assertions.jsonl), tagged with its giver
   (eoreader7's own `declared.giver`) and full source provenance. This file
   is the only source of truth for what's known about organizations; it is
   only ever appended to, never mutated. Every `LINT_EVERY` attachments
   (and once at the end of a run), it's read fresh and **folded** —
   never stored as a separate mutable state — into a company registry
   (first_seen/last_seen computed at fold time), written wholesale as the
   convenience view [`data/companies.json`](data/companies.json), and
   turned into eoreader7 GFP claims plus an arrow-of-time `order` block
   (each company's own occurrences, chronologically) checked against
   eoreader7's own reasoning-lint gate (`cli/reason.mjs`, run directly,
   never piped, so its own permanent reasoning-record ledger gets the entry
   too). The verdict is appended to [`data/lint-log.jsonl`](data/lint-log.jsonl).
7. Same cadence as step 6: [`src/corroborate.mjs`](src/corroborate.mjs)
   runs the **proper** cross-document mechanism — not a string or
   co-occurrence match. The standalone `eoreader7` CLI used in step 5 never
   populates a real notes ledger (its own `taskLog` comes back empty);
   `corroborate.mjs` instead calls into eoreader7/the-fold's own relation
   reader and notes ledger directly (`the-fold/hypergraph.js`,
   `the-fold/hyperlexicon.js`), which produces markedly cleaner
   subject-verb-object claims than the CLI's raw hyperedges. It then runs
   `organs/corroboration.js`'s witness protocol: for each claim, candidate
   sentences from *other* documents are proposed by shared vocabulary, and
   a local model (`gemma2:2b` via Ollama, run entirely on this machine) is
   asked to vote on whether that other document actually restates the same
   claim — plus a sibling-swapped control vote to catch false positives —
   under a declared, disclosed ask budget (`CORROBORATE_BUDGET`, a cost
   bound, not an accuracy one). Only claims the model actually verified are
   attested, appended as `CorroboratedNote@1` records to
   [`data/corroborated-notes.jsonl`](data/corroborated-notes.jsonl); this is
   the highest-confidence cross-document signal in this repo, distinct from
   and stricter than the raw per-document `data/assertions.jsonl`. Verified
   end to end on real archived Nashville contracts before being wired in:
   230 admitted claims from 7 real documents, a real budgeted run against a
   locally-running model, every refusal reason disclosed rather than hidden.

None of steps 4-7 ever block or revert steps 1-3: a failed extraction,
eoreader7 read, or lint just means that attachment gets a thinner
referents.jsonl entry, logged to stderr, while its own archive.org upload
and manifest entry stand.

The manifest, the full-text archive, the assertions log, the corroborated
notes, and the company fold are the deliverable — a durable, checkable map
from "what Nashville
filed" to "where a permanent copy of it lives" to "what was actually
believed about who these documents are about, by what reading, sourced
back to the document." Nothing is deleted or rewritten; re-running the
script only adds matters that aren't in the manifest yet, and only ever
appends more believed assertions.

**Requires**, beyond `requirements.txt`: the `eoreader7` CLI on `PATH`,
`tesseract` on `PATH` (OCR), Node.js, a local checkout of `the-fold` and
`eoreader7` at the paths `src/corroborate.mjs` hardcodes, and Ollama
running locally with `gemma2:2b` pulled (step 7). All of these are external
to this repo; without them, steps 1-3 still work fine on their own —
extraction/reading/corroboration just fails per-attachment or per-run and
is skipped, logged to stderr.

## Manifest schema

One JSON object per line in `data/manifest.jsonl`:

```json
{
  "matter_id": 21173,
  "matter_file": "RS2026-2264",
  "matter_title": "...",
  "legistar_url": "https://nashville.legistar.com/LegislationDetail.aspx?ID=21173&GUID=...",
  "matter_archive_url": "https://archive.org/details/nashville-legistar-matter-21173",
  "attachments": [
    {
      "attachment_name": "Agreement",
      "source_url": "https://nashville.legistar1.com/nashville/attachments/....PDF",
      "archive_url": "https://archive.org/details/nashville-legistar-att-40781",
      "sha256": "...",
      "bytes": 123456
    }
  ],
  "archived_at": "2026-09-25T00:00:00Z"
}
```

## assertions.jsonl schema (source of truth)

One `BelievedAssertion@1` line per organization-looking end of an
eoreader7 hyperedge — append-only, never mutated:

```json
{
  "schema": "BelievedAssertion@1",
  "subject": "Motorola Solutions",
  "subject_surface": "Solutions",
  "subject_ref": "ref:auto:motorola_solutions",
  "relation": "for",
  "object": "software",
  "giver": "reader:eoreader7-cli",
  "source": {
    "matter_id": 21173, "attachment_id": 40781,
    "archive_url": "https://archive.org/details/nashville-legistar-att-40781",
    "legistar_url": "https://nashville.legistar.com/LegislationDetail.aspx?ID=21173&GUID=...",
    "intro_date": "2026-09-03",
    "at": [34582, 34787]
  },
  "recorded_at": "2026-09-25T21:00:00Z"
}
```

`source.at` is a real, absolute `[start, end]` byte span into that attachment's
cached extracted text (`data/.eowork/<att>/<att>.txt`, and the same bytes
archived as `extracted-text.txt`) — taken from the read's own `Encounter@1`
log entries, the same `file#start-end` addressing `cli/holograph.mjs`'s
`parseRef`/`resolveSnippet`/`snipAt` already use elsewhere in this codebase.
`company_index.verify_assertions()` is the conformance gate, modeled
directly on the sibling `nashville-plans-surface.md` design's own rule that
every ledger ref must resolve to non-null verbatim: it slices every
assertion's span out of the real cached text and confirms it's non-empty —
verified end to end on this repo's own corpus, 58/58 resolved, 0 failures.
An assertion whose span doesn't resolve is a bug to fix, not noise to
ignore.

## companies.json schema (derived fold, not a record)

Regenerated wholesale from `assertions.jsonl` every time it's written —
never itself the source of truth, and clearly labelled as such:

```json
{
  "_derived_from": "data/assertions.jsonl",
  "_generated_at": "2026-09-25T21:00:00Z",
  "_note": "A fold of the append-only log, not a record itself...",
  "companies": {
    "Motorola Solutions": {
      "first_seen": "2026-09-03",
      "last_seen": "2026-09-03",
      "assertions": ["... every BelievedAssertion@1 with this subject ..."]
    }
  }
}
```

## Surveillance flagging

[`src/surveillance_flag.py`](src/surveillance_flag.py) reuses the proven
classifier from the sibling `legistar-surveillance-scanner` project directly
(via `sys.path`, never forked/copied — this repo never drifts from the
maintained original). This is a priority, not a nice-to-have: contracts
involving surveillance technology are exactly the ones most at risk of
disappearing from the public record, and most in need of being findable.

**Real bug found and fixed building this**: `summarize_referents()`'s own
40-surface cap (added to keep `referents.jsonl` small) silently discarded
the exact terms ("surveillance", "video") the classifier needs. Fed the
capped list, matter RS2026-2264 (the Motorola Solutions cooperative
agreement) scored 1.5, "background". Fed the FULL 2,403-surface set from
the same cached read, it scored 60.4, "surveillance" — matching the
scanner's own documented golden case for this exact matter. The classifier
now always runs against the full, uncapped read; only the resulting small,
bounded verdict is stored, in [`data/surveillance-flags.jsonl`](data/surveillance-flags.jsonl)
— never the full surface list.

The classifier's own anti-false-positive discipline holds in this corpus
too: RS2021-1026 (an auctioneer-services contract) scored 43.5 on generic
procurement vocabulary alone but was correctly **not** flagged — a document
needs a concrete surveillance technology term or a named surveillance
vendor to anchor the verdict, not just SENSOR/GUARDRAIL vocabulary.

## Toward a searchable surface (designed, not yet built)

The intended shape, matching this repo's own tiered design: GitHub hosts
the small index (`manifest.jsonl`, `assertions.jsonl`, `companies.json`,
`surveillance-flags.jsonl`) — a keyword search runs against that small
index first, and drills down via each hit's `archive_url`/`full_text_url`
pointer to archive.org's full OCR'd text for confirmation and full-text
reading. Not yet implemented.

## Known limitation: clause extraction assumes fairly standard formatting

[`src/contract_extract.py`](src/contract_extract.py)'s `CLAUSE_HEADINGS`
pattern (Term, Scope of Work, Termination, Governing Law, etc. — the
standard CUAD/commercial-contract categories) assumes contracts are
formatted with recognizable section headings. It has not been stress-tested
against non-standard formatting, and there is no reason to assume Nashville's
vendor-supplied contracts format consistently — a real, disclosed gap, not
a claim of universal coverage.

## Running it

```bash
pip install -r requirements.txt
cp .env.example .env   # then fill in your archive.org S3 keys
python scripts/backfill.py --limit 5   # pilot run
python scripts/backfill.py             # full backfill (resumable)
```

Credentials are read from `.env` (git-ignored) or the environment — never
committed. Get archive.org S3-like keys at
https://archive.org/account/s3.php.
