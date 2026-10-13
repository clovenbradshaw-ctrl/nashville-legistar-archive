// fold-chat-answerturn.js — the WHOLE answer pipeline for a slot ask, as one injectable async function (docs/ANSWER-PIPELINE.md).
// No DOM, no globals, no clock reads, NO MODEL: the answer is read, reasoned over and realised mechanically. Everything that touches the
// outside world arrives in `deps` (so a test hands it stubs, and the chat hands it the real ones):
//
//   runAnswerTurn({ question, lang, passages, now, deps }) → Promise<AnswerTurn@1 | { handoff: { kind, why } }>
//     question  the person's words, exactly as said (never rewritten)
//     lang      'en' | { code, by } | undefined (then fold-chat-lang detectLang reads it; a language it cannot name has no grammar)
//     passages  [{ ref, title, url, host, lang, text }]  what the chat has already read
//     now       a Date | { year } | a year number — passed to the probes; with none, every date check is 'unmeasured'
//     deps      { fw, resolveTitles, fetchLead, searchPassages, signal }
//                 fw              Set of function words for `lang` (or a function lang → Set | null)        — fold-chat-snippets functionWordsOf
//                 resolveTitles   (candidates[]) → Promise<Map<string, {title,redirectedFrom,disambiguation} | null>>   — fold-chat-titles
//                 fetchLead       (query, { signal }) → Promise<{ title, extract, url } | null>             — the lead of the page the query names
//                 searchPassages  (frame, { signal }) → Promise<passages[]>   ONE widening read of the pages the names resolve to
//                 signal          AbortSignal; an aborted turn comes back partial with aborted:true and NO answer
//
// The stages (the user's words in brackets):
//   1 [parse the grammar of the ask]  askFrame. Not a slot ask, or a typed frame gap (no_grammar_for_language / frame_unread /
//                                      referents_unresolved)  →  { handoff }: the chat runs today's path UNCHANGED.
//   2 [parse the grammar of the passage] bind every sentence of every passage into rows. Only T1 rows witness anything.
//   3 [what fills the slot]           a T1 row whose filler is a NAME (the filler resolves by title; a filler that is no page is not a name).
//                                      None → ONE widening read (deps.searchPassages) recorded as an event; still none → gap `unwitnessed`
//                                      (or `unreached` when nothing at all could be read). The turn ends there: the model is barred.
//   4 [is it the CURRENT one]         a present-tense ask is not witnessed by a past-tense row → gap `no_present_holder`, that row closest.
//   5 [choose]                        by bearing: referents the sentence covers, predicate words it holds, whether the page's own title
//                                      agrees with the referents, then position. Never a score from a model.
//   6 [falsify]                       runFalsify. refuted → the next candidate is tried (at most DECLARED.maxCandidates); none left → gap
//                                      `refuted` with the refuting passage. contested → a contest, both rows kept. survived / unmeasured → answer.
//   7 [back to grammar]               realise: a clause made of the row's OWN words (never a paraphrase), else the row's sentence verbatim;
//                                      ALWAYS with the verbatim row and the source beside it.
//   8 [what the model is thinking]    traceOf over the turn's events (app-authored, first person, plain words).
//
// An answer whose checks could not be run ships as standing 'unmeasured' — the source states it, nothing was able to cross-check it, and
// the card says so. It is never called 'survived'. No case logic anywhere: entities are what a TITLE resolves to.

import { askFrame, GRAMMAR, tokensOf, stemOf, closedClassOf } from "./fold-chat-frame.js";
import { sentencesOf, bindSentence } from "./fold-chat-witness.js";
import { runFalsify, askTense, sameFiller } from "./fold-chat-falsify.js";
import { createTurnVoid, traceOf, noteFalsification } from "./fold-chat-void.js";
import { detectLang } from "./fold-chat-lang.js";

/** Declared, not measured (Constitution II.11). Giver: the ANSWERTURN integrator task of the answer-pipeline contract (2026-10-06). */
export const DECLARED = Object.freeze({
  giver: "the ANSWERTURN integrator task of the answer-pipeline contract (2026-10-06); declared, not measured",
  maxCandidates: 3,        // distinct fillers tried in turn when the best one is refuted (one network query each, so <= the probes' own limit of 3)
  verifySlots: Object.freeze(["person", "place", "thing"]),   // slots whose filler must be a NAME (a title); quantity and time fillers are not names
});

/** Plain words for the feed when the chat runs today's path instead. Declared by the integrator; English only. */
export const HANDOFF_WHY = Object.freeze({
  not_a_slot_ask: "This is not a question with one fact for an answer, so I'm handling it the usual way.",
  no_grammar_for_language: "I can't read the grammar of this language yet, so I'm handling it the usual way.",
  frame_unread: "I couldn't read this as one fact to look up, so I'm handling it the usual way.",
  referents_unresolved: "I couldn't match the names in the question to pages, so I'm handling it the usual way.",
  pipeline_error: "Something went wrong while I was reading sources, so I'm handling it the usual way.",
});

const asArr = (a) => (Array.isArray(a) ? a : []);
const isStr = (s) => typeof s === "string" && s.trim() !== "";
const q = (s) => `“${s}”`;
const hostOf = (url) => { try { return new URL(String(url)).hostname; } catch { return ""; } };
const aborted = (signal) => !!(signal && signal.aborted);

function langOf(lang, question) {
  if (isStr(lang)) return { code: lang, by: "given" };
  if (lang && typeof lang === "object" && isStr(lang.code)) return { code: lang.code, by: isStr(lang.by) ? lang.by : "given" };
  let d = null;
  try { d = detectLang(question); } catch { d = null; }
  return { code: d && d.confident && d.lang && d.lang !== "unknown" ? d.lang : null, by: "function words" };
}

// ── binding the passages ─────────────────────────────────────────────────────────────────────────────────────────
/** Bind every sentence of the passages. A sentence the frame cannot bind on its own words gets a second chance with the page's TITLE
 *  carrying the referent it leaves unsaid ("The current prime minister is Andy Burnham" on the page "Prime Minister of the United
 *  Kingdom") — such a row is marked via the returned `viaTitle` set, and its filler MUST then resolve by title to count. */
function bindPassages(passages, frame, { fw, code, from = 0 }) {
  const out = [], read = [], skipped = [];
  asArr(passages).forEach((p, i) => {
    if (!p || typeof p.text !== "string" || !p.text) return;
    if (isStr(p.lang) && code && p.lang !== code) { skipped.push(p); return; }       // another language's sentence is not read with this grammar
    const source = { ref: isStr(p.ref) ? p.ref : "S" + (from + i + 1), title: p.title || "", url: p.url || "", host: p.host || hostOf(p.url), lang: p.lang || code };
    read.push(source);
    sentencesOf(p.text).forEach((s, k) => {
      let row = bindSentence(s, frame, { fw, lang: code, source }), viaTitle = false;
      if (!row && isStr(p.title)) {
        const r2 = bindSentence(s, frame, { fw, lang: code, source, topic: p.title });
        if (r2 && r2.filler) { row = r2; viaTitle = true; }
      }
      if (row) out.push({ row, viaTitle, page: source, order: (from + i) * 10000 + k });
    });
  });
  return { entries: out, read, skipped };
}

/** One resolveTitles call over the fillers of person/place/thing rows: a filler that is no page is not a name, so it witnesses nothing
 *  (the row stays in the pool as a T1 row with no filler). A failed call leaves direct rows unverified — said so — and drops title-carried ones. */
async function verifyFillers(entries, frame, resolveTitles) {
  const need = DECLARED.verifySlots.includes(frame.slot);
  const withFiller = entries.filter((e) => e.row.tier === "T1" && e.row.filler && !e.checked);
  if (!need || !withFiller.length) { entries.forEach((e) => { e.checked = true; }); return { unverified: false }; }
  const texts = [...new Set(withFiller.map((e) => e.row.filler.text))];
  let table = null;
  try { table = typeof resolveTitles === "function" ? await resolveTitles(texts.slice()) : null; } catch { table = null; }
  const ok = table instanceof Map;
  for (const e of withFiller) {
    e.checked = true;
    const res = ok ? table.get(e.row.filler.text) : undefined;
    const named = ok ? !!(res && typeof res.title === "string" && res.title && !res.disambiguation) : !e.viaTitle;
    if (!named) e.row = { ...e.row, filler: null };
  }
  return { unverified: !ok };
}

// ── choosing ─────────────────────────────────────────────────────────────────────────────────────────────────────
function makeBearing(frame, code, fw) {
  const closed = closedClassOf(fw, code);
  const stems = (s) => tokensOf(s).map((t) => stemOf(t.fold, code));
  const refSeqs = frame.referents.map((r) => asArr(r.aliases).length ? r.aliases.map(stems) : [stems(r.surface), stems(r.title)]);
  const refContent = new Set(frame.referents.flatMap((r) => asArr(r.aliases).flatMap((a) => tokensOf(a).filter((t) => !closed(t.fold)).map((t) => stemOf(t.fold, code)))));
  const contains = (hay, seq) => { for (let i = 0; i + seq.length <= hay.length; i++) if (seq.every((s, k) => hay[i + k] === s)) return true; return false; };
  return (entry) => {
    const hay = stems(entry.row.sentence);
    const covered = refSeqs.filter((seqs) => seqs.some((s) => s.length && contains(hay, s))).length;
    const pred = frame.predicate.filter((p) => hay.includes(p.stem)).length;
    const titleAgree = stems(entry.page.title).some((s) => refContent.has(s)) ? 1 : 0;
    return [covered, pred, titleAgree, -entry.order];
  };
}
const byBearing = (a, b) => { for (let i = 0; i < 4; i++) if (a.b[i] !== b.b[i]) return b.b[i] - a.b[i]; return 0; };

// ── realising: a clause of the row's OWN words ───────────────────────────────────────────────────────────────────
const END_PUNCT = /[.!?。！？]["”’')\]]*$/u;
const finish = (clause, row) => {
  const c = clause.trim();
  if (!c) return row.sentence;
  const done = END_PUNCT.test(c) ? c : c + ".";
  const strip = (s) => s.replace(/[\s.!?。！？"”’')\]]+$/u, "");
  return strip(done) === strip(row.sentence) ? row.sentence : done;
};

/** First clause boundary (a comma, semicolon, colon, parenthesis, or one of the language's clause words) at or after `from`; -1 if none. */
function firstBoundary(text, from, G) {
  let at = -1;
  for (let i = Math.max(0, from); i < text.length; i++) if (",;:(（，；".includes(text[i])) { at = i; break; }
  for (const t of tokensOf(text)) if (t.start >= from && G.clauseWords.includes(t.fold) && (at < 0 || t.start < at)) { at = t.start; break; }
  return at;
}

/** The answer line. A copular slot: the sentence's own words from its start to the last matched word of the filler's clause
 *  ("Charles III is the king of the United Kingdom."). A quantity: the same, or — when a clause word sits between the subject and the
 *  number — subject + the closed-class words right before the number + the number + the matched noun after it ("Spiders have eight
 *  legs."). A time, or anything that cannot be built from the row's own words, is the row's sentence verbatim. */
export function realise(row, frame, { fw, lang }) {
  const G = GRAMMAR[lang];
  const f = row && row.filler;
  const text = row ? row.sentence : "";
  if (!G || !f || !Array.isArray(f.span) || text.slice(f.span[0], f.span[1]) !== f.text) return text;
  const spans = asArr(row.emphasis).filter((s) => Array.isArray(s) && s[1] > s[0] && s[1] <= text.length);
  const [fa, fb] = f.span;
  if (frame.slot === "person" || frame.slot === "place" || frame.slot === "thing") {
    if (fa > 0 && firstBoundary(text, 0, G) >= 0 && firstBoundary(text, 0, G) < fa) return text;       // the subject itself is cut by a boundary
    const be = firstBoundary(text, fb, G), clauseEnd = be < 0 ? text.length : be;
    let end = fb;
    for (const [a, b] of spans) if (a < clauseEnd && b <= clauseEnd) end = Math.max(end, b);
    return finish(text.slice(0, end), row);
  }
  if (frame.slot === "quantity") {
    const be = firstBoundary(text, 0, G);
    if (be < 0 || be >= fb) {                                   // no boundary before the number: the clause as written
      const ce = firstBoundary(text, fb, G), clauseEnd = ce < 0 ? text.length : ce;
      let end = fb;
      for (const [a, b] of spans) if (a < clauseEnd && b <= clauseEnd) end = Math.max(end, b);
      return finish(text.slice(0, end), row);
    }
    const closed = closedClassOf(fw, lang);
    const toks = tokensOf(text);
    const gapless = (a, b) => /^\s+$/.test(text.slice(a.end, b.start));
    const fi = toks.findIndex((t) => t.start >= fa);
    if (fi <= 0) return text;
    let s = fi;
    while (s - 1 >= 0 && gapless(toks[s - 1], toks[s]) && closed(toks[s - 1].fold)) s--;
    while (s < fi && G.clauseWords.includes(toks[s].fold)) s++;      // "that have eight legs" → "have eight legs"
    if (s >= fi) return text;
    const verbStart = toks[s].start;
    const subject = spans.find(([a, b]) => b <= verbStart && !(a >= fa && b <= fb));
    if (!subject) return text;
    let line = `${text.slice(subject[0], subject[1])} ${text.slice(verbStart, fb)}`;
    const tail = spans.find(([a]) => a >= fb && /^\s+$/.test(text.slice(fb, a)));
    if (tail) line += ` ${text.slice(tail[0], tail[1])}`;
    return finish(line, row);
  }
  return text;
}

// ── the turn ─────────────────────────────────────────────────────────────────────────────────────────────────────
const uniq = (xs) => [...new Set(xs.filter(isStr))];

function refuterRow(refuter, frame, code, n) {
  const p = refuter.passage || {};
  const source = { ref: "S" + n, title: p.title || "", url: p.url || "", host: hostOf(p.url), lang: code };
  return { tier: "T2", sentence: p.text, source, span: [0, String(p.text || "").length], polarity: "+", tense: "unknown", filler: null, emphasis: [] };
}

export async function runAnswerTurn({ question, lang, passages = [], now, deps = {} } = {}) {
  try {
    return await run({ question, lang, passages, now, deps: deps || {} });
  } catch (e) {
    return { handoff: { kind: "pipeline_error", why: HANDOFF_WHY.pipeline_error, error: String((e && e.message) || e) } };
  }
}

async function run({ question, lang, passages, now, deps }) {
  const said = String(question ?? "");
  const L = langOf(lang, said);
  const code = L.code;
  const signal = deps.signal;
  const fw = typeof deps.fw === "function" ? deps.fw(code) : deps.fw;

  const bare = (extra = {}) => ({ schema: "AnswerTurn@1", said, searched: [], lang: { code, by: L.by }, void: null, answer: null, contest: [], gap: null, trace: [], sources: [], ...extra });
  if (aborted(signal)) return bare({ aborted: true });

  // 1 ── the grammar of the ask
  const frame = await askFrame(said, { fw, lang: code, resolveTitles: deps.resolveTitles });
  if (aborted(signal)) return bare({ aborted: true });
  if (!frame.ok) {
    const kind = frame.gap && frame.gap.kind ? frame.gap.kind : "not_a_slot_ask";
    return { handoff: { kind, why: HANDOFF_WHY[kind] || HANDOFF_WHY.frame_unread } };
  }

  const tv = createTurnVoid(frame);
  const bearing = makeBearing(frame, code, fw);
  const searched = [];
  const sourcesSeen = [];
  const addSources = (list) => { for (const s of list) if (!sourcesSeen.some((x) => x.url === s.url && x.title === s.title && x.ref === s.ref)) sourcesSeen.push(s); };
  for (const p of asArr(passages)) if (p && isStr(p.query)) searched.push(p.query);

  const finishTurn = (parts) => {
    const trace = traceOf(tv);
    const tree = tv.close();
    return { ...bare({ slot: frame.slot, searched: uniq(searched), void: tree, trace, sources: sourcesSeen.slice() }), ...parts };
  };
  const partial = () => finishTurn({ aborted: true });

  // 2 ── bind
  const first = bindPassages(passages, frame, { fw, code });
  addSources(first.read);
  let entries = first.entries;
  let unverifiedNames = (await verifyFillers(entries, frame, deps.resolveTitles)).unverified;
  if (aborted(signal)) return partial();

  const witnesses = () => entries.filter((e) => e.row.tier === "T1" && e.row.filler && e.row.polarity === "+");

  // 3 ── something must fill the slot; one wider read before giving up
  if (!witnesses().length && typeof deps.searchPassages === "function") {
    const asked = frame.referents.map((r) => r.title || r.surface);
    let more = [], reason = null;
    try { more = asArr(await deps.searchPassages(frame, { signal })); } catch (e) { more = []; reason = e && e.name === "AbortError" ? "the search was stopped" : "the read failed"; }
    if (aborted(signal)) return partial();
    const have = new Set(entries.map((e) => e.page.url + "\u0000" + e.page.title));
    const fresh = more.filter((p) => p && typeof p.text === "string" && !have.has((p.url || "") + "\u0000" + (p.title || "")) && !asArr(passages).some((x) => x && x.url && x.url === p.url));
    const next = bindPassages(fresh, frame, { fw, code, from: asArr(passages).length });
    addSources(next.read);
    entries = entries.concat(next.entries);
    for (const p of fresh) if (isStr(p.query)) searched.push(p.query);
    tv.note("widen", { asked, read: next.read.map((s) => ({ title: s.title, host: s.host, url: s.url })), ...(reason ? { reason } : {}) });
    unverifiedNames = (await verifyFillers(entries, frame, deps.resolveTitles)).unverified || unverifiedNames;
    if (aborted(signal)) return partial();
  }

  const readTitles = sourcesSeen.map((s) => s.title || s.host || s.url).filter(isStr);
  const scored = entries.map((e) => ({ ...e, b: bearing(e) })).sort(byBearing);
  const closestOf = (list) => (list.length ? list[0].row : null);

  // 4 ── the CURRENT-ness rule
  const cands = scored.filter((e) => e.row.tier === "T1" && e.row.filler && e.row.polarity === "+");
  const present = askTense(frame, {}) === "present";
  const usable = present ? cands.filter((e) => e.row.tense !== "past") : cands;
  if (!usable.length && cands.length && present) {
    const row = cands[0].row;
    tv.note("past-only", { row });
    return finishTurn({ gap: { kind: "no_present_holder", closest: row, tried: readTitles, closeBy: [] } });
  }
  if (!usable.length) {
    const closest = closestOf(scored.filter((e) => e.row.tier === "T1")) || closestOf(scored);
    if (!sourcesSeen.length) {
      tv.note("no-witness", { kind: "unreached", tried: [], reason: "no source could be read" });
      return finishTurn({ gap: { kind: "unreached", tried: [], closeBy: [] } });
    }
    tv.note("no-witness", { kind: "unwitnessed", tried: readTitles, ...(closest ? { closest } : {}) });
    return finishTurn({ gap: { kind: "unwitnessed", ...(closest ? { closest } : {}), tried: readTitles, closeBy: [] } });
  }

  // 5 ── choose: distinct fillers in order of their best row's bearing
  const groups = [];
  for (const e of usable) {
    const g = groups.find((x) => sameFiller(x.name, e.row.filler.text));
    if (g) g.entries.push(e); else groups.push({ name: e.row.filler.text, entries: [e] });
  }

  // 6 ── falsify: the best candidate first. A refuted one is set aside (its rows leave the pool: a dead holder is not a rival) and the
  //      next is tried. A candidate CONTESTED by another candidate's row is not left at that: the rival is itself put to the search that
  //      names it, and if it falls, the first is judged again without it (a stale page's "Elizabeth II is the monarch" must not turn
  //      "Charles III is the king" into a contest). One lookup per name, never repeated; at most DECLARED.maxCandidates names in all.
  const poolAll = entries.map((e) => e.row);
  const memo = new Map();
  const fetchLead = typeof deps.fetchLead === "function"
    ? (query, o) => { if (!memo.has(query)) memo.set(query, (async () => deps.fetchLead(query, o))()); return memo.get(query); }
    : null;
  const refutedRows = [], evaluated = [];
  let firstRefuted = null, budget = DECLARED.maxCandidates;
  const evaluate = async (g) => {
    const cand = g.entries[0].row;
    tv.note("candidate", { row: cand });
    const pool = poolAll.filter((r) => !refutedRows.includes(r));
    const run = await runFalsify({ candidate: { filler: cand.filler, row: cand }, frame, rows: pool, now, fetchLead, signal });
    for (const qy of run.queries) searched.push(qy);
    noteFalsification(tv, run, cand.filler.text);
    const outcome = { run, cand, group: g };
    if (run.standing === "refuted") { for (const e of g.entries) refutedRows.push(e.row); firstRefuted = firstRefuted || outcome; }
    return outcome;
  };
  let outcome = null;
  for (const g of groups) {
    if (budget <= 0 || evaluated.includes(g)) continue;
    budget--; evaluated.push(g);
    outcome = await evaluate(g);
    if (aborted(signal)) return partial();
    if (outcome.run.standing === "refuted") continue;
    if (outcome.run.standing === "contested") {
      const rivals = groups.filter((x) => x !== g && !evaluated.includes(x) && x.entries.some((e) => outcome.run.contest.includes(e.row)));
      let fell = false;
      for (const r of rivals) {
        if (budget <= 0) break;
        budget--; evaluated.push(r);
        const rv = await evaluate(r);
        if (aborted(signal)) return partial();
        if (rv.run.standing === "refuted") fell = true;
      }
      if (fell) { outcome = await evaluate(g); if (aborted(signal)) return partial(); }
    }
    break;
  }
  const { run, cand } = outcome;

  if (run.standing === "refuted") {
    const f = firstRefuted;
    const refuter = f.run.refuters[0];
    const closest = refuterRow(refuter, frame, code, sourcesSeen.length + 1);
    addSources([closest.source]);
    return finishTurn({ gap: { kind: "refuted", closest, claim: f.cand, refuters: f.run.refuters, tried: f.run.queries.map(q), closeBy: [] } });
  }
  if (run.standing === "contested") {
    const rows = run.contest.length >= 2 ? run.contest : [cand];
    if (rows.length >= 2) return finishTurn({ contest: rows });
    return finishTurn({ gap: { kind: "unwitnessed", closest: cand, tried: readTitles, closeBy: [] } });
  }

  // 7 ── survived or unmeasured: realise the answer from the row's own words
  const unmeasured = run.unmeasured.slice();
  if (unverifiedNames) unmeasured.push(`whether ${q(cand.filler.text)} names a page: I could not ask the title service`);
  const answer = {
    text: realise(cand, frame, { fw, lang: code }), filler: cand.filler, row: cand,
    standing: run.standing, survived: run.survived.slice(), unmeasured, by: "mechanical",
  };
  return finishTurn({ answer });
}
