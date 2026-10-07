// anchor-chase.js — RANKE's chase: an answer's named particular must be held by the passage that holds the QUESTION's own anchors.
//
// Cells (canon stays here, never in anything shown): ⊨+ EVA·Figure Lens·Binding — a guard that can fire on a
// drafted name/number; ○+ SIG·Figure Entity·Binding — the name resolved to who, by co-location with what was
// asked about; ●+ INS·Figure Entity·Making — a Figure made with no Ground is what a stranger's name is.
//
// FOUND: asked "Who led the opening of the Ostrin footbridge?", a 1B mouth handed BOTH the footbridge paragraph
// and the Vellmar-reopening paragraph answered with the OTHER paragraph's leader. checkGrounding reads that
// draft CLEAN — the name is in a passage. A name that is somewhere in the material is not thereby the one the
// question asked for. The stranger (a name in no passage) is already FOUND by grounding.js; this closes the same
// door from the other side, and hands the mouth a narrower INPUT (P186: a check finds, it never rewrites the mouth).
//
// No threshold: "anchor passages" = those covering the MAXIMUM number of the question's content words, and only
// when that is strictly more than some other passage covers (a structural fact — a tie means nothing to prefer).
import { tokenize } from "../organs/source.js";
import { CLAIM_STOPWORDS, extractCheckableAtoms } from "../organs/grounding.js";

const words = (t) => new Set(tokenize(String(t ?? "").replace(/(\d),(?=\d)/g, "$1")).filter((w) => !CLAIM_STOPWORDS.has(w)));

export function anchorPassages(question, passages) {
  const q = words(question);
  if (!q.size || (passages ?? []).length < 2) return null;
  const cover = passages.map((p) => { const w = words(p.text); let n = 0; for (const t of q) if (w.has(t)) n++; return n; });
  const max = Math.max(...cover);
  if (!max || cover.every((n) => n === max)) return null;
  // A passage another witness already vouched for (the keyless field promoted it: retrievedVia "relative") is an
  // anchor whatever its word coverage — an independent reading found it relevant, so it is not a distractor to
  // narrow away (found by holon.test GFP Pass 35: the chase dropped exactly such a passage).
  const anchored = (p, i) => cover[i] === max || p.retrievedVia === "relative";
  const others = passages.filter((p, i) => !anchored(p, i));
  if (!others.length) return null;
  return { anchors: passages.filter(anchored), others };
}

/** The draft's answer atoms (names/numbers the question did not itself supply) that the anchor passages do not hold.
 * `foreign` = held by another passage (a distractor's particular) or a NAME held by none (a stranger).
 * A number held by no passage is a computed value (the arithmetic engine's), never foreign here. */
export function anchorFindings(question, passages, draft) {
  const split = anchorPassages(question, passages);
  if (!split) return null;
  const held = (ps, atom) => { const w = words(ps.map((p) => p.text).join(" ")); return atom.absent.every((t) => w.has(String(t).toLowerCase())); };
  const atoms = extractCheckableAtoms(draft, { question }).filter((a) => !a.echoesQuestion);
  if (!atoms.length) return null;
  const inAnchor = atoms.filter((a) => held(split.anchors, a));
  if (inAnchor.length) return null; // some answer particular is the anchored one: leave the mouth alone
  const foreign = atoms.filter((a) => held(split.others, a) || a.atomKind === "name");
  return foreign.length ? { ...split, foreign } : null;
}
