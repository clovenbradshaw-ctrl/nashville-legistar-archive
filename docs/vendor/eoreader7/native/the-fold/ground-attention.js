// native/the-fold/ground-attention.js — closes the archon-activation loop:
// router (matchArchons) -> ground-selector collapse -> Nagarjuna DEFINES the
// admission void -> one covert, object-level fact. This is the piece
// earned-cast.js's own CAST never had: a criterion whose CHOICE is informed
// by which archon's domain the material touches, without ever naming that
// archon or quoting its words — "not the words of the archon, but their
// style of thinking" (user direction, this session).
//
// NAGARJUNA DOES NOT FAIL THINGS (user correction, this session — the
// first version of this file used refuteRelation as a hard veto: a
// refutation silently killed the fact). And a second, deeper correction,
// same session: VOID here is not absence — not a hole where a fact should
// be — it is void in Nagarjuna's actual sense (sunyata): nothing gets to
// stand on its own, independently, self-sufficiently, closing the
// question by its own authority. The ground-selector's collapse names
// which criterion clears its null; it does NOT thereby grant the winning
// fact an inherent, unconditioned standing. What Nagarjuna's refutation
// actually checks is whether that fact's claimed standing survives being
// traced out to its own dependencies (here: does a positive counterexample
// — a uniqueness violation or a cycle — exist among the referents it
// rests on). Nagarjuna's own header is explicit that this asserts nothing
// of its own — "the veto organ: what the material REFUSES, never what it
// licenses" and "never reports a check it could not run" — a refutation-
// cleared candidate is never licensed, only shown not-yet-collapsed. What
// this file does with that finding: DECLARE a void
// (the-fold/void-shape.js::declareVoid, the real 9-operator organ) whose
// EVA·Figure cell — `admission`, what a candidate must be shown to depend
// on before it counts as covering any of this — is worded from Nagarjuna's
// disclosed finding. The fact still fires on a clean selector collapse
// regardless of what that finding says; the declared void ships ALONGSIDE
// it, on the record, so a caller (or a later EVA step this file does not
// build) can actually check that dependency rather than have Nagarjuna
// silently decide it, and so the fact is never mistaken for something
// that stands independently of the checking.
//
// THE ROUTER. organs/archon-compendium.js::matchArchons(text) already does
// exactly what the very first design ask wanted ("if a question is
// relevant to these priors, they get priority") — reused as-is, zero
// changes to that file. Its `credit`/`work` fields are for a DIFFERENT,
// explicit-citation use (that module's own "always credited in a
// response" rule) and must never reach this attention's output — only a
// matched archon's `handle` is read here, to look up a ground-criterion,
// never printed.
//
// THE MAP. A small, explicit, hand-reviewed table from archon handle to
// one of ground-selector.js's four criteria — not an invented heuristic
// per call. Only archons whose OWN compendium `role` text plainly names an
// evidentiary-grounding discipline get a slot; most of the ~60 archons are
// not about grounding at all and are correctly absent.
const ARCHON_TO_CRITERION = Object.freeze({
  mozi: "what eyes and ears witnessed", // "it is in the bytes the eyes and ears can witness, or it isn't"
  bukhari: "independent voices", // "stands only on independent chains; shared chain = one witness" — sharedTextGroups' own semantic
  sima: "distinct sources", // "walk past the received account to the archive"
  wigmore: "doubt carried forward", // "ask the witness twice ... verdict from the pair" — checking for reconciliation
});

// THE FACT, per winning criterion — plain, object-level, in the exact
// register earned-cast.js's existing kelsen/ranke/eastwood facts already
// use. Never the archon's name, handle, or the compendium's `credit`/`work`
// strings — bannedHits (earned-cast.js) enforces the ban on CAST names, but
// these strings are checked against it anyway as a second, disclosed line
// of defense, since Mozi/Bukhari/etc. are not in that CAST list at all and
// bannedHits would not otherwise catch a leak of one.
const GROUND_FACT = Object.freeze({
  "distinct sources": "this stands on more than one truly separate source, not one account repeated.",
  "independent voices": "the accounts that agree here are independent of each other, not one voice reprinted.",
  "what eyes and ears witnessed": "one account stands apart as written by someone who was there.",
  "doubt carried forward": "the accounts here diverge and do not reconcile — the doubt stands, not settled either way.",
});

// Nagarjuna's disclosed finding, worded into two cells at once: EVA
// (admission — not "did the candidate pass," but what its standing was
// actually traced back to and whether that tracing held) and REC
// (reopensOn — what NEW evidence would revise THIS finding specifically,
// never a generic "if new evidence arrives"). A void whose reopening
// condition is never stated cannot honestly be said to be chased at all
// — REC left undeclared reads as "this is settled," which none of the
// three branches below actually are. Reuses refuteRelation's OWN
// disclosure text where possible rather than inventing a second,
// drifting description of what it found.
function nagarjunaFinding(edges, winner, refuteRelation) {
  if (!edges || !edges.length) {
    return {
      admission: `"${winner}" has not been traced to anything that could refute it — no relation edges were offered for this material, so its standing is undetermined, not confirmed`,
      reopensOn: `any relation edges among these referents becoming available to check — right now there is nothing to trace`,
    };
  }
  const refutation = refuteRelation(edges, "corroborates", {});
  if (refutation.power === "insufficient") {
    return {
      admission: `"${winner}" has not been traced to anything that could refute it — ${refutation.powerDetail}`,
      reopensOn: `a second resolved edge among these referents arriving — refutation needs at least two to say anything`,
    };
  }
  if (refutation.refuted) {
    return {
      admission: `"${winner}" does not stand on its own: tracing its dependencies out found ${refutation.reasons.join(", ")} — ${refutation.disclosure}`,
      reopensOn: `the referents involved in that ${refutation.reasons.join("/")} being shown to be genuinely distinct standings (e.g. disjoint in time) rather than one conflated bridge — the same excusal refuteRelation's own interval check already grants elsewhere`,
    };
  }
  return {
    admission: `"${winner}" has been traced to its dependencies and none collapsed under a positive counterexample (uniqueness violation or cycle) — ${refutation.disclosure}`,
    reopensOn: `a new edge among these referents surfacing a uniqueness violation or a cycle — absence of one so far is not proof none exists`,
  };
}

/**
 * groundAttention({ task, records, edges }, deps) — the covert attention.
 *
 * `task` — the turn's own text, handed to matchArchons for routing.
 * `records` — [{ref, text, kind?}], the turn's real material. Absent or
 *   too thin returns `{fired: false, reason: "insufficient_material"}` —
 *   never a fabricated fact.
 * `edges` — optional real EOHyperedge@1 relations for this material, fed
 *   to Nagarjuna to help WORD the declared void's admission test. Absent
 *   is honest, not a failure: the void says so plainly rather than a
 *   silent pass upgraded to "verified".
 *
 * `deps` — injected real organs, so this file carries no import a caller
 *   cannot substitute in a test: `{ matchArchons, groundSelector,
 *   refuteRelation, declareVoid, cellOf, criteria = ARCHON_TO_CRITERION,
 *   groundOpts }`. `groundOpts` is `{draws, seed, alpha}` — declared by the
 *   CALLER (II.23); this file does not default a threshold nobody chose.
 *
 * Returns `{fired, text, winner, verdict, void}` on a clean collapse — the
 * declared void ships REGARDLESS of what its own admission test says;
 * running that test is a separate, later step this file does not perform.
 */
export function groundAttention({ task, records, edges = null } = {}, {
  matchArchons, groundSelector, refuteRelation, declareVoid, cellOf,
  criteria = ARCHON_TO_CRITERION, groundOpts,
} = {}) {
  if (typeof matchArchons !== "function") throw new TypeError("groundAttention: matchArchons is injected — the real compendium organ, never reimplemented");
  if (typeof groundSelector !== "function") throw new TypeError("groundAttention: groundSelector is injected");
  if (typeof refuteRelation !== "function") throw new TypeError("groundAttention: refuteRelation is injected — Nagarjuna, never skipped by omission");
  if (typeof declareVoid !== "function") throw new TypeError("groundAttention: declareVoid is injected — void-shape.js's own organ, never reimplemented");
  if (typeof cellOf !== "function") throw new TypeError("groundAttention: cellOf is injected — declareVoid's own dependency, from the real cube");
  if (!groundOpts) throw new TypeError("groundAttention: groundOpts {draws, seed, alpha} is declared by the caller — a threshold nobody chose is not a threshold");

  const list = (records ?? []).filter((r) => r && r.ref && r.text);
  if (list.length < 2) return Object.freeze({ fired: false, reason: "insufficient_material" });

  const matches = matchArchons(String(task ?? ""));
  const wanted = new Set(matches.map((m) => criteria[m.handle]).filter(Boolean));
  if (!wanted.size) return Object.freeze({ fired: false, reason: "no_matched_archon_names_a_criterion" });

  const verdict = groundSelector(list, groundOpts);
  if (verdict.standing !== "collapse") return Object.freeze({ fired: false, reason: `ground_selector_${verdict.standing}`, verdict });
  if (!wanted.has(verdict.winner)) return Object.freeze({ fired: false, reason: "collapse_on_unmatched_criterion", verdict });

  // Nagarjuna's contribution: word the admission test, never run a verdict
  // of its own. The declared void ships alongside the fact either way.
  const { admission, reopensOn } = nagarjunaFinding(edges, verdict.winner, refuteRelation);
  const declaredVoid = declareVoid({ slot: `${verdict.winner} — admission`, admission, reopensOn }, { cellOf });

  const text = GROUND_FACT[verdict.winner];
  return Object.freeze({ fired: true, from: "ground", text, winner: verdict.winner, verdict, void: declaredVoid });
}

export const ARCHON_TO_CRITERION_MAP = ARCHON_TO_CRITERION;
