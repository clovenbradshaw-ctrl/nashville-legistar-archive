// fold-chat-falsify.js — the search that tries to REFUTE a candidate answer before it ships (docs/ANSWER-PIPELINE.md, "Probes").
// Pure: no DOM, no clock reads, no model. The one network step is INJECTED as fetchLead(query) -> { title, extract, url } | null.
//
// A claim "stands" only as "survived these named attempts to refute it". Every attempt is a probe; every probe ends in exactly one of
//   none        — it looked and found nothing against the claim (the plain-words line goes in `survived`)
//   found       — it found a passage against the claim (kept in `refuters`, never silently dropped)
//   unmeasured  — it could not be run or could not be read (said so in `unmeasured`; NEVER counted as survived — Constitution II.10)
// standing: 'refuted'   a death date at or before now against a CURRENT-holder claim (hard);
//           'contested' another holder / a negation / a later-dated holder — BOTH rows kept in `contest`, never a silent pick;
//           'survived'  >=1 probe measured and none found anything (the ones that could not be run are listed in `unmeasured`);
//           'unmeasured' no probe could be run at all.
//
// No case logic anywhere: names are compared after Unicode normalisation; dates are read by SHAPE (4-digit years joined by a dash).
// Word lists below are DECLARED, per language, each with its giver; a language without an entry yields 'unmeasured', never an English guess.

/** Declared constants. Giver: the BUILD-2 task of the answer-pipeline contract (2026-10-05); declared, not measured. */
export const DECLARED = Object.freeze({
  maxQueries: 3,          // contract: "at most 3 network queries per turn"
  parentheticalWithin: 300, // the life-dates parenthesis must open within the first 300 characters of the lead (declared)
  passageMax: 400,        // the refuting passage is cut (verbatim, from the start of the lead) at 400 characters
});

/** The word that joins two years in a range, per language ("1926 to 2022"). The DASH forms need no word and work in every language.
 *  Giver: declared by BUILD-2 2026-10-05 from the common range word of each language; not measured against a corpus. */
export const TO_WORDS = Object.freeze({
  en: ["to"], de: ["bis"], fr: ["à", "au"], es: ["a"], it: ["a"], pt: ["a"], nl: ["tot"],
});

/** The word that marks a lone year as a BIRTH year ("(born 1948)"), per language. A lone year without one of these is unreadable.
 *  Giver: declared by BUILD-2 2026-10-05 from the usual wording of an encyclopedia lead; not measured. */
export const BIRTH_WORDS = Object.freeze({
  en: ["born", "b"], fr: ["né", "née"], de: ["geboren", "geb"], es: ["nacido", "nacida"], it: ["nato", "nata"], pt: ["nascido", "nascida"], nl: ["geboren", "geb"],
});

/** The copulas that make an ask PRESENT or PAST ("who is …" / "who was …"), per language: the only tense reading this module does.
 *  Giver: declared by BUILD-2 2026-10-05; the khora function-word prior carries no tense class. A language absent here -> tense 'unknown'. */
export const ASK_TENSE_WORDS = Object.freeze({
  en: { present: ["is", "are", "am", "who's", "what's", "where's"], past: ["was", "were", "did", "had"] },
});

/** Plain-words lines for what was checked, keyed by the thing looked for. English only; a later change can translate this table. */
export const SAY = Object.freeze({
  scopeOther: (n) => `the other ${n} source${n === 1 ? "" : "s"}`,
  scopePage: "the rest of that page",
  noRival: (scope) => `no other holder found in ${scope}`,
  noNegation: (scope) => `no source says otherwise in ${scope}`,
  noLater: (scope) => `nothing dated later found in ${scope}`,
  living: (name, birth) => `${name}'s page gives ${birth} and no death date`,
  livingSummary: (birth) => `it gives ${birth} and no death date`,
  died: (name, year) => `${name}'s page says ${name} died in ${year}, so ${name} can't be the current holder.`,
  rivalWhy: (title, name) => `${title ? title : "Another source"} names ${name} instead.`,
  negationWhy: (title) => `${title ? title : "A source"} says it is not so.`,
  laterWhy: (title, name, year, since) => `${title ? title : "A source"} names ${name}, dated ${year}, later than ${since}.`,
  cantRead: (name) => `I could not read a page for “${name}”`,
  wrongPage: (name) => `the page I found was not clearly about “${name}”`,
  noDates: "the opening of that page gives no dates I can read",
  noNow: "I had no date for today to compare with",
  noOther: "there was no other source to compare it with",
  noOwnDate: "the claim's own sentence carries no date to compare",
  budget: "that was more than the turn's limit of searches",
  cancelled: "the search was stopped",
  noLookup: "I had no way to look it up",
  askTenseUnknown: "I could not tell whether the question is about now",
});

const norm = (s) => String(s ?? "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const toks = (s) => norm(s).match(/[\p{L}\p{N}]+/gu) || [];
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Two filler strings name the same holder when one is a contiguous run of the other's tokens ("Charles III" / "King Charles III"). */
export function sameFiller(a, b) {
  const x = toks(a), y = toks(b);
  if (!x.length || !y.length) return false;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  for (let i = 0; i + s.length <= l.length; i++) { let ok = true; for (let j = 0; j < s.length; j++) if (l[i + j] !== s[j]) { ok = false; break; } if (ok) return true; }
  return false;
}

const nowYearOf = (now) => {
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (now && typeof now === "object") {
    if (typeof now.year === "number") return now.year;
    if (typeof now.getUTCFullYear === "function") return now.getUTCFullYear();
  }
  if (typeof now === "string" && /^\d{4}/.test(now)) return +now.slice(0, 4);
  return null;
};

const sourceKey = (r) => { const s = (r && r.source) || {}; return s.url || s.ref || s.title || ""; };
const sameRow = (a, b) => a === b || (!!a && !!b && a.sentence === b.sentence && sourceKey(a) === sourceKey(b));
const fillerText = (f) => (typeof f === "string" ? f : f && typeof f.text === "string" ? f.text : "");

function candOf(candidate) {
  const row = candidate && (candidate.row || (candidate.sentence ? candidate : null)) || null;
  const text = fillerText(candidate && candidate.filler) || fillerText(row && row.filler);
  return { row, name: text.trim() };
}

/** 'present' | 'past' | 'unknown' for the ASK. frame.tense (if the frame carries one) or opts.current wins; else the declared copulas. */
export function askTense(frame, opts = {}) {
  if (typeof opts.current === "boolean") return opts.current ? "present" : "past";
  if (frame && (frame.tense === "present" || frame.tense === "past")) return frame.tense;
  const t = frame && ASK_TENSE_WORDS[frame.lang];
  if (!t) return "unknown";
  const words = String(frame.said || "").normalize("NFC").toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) || [];
  const w = words.map((x) => x.replace(/’/g, "'"));
  if (w.some((x) => t.past.includes(x))) return "past";
  if (w.some((x) => t.present.includes(x))) return "present";
  return "unknown";
}

/** The probes for a candidate. candidate = { filler: {text,…} | string, row?: Row } (a Row alone is also accepted).
 *  opts = { now, rows, current? }. Network probes carry query = the filler's name (the C9 falsifier); local ones carry query: null. */
export function probesFor(candidate, frame, opts = {}) {
  const { row, name } = candOf(candidate);
  if (!name) return [];
  const tense = askTense(frame, opts);
  const lang = (frame && frame.lang) || null;
  const probes = [];
  if (frame && frame.slot === "person" && tense !== "past") {
    const p = { id: "life-dates", kind: "life-dates", network: true, lang, why: "a person who died cannot be the CURRENT holder", query: name, expects: `a page for ${name} with no death date` };
    if (tense === "unknown" && !ASK_TENSE_WORDS[lang]) p.unmeasured = SAY.askTenseUnknown;
    // tense unknown in a language that HAS a table: the ask names no 'is'/'was', so a death says nothing -> no probe
    if (tense === "present" || p.unmeasured) probes.push(p);
  }
  const cur = tense === "present";
  probes.push({ id: "rival-holder", kind: "rival-holder", network: false, lang, current: cur, why: "another source may name a different holder", query: null, expects: "no other filler for the same slot" });
  probes.push({ id: "negation", kind: "negation", network: false, lang, current: cur, why: "a source may say it is not so", query: null, expects: "no sentence that negates the claim" });
  probes.push({ id: "later-date", kind: "later-date", network: false, lang, current: cur, why: "a source dated later may name a newer holder", query: null, expects: "no later-dated row with a different filler" });
  return probes;
}

// ── reading a lead by SHAPE ──────────────────────────────────────────────────────────────────────────────────────
/** The first balanced parenthesis opening within `within` characters: { inner, start, end } | null. */
export function firstParenthetical(text, within = DECLARED.parentheticalWithin) {
  const s = String(text ?? "");
  const open = new Set(["(", "（"]), close = new Set([")", "）"]);
  let start = -1, depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (open.has(c)) { if (depth === 0) { if (i > within) return null; start = i; } depth++; }
    else if (close.has(c) && depth > 0) { depth--; if (depth === 0) return { inner: s.slice(start + 1, i), start, end: i + 1 }; }
  }
  return null;
}

const DASH_AT_START = /^\s*[‐-―−-]/u;
const DASH_SPACED = /\s[‐-―−-]\s/u;
const wordRe = (list) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${list.map(esc).join("|")})(?![\\p{L}\\p{N}])`, "iu");

/** Read the inside of a lead's first parenthesis. -> { kind: 'range', birth, death } | { kind: 'open', birth } | { kind: 'born', birth } | { kind: 'none' } | { kind: 'unreadable', why } */
export function parseLifespan(inner, lang) {
  const s = String(inner ?? "");
  const ys = [...s.matchAll(/(?<![\p{N}])(\d{4})(?![\p{N}])/gu)].map((m) => ({ y: +m[1], a: m.index, b: m.index + 4 }));
  if (!ys.length) return { kind: "none" };
  const isRange = (between) => DASH_AT_START.test(between) || DASH_SPACED.test(between) || (TO_WORDS[lang] ? wordRe(TO_WORDS[lang]).test(between) : false);
  if (ys.length === 1) {
    const after = s.slice(ys[0].b);
    if (DASH_AT_START.test(after)) {
      const rest = after.replace(/^\s*[‐-―−-]/u, "");
      return /\d/.test(rest) ? { kind: "unreadable", why: "a second number after the dash that is not a year" } : { kind: "open", birth: ys[0].y };
    }
    if (BIRTH_WORDS[lang] && wordRe(BIRTH_WORDS[lang]).test(s.slice(0, ys[0].a))) return { kind: "born", birth: ys[0].y };
    return { kind: "unreadable", why: "a lone year without a word for birth" };
  }
  const between = s.slice(ys[0].b, ys[1].a);
  if (isRange(between)) return { kind: "range", birth: ys[0].y, death: ys[1].y };
  return { kind: "unreadable", why: "two years that are not joined as a range" };
}

const headTokens = (lead) => toks(String(lead.extract || "").slice(0, 200));
/** A lead is about the filler when its title's tokens are all in the filler (so "Charles III of Spain" is NOT the page for "Charles III"),
 *  or — with no title — when the filler's tokens are all in the lead's opening. */
function leadIsAbout(name, lead) {
  const f = toks(name);
  if (!f.length) return false;
  const t = toks(lead.title);
  if (t.length) return t.every((x) => f.includes(x));
  const h = new Set(headTokens(lead));
  return f.every((x) => h.has(x));
}

function lifeCheck(probe, name, r, nowYear) {
  const un = (reason) => ({ probe, outcome: "unmeasured", reason, text: null });
  if (probe.unmeasured) return un(probe.unmeasured);
  if (r.status === "unmeasured") return un(r.reason || SAY.cantRead(name));
  const lead = r.lead;
  if (r.error || !lead || typeof lead.extract !== "string" || !lead.extract) return un(r.reason || SAY.cantRead(name));
  if (!leadIsAbout(name, lead)) return un(SAY.wrongPage(name));
  if (nowYear == null) return un(SAY.noNow);
  const par = firstParenthetical(lead.extract);
  if (!par) return un(SAY.noDates);
  const life = parseLifespan(par.inner, probe.lang);
  const leadInfo = { title: lead.title || null, url: lead.url || null };
  if (life.kind === "none" || life.kind === "unreadable") return { ...un(SAY.noDates), lead: leadInfo };
  if (life.kind === "range") {
    if (life.death < life.birth || life.death > nowYear) return { ...un(SAY.noDates), lead: leadInfo };
    const sentenceEnd = lead.extract.slice(par.end).search(/[.!?。！？]["”')\]]*(?:\s|$)/u);
    const cut = sentenceEnd >= 0 ? par.end + sentenceEnd + 1 : lead.extract.length;
    const text = lead.extract.slice(0, Math.min(cut, DECLARED.passageMax));
    const why = SAY.died(name, life.death);
    return { probe, outcome: "found", lead: leadInfo, deathYear: life.death, found: `a death in ${life.death}`, why, text: null,
      refuters: [{ probe, passage: { text, url: lead.url || null, title: lead.title || null }, why }] };
  }
  if (life.birth > nowYear) return { ...un(SAY.noDates), lead: leadInfo };
  return { probe, outcome: "none", lead: leadInfo, birthYear: life.birth, text: SAY.living(name, life.birth), summary: SAY.livingSummary(life.birth) };
}

const yearOfRow = (row, nowYear) => {
  const d = row && row.date;
  if (typeof d === "number") return d;
  if (d && typeof d.year === "number") return d.year;
  if (typeof d === "string" && /^\d{4}/.test(d)) return +d.slice(0, 4);
  const ys = [...String((row && row.sentence) || "").matchAll(/(?<![\p{N}])(\d{4})(?![\p{N}])/gu)].map((m) => +m[1]).filter((y) => nowYear == null || y <= nowYear);
  return ys.length ? Math.max(...ys) : null;
};

const passageOf = (row) => ({ text: row.sentence, url: (row.source && row.source.url) || null, title: (row.source && row.source.title) || null });

function localCheck(probe, c, pool, nowYear) {
  const un = (reason) => ({ probe, outcome: "unmeasured", reason, text: null });
  const others = (Array.isArray(pool) ? pool : []).filter((r) => r && typeof r.sentence === "string" && !sameRow(r, c.row));
  if (!others.length) return un(SAY.noOther);
  const mine = sourceKey(c.row);
  const nSources = new Set(others.map(sourceKey).filter((k) => k && k !== mine)).size;
  const scope = nSources > 0 ? SAY.scopeOther(nSources) : SAY.scopePage;
  const witnessing = others.filter((r) => r.tier !== "T2");
  const rivals = witnessing.filter((r) => r.polarity !== "-" && fillerText(r.filler) && !sameFiller(fillerText(r.filler), c.name)
    && (!probe.current || r.tense === "present" || r.tense === "unknown" || r.tense == null));
  if (probe.kind === "rival-holder") {
    if (!rivals.length) return { probe, outcome: "none", scope, text: SAY.noRival(scope) };
    return { probe, outcome: "found", scope, found: "another holder", rows: rivals,
      refuters: rivals.map((r) => ({ probe, passage: passageOf(r), why: SAY.rivalWhy(r.source && r.source.title, fillerText(r.filler)), row: r })) };
  }
  if (probe.kind === "negation") {
    // a negation only contradicts a claim of the SAME tense: "France has had no king since 1848" does not refute "Louis XVI was the last king"
    const known = (t) => t === "present" || t === "past" || t === "future";
    const sameTime = (r) => !(c.row && known(c.row.tense) && known(r.tense) && c.row.tense !== r.tense);
    const negs = witnessing.filter((r) => r.polarity === "-" && sameTime(r) && (!fillerText(r.filler) || sameFiller(fillerText(r.filler), c.name)));
    if (!negs.length) return { probe, outcome: "none", scope, text: SAY.noNegation(scope) };
    return { probe, outcome: "found", scope, found: "a source saying otherwise", rows: negs,
      refuters: negs.map((r) => ({ probe, passage: passageOf(r), why: SAY.negationWhy(r.source && r.source.title), row: r })) };
  }
  if (probe.kind === "later-date") {
    if (!rivals.length) return { probe, outcome: "none", scope, text: SAY.noLater(scope) };
    const mineYear = yearOfRow(c.row, nowYear);
    if (mineYear == null) return un(SAY.noOwnDate);
    const later = rivals.filter((r) => { const y = yearOfRow(r, nowYear); return y != null && y > mineYear; });
    if (!later.length) return { probe, outcome: "none", scope, text: SAY.noLater(scope) };
    return { probe, outcome: "found", scope, found: "a later holder", rows: later,
      refuters: later.map((r) => ({ probe, passage: passageOf(r), why: SAY.laterWhy(r.source && r.source.title, fillerText(r.filler), yearOfRow(r, nowYear), mineYear), row: r })) };
  }
  return un("this kind of check is not known");
}

/** Interpret what the probes saw. results: [{ probe, lead? | pool? | status?: 'unmeasured', reason?, error? }] (as runFalsify gathers them).
 *  -> { standing, survived: string[], unmeasured: string[], refuters, contest: Row[], checks } */
export function judge(candidate, results, { now } = {}) {
  const c = candOf(candidate);
  const nowYear = nowYearOf(now);
  const checks = [];
  for (const r of Array.isArray(results) ? results : []) {
    if (!r || !r.probe) continue;
    if (r.probe.kind === "life-dates") checks.push(lifeCheck(r.probe, c.name, r, nowYear));
    else if (r.status === "unmeasured") checks.push({ probe: r.probe, outcome: "unmeasured", reason: r.reason || SAY.noOther, text: null });
    else checks.push(localCheck(r.probe, c, r.pool, nowYear));
  }
  const refuters = checks.flatMap((k) => k.refuters || []);
  const survived = checks.filter((k) => k.outcome === "none").map((k) => k.text);
  const unmeasured = checks.filter((k) => k.outcome === "unmeasured").map((k) => `${checkName(k.probe, c.name)}: ${k.reason}`);
  const hard = refuters.some((x) => x.probe.kind === "life-dates");
  const contestRows = [];
  if (!hard && refuters.length && c.row) contestRows.push(c.row);
  for (const x of refuters) if (x.row && !contestRows.some((y) => sameRow(y, x.row))) contestRows.push(x.row);
  const standing = hard ? "refuted" : refuters.length ? "contested" : survived.length ? "survived" : "unmeasured";
  return { standing, survived, unmeasured, refuters, contest: standing === "contested" ? contestRows : [], checks };
}

const CHECK_NAMES = Object.freeze({
  "life-dates": (name) => `whether ${name} is still living`,
  "rival-holder": () => "whether another source names a different holder",
  negation: () => "whether a source says it is not so",
  "later-date": () => "whether a later-dated source names a newer holder",
});
export const checkName = (probe, name) => (CHECK_NAMES[probe.kind] || (() => probe.kind))(name);

function raceAbort(promise, signal) {
  if (!signal) return promise;
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    if (signal.aborted) return onAbort();
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then((v) => { signal.removeEventListener("abort", onAbort); resolve(v); }, (e) => { signal.removeEventListener("abort", onAbort); reject(e); });
  });
}

/** Run the probes: at most DECLARED.maxQueries network queries, every one aborted by `signal`; the local probes read `rows`.
 *  -> judge(...) plus { probes, queries, results }. A failed or stopped lookup is 'unmeasured', never 'survived'. */
export async function runFalsify({ candidate, frame, rows, now, fetchLead, signal, current } = {}) {
  const probes = probesFor(candidate, frame, { now, rows, current });
  const queries = [];
  const settled = await Promise.all(probes.map(async (probe) => {
    if (!probe.network) return { probe, pool: rows };
    if (probe.unmeasured) return { probe, status: "unmeasured", reason: probe.unmeasured };
    if (queries.length >= DECLARED.maxQueries) return { probe, status: "unmeasured", reason: SAY.budget };
    if (signal && signal.aborted) return { probe, status: "unmeasured", reason: SAY.cancelled };
    if (typeof fetchLead !== "function") return { probe, status: "unmeasured", reason: SAY.noLookup };
    queries.push(probe.query);
    try {
      const lead = await raceAbort((async () => fetchLead(probe.query, { signal }))(), signal);
      return { probe, lead: lead || null };
    } catch (e) {
      return { probe, status: "unmeasured", error: true, reason: e && e.name === "AbortError" ? SAY.cancelled : SAY.cantRead(probe.query) };
    }
  }));
  return { ...judge(candidate, settled, { now }), probes, queries, results: settled };
}
