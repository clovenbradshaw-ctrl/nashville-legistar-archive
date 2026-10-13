// fold-chat-falsify-answer.js — try to break each claim of an answer against EVERYTHING the turn read, source by source.
//
// One claim = one sentence of the answer. For every independent source (a domain; two domains carrying the same
// syndicated sentence are one chain, after al-Bukhari: a shared chain is one witness) the best sentence it holds is
// found and asked three things:
//   STATES       it says the claim: a run of 4+ shared words, or most of the claim's content words — AND every figure
//                the claim states appears in that sentence, AND every name in its neighbourhood, AND the same polarity.
//   CONTRADICTS  it is about the same thing (shares 40%+ of the claim's content words) but flips the polarity, or gives
//                a different figure in the same unit where the claim's figure is absent.
//   SILENT       neither.
// Then the attack that makes a "states" worth something — the SWAP: replace the claim's figure (or name) with a
// competitor the same source offers and ask again. If the swapped, false claim is "stated" just as well, the
// evidence does not discriminate and the support is weak however long the match.
//
// verdict per claim: contested (any source contradicts) · corroborated (2+ independent chains state it, swap holds)
//                    · held (one chain) · weak (indiscriminate, or close but short) · unsupported.
// Pure; node-testable. Every string out is a substring of the input (no wording is invented here).
import { figuresIn, figureMatches, namesIn } from "./fold-chat-ground.js";
import { impressionOf } from "./fold-chat-impression.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";

export const FALSIFY = Object.freeze({ RUN: 4, STATE_OVERLAP: 0.5, STATE_MIN_SHARED: 3, ABOUT_OVERLAP: 0.4, SYNDICATED_RUN: 12, MAX_SENTS_PER_SOURCE: 400 });
// The words of HEDGING and REPORTING ("some claim", "experts say", "it is widely considered"): they frame a claim, they
// are not its content, and a source that states the claim in its own frame should not lose for lacking them.
const HEDGE = "some many most several critics experts economists researchers scholars studies study analysts proponents supporters others claim claims claimed argue argues argued suggest suggests suggested say says said believe believes believed note notes noted report reports reported state states stated generally often widely broadly largely commonly usually typically considered seen viewed regarded thought known shown according overall also however although though while whereas indeed particularly especially notably".split(" ");

const FW = new Set([...(FUNCTION_WORDS?.en || []), ..."the a an and or but of in to with by for on at from as is are was were be been being has have had it its this that these those which who what when where why how than then so also there their they he she we you i".split(" "), ...HEDGE]);
const fold = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const words = (s) => fold(s).match(/[\p{L}\p{N}]+/gu) || [];
const stem = (w) => w.replace(/(?:ing|ed|es|s|ly)$/u, "").slice(0, 6);
const contentStems = (s) => [...new Set(words(s).filter((w) => w.length > 2 && !FW.has(w) && !/^\d+$/.test(w)).map(stem))];
const NEG = /\b(?:not|no|never|neither|nor|none|without|cannot|n't|failed to|did not|does not|is not|was not)\b/i;
// a PREDICATE negation ("refused to concede", "denied the result") flips polarity the same way "did not" does
const PNEG = /\b(?:refused?|denied|denies|rejected|rejects|declined|declines)\b/i;
const neg = (s) => NEG.test(String(s)) || PNEG.test(String(s));
/** The content stems a negation in `s` actually governs (the words right after the negator). A polarity flip counts
 *  only when the negation governs something the OTHER sentence commits to — never on a stray "no/not" elsewhere. */
const negGoverns = (s) => { const toks = String(s).toLowerCase().split(/\s+/); const out = new Set(); toks.forEach((w, i) => { if (NEG.test(w) || PNEG.test(w)) for (const x of toks.slice(i + 1, i + 5)) { const t = x.replace(/[^\p{L}\p{N}]/gu, ""); if (t.length > 2) out.add(stem(t)); } }); return out; };
const flipsPolarity = (claim, sent, cs, ss) => {
  const cn = neg(claim), sn = neg(sent);
  if (cn === sn) return false;
  return (sn && [...negGoverns(sent)].some((k) => cs.includes(k))) || (cn && [...negGoverns(claim)].some((k) => ss.includes(k)));
};
const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const SENT = /(?<=[.!?。！？])\s+(?=[\p{Lu}\p{N}"“(])/u;
const sentencesOf = (t) => String(t ?? "").replace(/\s+/g, " ").split(SENT).map((s) => s.trim()).filter((s) => s.length >= 12);

/** Longest run of consecutive words two texts share (folded), and the run itself as the SOURCE wrote it. */
function longestRun(claim, sent) {
  const a = words(claim), bRaw = String(sent).match(/[\p{L}\p{N}]+/gu) || [], b = bRaw.map(fold);
  let best = 0, end = 0;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : 0;
      if (prev[j] > best) { best = prev[j]; end = j; }
      diag = tmp;
    }
  }
  return { n: best, text: best ? bRaw.slice(end - best, end).join(" ") : "" };
}

function figuresAgree(claimFigs, sent) {
  const sf = figuresIn(sent);
  const missing = claimFigs.filter((c) => !sf.some((w) => figureMatches(c, w)));
  // a DIFFERENT figure of the same kind where the claim's is absent: same unit dimension, or both bare years
  const year = (f) => f.numeric && !f.unit && /^\d{4}$/.test(f.norm) && f.v >= 1000 && f.v <= 2200;
  const clash = missing.map((c) => ({ c, w: sf.find((w) => w.numeric && c.numeric && w.norm !== c.norm && ((c.unit && w.unit && c.unit.dim === w.unit.dim) || (year(c) && year(w)) || (!c.unit && !w.unit && c.norm.endsWith("%") === w.norm.endsWith("%") && c.norm.endsWith("%")))) })).filter((x) => x.w);
  return { missing, clash };
}

/** Judge one claim against one sentence (with its neighbours, for names). */
function judge(claim, cs, cfigs, cnames, sent, around) {
  const ss = new Set(contentStems(sent));
  const shared = cs.filter((k) => ss.has(k));
  const overlap = cs.length ? shared.length / cs.length : 0;
  const run = longestRun(claim, sent);
  const { missing, clash } = figuresAgree(cfigs, sent);
  const hay = fold(around);
  // a name is present when its HEAD token is ("Joe Biden" is present where the source says "Biden"); a wholly different
  // name is still missing, so a rival is never silently accepted
  const namesMissing = cnames.filter((n) => { const nw = words(n).filter((w) => w.length > 1 && !FW.has(w)); if (!nw.length) return false; const head = nw[nw.length - 1]; return !(hay.includes(head) || nw.every((w) => hay.includes(w))); });
  // SUBJECT/FILLER: a claim's FIRST name is its subject; it must sit at the START of the matched region, not merely
  // appear somewhere — else a page that says "Biden won … defeating incumbent Donald Trump" would clear "Trump won".
  let subjectMissing = false;
  if (cnames.length) {
    const subj = words(cnames[0]).filter((w) => w.length > 1 && !FW.has(w));
    const head = subj[subj.length - 1];
    if (head && run.text) { const stoks = words(sent); const hi = stoks.indexOf(head), ri = stoks.indexOf(fold(run.text).split(" ")[0]); if (hi >= 0 && ri >= 0 && hi > ri + 2) subjectMissing = true; }
  }
  const polarity = !flipsPolarity(claim, sent, cs, [...ss]);
  const about = overlap >= FALSIFY.ABOUT_OVERLAP && shared.length >= 2;
  const close = run.n >= FALSIFY.RUN || (overlap >= FALSIFY.STATE_OVERLAP && shared.length >= Math.min(FALSIFY.STATE_MIN_SHARED, cs.length));
  let verdict = "silent", why = "";
  if (about && !polarity) { verdict = "contradicts"; why = "same subject, opposite polarity"; }
  else if (about && clash.length) { verdict = "contradicts"; why = `gives ${clash[0].w.raw} where the claim says ${clash[0].c.raw}`; }
  else if (close && !missing.length && !namesMissing.length && !subjectMissing) { verdict = "states"; why = run.n >= FALSIFY.RUN ? `shares the run \u201c${run.text}\u201d` : `${shared.length} of ${cs.length} content words`; }
  else if (close) { verdict = "near"; why = subjectMissing ? `the claim's subject ${cnames[0]} is only the source's object` : missing.length ? `the figure ${missing[0].raw} is not in it` : `the name ${namesMissing[0]} is not near it`; }
  return { verdict, why, overlap, shared: shared.length, runN: run.n, run: run.text, score: run.n * 2 + shared.length + (verdict === "states" ? 100 : verdict === "contradicts" ? 50 : 0) };
}

/** Group passages into independent sources (by domain), each with its sentences. */
export function sourcesOf(passages) {
  const by = new Map();
  for (const p of passages || []) {
    const text = String(p?.text ?? [p?.before, p?.mark, p?.after].filter(Boolean).join(" "));
    if (!text.trim()) continue;
    const url = p.url || p.source || "";
    const key = domainOf(url) || p.ref || url || "source";
    if (!by.has(key)) by.set(key, { key, domain: domainOf(url), url, ref: p.ref || p.label || key, texts: [] });
    const s = by.get(key);
    // a shorter clip of a page already held adds no sentence: keep the fullest copy only
    if (!s.texts.some((t) => t === text || t.includes(text) || text.includes(t))) s.texts.push(text);
  }
  return [...by.values()].map((s) => ({ ...s, sents: s.texts.flatMap(sentencesOf).slice(0, FALSIFY.MAX_SENTS_PER_SOURCE) }));
}

function bestIn(src, claim, cs, cfigs, cnames) {
  let best = null;
  const consider = (sent, i, around) => { const j = judge(claim, cs, cfigs, cnames, sent, around); if (!best || j.score > best.score) best = { ...j, sentence: sent, i }; };
  src.sents.forEach((sent, i) => {
    const around = [src.sents[i - 1], sent, src.sents[i + 1]].filter(Boolean).join(" ");
    consider(sent, i, around);
    // a claim often joins two adjacent sentences of its source ("X began in 2008, when Y"): judge the pair as one
    const nx = src.sents[i + 1];
    if (nx && sent.length + nx.length < 520) consider(sent + " " + nx, i, around + " " + (src.sents[i + 2] || ""));
  });
  return best || { verdict: "silent", why: "nothing read from it", score: 0, sentence: "", overlap: 0, shared: 0, runN: 0, run: "" };
}

const CALENDAR = /^(?:January|February|March|April|May|June|July|August|September|October|November|December|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/;
/** The names a claim commits to — without a lone capitalised first word ("Quantitative easing began…" names nothing) and without months/days. */
function namesOf(s) {
  const first = (String(s).trim().match(/^[\p{L}'-]+/u) || [""])[0];
  return namesIn(s).map((n) => n.replace(/^(?:In|On|At|By|From|Since|During|After|Before|The)\s+/u, "").replace(/['’]s$/u, "")).filter((n) => n && !CALENDAR.test(n) && !(n === first && !/\s/.test(n) && !/^\p{Lu}{2,}$/u.test(n)));
}

/** The swap: a competitor of the same kind from the witness's own source, put in place of the claim's figure/name. */
function swapTest(claim, cfigs, cnames, src, witness) {
  const allFigs = src.sents.flatMap((s) => figuresIn(s));
  // a competitor must be a figure the claim does not already contain ("8" in "8 ft 1 in" is not a rival to "246.3 cm")
  const inClaimFigs = figuresIn(claim);
  for (const c of cfigs) {
    const comp = allFigs.find((w) => w.norm !== c.norm && !figureMatches(c, w) && !inClaimFigs.some((k) => k.norm === w.norm || figureMatches(k, w)) && ((c.unit && w.unit && c.unit.dim === w.unit.dim) || (!c.unit && !w.unit && c.norm.length === w.norm.length)));
    if (!comp) continue;
    const swapped = claim.replace(c.raw, comp.raw);
    // judged against the sentence of the witness that carries the claim's figure (a joined pair may carry both figures)
    const core = sentencesOf(witness.sentence).find((x) => figuresIn(x).some((w) => figureMatches(c, w))) || witness.sentence;
    const j = judge(swapped, contentStems(swapped), figuresIn(swapped), cnames, core, core);
    return { armed: true, kind: "figure", from: c.raw, to: comp.raw, discriminates: j.verdict !== "states" };
  }
  // a rival NAME is a name of the same shape: a person for a person (two or more capitalised words), a single word for a
  // single word; never a lone capitalised word that follows an article or sits inside another name ("a Polish physicist",
  // "the Guinness World Records"): an adjective or a fragment is not someone the claim could have been about.
  const capSeq = /(?<![\p{L}])\p{Lu}[\p{L}'’-]+(?:\s+\p{Lu}[\p{L}'’-]+)*/gu;
  const inClaim = new Set(words(claim));
  for (const n of cnames) {
    const multi = /\s/.test(n.trim());
    const pool = new Set();
    // a rival must be someone the claim could have been about: named in ANOTHER sentence of the source, or alongside the
    // original in the stating sentence ("X and Y", "X with Y"). A name in the stating sentence in some other role
    // ("recognised by Guinness World Records") is not a rival, so it can neither pass nor fail the claim.
    const stating = String(witness?.sentence || "");
    const sameSent = (s) => !!stating && (stating.includes(s) || s.includes(stating));
    const alongside = (s, t) => { const a = s.indexOf(n), b = s.indexOf(t); if (a < 0 || b < 0) return false; const lo = a < b ? a + n.length : b + t.length, hi = a < b ? b : a; return /^\s*(?:,|and|or|&|with|,\s*and|and\s+also)\s*$/i.test(s.slice(lo, hi)); };
    for (const s of src.sents) for (const m of s.matchAll(capSeq)) {
      const t = m[0].replace(/['’]s$/u, ""), before = s.slice(Math.max(0, m.index - 4), m.index).toLowerCase();
      if (m.index === 0 && !/\s/.test(t)) continue;                                   // a sentence's first word is capitalised by position
      if (/\b(?:a|an|the)\s$/.test(before)) continue;                                 // an article: an adjective or a role, not a name
      if (/\s/.test(t) !== multi) continue;                                           // same shape as the claim's name
      if (stating.includes(t) && !alongside(stating, t)) continue;                    // in the stating sentence only as a different role
      pool.add(t);
    }
    const comp = [...pool].find((x) => !inClaim.has(fold(x)) && !words(x).some((w) => inClaim.has(w)) && !FW.has(fold(x)) && !CALENDAR.test(x));
    if (!comp) continue;
    const swapped = claim.replace(n, comp);
    const j = judge(swapped, contentStems(swapped), figuresIn(swapped), namesOf(swapped), witness.sentence, witness.sentence);
    return { armed: true, kind: "name", from: n, to: comp, discriminates: j.verdict !== "states" };
  }
  return { armed: false };
}

/** Split a compound claim at coordinating conjunctions so a sentence whose clauses a source states in DIFFERENT
 *  sentences can still hold — but never split a bare list ("Michigan and Wisconsin" stays one clause). */
export function clausesOf(s) {
  const text = String(s).trim();
  const parts = text.split(/\s*;\s*|\s+(?:but|whereas)\s+|\s+and\s+(?=\S+(?:\s+\S+){3,})/u).map((x) => x.trim()).filter((x) => x.length >= 12);
  return parts.length >= 2 ? parts : [text];
}

/** Falsify an answer. `sentences`: the answer's sentences (strings). `passages`: everything read ({ text | before/mark/after, url, ref }). */
export function falsifyAnswer(sentences, passages) {
  const sources = sourcesOf(passages);
  const claims = (sentences || []).map((raw, i) => {
    const s = String(raw ?? "").trim();
    const cs = contentStems(s), cfigs = figuresIn(s), cnames = namesOf(s);
    const per = sources.map((src) => {
      const b = bestIn(src, s, cs, cfigs, cnames);
      if (b.verdict !== "states") {
        // a compound claim whose every clause a source states (in different sentences) is stated by that source
        const cl = clausesOf(s);
        if (cl.length > 1) {
          const each = cl.map((c) => bestIn(src, c, contentStems(c), figuresIn(c), namesOf(c)));
          if (each.every((x) => x.verdict === "states")) return { src: src.key, ...b, verdict: "states", why: "every clause is stated", clauseSupport: true };
        }
      }
      return { src: src.key, ...b };
    });
    // independence: two sources whose stating sentences share a long run are one chain (syndicated copy)
    const states = per.filter((w) => w.verdict === "states");
    const chains = [];
    for (const w of states) { const c = chains.find((ch) => longestRun(ch[0].sentence, w.sentence).n >= FALSIFY.SYNDICATED_RUN); if (c) { c.push(w); w.sameChainAs = c[0].src; } else chains.push([w]); }
    const contra = per.filter((w) => w.verdict === "contradicts");
    const lead = states[0] ? sources.find((x) => x.key === states[0].src) : null;
    const swap = lead && !states[0].clauseSupport ? swapTest(s, cfigs, cnames, lead, states[0]) : { armed: false };
    let verdict;
    if (!cs.length && !cfigs.length) verdict = "n/a";
    else if (contra.length) verdict = "contested";
    else if (states.length && swap.armed && !swap.discriminates) verdict = "weak";
    else if (chains.length >= 2) verdict = "corroborated";
    else if (chains.length === 1) verdict = "held";
    else if (per.some((w) => w.verdict === "near")) verdict = "weak";
    else verdict = "unsupported";
    return { i, s, figures: cfigs.map((f) => f.raw), names: cnames, witnesses: per, chains: chains.length, contradictions: contra.length, swap, verdict };
  });
  const count = (v) => claims.filter((c) => c.verdict === v).length;
  const scored = claims.filter((c) => c.verdict !== "n/a");
  return {
    sources: sources.map((s) => ({ key: s.key, domain: s.domain, url: s.url, ref: s.ref, sentences: s.sents.length })),
    claims,
    summary: { claims: scored.length, corroborated: count("corroborated"), held: count("held"), weak: count("weak"), contested: count("contested"), unsupported: count("unsupported"),
      backed: count("corroborated") + count("held"), swapsArmed: claims.filter((c) => c.swap.armed).length, swapsFailed: claims.filter((c) => c.swap.armed && !c.swap.discriminates).length,
      cleared: scored.length > 0 && scored.every((c) => c.verdict === "corroborated" || c.verdict === "held") },
  };
}

// ───────── THE REC LOOP's helpers: where a failing claim goes back to, and what the restatement may see ─────────
export const FAILING = new Set(["unsupported", "contested", "weak"]);
export const claimSentences = (text) => sentencesOf(text);
/** REC → INS: recall a failing claim against the FULL pages already read (each admitted as a shadow Field, relative.js,
 *  by impressionOf) and take a new impression of each page FOR THE CLAIM. Only sentences the claim recalls above the
 *  page's own null band, that reach something the first impression did not carry, come back. Returns new passages
 *  (with their shadows: byte ranges in the original page) — nothing when the page holds nothing more about it. */
export function reImpress(claim, pages, { budget = 1400 } = {}) {
  const out = [];
  for (const pg of pages || []) {
    const page = String(pg?.text ?? pg?.page ?? "");
    if (page.length < 200) continue;
    let e; try { e = impressionOf(page, claim, { budget, lead: false }); } catch { continue; }
    if (!e || !e.text || !e.shadow || !(e.shadow.recalled > 0) || e.shadow.kept >= page.length) continue;
    const had = new Set((pg.shadow?.segments || []).map((g) => g.start + ":" + g.end));
    const fresh = (e.shadow.segments || []).filter((g) => !had.has(g.start + ":" + g.end));
    if (!fresh.length) continue;
    out.push({ ref: pg.ref, url: pg.url, source: pg.url, text: e.text, via: "re-impression", shadow: e.shadow, forClaim: claim.slice(0, 160) });
  }
  return out;
}

/** The search a failing claim sends the turn back with: the claim's own names, figures and content words. */
export function claimQuery(s) {
  const toks = String(s ?? "").match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) || [];
  return toks.filter((w) => !FW.has(fold(w)) && w.length > 1).slice(0, 10).join(" ");
}
/** REC routes each failing claim back to the operator where it failed: first INS (the full pages already read, recalled
 *  for the claim), then SIG (a new search with the claim as the query) for what the pages do not hold. */
export function routeOf(c) {
  const why = c.verdict === "contested" ? "a source contradicts it \u2014 two cannot settle it, so a third, independent source"
    : c.verdict === "weak" ? (c.swap?.armed && !c.swap.discriminates ? `the evidence does not tell \u201c${c.swap.from}\u201d from \u201c${c.swap.to}\u201d \u2014 a sharper sentence` : "close, but a figure or name is missing \u2014 a sentence that states all of it")
    : "no kept passage states it \u2014 look in the whole pages, then search with the claim itself";
  return { op: "INS", why, query: claimQuery(c.s) };
}
/** The passages most about a claim (content-word overlap), clipped, for the restatement. */
export function pickPassages(claim, passages, n = 4) {
  const cs = new Set(contentStems(claim));
  return (passages || []).map((p) => ({ p, k: contentStems(p.text).filter((x) => cs.has(x)).length })).filter((x) => x.k >= 2)
    .sort((a, b) => b.k - a.k).slice(0, n).map((x) => ({ ref: x.p.ref, url: x.p.url || x.p.source, text: String(x.p.text || "").slice(0, 1500) }));
}
/** The SYN step of a lap: restate ONE sentence from the passages, or say NONE. */
export function restateClaimMessages(sentence, passages) {
  return [
    { role: "system", content: "You restate one sentence so that the passages below state it. Use only what the passages say; keep every figure and name a passage gives exactly as written. Reply with the one sentence only, in the same language as the sentence. If the passages support no version of it, reply exactly: NONE" },
    { role: "user", content: passages.map((p, i) => `[${i + 1}] ${p.text}`).join("\n\n") + `\n\nSentence: ${sentence}` },
  ];
}
/** Replace a sentence in a text even when the text's whitespace differs from the sentence's. */
export function replaceSentence(text, from, to) {
  const esc = String(from).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const re = new RegExp(esc);
  return re.test(text) ? String(text).replace(re, () => to) : text;
}

/** Everything a turn's record says it read, as passages: the kept passages on the tape, the facing page's spans, the material. */
export function passagesOfRecord(rec) {
  const out = [];
  // the stored passages first: they are the FULLEST copy (3000 chars, D1 store-shadow), so the cross-check judges against
  // the page the turn actually read — not only the 900-char tape clip, which silently dropped a true sentence's support
  for (const p of rec?.passages || []) if (p && p.text) out.push({ text: p.text, url: p.url || p.source, ref: p.ref });
  for (const e of rec?.tape || []) if (e && e.kind === "quick" && e.p) out.push({ text: e.p.text, url: e.p.url, ref: e.p.ref });
  for (const s of rec?.facing?.sources || []) out.push({ before: s.before, mark: s.mark, after: s.after, url: s.url, ref: s.ref || s.label });
  for (const m of rec?.material || []) if (m && m.text) out.push({ text: m.text, url: m.url || m.source, ref: m.ref });
  return out;
}
