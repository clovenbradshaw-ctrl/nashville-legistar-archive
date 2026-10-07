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