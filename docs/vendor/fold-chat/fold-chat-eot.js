// fold-chat-eot.js — the EOT of a fold: the log of CONTENT that was folded.
//
// penelope keeps a compact, foldable provenance ledger (organs/generation/provenance.mjs, schema
// "Provenance@2", carried inside "ArrangementEOT@2"): a source is stored once under a stable key; events
// point to it and to a parent event, with byte anchors where material exists. It records TRANSFORMATIONS
// (read, arrange, draw, hunt, fold, verify, repair …), not just citations. This is that ledger, ported so a
// fold built in the browser has the same shape — and the SAME id derivation: ids are
// `src_|evt_` + the first 20 hex of sha256(JSON.stringify(value)), identical to penelope's for identical input
// (fold-chat-eot.test.mjs checks that against node's crypto).
//
// What this is NOT: a copy of penelope's own run. penelope's code lane returns per-unit outcomes, not its
// ledger, so events for a penelope attempt are built from that outcome record and say so in `detail.via`;
// the edits between attempts, the sandbox's observations and janus's ruling are recorded by this app. The
// document's `giver` says "the-fold (browser)" — it never claims to be penelope's file.
//
// Pure: no DOM, no network.

import { foldedLines, artifactOf } from "./fold-chat-fold.js";
import { diffLines, diffStat } from "./fold-chat-workspace.js";

// ───────────────────────── sha256 (synchronous, so ids can be derived inline) ─────────────────────────
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
export function sha256Hex(str) {
  const msg = new TextEncoder().encode(String(str));
  const l = msg.length, padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  padded.set(msg); padded[l] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor((l * 8) / 4294967296)); dv.setUint32(padded.length - 4, (l * 8) >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g), t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c), t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map((x) => x.toString(16).padStart(8, "0")).join("");
}

/** penelope's stableProvenanceId, exactly: prefix_ + first 20 hex of sha256(JSON.stringify(value)). */
export const stableProvenanceId = (value, prefix = "src") => `${prefix}_${sha256Hex(JSON.stringify(value)).slice(0, 20)}`;
export const byteRange = (start, end) => ({ unit: "byte", start, end });

// ───────────────────────── the ledger (same API and behavior as penelope's ProvenanceLedger) ─────────────────────────
export class EotLedger {
  constructor({ artifact = "unknown", encoding = "utf8", position = null } = {}) {
    this.position = position == null ? null : JSON.parse(JSON.stringify(position));
    this.artifact = artifact; this.encoding = encoding;
    this.sources = new Map(); this.events = []; this.byKey = new Map();
  }
  source({ kind, locator, anchor = null, meta = null }) {
    const source_id = stableProvenanceId({ kind, locator }, "src");
    if (!this.sources.has(source_id)) this.sources.set(source_id, { source_id, kind, locator, ...(anchor ? { anchor } : {}), ...(meta ? { meta } : {}) });
    return source_id;
  }
  event({ stage, source_id = null, parent = null, unit = null, range = null, transform = null, detail = null, ibid = null, position = this.position }) {
    const key = JSON.stringify({ stage, source_id, parent, unit, range, transform, ibid, detail, position });
    const existing = this.byKey.get(key);
    if (existing) return existing;
    const id = stableProvenanceId({ n: this.events.length, stage, source_id, parent, unit, range, transform, ibid, detail, position }, "evt");
    this.events.push({ event_id: id, stage, position: position == null ? null : JSON.parse(JSON.stringify(position)), ...(source_id ? { source_id } : {}), ...(parent ? { parent } : {}), ...(unit ? { unit } : {}), ...(range ? { range } : {}), ...(transform ? { transform } : {}), ...(ibid ? { ibid } : {}), ...(detail ? { detail } : {}) });
    this.byKey.set(key, id);
    return id;
  }
  ibid(event_id, detail = null) { return this.event({ stage: "ibid", ibid: event_id, detail }); }
  eot({ root = null, artifact = this.artifact } = {}) {
    return { schema: "Provenance@2", artifact, position: this.position == null ? null : JSON.parse(JSON.stringify(this.position)), addressSpace: { artifact: "folded-bytes", unit: "byte", encoding: this.encoding }, sources: JSON.parse(JSON.stringify([...this.sources.values()])), events: JSON.parse(JSON.stringify(this.events)), ...(root ? { root } : {}) };
  }
}

// ───────────────────────── a fold → its EOT ─────────────────────────
const utf8Len = (s) => new TextEncoder().encode(s).length;
/** Byte offset of the start of each line, so a unit's lines become a byte range in the folded artifact. */
function lineOffsets(code) {
  const out = [0]; let at = 0;
  for (const line of String(code).split("\n")) { at += utf8Len(line) + 1; out.push(at); }
  return out;
}
const PEN_STAGE = { swarm: ["arrange", "unit-spec"], field: ["draw", "field→snip"], hunt: ["hunt", "hunt→candidate"], mouth: ["draw", "prompt-from-spec"], gate: ["verify", "artifact→verification"] };

/**
 * Build the ArrangementEOT for a fold. Deterministic: the same fold always yields the same document, ids included.
 * Returns { schema:"ArrangementEOT@2", …, provenance: Provenance@2 }.
 */
export function eotFromFold(fold, { now = null, trace = null } = {}) {
  const led = new EotLedger({ artifact: "html-or-code", position: null });
  const task = String(fold.task || "");
  const taskSrc = led.source({ kind: "task", locator: sha256Hex(task).slice(0, 20), anchor: byteRange(0, utf8Len(task)), meta: { text: task.slice(0, 300) } });
  const intent = led.event({ stage: "intent", source_id: taskSrc, transform: "request→task" });
  if (trace) trace.push({ event_id: intent, seq: 0, round: null, stage: "intent" });   // trace[i] describes events[i]: which action-log entry and attempt it came from
  let chain = intent;
  const lastEventOfRound = new Map();
  const verByRound = new Map(fold.versions.map((v) => [v.round, v]));
  let prevFoldEvt = null;

  for (const e of fold.log) {
    const v = verByRound.get(e.round) || null;
    const code = v?.code ?? "";
    const verSrc = v ? led.source({ kind: "artifact-version", locator: `attempt-${v.round}:${sha256Hex(code).slice(0, 20)}`, anchor: byteRange(0, utf8Len(code)), meta: { maker: v.maker, language: v.kind, lines: v.lines } }) : null;
    const whole = v ? byteRange(0, utf8Len(code)) : null;
    const via = e.by;
    let id = null;
    switch (e.stage) {
      case "read":
        id = led.event({ stage: "read", source_id: taskSrc, parent: chain, transform: e.by === "khora" ? "task→referents" : "task→requirements", detail: { via: e.by, what: e.title, note: e.detail || undefined, ok: e.ok ?? undefined } });
        break;
      case "arrange":
        id = led.event({ stage: "arrange", source_id: taskSrc, parent: chain, unit: e.unit || undefined, transform: "unit-spec", detail: { via: "penelope", note: e.title, ok: e.ok ?? undefined } });
        break;
      case "draw": {
        const unitRange = (() => { if (!v || !e.unit) return whole; const L = foldedLines(fold, v).filter((l) => l.unit === e.unit); if (!L.length) return whole; const off = lineOffsets(code); return byteRange(off[L[0].n - 1], Math.min(off[L[L.length - 1].n], utf8Len(code))); })();   // the last line has no newline after it: never past the end of the file
        const mp = e.by === "penelope" ? PEN_STAGE[(e.title || "").split(" ")[0]] : null;
        id = led.event({ stage: mp ? mp[0] : "draw", source_id: verSrc, parent: chain, unit: e.unit || undefined, range: unitRange || undefined, transform: mp ? mp[1] : "prompt-from-spec", detail: { via, maker: e.by.startsWith("remote:") ? e.by.slice(7) : e.by, note: e.title, ok: e.ok ?? undefined } });
        break;
      }
      case "edit":
        id = led.event({ stage: "repair", source_id: verSrc, parent: prevFoldEvt || chain, range: whole || undefined, transform: e.edit?.versionN > 1 ? "attempt→attempt" : "request→first-draft", detail: { via: "the-fold", added: e.edit?.added, removed: e.edit?.removed, hunks: e.edit?.hunks, ok: e.ok ?? undefined } });
        break;
      case "fold":
        id = led.event({ stage: "fold", source_id: verSrc, parent: chain, range: whole || undefined, transform: "contributions→artifact", detail: { bytes: v ? utf8Len(code) : undefined, units: v?.units?.length || undefined, via } });
        prevFoldEvt = id;
        break;
      case "observe": case "verify":
        id = led.event({ stage: "verify", source_id: verSrc || taskSrc, parent: lastEventOfRound.get(e.round) || chain, transform: e.stage === "observe" ? "artifact→observation" : "observations→ruling", detail: { via, check: e.title, note: e.detail || undefined, ok: e.ok ?? undefined } });
        break;
      case "repair":
        id = led.event({ stage: "repair", source_id: taskSrc, parent: chain, transform: "problems→prompt", detail: { via: "the-fold", problems: (e.detail || "").split(" | ").filter(Boolean) } });
        break;
      case "escalate": case "retry":
        id = led.event({ stage: "prior", source_id: taskSrc, parent: chain, transform: e.stage === "escalate" ? "route→maker" : "wait→retry", detail: { via: "the-fold", note: e.title, why: e.detail || undefined } });
        break;
      case "done":
        id = led.event({ stage: "materialize", source_id: artifactOf(fold) ? led.source({ kind: "artifact-version", locator: `attempt-${artifactOf(fold).round}:${sha256Hex(artifactOf(fold).code).slice(0, 20)}`, anchor: byteRange(0, utf8Len(artifactOf(fold).code)) }) : taskSrc, parent: chain, transform: "artifact→product", detail: { ok: e.ok ?? undefined, status: fold.status, note: e.detail || e.title } });
        break;
      default: id = null;
    }
    if (id) { chain = id; if (e.round != null) lastEventOfRound.set(e.round, id); if (trace && !trace.some((t) => t.event_id === id)) trace.push({ event_id: id, seq: e.seq, round: e.round, stage: e.stage }); }
  }
  const eot = led.eot({ root: chain });
  return {
    schema: "ArrangementEOT@2", kind: "fold", giver: "the-fold (browser)", standing: "disclosed",
    prompt: task, model: null, noModel: false, law: "mouth-last, hunt-first, multiple-framings, falsify-or-die",
    provenance: eot,
    corpus: { note: "contributions are the attempts in `provenance.sources` (kind artifact-version); each carries its maker and byte range", attempts: fold.versions.map((v) => ({ attempt: v.round, maker: v.maker, bytes: utf8Len(v.code), lines: v.lines })) },
    swarm: { verdict: fold.status, scars: fold.versions.flatMap((v) => v.problems.map((p) => ({ attempt: v.round, problem: p }))) },
    product: { language: artifactOf(fold)?.kind || null, bytes: artifactOf(fold) ? utf8Len(artifactOf(fold).code) : 0 },
    ...(now ? { builtAt: now } : {}),
  };
}

/** Which attempt EXISTS once the first k+1 events have happened — the cursor's view of the artifact. Null before any draft. */
export function versionAtCursor(fold, trace, k) {
  const DRAFTY = new Set(["draw", "edit", "fold", "observe", "verify", "done"]);   // events that only happen once an attempt's code exists
  let round = null;
  for (let i = 0; i <= k && i < trace.length; i++) { const t = trace[i]; if (t.round != null && DRAFTY.has(t.stage) && fold.versions.some((v) => v.round === t.round)) round = t.round; }
  return round == null ? null : fold.versions.find((v) => v.round === round) || null;
}

/**
 * The code an event stands for — what you read when you click it in the EOT.
 *   edit events (attempt→attempt, request→first-draft)  → "diff": the WHOLE file with every added / removed line marked
 *   events with a byte range inside an attempt            → "range": exactly those bytes, cut out of that attempt's code
 *   fold / materialize / whole-file draws                 → "whole": the attempt's complete code
 *   everything else (reads, checks, rulings)              → null: they changed no code
 */
export function codeOfEvent(fold, ev, sources = new Map()) {
  const src = ev.source_id ? sources.get(ev.source_id) : null;
  if (!src || src.kind !== "artifact-version") return null;
  const m = /^attempt-(\d+):/.exec(String(src.locator || ""));
  const v = m ? fold.versions.find((x) => x.round === Number(m[1])) : null;
  if (!v) return null;
  const code = String(v.code || "");
  if (ev.stage === "repair" && (ev.transform === "attempt→attempt" || ev.transform === "request→first-draft")) {
    const at = fold.versions.indexOf(v), prev = at > 0 ? fold.versions[at - 1] : null;
    const diff = diffLines(prev ? prev.code : null, code);
    const stat = diffStat(diff);
    return { kind: "diff", round: v.round, from: prev ? prev.round : null, diff, added: stat.added, removed: stat.removed, lines: v.lines };
  }
  const total = new TextEncoder().encode(code).length;
  const r = ev.range;
  if (r && (r.start > 0 || r.end < total) && r.end > r.start) {
    const bytes = new TextEncoder().encode(code);
    const text = new TextDecoder().decode(bytes.slice(r.start, Math.min(r.end, total)));
    const startLine = new TextDecoder().decode(bytes.slice(0, r.start)).split("\n").length;
    return { kind: "range", round: v.round, text, startLine, endLine: startLine + text.replace(/\n$/, "").split("\n").length - 1, bytes: [r.start, r.end], lines: v.lines };
  }
  if (r || ev.stage === "fold" || ev.stage === "materialize") return { kind: "whole", round: v.round, text: code, startLine: 1, endLine: v.lines, bytes: [0, total], lines: v.lines };
  return null;
}

/** One compact line for an event, for display: what happened to which bytes, from where. */
export function describeEvent(ev, sources = new Map()) {
  const src = ev.source_id ? sources.get(ev.source_id) : null;
  const rng = ev.range ? `bytes ${ev.range.start}–${ev.range.end}` : null;
  return { id: ev.event_id, short: ev.event_id.slice(4, 12), stage: ev.stage, transform: ev.transform || "", unit: ev.unit || "", range: rng, source: src ? `${src.kind}${src.locator ? " · " + String(src.locator).slice(0, 26) : ""}` : "", parent: ev.parent ? ev.parent.slice(4, 12) : "", ok: ev.detail?.ok ?? null, detail: ev.detail || null };
}
