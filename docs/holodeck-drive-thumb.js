// holodeck-drive-thumb.js — previews for every source type, made locally and
// cached BY CONTENT HASH. A preview is either made from the source's own bytes
// or text, or it is the type icon — never anything in between.
//
// Pure planning + cache + queue. The two things that need a browser (decode an
// image, render a PDF page) and the persistent store are injected, so the
// guarantees are testable without one.
//
// Why a content hash and not the source id: an id can point at new bytes (a
// re-fetched page, a replaced file) and an id-keyed cache would show the old
// picture under the new source. A hash cannot.

export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const d = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// next power of two at or above the pixel width asked for: a resize does not
// regenerate every thumbnail, and nothing here is a tuned size
export const bucketOf = px => { const n = Math.max(1, Math.ceil(px)); let b = 1; while (b < n) b <<= 1; return b; };

// characters that fit in a tile at a font size: em-width of proportional text
// is ≈ 0.55 em (a typographic average, not tuned to this page)
export const EM_WIDTH = 0.55;
export function snippetBudget({ w, h, fontPx, lineH }) {
  const perLine = Math.max(1, Math.floor(w / (fontPx * EM_WIDTH))), lines = Math.max(1, Math.floor(h / lineH));
  return perLine * lines;
}

const squash = s => String(s).replace(/\s+/g, ' ').trim();
// verbatim prefix of the source's own text (whitespace folded), cut at a word
export function snippetOf(text, budget) {
  const t = squash(text || ''); if (!t) return '';
  if (t.length <= budget) return t;
  const cut = t.slice(0, budget), sp = cut.lastIndexOf(' ');
  return (sp > budget * 0.6 ? cut.slice(0, sp) : cut) + '…';
}
export const isPrefixOf = (snippet, text) => squash(text || '').startsWith(snippet.replace(/…$/, ''));

// What can be tried for an entry, in order. `have` says which raw material exists
// right now: { bytes:{pdf,image}, text:boolean }. Nothing is assumed.
export function planOf(entry, have = {}) {
  if (entry.ytId) return [{ kind: 'youtube', url: 'https://i.ytimg.com/vi/' + encodeURIComponent(entry.ytId) + '/mqdefault.jpg' }];
  const plan = [];
  if (entry.type === 'image' && have.image) plan.push({ kind: 'image' });
  if (entry.type === 'pdf' && have.pdf) plan.push({ kind: 'pdf' });
  if (entry.head && entry.head.trim()) plan.push({ kind: 'text' });
  plan.push({ kind: 'icon' });
  return plan;
}

// The only time constant here, declared once: a render that has produced no
// pixels after this long is treated as failed, so one hung file (a PDF whose
// fonts never arrive, a stalled decode) cannot hold the queue for every other
// preview. 10 s is the point at which a person watching a spinner assumes it
// has failed (Nielsen's attention limit); it is not tuned to any file.
export const RENDER_TIMEOUT_MS = 10_000;
const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });

// in-memory front over an injected persistent store { get(key), put(key, rec) }
export function createCache(store = null) {
  const mem = new Map();
  return {
    async get(key) { if (mem.has(key)) return mem.get(key); const r = store ? await store.get(key).catch(() => null) : null; if (r) mem.set(key, r); return r || null; },
    async put(key, rec) { mem.set(key, rec); if (store) await store.put(key, rec).catch(() => {}); },
    // this session only: a failure is remembered so a bad file is not retried
    // on every scroll, but never persisted — it may be a network or font that
    // is back next time, and a stored "icon" would hide a preview that works
    putSession(key, rec) { mem.set(key, rec); },
    peek(key) { return mem.get(key) || null; },
    size() { return mem.size; },
  };
}

// Resolve ONE preview. Inputs are injected so the same code runs in a test:
//   getBytes(kind) → ArrayBuffer|Uint8Array|null     getText() → string
//   renderImage(bytes, bucket) → {blob,w,h}          renderPdf(bytes, bucket) → {blob,w,h}
// Returns { kind, key, ...} where kind ∈ youtube | image | pdf | text | icon.
// `icon` carries `reason` (why nothing better), so the page can say it.
export async function resolvePreview({ entry, cache, getBytes, getText, renderImage, renderPdf, bucket, budget, timeoutMs = RENDER_TIMEOUT_MS }) {
  const have = { image: entry.type === 'image', pdf: entry.type === 'pdf' };
  const plan = planOf(entry, have);
  let reason = 'no preview could be made from this source';
  for (const step of plan) {
    if (step.kind === 'youtube') return { kind: 'youtube', key: 'yt:' + entry.ytId, url: step.url };
    if (step.kind === 'icon') return { kind: 'icon', key: null, reason };
    if (step.kind === 'text') {
      const text = getText ? await getText() : entry.head;
      const t = text || entry.head; if (!t || !t.trim()) { reason = 'it has no readable text'; continue; }
      const key = 'text:' + (await sha256Hex(t.slice(0, 4096))) + '@' + budget;
      const hit = await cache.get(key); if (hit) return hit;
      const rec = { kind: 'text', key, snippet: snippetOf(t, budget), from: 'its own text' };
      await cache.put(key, rec); return rec;
    }
    // bytes-backed
    const bytes = await getBytes(step.kind);
    if (!bytes || !(bytes.byteLength > 0)) { reason = 'its file is not stored in this browser'; continue; }
    const key = step.kind + ':' + (await sha256Hex(bytes)) + '@' + bucket;
    const hit = await cache.get(key);
    if (hit) return hit.kind === 'icon' ? (reason = hit.reason || reason, { kind: 'icon', key: null, reason }) : hit;
    try {
      const out = await withTimeout(Promise.resolve((step.kind === 'image' ? renderImage : renderPdf)(bytes, bucket)), timeoutMs);
      if (!out || !out.blob) throw new Error('nothing rendered');
      const rec = { kind: step.kind, key, blob: out.blob, w: out.w, h: out.h, from: step.kind === 'pdf' ? 'its first page' : 'the image itself' };
      await cache.put(key, rec); return rec;
    } catch (e) {
      const slow = e && e.message === 'timeout';
      reason = step.kind === 'pdf' ? (slow ? 'its first page took too long to draw' : 'its first page could not be drawn here') : (slow ? 'the image took too long to decode' : 'the image could not be decoded');
      cache.putSession(key, { kind: 'icon', key, reason });
    }
  }
  return { kind: 'icon', key: null, reason };
}

// bounded-concurrency queue: newest request first (what is on screen now wins)
export function createQueue(concurrency = 1) {
  const waiting = []; let running = 0;
  const pump = () => {
    while (running < concurrency && waiting.length) {
      const job = waiting.pop(); if (job.cancelled) continue;
      running++;
      job.fn().then(job.resolve, job.reject).finally(() => { running--; pump(); });
    }
  };
  return {
    add(fn) { let job; const p = new Promise((resolve, reject) => { job = { fn, resolve, reject, cancelled: false }; }); waiting.push(job); pump(); return { promise: p, cancel() { job.cancelled = true; } }; },
    pending() { return waiting.filter(j => !j.cancelled).length; },
    running() { return running; },
  };
}
