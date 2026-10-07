// output-holograph.js — THE HOLOGRAPH TYPING organ: generated content whose
// JSON carries, per sentence, the pointer into the record — a byte address
// for every sentence grounded in the verified material, `self:model` for the
// mouth's own prose — so the holograph can project what was THE MODEL vs
// what was US.
//
// THE GOAL (user, 2026-09-16): "any arbitrary content generated with 100%
// of its inspiration explicit through various surfaces (its json contains
// the necessary pointers), and the holograph identifies what was the model
// vs what was us."
//
// THE THREE TIERS (native/docs/THE-HOLOGRAPH.md, cited, never re-derived):
//   THE HOLOGRAPH — text + address (what a reader sees; the record's full
//     projection). THE SHADOW — address only, no words (the deidentified
//     residue; what could be shared without leaking content). THE ECHO —
//     the coarse minimum ("something like this was said here"), the sealed
//     form.
//
// THE TYPING RULE, mechanical never asked of the model: a generated
// sentence is MATERIAL iff it carries a ground fact's ENDS through the SAME
// fold and morphology the record uses — the arrangement's identity is its
// neutral {end1, label, end2} folded, Parmenides' same (P11, the
// arrangement never needs grammatical names). A sentence carrying none is
// the mouth's own prose — SELF:MODEL, marked, never laundered into the
// record. A ground fact with no byte address is a typed gap, never a
// guessed ref. The withhold-vs-convict rule holds: a sentence whose ends
// only PARTIALLY match a ground fact is typed by whether it carries a real
// content end, and the `carry` (0..1) is disclosed, never a silent blend.
//
// PURE. splitSentences and sameAct are INJECTED (the cast.js pattern — the
// engine's own splitter and the morphology prior's sameAct), never imported
// here; a caller reading any language injects that language's own.

export const OUTPUT_HOLOGRAPH_SCHEMA = "EOHolographOutput@1";

// A3 ([M]-as-void vs [M]-as-prose, law 6 companion): the mouth's own prose
// sometimes CLAIMS emptiness ("nothing else", "no mention", "there is no",
// "never mentioned") — a relayed void claim, never a ledger void. Flagged
// mechanically here so the facing page can tag it; never blocked, never
// promoted to a void on the ledger.
export const VOID_CLAIM_RE = /nothing else|no .*mention|there is no|never mentioned/i;

const fold = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f\u0591-\u05c7\u064b-\u0652]/g, "").toLowerCase();
const toks = (t) => [...new Set(fold(t).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1))];
const STOP = new Set(["the", "and", "that", "this", "with", "from", "they", "them", "their", "then", "was", "were", "had", "have", "has", "him", "his", "her", "for", "not", "but", "one", "into", "upon", "over", "down", "across", "about", "after", "before", "which", "when", "where", "what", "who", "whom", "there", "here", "again", "still", "himself", "herself", "itself", "he", "she", "it", "i", "you", "we", "they"]);

/**
 * groundFacts(notes) → [{ fact, end1, label, end2, ref }]
 * The record's ground: admitted arrangements, each with its byte address.
 * A note with no span is a typed gap, never a guessed address.
 */
export function groundFacts(notes = [], { source = "pg2600.txt" } = {}) {
  return (notes ?? [])
    .filter((n) => n && n.end1 && n.label)
    .map((n) => {
      const span = n.span ?? null;
      // THE PER-NOTE SOURCE (2026-09-29, the podcast wiring): a note that
      // names its own witness (a workspace file, a web source) binds under
      // THAT name — "workspace:server.mjs#123" — never flattened onto the
      // caller's one `source` argument. The caller's source is the fallback
      // for notes the record did not witness individually. Provenance is
      // per-arrangement, never per-batch.
      const src = String(n.source ?? "").trim() || source;
      const ref = span && span.start != null ? `${src}#${span.start}` : null;
      return {
        fact: [n.end1, n.label, n.end2].filter(Boolean).join(" "),
        end1: n.end1, label: n.label, end2: n.end2 ?? "",
        ...(ref ? { ref, source: src } : { gap: { type: "no_byte_address", detail: `the arrangement "${[n.end1, n.label, n.end2].filter(Boolean).join(" ")}" has no byte span — never a guessed address` } }),
      };
    });
}

/**
 * holographType({ prose, ground, splitSentences, sameAct }) →
 *   { schema, prose: [...], tiers, verdict }
 *
 * `ground` is groundFacts()'s output (the record's verified arrangements).
 * Each generated sentence is split by the INJECTED engine splitter and typed
 * by the SAME fold/morphology the record uses: MATERIAL iff it carries a
 * ground fact's ends (end1 or end2 content words through sameAct), with the
 * fact's byte address as its ref; else SELF:MODEL with source "the mouth".
 *
 * Returns the per-sentence typed array, the three tiers, and the verdict
 * line answering "what was us vs what was the model".
 */
export function holographType({ prose = "", ground = [], splitSentences = null, sameAct = null, source = "pg2600.txt" } = {}) {
  if (typeof splitSentences !== "function") throw new TypeError("output-holograph: splitSentences is injected — the engine's own, never a local splitter");
  const eq = sameAct ?? ((a, b) => fold(a) === fold(b));
  // `ground` may be raw notes (kernel shapes: {end1,label,end2,span}) or
  // already converted groundFacts() rows — convert raw to the earned shape
  // ONCE, so a caller can hand either and the ref is never guessed.
  const rows = ground.map((g) => {
    if (g && g.fact && (g.ref || g.gap)) return g;
    // THE PER-NOTE SOURCE, SAME LAW AS groundFacts ABOVE (2026-09-29): the
    // raw conversion bound the caller's one `source` onto every note whose
    // own witness the record carried — the same flattening groundFacts
    // refuses. A note that names its own source binds under THAT name.
    const gsrc = String(g?.source ?? "").trim() || source;
    return { fact: [g?.end1, g?.label, g?.end2].filter(Boolean).join(" "), end1: g?.end1, label: g?.label, end2: g?.end2 ?? "", ...(g?.span?.start != null ? { ref: `${gsrc}#${g.span.start}`, source: gsrc } : { gap: { type: "no_byte_address", detail: `no span for "${[g?.end1, g?.label, g?.end2].filter(Boolean).join(" ")}"` } }) };
  });
  const sentences = (() => { try { return splitSentences(prose); } catch { return [prose]; } })()
    .map((s) => (typeof s === "string" ? s : s?.text ?? ""))
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  const typed = sentences.map((text) => {
    const sw = toks(text);
    const content = sw.filter((w) => !STOP.has(w));
    let best = null, bestHits = 0, bestTotal = 0;
    for (const g of rows) {
      const gEnds = toks(`${g.end1} ${g.end2}`).filter((w) => !STOP.has(w));
      // an end word counts if it is literally in the sentence OR same-act
      // to a sentence word (inflectional paraphrase — "roared" for
      // "shouted" is NOT the same act; "orders"/"order" is)
      const hits = gEnds.filter((w) => content.some((c) => c === w || eq(c, w))).length;
      if (hits > bestHits) { bestHits = hits; bestTotal = gEnds.length; best = g; }
    }
    const material = best && bestHits >= 1;
    // A3: self:model prose claiming emptiness is flagged voidClaim — the
    // mouth relaying a void, not the ledger declaring one.
    const voidClaim = !material && VOID_CLAIM_RE.test(text);
    return {
      text,
      ground: material ? "material" : "self:model",
      ...(material ? { ref: best.ref ?? null, groundedOn: best.fact } : { source: "the mouth" }),
      ...(material && !best.ref ? { gap: "grounded but unaddressed" } : {}),
      ...(voidClaim ? { voidClaim: true } : {}),
      carry: bestTotal ? Number((bestHits / bestTotal).toFixed(2)) : 0,
    };
  });

  const material = typed.filter((t) => t.ground === "material");
  const model = typed.filter((t) => t.ground === "self:model");

  return {
    schema: OUTPUT_HOLOGRAPH_SCHEMA,
    prose: typed,
    tiers: {
      holograph: typed.map((t) => ({ text: t.text, ground: t.ground, ref: t.ref ?? null, ...(t.voidClaim ? { voidClaim: true } : {}) })),
      shadow: typed.map((t) => ({ ground: t.ground, ref: t.ref ?? null })),
      echo: { at: "something like this was said here", sentences: material.length, model: model.length },
    },
    verdict: {
      total: typed.length,
      material: material.length,
      model: model.length,
      line: `${material.length} of ${typed.length} sentence(s) grounded in the record; ${model.length} are the mouth's own prose, marked self:model.`,
    },
  };
}