# Vendored holodeck frame

`web/` is the reading/research surface of The Fold, vendored byte-for-byte
from the published **scores-patch-points/holodeck** app and served by GitHub
Pages from this repo's `main` branch `/web` path.

- Upstream: `https://github.com/scores-patch-points/holodeck`
- Vendored at commit: `09b843bb47e36cc27c67452b52d10cda47ee342a` (2026-10-07)
- Method: `git clone --depth 1` + copy excluding `.git`, `.github`, `CHORUS-LOG.md`.

The frame is a no-build single-page app: `index.html` + `support.js` hydrate
the surface. It reads small files directly from this GitHub repository
(`data/`) and drills to archive.org for the originals — the same two-tier store
this repo's pipeline produces. Re-vendor deliberately: copy the frame, then
re-run the QC falsification so the shipped surface is still the one the
checks know.

## Re-vendor 2026-10-13 (provenance log)

- Upstream: `https://github.com/scores-patch-points/holodeck`, remote tip read after `git fetch`, **not** the working tree.
- Upstream commit: `f3fdd3815ce2070b3cab8a1147bc80960e978b79` (2026-10-13 17:46 -05:00, "Holodeck audio: sound line names the top kinds, not timestamps"). Previous vendoring: `09b843bb47e36cc27c67452b52d10cda47ee342a`.
- Method: `git archive` of that commit; per file, sha256 compared against the working copy.
- Result: 1,879 files already byte-identical; 103 updated (the local copy equalled the OLD upstream commit, so upstream had simply moved; now byte-identical); 175 added at the frame level + 167 added as transitive `import` closure inside `vendor/` (all byte-identical); **0 ported** files remain among them. Two earlier local ports (`ethos` -> `Zenodotus` in `index.html`/`holodeck-perspectives.js`) are now upstream, so those files are byte-identical too.
- Kept local (not overwritten): this `VENDORING.md`, `README.md`, `.gitignore` (repo's own), `dashboard.html`, `live.html` (local-only, not upstream).
- Not vendored: `CHORUS-LOG.md`, `LESSONS.md`, `WIP-CONSOLIDATION-RESULT.md`, `*.mp4`, the design-brief PDF, `figures/`, `thumbs/`, `demo-motorola/`, `favicon-assets/`, and upstream `vendor/` files nothing in the frame imports (~190 MB). Full file lists: `VENDORING-2026-10-13.files.txt`.
- Known dangling upstream imports (absent in upstream itself, lazy/guarded): `vendor/eoreader7/native/kernel/reading-rules.js`, `.../kernel/gfp-claim.js` (`holodeck-summary.js` path `../eoreader7/...`), plus ~30 others in the closure. Not patched (frame is byte-for-byte).
- Note: upstream holodeck itself vendors `vendor/eoreader7/native/*` for its in-browser reader. That is inside the scores repo, not an import of a retired working dir, but the name is stale; raise upstream.
- Smoke test (static server, headless pane): `index.html` loads; `nashville-seed.html` seeds 402 docs / 9,313 statements / 2,755 names / 1,608 figures; Read closely -> **Assertions** (Records) view renders "Statements 9313 records · 4 fields · 4 relations" with rows. Console: only 404s for unfilled `{{ ... }}` template placeholders and the dangling imports above.
