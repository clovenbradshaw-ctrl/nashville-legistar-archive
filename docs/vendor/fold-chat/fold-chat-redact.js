// fold-chat-redact.js — the page's door to the local Python PII redactor, and the turn-level routine that uses it.
//
//   createRedactor({ base })      → { spans(texts), health() } over scripts/pii/server.py (Presidio + spaCy), loopback only
//   deidentify(texts, {...})      → { texts, deid, passes, viaRedactor }: mask, then ASK THE REDACTOR AGAIN about the result and
//                                   mask whatever it still finds, until it finds nothing or the passes run out — then refuse.
//
// FAIL CLOSED. If a redactor was supplied and cannot be reached, or the result is still not clean, NOTHING is sent: the
// error says so, never what was in the text. With no redactor supplied the shapes-and-registry floor of fold-chat-deid.js
// still runs, and the caller must not call the result "masked" (viaRedactor is false).
import { createDeid, placeholderRanges, maskableSpans } from "./fold-chat-deid.js";

export const DEFAULT_REDACTOR = "http://127.0.0.1:18795";

/** A typed refusal: `notSent` is true, and the message never carries any of the text. */
export const notSent = (why, extra = {}) => Object.assign(new Error("not sent: " + why), { status: 0, notSent: true, tried: [], sent: [], ...extra });

export function createRedactor({ base = DEFAULT_REDACTOR, fetchImpl = (...a) => fetch(...a), timeoutMs = 8000 } = {}) {
  const url = (p) => String(base).replace(/\/+$/, "") + p;
  const call = async (path, init, signal) => {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
    const onAbort = () => ctl.abort(); signal?.addEventListener?.("abort", onAbort);
    try { return await fetchImpl(url(path), { ...init, signal: ctl.signal }); } finally { clearTimeout(timer); signal?.removeEventListener?.("abort", onAbort); }
  };
  return {
    /** The redactor's spans for each text: [[{start, end, type, score}]], JS string indices. Throws when it cannot answer. */
    async spans(texts, { threshold = 0.35, signal = null } = {}) {
      let r;
      try { r = await call("/redact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ texts, threshold }) }, signal); }
      catch { throw new Error("the PII redactor did not answer"); }
      if (!r?.ok) throw new Error("the PII redactor answered " + (r?.status ?? "nothing"));
      const j = await r.json();
      if (!Array.isArray(j?.spans) || j.spans.length !== texts.length) throw new Error("the PII redactor's answer did not fit the request");
      return j.spans;
    },
    async health({ signal = null } = {}) { try { const r = await call("/health", {}, signal); return r.ok ? await r.json() : null; } catch { return null; } },
  };
}

/** De-identify texts that travel together as one turn. `redact(texts) → spans[][]` is optional (see the header). */
export async function deidentify(texts, { taint = null, extra = [], mode = "default", redact = null, maxPasses = 3, exempt = [], publicIdx = null } = {}) {
  // `publicIdx`: indices of texts the CALLER vouches are public (a specimen's own authored code). Those skip the redactor's judgement only:
  // shapes (keys, emails, paths' usernames), the taint registry and the final residual check still apply to them. A wrong claim leaks, so the
  // caller owns it; with no `publicIdx` every text is masked.
  const pub = new Set(publicIdx || []);
  const deid = createDeid({ taint, extra, mode, exempt });
  let cur = texts.map((t) => String(t ?? ""));
  const ask = async (list) => {
    let s;
    try { s = await redact(list); } catch (e) { throw notSent("the PII redactor could not be reached, so nothing was sent"); }
    if (!Array.isArray(s) || s.length !== list.length) throw notSent("the PII redactor's answer did not fit the request, so nothing was sent");
    return s;
  };
  const judged = async (list) => { const idx = list.map((_, i) => i).filter((i) => !pub.has(i)); const got = idx.length ? await ask(idx.map((i) => list[i])) : []; const out = list.map(() => []); idx.forEach((i, k) => { out[i] = got[k]; }); return out; };
  cur = deid.maskAll(cur, redact ? { spans: await judged(cur) } : undefined);
  let passes = 1;
  if (redact) {
    for (let k = 0; ; k++) {   // ask again about what we are about to send: the redactor reads the MASKED text
      const again = await judged(cur);
      const fresh = cur.map((t, i) => { const ph = placeholderRanges(t); return maskableSpans(again[i], mode).filter((sp) => !ph.some(([a, b]) => sp.start < b && sp.end > a) && !deid.exempts(cur[i].slice(sp.start, sp.end))); });
      if (!fresh.some((f) => f.length)) break;
      if (k + 1 >= maxPasses) throw notSent("the PII redactor still finds personal details after " + maxPasses + " passes");
      cur = deid.maskAll(cur, { spans: fresh }); passes++;
    }
  }
  const left = cur.flatMap((t) => deid.residual(t));
  if (left.length) throw notSent("private details could not be taken out (" + [...new Set(left.map((h) => h.kind))].join(", ") + ")");
  return { texts: cur, deid, passes, viaRedactor: !!redact };
}

/** De-identify a JSON-like value: only the string VALUES go to the redactor — never keys, quotes or punctuation, so a span cannot swallow the structure.
 *  Returns { value, deid, passes, viaRedactor }; `deid.unmask` maps strings back, and `unmaskJSON(deid, v)` maps a whole reply object. */
export async function deidentifyJSON(value, opts = {}) {
  const leaves = [], publicIdx = [];
  const originOf = opts.originOf || null;   // (value, path) → "public" for a string the caller vouches is a specimen's own authored text
  const walk = (v, path = "") => (typeof v === "string" ? (originOf && originOf(v, path) === "public" && publicIdx.push(leaves.length), leaves.push(v), { __leaf: leaves.length - 1 }) : Array.isArray(v) ? v.map((x, i) => walk(x, `${path}[${i}]`)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, path ? `${path}.${k}` : k)])) : v);
  const skeleton = walk(value);
  const out = await deidentify(leaves, { ...opts, publicIdx });
  const fill = (v) => (v && typeof v === "object" && "__leaf" in v && Object.keys(v).length === 1 ? out.texts[v.__leaf] : Array.isArray(v) ? v.map(fill) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)])) : v);
  return { value: fill(skeleton), deid: out.deid, passes: out.passes, viaRedactor: out.viaRedactor };
}
export function unmaskJSON(deid, v) {
  return typeof v === "string" ? deid.unmask(v) : Array.isArray(v) ? v.map((x) => unmaskJSON(deid, x)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unmaskJSON(deid, x)])) : v;
}
