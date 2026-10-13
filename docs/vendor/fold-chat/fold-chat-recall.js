// fold-chat-recall.js — "what did you tell me earlier?" answered from the CLAIM STORE, with no search and no model. Pure.
//
//   recallAsk(question)                 is the ask about what the FOLD ITSELF said before? → { about } | null.  English, DECLARED.
//   recallOf({ question, claims })      the claims it said (verbatim, at their addresses) → { turn, address, claims, text } | null
//
// The store (s.claims, fold-chat-record.js → khora FoldRecord@1) holds every sentence the fold spoke or showed, verbatim, at /t<turn>/c<i>.
// A repeat ask is a READ at an address (khora foldAt), never a lookup and never a rewrite: the words returned are the words said. With nothing
// stored, or nothing that bears on "about X", the result is null and the turn goes the normal way (it is never answered from a guess).
//
// DECLARED, not measured (Constitution II.11): the English patterns and the one framing clause. Giver: the author's draft, 2026-10-06.
import { claimsAt, turnAddress } from "./fold-chat-record.js";
import * as ground from "./fold-chat-ground.js";

const END = "\\s*[?.!]*$";
const WHEN = "(?:earlier|before|previously|just now|a (?:moment|minute|second) ago|last time)";
const PATTERNS = Object.freeze([
  new RegExp("^(?:so\\s+)?what\\s+(?:did|have)\\s+you\\s+(?:just\\s+)?(?:tell|told|say|said)(?:\\s+me)?(?:\\s+about\\s+(?<about>.+?))?(?:\\s+" + WHEN + ")?" + END, "i"),
  new RegExp("^(?:can|could)\\s+you\\s+(?:please\\s+)?(?:repeat|say)\\s+(?:that|what\\s+you\\s+(?:just\\s+)?said)(?:\\s+again)?" + END, "i"),
  new RegExp("^(?:please\\s+)?repeat\\s+(?:that|what\\s+you\\s+(?:just\\s+)?said|your\\s+(?:last|previous)\\s+(?:answer|reply))" + END, "i"),
  new RegExp("^what\\s+was\\s+your\\s+(?:last|previous|earlier)\\s+(?:answer|reply|response)" + END, "i"),
]);

export function recallAsk(question) {
  const q = String(question ?? "").trim().replace(/\s+/g, " ");
  if (!q || q.length > 120) return null;
  for (const re of PATTERNS) { const m = q.match(re); if (m) return { about: m.groups?.about ? m.groups.about.trim() : null }; }
  return null;
}

const turnsOf = (claims) => [...new Set((claims || []).map((c) => Number(String(c.ground).match(/^\/t(\d+)\//)?.[1])).filter(Boolean))].sort((a, b) => a - b);

/** `fw`: the language's closed class (to find the content words of "about X"); omitted → every word counts. */
export function recallOf({ question = "", claims = [], fw = null, asks = null } = {}) {   // asks: Map<turn, the ask that turn answered> (summary.records[].forWhom) — a fact-bearing sentence rarely names its topic, the ask did
  const ask = recallAsk(question);
  if (!ask || !claims.length) return null;
  const turns = turnsOf(claims);
  if (!turns.length) return null;
  let turn = turns[turns.length - 1];
  if (ask.about) {
    const want = new Set(ground.tokenize(ask.about).filter((t) => t.length > 1 && !(fw && fw.has(t))));
    if (!want.size) return null;
    // a turn matches on its SAID words or on the ASK it answered; the most content words in common wins (not simply the latest turn), and a tie between turns is returned as ambiguous, not guessed
    const score = (n) => { const bag = new Set([...claimsAt(turnAddress(n), claims).flatMap((c) => ground.tokenize(c.roles.ARG1)), ...(asks ? ground.tokenize(String(asks.get(n) || "")) : [])]); return [...want].filter((t) => bag.has(t)).length; };
    const best = Math.max(0, ...turns.map(score));
    const hit = best >= Math.ceil(want.size / 2) && [...turns].reverse().find((n) => score(n) === best);   // half of what was named must be there: "the Leaning Tower of Pisa" is not answered by "the Eiffel Tower" on the one shared word
    if (!hit) return null;   // nothing the fold said bears on it: not answered from a guess — the ask goes the normal way
    turn = hit;
  }
  const said = claimsAt(turnAddress(turn), claims);
  if (!said.length) return null;
  return { turn, address: turnAddress(turn), claims: said, text: `On turn ${turn} I said: ${said.map((c) => c.roles.ARG1).join(" ")}` };
}
