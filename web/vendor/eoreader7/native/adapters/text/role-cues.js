// native/adapters/text/role-cues.js — who-did-what by COMPETING CUES
// (2026-09-27). User direction: "we should never ignore meaning that a medium
// is trying to use."
//
// relations-case-marked.js reads role off one channel (a word's case ending,
// top reading only, below a share floor = silence) and lets word order break
// a tie. Russian carries role in at least four channels at once, and a
// sentence routinely leans on the one the others leave open:
//   ending      the noun's own case ending — decisive for OVS "Книгу читает
//               мальчик", silent where nominative and accusative share a form
//               (inanimate masculine, neuter, inanimate plural: 59% of objects
//               in GSD test)
//   order       SVO is 83% of transitive clauses in GSD test — flexible, not free
//   agreement   the finite verb agrees with its subject: number and person in
//               the present, number and gender in the past — "Бытие определяет
//               сознание" is settled by nothing else
//   valency     the verb's own ending says whether the clause takes a first end
//               (pro-drop) and a second (a -ся verb takes none)
//   the noun phrase   an agreeing modifier marks case again ("специальное
//               разрешение"); a head right after a head is its genitive
//   animacy and the word itself   an infant knows "мама", not just "-ма";
//               a word heard fewer than minVolume times says nothing and
//               the reader falls back on its ending
// Agreement is learned as the PAIR of values (noun number, verb number), never
// as a same/differ verdict imposed here: that was measured on dev to hurt.
//
// PRIOR ART. The Competition Model (Bates & MacWhinney 1982, 1989): a listener
// assigns roles by weighing cues, each by its measured validity in the
// language; Kempe & MacWhinney 1999 measured Russian. Here every cue's
// validity is COUNTED from a treebank's training split — P(cue value | role)
// — and combined naive-Bayes style per candidate, then jointly per clause
// (one first end, at most one second end, never the same word). Nothing is
// typed in per language; a channel the treebank shows to be uninformative
// simply carries a likelihood ratio near 1.
//
// REFUSAL. The best clause assignment must beat the runner-up by a declared
// log-odds `margin`, or the clause is a typed gap listing both — a near-tie
// is the medium saying it has not decided, and this organ says so rather
// than picking. Every number is declared by the caller (P9).
//
// Roles are the arrangement's ends (end1 / end2, never subject / object):
// learning reads UD's nsubj / obj as the giver's labels for them.

const ROLES = ["end1", "end2", "other"];
const lower = (w) => String(w).toLowerCase();

const featMap = (feats) => (feats && feats !== "_" ? Object.fromEntries(feats.split("|").map((f) => f.split("="))) : {});

function tallyInto(table, key, value) { if (!table.has(key)) table.set(key, new Map()); const m = table.get(key); m.set(value, (m.get(value) ?? 0) + 1); }
function topOf(table, key, minVolume) {
  const m = table.get(key); if (!m) return null;
  let total = 0, top = null, n = 0; for (const [v, c] of m) { total += c; if (c > n) { top = v; n = c; } }
  return total >= minVolume ? top : null;
}

/**
 * learnRoleCues(sentences, { endingLen, verbEndingLen, minVolume, isHead, smoothing })
 * sentences: parsed UD sentences, each { tokens: [{ id, form, upos, feats, head, deprel }] }.
 * Only single-finite-verb clauses teach (the same scope the reader serves).
 */
export function learnRoleCues(sentences, { endingLen, verbEndingLen, minVolume, isHead, adpositions, excludeForms, smoothing, teacher = null } = {}) {
  for (const [k, v] of Object.entries({ endingLen, verbEndingLen, minVolume, isHead, adpositions, excludeForms, smoothing })) if (v == null) throw new TypeError(`learnRoleCues: '${k}' must be declared`);
  // Surface -> feature tables: what an ending says about Number/Gender/Person.
  const nomFeat = { Number: new Map(), Gender: new Map(), Person: new Map(), Animacy: new Map() };
  const verbFeat = { Number: new Map(), Gender: new Map(), Person: new Map() };
  for (const s of sentences) for (const t of s.tokens) {
    const f = featMap(t.feats), w = lower(t.form);
    if (["NOUN", "PROPN", "PRON"].includes(t.upos)) for (const k of Object.keys(nomFeat)) if (f[k]) { tallyInto(nomFeat[k], w.slice(-endingLen), f[k]); if (t.upos === "PRON") tallyInto(nomFeat[k], `=${w}`, f[k]); }
    if ((t.upos === "VERB" || t.upos === "AUX") && f.VerbForm === "Fin") for (const k of Object.keys(verbFeat)) if (f[k]) tallyInto(verbFeat[k], w.slice(-verbEndingLen), f[k]);
  }
  const feats = { nomFeat, verbFeat, endingLen, verbEndingLen, minVolume, isHead, adpositions, excludeForms };
  // Cue -> role counts over candidate heads of single-finite-verb clauses.
  const counts = new Map(); const roleTotals = { end1: 0, end2: 0, other: 0 };
  // VALENCY, the verb's own channel: does a clause built on this verb ending
  // carry a first end (pro-drop says not always) and a second end (a -ся verb
  // is reflexive and takes none)? Counted per verb ending, global as back-off.
  const valency = new Map(); const valencyAll = { clauses: 0, withEnd1: 0, withEnd2: 0, knownEnd1: 0, knownEnd2: 0 };
  const bump = (cue, value, role) => { const k = `${cue}\u0001${value}`; if (!counts.has(k)) counts.set(k, { end1: 0, end2: 0, other: 0 }); counts.get(k)[role] += 1; };
  // TEACHER. Default: the treebank's own nsubj/obj labels, a received giver.
  // `teacher(words, verbIndex) -> { end1Index, end2Index } | null` replaces
  // them — the infant's route: only clauses the teacher can settle teach, and
  // the labels are the teacher's, never the treebank's.
  for (const s of sentences) {
    const fin = s.tokens.filter((t) => (t.upos === "VERB" || t.upos === "AUX") && featMap(t.feats).VerbForm === "Fin");
    if (fin.length !== 1) continue;
    const verb = fin[0];
    // The reader's own view: letter tokens only, the verb found by position.
    const toks = s.tokens.filter((t) => /\p{L}/u.test(t.form));
    const words = toks.map((t) => t.form), vi = toks.indexOf(verb);
    // labels: index -> role for the candidates this clause can teach; a
    // candidate absent from labels teaches nothing. valency: true / false /
    // null (not determinable) per slot.
    let labels, val;
    if (teacher) {
      const tl = teacher(words, vi); if (!tl) continue;
      labels = tl.labels; val = tl.valency;
    } else {
      const e1 = toks.findIndex((t) => t.head === verb.id && t.deprel === "nsubj"), e2 = toks.findIndex((t) => t.head === verb.id && t.deprel === "obj");
      labels = new Map(); words.forEach((_, i) => labels.set(i, i === e1 ? "end1" : i === e2 ? "end2" : "other"));
      val = { end1: e1 >= 0 && isHead(words[e1]), end2: e2 >= 0 && isHead(words[e2]) };
    }
    const vk = lower(verb.form).slice(-verbEndingLen);
    if (!valency.has(vk)) valency.set(vk, { clauses: 0, withEnd1: 0, withEnd2: 0, knownEnd1: 0, knownEnd2: 0 });
    for (const v of [valency.get(vk), valencyAll]) {
      v.clauses += 1;
      if (val.end1 != null) { v.knownEnd1 = (v.knownEnd1 ?? 0) + 1; v.withEnd1 += val.end1; }
      if (val.end2 != null) { v.knownEnd2 = (v.knownEnd2 ?? 0) + 1; v.withEnd2 += val.end2; }
    }
    words.forEach((w, i) => {
      if (!isCandidate(words, i, vi, feats)) return;
      const role = labels.get(i); if (!role) return;
      roleTotals[role] += 1;
      for (const [cue, value] of cueValues(words, i, vi, feats)) bump(cue, value, role);
    });
  }
  return Object.freeze({ schema: "EORoleCues@1", feats, counts, roleTotals, valency, valencyAll, smoothing });
}

const isCandidate = (words, i, vi, feats) => i !== vi && !feats.excludeForms.has(lower(words[i])) && feats.isHead(words[i]);

// The cues of one candidate word, read from the SURFACE only (the model learned
// what each surface value means; at reading time nothing but surface exists).
function cueValues(words, index, verbIndex, feats) {
  const w = lower(words[index]), v = lower(words[verbIndex]);
  const nf = (k, word = w) => topOf(feats.nomFeat[k], `=${word}`, 1) ?? topOf(feats.nomFeat[k], word.slice(-feats.endingLen), feats.minVolume);
  const vf = (k) => topOf(feats.verbFeat[k], v.slice(-feats.verbEndingLen), feats.minVolume);
  // The PAIR, not a same/differ verdict I would have to impose: the treebank
  // learns what "plural noun, singular verb" means for each role. Collapsing to
  // same/differ was measured on dev to make gender agreement slightly harmful.
  const agree = (k) => `${nf(k) ?? "?"}|${vf(k) ?? "?"}`;
  const prev = index > 0 ? lower(words[index - 1]) : null;
  const governed = prev != null && feats.adpositions.has(prev);
  // An agreeing modifier right before the head marks its case a second time
  // ("специальное разрешение"): its ending is a cue of its own.
  const modifier = prev != null && !governed && !feats.excludeForms.has(prev) && !feats.isHead(prev) && index - 1 !== verbIndex ? prev.slice(-feats.endingLen) : "none";
  // A head straight after another head is usually its genitive attribute
  // ("министерство здравоохранения").
  const afterHead = prev != null && index - 1 !== verbIndex && feats.isHead(prev) && !feats.excludeForms.has(prev) ? "yes" : "no";
  return [
    ["word", w],
    ["ending", w.slice(-feats.endingLen)],
    ["order", index < verbIndex ? "before" : "after"],
    ["adjacent", Math.abs(index - verbIndex) === 1 ? "yes" : "no"],
    ["governed", governed ? "yes" : "no"],
    ["modifier", modifier],
    ["afterHead", afterHead],
    ["animacy", nf("Animacy") ?? "?"],
    ["number", agree("Number")],
    ["gender", agree("Gender")],
    ["person", agree("Person")],
  ];
}

export const CUE_CHANNELS = Object.freeze(["word", "ending", "order", "adjacent", "governed", "modifier", "afterHead", "animacy", "number", "gender", "person", "valency"]);

// log likelihood ratio of role r against "other" for one candidate:
// sum over channels of log P(value | r) / P(value | other), add-`smoothing`.
function logRatios(model, cues, use) {
  const p = (c, r) => (c[r] + model.smoothing) / (model.roleTotals[r] + 2 * model.smoothing);
  const out = { end1: 0, end2: 0 };
  for (const [cue, value] of cues) {
    if (!use.has(cue)) continue;
    const c = model.counts.get(`${cue}\u0001${value}`);
    // A value heard fewer than minVolume times says NOTHING — never a vote for
    // the rarer roles, which is what add-one smoothing makes of an unseen value.
    // The reader falls back on its other channels (a new word: its ending).
    if (!c || c.end1 + c.end2 + c.other < model.feats.minVolume) continue;
    for (const r of ["end1", "end2"]) out[r] += Math.log(p(c, r) / p(c, "other"));
  }
  return out;
}

// P(the clause has a first / second end | the verb's ending), backed off to
// the global rate when the ending was seen fewer than minVolume times.
function valencyOf(model, verbForm, use) {
  const g = model.valencyAll, k = model.smoothing, min = model.feats.minVolume;
  const v = use.has("valency") ? model.valency.get(lower(verbForm).slice(-model.feats.verbEndingLen)) : null;
  const rate = (slot) => { const known = `known${slot === "withEnd1" ? "End1" : "End2"}`; const src = v && v[known] >= min ? v : g; return { p: (src[slot] + k) / (src[known] + 2 * k), backedOff: src === g }; };
  const e1 = rate("withEnd1"), e2 = rate("withEnd2");
  return { end1: e1.p, end2: e2.p, backedOff: e1.backedOff || e2.backedOff };
}

const stripPunct = (w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");

/**
 * assignRoles(text, { model, classifyVerb, isHead, adpositions, excludeForms, margin, channels, verbHint })
 * -> { end1, label, end2, gap, margin, alternatives, cues }
 */
export function assignRoles(text, { model, classifyVerb, isHead, adpositions, excludeForms, margin, channels = CUE_CHANNELS, verbHint = null } = {}) {
  for (const [k, v] of Object.entries({ model, classifyVerb, isHead, adpositions, excludeForms, margin })) if (v == null) throw new TypeError(`assignRoles: '${k}' must be declared`);
  const use = new Set(channels);
  const words = String(text ?? "").split(/\s+/).map(stripPunct).filter(Boolean);
  let vi = -1;
  if (verbHint) vi = words.findIndex((w) => lower(w) === lower(verbHint));
  else {
    const vs = words.map((w, i) => (classifyVerb(w) ? i : -1)).filter((i) => i >= 0);
    if (vs.length > 1) return { end1: null, label: null, end2: null, gap: { reason: "ambiguous_verb", candidates: vs.map((i) => words[i]) } };
    vi = vs[0] ?? -1;
  }
  if (vi < 0) return { end1: null, label: null, end2: null, gap: { reason: "no_verb_found" } };
  const cands = [];
  const feats = { ...model.feats, isHead, adpositions, excludeForms };
  words.forEach((w, i) => {
    if (!isCandidate(words, i, vi, feats)) return;
    const cues = cueValues(words, i, vi, feats);
    cands.push({ word: w, index: i, cues, lr: logRatios(model, cues, use) });
  });
  const label = { word: words[vi] };
  if (!cands.length) return { end1: null, label, end2: null, gap: { reason: "no_candidate" } };
  // CLAUSE MODEL. Whether each slot is filled comes from the verb's valency;
  // WHICH candidate fills it, from its likelihood ratio, uniform over the
  // candidates a priori. Either slot may be empty (pro-drop; intransitive).
  const val = valencyOf(model, words[vi], use), n = cands.length;
  const L = Math.log;
  const options = [];
  for (const a of [null, ...cands]) for (const b of [null, ...cands]) {
    if (a && a === b) continue;
    let score = a ? L(val.end1) - L(n) + a.lr.end1 : L(1 - val.end1);
    score += b ? L(val.end2) - L(a ? Math.max(1, n - 1) : n) + b.lr.end2 : L(1 - val.end2);
    options.push({ e1: a, e2: b, score });
  }
  options.sort((x, y) => y.score - x.score);
  const best = options[0], second = options[1];
  const m = second ? best.score - second.score : Infinity;
  const show = (o) => o && { end1: o.e1?.word ?? null, end2: o.e2?.word ?? null, score: +o.score.toFixed(3) };
  if (m < margin) return { end1: null, label, end2: null, gap: { reason: "cues_undecided", best: show(best), runnerUp: show(second), margin: +m.toFixed(3) }, margin: m };
  return { end1: best.e1 ? { word: best.e1.word } : null, label, end2: best.e2 ? { word: best.e2.word } : null, gap: null, margin: m, valency: val, alternatives: [show(second)], cues: best.e1 ? Object.fromEntries(best.e1.cues) : null };
}
