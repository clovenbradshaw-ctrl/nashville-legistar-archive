// steer.js — THE MOUTH STEERS SOME PHYSICS (2026-09-21).
//
// The user: "I think we need the mouth to steer some physics." The
// arrangement's mechanics could not tell an audit's FINDING from a
// committee's RESPONSE (OHS, lesson 66): words do not separate them, the act
// a passage reports does, and a mouth reads that act without an organ for it.
// So the mouth is given a vote — as one force among the mechanical ones,
// never the decision:
//
//   - It answers in plain words. It never emits a schema. Its answer is mapped
//     MECHANICALLY: which of the ask's questions its reply echoes, or whether
//     it says yes or no.
//   - Low sets possibility, high sets probability. The mouth's vote PROPOSES
//     a move; the mechanics LICENSE it only when nothing contradicts it — two
//     sections merge only if they share a claim word and the merge inverts no
//     extent; a section is placed under a question only if the reply echoes
//     that question more than any other.
//   - Every vote lands on the record, kept or refused, with its reason — the
//     disagreements between mouth and mechanics are data (the parliament of
//     witnesses), never silently resolved.
//
// Two forces are steered:
//   QUESTION: when the ask coordinates several questions ("what the audit
//     found … and how the committee responded"), each body section is asked
//     which one it helps answer, and the outline is regrouped question by
//     question in the ask's order, the material's order kept within each.
//   COHESION: each pair of neighbouring body sections (under the same
//     question) is asked whether it belongs in one section of the essay.

import { draftWords, drawnParts } from "./eot-draft.js";
import { extentOf } from "./arrange.js";
import { isFunctionWord } from "./pos-prior.js";

export const STEER_SCHEMA = "EOSteer@1";

/** The ask's coordinated questions: the topic phrase split at "and" before a
 *  question word (a closed class). One question → an array of one. */
export function askQuestions(task) {
  const phrase = String(task ?? "").match(/\b(?:on|about|of|regarding|concerning)\s+(.+?)[.?!]*$/i)?.[1] ?? "";
  if (!phrase) return [];
  return phrase.split(/\s*,?\s+and\s+(?=(?:what|how|why|when|where|who|whom|whose|whether|which)\b)/i).map((q) => q.trim()).filter(Boolean);
}

const content = (t) => draftWords(t).filter((w) => !isFunctionWord(w));

/** Which question does a reply echo? The one whose own content words the reply
 *  repeats most — and only if strictly more than any other; else none. */
export const NEITHER = -2;
export function echoedQuestion(reply, questions) {
  // "Neither" is an answer: the text helps answer none of the questions.
  if (/\b(neither|none)\b/i.test(String(reply ?? ""))) return NEITHER;
  const said = new Set(draftWords(reply));
  const score = questions.map((q) => {
    const own = content(q).filter((w) => !questions.some((o) => o !== q && content(o).includes(w)));
    return own.filter((w) => said.has(w)).length;
  });
  const top = Math.max(...score);
  if (top <= 0 || score.filter((x) => x === top).length > 1) return -1;
  return score.indexOf(top);
}

/** A yes or no, read from the reply's first word that is one. */
export function yesNo(reply) {
  // Both words present is a hedge ("Yes and no"), not an answer; a negated
  // reply with neither word ("Not really.") is a no (falsifier, 2026-09-21).
  const t = String(reply ?? "").toLowerCase();
  const y = /\byes\b/.test(t), n = /\bno\b/.test(t) || /^\W*not\b/.test(t);
  return y && n ? null : y ? true : n ? false : null;
}

const quote = (s) => `"${String(s).replace(/\s+/g, " ").trim()}"`;

/**
 * steerOutline({ outline, draft, task, draw }) → { outline, votes, schema }
 * `draw(messages, maxTokens)` is the mouth. Returns a NEW outline; the input
 * is not touched. Without a draw, the outline is returned unchanged with the
 * gap stated.
 */
export async function steerOutline({ outline, draft, task = "", draw = null, onVote = null } = {}) {
  const votes = [];
  const record = (v) => { votes.push(v); onVote?.(v); };
  if (typeof draw !== "function" || !outline?.slots) return { schema: STEER_SCHEMA, outline, votes, weakened: ["no mouth: the outline stands as the mechanics left it"] };
  const text = new Map(drawnParts(draft).flatMap((p) => p.children.map((pt) => [pt.id, pt.text])));
  const order = new Map([...text.keys()].map((id, i) => [id, i]));
  const passage = (slot) => slot.statements.map((id) => text.get(id)).filter(Boolean).join(" ");
  // About the ask, by the mechanics' own measure: names a being the ask names,
  // or shares a content word with the ask's questions.
  const R = draft?.referents ?? null;
  const askBeings = R ? R.resolveText(task) : new Set();
  const askWords = new Set(askQuestions(task).flatMap((q) => content(q)));
  const aboutAsk = (slot) => {
    const t = passage(slot);
    if (R && [...R.resolveText(t)].some((id) => askBeings.has(id))) return true;
    return content(t).some((w) => askWords.has(w));
  };
  const ask = async (u, n = 60) => { try { return String(await draw([{ role: "user", content: u }], n) ?? ""); } catch (e) { return ""; } };

  const head = outline.slots.filter((s) => s.slot === "thesis");
  const tail = outline.slots.filter((s) => s.slot === "return");
  let bodies = outline.slots.filter((s) => s.slot !== "thesis" && s.slot !== "return").map((s) => ({ ...s }));

  // ── QUESTION
  const questions = askQuestions(task);
  if (questions.length > 1) {
    // ONE QUESTION AT A TIME, YES OR NO. Listing the questions and asking
    // which one let position decide: on the OHS dossier gemma2:2b named
    // whichever question came first, in either order (17 of 22 two-order
    // readings disagreed — measured). Asked about each question alone there
    // is no order to follow. A section is placed under a question only when
    // it gets yes to that one and no to every other; yes to several or to
    // none places nothing, and no to all proposes "neither".
    const askOne = async (s, q) => yesNo(await ask([`Here is a text from the sources of an essay:\n${quote(passage(s))}`, `Does this text help answer: ${q}? Answer yes or no.`].join("\n\n"), 12));
    for (const s of bodies) {
      const answers = [];
      for (const q of questions) answers.push(await askOne(s, q));
      const yes = answers.map((a, i) => (a === true ? i : -1)).filter((i) => i >= 0);
      const reply = questions.map((q, i) => `${i + 1}: ${answers[i] === true ? "yes" : answers[i] === false ? "no" : "?"}`).join(" · ");
      if (answers.every((a) => a === false)) {
        // SELECTION, STEERED: no to every question proposes dropping the
        // section; the mechanics license the drop only when it is not about
        // the ask by their own measure. A mouth's "no" never removes
        // material alone.
        const drop = !aboutAsk(s);
        s.question = drop ? NEITHER : -1;
        record({ force: "selection", slot: s.slot, statements: s.statements, reply, kept: drop, why: drop ? "no to every question, and it names nothing the ask names: left out of the piece" : "no to every question, but it names what the ask names: kept" });
        continue;
      }
      const q = yes.length === 1 && answers.every((a, i) => i === yes[0] || a === false) ? yes[0] : -1;
      s.question = q;
      record({ force: "question", slot: s.slot, statements: s.statements, reply, kept: q >= 0, to: q >= 0 ? questions[q] : null, why: q >= 0 ? `yes to question ${q + 1} alone` : yes.length > 1 ? "yes to more than one question: the section stays where the mechanics put it" : "no clear answer: the section stays where the mechanics put it" });
    }
    bodies = bodies.filter((s) => s.question !== NEITHER);
    // Unplaced sections join the question of the section before them (the
    // material's own neighbourhood), or the first question if none precedes.
    let last = 0;
    for (const s of bodies) { if (s.question >= 0) last = s.question; else s.question = last; }
    bodies = questions.flatMap((_, qi) => bodies.filter((s) => s.question === qi).sort((a, b) => order.get(a.statements[0]) - order.get(b.statements[0])));
  }

  // ── COHESION
  // The license is a LOW bar under the mouth's yes: any shared content word.
  // Stripping the material's spread words refused a right merge ("county",
  // "river" in a short one-topic ground — falsifier).
  const claim = (s) => new Set(draftWords(passage(s)).filter((w) => !isFunctionWord(w)));
  const span = (s) => { const ys = s.statements.flatMap((id) => extentOf(text.get(id))); return ys.length ? [Math.min(...ys), Math.max(...ys)] : null; };
  for (let i = 0; i + 1 < bodies.length;) {
    const a = bodies[i], b = bodies[i + 1];
    if ((a.question ?? 0) !== (b.question ?? 0)) { i++; continue; }
    const u = [`Two texts from the sources of an essay${questions.length ? ` on ${questions.join(" and ")}` : ""}:`, `A. ${quote(passage(a))}`, `B. ${quote(passage(b))}`, `Do A and B belong in the same section of the essay? Answer yes or no, then give the reason in one sentence.`].join("\n\n");
    const reply = await ask(u, 60);
    const yes = yesNo(reply);
    const A = claim(a), B = claim(b);
    const shared = [...A].filter((w) => B.has(w));
    const sa = span(a), sb = span(b);
    const inverts = sa && sb && sb[1] < sa[0];
    let kept = false, why;
    if (yes !== true) why = yes === false ? "the mouth says they are separate" : "no yes or no in the reply";
    else if (!shared.length) why = "the mouth says one section, but they share no claim word: refused";
    else if (inverts) why = "the mouth says one section, but B ends before A begins: refused";
    else { kept = true; why = `merged: the mouth says one section, and they share ${shared.slice(0, 4).join(", ")}`; }
    record({ force: "cohesion", slots: [a.slot, b.slot], reply: reply.trim(), kept, why });
    if (kept) {
      const statements = [...a.statements, ...b.statements].sort((x, y) => order.get(x) - order.get(y));
      bodies.splice(i, 2, { ...a, statements, beings: [...new Set([...(a.beings ?? []), ...(b.beings ?? [])])], sources: [...new Set([...(a.sources ?? []), ...(b.sources ?? [])])], extent: span({ statements }), basis: `${a.basis}; joined with the next section on the mouth's vote` });
    } else i++;
  }
  // A real role name (arrangeEssay's roleVocabulary, e.g. "solution") is kept
  // as-is — only a slot that is STILL the generic "body N" shape is
  // renumbered here, so a merge or drop that shifted indices stays correct
  // without silently discarding a real label (measured live 2026-09-24: this
  // pass used to overwrite every non-tension slot unconditionally).
  bodies = bodies.map((s, i) => ({ ...s, slot: s.slot === "tension" ? "tension" : /^body \d+$/.test(s.slot ?? "") ? `body ${i + 1}` : s.slot, ...(questions.length > 1 ? { answers: questions[s.question ?? 0] } : {}) }));
  return {
    schema: STEER_SCHEMA,
    outline: { ...outline, slots: [...head, ...bodies, ...tail], steered: true, basis: `${outline.basis}; steered by the mouth: ${votes.filter((v) => v.kept).length} of ${votes.length} vote(s) licensed` },
    votes, questions,
  };
}
