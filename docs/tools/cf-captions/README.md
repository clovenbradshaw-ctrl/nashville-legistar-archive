# cf-captions — YouTube captions for a hosted copy of the page

A browser can no longer read a YouTube caption track on its own (the body comes back empty without a
proof-of-origin token, and the player API sends no CORS header). The local `tools/ytdl-helper.py` is
the full answer. This Worker is the answer for a hosted page when nothing is running on the reader's
machine: it answers the helper's `/health` and `/captions` with the same JSON.

## Which one

- **The capture extension** (`extension/`, Load unpacked) reads captions from the person's *own*
  browser and address, with no server and no account. It cannot be rate-limited as a datacenter and
  needs nothing deployed. Prefer it for yourself.
- **This Worker** is for people who will not install an extension, or a shared hosted copy. YouTube
  sees Cloudflare's addresses, not theirs (see below).
- Both use the same reader, `extension/captions.js`.

## Use

```bash
cd tools/cf-captions
npx wrangler login          # your own Cloudflare account
npx wrangler deploy         # prints https://holodeck-captions.<you>.workers.dev
```

Then in the page: Settings → "yt-dlp helper" → paste that URL (stored as `hd:ytdl`). Nothing else
changes; a pasted YouTube link now ingests with its captions, `via your yt-dlp helper`.

## What is measured, and what is not

- Measured 2026-10-13 from an ordinary address: the ANDROID and IOS innertube clients return the
  caption tracks for a video, and the track body comes back with real content (no token). The
  WEB-embedded and TV clients no longer do.
- **Not measured: how YouTube treats Cloudflare's egress addresses.** Datacenter ranges are often
  answered with `LOGIN_REQUIRED` ("confirm you're not a bot"). If that happens the Worker returns a
  502 carrying the reason, and the page reports it; the local helper remains the fallback. Deploy it and
  hit `/captions?id=jNQXAC9IVRw` to find out before relying on it.
- The client versions in `worker.mjs` age. When captions stop coming back, update `CLIENTS`.
- It uses YouTube's unofficial player API. Read their terms for your use.

## Scope

GET `/health` and GET `/captions?id=<11-char id>&lang=<code>` only, to youtube.com only, for the
origins in `ALLOW_ORIGINS` only. No `/audio`, `/clip` or `/stitch` (those need yt-dlp and ffmpeg).
Whisper-from-audio still needs the local helper or an uploaded file.

```bash
node --test tools/cf-captions/worker.test.mjs
```
