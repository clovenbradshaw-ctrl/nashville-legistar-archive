/* Aletheia speaks:
 * “Tis necessary for thee to 
learn all things, both the abiding essence of per- 
suasive truth, and men’s opinions in which rests 
no true belief.”
 *
 * `eoreader7/native/organs/aletheia.js` serves as the foundation for the concept of "unconcealment" in the context of this project.  While I acknowledge the importance of uncovering truth, I believe that the pursuit of "unconcealment" should be grounded in a careful, reasoned approach, not merely a blind, uncritical acceptance of any given assertion.
 *
 * — the engineering record below, kept whole —
 */
// aletheia.js — Aletheia, the archon of SATISFACTION: did the answer
// satisfy the question?
//
// Handle: Aletheia (aletheia, "un-concealment") — the Greek goddess of
// truth as the revealing of what was hidden. An answer satisfies a question
// iff it UNCONCEALS the thing asked about: it addresses the question's
// subject, offers a real claim (or an honest absence), and is not a
// vacuous echo of the question's own words.
//
// This is deliberately NOT Parmenides's question. Parmenides answers
// "SAME or OTHER?" — is this claim the same form as the material's claim?
// Aletheia answers "SATISFIED or NOT?" — does this answer fulfill what was
// asked? Aletheia CONSUMES Parmenides (a satisfying answer's claim must
// participate in the material's form) but the satisfaction verdict is hers.
//
// The four layers, in order (each is one EO cell):
//   ADDRESSED (SIG·Ground) — does the answer name the question's referent?
//   FILLED    (SYN·Figure) — does the answer offer a claim (or an honest
//             absence), not a vacuous echo of the question's words?
//   GROUNDED  (CON·Ground) — does the answer's claim participate in the
//             material's form? (via Parmenides)
//   HONEST    (NUL·Figure) — is a silent question answered with a decline,
//             not a fabrication?
//
// Verdicts: {satisfied: true, via} | {satisfied: false, at: <layer>,
// reason} | {refused} (nothing to judge).
//
// PURE. `contentWords`/`decline` are injected (the fold's own), `same` is
// Parmenides's verdict organ, `material` is the pooled reading.

export const LAYERS = Object.freeze({
  ADDRESSED: "addressed",
  FILLED: "filled",
  GROUNDED: "grounded",
  HONEST: "honest",
});

export function makeAletheia({ contentWords = null, decline = null, same = null } = {}) {
  const words = (s) => (typeof contentWords === "function" ? contentWords(s) : []);
  const isDecline = (s) => (typeof decline === "function" ? decline(s) : false);

  function judge({ question, answer, material = [] }) {
    const qw = new Set(words(question));
    const aw = words(answer);
    if (!qw.size || !aw.length) return { satisfied: false, at: LAYERS.FILLED, reason: "nothing to judge" };

    // ADDRESSED — the question's content words should appear in the answer
    // (the subject is named). "Rostopchin had any role in the fire" DOES
    // name Rostopchin — so this layer passes and the vacuity is caught
    // below, not here.
    const addressed = [...qw].filter((w) => aw.includes(w)).length / qw.size;
    if (addressed < 0.25) return { satisfied: false, at: LAYERS.ADDRESSED, reason: `names ${Math.round(addressed * 100)}% of the question's words` };

    // HONEST — a silent question answered with a decline is a satisfaction.
    if (isDecline(answer)) return { satisfied: true, via: LAYERS.HONEST };

    // FILLED — the answer must offer a real claim, not a near-pure echo of
    // the question's own words re-arranged ("Rostopchin had any role in the
    // fire." adds only "any"). An answer that adds fewer than two new words
    // and is dominated by the question's vocabulary is a vacuous echo.
    const novel = aw.filter((w) => !qw.has(w)).length;
    const echoShare = aw.length ? 1 - novel / aw.length : 1;
    if (novel < 2 || echoShare > 0.66) {
      return { satisfied: false, at: LAYERS.FILLED, reason: `vacuous echo — adds ${novel} new word${novel === 1 ? "" : "s"}, ${Math.round(echoShare * 100)}% the question's own` };
    }

    // GROUNDED — the answer's claim participates in the material's form
    // (via Parmenides, on the material's own content words).
    if (typeof same === "function" && material.length) {
      const mw = new Set(material.flatMap((m) => words(m)));
      let bound = false;
      for (const w of aw) {
        if (mw.has(w)) { bound = true; break; }
        for (const m of mw) { try { if (same(w, m)?.verdict === "same") { bound = true; break; } } catch { /* skip */ } }
        if (bound) break;
      }
      if (!bound) return { satisfied: false, at: LAYERS.GROUNDED, reason: "no material form the answer participates in" };
    }

    return { satisfied: true, via: LAYERS.FILLED };
  }

  return { judge, LAYERS };
}