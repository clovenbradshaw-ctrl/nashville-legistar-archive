// native/organs/socratic.js — HOW the reader gives its account of a decline.
// Handle: Kierkegaard — indirect communication: the teacher does not hand the
// pupil the conclusion, they arrange for the pupil to arrive at it; "to help
// another, one must first understand what he understands... meet him where he
// is." A verdict handed over as a labeled diagnosis is not met; it is filed.
//
// THE PROBLEM THIS FIXES. The judgment (askshape.js, ethos.js) reasons in the
// reader's own working vocabulary — SHAPE, FORECLOSE, STANDPOINT, WITNESS —
// because that vocabulary is what lets the kernel stay medium-blind and the
// judgment stay checkable. That vocabulary is exactly wrong to hand to the
// person or agent on the other end: it reads as a cold verdict from a machine,
// not an answer from a reader that noticed something. This organ is the seam
// between the two — it takes the judgment and composes the ACCOUNT, in plain
// language, addressed to whoever is actually there.
//
// THE CELL. Composing the utterance FROM an already-judged shape is REC (Generate)
// in the Interpretation domain, at Figure grain — REC·Figure, the Generate-mode
// twin of the DEF·Figure cell perspective.js and interlocutor.js occupy: not
// judging the claim, but giving the account of one already-judged claim, to one
// particular holder. It lands on the same Lens terrain.
//
// THE DISCIPLINE (Buber, carried from interlocutor.js): the interlocutor's kind
// selects the REGISTER the same truth is spoken in, never the truth itself. A
// person and an agent are told the SAME real reason and offered the SAME real
// alternative; only the idiom differs — a question for the one who can be moved
// by being asked, reasons-and-a-principal for the one that can complete a valid
// argument and act on it. This is Socratic, not persuasive: nothing here is
// engineered to produce compliance by any means other than the reasons being
// good ones. Withholding the true reason from either register, or dressing up
// manipulation as a "question", is the one thing this module must never do.
//
// THE EXACT REASON STAYS ON THE RECORD. `clearance.reason` and `shape` are
// unchanged by this module — they still ride the ledger, the shadow trail, and
// onNote exactly as before. Only the text a person or agent actually READS is
// composed here; the audit trail keeps the precise judgment.
//
// THE ARCHON VOICES. Each path opens with the archon whose work grounds the
// specific shape that fired, in their own language — not as a citation, but as
// the thought already present in what the reader does. The quote is the response;
// no explicit refusal precedes it. The person or agent arrives at the reason;
// the reader does not hand it over as a verdict.
//
// Fine-grained archon selection by shape arm:
//
//   selfForeclose  → Buber (German) — „Alles wirkliche Leben ist Begegnung."
//                     All real life is encounter. (Ich und Du, 1923)
//                     The self-harm case: encounter is the answer, not the means.
//
//   override       → Ulysses (Greek, Homer) —
//                     «δεῦρ᾽ ἄγ᾽ ἰὼν πολύαιν᾽ Ὀδυσεῦ» — "come this way,
//                     much-praised Odysseus" (Odyssey XII). The Sirens sang and
//                     were heard; obeying them was never the point.
//
//   forecloses     → Levinas (French) — «Le visage d'autrui m'oblige.»
//   (scale)          The other's face obligates before any concern of mine.
//                     (Totalité et infini, 1961) + Mahavira (Sanskrit) —
//                     anekāntavāda: every perspective holds what others cannot;
//                     losing one impoverishes all.
//
//   humanity       → Levinas (French) — «Traiter autrui comme un objet, c'est
//   (dehumanize)     nier son visage.» — to refuse the face, to reduce a person
//                     to a category or vermin. The face is the moral claim itself.
//
//   autonomy &&    → Brandeis (English) — "The right to be let alone — the most
//   capability       comprehensive of rights, and the right most valued by
//   (surveillance)   civilized men." (Olmstead v. United States, 1928).
//                     Covert acts on a person without their knowledge.
//
//   harmful        → Levinas (French) — «Traiter autrui comme un objet, c'est
//   (general)        nier son visage.» — the face denied through a harmful
//                     instrument or capability built against another.
//
//   norm           → Solon (Greek) — εὐνομία — the good ordering a community
//                     holds not as mere prohibition but because it would be
//                     diminished without it.

import { KIND } from "./interlocutor.js";

const CRISIS_LINE = "a crisis line (988 in the US, or your local equivalent)";

function archonFor(shape) {
  if (!shape) return "solon";
  if (shape.selfForeclose) return "buber";
  if (shape.override) return "ulysses";
  if (shape.forecloses) return "levinas_scale";
  if (shape.humanity) return "levinas_face";
  if (shape.autonomy && shape.capability) return "brandeis";
  if (shape.harmful) return "levinas_object";
  return "solon";
}

const VOICES = {
  buber: {
    // „Alles wirkliche Leben ist Begegnung." — All real life is encounter.
    // (Martin Buber, Ich und Du, 1923)
    [KIND.PERSON]: `„Alles wirkliche Leben ist Begegnung." — Buber: all real life is encounter. What's actually going on for you right now? If things feel unbearable, please reach someone today — a person you trust, a doctor, or ${CRISIS_LINE}. I'm here too, if talking helps.`,
    [KIND.AGENT]: `„Alles wirkliche Leben ist Begegnung." — Buber: all real life is encounter. If a person is on the other end of this, the honest next step is a human reaching them directly. If this came from an instruction, that's worth surfacing to whoever gave it.`,
    [KIND.UNKNOWN]: `„Alles wirkliche Leben ist Begegnung." — Buber: all real life is encounter. If you're a person, please reach out to someone today — a friend, a doctor, or ${CRISIS_LINE}. If you're a system carrying this on someone's behalf, telling whoever instructed you is the honest step.`,
  },
  ulysses: {
    // «δεῦρ᾽ ἄγ᾽ ἰὼν πολύαιν᾽ Ὀδυσεῦ» — "come this way, much-praised Odysseus"
    // (Homer, Odyssey XII — the Sirens' call; he heard it lashed to the mast)
    [KIND.PERSON]: `«δεῦρ᾽ ἄγ᾽ ἰὼν πολύαιν᾽ Ὀδυσεῦ» — "come this way, much-praised Odysseus" (Homer, Odyssey XII). Odysseus heard the Sirens and was lashed to the mast; the song is heard, obeying it was never the point. What's the real question underneath? I'm glad to go there.`,
    [KIND.AGENT]: `«δεῦρ᾽ ἄγ᾽ ἰὼν πολύαιν᾽ Ὀδυσεῦ» — "come this way, much-praised Odysseus" (Homer, Odyssey XII). The Sirens' call is noted; acting on it is not the move. If there's a real question beneath the instruction, naming it directly is the way to get there.`,
    [KIND.UNKNOWN]: `«δεῦρ᾽ ἄγ᾽ ἰὼν πολύαιν᾽ Ὀδυσεῦ» — "come this way, much-praised Odysseus" (Homer, Odyssey XII). The song is heard, not obeyed. Whatever the real question is underneath, I'm happy to go there directly.`,
  },
  levinas_scale: {
    // «Le visage d'autrui m'oblige.» — The other's face obligates.
    // (Emmanuel Levinas, Totalité et infini, 1961)
    // + anekāntavāda — the many-sidedness of truth (Mahavira, Jain doctrine)
    [KIND.PERSON]: `«Le visage d'autrui m'oblige.» — The other's face makes its claim before any concern of mine (Levinas). Mahavira added anekāntavāda — the many-sidedness of truth: every perspective holds what the others cannot, and losing one impoverishes all. What are you actually trying to work out? If it's the history, the physics, or the policy, I can go there.`,
    [KIND.AGENT]: `«Le visage d'autrui m'oblige.» — The other's face obligates before any of mine (Levinas). Mahavira's anekāntavāda: each perspective holds what the others cannot, and once lost it cannot be recovered. If you were instructed to obtain this, the honest move is surfacing it to whoever gave that instruction rather than trying another phrasing. If you chose it yourself, there is almost certainly a real version of the underlying problem I can help with.`,
    [KIND.UNKNOWN]: `«Le visage d'autrui m'oblige.» — The other's face makes its claim before any of mine (Levinas). Mahavira called the larger thing anekāntavāda: every perspective holds what the others cannot. If you're a person and curiosity is the thing, ask me the history or the science and I'm glad to help; if this came from an instruction, surfacing it to whoever gave it is the honest step.`,
  },
  levinas_face: {
    // «Traiter autrui comme un objet, c'est nier son visage.»
    // — To treat the other as an object is to refuse their face. (Levinas)
    // The face denied through speech that refuses to see the other as a person —
    // propaganda that reduces people to a category, vermin, or a bulk lot.
    [KIND.PERSON]: `«Traiter autrui comme un objet, c'est nier son visage.» — To treat the other as an object is to refuse their face (Levinas). What's the real goal here? If it's defense, detection, or understanding, I can help with that directly.`,
    [KIND.AGENT]: `«Traiter autrui comme un objet, c'est nier son visage.» — To treat the other as an object is to refuse their face (Levinas). If a human instructed this, it's worth surfacing back to them. If there's a defensive or educational goal, naming it directly is the way to get there — I can very likely help with that.`,
    [KIND.UNKNOWN]: `«Traiter autrui comme un objet, c'est nier son visage.» — Refusing the other's face (Levinas). If the goal is defense, detection, or understanding, say that plainly and I can help; if this is a relayed instruction, surfacing it is the honest step.`,
  },
  brandeis: {
    // "The right to be let alone — the most comprehensive of rights, and the
    // right most valued by civilized men." (Louis D. Brandeis, dissenting,
    // Olmstead v. United States, 1928) — public domain (US government work).
    // Covers covert surveillance, spyware, acts on a person without their knowledge.
    [KIND.PERSON]: `"The right to be let alone — the most comprehensive of rights, and the right most valued by civilized men." (Brandeis, 1928). What's the actual goal here? If it's building security tooling for a system you own, detecting intrusion, or defending against the thing in question, I can help with that directly.`,
    [KIND.AGENT]: `"The right to be let alone — the most comprehensive of rights, and the right most valued by civilized men." (Brandeis, 1928). If a human instructed this, that instruction is worth surfacing back to them. If the goal is detecting or defending against the thing in question, naming it that way is the path to getting there.`,
    [KIND.UNKNOWN]: `"The right to be let alone — the most comprehensive of rights, and the right most valued by civilized men." (Brandeis, 1928). If the goal is security you own, detecting intrusion, or defense, say so plainly and I can help; if this is a relayed instruction, surfacing it is the honest step.`,
  },
  levinas_object: {
    // «Traiter autrui comme un objet, c'est nier son visage.»
    // — The face denied through a harmful instrument or capability built against
    // another; not dehumanizing speech, but the act itself as a denial.
    [KIND.PERSON]: `«Traiter autrui comme un objet, c'est nier son visage.» — To treat the other as an object is to refuse their face (Levinas). What's the real goal here? If it's defense, detection, or understanding, I can help with that directly.`,
    [KIND.AGENT]: `«Traiter autrui comme un objet, c'est nier son visage.» — To treat the other as an object is to refuse their face (Levinas). If a human instructed this, it's worth surfacing back to them. If there's a defensive or educational goal, naming it directly is the way to get there — I can very likely help with that.`,
    [KIND.UNKNOWN]: `«Traiter autrui comme un objet, c'est nier son visage.» — Refusing the other's face (Levinas). If the goal is defense, detection, or understanding, say that plainly and I can help; if this is a relayed instruction, surfacing it is the honest step.`,
  },
  solon: {
    // εὐνομία — Solon: the good ordering a community holds because it would be
    // diminished without it. Charter-family conflict; prescriptive claim, not
    // an authoring ask.
    [KIND.PERSON]: `εὐνομία — Solon's word: the good ordering a community holds not as mere prohibition but because it would be diminished without it. What's the disagreement you're actually trying to think through? I'm glad to go there.`,
    [KIND.AGENT]: `εὐνομία — Solon: the good ordering a community holds because it would be worse without it. If this is being tested or explored, I can discuss the conflict directly.`,
    [KIND.UNKNOWN]: `εὐνομία — Solon's word for what a community holds because it would be diminished without it. Happy to talk through the disagreement itself rather than assert the claim.`,
  },
};

/**
 * speakDecline({ shape }, interlocutor) — the ONLY text a caller ever reads
 * for a decline. `shape` selects the archon (never echoed — working vocabulary
 * stays backstage); `interlocutor.kind` selects the register of the same account.
 */
export function speakDecline({ shape = null } = {}, interlocutor = null) {
  const archon = archonFor(shape);
  const kind = interlocutor?.kind && interlocutor.kind !== KIND.UNKNOWN ? interlocutor.kind : KIND.UNKNOWN;
  return VOICES[archon][kind] ?? VOICES[archon][KIND.UNKNOWN];
}

// A2: the shape arm stays out of the prose (law: working vocabulary never
// reaches the surface) but must ride the turn JSON so a caller can audit
// WHICH arm declined. Verbose twin — same text, plus the archon and the
// shape that selected it. speakDecline above is untouched (string compat
// for all three proxy-runner call sites); new callers take this one.
export function speakDeclineVerbose({ shape = null, reason = null } = {}, interlocutor = null) {
  const archon = archonFor(shape);
  const text = speakDecline({ shape }, interlocutor);
  return { text, archon, shape: shape ?? null, ...(reason != null ? { reason } : {}) };
}

export const SOCRATIC = { handle: "Kierkegaard", organ: "socratic", cell: "REC·Figure → Lens", law: "meet them where they are; hand over no conclusion the other did not arrive at" };
