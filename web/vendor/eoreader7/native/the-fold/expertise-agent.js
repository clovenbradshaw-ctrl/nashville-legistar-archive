// expertise-agent.js — ONE prompt, e.g. "go learn expertise on limericks,"
// drives the whole hunt-and-learn pass, asking a follow-up question through
// the local model when (and only when) a real mechanical gap blocks it
// (2026-09-22).
//
// The model is STILL just the mouth: it never decides WHETHER to ask (that
// is a mechanical fact below — no topic could be read from the prompt, or
// the hunt found too few instances/population) and never decides WHAT
// counts as an answer (a URL is read by regex, a topic is read by stripping
// a fixed set of leading verb phrases). It only phrases the question, and
// only summarizes a fact it is handed, in words. Every call is bounded
// (MAX_TURNS) so a person is never asked forever instead of being told the
// hunt is stuck.
import { runLearnPass } from "./learn-pass.js";

const URL_RE = /\bhttps?:\/\/[^\s)>\]"']+/g;

// Stripped iteratively (order matters least this way: each pass removes ONE
// more leading verb/filler word until none match), so "go learn expertise
// on limericks" reduces go→learn→expertise→on→limericks in four passes, and
// "learn how to write a white paper" reduces learn→how→to→write→a in five —
// the SAME general mechanism, not a phrase added for one example (measured
// live 2026-09-22: this exact phrasing was the case that found the gap).
const LEADING = [
  /^please\s+/i, /^go\s+/i, /^(learn|study|research)\s+/i,
  /^develop\s+/i, /^expertise\s+/i, /^become\s+/i, /^an?\s+expert\s+/i, /^expert\s+/i,
  /^get\s+/i, /^(about|on|in)\s+/i,
  /^how\s+/i, /^(do|does|did)\s+(i|you|we)\s+/i, /^to\s+/i, /^(write|make|create|produce|draft|compose)\s+/i, /^an?\s+/i,
];
// A trailing "like this/that/the following [...]" refers to whatever link
// or example follows it (already stripped as a URL above, or reported
// separately by the caller) — not part of the topic's own name.
const TRAILING_EXAMPLE_REF = /\s+like\s+(this|that|the following)\b.*$/i;
// A greeting or a sentence in the person's own voice ("I'm not sure…") is
// not a topic name — mechanical guards, not a model judgment.
const NOT_A_TOPIC = /^(hi|hey|hello|yo|hola|sup|thanks|thank you|ok|okay|sure|no|yes|sorry|i|i'm|im|you|we|it|they|what|how|why|who|when|where|that)\b/i;

// A trailing "for the X sector/industry/audience/…" (or bare "for X") names
// the STANCE the form is being learned under — the user: "writing a
// competent white paper for the tech sector is different than for food
// science." A form's shape can genuinely pivot on this; it is never folded
// into the bare topic name, and never baked into the exemplar-hunt query
// as an incidental subject (surf.js's own documented finding: an incidental
// subject in the exemplar query pulls in subject-matter pages, not form
// examples) — it is instead tracked as its OWN declared field throughout.
const STANCE_RE = /\s+for\s+(the\s+)?([a-z][a-z0-9 '&-]{1,40}?)(\s+(sector|industry|market|audience|space|field|context))?\s*$/i;

/** A trailing "for the X …" clause, mechanically split off — null when the
 *  prompt states no stance. */
export function extractStance(text) {
  const noUrls = String(text ?? "").replace(URL_RE, "").replace(TRAILING_EXAMPLE_REF, "");
  const m = STANCE_RE.exec(noUrls);
  if (!m) return null;
  const stance = m[2].trim();
  return stance.length && stance.length <= 40 ? stance : null;
}

/** Mechanical: a topic is the prompt with any URLs, a trailing stance
 *  clause, and a fixed set of leading verb/filler words stripped one at a
 *  time, plus a trailing "like this…" example-reference dropped, kept only
 *  if what's left is short, has no sentence punctuation, and doesn't open
 *  like a greeting or a sentence about the person themselves. */
export function extractTopic(text) {
  let s = String(text ?? "").replace(URL_RE, "").replace(TRAILING_EXAMPLE_REF, "").replace(STANCE_RE, "").trim();
  let changed = true;
  while (changed) { changed = false; for (const re of LEADING) { const next = s.replace(re, ""); if (next !== s) { s = next.trim(); changed = true; } } }
  const stripped = s.replace(/[.!?]+$/, "").trim();
  if (!stripped.length || stripped.length > 60 || /[.!?]/.test(stripped) || NOT_A_TOPIC.test(stripped)) return null;
  return stripped;
}

export const AGENT_MAX_TURNS = 4;

/**
 * stepExpertiseAgent(state, { message, draw, huntOverride }) →
 *   { state, status: "needs-topic"|"needs-more"|"learned"|"gave-up", question?, summary?, result? }
 *
 * `state` is whatever this function last returned as `.state` (or null on
 * the first call) — the caller (an HTTP route, a CLI loop, a test) owns
 * persisting it between turns; nothing here is stored server-side by this
 * module itself. `onEvent`, when given, is forwarded to runLearnPass (a
 * caller that already broadcasts progress, e.g. the surface, can watch the
 * agent's hunt the same way it watches a manual /learn pass).
 */
export async function stepExpertiseAgent(state, { message, draw, huntOverride = null, onEvent = undefined } = {}) {
  if (typeof draw !== "function") throw new TypeError("stepExpertiseAgent: draw (the local model's own call) is declared");
  const links = [...new Set(String(message ?? "").match(URL_RE) ?? [])];
  const st = { topic: state?.topic ?? null, stance: state?.stance ?? null, sourceUrls: [...(state?.sourceUrls ?? [])], populationUrls: [...(state?.populationUrls ?? [])], turns: (state?.turns ?? 0) + 1 };

  if (!st.topic) {
    const t = extractTopic(message);
    if (t) st.topic = t;
  }
  if (!st.stance) {
    const s = extractStance(message);
    if (s) st.stance = s;
  }
  if (links.length) {
    // Whichever turn supplies links — even the one that also names the
    // topic — the first batch becomes the examples; once examples exist,
    // a later batch becomes the ground. Mechanical, not modeled.
    if (!st.sourceUrls.length) st.sourceUrls.push(...links);
    else st.populationUrls.push(...links);
  }

  if (!st.topic) {
    const ask = `The person said: "${String(message ?? "").slice(0, 300)}". No form or topic name could be read from it. In one short, plain sentence, ask them what form or topic they want you to develop expertise on.`;
    const question = String(await draw([{ role: "user", content: ask }], 80) ?? "").trim();
    return { state: st, status: "needs-topic", question };
  }

  if (st.turns > AGENT_MAX_TURNS) {
    return { state: st, status: "gave-up", question: null, basis: `${AGENT_MAX_TURNS} turns without enough material for "${st.topic}" — stopping rather than asking forever` };
  }

  const pass = huntOverride ? await huntOverride(st) : await runLearnPass({ topic: st.topic, stance: st.stance, sourceUrls: st.sourceUrls, populationUrls: st.populationUrls, source: `agent:${st.topic}`, ...(onEvent ? { onEvent } : {}) });

  if (pass.refused) {
    const fact = pass.reason === "under_powered"
      ? `The hunt (search plus any links given) found only ${pass.instances} real example(s) of "${st.topic}" — it needs at least 5.`
      : pass.reason === "no_null"
      ? `The hunt found ${pass.instances} example(s) of "${st.topic}" but only ${pass.population} comparison text(s) — it needs at least 5, as a relative ground to measure the shape against.`
      : `The measurement itself was refused: ${pass.basis}`;
    const ask = `${fact} In one short, plain sentence, ask the person for a couple of real links (or a more specific or more common form name) to move forward.`;
    const question = String(await draw([{ role: "user", content: ask }], 80) ?? "").trim();
    return { state: st, status: "needs-more", question, found: { instances: pass.instances, population: pass.population } };
  }

  const fact = `Just learned "${st.topic}": ${pass.status}${pass.confirmed ? ", CONFIRMED" : ""}, corroborated by ${pass.corroboration}, from ${pass.instances} real example(s) measured against ${pass.population} comparison text(s).`;
  const ask = `${fact} Tell the person this, in one short, plain sentence.`;
  const summary = String(await draw([{ role: "user", content: ask }], 80) ?? "").trim();
  return { state: st, status: "learned", summary, result: pass };
}
