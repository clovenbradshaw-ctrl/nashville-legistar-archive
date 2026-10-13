// fold-chat-seal.js — what "sealed" is allowed to mean, and the audit that holds it to that.
//
// "sealed-external" is heimdall's GATE: the request declared a privacy mode and
// the bridge let it through. It says nothing about what the outside model can
// READ. The Fold's sealed design is stronger and has four rungs, and every
// outbound request is graded against exactly one of them — never rounded up:
//
//   gate      raw content under the gate. The provider can read the ask and any
//             code it carries. Honest, useful, and NOT the possible-worlds seal.
//   masked    the ask and code, still readable as text, with names, paths, emails,
//             keys and the like swapped for placeholders locally and a scan of the
//             exact bytes finding none left (fold-chat-deid.js). Pseudonymization of
//             the particulars only: what the code DOES stays visible. Not "sealed".
//   abstract  private particulars replaced by opaque symbols; a local scan of
//             the exact bytes finds none of them. Pseudonymization — relationships
//             and repeated queries can still reveal information.
//   worlds    abstract AND one of a set of N possible worlds sent together, with
//             no marker of which matches the local evidence, AND the set passed
//             the symmetry audit (below). The real index and the symbol→referent
//             mapping (the "key") stay on this device and are never sent.
//
// The audit has four parts: (1) the exact bytes that left (heimdall holds them
// — see heimdall/src/audit.js), checked against what this surface meant to send;
// (2) a scan of those bytes for private particulars and credentials; (3) the
// level above, from what the request actually is; (4) for a world set, a
// measured attack on its symmetry — a decoy set an adversary can pick the real
// world out of is a leak, however sealed it is labelled.
//
// Pure and testable: the hash uses WebCrypto (browser and node), nothing else
// touches the network or the DOM.

// ───────────────────────── hashing, identical to heimdall's ─────────────────────────

const enc = new TextEncoder();
/** sha-256 of a string, as hex. */
export async function sha256Hex(s) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", enc.encode(String(s)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** The canonical text of a message list — the SAME formula as heimdall's audit.js. */
export function canonMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map((m) => `${String(m?.role ?? "")}\n${typeof m?.content === "string" ? m.content : JSON.stringify(m?.content ?? "")}`).join("\n\u0000\n");
}
export const contentSha256 = (messages) => sha256Hex(canonMessages(messages));

// ───────────────────────── provenance ─────────────────────────

/** Where a piece of outbound content came from. The audit refuses what it cannot place. */
export const PROVENANCE = Object.freeze({
  template: "fixed instructions the Fold itself wrote",
  ask: "what the person typed this turn",
  generated: "code or text a model produced in this run",
  symbolic: "opaque symbols and formal relations — no particulars",
  masked: "the ask or code with its private particulars swapped for placeholders on this device — the structure is still readable",
  world: "one possible world in a set",
  "workspace-file": "bytes read from the person's own files",
  "local-read": "text the khora read from the person's documents",
});
/** What may never leave under ANY level without an explicit per-file grant. */
export const NEVER_SENT = Object.freeze(["workspace-file", "local-read"]);

/** Attach provenance to messages: [{role, content, provenance}] → the wire messages and the segment list. */
export function withProvenance(parts) {
  const messages = [], segments = [];
  for (const p of parts) {
    if (!p || typeof p.content !== "string") continue;
    messages.push({ role: p.role || "user", content: p.content });
    segments.push({ role: p.role || "user", provenance: p.provenance || "unknown", chars: p.content.length });
  }
  return { messages, segments };
}

// ───────────────────────── what must not appear in what left ─────────────────────────

export const SECRET_PATTERNS = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["OpenAI/Anthropic-style key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["bearer credential", /\bBearer\s+[A-Za-z0-9._~+\/-]{20,}=*/],
  ["password assignment", /\b(?:password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["']?[^\s"']{8,}/i],
];
const PATH_PATTERNS = [
  ["home directory path", /(?:\/Users|\/home)\/[A-Za-z0-9._-]+\//],
  ["Windows user path", /[A-Za-z]:\\Users\\[^\\\s]+\\/],
];
export const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

/** Credentials, local paths and emails in `text`. Each hit names what it found and where, never echoing the secret. */
export function scanSecrets(text) {
  const t = String(text ?? ""), hits = [];
  for (const [kind, re] of [...SECRET_PATTERNS, ...PATH_PATTERNS, ["email address", EMAIL]]) {
    const m = t.match(re);
    if (m) hits.push({ kind, at: m.index, sample: kind === "email address" || /path/.test(kind) ? m[0].slice(0, 60) : "[redacted]" });
  }
  return hits;
}

const fold = (s) => String(s).normalize("NFKC").toLowerCase();

/** A registry of private particulars — names, identifiers, paths, anything read locally that must not leave. */
export function createTaint() {
  const terms = new Map(); // folded term → { term, kind }
  return {
    add(term, kind = "particular") {
      const k = fold(String(term).trim());
      if (k.length >= 3 && !terms.has(k)) terms.set(k, { term: String(term).trim(), kind });
      return this;
    },
    addAll(list, kind) { for (const t of list || []) this.add(t, kind); return this; },
    /** Words and identifiers worth tracking from a local text (capitalised names, quoted strings, identifiers). */
    addFromText(text, kind = "local-read") {
      const t = String(text ?? "");
      for (const m of t.matchAll(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+\b/g)) this.add(m[0], kind);                 // "Eleanor Voss"
      for (const m of t.matchAll(/["“]([^"”\n]{3,40})["”]/g)) this.add(m[1], kind);                                   // quoted strings
      for (const m of t.matchAll(/\b[A-Za-z_$][\w$]{5,}\b/g)) if (/[a-z][A-Z]|_/.test(m[0])) this.add(m[0], kind);  // camelCase / snake_case identifiers
      return this;
    },
    get size() { return terms.size; },
    /** Every registered term found in `text` — the leak list. */
    scan(text) {
      const f = fold(text), hits = [];
      for (const [k, v] of terms) { const at = f.indexOf(k); if (at >= 0) hits.push({ term: v.term, kind: v.kind, at }); }
      return hits;
    },
  };
}

// ───────────────────────── the level ─────────────────────────

/**
 * Grade ONE outbound request. `req` = { messages, segments, worlds?:{setId,slot,n}, symmetry?:{passed} , gate:boolean }.
 * Returns { level, leaks, notes, sealed } — `sealed` is true only for the rungs
 * above the gate with no leaks, so a surface cannot show a green seal for raw content.
 */
export function gradeRequest(req, { taint = null } = {}) {
  const body = canonMessages(req.messages);
  // A value already swapped for a placeholder is not a secret: "password = SECRET_1" and "/Users/USER_1/" are what masking leaves behind.
  const secretHits = scanSecrets(body.replace(/\b(?:PERSON|NAME|ORG|LOC|GROUP|URL|HANDLE|ADDRESS|USER|PATH|FILE|TERM|EMAIL|PHONE|SECRET|HOST|ID)_[a-hj-km-np-z2-9]{6}\b/gi, "§"));
  const taintHits = taint ? taint.scan(body) : [];
  const provenance = (req.segments || []).map((s) => s.provenance);
  const forbidden = provenance.filter((p) => NEVER_SENT.includes(p));
  const unplaced = provenance.filter((p) => !(p in PROVENANCE));
  const leaks = [
    ...secretHits.map((h) => ({ type: "secret", ...h })),
    ...taintHits.map((h) => ({ type: "particular", ...h })),
    ...forbidden.map((p) => ({ type: "provenance", kind: p, detail: "content that must stay on this device was placed in the request" })),
    ...unplaced.map((p) => ({ type: "provenance", kind: p, detail: "content of unknown origin — the audit cannot place it" })),
  ];
  const notes = [];
  if (!req.gate) leaks.push({ type: "gate", detail: "the request did not declare heimdall_privacy:\"sealed-external\"" });
  const raw = provenance.some((p) => p === "ask" || p === "generated");
  const symbolicOnly = provenance.length > 0 && provenance.every((p) => p === "template" || p === "symbolic" || p === "world");
  const maskedOnly = provenance.length > 0 && provenance.every((p) => p === "template" || p === "symbolic" || p === "world" || p === "masked");
  let level = "gate";
  if (maskedOnly && !symbolicOnly && !leaks.length) level = "masked";
  if (symbolicOnly && !leaks.length) level = "abstract";
  if (level === "abstract" && req.worlds && req.worlds.n >= 3 && req.symmetry?.passed === true) level = "worlds";
  if (level === "abstract" && req.worlds && req.worlds.n >= 3 && req.symmetry?.passed !== true) notes.push(req.symmetry ? "the world set FAILED the symmetry audit — graded as abstract only" : "the world set was not symmetry-audited — graded as abstract only");
  if (level === "masked") notes.push("masked: names, paths, emails and keys were replaced by placeholders on this device and a scan found none left; the outside provider can still read the structure of the request and the code");
  if (raw) notes.push("raw content: the outside provider can read the ask" + (provenance.includes("generated") ? " and the code it carries" : ""));
  return { level, leaks, notes, sealed: (level === "abstract" || level === "worlds") && leaks.length === 0, raw, secretHits: secretHits.length, particularHits: taintHits.length };
}

/** Compare what this surface meant to send with what heimdall says left. */
export async function verifyAgainst(mine, theirs) {
  const wanted = await contentSha256(mine.messages);
  const problems = [];
  if (!theirs) return { verified: false, problems: ["heimdall holds no record of this request"], wanted };
  if (theirs.request?.contentSha256 !== wanted) problems.push("the message content heimdall sent differs from what this surface built");
  if (theirs.privacy !== "sealed-external" && theirs.privacy !== "explicit") problems.push(`heimdall recorded privacy mode ${JSON.stringify(theirs.privacy)}`);
  if (mine.worlds && (theirs.worlds?.setId !== mine.worlds.setId || theirs.worlds?.slot !== mine.worlds.slot)) problems.push("the world slot heimdall recorded differs from what was sent");
  if (!mine.worlds && theirs.worlds) problems.push("heimdall recorded a world slot this surface did not send");
  return { verified: problems.length === 0, problems, wanted, host: theirs.host, provider: theirs.provider, model: theirs.model, wireSha256: theirs.request?.sha256, bytes: theirs.request?.bytes, status: theirs.response?.status ?? null };
}

// ───────────────────────── possible worlds: construction and attack ─────────────────────────
//
// The toy model from the design note. A "world" is a vector of k binary facts. The
// real world W* is the one consistent with the locally witnessed evidence. A set
// of N worlds is sent; the adversary sees only the set and must name W*.
//
//   naive      decoys are neighbours of W* (a couple of facts flipped). The real
//              world is then the centre of the cluster and a centroid attack finds it.
//   symmetric  every world is the same random distance from a hidden centre that
//              is NOT in the set, with the real world placed at a random slot — so
//              the set's distribution does not depend on which member is real.

export function mulberry32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const randBits = (k, rng) => Array.from({ length: k }, () => (rng() < 0.5 ? 1 : 0));
const flipSome = (v, w, rng) => { const out = v.slice(); const idx = new Set(); while (idx.size < Math.min(w, v.length)) idx.add(Math.floor(rng() * v.length)); for (const i of idx) out[i] ^= 1; return out; };
const xor = (a, b) => a.map((x, i) => x ^ b[i]);
const maskOf = (k, w, rng) => { const m = new Array(k).fill(0); const idx = new Set(); while (idx.size < Math.min(w, k)) idx.add(Math.floor(rng() * k)); for (const i of idx) m[i] = 1; return m; };
const hamming = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] ^ b[i]; return d; };

/** Build a set of N worlds. Returns { worlds, real } — `real` is the KEY and never leaves the device. */
export function makeWorldSet({ k = 16, n = 5, mode = "symmetric", flips = 1, rng = Math.random }) {
  const truth = randBits(k, rng);
  if (mode === "naive") {
    const worlds = [truth];
    while (worlds.length < n) worlds.push(flipSome(truth, 1 + Math.floor(rng() * (flips + 1)) , rng));   // 1..flips+1 facts flipped
    const order = shuffle(worlds.map((_, i) => i), rng);
    return { worlds: order.map((i) => worlds[i]), real: order.indexOf(0) };
  }
  const w = Math.max(1, flips);
  const masks = Array.from({ length: n }, () => maskOf(k, w, rng));
  const real = Math.floor(rng() * n);
  const centre = xor(truth, masks[real]);                       // hidden; not a member of the set
  return { worlds: masks.map((m) => xor(centre, m)), real };
}
function shuffle(a, rng) { const o = a.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }

/** The adversaries. Each takes the set (no key) and names the slot it thinks is real. */
export const ATTACKS = Object.freeze({
  centroid: (W) => argBest(W, (w, i) => -W.reduce((s, x, j) => s + (j === i ? 0 : hamming(w, x)), 0)),
  outlier: (W) => argBest(W, (w, i) => W.reduce((s, x, j) => s + (j === i ? 0 : hamming(w, x)), 0)),
  majority: (W) => { const k = W[0].length; const maj = Array.from({ length: k }, (_, c) => (W.reduce((s, w) => s + w[c], 0) * 2 > W.length ? 1 : 0)); return argBest(W, (w) => -hamming(w, maj)); },
  position: (W) => 0,
  lexicographic: (W) => argBest(W, (w, i) => -parseInt(w.slice(0, 20).join("") || "0", 2)),
});
function argBest(W, score) { let bi = 0, bs = -Infinity; W.forEach((w, i) => { const s = score(w, i); if (s > bs) { bs = s; bi = i; } }); return bi; }

/**
 * Measure a generator (the built-in `mode`, or any `generate(rng) → { worlds, real }` you supply — so a real set builder is audited, not just the toy): how often does each attack name the real world? An honest
 * set puts every attack at chance (1/n); a set an adversary can read the real
 * world from is a leak. `tolerance` is in standard deviations of the binomial.
 */
export function symmetryAudit({ mode = "symmetric", k = 16, n = 5, flips = 1, trials = 4000, seed = 1, tolerance = 4, generate = null } = {}) {
  const rng = mulberry32(seed);
  const hits = Object.fromEntries(Object.keys(ATTACKS).map((a) => [a, 0]));
  for (let t = 0; t < trials; t++) {
    const { worlds, real } = generate ? generate(rng) : makeWorldSet({ k, n, mode, flips, rng });
    for (const [name, atk] of Object.entries(ATTACKS)) if (atk(worlds) === real) hits[name]++;
  }
  const chance = 1 / n, sd = Math.sqrt((chance * (1 - chance)) / trials);
  const rates = Object.fromEntries(Object.entries(hits).map(([a, h]) => [a, h / trials]));
  const worst = Object.entries(rates).sort((a, b) => b[1] - a[1])[0];
  const leaking = Object.entries(rates).filter(([, r]) => r > chance + tolerance * sd).map(([a]) => a);
  return { mode, n, k, trials, chance, rates, worst: { attack: worst[0], rate: worst[1] }, leaking, passed: leaking.length === 0 };
}

/** Rough token estimate (≈ 4 chars/token) — an estimate, labelled as one. */
export const estTokens = (s) => Math.ceil(String(s ?? "").length / 4);
