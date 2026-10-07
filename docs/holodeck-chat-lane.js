// holodeck-chat-lane.js — The Fold's chat, wired to Heimdall's bridge.
//
// The fold's Ask chat ordinarily speaks to a model on this machine (WebLLM in
// the tab, or Ollama). Heimdall is the Fold's execution metabolism: its bridge
// (localhost:8790) holds the fleet, linked native hosts, and the configured
// REMOTE providers, and it enforces the sealed-external gate — an outside
// model may only ever receive the projection the Fold builds, never raw
// workspace spans. This module is the fold's half of that wire:
//
//   probe(base)    GET /api/tags  -> the models heimdall can serve, with the
//                  heimdall per-model metadata that marks the outside ones.
//   isSealed(m)    a model heimdall marks frontier / sealed-only.
//   chat(...)      POST /api/chat (Ollama NDJSON) to the bridge; for a sealed
//                  model the body carries heimdall_privacy:"sealed-external",
//                  and the caller (holodeck-ask) withholds verbatim spans.
//   meter/frontier the savings meter and the gate's shape, for the drawer.
//
// (Named chat-lane to stay clear of holodeck-heimdall.js, the fold's door onto
// the heimdall fleet — invite minting and pairing codes.)
//
// Browser + node (tests inject fetch).

export const HEIMDALL = 'http://localhost:8790';

/** True when heimdall's metadata marks this model sealed-only (an outside
 *  provider). A sealed model must never receive raw workspace material. */
export function isSealed(meta) {
  return !!(meta && (meta.frontier || meta.privacy === 'sealed-external'));
}

/** The bridge's model list, from /api/tags (Ollama shape, with the heimdall
 *  per-model metadata). Returns { ok, models, why } — never throws. */
export async function probe(base = HEIMDALL, { fetchImpl = fetch } = {}) {
  try {
    const r = await fetchImpl(String(base).replace(/\/+$/, '') + '/api/tags', { cache: 'no-store' });
    if (!r.ok) return { ok: false, why: 'heimdall answered ' + r.status };
    const j = await r.json();
    const models = (j.models || []).filter(m => m && m.name).map(m => {
      const h = m.heimdall || {};
      return { name: String(m.name), sealed: isSealed(h), provider: h.frontier || h.native || (h.webllm ? 'webllm' : h.workers ? 'fleet' : 'local'), context_window: h.context_window || null };
    });
    return { ok: true, models };
  } catch (e) { return { ok: false, why: String(e && e.message || e) }; }
}

/** One chat turn over the bridge (Ollama NDJSON). For a sealed model the body
 *  carries heimdall_privacy:"sealed-external" — the Fold selects the privacy
 *  mode and seals first; the caller must NOT include verbatim spans. Resolves
 *  { text, stats } with stats from the final NDJSON line; throws on bridge
 *  errors, honoring abort via signal. */
export async function chat(base = HEIMDALL, model, messages, { onToken = null, signal = null, maxTokens = null, sealed = false, format = null, fetchImpl = fetch } = {}) {
  const b = String(base).replace(/\/+$/, '');
  const body = { model, messages, stream: true, keep_alive: '3600s', options: { num_ctx: 4096, temperature: 0.2, ...(maxTokens ? { num_predict: maxTokens } : {}) } };
  if (sealed) body.heimdall_privacy = 'sealed-external';
  if (format) body.format = format;
  const r = await fetchImpl(b + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!r.ok) throw new Error('heimdall ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const rd = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '', out = '', stats = null;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let j;
      try { j = JSON.parse(line); } catch (e) { continue; }
      if (j.message && j.message.content) { out += j.message.content; onToken && onToken(out); }
      if (j.done) stats = j;
    }
  }
  if (stats && stats.error) throw new Error(String(stats.error));
  return { text: out, stats };
}

/** The savings meter (exact external tokens + marked estimates), for the
 *  evidence drawer. Never throws. */
export async function meter(base = HEIMDALL, { fetchImpl = fetch } = {}) {
  try {
    const r = await fetchImpl(String(base).replace(/\/+$/, '') + '/api/meter', { cache: 'no-store' });
    if (!r.ok) return null;
    return r.json();
  } catch (e) { return null; }
}

/** The sealed gate's shape (which providers are configured, and the rule). */
export async function frontier(base = HEIMDALL, { fetchImpl = fetch } = {}) {
  try {
    const r = await fetchImpl(String(base).replace(/\/+$/, '') + '/api/frontier', { cache: 'no-store' });
    if (!r.ok) return null;
    return r.json();
  } catch (e) { return null; }
}