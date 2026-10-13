# the fold — capture (browser extension)

On-device capture for the fold. When the fold cannot read a page directly (CORS, a paywall, a
human-check, or a page whose article exists only after its own scripts run), it opens the page in a
new tab; this extension hands the rendered page back to the fold — automatically, with no click.

It only reads a page in two explicit cases: a page the fold opened as `<url>#fold-capture`, or the
page you are on when you press the toolbar button. It never prowls on its own.

**Captions (0.2.0).** A hosted copy of the fold cannot read a YouTube caption track: from a web page
the body comes back empty, and the player API sends no CORS header. When the fold is given a YouTube
link it asks this extension, which reads that one video's captions from your own browser and address
and hands them back — no server in between, nothing to run on your machine. See `captions.js`.

## Install (Chrome / Edge / Brave / Chromium)

1. Open `chrome://extensions` (or the browser's extensions page).
2. Turn on **Developer mode**.
3. **Load unpacked** → choose this `extension/` folder.
4. Pin the toolbar button (optional; needed only for the manual fallback).

The fold origin must match where the fold is served. If the fold is not on
`https://scores-patch-points.github.io/the-fold/`, edit `FOLD_URL` at the top of `background.js`,
reload the extension, and repeat step 3.

## How it works

- **Automatic.** The fold opens the page as `<url>#fold-capture`. The content script waits for the
  page to settle and for any human-check to be cleared, then reads
  `document.documentElement.outerHTML`, posts it to the fold's tab (its opener), and closes itself.
  Because it waits while the page still looks like a challenge, you can solve it and it captures the
  result — the "prove you are human" loop completes without another click.
- **Manual fallback.** Press the toolbar button on any page to capture it into the fold's open tab.
  This also covers sites that rewrite or strip the `#fold-capture` fragment (some SPAs).

## Captions — how it works and what it can see

- The fold page posts `{type:'fold-captions-request', id}` to its own window; `content.js` (which
  answers only on the fold's origins) relays it to `background.js`, which reads that one video's
  caption track from youtube.com and returns the segments the same way.
- It answers only for an 11-character video id, only to the fold's own origins, and only fetches
  `youtube.com`. It stores nothing and sends nothing to a server of ours.
- If the extension is not installed the fold notices within a second and falls back to the local
  helper (`tools/ytdl-helper.py`) as before.

## Privacy

The extension holds `host_permissions: <all_urls>`, so it *can* read any page — that is what lets it
capture the page you are looking at. It acts only when asked: on `#fold-capture` (the fold opened it)
or on the toolbar button. Nothing is stored by the extension; the captured DOM goes straight to the
fold tab and lives only in the fold's browser-local workspace. The address and content never touch a
server of ours.