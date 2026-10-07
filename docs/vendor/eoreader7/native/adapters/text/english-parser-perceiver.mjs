// adapters/text/english-parser-perceiver.mjs — a perceiver organ wrapping
// english-parser.js's trained UD dependency parser (95.2 UPOS / 81.2 UAS /
// 77.0 LAS held-out), matching the exact interface kernel/perception.js's
// perceive() calls on every perceiver: organ.perceive(encounter, orientation)
// -> an array of relation candidates.
//
// STANDALONE AND UNWIRED. Nothing imports this file into proxy-runner.mjs,
// recursive.js's createSessionReader, or any live path -- item 4 of the
// reading-competency audit (2026-09-23), built as agreed with two peer
// sessions: safe to build and test in isolation, held back from actually
// being wired into session.reader pending explicit sign-off from every
// affected session's user, since that wiring changes live behavior for
// every session's every turn.
//
// THE CONTRACT, verified against real code, not assumed: kernel/perception.js's
// perceive(encounter, orientation, {perceivers}) calls `organ.perceive(encounter,
// orientation, nominations)` on each perceiver and wraps whatever array comes
// back as PerceptCandidate@1. recursive.js's own perceiver (the one actually
// wired to session.reader) shows what a candidate needs to carry to become a
// real hyperedge downstream: `rel.end1`, `rel.label` (or `.verb`), `rel.end2`
// (or `.object`), `rel.offset`, `rel.grain`, `rel.polarity` -- the same shape
// relations.js and relations-gfp.js already emit. This file emits that exact
// shape so it is a structural drop-in for whichever perceiver session.reader
// is built with, once someone is authorized to make that swap.
//
// WHY EVERY VERB, NOT JUST THE CLAUSE ROOT: the gfp-vs-svo-first.mjs eval
// script (this audit's other deliverable) deliberately restricts to
// deprel==="root" to keep gold scoring simple and deterministic. A live
// reading perceiver should not throw away every subordinate/coordinate
// clause's relation just because it isn't the sentence's matrix predicate --
// so this file walks every VERB, not only the root, using the identical
// nsubj*/obj-or-iobj rule per verb (still UD-universal, still no per-verb
// tuning).

import { loadModel, analyse, tokenize, sentences } from "./english-parser.js";
import { makeGrainTyper, cellLabelOf } from "./grain-typing.js";
import { hyperedge } from "../../kernel/hypergraph.js";
import { sha256hex } from "./sha256hex.js";

/** Every {end1, rel, end2} triple in one sentence's parsed rows -- one per
 *  VERB token with both an nsubj* and an obj/iobj dependent, not just the
 *  clause root. `rows` are english-parser.js analyse() output; `tokens` are
 *  the same sentence's tokenize() tokens (parallel arrays, same length,
 *  row.id === i+1 for tokens[i]) so a match can recover real offsets. */
function verbTriplesOf(rows, tokens) {
  const byHead = new Map();
  for (const r of rows) {
    if (r.head == null) continue;
    if (!byHead.has(r.head)) byHead.set(r.head, []);
    byHead.get(r.head).push(r);
  }
  const out = [];
  for (const v of rows) {
    if (v.upos !== "VERB") continue;
    const kids = byHead.get(v.id) ?? [];
    const subj = kids.find((t) => /^nsubj/.test(t.deprel));
    const obj = kids.find((t) => t.deprel === "obj") ?? kids.find((t) => t.deprel === "iobj");
    if (!subj || !obj) continue;
    out.push({ verbRow: v, subjRow: subj, objRow: obj });
  }
  return out;
}

/**
 * createEnglishParserPerceiver({model, posPrior}) -> {perceive}
 *
 * `model`    the object loadModel(json) returns (native/priors/parser-eng-ewt.json).
 * `posPrior` OPTIONAL POSPrior@1, used only to type each relation's cell via
 *            grain-typing.js -- the same cell-typing convention relations-gfp.js
 *            uses. Absent, every relation's cell is "grain_gap" (kept, never
 *            guessed, per the house rule every other reader here follows).
 */
export function createEnglishParserPerceiver({ model, posPrior = null } = {}) {
  if (!model) throw new TypeError("createEnglishParserPerceiver: a loaded english-parser.js model is required");
  const typer = posPrior ? makeGrainTyper(posPrior) : null;

  async function perceive(encounter /*, orientation, nominations */) {
    if (encounter?.modality !== "text" || typeof encounter.material !== "string") return [];
    const material = encounter.material;
    const out = [];

    for (const s of sentences(material)) {
      const sentText = material.slice(s.start, s.end);
      const sentTokens = tokenize(sentText).map((t) => ({ form: t.form, start: s.start + t.start, end: s.start + t.end }));
      if (!sentTokens.length) continue;

      let rows;
      try { rows = analyse(model, sentTokens.map((t) => t.form)); } catch { continue; }

      const sequencePosition = encounter.sequencePosition ?? 0;
      const sourceScope = String(encounter.source ?? "text");

      for (const { verbRow, subjRow, objRow } of verbTriplesOf(rows, sentTokens)) {
        const end1 = sentTokens[subjRow.id - 1]?.form;
        const label = sentTokens[verbRow.id - 1]?.form;
        const end2 = sentTokens[objRow.id - 1]?.form;
        const offset = sentTokens[verbRow.id - 1]?.start ?? s.start;
        if (!end1 || !label || !end2) continue;
        const grain = typer ? typer.grainOf(label) : null;
        const cell = typer ? cellLabelOf(grain) : "grain_gap";
        const grainRecord = grain && !grain.grain_gap ? { operator: grain.op ?? grain.operator, grain: grain.grain, terrain: grain.terrain, stance: grain.stance, settledAs: grain.settledAs } : (grain?.grain_gap ? { grain_gap: grain.grain_gap, settledAs: null } : null);

        // Build a REAL hyperedge, the same way recursive.js's own perceiver
        // does (content-addressed id via sha256hex, matching its newId
        // pattern), so this reaches fold.graphEntries once admitted --
        // confirmed necessary by live testing: admission alone leaves a
        // candidate as a bare witness.js "distinction" with no hyperedge,
        // invisible to everything downstream (queries, reasoning, answer
        // grounding). Participants use the SAME graceful "unresolved_surface"
        // fallback recursive.js's own resolveParticipant degrades to when
        // it can't cross-reference a referent -- this perceiver has no
        // access to that perceiver's private matching cache and must not
        // fake a cross-reference it doesn't have.
        const content = `edge|src:${sourceScope}|rel:${label}|end1:${end1}|end2:${end2}|off:${offset}|perceiver:english-parser`;
        const eid = sha256hex(content);
        const ewit = sha256hex(`${content}|wit`);
        const participant = (surface, role) => {
          const occurrence = sha256hex(`occ|surface:${surface}|seq:${sequencePosition}|off:${offset}|role:${role}|perceiver:english-parser`);
          return { ref: occurrence, occurrence, surfaceKey: `surface:${surface.toLowerCase()}`, role, standing: "unresolved_surface", surface };
        };
        const edge = hyperedge({
          id: eid,
          relation: label,
          participants: [participant(end1, "end1"), participant(end2, "end2")],
          witness: ewit,
          scope: { sequencePosition, offset },
          eo: { op: grainRecord?.operator ?? "CON", grain: grainRecord?.grain ?? "Figure" },
          meta: { source: sourceScope, encounterRef: `encounter:${sequencePosition}`, perceiver: "english-parser" },
        });

        out.push({
          end1, label, end2,
          cell,
          grain: grainRecord,
          polarity: "+", // negation is a declared per-language lens, unmeasured here -- same disclosed choice relations-gfp.js makes
          offset,
          // REQUIRED for admission: kernel/witness.js's default decision is
          // Boolean(candidate.evidence) && sameAnchor(...) -- an unevidenced
          // candidate is refused ("no evidence"), confirmed by testing this
          // perceiver against the real admission path before this field
          // existed. The sentence text is the evidence, matching the
          // existing production perceiver's own convention (recursive.js
          // sets evidence to the encounter's material).
          evidence: sentText,
          // REQUIRED to reach the hypergraph: witness.js only populates an
          // admitted Observation's hyperedges/graphEntries from what the
          // candidate itself declares.
          hyperedges: [edge],
          graphEntries: [edge],
        });
      }
    }
    return out;
  }

  return { perceive };
}

/** Convenience: build the perceiver straight from the same files
 *  english-parser.test.mjs and gfp-vs-svo-first.mjs already load, for a
 *  caller that wants the default model/prior without its own file I/O. */
export async function createEnglishParserPerceiverFromDisk({ readFile, modelPath, posPriorPath = null } = {}) {
  const model = loadModel(JSON.parse(await readFile(modelPath, "utf8")));
  const posPrior = posPriorPath ? JSON.parse(await readFile(posPriorPath, "utf8")) : null;
  return createEnglishParserPerceiver({ model, posPrior });
}
