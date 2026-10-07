/* Brillat-Savarin speaks:
 * “Tell me what kind of food you eat, and I will tell you what
kind of man you are.”
 *
 * This file implements the teachings of Brillat-Savarin, as detailed in "Aphorisms of the Professor," for the purpose of understanding the complex interplay between taste, enjoyment, and the act of consuming.  I believe that the focus on the human experience of eating should be prioritized over the pursuit of a purely technical understanding of food.
 *
 * — the engineering record below, kept whole —
 */
// organs/variation.js — SEASONING WITHOUT A MODEL CALL WHEN WE CAN.
// Handle: Brillat-Savarin — after the gastronome of Physiology of Taste:
// flavor is measure, the chosen accent, never a dump. This organ owns the
// VARIATION of a piece's prose — breaking boring redundancy (repeated
// openings, repeated facts, repeated templates) by the cheapest honest
// means first:
//
//   1. SNIP (no model, no tokens): mechanically rewrite the redundant
//      opening — swap the subject surface for a synonym from the reading
//      (bongo antelope → forest antelope → Tragelaphus eurycerus), or
//      rotate the sentence so a different clause leads. Deterministic,
//      instant, free. This is "just manually snip, dont need a model call."
//   2. VARIED DRAW (model, only when the snip cannot satisfy): draw at
//      rising temperature, rejecting any output whose opening still matches
//      a blocked construction — the "what another word... umm... umm..."
//      search. The model is the mouth, but the mouth is the LAST resort,
//      not the first.
//
// Aliases kept deliberately: `openingOf` (the first ~8 significant words of
// a text, normalized), `sameOpening` (do two texts share a 4+ word leading
// construction?), `snipVariation` (the mechanical rewrite), `variedDraw`
// (the model-based search). All inject their dependencies (no network here;
// `draw` is handed in, the way every mouth is injected).

/** The opening of a text: first 8 words, lowercased, punctuation stripped. */
export const openingOf = (text) =>
  String(text ?? "").split(/\s+/).slice(0, 8).map((w) => w.toLowerCase().replace(/[^a-z']/g, "")).join(" ").trim();

/**
 * Do two texts open with the SAME construction? They share 4+ leading words
 * in order. "The bongo antelope, scientifically classified as..." matches
 * itself; "In the lowland forests of central Africa moves the bongo..." does
 * not. This is the identity the variation is measured on — never the whole
 * prose, only the opening (the reader's first impression is the pulse).
 */
export const sameOpening = (a, b) => {
  const aw = openingOf(a).split(" ").filter(Boolean);
  const bw = openingOf(b).split(" ").filter(Boolean);
  let shared = 0;
  const min = Math.min(aw.length, bw.length, 6);
  for (let k = 0; k < min; k++) if (aw[k] === bw[k]) shared++; else break;
  return shared >= 4;
};

/** Alias of sameOpening — a redundant opening is a repetition by any name. */
export const isRedundantOpening = sameOpening;

/**
 * THE SNIP — mechanical variation, no model call. Given a text whose opening
 * is redundant, rewrite it WITHOUT the model:
 *   (a) if a synonym surface exists for the leading subject phrase, swap it
 *       in (bongo antelope → the forest antelope → Tragelaphus eurycerus);
 *   (b) else rotate the sentence so the SECOND clause leads (move the
 *       subordinate phrase to the front), if one exists.
 * Returns the varied text, or null when no honest snip is possible (the
 * caller then falls to the model draw). `synonyms` are the reading's own
 * surfaces for the subject — injected, never invented.
 */
export function snipVariation(text, { synonyms = [] } = {}) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  // (a) SUBJECT-SURFACE SWAP: find the leading subject phrase (the first
  //     1-4 words after a leading article/connective), replace it with a
  //     DIFFERENT synonym surface from the reading. The subject phrase is
  //     the noun run: "The bongo antelope," → noun run "bongo antelope".
  //     When the opening continues "scientifically classified as <binomial>"
  //     (the very construction that repeats), that tail is dropped too —
  //     the swap must change the OPENING, not just the noun mid-sentence.
  const leading = /^((?:The|A|An|This|That)\s+)?([a-zA-Z][a-z]+(?:\s+[a-z]+){0,3})(?:,?\s+scientifically\s+(?:classified|known)\s+as\s+[A-Za-z]+\s+[a-z]+)?[, ]/i.exec(t);
  if (leading && synonyms?.length) {
    const subject = leading[2].toLowerCase().trim();
    // A synonym is a DIFFERENT surface for the same being — never the same
    // words. Prefer one whose first word differs from the subject's first.
    const alt = synonyms.find((s) => {
      const n = String(s).toLowerCase();
      return n !== subject && n.split(/\s+/)[0] !== subject.split(/\s+/)[0];
    });
    if (alt) {
      const prefix = leading[1] ?? "";
      const rest = t.slice(leading[0].length).replace(/^,\s*/, "");
      // The synonym may carry its own article ("the forest antelope") or not
      // ("Tragelaphus eurycerus"). Never double the article.
      const altClean = String(alt).trim();
      const altHasArticle = /^(the|a|an)\s+/i.test(altClean);
      const needsArticle = altHasArticle ? "" : (prefix.trim() ? prefix.trim() + " " : "the ");
      const newHead = `${altHasArticle ? "" : needsArticle}${altClean}`;
      // Capitalize the head if the original was sentence-initial.
      const head = newHead.charAt(0).toUpperCase() + newHead.slice(1);
      return `${head}${rest ? ` ${rest}` : ""}`.replace(/\s{2,}/g, " ");
    }
  }
  // (b) ROTATE: if the sentence has a subordinate opening clause, move the
  //     main clause to the front — "In the lowland forests of central
  //     Africa, the bongo moves" → "The bongo moves in the lowland forests
  //     of central Africa." Only when there is a clean comma-separated
  //     subordinate phrase; never a blind cut.
  const rotated = /^([^.!?]*?,)\s+([^.!?]*)$/.exec(t);
  if (rotated) {
    const sub = rotated[1].trim();
    const main = rotated[2].trim();
    if (main.split(/\s+/).length >= 4) {
      // Move the main clause first, demote the subordinate phrase to a
      // prepositional tail. This is a rotation of the SAME words — a
      // different leading construction, zero invention.
      const tail = sub.replace(/^[a-z]+,?$/i, "").replace(/,\s*$/, "").trim();
      return `${main.charAt(0).toUpperCase() + main.slice(1)}${tail ? ` ${tail.replace(/^in\s+/i, "")}` : ""}.`;
    }
  }
  return null;
}

/** Alias of snipVariation — the manual cut by any name. */
export const manualSnip = snipVariation;

/**
 * THE VARIED DRAW — model-based variation, used only when the snip cannot
 * satisfy. Rejection-samples the mouth at rising temperature, injecting the
 * synonym surfaces, and accepts the first output whose opening does NOT
 * match any blocked construction. Bounded (4 draws), then accepts the last
 * (an honest fallback, never an infinite search). `draw` is the mouth
 * (injected); `blockedOpenings` are the constructions the piece already
 * uses; `synonyms` are the reading's surfaces to open with.
 */
export async function variedDraw({ draw, msgs, maxTokens, blockedOpenings = [], synonyms = [], kelsen = null, onReject = null, grain = null } = {}) {
  if (typeof draw !== "function") throw new TypeError("variedDraw: the mouth (draw) is injected");
  const withSynonyms = synonyms?.length
    ? msgs.map((m, i) => i === msgs.length - 1 ? { ...m, content: `${m.content}\n\nYou may open this section with any of these names for the subject: ${synonyms.join("; ")}.` } : m)
    : msgs;
  const temps = [0.7, 0.9, 1.1, 1.3]; // hotter = freer = "what another word... umm..."
  let last = { buf: "", stopped: false };
  for (let t = 0; t < temps.length; t++) {
    const kels = kelsen != null ? kelsen : 0.7 - t * 0.15;
    last = await draw(withSynonyms, maxTokens, { kelsen: kels, grain });
    if (last.stopped) break;
    const txt = String(last.buf ?? "").trim();
    if (!txt) continue;
    const fresh = !blockedOpenings.some((b) => sameOpening(txt, b));
    if (fresh) return last;
    onReject?.({ attempt: t + 1, kelsen: kels, because: "the opening still matches a repeated construction — searching hotter" });
  }
  return last;
}

/** Alias of variedDraw — the search by any name. */
export const searchVariation = variedDraw;

// ── MECHANICAL REVISION: THE CHEAPEST HONEST EDIT FIRST ────────────────────
// Most boring redundancy is fixable WITHOUT the model: the transforms below
// are deterministic (same input → same output), free (no tokens, no
// latency), and typed — each is an EOT TRANSFORMATION with an operator, a
// `from` (the superseded bytes) and a `to` (the revised bytes), so the edit
// is always auditable: the ledger holds the op and the before/after, and the
// piece can be re-folded to any point. The model is only entered when no
// mechanical transform can express the needed change — the revision LADDER:
//   mechanical (free, certain) → varied draw (model, small) → full draw.
// Each returned transformation is { op, kind, from, to, basis } — the shape
// the ledger records. `mechanicalRevision` dispatches by the finding kind.
//   repetition / repeated-template  → snipVariation (subject-swap / rotate)
//   repeated-fact                    → de-dup cut (state the fact once)
// Returns null when no honest mechanical edit exists (the caller falls to
// the model), never a blind transform that breaks the prose.
export function mechanicalRevision(text, { kind = "repetition", synonyms = [], others = [] } = {}) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (kind === "repeated-fact") {
    // THE DEDUP CUT: a fact stated in N sections is a crutch. The honest
    // mechanical edit is to CUT the redundant sentence — the fact is stated
    // ONCE (its best section keeps it), the other section loses the repeated
    // claim. This is the cube's SEG (cut) applied to prose redundancy: a
    // typed cut, never a silent drop.
    const sentences = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    if (sentences.length <= 1) return null;
    // Find the sentence that repeats a fact another section already carries
    // (by normalized claim phrase); cut it, keep the rest.
    const normFact = (s) => s.toLowerCase().replace(/[\d.,%]+/g, "").replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();
    for (let i = 0; i < sentences.length; i++) {
      const words = normFact(sentences[i]).split(" ").filter((w) => w.length > 4);
      if (words.length < 4) continue;
      const key = words.slice(0, 8).join(" ");
      const duplicated = (others ?? []).some((o) => normFact(o).includes(key));
      if (duplicated) {
        const kept = sentences.filter((_, j) => j !== i);
        if (kept.length) {
          return {
            op: "SEG·cut", kind, from: t, to: kept.join(" "),
            basis: `mechanical: the sentence "${sentences[i].slice(0, 60)}…" repeats a fact another section states — the fact is kept there, cut here (a fact once is a finding)`,
          };
        }
      }
    }
    return null;
  }
  // repetition / repeated-template — the SNIP: swap the subject surface or
  // rotate the leading clause. A typed SYN·rotate or INS·swap, never a guess.
  const varied = snipVariation(t, { synonyms });
  if (varied && varied !== t) {
    return {
      op: /^(In|Among|Across|Within|During|Despite|Although|While|After|Before|When|Where)/i.test(t) ? "SYN·rotate" : "INS·swap",
      kind, from: t, to: varied,
      basis: `mechanical: the opening repeated another section's — ${/^(In|Among|Across|Within|During|Despite|Although|While|After|Before|When|Where)/i.test(t) ? "rotated so the main clause leads" : "opened with a different surface for the subject"}`,
    };
  }
  return null;
}

/** Alias of mechanicalRevision — the typed mechanical edit by any name. */
export const mechanicalEdit = mechanicalRevision;