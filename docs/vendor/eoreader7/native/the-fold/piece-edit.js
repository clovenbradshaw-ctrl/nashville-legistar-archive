// piece-edit.js — the unconscious edits the mouth (P111). Pure.
//
// User direction, 2026-09-05: "the unconscious should be able to edit the
// model's output — we often edit things without consciously knowing why;
// the EVA need not be the model at all times." So the instrument edits a
// finished piece the way it checks one: mechanically, with no model call,
// every edit an act with its reason on the record, never a silent change.
//
// The edits, each a SEG (a cut) or a SYN (a merge) landed as an entry:
//   1. a sentence that restates an earlier section — the same folded
//      sentence, or one whose every 8-word run already appeared earlier in
//      the piece — is cut; the 8 is the same declared run the copy-check
//      uses (never a similarity score);
//   2. a section left without a full sentence after cuts is dropped, its
//      label kept on the record with why;
//   3. a section whose surviving bound claims are all in earlier sections'
//      claim sets is merged away (its residue, if any, appended to the
//      previous section) — the record remembers what the piece already
//      said, so the piece does not say it again.
// Order is the plan's own: the editor cuts and merges; it does not yet
// reorder (the network's order is named, not wired).
const N = 8;
const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const grams = (ws, n = N) => { const out = new Set(); for (let i = 0; i + n <= ws.length; i += 1) out.add(ws.slice(i, i + n).join(" ")); return out; };
const wordsOf = (t) => fold(t).split(" ").filter(Boolean);

/**
 * editPiece(sections, { splitSentences }) → { sections, edits }
 * sections: [{ label, text, claims: [{key, verdict}] }] in reading order.
 */
export function editPiece(sections, { splitSentences } = {}) {
  if (typeof splitSentences !== "function") throw new TypeError("editPiece: splitSentences is injected");
  const edits = [];
  const seenSentences = new Set();
  const seenGrams = new Set();
  const seenClaims = new Set();
  const out = [];
  for (const [i, s] of (sections ?? []).entries()) {
    const sentences = splitSentences(String(s.text ?? "")).map((x) => x.trim()).filter(Boolean);
    const kept = [];
    for (const sent of sentences) {
      const f = fold(sent);
      const ws = f.split(" ").filter(Boolean);
      const g = grams(ws);
      const restates = seenSentences.has(f) || (g.size > 0 && [...g].every((x) => seenGrams.has(x)));
      if (restates) { edits.push({ op: "SEG", kind: "restated-sentence", section: s.label, index: i, sentence: sent }); continue; }
      kept.push(sent);
    }
    // what this section adds to the piece's memory, once its cuts are made
    for (const sent of kept) { seenSentences.add(fold(sent)); for (const x of grams(wordsOf(sent))) seenGrams.add(x); }
    const boundKeys = (s.claims ?? []).filter((c) => c.verdict === "bound").map((c) => String(c.key ?? "").toLowerCase()).filter(Boolean);
    const allSaid = boundKeys.length > 0 && boundKeys.every((k) => seenClaims.has(k));
    const text = kept.join(" ");
    if (!kept.length) { edits.push({ op: "SEG", kind: "empty-section", section: s.label, index: i, because: `${sentences.length} sentence(s), every one a restatement` }); continue; }
    if (allSaid && out.length) {
      // merged away: its residue rides the previous section, its claims add nothing
      edits.push({ op: "SYN", kind: "merged-section", section: s.label, index: i, into: out.at(-1).label, because: `${boundKeys.length} bound claim(s), all already said` });
      out.at(-1).text = `${out.at(-1).text}\n\n${text}`.trim();
      continue;
    }
    for (const k of boundKeys) seenClaims.add(k);
    out.push({ ...s, text });
  }
  return { sections: out, edits };
}

/** One line per edit, for the thinking panel and the record. */
export const editLine = (e) => e.kind === "restated-sentence" ? `cut from "${e.section}": restates an earlier section — “${String(e.sentence).slice(0, 80)}${e.sentence.length > 80 ? "…" : ""}”` : e.kind === "empty-section" ? `dropped "${e.section}": ${e.because}` : `merged "${e.section}" into "${e.into}": ${e.because}`;
