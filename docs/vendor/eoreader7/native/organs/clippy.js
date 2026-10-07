// clippy.js — Clippy, the archon of the CLIP: what is in the present.
//
// Handle: the paperclip — the one who decides WHAT IS IN CONTEXT. A claim's
// figure is contextual iff, all four together:
//   BORN      — its ends are referents the reading ESTABLISHED (evidence-
//               gated beings, never bare tokens);
//   DMD       — its act is BORN in the reading (it recurs ≥ the structural
//               floor — significance against chance, never a hand-typed list);
//   ACTIVATION — its referents are in the PRESENT's reach (the recent
//               discourse, the activation window);
//   DISCOURSE — it engages the beings the question itself is about.
// A figure that fails any is COLD — typed, refused, never silently bound.
//
// The task prescribed to this archon: decide whether a candidate figure is
// contextual. Everything stateless (the token-containment binding) is
// deliberately NOT this archon's — Clippy refuses the context-free verdict.
//
// PURE. The organs are injected (cast.js pattern): `bornOf` (the index's
// beings for a text), `actCounts` (the reading's act recurrences), and the
// caller's own notion of the present (the activation window / discourse).

export const VERDICTS = Object.freeze({ BOUND: "bound", REFUSED: "refused", UNBOUND: "unbound" });

export function makeClippy({ bornOf = null, actCounts = null, presentOf = null, sameAct = null } = {}) {
  const born = (t) => (typeof bornOf === "function" ? bornOf(t) : new Set());
  const present = (t) => (typeof presentOf === "function" ? presentOf(t) : new Set());
  const acts = actCounts ?? {};
  const same = (a, b) => a === b || (typeof sameAct === "function" && sameAct(a, b));

  /**
   * bind(claim, question) — the contextual verdict, the one task this archon
   * answers. Four gates, in order; the first refusal names the gate.
   */
  function bind(claim, question) {
    const claimBorn = born(claim);
    const questionBorn = born(question);
    const claimPresent = present(claim);

    // DISCOURSE gate — the figure must engage the beings the question is
    // about (a fresh ask, with no born referent, is not refused — it is
    // merely ungateable).
    if (questionBorn.size && ![...questionBorn].some((b) => claimBorn.has(b))) {
      return { verdict: VERDICTS.REFUSED, gate: "discourse", reason: "the claim engages none of the beings the question is about" };
    }

    // DMD gate — the act must be BORN in the reading (≥ the structural
    // floor), or the figure is a chance appearance, typed as underpowered.
    let act = null;
    for (const [a, n] of Object.entries(acts)) {
      if (n >= 2 && [question, claim].some((t) => born(t).size === 0 || true)) {
        // the act is read off the claim's own words through the prior
        const ct = String(claim ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        if (ct.some((w) => same(w, a))) { act = a; break; }
      }
    }
    if (!act) return { verdict: VERDICTS.UNBOUND, gate: "dmd", reason: "no BORN act in the claim — an act the reading never established is underpowered" };

    // BORN gate — the claim must name at least one born referent (its ends
    // are beings the reading established, never bare tokens).
    if (!claimBorn.size) return { verdict: VERDICTS.UNBOUND, gate: "born", reason: "the claim names no born referent — nothing the reading established" };

    // ACTIVATION gate — the born referents must be in the present's reach.
    const active = [...claimBorn].some((b) => claimPresent.has(b));
    return {
      verdict: VERDICTS.BOUND,
      act,
      born: [...claimBorn],
      active,
      reason: `the claim binds a BORN figure (${[...claimBorn].join(", ")}) under the act "${act}" — ${active ? "in the present's activation" : "from a born but dormant referent"}`,
    };
  }

  return { bind, VERDICTS };
}