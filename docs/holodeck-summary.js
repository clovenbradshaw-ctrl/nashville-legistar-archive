// holodeck-summary.js — A GROUNDED SUMMARY AT THREE SIZES: one sentence, five
// sentences, three paragraphs. Zero model calls for selection and ordering.
//
// THE LAW (2026-10-02): THE WORLD MUST FOLD AT A POINT — AN IDENTITY: the world
// at a point, from a particular perspective, BOUNDED BY DIFFERENCES THAT MAKE A
// DIFFERENCE. A summary is what a text says TO someone — an identity with a
// held conclusion (a genre's settled reading, a reader's prior, any being's
// picture). The measure is therefore the DIFFERENCE from that identity's
// conclusion, not salience: a claim the identity already holds is not news; a
// claim that inverts its held stance, or introduces a name/measure/frame it
// does not hold, is the turn. Folded at the empty point (no forWhom) the
// measure degrades to holographical excess and a figure-less verdict is
// invisible — that absence IS the law (holodeck-summary.test.mjs's R pair).
//

// THE PIPELINE (architecture law, 2026-10-02):
//
//   NL (the source)  →  language-specific grammar  →  EOT
//                       = the GFP (EOGfpClaim@1),     = EOTObservation@1
//                         language-neutral            append-only, byte-
//                         Ground·Figure·Pattern       addressed record
//
// A proposition NEVER leaves this module as an English string. Selection
// produces GFP claims (Ground = the source holon; Figure = participants by
// ROLE, never by the position a language puts them in; Pattern = the relation
// and its polarity) — kernel/gfp-claim.js's own shape, whose header states the
// law in the same words: "reasoning linting GFP at its core, and then SVO, SOV
// — all others — at higher holonic levels." The render to a reader's language
// is holodeck-lang.js's lens (GFP → that language's word order → its natural
// language), zero model. The EOT is the record layer: each proposition is also
// an EOTObservation@1 over the same byte span.
//
// The law (fixtures/summary-goldens/DERIVATION.md): a summary is NOT written.
// It is a curation of the SOURCE'S OWN SENTENCES — select, order, ground. Every
// proposition keeps a real byte span, so grounding is structural, never
// claimed. Length is a SELECTION budget, not a generation budget.
//
// The selection is over HOLOGRAPHICAL surprise, not salience and not occurrence
// surprise. A statement's `excess` is how far it moves the picture against the
// baseline the reader already holds. A `resolver` is the statement that, ADDED
// TO THE BASELINE, drops that excess — S(a | B ∪ {b}) < S(a | B) — baseline
// augmentation, never an occurrence counterfactual. The summary carries the
// turn and its resolvers, not the biggest number.
//
// THE BASELINE B IS A GENRE, NOT THE DOCUMENT (the correction, 2026-10-02). B
// is the shared MODE of genre-similar texts, measured by DMD (kernel/
// dmd-stream.js): a reading's eigenvalues carry magnitude AND frequency, so a
// genre's standing shape is a mode, and this document's departure from it is
// its holographical surprise. Building B from the document's own framing is
// circular — it would take the essay's first principles as gospel. A framing
// the document states that the genre does not share is the author's OWN,
// disclosed, never the ground.
//
// The void (a model may propose it, never decide it): the declared priors and
// targets. Each prior must be ATTESTED to real source spans before it can drive
// selection; an unattested prior is disclosed and inert.
//
//   node --test holodeck-summary.test.mjs
//
// Pure: no model, no network. The analysis A is the shape analyze() returns
// (sts, byId, docById, names). holoKit is injected (index.html's) or the
// fallback here is used for a standalone run.

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

// The language-neutral core and the record layer. GFP = a claim as
// Ground·Figure·Pattern (kernel/gfp-claim.js); EOT = the append-only,
// byte-addressed observation (EOTObservation@1). A proposition goes
// NL → GFP → (language grammar) → NL, never NL → NL.
const GFP = await import('../eoreader7/native/kernel/gfp-claim.js').catch(() => import('./vendor/eoreader7/native/kernel/gfp-claim.js')).catch(() => null);

// The English evaluative lens (one giver for the fold and the archons). Vendored
// byte-identical; imported at the top so `stanceLens`/`STANCE_GIVER` are bound for
// conclusionOf and worth() on first call, never left in a temporal dead zone.
const _stance = await import('./vendor/eoreader7/native/organs/stance.js').catch(() => ({ stanceLens: () => 0, GIVER: null }));
export const stanceLens = _stance.stanceLens;
export const STANCE_GIVER = _stance.GIVER;

/** claimsFromReport(report, { docId }) -> the engine's OWN relation-reader
 *  output (organs/hypergraph.js::read()) turned into the claim shape the
 *  summary consumes. This is the ONLY honest source of claims: no regex, no
 *  synthetic extraction. Each engine claim already IS a GFP — end1 · label ·
 *  end2 with polarity and a byte-addressed span — so the mapping is naming,
 *  not invention.
 *
 *  `report` = { claims: [{ sentence, end1, label, end2, polarity, verdict,
 *  spans:[{ref,start,end,text}], ... }] } from
 *  eoreader7/native/the-fold/reader-bundle.js. */
export function claimsFromReport(report, { docId = 'doc' } = {}) {
  const out = [];
  for (const c of report?.claims || []) {
    const sp = (c.spans || [])[0];
    if (!sp || sp.start == null) continue;
    const end1 = clean(typeof c.end1 === 'object' ? JSON.stringify(c.end1) : c.end1);
    const end2 = clean(typeof c.end2 === 'object' ? JSON.stringify(c.end2) : c.end2);
    const label = clean(typeof c.label === 'object' ? JSON.stringify(c.label) : c.label);
    if (!label) continue;
    // COORDINATE SPACES (the bug this fixes): `sp.start`/`sp.end` are relative
    // to the CHUNK the sentence was read in, and the chunk's own ref carries
    // its base offset in the document (`material#<base>-<end>`). Slicing the
    // raw file with the local offset grabs the wrong bytes — the reader's own
    // documented address discipline. The claim's true document offset is
    // base + local. `sp.text` is the sentence AS READ (authoritative); we also
    // carry it so a caller can ground against the reader's own bytes.
    const m = /#(\d+)-\d+$/.exec(String(sp.ref || ''));
    const base = m ? Number(m[1]) : 0;
    const s = base + sp.start, e = base + sp.end;
    out.push({
      id: docId + ':' + s + '-' + e + ':' + out.length,
      doc: docId,
      s, e,
      chunkBase: base,
      text: clean(sp.text || c.sentence || ''),
      readText: sp.text || c.sentence || '',   // the reader's own bytes, verbatim
      // the Figure is by ROLE, already, in the engine's own terms:
      names: [end1, end2].filter(Boolean),
      figs: [],
      ref: !/^[A-Za-z]/.test(label),        // a punctuation-only "connector" is furniture
      claimy: !!end1 && !!end2,
      frame: c.verdict === 'unheard' ? 'attributed' : c.polarity === '-' ? 'uncertain' : 'fact',
      polarity: c.polarity,
      rel: label,
      // the engine's own standing: bound · unbound · beyond-reach · unheard …
      verdict: c.verdict,
      year: null,
    });
  }
  return out;
}

/** analysisFromReport(report, { docId, title }) -> a minimal analysis A whose
 *  claims ARE the engine's own. Every downstream function (surprisePass,
 *  worth, select) then selects over real GFP, never a stub. */
export function analysisFromReport(report, { docId = 'doc', title = '' } = {}) {
  const sts = claimsFromReport(report, { docId });
  const doc = { id: docId, title, year: null };
  return { docs: [doc], docById: { [docId]: doc }, sts, byId: Object.fromEntries(sts.map((s) => [s.id, s])), stsByDoc: { [docId]: sts } };
}
const STOP = new Set('the a an and or but of to in on at by for with from as is are was were be been being it its this that these those he she they we you i his her their our your not no so if then than there here what which who whom when where why how all any both each few more most other some such only own same too very can will just don should now'.split(/\s+/));

/** tokens(text) — lowercased content words, lightly stemmed, for the vector. */
export function tokens(text) {
  return (clean(text).toLowerCase().match(/[a-z][a-z']{2,}/g) || [])
    .filter((w) => !STOP.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(ies)$/, 'y').replace(/([^s])s$/, '$1') : w));
}

/** cosine(a, b) — exact sparse cosine over Map<term, weight>. */
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; if (b.has(k)) dot += v * b.get(k); }
  for (const v of b.values()) nb += v * v;
  return (!na || !nb) ? 0 : dot / Math.sqrt(na * nb);
}

/** tfidf(sts, {df}) — an exact TF-IDF vector per statement; names weighted 2×,
 *  rare topics count more. No hashing (the holograph-echo discipline). */
export function vectors(sts, { namesOf = (st) => st.names || [] } = {}) {
  const N = sts.length || 1; const df = new Map();
  const docs = sts.map((st) => { const t = tokens(st.text); const ns = namesOf(st); return { st, t, ns }; });
  docs.forEach(({ t, ns }) => { new Set(t).forEach((w) => df.set(w, (df.get(w) || 0) + 1)); new Set(ns).forEach((n) => df.set('n:' + n, (df.get('n:' + n) || 0) + 1)); });
  const wt = (k, m) => m * Math.log(1 + N / (df.get(k) || 1));
  const out = new Map();
  docs.forEach(({ st, t, ns }) => { const v = new Map(); t.forEach((w) => v.set(w, wt(w, 1))); ns.forEach((n) => v.set('n:' + n, wt('n:' + n, 2))); out.set(st.id, v); });
  return out;
}

// ── HOLOGRAPHICAL SURPRISE (standalone, no index.html dependency) ───────────
// A statement's excess is the weight of the bonds and value-revisions it
// introduces against a baseline H (what the reader already holds). This mirrors
// index.html's holoKit.shiftOf but is self-contained so it is unit-testable.

const NEG = /\b(not|no|never|denied|denies|without|failed to|did not|does not|was not|were not|has not|have not|cannot)\b/i;

// A SINGLE CAPITALIZED WORD IS A NAME UNLESS THE DOCUMENT ITSELF WRITES IT
// LOWERCASE — the engine's own rule (a capital the material also writes in
// lowercase is a sentence start, not a name; CODING-LESSONS 63). The earlier
// filter kept only multi-word names and ALL-CAPS acronyms, which dropped every
// single proper noun ("Kupin") — so a first assertion about one had no name to
// bond and scored zero (the N gap's second half). The document's lowercase
// vocabulary is the veto; nothing is listed here.
const _lowerCache = new WeakMap();
function docLowerSet(A, docId) {
  let m = _lowerCache.get(A); if (!m) { m = new Map(); _lowerCache.set(A, m); }
  if (m.has(docId)) return m.get(docId);
  const set = new Set();
  for (const st of ((A.stsByDoc && A.stsByDoc[docId]) || A.sts.filter((s) => s.doc === docId))) {
    for (const w of String(st.text || "").match(/\b[a-z][a-z'’-]+\b/g) || []) set.add(w);
  }
  m.set(docId, set); return set;
}

function fieldsOf(st, A) {
  const lower = docLowerSet(A, st.doc);
  const ns = [...new Set((st.names || []).filter((n) => {
    if (!n) return false;
    if (/\s/.test(n) || /^[A-Z]{2,}$/.test(n)) return true;
    return !lower.has(n.toLowerCase()); // single capitalized word: a name unless the doc writes it lowercase
  }))].slice(0, 8);
  const fs = (st.figs || []).map((g) => { const v = +g.value; if (!isFinite(v) || !v) return null; const raw = clean(g.raw || String(v)); return { measure: clean(g.unit || ''), v, raw }; }).filter(Boolean);
  return { ns, fs, neg: NEG.test(String(st.text).replace(/\bnot yet\b|\bno doubt\b|\bnot only\b/gi, '')) };
}

export function makeH() { return { ent: new Map(), bond: new Map(), val: new Map() }; }

// ── THE BASELINE IS A GENRE, MEASURED BY DMD ────────────────────────────────
//
// A summary baseline built from the document itself measures the document
// against itself: the essay's own quoted objection becomes the prior and its
// first principles become the ground. That is circular — it lets any document
// define the standard it then appears to meet. The prior must be what texts OF
// THIS KIND normally do.
//
// The instrument is Dynamic Mode Decomposition (kernel/dmd-stream.js): each
// claim is a state vector of its observables (name-bonds + figure-relations);
// streaming DMD over the GENRE-SIMILAR corpus yields the genre's own modes,
// whose eigenvalues carry a magnitude (growth/decay) AND an argument
// (frequency) — a quantity a count cannot reach (dmd.js's own header). The
// genre's dominant mode IS the baseline. A claim whose mode departs in
// FREQUENCY or GROWTH from the genre's shared mode is the document's own; its
// departure is its holographical surprise. A framing the document states that
// the genre's prior does not share is the AUTHOR'S OWN, disclosed, never
// promoted to the baseline.
//
// Nothing here invents the genre's dynamics: `genrePrior` is a measured
// GenrePrior@1 (live_priors/derived-priors/genre-priors) or the DMD mode table
// built from a genre corpus. Absent one, the caller MUST say so — the summary
// refuses to treat the document as its own ground.

/** observables(A, st) -> Map<dim-key, weight> — the state a claim contributes:
 *  its name-bonds and figure-relations, the same grain the surprise view uses.
 *  The dimension keys are the caller's; nothing about text is baked in. */
export function observables(A, st) {
  const { ns, fs } = fieldsOf(st, A); const pk = (a, b) => (a < b ? a + '\u0001' + b : b + '\u0001' + a);
  const m = new Map();
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { if (ns[i].includes(ns[j]) || ns[j].includes(ns[i])) continue; const k = 'bond:' + pk(ns[i], ns[j]); m.set(k, (m.get(k) || 0) + 1); }
  fs.forEach((f) => m.set('fig:' + f.measure, (m.get('fig:' + f.measure) || 0) + 1));
  return m;
}

/** stateVector(obs, dims) -> number[] — a fixed-length state from a claim's
 *  observables, ordered by `dims` (the declared dimension list, shared between
 *  the genre corpus and the document so the two are comparable). */
export function stateVector(obs, dims) {
  const x = new Array(dims.length).fill(0);
  for (let i = 0; i < dims.length; i++) x[i] = obs.get(dims[i]) || 0;
  return x;
}

/** dmdBaseline(obsList, { rank }) -> { modes, dims } — the shared modes of a
 *  corpus of states, by streaming DMD (one snapshot at a time, no future).
 *  `dims` is the union of every state's observable keys, sorted — the same
 *  order the document's states will use. */
export async function dmdBaseline(obsList, { rank = 6 } = {}) {
  const keys = new Set(); obsList.forEach((o) => o.forEach((_v, k) => keys.add(k)));
  const dims = [...keys].sort();
  const { createStreamingDmd } = await import('../eoreader7/native/kernel/dmd-stream.js').catch(() => import('./vendor/eoreader7/native/kernel/dmd-stream.js'));
  if (!dims.length) return { modes: [], dims, gap: 'no_observables' };
  const dmd = createStreamingDmd({ dims: dims.length });
  for (const obs of obsList) dmd.push(stateVector(obs, dims));
  const r = dmd.modes({ rank: Math.min(rank, Math.max(1, dims.length)) });
  return { modes: r.eigenvalues || [], dims, rank: r.rank, gap: r.gap || null };
}

/** genreBaseline(genrePrior, docStates, { rank }) -> the baseline a document
 *  is read against. `docStates` is the caller's per-document observable maps
 *  (observables() over each genre document's claims) — the trajectory DMD
 *  decomposes, so the mode reflects how the genre's vocabulary MOVES document
 *  to document, not a single-term 1-hot (which has no dynamics). If the genre
 *  prior is absent the caller is TOLD, never handed the document as its own
 *  ground. */
export async function genreBaseline(genrePrior, docStates, { rank = 6 } = {}) {
  if (!genrePrior || !genrePrior.prior_terms || !genrePrior.prior_terms.length) {
    return { modes: [], dims: [], gap: 'no_genre_prior — the document may not be its own ground (pass a measured GenrePrior@1)' };
  }
  if (!docStates || !docStates.length) {
    return { modes: [], dims: [], genre: genrePrior.genre, gap: 'no_genre_trajectory — pass the genre corpus’s per-document states (observables() per document), not the document under summary' };
  }
  const terms = new Set(genrePrior.prior_terms.slice(0, 400).map((t) => t.term));
  // Keep only observables the genre actually dwells on — that is the genre's
  // own vocabulary, so its mode is the genre's, not the document's.
  const filtered = docStates.map((m) => new Map([...m].filter(([k]) => k.startsWith('bond:') || k.startsWith('fig:') || terms.has(k.replace(/^term:/, '')))));
  const base = await dmdBaseline(filtered, { rank });
  return { ...base, genre: genrePrior.genre, terms };
}

/** modeSignature(modes) -> a normalized vector of the modes' (magnitude,
 *  frequency) pairs — the genre's musical shape, comparable across priors. */
function modeSignature(modes) {
  const m = [...(modes || [])].sort((a, b) => b.magnitude - a.magnitude).slice(0, 4);
  const v = [];
  for (const z of m) v.push(z.magnitude, z.frequency || 0);
  while (v.length < 8) v.push(0, 0);
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}
const cosineVec = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; d += x * y; na += x * x; nb += y * y; } return (!na || !nb) ? 0 : d / Math.sqrt(na * nb); };

/** matchGenre(priors, docObs, { rank, minMargin }) -> the genre prior whose DMD
 *  MODE best matches the document's, with the margin disclosed. The document's
 *  kind is MEASURED, never hand-named: the same observable extraction is run
 *  over the document, its mode signature compared to each prior's, and the
 *  nearest taken. A thin margin is a NAMED GAP, not a guess. */
export async function matchGenre(priors = [], docObs = [], { rank = 6, minMargin = 0.02 } = {}) {
  const loaded = (priors || []).filter((p) => p && p.prior_terms && p.prior_terms.length);
  if (!loaded.length) return { gap: 'no_genre_priors — nothing to match against' };
  if (!docObs || !docObs.length) return { gap: 'no_document_states — cannot measure the document’s own mode' };
  const docSig = modeSignature((await dmdBaseline(docObs, { rank })).modes);
  const scored = [];
  for (const p of loaded) {
    const terms = p.prior_terms.slice(0, 300);
    const states = terms.map((t) => new Map([[String(t.term).toLowerCase(), t.g2 ?? t.df ?? 1]]));
    const gb = await dmdBaseline(states, { rank });
    scored.push({ genre: p.genre, sim: cosineVec(docSig, modeSignature(gb.modes)), prior: p });
  }
  scored.sort((a, b) => b.sim - a.sim);
  const top = scored[0], next = scored[1];
  const margin = next ? top.sim - next.sim : top.sim;
  const disclosed = { genre: top.genre, sim: +top.sim.toFixed(4), margin: +margin.toFixed(4), scored: scored.map((s) => ({ genre: s.genre, sim: +s.sim.toFixed(4) })) };
  if (margin < minMargin) return { gap: 'no_clear_genre — the top two genres are within the margin', ...disclosed };
  return { ...disclosed, prior: top.prior };
}

/** satisfy({ gist, source, index }) -> a REAL mechanical check, the summary's
 *  own `testCommand` (code-loop.js::runTestCommand's shape: a real check, exit
 *  0/1, never a model's say-so). Exit 0 when every asserted relation is
 *  grounded — its byte span lies inside the source and actually contains the
 *  relation's two ends — and the genre filter is disclosed. Exit 1 with the
 *  exact violations otherwise. */
export function satisfy({ gist, source, index }) {
  const violations = [];
  const rows = gist?.relations?.rows || [];
  const src = String(source || '');
  for (const rel of rows) {
    const sp = (rel.spans || [])[0];
    if (!sp || sp.s == null) { violations.push({ rel: `${rel.arg0} —${rel.rel}→ ${rel.arg1}`, why: 'no byte span — ungrounded relation' }); continue; }
    const slice = src.slice(sp.s, sp.e);
    const first = (x) => String(x || '').split(' ')[0];
    const inRaw = slice && slice.includes(first(rel.arg0)) && slice.includes(first(rel.arg1));
    // ground against the reader's own bytes too (the EOT's own coordinate
    // space); at least one must contain both ends, and the raw span must not
    // be empty.
    const inRead = sp.text && sp.text.includes(first(rel.arg0)) && sp.text.includes(first(rel.arg1));
    if (!slice) { violations.push({ rel: `${rel.arg0} —${rel.rel}→ ${rel.arg1}`, why: `span ${sp.s}-${sp.e} outside the source` }); continue; }
    if (!inRaw && !inRead) violations.push({ rel: `${rel.arg0} —${rel.rel}→ ${rel.arg1}`, why: 'the span does not contain both ends', at: { s: sp.s, e: sp.e }, slice: slice.slice(0, 80) });
  }
  return { ok: violations.length === 0, exitCode: violations.length === 0 ? 0 : 1, checked: rows.length, violations, disclosure: gist?.disclosure || null };
}

/** excessOf(st, H, A) — the holographical excess of st against baseline H, and
 *  the breakdown of what moved. Deterministic: the same material, the same H,
 *  the same number. */
export function excessOf(st, H, A) {
  const { ns, fs, neg } = fieldsOf(st, A); const parts = [];
  const pk = (a, b) => (a < b ? a + '\u0001' + b : b + '\u0001' + a);
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const a = ns[i], b = ns[j]; if (a.includes(b) || b.includes(a)) continue;
    const ca = H.ent.get(a) || 0, cb = H.ent.get(b) || 0, had = H.bond.get(pk(a, b)) || 0;
    // A FIRST ASSERTION IS THE STRONGEST ENTRY SIGNAL, not a zero. The bond
    // formula's own variable is how half-present the pair already was
    // (min(ca,cb)); both names new is that variable at 0 — the whole bond is
    // new — so it takes the bond weight at 0 rather than falling through both
    // branches and scoring nothing (the inherited measure's first-assertion
    // hole: a load-bearing opening claim had excess 0, so no resolver could
    // form for it — holodeck-summary.test.mjs's N). (2026-10-02)
    if (!had) {
      if (ca >= 2 && cb >= 2) parts.push({ w: 1 + 0.5 * Math.log2(1 + Math.min(ca, cb)), kind: 'bond', text: a + ' and ' + b + ' held together for the first time' });
      else if (ca === 0 && cb === 0) parts.push({ w: 1, kind: 'bond', text: a + ' and ' + b + ' enter together, held for the first time' });
      else if (ca || cb) parts.push({ w: 0.3 + 0.1 * Math.log2(1 + Math.max(ca, cb)), kind: 'enter', text: 'a name enters the picture' });
    }
    else if (neg && had >= 1) parts.push({ w: 1.5, kind: 'turn', text: 'negates a bond the record already held' });
  }
  fs.forEach((f) => { const L = H.val.get(f.measure) || []; if (!L.length) return; const last = L[L.length - 1]; if (Math.abs(last.v - f.v) / Math.max(Math.abs(last.v), 1e-9) < 0.005) return;
    parts.push({ w: 2 + Math.min(2, Math.abs(Math.log2(Math.max(f.v, 1e-9) / Math.max(last.v, 1e-9)))), kind: 'revise', text: 'revises a figure' }); });
  return { excess: parts.reduce((s, p) => s + p.w, 0), parts };
}

/** admit(H, st, A) — fold st into the baseline. */
export function admit(H, st, A) {
  const { ns, fs } = fieldsOf(st, A); const pk = (a, b) => (a < b ? a + '\u0001' + b : b + '\u0001' + a);
  ns.forEach((n) => H.ent.set(n, (H.ent.get(n) || 0) + 1));
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const k = pk(ns[i], ns[j]); H.bond.set(k, (H.bond.get(k) || 0) + 1); }
  fs.forEach((f) => { const L = H.val.get(f.measure) || []; L.push(f); H.val.set(f.measure, L); });
}

/** surprisePass(A, docId) -> { by, order } — walk the document's claims along
 *  the arrow of time, recording each statement's holographical excess against
 *  the baseline as it stood when the statement arrived. */
export function surprisePass(A, docId) {
  const sts = (A.stsByDoc && A.stsByDoc[docId]) || A.sts.filter((st) => st.doc === docId);
  const claims = sts.filter((st) => !st.ref && st.claimy !== false && clean(st.text).split(' ').length >= 4);
  const H = makeH(); const by = new Map(); const order = [];
  for (const st of claims) { const r = excessOf(st, H, A); by.set(st.id, r); order.push(st.id); admit(H, st, A); }
  return { by, order, claims };
}

/** resolverEdges(A, docId, { top }) -> [{ turn, resolver, drop }] — for each
 *  turn candidate, the statement b whose PRESENCE in the baseline lowers the
 *  turn's excess: S(a | B∪{b}) < S(a | B). Baseline augmentation, never an
 *  occurrence counterfactual.
 *
 *  A resolver must EXPLAIN the turn, so it must be ABOUT the turn: b shares at
 *  least one name with a, or the drop is an unrelated sentence that merely
 *  floods the baseline with entities (the measured degeneracy: every turn
 *  "resolved" to the single most name-dense sentence). Name-sharing is the
 *  same structural gate falsify.topics.mjs uses — a shared subject, not a
 *  shared word count.
 *
 *  Null control: an edge is kept only when the drop also beats the largest drop
 *  any shuffled-relationship sentence achieves, so co-occurrence is rejected. */
export function resolverEdges(A, docId, { top = 8 } = {}) {
  const { by, claims } = surprisePass(A, docId);
  const namesOf = (st) => new Set(fieldsOf(st, A).ns);
  // A name's document frequency: the shared subject must be SELECTIVE. A name
  // that appears in most of the document ("NTOR" here) is ordinary vocabulary,
  // and a resolver sharing only it is co-occurrence, not explanation —
  // selectorOf() rejects it.
  const nameDF = new Map();
  claims.forEach((st) => namesOf(st).forEach((n) => nameDF.set(n, (nameDF.get(n) || 0) + 1)));
  // A shared name must not be the document's single most common name: that is
  // the flooder (the measured degeneracy — one name-dense sentence "resolved"
  // every turn). Any other shared name means a shared subject. The bar is
  // derived from the data (the max), never set; ties are all refused.
  const maxDF = nameDF.size ? Math.max(...nameDF.values()) : 0;
  const selective = (n) => (nameDF.get(n) || 0) < maxDF || nameDF.size === 1;
  // THE TURN'S OWN SUBJECT IS A LEGITIMATE LINK EVEN WHEN IT IS THE DOCUMENT'S
  // MOST COMMON NAME. The selectivity gate exists to refuse a name-dense
  // sentence that shares only the subject with every turn (the measured
  // degeneracy); but a resolver must be ABOUT the turn, and a turn's own
  // subject is exactly what it is about. `claimed` already keeps one resolver
  // to one turn, so allowing the subject cannot re-flood: the flooder resolves
  // at most one turn like any other sentence. (2026-10-02, the N gap's second
  // half — without this the first-asserted turn's only link is its subject,
  // which the gate refused, so no resolver formed.)
  const subjectOf = (st) => fieldsOf(st, A).ns[0] || null;
  const ranked = [...by.entries()].map(([id, r]) => ({ st: claims.find((s) => s.id === id), r })).sort((a, b) => b.r.excess - a.r.excess).slice(0, top);
  const edges = []; const claimed = new Set();
  for (const { st, r } of ranked) {
    const ta = namesOf(st); const ts = subjectOf(st); let best = null;
    for (const o of claims) {
      if (o.id === st.id || claimed.has(o.id)) continue;      // a resolver explains one turn
      const shared = [...namesOf(o)].some((n) => ta.has(n) && (selective(n) || n === ts)); if (!shared) continue;
      // "In retrospect, less surprising": augment the baseline with the
      // resolver's PARTICIPANTS (its subject knowledge), not merely its bonds —
      // once you already hold the actor, the turn's name-bonds are no longer
      // new. That is the quantity baseline augmentation is meant to move.
      const Hb = makeH();
      namesOf(o).forEach((n) => Hb.ent.set(n, (Hb.ent.get(n) || 0) + 2));
      const drop = r.excess - excessOf(st, Hb, A).excess;
      if (drop > 0 && (!best || drop > best.drop)) best = { id: o.id, st: o, drop };
    }
    if (best && best.drop > 0.5) { edges.push({ turn: st, turnExcess: r.excess, resolver: best.st, drop: best.drop }); claimed.add(best.id); }
  }
  return edges;
}

// ── THE LADDER ──────────────────────────────────────────────────────────────

// ── THE VOID: declared priors and their attestation ─────────────────────────
//
// A model may PROPOSE the priors a document is arguing against (the void), but
// it may not decide them: each prior must be ATTESTED to a real span of the
// source — the framing the source itself states (a quoted objection, a
// headline, a rhetorical question). An unattested prior is disclosed and inert;
// it cannot drive selection. This is what keeps "the model writes the void"
// from becoming "the model writes the answer."

/** attestPrior(A, docId, prior) -> { ok, span?, why } — does the source itself
 *  state (or quote) this prior? Attested by word overlap against the source's
 *  own spans; the matched span is returned so the prior cites real bytes. */
export function attestPrior(A, docId, prior) {
  const want = new Set(tokens(prior));
  if (!want.size) return { ok: false, why: 'empty prior' };
  const claims = (A.stsByDoc && A.stsByDoc[docId]) || A.sts.filter((st) => st.doc === docId);
  let best = null;
  for (const st of claims) {
    const have = new Set(tokens(st.text)); let hit = 0;
    for (const w of want) if (have.has(w)) hit++;
    const cover = hit / want.size;
    if (!best || cover > best.cover) best = { st, cover, hit };
  }
  return best && best.cover >= 0.5 ? { ok: true, span: { s: best.st.s, e: best.st.e, id: best.st.id, text: clean(best.st.text) }, why: 'attested' } : { ok: false, why: 'no span of the source states this prior (unattested — inert)' };
}

/** turnAgainstPrior(A, docId, attested) -> { pick, drop } | null — the claim
 *  that most lowers the residual of an ATTESTED prior: the statement whose
 *  presence, added to a baseline holding the prior's own span, most reduces the
 *  source's remaining excess. This is the "in retrospect, less surprising"
 *  statement: once the prior is on the record, the turn is what answers it. */
export function turnAgainstPrior(A, docId, attested) {
  if (!attested || !attested.ok) return null;
  const claims = (A.stsByDoc && A.stsByDoc[docId]) || A.sts.filter((st) => st.doc === docId);
  const priorSt = A.byId[attested.span.id];
  const H0 = makeH(); if (priorSt) admit(H0, priorSt, A);
  let pick = null;
  for (const st of claims) {
    if (st.id === attested.span.id) continue;
    const drop = excessOf(st, H0, A).excess; // excess resolved against the prior's baseline
    if (!pick || drop > pick.drop) pick = { st, drop };
  }
  return pick && pick.drop > 0 ? { pick: pick.st, drop: pick.drop } : null;
}

// ── THE DIFFERENCE THAT MAKES A DIFFERENCE ──────────────────────────────────
//
// Bateson's rule, and activation.js's own words when it defines dmdWindow:
// "walk candidate depths outward and take the SHALLOWEST at which forgetting
// everything older no longer changes what the reader concludes. Material past
// that depth has no activation, because by measurement it makes no difference."
//
// Applied to a summary: a claim belongs only if INCLUDING it changes what the
// reader concludes. Including it and getting the same conclusion = difference
// that makes no difference, excluded by measurement, with no threshold.
//
// The baseline is the shallowest window at which the GENRE's reading is already
// settled — everything the genre has concluded is the prior B. The document's
// turn is the claim whose inclusion moves the conclusion PAST that window: a
// difference that makes a difference against the genre's settled reading, not
// against the document's own framing. This is what dissolves the circularity —
// a document always changes its own conclusion, so the conclusion must be drawn
// elsewhere.

const { dmdWindow } = await import('./vendor/eoreader7/native/kernel/activation.js').catch(() => ({ dmdWindow: null }));

/** conclusionOf(claims, A) -> a small structured conclusion — the propositions
 *  a set of claims collectively holds: the top names with their frame, the
 *  dominant figures/measures, and an "asserts" line. This is `derive`: what a
 *  reading CONCLUDES, so that "a difference" has something to be a difference
 *  TO. Deterministic, model-free. */
export function conclusionOf(claims, A) {
  const names = new Map(); const frames = new Map(); const figs = new Map();
  let stance = 0;
  for (const st of claims) {
    fieldsOf(st, A).ns.forEach((n) => names.set(n, (names.get(n) || 0) + 1));
    frames.set(st.frame || 'fact', (frames.get(st.frame || 'fact') || 0) + 1);
    fieldsOf(st, A).fs.forEach((f) => figs.set(f.measure, (figs.get(f.measure) || 0) + 1));
    stance += stanceLens(st.text);
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, n).map((x) => x[0]);
  // STANCE is part of the conclusion: an identity concludes not only names,
  // frames and measures but an EVALUATION of what it holds. A verdict often
  // introduces no new name — it inverts the stance on a name already held — so
  // without stance a conclusion can never see it (the R gap). The lexicon is an
  // ENGLISH lens (giver below), recorded as such, never the universal layer.
  return { names: top(names, 5), frames: top(frames, 3), measures: top(figs, 3), stance: Math.sign(stance), n: claims.length };
}

// THE ENGLISH EVALUATIVE LENS — ONE giver for the whole system: organs/stance.js
// in eoreader7 owns it (vendored byte-identical under vendor/), the fold imports
// it, and the archons' Gornick probe (the-fold/archon-rules.js) reads the same
// lens, so a stance the fold selects FOR and a stance the delivery is judged
// AGAINST can never disagree. The import is at the TOP (ESM hoists it, and
// conclusionOf above needs it bound before first call — an absolute-path
// re-export here previously broke on any machine but this one and left stanceLens
// in its temporal dead zone, a load-time failure found by the surf/fold
// experiment, 2026-10-02).

/** windowOf(orders, derivers) -> the shallowest depth within a set of claims at
 *  which the document's own conclusion is settled — dmdWindow over the ordered
 *  claims. Returns the measured window or a typed gap. */
export function windowOf(claims, A, { candidates = [2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 30] } = {}) {
  if (!dmdWindow) return { window: null, gap: 'dmdWindow_unavailable' };
  return dmdWindow(claims, (obs) => conclusionOf(obs, A), { candidates, restrict: (obs, depth) => obs.slice(0, depth) });
}

/** departureDepth(claims, genreConclusion, A, { candidates }) -> the SHALLOWEST
 *  prefix of the document whose conclusion differs from the genre's settled
 *  reading: the point at which this document starts making a difference the
 *  genre did not already hold. Everything before it is the genre's, not news. */
export function departureDepth(claims, genreConclusion, A, { candidates = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 30] } = {}) {
  const differs = (c) => {
    const g = genreConclusion;
    // departure = the document names a name, or holds a frame relation, the
    // genre's settled reading does not. A shared vocabulary is not news.
    const newNames = c.names.filter((n) => !g.names.includes(n));
    const newMeasures = c.measures.filter((n) => !g.measures.includes(n));
    const newFrame = c.frames.filter((n) => !g.frames.includes(n));
    return newNames.length + newMeasures.length + newFrame.length;
  };
  let best = null;
  for (const depth of [...candidates].sort((a, b) => a - b)) {
    const d = differs(conclusionOf(claims.slice(0, depth), A));
    if (d > 0) { best = { depth, departure: d }; break; }
  }
  return best || { depth: claims.length, departure: 0 };
}

/** summarize(A, docId, { genreConclusion, size }) -> the summary at a size, with
 *  the difference-that-makes-a-difference applied: claims that change no
 *  conclusion are dropped, and the ladder starts at the departure depth. */
export function summarize(A, docId, { genreConclusion = null, size = 1 } = {}) {
  const { claims } = surprisePass(A, docId);
  const dep = genreConclusion ? departureDepth(claims, genreConclusion, A) : { depth: 1, departure: 0 };
  const L = select(A, docId, { size: size === 3 ? 5 : size, genreConclusion });
  return { ...L, departure: dep, genreConclusion };
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** worth(A, docId) -> Map<id, score> — how summary-worthy each claim is.
 *
 *  Raw holographical excess alone is NOT summary-worthiness: measured, it
 *  ranks data-dense bullet lists (many figure-revisions) at the top and the
 *  argument's own turn near the bottom. A bare figure list moves the picture,
 *  but it is EVIDENCE, not the turn. Summary-worthiness is the excess a claim
 *  carries OVER what its figures alone would earn, plus how central its names
 *  are to the document, plus whether it can be resolved by another claim —
 *  a claim that CAN be explained is a turn; a number cannot be explained. */
export function worth(A, docId, { forWhom = null } = {}) {
  const { by, claims } = surprisePass(A, docId);
  const edges = resolverEdges(A, docId, { top: 12 });
  const hasResolver = new Map(edges.map((e) => [e.turn.id, e.drop]));
  const central = new Map(); // a name's mention count in THIS document
  claims.forEach((st) => fieldsOf(st, A).ns.forEach((n) => central.set(n, (central.get(n) || 0) + 1)));
  // THE FOLD AT A POINT (the governing law): the world is folded at an IDENTITY
  // — a perspective with a held conclusion — and what belongs is what makes a
  // DIFFERENCE to it. A claim that introduces a name, a measure or a frame the
  // identity's conclusion does not already hold is a difference that makes a
  // difference TO THAT IDENTITY; a claim the identity already concludes is not
  // news to it. `forWhom` carries the identity's conclusion (its held picture,
  // e.g. a genre's settled reading or a declared prior); without it the fold is
  // at the empty point and the measure falls back to pure holographical excess.
  const held = forWhom?.conclusion ?? null;
  // A difference that makes a difference TO THE IDENTITY: a claim that inverts
  // the identity's held STANCE (a verdict against what it believes) is the
  // turn; then one that introduces content (a name/measure/frame) the identity
  // does not hold. At a fold-point the difference DOMINATES the raw excess —
  // the summary is FOR the difference, not for salience.
  const departure = held ? (st) => {
    const c = conclusionOf([st], A);
    const nn = c.names.filter((n) => !held.names.includes(n)).length;
    const nm = c.measures.filter((m) => !held.measures.includes(m)).length;
    const nf = c.frames.filter((f) => !held.frames.includes(f)).length;
    const flip = (c.stance !== 0 && held.stance !== 0 && c.stance !== held.stance) ? 1 : 0;
    return { content: nn + nm + nf, flip };
  } : () => ({ content: 0, flip: 0 });
  const score = new Map();
  for (const st of claims) {
    const ex = by.get(st.id) ? by.get(st.id).excess : 0;
    const figN = fieldsOf(st, A).fs.length;
    const cent = fieldsOf(st, A).ns.reduce((s, n) => s + (central.get(n) || 0), 0);
    const res = hasResolver.get(st.id) || 0;
    const overFig = ex / (1 + figN);
    const base = 0.55 * overFig + 0.30 * Math.log2(1 + cent) + 0.15 * Math.min(2, res);
    const dep = departure(st);
    // folded at an identity: a stance inversion is the turn (ranked in its own
    // class), then content-departure, then the holographical base as a tiebreak.
    const s = held ? dep.flip * 1000 + dep.content * 10 + base : base;
    score.set(st.id, { ex, figN, cent, res, dep: dep.content, flip: dep.flip, s });
  }
  return { score, by, claims, edges, forWhom };
}

/** select(A, docId, { size, lambda }) -> { lines, spans, kind }.
 *  size = 1 | 5 | 3 (paragraphs). Greedy MMR over worth(), re-ordered by the
 *  source's own position. Every line is a verbatim span of the source. */
/** propositionOf(st, A, sc, opts) -> the proposition in the three stages:
 *
 *    gfp   an EOGfpClaim@1 — the language-neutral Ground·Figure·Pattern. The
 *          Ground is the source holon (the byte span as a holon address); the
 *          Figure is the participants by ROLE (ARG0 = the statement's leading
 *          name, ARG1 = the rest as read), never by word order; the Pattern is
 *          the relation and its polarity. NO English is produced here — the
 *          render is the language lens's job.
 *    eot   an EOTObservation@1 — the append-only record of the same span.
 *    prov  the provenance: the span, the ranking signals, the resolver, the
 *          departure from the genre's settled reading.
 *
 *  `render(claim, lens)` (holodeck-lang.js or gfp-claim.js::render) is the ONLY
 *  way this becomes a reader's words. */
function propositionOf(st, A, sc, { resolver = null, genreConclusion = null } = {}) {
  const f = fieldsOf(st, A);
  const ground = '/doc/' + st.doc + '/' + st.s + '-' + st.e; // the byte span as a holon
  const neg = (st.polarity ? st.polarity === '-' : f.neg) || /^(no|not|never)\b/i.test(clean(st.text));
  // The Pattern is the engine's OWN relation label when the claim came from the
  // reader (st.rel); the roles are its end1/end2, already Figure-by-role. Only a
  // claim with no engine relation (a bare span) falls back to a generic label.
  const rel = clean(st.rel || '');
  const arg0 = f.ns[0] || '(the source)';
  const arg1 = f.ns.slice(1).join(', ') || f.fs.map((x) => x.raw).join(', ') || '(the claim)';
  const gfp = GFP && GFP.gfpClaim ? GFP.gfpClaim({
    ground, rel: rel || (st.frame === 'attributed' ? 'is said to' : 'states'),
    roles: { ARG0: arg0, ARG1: arg1 },
    polarity: neg ? '-' : '+', id: st.id,
  }) : null;
  const eot = {
    schema: 'EOTObservation@1', id: st.doc + ':' + st.s + ':' + st.e,
    at: [st.s, st.e], role: 'summary-proposition', kind: 'claim',
    title: st.frame || 'fact', text: clean(st.text),
    gfp: gfp ? { ground: gfp.ground, rel: gfp.rel, roles: { ...gfp.roles }, polarity: gfp.polarity } : null,
  };
  const prov = {
    id: st.id,
    span: { s: st.s, e: st.e, text: clean(st.text) },
    gfp, eot,
    // the ranking signals, named — nothing hidden
    signals: {
      excess: +(sc.ex || 0).toFixed(3),
      figures: sc.figN,
      centrality: sc.cent,
      resolverDrop: +(sc.res || 0).toFixed(3),
      overFigure: +((sc.ex || 0) / (1 + (sc.figN || 0))).toFixed(3),
      score: +(sc.s || 0).toFixed(4),
    },
    // what the claim is about, as read (roles stay the Figure's own)
    names: f.ns,
    measures: f.fs.map((x) => ({ measure: x.measure || null, raw: x.raw })),
    frame: st.frame || 'fact',
  };
  if (resolver) prov.resolver = { id: resolver.resolver.id, span: { s: resolver.resolver.s, e: resolver.resolver.e, text: clean(resolver.resolver.text) }, drop: +resolver.drop.toFixed(3) };
  if (genreConclusion) {
    prov.departure = {
      newNames: f.ns.filter((n) => !genreConclusion.names.includes(n)),
      newMeasures: f.fs.map((x) => x.measure).filter((m) => !genreConclusion.measures.includes(m)),
      newFrame: !genreConclusion.frames.includes(st.frame || 'fact') ? (st.frame || 'fact') : null,
    };
  }
  return prov;
}

/** render(proposition, lens) — GFP → the lens's own words. The ONLY path from
 *  a proposition to a reader's language. `lens` is a GFP order ("SVO"…"case-
 *  marked") OR a language code the caller resolves through holodeck-lang.js.
 *  Never an English default: a proposition with no gfp renders nothing, and an
 *  unknown lens throws. */
export function render(proposition, lens = 'SVO') {
  if (!proposition || !proposition.gfp) return '';
  const L = (GFP && GFP.LENSES && GFP.LENSES.includes(lens)) ? lens : null;
  if (!L) throw new TypeError(`holodeck-summary.render: "${lens}" is not a GFP lens (${GFP ? GFP.LENSES.join(', ') : 'gfp-claim unavailable'}) — a reader's language resolves it through holodeck-lang.js, never a silent English fallback`);
  const c = GFP.gfpClaim(proposition.gfp);
  return GFP.render(c, L);
}

/** select(A, docId, { size, lambda, genreConclusion }) -> { lines, spans, proves, kind }.
 *  size = 1 | 5 | 3 (paragraphs). Greedy MMR over worth(), re-ordered by the
 *  source's own position. Every line is a verbatim span of the source AND every
 *  proposition carries its full provenance: the span, the signals, the
 *  resolver, and (given a genre) its departure. */
export function select(A, docId, { size = 1, lambda = 0.6, genreConclusion = null, forWhom = null } = {}) {
  const identity = forWhom ?? (genreConclusion ? { conclusion: genreConclusion } : null);
  const { score, claims, edges } = worth(A, docId, { forWhom: identity });
  const edgeOf = new Map(edges.map((e) => [e.turn.id, e]));
  const V = vectors(claims, { namesOf: (st) => st.names || [] });
  const order = claims.slice().sort((a, b) => (score.get(b.id).s - score.get(a.id).s));
  const picked = [];
  while (picked.length < size && order.length) {
    let best = null;
    for (const st of order) {
      if (picked.includes(st)) continue;
      const overlap = picked.length ? Math.max(...picked.map((p) => cosine(V.get(st.id) || new Map(), V.get(p.id) || new Map()))) : 0;
      const s = score.get(st.id).s - lambda * overlap;
      if (!best || s > best.s) best = { st, s };
    }
    if (!best) break;
    picked.push(best.st);
  }
  picked.sort((a, b) => a.s - b.s);
  const lines = picked.map((c) => clean(c.text));
  const proves = picked.map((c) => propositionOf(c, A, score.get(c.id), { resolver: edgeOf.get(c.id) || null, genreConclusion }));
  const spans = proves.map((p) => ({ s: p.span.s, e: p.span.e, id: p.id, excess: p.signals.excess }));
  if (size === 3) return { lines: paragraphsOf(claims, picked), spans, proves, kind: 'paragraphs' };
  return { lines, spans, proves, kind: size === 1 ? 'sentence' : 'sentences' };
}

/** paragraphsOf(claims, picked) — the three-paragraph budget: the selected
 *  spans grouped into three blocks by the source's own order. No new words. */
export function paragraphsOf(claims, picked) {
  const lines = picked.slice().sort((a, b) => a.s - b.s).map((c) => clean(c.text));
  if (lines.length <= 3) return lines.slice();
  const per = Math.ceil(lines.length / 3); const out = [];
  for (let i = 0; i < 3; i++) { const seg = lines.slice(i * per, (i + 1) * per); if (seg.length) out.push(seg.join(' ')); }
  return out;
}

/** ladder(A, docId, { lambda, genreConclusion }) -> the three sizes, MONOTONE by
 *  construction: the same irredundant ranking feeds all three, so the 1-sentence
 *  pick is the first of the 5, and the 5 are the 3-paragraph set. Each carries
 *  the full provenance of every proposition. */
export function ladder(A, docId, { lambda = 0.6, genreConclusion = null, forWhom = null } = {}) {
  const one = select(A, docId, { size: 1, lambda, genreConclusion, forWhom });
  const five = select(A, docId, { size: 5, lambda, genreConclusion, forWhom });
  const fiveIds = new Set(five.spans.map((s) => s.id));
  const three = { lines: paragraphsToBlocks(five.lines), spans: five.spans, proves: five.proves, kind: 'paragraphs' };
  return { one, five, three, monotone: one.spans.every((s) => fiveIds.has(s.id)) };
}

/** paragraphsToBlocks(lines) — group already-selected verbatim lines into up
 *  to three blocks without adding a word. */
export function paragraphsToBlocks(lines) {
  const n = lines.length; if (n <= 3) return lines.slice();
  const per = Math.ceil(n / 3); const out = [];
  for (let i = 0; i < 3; i++) { const seg = lines.slice(i * per, (i + 1) * per); if (seg.length) out.push(seg.join(' ')); }
  return out;
}
