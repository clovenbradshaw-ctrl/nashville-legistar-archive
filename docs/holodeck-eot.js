// holodeck-eot.js — A SUMMARY IS REASONED OVER THE EOT, NOT SELECTED FROM SPANS.
//
// The coding pipeline is the model (eoreader7/native/the-fold/code-loop.js +
// adapters/text/code-structure.js::codeGist):
//
//   parse the record  →  an INDEX (entities + edges)          [code-structure]
//   drop what the GENRE already has  →  genericity prior       [CodeNamePrior]
//   cut at the shallowest depth that preserves the reach      [resolutions.dmdCut]
//   emit a DERIVED artifact, and let a REAL check decide      [code-loop]
//
// For prose the record is the EOT: the engine's own relation-reader claims,
// each an EOGfpClaim@1 (Ground · Figure · Pattern) with a byte span. The same
// pipeline gives a real summary:
//
//   EOT claims  →  an INDEX (referents + relation edges)       [buildEotIndex]
//   drop what the GENRE already knows  →  GenrePrior           [genericityOf]
//   cut at the shallowest depth that preserves the reach       [dmdCut]
//   emit the reasoned artifact; a REAL check decides           [sourceGist]
//
// Nothing here picks sentences. The summary is what the EOT, reasoned over by
// the engine's own resolution cut, says — and every line still carries the
// byte address of the claims it was read from.

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const key = (a, b) => [a, b].sort().join('\u0000');
/** buildEotIndex(claims) -> { entities, edges, resolve, describe, degreeOf,
 *  fileCount } — the code-structure index's own shape, built from EOT claims.
 *  An ENTITY is a referent (a claim's ARG0/ARG1); an EDGE is a relation
 *  (ARG0 —label→ ARG1) with a real occurrence count. */
export function buildEotIndex(claims = []) {
  const entities = new Map(); // name -> [{ rel, other, span }]
  const edgeTally = new Map(); // key(arg0,arg1) -> { arg0, arg1, rel, count, spans:[], docs:Set }
  for (const c of claims) {
    const a0 = clean(c.names?.[0]); const a1 = clean(c.names?.[1]); const rel = clean(c.rel);
    if (a0 && !entities.has(a0)) entities.set(a0, []);
    if (a1 && !entities.has(a1)) entities.set(a1, []);
    if (a0) entities.get(a0).push({ rel, other: a1, span: { s: c.s, e: c.e } });
    if (a1) entities.get(a1).push({ rel, other: a0, span: { s: c.s, e: c.e } });
    if (!a0 || !a1 || !rel) continue;
    const k = key(a0, a1);
    if (!edgeTally.has(k)) edgeTally.set(k, { arg0: a0, arg1: a1, rel, count: 0, spans: [], docs: new Set() });
    const rec = edgeTally.get(k);
    rec.count += 1; rec.spans.push({ s: c.s, e: c.e, id: c.id, text: c.readText || c.text, chunkBase: c.chunkBase }); rec.docs.add(c.doc);
  }
  const edges = [...edgeTally.values()].sort((x, y) => y.count - x.count);
  const resolve = (name) => (entities.has(String(name ?? '')) ? new Set([String(name)]) : new Set());
  const degreeOf = (name) => edges.reduce((d, e) => d + ((e.arg0 === name || e.arg1 === name) ? e.count : 0), 0);
  const describe = (name) => ({
    name,
    degree: degreeOf(name),
    asSubject: edges.filter((e) => e.arg0 === name),
    asObject: edges.filter((e) => e.arg1 === name),
  });
  return { entities, edges, resolve, describe, degreeOf, fileCount: new Set(claims.map((c) => c.doc)).size };
}

/** genericityOfGenre(prior, term) -> the GenrePrior@1 g² (over-representation
 *  in the genre) for `term`, or null when the prior is absent or the term was
 *  never attested there. `null` is a disclosed "no signal", never coerced to 0
 *  — the same contract code-structure.js::genericityOf holds. A term the genre
 *  itself dwells on is boilerplate this document need not retell. */
export function genericityOfGenre(prior, term) {
  if (!prior?.prior_terms?.length) return null;
  const t = String(term ?? '').toLowerCase();
  const hit = prior.prior_terms.find((x) => String(x.term).toLowerCase() === t);
  return hit ? (hit.g2 ?? hit.df ?? null) : null;
}

/** sourceGist({ index, genrePrior, dmdCut, dmdWindow, active, genericFloor }) ->
 *  { declared, relations, disclosure } — the reasoned summary, mirroring
 *  code-structure.js::codeGist exactly:
 *
 *    declared   the referents this document holds, minus what the GENRE prior
 *               shows recurs across its kind (boilerplate), ordered by
 *               RELATION degree (the structural signal, never raw frequency),
 *               cut where widening stops making a difference.
 *    relations  the edges between distinctive referents, same pre-filter,
 *               ordered by witnessed count, cut the same way.
 *
 *  `dmdCut` is injected (native/the-fold/resolutions.js) — never re-derived.
 *  `active` is the referents in play (the question's own, or the document's
 *  most connected). */
export function sourceGist({ index, genrePrior = null, dmdCut, dmdWindow = null, active = null, genericFloor = 2 } = {}) {
  if (typeof dmdCut !== 'function') throw new TypeError('sourceGist: dmdCut is injected (native/the-fold/resolutions.js) — never re-derived here');

  const isGeneric = (name) => {
    const g = genericityOfGenre(genrePrior, name);
    return g !== null && g >= genericFloor;
  };

  const asked = active && active.size ? active : new Set();
  const distinctive = [...index.entities.keys()].filter((n) => asked.has(n) || !isGeneric(n));
  const declaredRows = distinctive
    .map((name) => ({ name, ids: new Set([name]), degree: index.degreeOf(name) }))
    .sort((a, b) => b.degree - a.degree);
  const activeForDeclared = asked.size ? asked : new Set(declaredRows.slice(0, 1).map((r) => r.name));
  const declaredCut = dmdCut(declaredRows, activeForDeclared, { dmdWindow, reachOf: (r) => [...r.ids] });

  const edgeRows = index.edges
    .filter((e) => (asked.has(e.arg0) || !isGeneric(e.arg0)) && (asked.has(e.arg1) || !isGeneric(e.arg1)))
    .map((e) => ({ rel: e.rel, arg0: e.arg0, arg1: e.arg1, count: e.count, spans: e.spans, ids: new Set([e.arg0, e.arg1]) }));
  const activeForRels = asked.size ? asked : new Set(edgeRows.slice(0, 1).flatMap((r) => [...r.ids]));
  const relsCut = dmdCut(edgeRows, activeForRels, { dmdWindow, reachOf: (r) => [...r.ids] });

  const genericDropped = [...index.entities.keys()].filter((n) => !asked.has(n) && isGeneric(n));
  return {
    declared: declaredCut,
    relations: relsCut,
    disclosure: {
      totalEntities: index.entities.size,
      totalEdges: index.edges.length,
      docs: index.fileCount,
      genericDropped: genericDropped.length,
      genericFloor,
      genrePriorLoaded: Boolean(genrePrior && genrePrior.prior_terms),
      genre: genrePrior?.genre || null,
      basis: `BOILERPLATE DROPPED: ${genericDropped.length} of ${index.entities.size} referents dwell in the genre itself (${genrePrior?.genre || 'no prior'}; g² >= ${genericFloor}) and were dropped before the cut — the DMD budget is spent on what is distinctive HERE.`, 
    },
  };
}

// ── GFP → LANGUAGE-SPECIFIC GRAMMAR → NL ────────────────────────────────────
//
// LANGUAGE SCOPE, DISCLOSED (Greenberg): this stage is ENGLISH. The order and
// forms are learned from the UD English-EWT treebank, and normalizeRelation's
// head-picking assumes English's verb-late clause order ("the last word the
// prior calls verb-dominant"). That is a LANGUAGE-SPECIFIC mechanism, declared
// here, not presented as universal — a non-English projection needs its own
// measureOrder/learnForms over that language's treebank and its own head rule.
// The GFP it consumes stays language-neutral (Ground·Figure·Pattern); only this
// projection leg is English, and it says so.
//
// The last stage of the pipeline (the user's own framing): a GFP claim is
// language-neutral (Ground · Figure · Pattern, NO order). Turning it into
// grammatical natural language is the LANGUAGE'S projection, never a model:
//
//   GFP claim  →  a dependency tree (the deep structure)   [gfpToConllu]
//              →  the EOT meaning layer (order dropped)    [eot-rich.toEot]
//              →  line(Order) + form(Form) + words(Words) [eot-realize]
//              →  an English sentence                      [realizeGfp]
//
// Order and forms are MEASURED (eot-rich.measureOrder / eot-realize.learnForms
// over held-apart annotated sentences), never declared — an English-shaped
// rendering is a finding, not an assumption.

/** normalizeRelation(rel, { posPrior, lemmatizer }) -> { lemma, upos, feats }
 *  — the GFP pattern's relation as a grammatical head, not a raw surface
 *  phrase. The reader's `label` is the bytes between two ends (often a whole
 *  clause: "already has authority to implement"); the realizer needs ONE
 *  lemma with a word class and features. Pick the relation's HEAD verb (the
 *  last form the received POS prior attests as verb-dominant), lemmatize it,
 *  and default third-person present. A relation with no attested verb head is
 *  a NAMED GAP (`upos: null`) — never guessed into a verb. */
export function normalizeRelation(rel, { posPrior = null, lemmatizer = null } = {}) {
  const words = String(rel || '').toLowerCase().match(/[a-z']+/g) || [];
  if (!words.length) return { lemma: null, upos: null, feats: null, gap: 'empty relation' };
  const forms = posPrior?.forms || {};
  // the head is the last word the prior calls verb-dominant (verbs head their
  // clause late in English); absent a prior, the last word.
  let head = null;
  for (const w of words) { const c = forms[w]; if (c && (c.VERB || 0) + (c.AUX || 0) > 0 && (c.VERB || 0) + (c.AUX || 0) >= Math.max(c.NOUN || 0, c.ADJ || 0)) head = w; }
  if (!head) head = words[words.length - 1];
  const c = forms[head];
  const upos = c ? (c.VERB || 0) + (c.AUX || 0) >= Math.max(c.NOUN || 0, c.ADJ || 0, c.ADV || 0) ? ((c.AUX || 0) > (c.VERB || 0) ? 'AUX' : 'VERB') : 'NOUN' : null;
  if (!upos) return { lemma: head, upos: null, feats: null, gap: 'relation head is not an attested verb — no grammatical projection' };
  let lemma = head;
  try { if (lemmatizer && lemmatizer.lemma) lemma = lemmatizer.lemma(head) || head; } catch { /* keep the form */ }
  return { lemma, upos, feats: upos === 'VERB' ? 'VerbForm=Fin|Number=Sing|Person=3|Tense=Pres' : 'Number=Sing', head };
}


/** gfpToConllu(claim, { posPrior, lemmatizer }) -> a UD sentence (the deep
 *  structure) for a GFP claim: ARG0 is the subject (nsubj), the relation's
 *  normalized lemma is the root, ARG1 the object (obj), and polarity "-"
 *  attaches a neg marker. This is the ONE place a GFP triple's roles become
 *  dependency relations — the same bridge gfp-claim.js::claimFromTriple draws,
 *  run in reverse for speech. The relation is NORMALIZED to a lemma + word
 *  class (normalizeRelation) so the realizer has a grammatical head, not a raw
 *  surface phrase. */
export function gfpToConllu(claim, { posPrior = null, lemmatizer = null } = {}) {
  const arg0 = clean(claim?.roles?.ARG0) || clean(claim?.end1);
  const arg1 = clean(claim?.roles?.ARG1) || clean(claim?.end2);
  const relRaw = clean(claim?.rel);
  const neg = claim?.polarity === '-';
  if (!arg0 || !relRaw) return null;
  const r = normalizeRelation(relRaw, { posPrior, lemmatizer });
  if (!r.upos) return null; // a relation with no attested verb head cannot be projected — a named gap, never guessed
  const toks = [];
  const word = (form) => { const w = form.split(/\s+/); return w[w.length - 1]; };
  // 1 the root (the relation's lemma; the realizer inflects it)
  toks.push({ id: 1, lemma: r.lemma, upos: r.upos, feats: r.feats, head: 0, deprel: 'root', form: r.lemma });
  // 2 subject: the head token is the last word of ARG0
  toks.push({ id: 2, lemma: word(arg0).toLowerCase(), upos: 'NOUN', feats: 'Number=Sing', head: 1, deprel: 'nsubj', form: word(arg0) });
  let n = 3;
  // 3 object (optional)
  if (arg1) { toks.push({ id: n, lemma: word(arg1).toLowerCase(), upos: 'NOUN', feats: 'Number=Sing', head: 1, deprel: 'obj', form: word(arg1) }); n += 1; }
  // 4 negation marker on the verb
  if (neg) toks.push({ id: n, lemma: 'not', upos: 'PART', feats: 'Polarity=Neg', head: 1, deprel: 'advmod', form: 'not' });
  return { tokens: toks, lines: [], text: '', sentId: claim.id || null };
}

/** realizeGfp(claim, { toEot, realizeRecord, forms, params }) -> grammatical
 *  natural language, zero model. The organs are injected (they live in
 *  eoreader7/native/kernel/eot-rich.js and eot-realize.js) — never re-derived
 *  here. Returns null when the claim cannot be projected (no roles/relation). */
export function realizeGfp(claim, { toEot, realizeRecord, forms = null, params = null, posPrior = null, lemmatizer = null } = {}) {
  if (typeof toEot !== 'function' || typeof realizeRecord !== 'function') throw new TypeError('realizeGfp: toEot and realizeRecord are injected (eot-rich.js / eot-realize.js) — never re-derived');
  const sent = gfpToConllu(claim, { posPrior, lemmatizer });
  if (!sent) return null;
  const record = toEot(sent, { language: 'en' });
  return realizeRecord(record, { forms, params });
}

// ── THE SUMMARY, OVER ANYTHING ──────────────────────────────────────────────
//
// One function summarizes any EOT-bearing object — a source document, an
// entity's claims, a selection, a whole workspace — because all of them reduce
// to the same thing: a list of GFP claims. `summarizeAnything(claims, opts)`
// builds the index, cuts at the measured resolution, normalizes each relation,
// realizes each to grammatical NL (zero model), and attaches the provenance
// that makes every line clickable into its source span.

/** summarizeAnything(claims, opts) -> { lines, gist, check }.
 *    claims   EOT claims (the engine's own, or claimsFromReport's mapping)
 *    genrePrior  a measured GenrePrior@1 (or null — disclosed in the disclosure)
 *    dmdCut / dmdWindow  injected organs (resolutions.js / activation.js)
 *    toEot / realizeRecord / forms / params / posPrior / lemmatizer
 *               the language projection (eot-rich.js / eot-realize.js)
 *
 *  Every line carries: { text, gfp, rel, span:{s,e,text,doc}, arg0, arg1,
 *  count, sources } — clickable into the exact source bytes. */
export function summarizeAnything(claims, opts = {}) {
  const { genrePrior = null, dmdCut, dmdWindow = null, genericFloor = 2, toEot = null, realizeRecord = null, forms = null, params = null, posPrior = null, lemmatizer = null } = opts;
  const index = buildEotIndex(claims);
  const gist = sourceGist({ index, genrePrior, dmdCut, dmdWindow, genericFloor });
  const lines = (gist.relations.rows || []).map((e) => {
    const claim = { roles: { ARG0: e.arg0, ARG1: e.arg1 }, rel: e.rel, polarity: '+' };
    const nl = (toEot && realizeRecord) ? realizeGfp(claim, { toEot, realizeRecord, forms, params, posPrior, lemmatizer }) : null;
    const sp = (e.spans || [])[0] || {};
    return {
      text: nl || `${e.arg0} ${e.rel} ${e.arg1}`.trim(),
      rendered: !!nl,
      gfp: { ground: '/doc/' + (sp.id ? String(sp.id).split(':')[0] : '?') + '/' + sp.s + '-' + sp.e, rel: e.rel, roles: { ARG0: e.arg0, ARG1: e.arg1 } },
      rel: e.rel, arg0: e.arg0, arg1: e.arg1, count: e.count,
      span: { s: sp.s, e: sp.e, text: sp.text || '', id: sp.id },
      sources: [...(e.sources || e.docs || [])],
    };
  });
  const check = (typeof opts.satisfy === 'function') ? opts.satisfy({ gist, source: opts.source }) : null;
  return { lines, gist, check, disclosure: gist.disclosure };
}

// ── THE CLICKABLE MODAL ──────────────────────────────────────────────────────
// Every proposition is clickable into a modal showing the SOURCE bytes it was
// read from — the grounding made visible, never claimed. `mountSummary(host,
// summary, { onOpen })` renders it; `onOpen(line)` is called when a line is
// clicked (default: open the reader at that span). Self-contained styles.
export function renderSummaryHTML(summary, { title = 'What it is about' } = {}) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lines = summary?.lines || [];
  if (!lines.length) return '';
  const rows = lines.map((l, i) => `
    <button type="button" class="hs-line" data-i="${i}" title="Click to see the source">
      <span class="hs-text">${esc(l.text)}</span>
      <span class="hs-prov">${l.rendered ? '' : '<i class="hs-gap">no verb head</i>'}·
        <span class="hs-span" data-i="${i}">source ${esc(l.span.s)}–${esc(l.span.e)}</span></span>
    </button>`).join('');
  const dismiss = summary.check && !summary.check.ok ? `<div class="hs-warn">${summary.check.violations.length} proposition(s) fail the grounding check — shown, not hidden.</div>` : '';
  return `<div class="hs-summary">
    <div class="hs-head"><span class="hs-title">${esc(title)}</span><span class="hs-count">${lines.length} proposition${lines.length === 1 ? '' : 's'}</span></div>
    ${dismiss}
    <div class="hs-lines">${rows}</div>
  </div>`;
}

export const SUMMARY_CSS = `
.hs-summary{border:1px solid var(--line,#2b2450);border-radius:10px;background:var(--s1,#fff);padding:10px 12px;font:13px/1.45 'Hanken Grotesk',system-ui,sans-serif;color:var(--ink)}
.hs-head{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}
.hs-title{font:600 11px 'JetBrains Mono';letter-spacing:.08em;text-transform:uppercase;color:var(--mut)}
.hs-count{margin-left:auto;font:500 11px 'JetBrains Mono';color:var(--dim)}
.hs-warn{font:500 11px/1.4 'Hanken Grotesk';color:var(--bad,#c53030);border:1px solid var(--line2);border-radius:6px;padding:3px 8px;margin-bottom:6px}
.hs-lines{display:flex;flex-direction:column}
.hs-line{all:unset;cursor:pointer;display:flex;flex-direction:column;gap:1px;padding:6px 0;border-top:1px solid var(--line)}
.hs-line:first-child{border-top:0}
.hs-line:hover .hs-text{color:var(--acc)}
.hs-text{font:400 15px/1.4 'Newsreader',serif;color:var(--ink)}
.hs-prov{font:400 11px 'JetBrains Mono';color:var(--dim);display:flex;gap:6px}
.hs-span{color:var(--acc);text-decoration:underline}
.hs-gap{color:var(--amber,#b7791f);font-style:normal}
`;

/** The modal: given a proposition's span, show the source bytes, highlighted. */
export function renderSourceModal(line, source) {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const s = line.span.s, e = line.span.e;
  const before = String(source || '').slice(Math.max(0, s - 200), s);
  const hit = String(source || '').slice(s, e);
  const after = String(source || '').slice(e, e + 200);
  return `<div class="hs-modal-bg"><div class="hs-modal">
    <div class="hs-modal-h"><b>${esc(line.arg0)} —${esc(line.rel)}→ ${esc(line.arg1)}</b><button type="button" class="hs-x">✕</button></div>
    <div class="hs-modal-b">…${esc(before)}<mark>${esc(hit)}</mark>${esc(after)}…</div>
    <div class="hs-modal-f">bytes ${s}–${e}${line.sources && line.sources.length ? ' · ' + esc(line.sources.join(', ')) : ''}</div>
  </div></div>`;
}
