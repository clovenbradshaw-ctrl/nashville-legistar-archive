// elenchus.js — Socrates, the archon of the standing question: a non-AGREE
// standing is converted into a NAMED QUESTION BACK, never into a manufactured
// answer and never into silence.
//
// Handle: Socrates, as Plato's early ("aporetic") dialogues actually show him
// working — never the folk-memory version. He never supplies the missing
// premise: he asks for a definition (Euthyphro: "what is piety, itself?"),
// produces one counter-instance that survives the interlocutor's own stated
// criterion, and stops at aporia — the declared, named state of not-yet-
// knowing — rather than handing over a replacement belief. The dialogues that
// end this way (Euthyphro, Laches, Charmides, Republic I) are not failures of
// the form; the aporia IS the delivered result.
//
// WHAT HE IS NOT. He is not a second corroboration counter — that is
// mergeTestimony's job, and this module never re-derives it, exactly as
// crown.js never re-derives a verdict it only renders. He is not a
// personality or a tone — the ethos-corpus role-carriers own grounded voice.
// He is a GATE ON THE RENDER, beside crown.js the way Gary sits beside the
// builders: he reads a MergeVerdict (and an optional questionCycle result),
// and he can add exactly one thing to what ships — a question from a closed,
// cited bank — and he can REFUSE a render that tries to skip it.
//
// THE CLOSED BANK, cited to the move it comes from (never free-generated).
// Same discipline as Gary's RULES and crown's KNOWN_CONNECTIVES: a small,
// declared, testable list, each entry citing its Platonic source so the bank
// itself is auditable rather than vibes. Five rows. No sixth. A caller that
// wants a different phrasing is refused — the closed vocabulary is the
// load-bearing part, not the wording.
//
// NAMED WITNESSES. A question that names a witness fills the slot with that
// witness's own `who` string VERBATIM from the merge — never a paraphrase,
// the same rule crown.js already holds for witness names. Where several
// witnesses could fill the slot, an ADDRESSED one (a reading whose `read`
// carries at least one address — a real source's bytes, not the model's own
// head) is preferred over an unaddressed one; the first of the preferred
// kind wins. Disclosed limit: readings carry no channel typing
// (corpus/web/file/desk), so "prefer the archival witness" is implemented
// as "prefer the addressed witness" — the archival-vs-secondary
// distinction is named future work, not silently claimed (P244).
//
// PURE: no fetch, no DOM, no storage, no imports. The bank, the picker, and
// the gate — every caller (crown.js's render seam, the tests, a future turn-
// level cycle display) reads the same three exports.

export const ELENCHUS = { handle: "Socrates", organ: "elenchus", law: "a standing that is not AGREE ships with its question, never as a claim" };

// Slot markers are filled verbatim from the merge — they are never prose a
// caller composes. `fillSlots` only substitutes the two declared slots;
// anything else rides through untouched, so a witness literally named
// "[x]" cannot break the closed set (the id is what the gate checks).
const WITNESS_SLOT = "[the witness]";
const PREMISE_SLOT = "[the cycle's first premise]";

function fillSlots(template, { witness = null, premise = null } = {}) {
  let out = String(template ?? "");
  if (witness != null) out = out.split(WITNESS_SLOT).join(String(witness));
  if (premise != null) out = out.split(PREMISE_SLOT).join(String(premise));
  return out;
}

export const ELENCHUS_BANK = Object.freeze([
  Object.freeze({
    id: "elenchus-definition",
    firesOn: "SINGLE",
    cites: "Euthyphro 6d–11b (ask for the definition: what would make it true, itself)",
    template: "What's the case *for* this, on its own — not what agrees with it, but what would make it true?",
  }),
  Object.freeze({
    id: "elenchus-counterinstance",
    firesOn: "DISAGREE",
    cites: "Republic I, 331c–336a (one counter-instance against the stated criterion)",
    template: `Here's a reading that holds the opposite. What would have to be true of ${WITNESS_SLOT} for it to be the one that's wrong?`,
  }),
  Object.freeze({
    id: "elenchus-aporia",
    firesOn: "UNDETERMINED",
    cites: "Meno 80a–d (the torpedo-fish passage — naming the stuck state itself, not curing it)",
    template: "Nothing here settles it yet. That's the honest place to be — what would actually settle it, if you went and looked?",
  }),
  Object.freeze({
    id: "elenchus-unanimous-refusal",
    firesOn: "CONTRADICTED",
    cites: "Apology 21b–23b (the oracle story: refusing to defer to a claim's reputation over checking it)",
    template: `Every witness here refuses this — including ${WITNESS_SLOT}. What made it seem plausible before you checked?`,
  }),
  Object.freeze({
    id: "elenchus-question-begs-itself",
    firesOn: "questionCycle(question) !== null (logos.js — the question's own claims already form a cycle)",
    cites: "Republic I, 336e–338b (Thrasymachus's definition presupposing its own conclusion)",
    template: `This only follows if ${PREMISE_SLOT} is already granted — is it, or is that the actual thing in question?`,
  }),
]);

const BANK_BY_ID = new Map(ELENCHUS_BANK.map((row) => [row.id, row]));
export function elenchusRow(id) {
  return BANK_BY_ID.get(id) ?? null;
}

// Prefer an addressed witness (a reading with somewhere to point), first of
// that kind wins; otherwise the first witness, verbatim. Never a paraphrase,
// never a guess at which source is "strongest" — order is the merge's own.
function pickWitness(readings) {
  const list = Array.isArray(readings) ? readings : [];
  if (!list.length) return null;
  const addressed = list.find((r) => Array.isArray(r?.read) && r.read.length > 0);
  const chosen = addressed ?? list[0];
  return typeof chosen?.who === "string" && chosen.who ? chosen.who : null;
}

/**
 * questionFor(merged, { cycle } = {}) — the one question this standing earns.
 * `merged` is mergeTestimony's own return value. `cycle` is logos.js's
 * questionCycle result (null/undefined = none found or not checked — the
 * caller's own tri-state, never re-derived here). Returns
 * `{ id, cites, text }` — text with slots filled verbatim — or null when the
 * standing is AGREE (corroborated testimony needs no question back).
 * A cycle takes precedence over the case row: a self-grounding question is
 * the structural fault, whatever the testimony said.
 */
export function questionFor(merged, { cycle = null } = {}) {
  const c = merged?.case ?? "UNDETERMINED";
  if (cycle != null) {
    const row = BANK_BY_ID.get("elenchus-question-begs-itself");
    const premise =
      (Array.isArray(cycle?.cycle) && cycle.cycle.length ? String(cycle.cycle[0]) : null) ??
      (typeof cycle?.detail === "string" && cycle.detail ? cycle.detail : "its own conclusion");
    return { id: row.id, cites: row.cites, text: fillSlots(row.template, { premise }) };
  }
  if (c === "AGREE") return null;
  if (c === "SINGLE") {
    const row = BANK_BY_ID.get("elenchus-definition");
    return { id: row.id, cites: row.cites, text: row.template };
  }
  if (c === "DISAGREE") {
    const row = BANK_BY_ID.get("elenchus-counterinstance");
    const witness = pickWitness(merged?.refused) ?? pickWitness(merged?.holds) ?? "the refusing source";
    return { id: row.id, cites: row.cites, text: fillSlots(row.template, { witness }) };
  }
  if (c === "CONTRADICTED") {
    const row = BANK_BY_ID.get("elenchus-unanimous-refusal");
    const witness = pickWitness(merged?.refused) ?? "its strongest witness";
    return { id: row.id, cites: row.cites, text: fillSlots(row.template, { witness }) };
  }
  // UNDETERMINED and the defensive floor (an unrecognized case — crown.js
  // renders those as UNDETERMINED too, and the safe direction to fail in is
  // the named gap, never a confident question about a case never seen).
  const row = BANK_BY_ID.get("elenchus-aporia");
  return { id: row.id, cites: row.cites, text: row.template };
}

/**
 * gateCrown(merged, question, { cycle } = {}) — the structural rule, not an
 * advisory one: a render whose case is anything other than AGREE and that
 * does not carry the Socrates question for that standing is REFUSED. Never
 * throws; returns `{ ok, refused }` — refused is null when ok, else a typed
 * `{ rule, severity, cites, detail }` in Gary's own finding shape, so the
 * caller decides and the record says the gate objected (P186's posture:
 * a gap is returned, never thrown away).
 *
 * Closed both ways: an unknown id is refused (no sixth row), and a right
 * id with reworded text is refused too — the text must equal the bank
 * template with the merge's own verbatim fills, recomputed here rather than
 * trusted from the caller.
 */
export function gateCrown(merged, question, { cycle = null } = {}) {
  const c = merged?.case ?? "UNDETERMINED";
  if (c === "AGREE") return { ok: true, refused: null };
  const expected = questionFor(merged, { cycle });
  if (!question || typeof question !== "object" || !BANK_BY_ID.has(question?.id)) {
    return {
      ok: false,
      refused: {
        rule: "socrates-required",
        severity: "refuse",
        cites: "P244",
        detail: `a ${c} standing ships with its Socrates question (${expected.id}) — none was carried`,
      },
    };
  }
  if (question.id !== expected.id || question.text !== expected.text) {
    return {
      ok: false,
      refused: {
        rule: "socrates-required",
        severity: "refuse",
        cites: "P244",
        detail: `a ${c} standing ships with ${expected.id} verbatim — got ${question.id ?? "no id"} with non-bank text`,
      },
    };
  }
  return { ok: true, refused: null };
}
