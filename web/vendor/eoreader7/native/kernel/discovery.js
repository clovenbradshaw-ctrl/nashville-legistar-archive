// kernel/discovery.js — THE DISCOVERY (the LLM's proper place: proposing,
// never measuring). When a genre is registered and the meaning potential
// holds no discovered framing for it yet, the LLM is TASKED to "go find
// what makes a good <genre>": its staging (the phases a <genre> is made of),
// its write voice (the prompt that would produce one), its felt target.
// The trajectory through meaning space is REC'd as footprints (appendFraming)
// so the next request starts from where this one landed — easier next time.
//
// The LLM proposes; the structural organs (satisfaction, the wheel's EVA)
// dispose. Nothing the LLM writes here is a measurement.
import { appendFraming, framingFor } from "./fortune-prior.js";

export const DISCOVERY_SCHEMA = "EODiscovery@1";

/**
 * discoveredFramingFor(prior, { genre, medium }) → the latest footprint, or
 * null when this genre has never been discovered.
 */
export function discoveredFramingFor(prior, { genre, medium = "text" } = {}) {
  return framingFor(prior, { genre, medium });
}

/**
 * discoverFraming({ register, impression, prior, upstream, model, draw }) →
 * { framing, appended, from } — the LLM's proposal, REC'd onto the sidecar.
 * `draw` is the caller's model call: (msgs, maxTokens) → text. The framing
 * must be JSON; a malformed proposal is refused, never half-adopted (III.3).
 */
export async function discoverFraming({ register, impression = null, prior = null, upstream = null, model = null, draw = null }) {
  const genre = register?.field?.field ?? register?.genre ?? "the genre";
  const mode = register?.mode ?? "text";
  const tenor = register?.tenor?.tenor ?? "general";
  const evidence = impression?.evidence ?? [];
  // THE FOOTPRINT — the possibility, never the machine's own sentences
  // (2026-09-20, omnilingual): the evidence `basis` strings are the instrument
  // talking about ITS OWN operations ("the egress is open — genre material is
  // hunted and appended, never assumed"). Handing them to the LLM as content
  // invites an echo in ANY language — the same basis was restated verbatim by
  // a small model and became essay sections, and a translated echo (German,
  // Chinese, Arabic, Russian of the same sentence) evades any surface filter.
  // The universal is to never offer the basis at all: the LLM gets the phases
  // and shapes the machine actually SAW (the possibility space), not the
  // prose about how the machine saw them. When there is no seen content, the
  // prompt already names the honest fallback (the genre's generic arc).
  const seenPhases = [...new Set(evidence.flatMap((e) => e.phases ?? []).filter((p) => p && String(p).length > 2))].slice(0, 10);
  const seenShapes = [...new Set(evidence.flatMap((e) => e.shapes ?? []).filter((s) => s && String(s).length > 2))].slice(0, 5);
  const footprints = [
    seenPhases.length ? `the phases the machine has actually seen (possibility): ${seenPhases.join(" | ")}` : null,
    seenShapes.length ? `the shapes the machine has actually measured: ${seenShapes.join(" | ")}` : null,
  ].filter(Boolean).join("; ") || "the machine has seen no phases yet — supply the genre's generic arc as a fallback, but name the beat of each phase";
  // THE POSSIBILITY SPACE (the low level — the machine's own footprint):
  // the phases and shapes it has ACTUALLY seen. The high level (the LLM) may
  // only propose a PROBABILITY over this space — rank/select/name within it,
  // or supply the generic arc only when the space is empty. A proposal is a
  // probability distribution, never a free invention. (seenPhases/seenShapes
  // above are the same set — one computation; `possibility` is `footprints`,
  // shown once in the ask.)
  const possiblePhases = seenPhases;
  const possibleShapes = seenShapes;
  const possibility = footprints;

  const ask = (refusal = null) => [
    `You are discovering what makes a good ${genre} carried in ${mode} for ${tenor}.`,
    `The LOW level sets the possibility; YOU set the probability. ${possibility}.`,
    `Here is what the machine already knows (footprints):`,
    footprints,
    ``,
    `Go find what makes a good ${genre}: its SHAPE (the arc its fortune takes), its STAGING (the phases a ${genre} is made of, in order), its WRITE VOICE, and its FELT TARGET (what the reader should feel by the end).`,
    ``,
    `CRITICAL — write INSTRUCTIONS, never examples. Do not write any story prose. Every field is an imperative command to a writer, not a sample of what to write.`,
    ``,
    `- "staging": the phases a ${genre} is made of, as concrete beats, not abstract labels. If the honest answer is an arc label ("rising action"), say what HAPPENS in that phase ("the moment of no return").`,
    // NO EXAMPLE IS HANDED OVER (2026-09-21, measured). This file's own law,
    // stated a hundred lines below, is that "a sentence that was never handed
    // over cannot be restated in any language" — and these two lines used to
    // hand over a concrete NARRATIVE command ("Begin in the middle of a
    // concrete moment... never a thesis") as an e.g. for EVERY genre. A small
    // mouth copies an example; both stored exposition framings in the sidecar
    // carry that exact sentence verbatim, so every essay run inherited a
    // story voice that forbids a thesis. The slot is now described by its
    // STRUCTURE (who it addresses, what it governs) and carries no sentence
    // to copy. The law now holds for the voice fields too, not only staging.
    `- "writeVoice.opening": an imperative addressed to the writer, telling them how to BEGIN a ${genre} — what to do first. It governs writing; it is never itself a line of the ${genre}.`,
    `- "writeVoice.body": an imperative addressed to the writer, telling them how to CONTINUE each phase of a ${genre}. It governs writing; it is never itself a line of the ${genre}.`,
    `- "feltTarget": a JSON object {shape: "the arc's shape in one phrase", releases: N (how many felt releases a ${genre} delivers), tension: "what the tension is and how it is released"}.`,
    ``,
    refusal ? `YOUR LAST REPLY WAS REFUSED: ${refusal}. Respond again, correct this time.` : "",
    `Respond with JSON only, no commentary, no prose outside the JSON, no markdown fences:`,
    `{"staging": ["...", "..."], "writeVoice": {"opening": "...", "body": "..."}, "feltTarget": {"shape": "...", "releases": N, "tension": "..."}}`,
  ].filter(Boolean).join("\n");

  // WHAT WE HANDED OVER, EXACTLY (2026-09-21). Everything the model was shown
  // is refusable if it comes back: an echo is the prompt talking to itself,
  // and comparing against the bytes we sent works in every language, because
  // it compares against THIS text rather than against a vocabulary. The
  // normalisation is script-neutral (letters and digits, case-folded).
  const normLine = (x) => String(x ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  // THE POSSIBILITY IS NOT AN ECHO. The ask deliberately hands over the phases
  // and shapes the machine has seen, and the whole design is that the high
  // level RANKS AND SELECTS within that space — so a staging that repeats a
  // seen phase is the mechanism working, not a reflection. Only the ask's own
  // INSTRUCTION lines are off limits. Every line carrying a seen phase or
  // shape is therefore removed from what counts as handed-over instruction.
  const possibility_ = [...possiblePhases, ...possibleShapes].map(normLine).filter((x) => x.length > 2);
  const handedOver = new Set(
    ask().split("\n").map(normLine)
      .filter((l) => l.length > 12)
      .filter((l) => !possibility_.some((seen) => l.includes(seen)))
  );
  const isEcho = (x) => {
    const n = normLine(x);
    if (n.length < 12) return false;
    for (const line of handedOver) if (line.includes(n) || n.includes(line)) return true;
    return false;
  };

  const propose = async (refusal = null) => {
    let text = null;
    if (draw) {
      try { text = await draw([{ role: "user", content: ask(refusal) }], 600, {}); } catch {}
    } else if (upstream && model) {
      try {
        const r = await fetch(`${upstream}/api/chat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model, messages: [{ role: "user", content: ask(refusal) }], stream: false, options: { temperature: 0.4, num_predict: 600 } }),
        });
        if (r.ok) { const d = await r.json(); text = d?.message?.content ?? null; }
      } catch {}
    }
    return text;
  };

  // THE LOOP (loops on loops): the low level refuses what is outside its
  // possibility space and feeds the refusal back down; the high level
  // re-proposes a probability within it. Bounded — a loop that never lands
  // is a gap, never an infinite climb.
  let framing = null;
  let basis = "the LLM's trajectory, REC'd as footprints for next time";
  let from = "discovery";
  let refusal = null;
  for (let attempt = 1; attempt <= 3 && !framing; attempt += 1) {
    const text = await propose(refusal);
    if (!text) { from = "refused"; basis = "no model proposal — the discovery could not run"; break; }
    let parsed = null;
    try {
      const stripped = String(text).replace(/```(?:json)?/gi, "").trim();
      const m = stripped.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    } catch (e) { parsed = null; refusal = `invalid JSON (${e?.message ?? "could not parse"})`; }
    if (!parsed || !Array.isArray(parsed.staging) || !parsed.staging.length || !parsed.writeVoice || !parsed.writeVoice.opening) {
      refusal = refusal ?? "missing a required field — staging must be a non-empty array and writeVoice.opening must be a command";
      framing = null; from = "refused"; basis = `refused (attempt ${attempt}): ${refusal}`;
      continue;
    }
    // THE ECHO REFUSAL: a field that repeats a line of our own ask is the
    // prompt reflected, not a discovery. Refused and fed back down, exactly
    // as a malformed proposal is — the loop re-proposes within the space.
    const echoed = [parsed.writeVoice.opening, parsed.writeVoice.body, ...(parsed.staging ?? [])].find(isEcho);
    if (echoed) {
      refusal = `a field repeated our own instructions back ("${String(echoed).slice(0, 60)}…"). Write your own, about the genre.`;
      framing = null; from = "refused"; basis = `refused (attempt ${attempt}): echoed the ask`;
      continue;
    }
    framing = parsed;
  }
  if (!framing) return { framing: null, appended: false, from, basis };

  framing.staging = framing.staging.map((s) => String(s).trim()).filter((s) => s && s.length > 2).slice(0, 7);

  // THE OMNILINGUAL GUARANTEE (2026-09-20, Chomsky — the universal over the
  // lexical): a staging phase is a genre beat ("the moment of no return"),
  // NEVER the machine's own words about the hunt. The measured defect: the
  // prompt once handed the LLM the evidence `basis` sentences ("the egress is
  // open — genre material is hunted and appended, never assumed") and a small
  // model echoed one verbatim as a staging phase — which became an essay
  // section ("What is The web is hunted and appended...?"). Any SURFACE filter
  // against that defect is language-bound: an English keyword list misses the
  // German, Chinese, or Arabic restatement of the same sentence, and even a
  // character-overlap test only compares against the bases actually present,
  // which are themselves written in whatever language the instrument speaks.
  // The universal fix is STRUCTURAL, not lexical: the machine's own basis prose
  // is never offered to the model (see the footprints above — only the seen
  // phases and shapes are). A sentence that was never handed over cannot be
  // restated in any language. There is nothing to filter; the filter would be
  // the language-bound mistake. The falsifying control: if the basis sentences
  // ever reach the prompt again (a regression in the footprints build), the
  // defect returns — pinned by discovery.test.mjs.
  //

  const appended = prior ? appendFraming(prior, { genre, medium: mode, framing, basis: `discovered by the LLM over the possibility space: ${evidence.length} footprints consulted`, giver: `model:${model ?? "draw"}` }) : false;
  return { framing, appended, from, basis };
}

/**
 * The discovery proposal APPLIED: staging replaces the meaning potential's
 * phases when the discovery is fresh; the write voice overrides the register
 * table when the discovery names one. The register tables are the fallback
 * for an empty meaning potential — never the first answer.
 *
 * THE GROUND COMES FIRST (2026-09-21): `keepSectionsWhenGrounded` is the
 * caller's honest reading of whether the piece has material (workspace/web)
 * to write from. When it does, the discovery's STAGING is a genre-arc the
 * material doesn't discuss — replacing material-themed sections with arc
 * phases ("the moment of no return" for an essay about a river) yields
 * sections that share nothing with the ground, fail the grounding gate, and
 * churn in revisions without growing (measured in the 3-agent paper
 * benchmark). So the sections STAND (the material's own structure), and only
 * the WRITE VOICE + felt target are taken from the discovery. When there is
 * no ground, the arc staging is the honest fallback and replaces the empty
 * or generic section list.
 */
export function applyDiscovered({ framing = null, sections = [], questionFor = null, topic = "", keepSectionsWhenGrounded = false } = {}) {
  if (!framing) return { sections, voice: null, basis: "no framing — the register's own staging stands" };
  const staged = [...new Set(framing.staging ?? [])].slice(0, 7);
  const groundedSections = keepSectionsWhenGrounded && sections.length >= 2;
  const nextSections = !groundedSections && staged.length >= 2
    ? staged.map((f) => (questionFor ? questionFor(f, topic) : f))
    : sections;
  return {
    sections: nextSections,
    voice: framing.writeVoice ?? null,
    basis: groundedSections
      ? "the piece is grounded — the material's own sections stand; the discovery's staging is declined, its voice taken"
      : "the discovery's staging and voice applied",
  };
}