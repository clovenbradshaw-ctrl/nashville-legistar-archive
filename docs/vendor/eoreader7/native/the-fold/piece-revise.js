// piece-revise.js — a piece revises what it already wrote when later
// reading finds something, and a revision lands only if it grounds (P116).
// Pure: the model call, the relation reader and the ground ladder are
// injected.
//
// User direction (2026-09-05): "make sure … recursively that it is able to
// revise what it writes based on new discoveries from what it's writing but
// always grounded." The discoveries are the record's own: passages a later
// section hunted, notes later sections admitted, a cut a later section
// heard against a claim an earlier section made, a void a later section
// filled. Two kinds of revision, both mechanical in their trigger:
//   RE-CITE  — a sentence's ground RISES against the whole piece's material
//              (self → recorded/witnessed/bound): the text stands, the
//              address is attached. No model.
//   REWRITE  — a sentence is now CONTESTED (a later section's reading
//              denies its claim) or stood on a void a later section filled:
//              the mouth is asked once, handed the later finding as a fact
//              with its address, and the candidate is accepted ONLY if the
//              ladder places it at a grounded rung; otherwise the original
//              stays, wearing its contested mark. Bounded by a declared ask
//              budget and a declared number of rounds; every accepted and
//              refused revision is an act on the result.
// reviseLedgerContested's own core (does a drafted claim match a note this
// ledger already carries a live dispute against, and the bounded, injected-
// call rewrite orchestration) is eoreader7's — the-fold owns only its own
// acceptance gate (groundOf) and prompt wording, so any other eoreader7
// consumer can reuse the same organ (P69's own ratchet: the-fold owns the
// surface, eoreader7 owns anything genuinely general).
import { reviseAgainstLedger, claimContestedByLedger } from "../organs/index.js";

export const REVISION_ASKS = 12;   // model asks per piece for rewrites (P9: declared)
export const REVISION_ROUNDS = 2;  // a rewrite can itself be contested by what it says; two rounds, then stop
const GROUNDED = new Set(["bound", "witnessed", "recorded", "derived"]);

/**
 * revisePiece(sections, { groundOf, readAgainst, call, splitSentences, ctx, model }) → { sections, revisions }
 * sections: [{ label, text, claims, witnessRows }]; ctx: the piece-wide ladder context
 * (notes, disputes, derived, passages, resolveName); readAgainst(sentence) → claims
 * against the whole piece's material.
 */
export async function revisePiece(sections, { groundOf, readAgainst, call, splitSentences, ctx, model = null, asks = REVISION_ASKS, rounds = REVISION_ROUNDS, systemPrompt = "" } = {}) {
  const revisions = [];
  let spent = 0;
  let out = sections.map((s) => ({ ...s }));
  for (let round = 1; round <= rounds; round += 1) {
    let changed = 0;
    for (const s of out) {
      const sentences = splitSentences(String(s.text ?? "")).map((x) => x.trim()).filter(Boolean);
      const before = new Map((s.claims ?? []).map((c) => [c.sentence, c]));
      for (const sent of sentences) {
        const own = (s.claims ?? []).filter((c) => c.sentence === sent);
        const wrow = (s.witnessRows ?? []).find((r) => r.sentence === sent) ?? null;
        const g0 = groundOf(sent, { ...ctx, claims: own, witness: wrow, model });
        // against the whole piece's material, now
        const later = (readAgainst(sent) ?? []).map((c) => ({ ...c, sentence: sent }));
        const g1 = groundOf(sent, { ...ctx, claims: [...own, ...later], witness: wrow, model });
        const rank = (t) => ["self", "named", "contested", "derived", "recorded", "witnessed", "bound"].indexOf(t);
        if (g1.tier === "contested" && g0.tier !== "contested") {
          // REWRITE: a later reading denies what this sentence says
          if (spent >= asks) { revisions.push({ round, section: s.label, kind: "rewrite-refused", sentence: sent, because: "revision ask budget spent", ground: g1 }); continue; }
          spent += 1;
          const finding = g1.detail;
          let candidate = "";
          try {
            candidate = String(await call([
              { role: "system", content: systemPrompt },
              { role: "user", content: `In the section "${s.label}" this sentence was written before later reading found otherwise: "${sent}"\nWhat was found: ${finding}${g1.addresses?.length ? ` (${g1.addresses.slice(0, 3).join(", ")})` : ""}.\nRewrite only that sentence so it says what the sources establish, in the same voice; one sentence.` },
            ], { maxTokens: 160 }) ?? "").trim().split("\n")[0].trim();
          } catch (e) { candidate = ""; }
          const cand = candidate.replace(/^["“]|["”]$/g, "");
          const gc = cand ? groundOf(cand, { ...ctx, claims: (readAgainst(cand) ?? []).map((c) => ({ ...c, sentence: cand })), witness: null, model }) : null;
          if (gc && GROUNDED.has(gc.tier) && gc.tier !== "contested") {
            s.text = String(s.text).replace(sent, cand);
            revisions.push({ round, section: s.label, kind: "rewrite", from: sent, to: cand, because: finding, ground: gc });
            changed += 1;
          } else {
            revisions.push({ round, section: s.label, kind: "rewrite-refused", sentence: sent, candidate: cand || null, because: gc ? `the rewrite stood at "${gc.tier}", not a grounded rung` : "no rewrite came back", ground: g1 });
          }
        } else if (rank(g1.tier) > rank(g0.tier) && GROUNDED.has(g1.tier)) {
          // RE-CITE: the ground rose; the text stands, the address rides
          revisions.push({ round, section: s.label, kind: "re-cite", sentence: sent, fromTier: g0.tier, toTier: g1.tier, addresses: g1.addresses ?? [] });
          s.recited = [...(s.recited ?? []), { sentence: sent, ground: g1 }];
        }
      }
    }
    if (!changed) break;
  }
  return { sections: out, revisions, asksSpent: spent };
}

export const revisionLine = (r) => r.kind === "rewrite" ? `revised in "${r.section}" after later reading (${r.because}): "${String(r.to).slice(0, 90)}"` : r.kind === "re-cite" ? `re-cited in "${r.section}": ${r.fromTier} → ${r.toTier}${r.addresses?.length ? ` ${r.addresses.slice(0, 2).join(", ")}` : ""}` : `revision refused in "${r.section}": ${r.because}`;

/**
 * reviseLedgerContested(sections, { groundOf, readAgainst, call, splitSentences, ctx, model }) → { sections, revisions, asksSpent }
 *
 * Gap 2 (2026-09-22, user direction: "if the model says something that
 * contradicts what the holograph knows that needs to spawn a revision").
 * revisePiece's own REWRITE branch, above, only fires when a LATER
 * section's reading makes an EARLIER section's sentence newly contested —
 * it compares g0 (a sentence's own claims alone) against g1 (own + the
 * whole piece's later material), and rewrites only when g1 reads
 * "contested" while g0 did not. That comparison cannot catch a note
 * already disputed on the ledger BEFORE the turn ever started drafting
 * (Gap 1's own pre-dispatch functionalConflicts + dispute() landing —
 * app.js's holonicTurn — or an earlier turn's crownTestimony contest,
 * P101): groundOf reads a sentence "contested" from its OWN claims alone
 * whenever they match a disputed note (ground-ladder.js, tier 3's
 * `onRecord`/`disputed` check), so g0 would ALREADY read "contested" too,
 * and revisePiece's "g0 was not contested" gate would never fire.
 *
 * This checks each sentence's ground ONCE — own claims only, no g0-vs-g1
 * comparison, because there is no "later reading" to converge against for
 * a flat turn or a decomposed non-piece turn — and rewrites a contested
 * sentence exactly once: never a loop of rounds. The candidate is adopted
 * only if its own fresh groundOf reading lands in the GROUNDED set, is not
 * itself "contested", and — for the bare "recorded" rung specifically —
 * the note it matches is independently corroborated, not merely single-
 * witness (a real exploit found and closed the same day: a rewrite could
 * otherwise trade one disputed-wrong value for a different, also-wrong,
 * merely-undisputed one and ship it as settled).
 *
 * CORRECTED (found by this session's own adversarial falsification, which
 * this file's earlier docstring did not survive): this does NOT match
 * runPart's whole-fresh-completion blocks (address-check, entity-
 * substitution — a full re-draft of `text`, adopted or discarded whole).
 * It shares revisePiece's OWN, narrower REWRITE mechanism one register up —
 * ask the mouth for exactly one sentence's replacement, splice it in via
 * `.replace()`, adopt only if the candidate itself grounds. POLICIES.md
 * P186 named that exact splice mechanism a deliberate, disclosed carve-out
 * for "a separate, later, explicitly voluntary" stage (a piece the person
 * asked to compose) — never authorized for ordinary, involuntary chat
 * turns. Widening it to every grounded turn (Gap 2, this file) extends
 * that carve-out past what P186 itself scoped, and was not reconciled in
 * policy when it first landed — POLICIES.md's own Gap-2 entry records the
 * extension and the reasoning for it, per this repo's standing rule that a
 * tested fix gets drilled into policy, not left implicit in a docstring.
 */
export async function reviseLedgerContested(sections, { groundOf, readAgainst, call, splitSentences, ctx, model = null, systemPrompt = "", asks = REVISION_ASKS } = {}) {
  const revisions = [];
  let spent = 0;
  const out = sections.map((s) => ({ ...s }));
  for (const s of out) {
    if (spent >= asks) { revisions.push({ section: s.label, kind: "rewrite-refused", because: "revision ask budget spent" }); continue; }
    const sentences = splitSentences(String(s.text ?? "")).map((x) => x.trim()).filter(Boolean);
    // The-fold's own acceptance gate: a candidate is adopted only if its own
    // fresh reading (readAgainst, re-run because the candidate is new text
    // no prior claim extraction ever saw) lands on a GROUNDED rung and is
    // not itself "contested" — the exact test this function ran inline
    // before the refactor, now the caller-supplied gate reviseAgainstLedger
    // requires (it has no notion of "grounded enough" of its own).
    const accept = (cand) => {
      const candClaims = (readAgainst(cand) ?? []).map((c) => ({ ...c, sentence: cand, end1: c.end1 ?? c.subject, label: c.label ?? c.verb, end2: c.end2 ?? c.object }));
      const gc = groundOf(cand, { ...ctx, claims: candClaims, witness: null, model });
      if (!gc || gc.tier === "contested" || !GROUNDED.has(gc.tier)) return false;
      // A rewrite RESOLVING a genuine dispute must not simply trade one
      // single-witness guess for another: "recorded" means "on the ledger
      // from one source" (standingOf's own vocabulary), never "verified" —
      // closes a real exploit found by adversarial falsification
      // (2026-09-22): a sentence disputed against a wrong value could be
      // rewritten to a DIFFERENT, also-wrong, merely-undisputed-so-far
      // value and shipped as settled, because nothing required the
      // replacement to be any more trustworthy than what it replaced.
      // bound/witnessed (independently verified against real passages) and
      // derived (a composed chain, a different mechanism) are untouched —
      // only the bare ledger-match path is tightened.
      if (gc.tier === "recorded") {
        const matched = candClaims.map((c) => claimContestedByLedger(c, ctx?.notes ?? [])).find((r) => r.note);
        const standing = matched?.note?.standing;
        if (standing !== "corroborated" && standing !== "corroborated-independently") return false;
      }
      return true;
    };
    // eoreader7's own kernel check (claimContestedByLedger) reads ONLY
    // end1/label/end2, never subject/verb/object (fixed for its own
    // medium-agnostic conformance test) — the-fold's own claims can carry
    // either naming (this repo's own standing dual-read convention,
    // holon.js's `c.end1 ?? c.subject`), so they are normalized at this
    // seam, the same translate-at-the-call-site pattern organs/
    // hyperlexicon.js's own hear() wrapper already uses for every other
    // kernel call.
    const normalizedClaims = (s.claims ?? []).map((c) => ({ ...c, end1: c.end1 ?? c.subject, label: c.label ?? c.verb, end2: c.end2 ?? c.object }));
    const rv = await reviseAgainstLedger(sentences, {
      claims: normalizedClaims, notes: ctx?.notes ?? [], call, systemPrompt, accept, asks: asks - spent,
      promptFor: (sentence, { because }) => `This sentence was written, and the record already shows otherwise: "${sentence}"\nWhat the record shows: ${because}.\nRewrite only that sentence so it says what the record establishes, in the same voice; one sentence.`,
    });
    spent += rv.asksSpent;
    for (const [sentence, replacement] of rv.replacements) s.text = String(s.text).replace(sentence, replacement);
    for (const r of rv.revisions) revisions.push({ section: s.label, ...r, kind: r.kind === "revise" ? "rewrite" : "rewrite-refused", ...(r.kind === "revise" ? { from: r.sentence, to: r.to } : {}) });
  }
  return { sections: out, revisions, asksSpent: spent };
}
