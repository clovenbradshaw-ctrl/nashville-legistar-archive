// proof.js — the pure half of proof-seeking: turning a flagged claim into a
// search of the world, and a fetched page into a typed corroboration verdict.
//
// The philosophy this implements, stated once: the instrument is never
// asked to be RIGHT — it is asked to make the effort of grounding visible,
// and objectivity here is the asymptotic approach toward truth from
// DIFFERENT PERSPECTIVES. A claim the local material does not back is not
// therefore false; it is unproven, and the honest next move is to go look —
// through the one sanctioned egress (P13), with every crossing recorded —
// and to report what was found as counted perspectives, never as a verdict
// of truth. "Stated by 2 of 3 pages consulted, from 2 distinct hosts" is a
// measurement; "true" is not something this module can say, and it never
// does.
//
// THIS MODULE OWNS NO NETWORK — the web.js discipline exactly: everything
// here is a function from a claim and bytes-already-fetched to structure.
// The fetching lives where P13 put it (explore-server.mjs /api/web/*); the
// page calls those endpoints and hands the saved text face back in here.
//
// Independence is counted, not assumed, and its limit is disclosed: two
// pages from one host are one perspective (the same fold cite.js's
// distinct-sources rule makes locally). Two hosts syndicating one wire
// story are ALSO one perspective, and this module cannot see that — the
// `independence` field says "distinct hosts", names the residue, and no
// caller may phrase it stronger (the Tow Center measured exactly this
// inflation in the wild: engines citing syndicated copies as if they
// were independent sources).

import { wordSet, numberSet, hasWord, hasNumber, CLAIM_STOPWORDS } from "../organs/grounding.js";
import { hostOf } from "../organs/web.js";
// The SAME construction every caller must key a claim by (claims.js's own
// header: "held here once so no two callers can drift apart"). A hand-
// written copy here previously diverged on the no-tokens fallback (claimKey
// drops words of length <=2 and joins per-token; the old inline version
// lowercased the whole unsplit text) — dormant today only because every
// real target already carries non-empty tokens before this runs.
import { claimKey } from "../organs/claims.js";

// ── declared numbers, each with its giver ───────────────────────────────────
// Budgets with names and stated duties (P9), not quality thresholds. None
// was chosen by checking an outcome.
export const PROOF_PAGES_CONSULTED = 3; // pages read per claim — one perspective is anecdote, three is the smallest count where "2 of 3" can disagree with "3 of 3"
export const PROOF_QUERY_MAX_TERMS = 8; // a search query, not a document — DDG serves short queries; the claim's own most specific words go first
export const PROOF_TARGETS_PER_TURN = 4; // automatic seeking per turn is bounded and the bound is visible; every further claim keeps its manual button
// A search of the world, before any claim exists to search for — own name,
// own duty: PROOF_PAGES_CONSULTED reads pages FOR one already-flagged
// claim; this reads pages to GIVE a materialless draft something to stand
// on before it exists. Same value today, declared separately because the
// two questions are not the same question and may not stay the same number.
export const PREFLIGHT_PAGES_CONSULTED = 3;
export const PREFLIGHT_QUERY_MAX_TERMS = 12; // a topic anchor, not a claim — room for the task's own words plus the fold's one-line discourse
// The smallest ceiling that still lets a bare-topic answer be CORROBORATED
// (a second source, so "unproven" stays distinguishable from "confirmed")
// rather than resting on exactly one page — never picked by checking what
// it does to any one question's own answer (P9).
export const PREFLIGHT_BARE_TOPIC_PAGES = 2;

/**
 * How many pages a preflight hunt needs, once the question's own void SHAPE
 * is already known — void-brief.js's `briefFor`, read on the question
 * alone, before any material exists to read. "Once we know the shape of an
 * answer, we know the shape of what it needs to be fed" (user direction,
 * 2026-09-10). Returns a ceiling at or below `defaultPages`: this only ever
 * NARROWS, and only in the one case it can reason about safely.
 *
 * Deliberately NOT keyed on declared CARDINALITY. void-brief.js's own
 * header already names why a singular-SOUNDING question is not license to
 * assume a single-valued world: "'who was Lincoln's vice president?' is
 * grammatically singular and factually two-valued... declaring the space
 * single-filler before any material is consulted is the unearned overlay
 * this codebase already refuses elsewhere." Reading a singular slot as "one
 * page will do" would be exactly that mistake, wearing a new name.
 *
 * What IS safe: whether the slot is RELATIONAL — named as something OF or
 * BELONGING TO a separate anchor ("Lincoln's vice president", "capital of
 * Brazil", "who was in Van Halen"). A relational slot is precisely the
 * shape where a second term, a second office-holder, a second member can
 * hide — the Lincoln mistake's own shape — so it keeps the full ceiling,
 * unconditionally. A BARE topic slot ("what year did the French Revolution
 * begin?") names no second party for the void's own multi-filler machinery
 * to ever have been checking for; there is nothing here that machinery
 * protects against today, with or without this function, so a smaller,
 * still-corroborating ceiling is a genuine efficiency gain rather than a
 * narrower bet on the world.
 *
 * `slotDeclared: false` (an explanatory or conversational question — no
 * slot at all, `briefFor` returned null) passes through unchanged: there is
 * no shape here to act on.
 */
export function preflightCeilingFor({ slotDeclared = false, anchorDeclared = false } = {}, defaultPages) {
  if (!slotDeclared || anchorDeclared) return defaultPages;
  return Math.min(defaultPages, PREFLIGHT_BARE_TOPIC_PAGES);
}

/**
 * The search query for a claim, built from the claim's own words — never
 * paraphrased, never enriched: retrieval is a function of the question's
 * own words (READING-POLICY), and here the question is the claim. The
 * atom's exact text is quoted (a name or figure is the thing to find
 * verbatim); the sentence's remaining content words follow, most specific
 * first — longer words carry more identity than shorter ones in the absence
 * of any corpus statistics about the web, which this module honestly does
 * not have.
 *
 * Measured live 2026-09-09: a caller (an unbound relation claim's composed
 * sentence, not this module's own atom shape) handed `claim.text` an entire
 * clause — "The Mona Lisa was painted by Leonardo da Vinci" — and this
 * function quoted it whole as an exact phrase. DuckDuckGo's exact-phrase
 * match needs that literal string to appear verbatim somewhere on the web;
 * an ordinary paraphrased clause almost never does, so the search returned
 * zero results even with the correct page already sitting in the pool.
 * `atom`'s own docstring already says what it is for — "a name or figure",
 * something genuinely quotable — so a caller handing this something longer
 * than the query's own term budget (PROOF_QUERY_MAX_TERMS, already
 * declared, reused rather than a second number invented here) is handing a
 * clause, not a figure: its words join the ranked, capped pool exactly as
 * the sentence's own remaining words do, unquoted, instead of being wrapped
 * in a phrase match nothing on the web can be expected to contain.
 */
export function proofQuery(claim) {
  const atom = String(claim?.text ?? "").trim();
  const sentence = String(claim?.sentence ?? "");
  const atomWords = new Set(
    atom.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean),
  );
  const quotable = atom && atomWords.size <= PROOF_QUERY_MAX_TERMS;
  const restPool = quotable ? sentence : `${atom} ${sentence}`;
  const restExclude = quotable ? atomWords : new Set();
  const rest = [
    ...new Set(
      restPool
        .split(/[^\p{L}\p{N}'’]+/u)
        .map((w) => w.replace(/['’]s$/, ""))
        .filter(
          (w) =>
            w.length > 2 &&
            !restExclude.has(w.toLowerCase()) &&
            !CLAIM_STOPWORDS.has(w.toLowerCase()),
        ),
    ),
  ]
    .sort((a, b) => b.length - a.length)
    .slice(0, Math.max(0, PROOF_QUERY_MAX_TERMS - (quotable && atom ? 1 : 0)));
  const quoted = quotable && /\s/.test(atom) ? `"${atom}"` : quotable ? atom : "";
  return [quoted, ...rest].filter(Boolean).join(" ").trim();
}

/**
 * Whether a turn should search the world BEFORE the model drafts anything,
 * rather than only after — the predictive-processing move this ladder was
 * missing. `checkGrounding` already tells the truth about absence
 * (`examined: false` at zero passages — a deliberate fact, grounding.test.mjs)
 * and `extractCheckableAtoms` already exists for the genuine no-material
 * factual question (its own docstring: "give the web tier candidates on a
 * genuine world-claim nobody sourced"). What was missing was WHEN that same
 * absence acts: today it waits for a draft to exist and manufactures
 * candidates from the model's own words — which for a topic-less follow-up
 * ("prove it" after an invented "70 degrees, sunny") are the model's own
 * invention, not the world. This asks the identical structural question one
 * step earlier — is there material to check a draft against — so the answer
 * can be "go get some" instead of "invent something to blame afterward."
 *
 * Deliberately NOT a semantic classifier of which questions "need" fresh
 * information: this repo's own history (widget.js's rewrite away from
 * hand-typed intent word lists) is the standing argument against exactly
 * that move, and the same asymmetry holds here. A false positive costs one
 * wasted search on a turn that didn't need it — checkGrounding runs fine
 * against irrelevant material, a sentence sharing nothing with it just
 * stays unattributed, the same honest outcome as no material at all. A
 * false negative reproduces the bug this exists to close. So the gate is
 * purely structural, never a guess about the question's own words: a flat
 * (undecomposed) turn, nothing already attached, and standing consent
 * already given for both checking and web egress — the same two switches
 * that already gate every other automatic crossing this ladder makes.
 */
export function shouldPreflight({ live = [], grounded = false, webProof = false, planMode = "model" } = {}) {
  return !live.length && !!grounded && !!webProof && planMode === "flat";
}

/**
 * The search anchor for a preflight. The task's own words and the fold's
 * one-line discourse (topic · flow · entities) are two DIFFERENT assemblies,
 * and this used to union them unconditionally — so a self-contained question
 * asked right after another topic searched the web on both topics at once
 * (measured live 2026-08-19: "research Robert Macnamera" after a greeting
 * searched on "Greeting exchange"'s words too, fetched a greeting-etiquette
 * page, and retrieval then preferred it over the on-topic pages; separately
 * measured the same day, a real conversation whose first turn was about
 * trazodone landed "who was Abraham Lincoln's vice president?" polluted
 * with trazodone/serotonin/vaccine, and the search returned a trazodone FAQ
 * page for a wholly unrelated question — a retrieval failure wearing
 * grounded citations, not a hallucination). The discourse anchor exists for
 * the topic-less follow-up ("prove it") whose own words name nothing — so
 * the join is now earned, never assumed: the discourse's words enter only
 * when the task points back anaphorically (a received closed class, the
 * engine's ANAPHORIC_PRONOUNS — injected, the widget.js pattern, never a
 * hand-typed intent list) or carries FEW content words (PREFLIGHT_FEW_WORDS
 * or fewer). Task words still come first, so they survive the cap before
 * the discourse line's do if the joined anchor runs long.
 *
 * Widened from "zero content words" 2026-08-19 (user direction: "our
 * gating is too strict, it needs to be more associative, people need to be
 * able to use poor grammar"). Measured live: "what about johnson?", asked
 * mid-conversation about Lincoln's vice presidents, reduces to the single
 * word "johnson" after stopwords — grammatically not an anaphor, but
 * exactly as under-specified as "prove it" was. Searched alone it found
 * Johnson & Johnson, the pharmaceutical company, not Andrew Johnson. Real
 * conversational follow-ups are routinely this terse and elliptical ("and
 * him?", "same for x") — treating only textbook anaphora as
 * discourse-dependent excluded the whole ordinary shape of a follow-up
 * question. The threshold leans associative on purpose: this function's
 * own comment above already states the asymmetry ("a false positive costs
 * one wasted search... a false negative reproduces the bug this exists to
 * close") — joining more readily is the side that comment already argued
 * for, not a new tradeoff invented here. The SAME threshold also closes the
 * trazodone/Lincoln incident above without a second mechanism: "who was
 * Abraham Lincoln's vice president?" carries four real content words —
 * Abraham, Lincoln, vice, president — well past PREFLIGHT_FEW_WORDS, so it
 * never joins regardless of what preceded it in the conversation.
 */
export const PREFLIGHT_FEW_WORDS = 2; // a task at or below this many content words is treated as under-specified, same as zero

// A TWO-LETTER WORD IS CONTENT unless the stopword set says otherwise. The
// floor here used to be `length > 2`, and it silently dropped the only word
// that said what a question was ASKING — measured live 2026-08-26 on the
// real app, the whole chain visible end to end: "who was lincoln's VP?"
// built the search query `"lincoln"` (VP is two characters), DuckDuckGo
// answered with eight Lincoln Motor Company pages, the preflight fetched
// three, and the model was handed luxury-SUV marketing copy to answer a
// question about a vice president. The instrument caught its own failure
// correctly downstream ("not supported by that material") — but the defect
// was upstream of every check, in what was searched for. Two worse cases
// from the same floor: "what did the US do" reduced to the EMPTY string
// (nothing survives), and "explain AI safety" searched "explain safety".
//
// The floor is now `length > 1`, not a special case for capitals, because
// the first fix WAS capitals-only and the very next real report was the
// same question typed lowercase ("who was lincoln's vp?") — still reduced
// to "lincoln", still fetched car pages. A rule that depends on the user
// shift-keying an abbreviation is not a rule. What actually separates
// content from noise at this length is already built and already tuned:
// CLAIM_STOPWORDS carries 24 words of two letters or fewer (a, am, an, as,
// at, be, by, do, he, i, if, in, is, it, me, my, no, of, on, or, so, to,
// us, we), and it catches the noise on its own — verified against the
// controls below, which are unchanged by the lower floor ("the cat is on
// the mat" still reduces to "cat mat", "how are you?" still to nothing).
//
// The rule is structural, never a typed list of known acronyms (this repo's
// standing discipline — a hand-typed closed class is the thing to reach for
// last): a token the writer capitalised THROUGHOUT is carrying meaning the
// length floor cannot see, so casing decides, read off the source's own
// bytes.
//
// An acronym also bypasses CLAIM_STOPWORDS, and that is the point rather
// than an oversight: the stopword set is checked lowercased, so it cannot
// tell the COUNTRY "US" from the pronoun "us", the agency "WHO" from the
// interrogative "who", or the field "IT" from the pronoun "it" — and it
// wrongly refused all three. Casing is the only evidence in the text that
// separates them, so the caps branch is checked FIRST and stands alone.
// Disclosed cost, accepted: a question typed entirely in capitals has no
// stopwords at all and searches on every word. That is bounded by
// PREFLIGHT_QUERY_MAX_TERMS, it is rare, and it fails toward searching too
// broadly — the same side of the asymmetry this function's own comment
// above already argues for ("a false positive costs one wasted search").
const ACRONYM = /^\p{Lu}{2,}$/u;

export function preflightQuery(task, discourse = "", { anaphors = null } = {}) {
  const content = (s) => [
    ...new Set(
      String(s ?? "")
        .split(/[^\p{L}\p{N}'’]+/u)
        .map((w) => w.replace(/['’]s$/, ""))
        .filter((w) => ACRONYM.test(w) || (w.length > 1 && !CLAIM_STOPWORDS.has(w.toLowerCase()))),
    ),
  ];
  const taskWords = content(task);
  const tokens = String(task ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}'’]+/u)
    .filter(Boolean);
  const pointsBack = !!anaphors && tokens.some((t) => anaphors.has(t));
  const words =
    pointsBack || taskWords.length <= PREFLIGHT_FEW_WORDS
      ? [...new Set([...taskWords, ...content(discourse)])]
      : taskWords;
  return words.slice(0, PREFLIGHT_QUERY_MAX_TERMS).join(" ").trim();
}

/**
 * Order search results by how much of the claim's own context their title
 * and snippet carry, before any page is fetched. The engine's raw order is
 * relevance to the QUERY STRING; a bare figure is a weak key, and the top
 * results can be about a different 70,000 entirely — measured live
 * 2026-08-17: "70,000" from a Borodino sentence consulted a Gaza casualty
 * page while three Borodino pages sat lower in the list. Overlap is a
 * count (argmax ordering, no threshold, P4); ties keep the engine's order.
 */
export function rankResults(claim, results) {
  // Both sides through the one fold (P11 — grounding.js's own wordSet/
  // hasWord, the same organs primary.js::rankPrimary and priors.js::
  // rankPriorCandidates already use for this identical overlap-counting
  // task): an unfolded raw split let a claim sentence naming an accented
  // figure ("Kutúzov") under-count against a search result spelling it
  // plain ("Kutuzov"), or the reverse — silently letting an off-topic
  // result outrank the true source on the diacritic axis instead of the
  // raw-relevance axis this function exists to fix.
  const want = [
    ...new Set(
      [
        ...String(claim?.sentence ?? "")
          .toLowerCase()
          .split(/[^\p{L}\p{N}'’]+/u)
          .map((w) => w.replace(/['’]s$/, "")),
        ...(claim?.tokens ?? []).map((t) => String(t).toLowerCase()),
      ].filter((w) => w.length > 2 && !CLAIM_STOPWORDS.has(w)),
    ),
  ];
  if (!want.length) return [...(results ?? [])];
  const scored = (results ?? []).map((r, i) => {
    const face = wordSet(`${r?.title ?? ""} ${r?.snippet ?? ""}`);
    let n = 0;
    for (const w of want) if (hasWord(face, w)) n++;
    return { r, i, n };
  });
  scored.sort((a, b) => b.n - a.n || a.i - b.i);
  return scored.map((x) => x.r);
}

/**
 * One page, one assessment: does this page's saved text face state the
 * claim's tokens? The same containment discipline as the local check
 * (grounding.js's wordSet/hasWord for names, numberSet/hasNumber for
 * figures — the SAME fold on both sides, P11's first consequence), so a
 * claim is judged against the web by exactly the rule it failed locally.
 * `context` counts how many of the claim sentence's content words the page
 * also carries — a page that states the name but shares nothing else with
 * the sentence is a weaker perspective than one discussing the same
 * subject, and the count says so without pretending to be a score.
 */
export function assessPage(claim, pageText) {
  const text = String(pageText ?? "");
  if (!text.trim()) return { stated: false, absent: [...(claim?.tokens ?? [])], context: { shared: 0, of: 0 } };
  const words = wordSet(text);
  const numbers = numberSet(text);
  const isNumber = claim?.kind === "number";
  const tokens = (claim?.tokens ?? []).map(String);
  const absent = tokens.filter((t) => (isNumber ? !hasNumber(numbers, t) : !hasWord(words, t)));

  const sentenceWords = [
    ...new Set(
      String(claim?.sentence ?? "")
        .toLowerCase()
        .split(/[^\p{L}\p{N}'’]+/u)
        .map((w) => w.replace(/['’]s$/, ""))
        .filter((w) => w.length > 2 && !CLAIM_STOPWORDS.has(w)),
    ),
  ];
  const shared = sentenceWords.filter((w) => hasWord(words, w)).length;

  return {
    stated: tokens.length > 0 && absent.length === 0,
    absent,
    context: { shared, of: sentenceWords.length },
  };
}

/**
 * The verdict across everything consulted, typed and phrased in natural
 * frequencies. `pages` is what the caller actually fetched: each entry
 * `{ url, host?, title?, challenge?, gap?, assessment?, context? }` — a
 * fetch the server refused rides through as its typed gap, never dropped
 * (a failed fetch is not a page that said nothing).
 *
 * Verdicts:
 *   web-corroborated   — at least one consulted page states the claim.
 *                        `independence` counts DISTINCT HOSTS among them,
 *                        with the syndication residue named.
 *   web-uncorroborated — pages were consulted and none states it. NOT
 *                        falsity: the counted fact is "0 of N pages", and
 *                        the phrasing never exceeds it.
 *   refused-upstream / not-consulted — the crossing itself failed or never
 *                        ran; a gap, not a zero.
 */
export function foldProof(claim, { query, pages = [], gap = null } = {}) {
  const consulted = pages.filter((p) => p && !p.gap);
  const failed = pages.filter((p) => p && p.gap);
  if (gap || !consulted.length) {
    const g = gap ?? failed[0]?.gap ?? { silence: "not-present", detail: "no page could be read" };
    // Say what actually happened, not a catch-all: a search that ran and
    // found nothing is a different fact from a crossing that failed —
    // measured live 2026-08-17, when a zero-result search shipped as "the
    // crossing failed" and read as an outage.
    const sentence =
      g.silence === "refused-upstream"
        ? "the search engine declined this machine (its bot check) — nothing was looked up, which is a gap, not a verdict"
        : `nothing was checked online — ${g.detail ?? "no page could be read"} — a gap, not a verdict`;
    return {
      verdict: g.silence === "refused-upstream" ? "refused-upstream" : "not-consulted",
      claim: claim?.text ?? null,
      query: query ?? null,
      consulted: 0,
      failed: failed.length,
      gap: g,
      sentence,
    };
  }
  const stating = consulted.filter((p) => p.assessment?.stated);
  const hosts = [...new Set(stating.map((p) => p.host ?? hostOf(p.url)))];
  // EVERY page read, stated or not — the audit must show the whole walk,
  // not just the pages that agreed (user, 2026-08-17: "I want to see its
  // websearching stuff").
  const read = consulted.map((p) => ({
    url: p.url,
    host: p.host ?? hostOf(p.url),
    textPath: p.textPath ?? null,
    stated: !!p.assessment?.stated,
  }));
  const kindWord = claim?.kind === "number" ? "the figure" : claim?.kind === "edge" ? "the statement" : "the name";
  const phrase =
    `${kindWord} “${claim?.text ?? ""}”`.trim() +
    ` appears on ${stating.length} of the ${consulted.length} page(s) read` +
    (stating.length ? ` (${hosts.length} different site(s))` : "") +
    (failed.length ? `; ${failed.length} page(s) couldn't be fetched, counted separately` : "");
  return {
    verdict: stating.length ? "web-corroborated" : "web-uncorroborated",
    claim: claim?.text ?? null,
    query: query ?? null,
    consulted: consulted.length,
    read,
    failed: failed.length,
    stating: stating.map((p) => ({
      url: p.url,
      host: p.host ?? hostOf(p.url),
      title: p.title ?? null,
      textPath: p.textPath ?? null,
      context: p.assessment?.context ?? null,
      ...(p.snips?.length ? { snips: p.snips } : {}),
      ...(p.challenge ? { challenge: true } : {}),
    })),
    independence: {
      hosts: hosts.length,
      basis: "distinct hosts; syndication between hosts is not tested and two hosts may carry one upstream story",
    },
    sentence: phrase,
  };
}

/** The proof targets a turn's checks yield, in the order worth spending the
 * bounded automatic budget on: contradicted edges first (the material
 * actively disagrees — the reader most needs a second perspective), then
 * unsupported atoms that are not question echoes, then unbound edges. Every
 * target carries its own words; nothing is paraphrased. */
export function proofTargets({ findings = [], relationReport = null } = {}) {
  const targets = [];
  for (const c of relationReport?.claims ?? []) {
    if (c.verdict === "contradicted") {
      targets.push({
        kind: "edge",
        text: `${c.end1} ${c.label} ${c.end2}`,
        tokens: [c.end1, c.label, c.end2].flatMap((s) => String(s).split(/\s+/)).filter((w) => w.length > 2),
        sentence: c.sentence,
        why: "contradicted",
      });
    }
  }
  for (const f of findings) {
    if (f.echoesQuestion) continue;
    targets.push({
      kind: f.atomKind,
      text: f.text,
      tokens: f.atomKind === "number" ? [String(f.text).replace(/[,%]/g, "")] : (f.absent?.length ? f.absent : [f.text]),
      sentence: f.sentence ?? null,
      why: "unsupported",
    });
  }
  for (const c of relationReport?.claims ?? []) {
    if (c.verdict === "unbound") {
      targets.push({
        kind: "edge",
        text: `${c.end1} ${c.label} ${c.end2}`,
        tokens: [c.end1, c.label, c.end2].flatMap((s) => String(s).split(/\s+/)).filter((w) => w.length > 2),
        sentence: c.sentence,
        why: "unbound",
      });
    }
  }
  // One target per distinct claim — a name flagged in three sentences is
  // one thing to look up, not three crossings. Keyed on the claim's TOKENS,
  // not its surface text: "The Kessington Report" opening a sentence and
  // "Kessington Report" mid-sentence are the same thing to look up.
  // claimKey (claims.js), never a local recomputation — its own header
  // names exactly this risk: two callers must not drift on what "the same
  // claim" means.
  const seen = new Set();
  return targets.filter((t) => {
    const key = claimKey(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
