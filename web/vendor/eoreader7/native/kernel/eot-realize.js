// Handle: Chomsky, reversed — a deep structure is universal; a language
// projects it back into speech. This is that projection, as a pure function,
// with no model anywhere in it.
//
// kernel/eot-realize.js — FROM THE MEANING LAYER BACK TO ENGLISH, WITHOUT A
// MODEL. The mirror of the round trip's forward leg (kernel/eot-rich.js).
//
// The EOT meaning layer holds content nodes, cube-addressed arcs, and
// absorbed function words as markers — deliberately NO word order and NO
// surface form. To write English from it, the LANGUAGE-SPECIFIC GRAMMAR does
// the projection, in three pure moves:
//
//   1. ORDER   linearize() (kernel/eot-rich.js, L3) places every syntactic
//              word from the measured parameters: which side of its head
//              each relation falls on, and how far.
//   2. FORM    each lemma is realized to a surface form by its word class
//              and features: the morphological half of the grammar. The
//              IRREGULAR tail is a measured table learned from held-apart
//              sentences; the regular tail is the inverse of the reader's
//              own stemsOf rules; the closed set of suppletive verbs
//              (be/have/do) has its own table.
//   3. WORDS   absorbed markers are re-realized as English function words.
//
// The result is English text — a projection, measured honestly, never a claim
// that the original is recoverable. Every function is pure; nothing here
// parses text and nothing calls a model.
import { annotationFromMeaning, linearize } from "./eot-rich.js";

/** Normalize a UD feature string to the sorted "Name=Value|..." the meaning
 *  layer's feats also serialize to, so learn and realize key identically. */
export function normFeats(feats) {
  if (!feats || feats === "_") return "";
  return feats.split("|").map((kv) => { const i = kv.indexOf("="); return i < 0 ? [kv, ""] : [kv.slice(0, i), kv.slice(i + 1)]; })
    .sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()) || a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`).join("|");
}

/** learnForms(sents) -> Map "upos|lemma|feats" -> surface form — the measured
 *  morphological half of the grammar: for each (class, lemma, feature set) the
 *  single most attested surface form in the material. */
export function learnForms(sents) {
  const count = new Map();
  for (const s of sents) {
    for (const t of s.tokens) {
      const rel = String(t.deprel).split(":")[0];
      if (rel === "punct") continue;
      const key = `${t.upos}|${t.lemma}|${normFeats(t.feats)}`;
      let e = count.get(key);
      if (!e) { e = new Map(); count.set(key, e); }
      e.set(t.form, (e.get(t.form) ?? 0) + 1);
    }
  }
  const forms = new Map();
  for (const [key, byForm] of count) {
    let best = null, bestN = 0;
    for (const [form, n] of byForm) if (n > bestN) { best = form; bestN = n; }
    if (best) forms.set(key, best);
  }
  return forms;
}

const endsY = (w) => /[^aeiou]y$/.test(w);
const sib = (w) => /(?:s|x|z|ch|sh)$/.test(w);

/** The regular English tail — the inverse of the reader's own stemsOf rules. */
export function regularForm(upos, lemma, feats) {
  const f = feats ?? "";
  switch (upos) {
    case "NOUN":
      if (f.includes("Number=Plur")) {
        if (sib(lemma)) return lemma + "es";
        if (endsY(lemma)) return lemma.slice(0, -1) + "ies";
        return lemma + "s";
      }
      return lemma;
    case "VERB":
      if (f.includes("VerbForm=Part")) {
        if (endsY(lemma)) return lemma.slice(0, -1) + "ied";
        return lemma.endsWith("e") ? lemma + "d" : lemma + "ed";
      }
      if (f.includes("VerbForm=Ger") || f.includes("VerbForm=Conv")) {
        if (lemma.endsWith("e") && !lemma.endsWith("ee")) return lemma.slice(0, -1) + "ing";
        return lemma + "ing";
      }
      if (f.includes("Tense=Past") && f.includes("VerbForm=Fin")) {
        if (endsY(lemma)) return lemma.slice(0, -1) + "ied";
        return lemma.endsWith("e") ? lemma + "d" : lemma + "ed";
      }
      if (f.includes("Person=3") && f.includes("Number=Sing") && /Tense=Pres|Tense=Prosp/.test(f)) {
        if (sib(lemma)) return lemma + "es";
        if (endsY(lemma)) return lemma.slice(0, -1) + "ies";
        return lemma + "s";
      }
      return lemma;
    case "ADJ":
      if (f.includes("Degree=Cmp")) return lemma.endsWith("e") ? lemma + "r" : lemma + "er";
      if (f.includes("Degree=Sup")) return lemma.endsWith("e") ? lemma + "st" : lemma + "est";
      return lemma;
    default:
      return lemma;
  }
}

const SUPPLE = {
  be: { "Number=Sing|Person=1|Tense=Pres": "am", "Number=Sing|Person=3|Tense=Pres": "is", "Number=Sing|Tense=Past": "was", "Tense=Pres": "are", "Tense=Past": "were", "VerbForm=Part": "been", "VerbForm=Ger": "being" },
  have: { "Number=Sing|Person=3|Tense=Pres": "has", "Tense=Past": "had", "VerbForm=Part": "had" },
  do: { "Number=Sing|Person=3|Tense=Pres": "does", "Tense=Past": "did", "VerbForm=Part": "done" },
};
function closedForm(lemma, feats) {
  const t = SUPPLE[lemma];
  if (!t) return null;
  const f = feats ?? "";
  for (const [needle, form] of Object.entries(t)) if (needle.split("|").every((kv) => f.includes(kv))) return form;
  return null;
}

/** Realize ONE row into its English surface token. */
export function realizeToken(row, forms) {
  const lemma = String(row.lemma ?? "");
  const feats = row.feats ?? "";
  const measured = forms ? forms.get(`${row.upos}|${lemma}|${feats}`) : undefined;
  if (measured !== undefined) return measured;
  if (row.upos === "AUX" || row.upos === "VERB") {
    const closed = closedForm(lemma.toLowerCase(), feats);
    if (closed !== null) return closed;
  }
  return regularForm(row.upos, lemma, feats);
}

const ATTACHED = new Set(["'s", "'", "s", "n't", "'d", "'ve", "'ll", "'re", "'m"]);

/** realizeRecord(record, { forms, params, punct }) -> string. */
export function realizeRecord(record, { forms = null, params = null, punct = true } = {}) {
  const rows = annotationFromMeaning(record);
  const order = params ? linearize(rows, params) : rows.map((r) => r.key);
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const tokens = [];
  for (const key of order) { const row = byKey.get(key); if (row) tokens.push(realizeToken(row, forms)); }
  let text = "";
  for (const w of tokens) {
    if (ATTACHED.has(w.toLowerCase())) { text = text.replace(/\s+$/, "") + w; continue; }
    if (text) text += " ";
    text += w;
  }
  text = text.trim();
  if (text) text = text[0].toUpperCase() + text.slice(1);
  let final = ".";
  if (punct && record?.surface?.text) { const m = /[.!?…]["')\]]*$/.exec(record.surface.text.trim()); if (m) final = m[0]; }
  return text ? text + final : "";
}
