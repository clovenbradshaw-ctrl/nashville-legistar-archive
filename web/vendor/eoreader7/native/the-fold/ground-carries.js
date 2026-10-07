// ground-carries.js — HANDED-OVER MATERIAL IS THE GROUND FOR AN ASK ONLY IF IT CARRIES THE ASK'S SUBJECT (2026-09-30).
//
// hunt.js earns admission for FETCHED pages paragraph by paragraph and leaves the operator's material whole, "ground
// by being handed over" (tier 0). That holds when the ask is about the material. It said nothing about an ask whose
// subject the material never mentions: two document jobs over one handed-over file wrote a bicycle answer four
// sentences long out of a file about Katherine Johnson (measured 2026-09-30). Building a ground is not taking what
// is handed over; it is finding out whether it bears on the ask, and saying so when it does not.
//
// The rule, a definition and no tuned number: the ask's SUBJECT is the content words of its subject phrase (function
// words dropped by the engine's own isFunctionWord). The material CARRIES the subject when it carries MORE THAN HALF
// of those words — one carried word is not enough ("still" is in the Johnson file and in the bicycle ask). With no
// subject to carry, everything handed over is ground, as before. When the subject is carried, the ground is the
// documents carrying any word the material carries; when it is not, no document is admitted and every refusal is
// written with the count that refused it.
//
// Limit, stated: matching is by the engine's word form (draftWords: lowercased, stemmed), one form per word. An ask
// phrased in words the material never uses ("automobile" over a file that says "car") reads as not carried. The
// refusal names the words it did and did not find, so the mismatch is visible, never silent.
//
// Scope, stated (Greenberg): the word form is draftWords' stem and the function-word test is pos-prior's classes — the
// engine's ENGLISH prior today. For a language the engine holds no prior for, a function word is not dropped and a stem is
// the surface form, so a subject phrase in that language is counted with its function words and "more than half" is harder
// to reach: the failure is to refuse (and name what was looked for), not to admit. A language-general subject test would
// take the prior from the material's own measured vocabulary (admission.js); that is unbuilt.
//
// No model call. No threshold. No language list.
import { draftWords } from "./eot-draft.js";
import { isFunctionWord } from "./pos-prior.js";

export const GROUND_CARRIES_SCHEMA = "EOGroundCarries@1";

export const subjectWordsOf = (topic) => [...new Set(draftWords(String(topic ?? "")).filter((w) => !isFunctionWord(w)))];

/**
 * admitHandedOver({ docs, topic }) → EOGroundCarries@1
 *   docs   [{ id, text }]  the operator's material for this ask
 *   topic  the ask's subject phrase (proxy-runner's topicPhrase(task))
 */
export function admitHandedOver({ docs = [], topic = null } = {}) {
  const words = subjectWordsOf(topic);
  const sets = docs.map((d) => ({ d, has: new Set(draftWords(String(d.text ?? ""))) }));
  if (!words.length) {
    return { schema: GROUND_CARRIES_SCHEMA, mode: "no-subject", words, carried: [], coverage: { carried: 0, total: 0 }, admitted: docs.map((d) => ({ id: d.id, carries: [] })), refused: [], basis: "the ask names no subject: everything handed over is ground" };
  }
  const carried = words.map((w) => ({ word: w, docs: sets.filter((s) => s.has.has(w)).length }));
  const got = carried.filter((c) => c.docs > 0).map((c) => c.word);
  const coverage = { carried: got.length, total: words.length };
  const list = (ws) => (ws.length ? ws.join(", ") : "none");
  const missing = carried.filter((c) => c.docs === 0).map((c) => c.word);
  if (got.length * 2 <= words.length) {
    const why = `carries ${got.length} of ${words.length} of the ask's words (found: ${list(got)}; not found: ${list(missing)}), not more than half`;
    return {
      schema: GROUND_CARRIES_SCHEMA, mode: "not-carried", words, carried, coverage, admitted: [],
      refused: docs.map((d) => ({ id: d.id, why })),
      basis: `the handed-over material ${why}`,
    };
  }
  // The documents: those carrying MORE THAN HALF of the words the material carries (a word of the ask that also turns up
  // in an unrelated file — "set" in a file about a mathematician — does not admit it), then, if some carried word is
  // still carried by no admitted document, the fewest further documents that cover it, most-covering first. A question
  // spread over two documents (one holds "auditors" and "police", the other "budget") therefore gets both.
  const mineOf = (has) => got.filter((w) => has.has(w));
  const admittedSet = new Set(sets.filter(({ has }) => mineOf(has).length * 2 > got.length).map(({ d }) => d.id));
  const covered = new Set(sets.filter(({ d }) => admittedSet.has(d.id)).flatMap(({ has }) => mineOf(has)));
  for (;;) {
    const uncovered = got.filter((w) => !covered.has(w));
    if (!uncovered.length) break;
    const best = sets.filter(({ d }) => !admittedSet.has(d.id)).map((x) => ({ ...x, gain: uncovered.filter((w) => x.has.has(w)) })).filter((x) => x.gain.length).sort((a, b) => b.gain.length - a.gain.length)[0];
    if (!best) break;
    admittedSet.add(best.d.id); for (const w of best.gain) covered.add(w);
  }
  const admitted = [], refused = [];
  for (const { d, has } of sets) {
    const mine = mineOf(has);
    if (admittedSet.has(d.id)) admitted.push({ id: d.id, carries: mine });
    else refused.push({ id: d.id, why: `carries ${mine.length} of the ${got.length} word(s) of the ask that the material carries (${list(mine)}), not more than half, and nothing the admitted documents do not already carry` });
  }
  return { schema: GROUND_CARRIES_SCHEMA, mode: "carried", words, carried, coverage, admitted, refused, basis: `the handed-over material carries ${got.length} of ${words.length} of the ask's words (${list(got)}${missing.length ? `; not found: ${list(missing)}` : ""})` };
}
