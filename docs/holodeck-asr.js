// holodeck-asr.js — the local transcription service client.
//
// The surface prefers this rung (tools/asr-server.py on 127.0.0.1, wrapping MLX
// Whisper on the Metal GPU): the audio goes to the loopback, no relay sees it.
// fold-net.js's in-browser Whisper (transformers.js) stays the fallback for when
// the service is down. Both return the identical shape, so callers don't care
// which rung answered.

const DEFAULT_URL = 'http://127.0.0.1:11460';

// Everything is in-browser by default: transcription uses the in-tab recognizer unless
// `hd:asr` names a local service (set it to a URL to opt into tools/asr-server.py).
export function asrUrl() {
  try {
    const v = localStorage.getItem('hd:asr');
    if (!v || v === 'off') return null;
    return v.replace(/\/+$/, '');
  } catch (e) { return null; }
}

export async function health(url) {
  const r = await fetch((url || asrUrl()) + '/health', { signal: AbortSignal.timeout(2500) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// bytes: ArrayBuffer (or TypedArray). opts: { language, prompt, task }.
// onProgress: ({stage, pct?}) => void. Returns the same shape as fold-net transcribe.
export async function transcribe(url, bytes, opts = {}, onProgress) {
  url = url || asrUrl();
  if (!url) throw new Error('local transcription is off');
  const q = new URLSearchParams();
  if (opts.language && opts.language !== 'auto') q.set('language', opts.language);
  if (opts.prompt) q.set('prompt', opts.prompt);
  if (opts.task) q.set('task', opts.task);
  const body = bytes instanceof ArrayBuffer ? bytes : (bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes);
  onProgress && onProgress({ stage: 'sending to the local transcriber' });
  const r = await fetch(url + '/transcribe' + (q.toString() ? '?' + q.toString() : ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body,
  });
  if (!r.ok) { let m = 'HTTP ' + r.status; try { const j = await r.json(); if (j && j.error) m = j.error; } catch (e) {} throw new Error(m); }
  onProgress && onProgress({ stage: 'done', pct: 100 });
  return r.json();
}
