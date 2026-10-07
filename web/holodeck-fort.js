// holodeck-fort.js — ARCHON FORT: what a human would stop and ask "what kind of thing is that?" about.
//
// Named for Charles Fort, who collected the data the sciences had damned: the anomalies a system files away
// because they don't fit. The Holodeck's reading admits whatever its rules admit, and word salad taught us what
// that costs ("Freddie Open Freddie" folded into the picture like a person). Fort's charge is the opposite of
// admission: RAISE whatever is odd, then let a swarm try to FALSIFY each oddity before anyone believes it.
//
// Raising (fortScan) is mechanical and narrow. Each raiser is a shape a careful reader flags:
//   splice          pieces of other known names glued at a join no source writes ("Freddie Open Freddie")
//   repeat          the same word twice inside one name
//   inner-article   "The"/"A"/"An" capitalised inside a name
//   sentence-start  its first word is only capitalised because it opens the sentence ("Whether OHS")
//   label           it opens a line and is followed by a colon: a form field, not a name ("REVISION NUMBER:")
//   dangling        it ends on a word that is only ever a preposition, conjunction or auxiliary ("CONTRACT FOR SERVICES BETWEEN")
//   clause-word     it holds a word with no noun, name or adjective reading at all ("Same Exec Who Literally Signed…")
//   ocr             a word written nowhere else that becomes a corpus word once OCR confusions are undone ("Metropolltan")
//   salad           a statement whose word pairs are rarer in the corpus than the corpus's own 1st percentile
//   run-together    two names joined by "and" read as one ("Nashville Scene and Nashville Post")
//   composite       a name read as the same thing as a list of names ("X and Y")
// The swarm (ants) are small independent witnesses, each with its own ground. Each says real, artifact, or nothing,
// and standing is TYPED from what they say, never decided by one:
//   stands      every ant that spoke says artifact: still odd, a person should look
//   falsified   every ant that spoke says real: the oddity is how the world is ("Room In The Inn")
//   contested   the ants disagree; both sides stay on the record
//   unexamined  no ant had ground to speak
// Grounds are the workspace itself (its own statements, casings, and written names) and eoreader7's vendored English
// part-of-speech prior. Floors are percentiles of the corpus's own statements (the echoFloor convention).
// Nothing here calls a model, edits the reading, or removes anything from the picture: Fort flags, people inspect.
//
// History, measured by a blind three-grader panel on the OHS corpus (2026-09-28): v3's "stands" was 65% odd against a
// 55% base rate among names it never raised, and its "falsified" pile was 60% odd because recurrence cleared labels that
// recur across contract templates. v4 is what those errors licensed; it is scored on a fresh held-out sample.

const FN = new Set('the a an of and or to in on at by for with from as is are was were be been has have had it its this that these those his her their our your my not no'.split(' '));
const toks = t => (String(t).toLowerCase().replace(/[’]/g, "'").match(/[a-z0-9']+/g) || []);
const pairs = t => { const w = toks(t), out = []; for (let i = 1; i < w.length; i++) out.push(w[i - 1] + ' ' + w[i]); return out; };
const q = (arr, p) => { if (!arr.length) return 0; const s = arr.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const fold = s => String(s).replace(/[’]/g, "'");
const LQ = '“', RQ = '”', qt = s => LQ + s + RQ;

// eoreader7's received English POS prior (UD tag counts per form). Loaded once; without it the POS raisers stay silent.
let POS = null;
try { POS = await fetch(new URL('./vendor/eoreader7/native/priors/pos-eng.json', import.meta.url)).then(r => r.ok ? r.json() : null).then(j => j && j.forms); } catch (e) { POS = null; }
const NOMINAL = ['NOUN', 'PROPN', 'ADJ', 'NUM', 'X', 'SYM'];
const posOf = w => (POS && POS[String(w).toLowerCase().replace(/[.,;:]+$/, '')]) || null;
const onlyIn = (w, classes) => { const c = posOf(w); if (!c) return null; const k = Object.keys(c); return k.length && k.every(x => classes.includes(x)) ? c : null; };
const clauseOnly = w => { const c = posOf(w); if (!c || /(ing|ed)$/i.test(w)) return null; // participles modify names (Assisted Living, Purchasing Card)
  const k = Object.keys(c); if (!k.length || k.some(x => NOMINAL.includes(x))) return null; const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; return ['AUX', 'PRON', 'ADV', 'SCONJ', 'PART', 'VERB'].includes(top) ? c : null; }; // dominant reading: "of"/"The" carry stray ADV/PRON counts
const show = c => Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(', ');

// ---------- corpus index (cached per corpus) ----------
let _ix = null;
function indexOf(A) {
  const key = A.docs.map(d => d.id + ':' + (d.text || '').length).join('|');
  if (_ix && _ix.key === key) return _ix;
  const docPairs = new Map(), pairDocs = new Map();
  A.docs.forEach(d => { const S = new Set(pairs(d.text || '')); docPairs.set(d.id, S); S.forEach(p => pairDocs.set(p, (pairDocs.get(p) || 0) + 1)); });
  const chunks = new Map(); // contiguous word runs of every multi-word name -> the names they come from
  Object.keys(A.names).forEach(n => { const w = n.split(' '); if (w.length < 2) return; for (let i = 0; i < w.length; i++) for (let j = i + 1; j <= Math.min(w.length, i + 5); j++) { const c = w.slice(i, j).join(' '); (chunks.get(c) || chunks.set(c, new Set()).get(c)).add(n); } });
  // casing: how often each word is written lowercase, and how often capitalised NOT at a sentence start
  const lower = new Map(), capMid = new Map(), any = new Map();
  A.docs.forEach(d => { const t = d.text || '', re = /[A-Za-z][A-Za-z'’]*/g; let m; while ((m = re.exec(t))) { const w = m[0], k = w.toLowerCase(); any.set(k, (any.get(k) || 0) + 1);
    if (w === k) lower.set(k, (lower.get(k) || 0) + 1); else if (m.index > 0 && !/[.!?:\n"“(]\s*$/.test(t.slice(Math.max(0, m.index - 3), m.index))) capMid.set(k, (capMid.get(k) || 0) + 1); } });
  // every written name mention with its context: run -> mentions, and name -> mentions
  const runs = new Map(), uses = new Map();
  A.sts.forEach(st => st.rawNames.forEach(r => { const w = fold(r.name).split(' ');
    for (let i = 0; i < w.length; i++) for (let j = i + 1; j <= Math.min(w.length, i + 5); j++) { const c = w.slice(i, j).join(' '); let M = runs.get(c); if (!M) runs.set(c, M = []); M.push({ name: fold(r.name), doc: st.doc }); }
    const before = st.text.slice(0, r.s), after = st.text.slice(r.e);
    const cx = (before.toLowerCase().match(/[a-z0-9']+/g) || []).slice(-2).join(' ') + ' _ ' + (after.toLowerCase().match(/[a-z0-9']+/g) || []).slice(0, 2).join(' ');
    const u = { doc: st.doc, id: st.id, cx, lineStart: /^[\s"'“(•*\-\d.)]*$/.test(before), label: /^\s*:/.test(after), title: /^[\s"'“(]*$/.test(before) && (/^\s*$/.test(after) || /^\s*[,(–—-].{0,40}\b(19|20)\d\d\b/.test(after)) };
    (uses.get(r.name) || uses.set(r.name, []).get(r.name)).push(u); }));
  return (_ix = { key, docPairs, pairDocs, chunks, lower, capMid, any, runs, uses });
}
const elsewhere = (ix, p, own) => (ix.pairDocs.get(p) || 0) - [...own].filter(d => (ix.docPairs.get(d) || new Set()).has(p)).length;
const rarity = (ix, text, own) => { const ps = pairs(text); if (!ps.length) return null; return ps.filter(p => elsewhere(ix, p, own) > 0).length / ps.length; };
const fnRarity = (ix, text, own) => { const ps = pairs(text).filter(p => { const [a, b] = p.split(' '); return FN.has(a) || FN.has(b); }); if (ps.length < 3) return null; return ps.filter(p => elsewhere(ix, p, own) > 0).length / ps.length; };

// splice: can the name be cut into 2+ runs, each a run of some OTHER known name? (shortest cut wins)
function spliceOf(ix, n, A, F) {
  const weight = x => { const N = A.names[x]; if (!N) return 0; return [...N.docs].filter(d => !F.has(d)).length * 1000 + N.sts.length; };
  const w = n.split(' '), best = new Array(w.length + 1).fill(null); best[0] = [];
  for (let i = 0; i < w.length; i++) { if (!best[i]) continue; for (let j = i + 1; j <= w.length; j++) { const c = w.slice(i, j).join(' '); const from = [...(ix.chunks.get(c) || [])].filter(x => x !== n); if (!from.length) continue; const cand = best[i].concat([{ c, from: from.sort((a, b) => weight(b) - weight(a))[0] }]); if (!best[j] || cand.length < best[j].length) best[j] = cand; } }
  return best[w.length] && best[w.length].length >= 2 ? best[w.length] : null;
}

// OCR: undo up to two standard scanner confusions; if a word written nowhere else becomes a corpus word, it was misread
const CONF = [['rn', 'm'], ['m', 'rn'], ['cl', 'd'], ['d', 'cl'], ['1', 'l'], ['l', '1'], ['l', 'i'], ['i', 'l'], ['0', 'o'], ['vv', 'w'], ['li', 'h'], ['ii', 'n'], ['c', 'g'], ['g', 'c'], ['e', 'c'], ['c', 'e'], ['u', 'n'], ['n', 'u'], ['h', 'b'], ['a', 'o']];
function ocrOf(ix, word) {
  let frontier = [word], seen = new Set([word]);
  for (let step = 0; step < 2; step++) { const next = [];
    for (const k of frontier) for (const [a, b] of CONF) { let at = k.indexOf(a); while (at >= 0) { const v = k.slice(0, at) + b + k.slice(at + a.length); if (!seen.has(v)) { seen.add(v); if ((ix.any.get(v) || 0) >= 2) return { v, steps: step + 1 }; next.push(v); } at = k.indexOf(a, at + 1); } }
    frontier = next; }
  return null;
}

export const standingOf = ants => { const sp = ants.filter(a => a.verdict !== 'silent'); if (!sp.length) return 'unexamined'; if (sp.every(a => a.verdict === 'artifact')) return 'stands'; if (sp.every(a => a.verdict === 'real')) return 'falsified'; return 'contested'; };
function docNullAnt(doc, ctx) { const v = ctx.nullByDoc[doc]; return v === 'chance' ? { ant: 'doc-null', verdict: 'artifact', why: 'its document’s names recur no more than its own words shuffled' } : v === 'above' ? { ant: 'doc-null', verdict: 'real', why: 'its document’s names recur more than its words shuffled' } : { ant: 'doc-null', verdict: 'silent', why: 'no shuffle null for its document' }; }

// ---------- the swarm ----------
function antsForName(A, ix, n, o, ctx) {
  const N = A.names[n] || { sts: [], docs: new Set() }, own = N.docs, out = [], U = ix.uses.get(n) || [];
  // recurrence: only uses INSIDE running prose count; a label or heading that recurs across a template proves nothing
  // and a template repeats the whole sentence, so the wording around it must differ too (two words either side)
  const PU = U.filter(u => !u.lineStart && !u.label), prose = new Set(PU.map(u => u.doc)), cxs = new Set(PU.map(u => u.cx));
  out.push(prose.size >= 2 && cxs.size >= 2 ? { ant: 'recurrence', verdict: 'real', why: 'used inside running prose in ' + prose.size + ' sources, in ' + cxs.size + ' different wordings' } : prose.size >= 2 ? { ant: 'recurrence', verdict: 'silent', why: 'it recurs in ' + prose.size + ' sources, but always in the same wording, as a template would' } : { ant: 'recurrence', verdict: 'silent', why: U.length > 1 ? 'it recurs, but only as a line opener or label, which templates repeat' : 'written in one place only, as new names also are' });
  // attestation: each adjacent word pair must be written INSIDE another name, not merely next to each other in prose
  const nw = fold(n).split(' '), inner = nw.slice(1).map((x, i) => nw[i] + ' ' + x), dead = inner.filter(p => !(ix.runs.get(p) || []).some(m => m.name !== fold(n) && !own.has(m.doc)));
  out.push(inner.length && !dead.length ? { ant: 'attestation', verdict: 'real', why: 'every word pair in it (' + inner.map(qt).join(', ') + ') is written inside other names elsewhere' } : { ant: 'attestation', verdict: 'silent', why: inner.length ? dead.map(qt).join(', ') + ' is written nowhere else; ordinary for a name from one source' : 'no word pairs to check' });
  const st = A.byId[o.id]; const r = st ? rarity(ix, st.text, new Set([st.doc])) : null; const FL = ctx.floorFor(o.doc);
  out.push(r == null ? { ant: 'sentence', verdict: 'silent', why: 'no sentence to measure' } : r < FL.floor ? { ant: 'sentence', verdict: 'artifact', why: 'its sentence has ' + Math.round(r * 100) + '% of word pairs seen elsewhere; normal here (' + FL.hop + ') has a 1st percentile of ' + Math.round(FL.floor * 100) + '%' } : { ant: 'sentence', verdict: 'silent', why: 'its sentence reads within its region\u2019s range (' + FL.hop + ')' });
  // bound piece: a leading piece that, everywhere else it is written, continues into ONE name, followed here by something else
  if (o.splice) { const torn = o.splice.map(x => { const occ = (ix.runs.get(fold(x.c)) || []).filter(m => !own.has(m.doc) && m.name !== fold(n)); if (occ.length < 2) return null; const names = new Set(occ.map(m => m.name)); if (names.size !== 1) return null; const top = [...names][0];
      if (!top.startsWith(fold(x.c) + ' ')) return null; const tw = top.split(' '), pw = fold(x.c).split(' '), nw = fold(n).split(' '); const at = nw.findIndex((_, i) => nw.slice(i, i + pw.length).join(' ') === fold(x.c)); const after = nw[at + pw.length], expect = tw[pw.length]; return after && after !== expect ? { piece: x.c, top, of: occ.length, after, expect } : null; }).filter(Boolean);
    out.push(torn.length ? { ant: 'bound-piece', verdict: 'artifact', why: torn.map(t => qt(t.piece) + ' is written elsewhere ' + t.of + ' times, every time as part of ' + qt(t.top) + '; here it is followed by ' + qt(t.after) + ' instead of ' + qt(t.expect)).join('; ') } : { ant: 'bound-piece', verdict: 'silent', why: 'its pieces are free words, not fragments of one other name' }); }
  // usage: is it ever used as a name in the middle of running prose? (label/heading/line-opener shapes only)
  if (o.kinds.some(k => ['sentence-start', 'label', 'clause-word', 'dangling'].includes(k))) {
    const mid = U.find(u => !u.lineStart && !u.label), allTitles = U.length && U.every(u => u.title);
    out.push(mid ? { ant: 'usage', verdict: 'real', why: 'it is used mid-sentence elsewhere, so its capitals belong to it' } : allTitles && !o.kinds.includes('clause-word') && !o.kinds.includes('dangling') && !o.kinds.includes('label') ? { ant: 'usage', verdict: 'silent', why: 'it only appears as a title line (a heading with a date), where capitals are normal' } : { ant: 'usage', verdict: 'artifact', why: 'it is never used inside a sentence: only ' + (U.some(u => u.label) ? 'as a line followed by a colon' : 'at the start of a line') });
  }
  // POS prior: an independent ground from treebanks, not this corpus
  if (o.pos) out.push({ ant: 'pos-prior', verdict: 'artifact', why: o.pos });
  // variant: a shortened form of a LONGER name written more often (Justin Wilson / Justin P. Wilson). Only this
  // direction: a name that CONTAINS a known name is what a splice looks like, so containing proves nothing.
  const sig = x => x.split(' ').filter(t => !/^[A-Z]\.?$/.test(t)), mine = sig(n), sub = (a, b) => { let i = 0; for (const t of b) { if (t === a[i]) i++; else if (!FN.has(t.toLowerCase())) return false; } return i === a.length; }; // may skip only initials and function words
  const fuller = mine.length >= 2 ? Object.keys(A.names).find(m => m !== n && A.names[m].sts.length > N.sts.length && sig(m).length > mine.length && sub(mine, sig(m))) : null;
  out.push(fuller ? { ant: 'variant', verdict: 'real', why: 'a shortened form of ' + qt(fuller) + ', which is written ' + A.names[fuller].sts.length + ' times' } : { ant: 'variant', verdict: 'silent', why: 'not a shortened form of a better-attested name' });
  { const dd = A.docs.find(x => x.id === o.doc); if (dd && dd.eng) { const k = n.toLowerCase(), hit = dd.eng.referents.find(r => r.surfaces.some(x => x.toLowerCase() === k));
    out.push(hit ? { ant: 'engine', verdict: 'real', why: 'the engine’s own reader also admitted it (' + hit.routes.join(' + ') + (hit.grain ? ', existence grain ' + hit.grain : '') + ')' } : { ant: 'engine', verdict: 'silent', why: 'the engine’s reader did not admit it; that reader also misses real names, so this is no vote' }); } }
  out.push(docNullAnt(o.doc, ctx));
  return out;
}

const SHORT = { splice: o => 'glued from ' + [...new Set(o.splice.map(x => x.from))].slice(0, 3).join(' + '), repeat: () => 'a word repeated inside one name', 'inner-article': () => qt('The') + ' in the middle of a name', 'sentence-start': () => 'its first word only opens the sentence', label: () => 'a form label, not a name', 'run-together': () => 'two names run together', dangling: () => 'cut off mid-phrase', 'clause-word': () => 'a sentence or headline, not a name', ocr: o => 'looks like a scanner misreading of ' + qt(o.ocr) };

export function fortScan(A, { focus, nullByDoc = {}, merges = [], hygiene = null } = {}) {
  const ix = indexOf(A), F = new Set(focus || []), out = [];
  const measured = new Set(A.docs.filter(d => d.measured).map(d => d.id));
  // the null: pair-rarity of statements from OTHER documents, each measured against everything but its own document
  let pool = A.sts.filter(s => !s.ref && !F.has(s.doc) && !measured.has(s.doc)); if (pool.length < 50) pool = A.sts.filter(s => !s.ref && !measured.has(s.doc));
  const step = Math.max(1, Math.floor(pool.length / 600)), base = [], fbase = [];
  for (let i = 0; i < pool.length; i += step) { const own = new Set([pool[i].doc]); const r = rarity(ix, pool[i].text, own); if (r != null && pairs(pool[i].text).length >= 6) base.push(r); const f = fnRarity(ix, pool[i].text, own); if (f != null) fbase.push(f); }
  const ctx = { floor: q(base, 0.01), ffloor: q(fbase, 0.01), nullByDoc, sample: base.length, pos: !!POS };
  // the regional null (holodeck-region.js): a statement is judged against the floor of the smallest region around it that
  // differs from its surroundings and can state a 1st percentile: this document, then its kind, then the workspace
  const R = globalThis.HDRegion, kindOf = d => d.kind || d.type || d.medium || 'Source', floors = new Map(), byKind = new Map(), byDoc = new Map();
  if (R) A.sts.forEach(s => { if (s.ref || pairs(s.text).length < 6) return; const d = A.docById[s.doc] || {}; const r = rarity(ix, s.text, new Set([s.doc])); if (r == null) return; (byDoc.get(s.doc) || byDoc.set(s.doc, []).get(s.doc)).push(r); const k = kindOf(d); (byKind.get(k) || byKind.set(k, []).get(k)).push(r); });
  ctx.floorFor = doc => { if (!R) return { floor: ctx.floor, hop: 'the workspace' }; let f = floors.get(doc); if (!f) { const d = A.docById[doc] || {}, k = kindOf(d);
      f = R.normalQuantile([{ name: 'this document', values: byDoc.get(doc) || [] }, { name: k + ' documents', values: byKind.get(k) || [] }, { name: 'the workspace', values: base }], 0.01, { key: 'floor|' + doc });
      if (f.floor == null) f = { floor: ctx.floor, hop: 'the workspace' }; floors.set(doc, f); } return f; };
  const seen = new Set(), hyByDoc = new Map();
  A.sts.forEach(st => { if (!F.has(st.doc) || st.ref) return;
    st.names.forEach(n => { if (seen.has(n) || !/\s/.test(n)) return; seen.add(n); const w = n.split(' '), raised = []; let pos = null, ocr = null, sp = null;
      const rep = w.filter((x, i) => !FN.has(x.toLowerCase()) && w.findIndex(y => y.toLowerCase() === x.toLowerCase()) !== i); if (rep.length) raised.push({ kind: 'repeat', why: qt(rep[0]) + ' appears twice inside one name' });
      const art = w.findIndex((x, i) => i > 0 && /^(The|A|An)$/.test(x)); if (art > 0) raised.push({ kind: 'inner-article', why: qt(w[art]) + ' sits capitalised inside the name' });
      sp = spliceOf(ix, n, A, F); if (sp) { const joins = []; for (let k = 1; k < sp.length; k++) { const a = sp[k - 1].c.split(' ').pop(), b = sp[k].c.split(' ')[0]; if (elsewhere(ix, (a + ' ' + b).toLowerCase(), (A.names[n] || {}).docs || new Set()) === 0) joins.push(a + ' ' + b); }
        if (joins.length) raised.push({ kind: 'splice', why: 'pieced from ' + sp.map(x => qt(x.c) + ' (as in ' + x.from + ')').join(' + ') + ', joined at ' + qt(joins[0]) + ', which no source writes' }); else sp = null; }
      const r0 = st.rawNames.find(r => r.name === n), before = r0 ? st.text.slice(0, r0.s) : 'x', after = r0 ? st.text.slice(r0.e) : '', w0 = w[0].toLowerCase();
      const hyD = hygiene ? (hyByDoc.get(st.doc) || hyByDoc.set(st.doc, hygiene.forDoc(A.docById[st.doc] || { id: st.doc })).get(st.doc)) : null;
      if (r0 && /^[\s"'\u201c(]*$/.test(before) && (hyD ? hyD.ordinaryOpener(w[0]) : (ix.lower.get(w0) || 0) > (ix.capMid.get(w0) || 0))) raised.push({ kind: 'sentence-start', why: qt(w[0]) + ' opens the sentence, and ' + (hyD ? hyD.lastWhy : 'elsewhere it is written lowercase ' + (ix.lower.get(w0) || 0) + ' times but capitalised mid-sentence only ' + (ix.capMid.get(w0) || 0)) });
      if (r0 && /^[\s"'“(•*\-\d.)]*$/.test(before) && /^\s*:/.test(after)) raised.push({ kind: 'label', why: 'it opens the line and is followed by a colon, the shape of a form field' });
      const last = onlyIn(w[w.length - 1], ['ADP', 'CCONJ', 'SCONJ', 'DET', 'AUX', 'PART', 'PRON']); if (last) { raised.push({ kind: 'dangling', why: 'it ends on ' + qt(w[w.length - 1]) + ', which is only ever ' + show(last) + ' in the English prior' }); pos = qt(w[w.length - 1]) + ' is only ever ' + show(last) + ' in eoreader7’s English part-of-speech prior'; }
      const cw = w.map(x => [x, clauseOnly(x)]).filter(([x, c]) => c && !FN.has(x.toLowerCase())); if (cw.length) { raised.push({ kind: 'clause-word', why: cw.map(([x, c]) => qt(x) + ' is ' + show(c)).join('; ') + ' and never a noun or name' }); pos = (pos ? pos + '; ' : '') + cw.map(([x, c]) => qt(x) + ' has no noun, name or adjective reading (' + show(c) + ')').join('; '); }
      for (const x of w) { const k = fold(x).toLowerCase().replace(/'s$/, '').replace(/[.,;:]+$/, ''); if (k.length < 4 || /[^a-z01]/.test(k)) continue; if ((ix.any.get(k) || 0) > (st.text.toLowerCase().split(k).length - 1)) continue; const hit = ocrOf(ix, k); if (hit) { ocr = hit.v; raised.push({ kind: 'ocr', why: qt(x) + ' is written nowhere else, but with ' + (hit.steps === 1 ? 'one' : 'two') + ' standard scanner confusion' + (hit.steps === 1 ? '' : 's') + ' undone it reads ' + qt(hit.v) + ', a word the corpus uses ' + ix.any.get(hit.v) + ' times' }); break; } }
      const parts = n.split(/ (?:and|&) /); if (parts.length === 2 && parts.every(p => /\s/.test(p) && (A.names[p] || ix.chunks.has(p)) && p !== n)) raised.push({ kind: 'run-together', why: 'both ' + qt(parts[0]) + ' and ' + qt(parts[1]) + ' are names on their own, joined by ' + qt('and') });
      if (!raised.length) return;
      const o = { subject: n, doc: st.doc, id: st.id, kinds: raised.map(r => r.kind), why: raised.map(r => r.why).join('; '), splice: sp, pos, ocr };
      o.short = (SHORT[o.kinds[0]] || (() => o.why))(o);
      o.ants = antsForName(A, ix, n, o, ctx); o.standing = standingOf(o.ants); delete o.splice; delete o.pos; out.push(o); });
    if (!measured.has(st.doc)) { const own = new Set([st.doc]); const r = rarity(ix, st.text, own); const FL = ctx.floorFor(st.doc); if (r != null && pairs(st.text).length >= 6 && r < FL.floor) {
      const f = fnRarity(ix, st.text, own), odd = out.filter(x => x.id === st.id && x.standing !== 'falsified');
      const ants = [f == null ? { ant: 'function-words', verdict: 'silent', why: 'too few function-word pairs to judge grammar' } : f < ctx.ffloor ? { ant: 'function-words', verdict: 'artifact', why: 'even its function-word pairs (' + qt('of the') + ', ' + qt('in a') + ') are unusual: ' + Math.round(f * 100) + '% seen elsewhere vs a floor of ' + Math.round(ctx.ffloor * 100) + '%' } : { ant: 'function-words', verdict: 'real', why: 'its grammar words pair normally (' + Math.round(f * 100) + '%); only its subject is new' },
        odd.length ? { ant: 'names', verdict: 'artifact', why: 'it holds ' + odd.map(x => qt(x.subject)).join(', ') + ', already odd' } : { ant: 'names', verdict: 'silent', why: 'no odd names in it' }, docNullAnt(st.doc, ctx)];
      out.push({ subject: st.text.length > 90 ? st.text.slice(0, 89) + '…' : st.text, doc: st.doc, id: st.id, kinds: ['salad'], short: 'a sentence whose word pairs appear nowhere else', why: 'only ' + Math.round(r * 100) + '% of its word pairs occur anywhere else; normal here (' + FL.hop + ') has a 1st percentile of ' + Math.round(FL.floor * 100) + '%', ants, standing: standingOf(ants) }); } } });
  merges.forEach(m => { if (!F.has(m.doc) || !/ (and|&) /i.test(m.to)) return; const sides = m.to.split(/ (?:and|&) /i).map(s => s.trim()); const known = sides.filter(s => A.names[s] || [...(ix.chunks.get(s) || [])].some(x => x !== m.to));
    const ants = [known.length >= 2 ? { ant: 'both-sides', verdict: 'artifact', why: 'both ' + qt(sides[0]) + ' and ' + qt(sides[sides.length - 1]) + ' stand as names on their own' } : { ant: 'both-sides', verdict: 'silent', why: 'only one side is a known name' }];
    out.push({ subject: m.from + ' → ' + m.to, doc: m.doc, id: m.id, kinds: ['composite'], short: 'read as the same thing as a list of names', why: qt(m.from) + ' was read as the same thing as a list of names', ants, standing: standingOf(ants) }); });
  return { oddities: out, ctx };
}
