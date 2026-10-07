// loop-check.js — EVERY LOOP OF THE SPIRAL MUST LEAVE SOMETHING USEFUL
// (2026-09-21). The user: "every loop of the spiral, let's check that we're
// creating something useful." The ledger is append-only; the PIECE is not
// allowed to get worse. Each loop's piece is measured against the last one's,
// and a loop that lost ground is undone — the additive-layers rule: the floor
// is already a fine piece, and every layer above must beat or match it.
//
// Measured, in order of precedence:
//   carried    statements of the (selected) draft whose anchors the piece
//              still carries — truth first;
//   answered   the ask's questions that some part still answers;
//   licensed   archon findings still licensing a revision;
//   size       sentences and words, reported, never judged.

import { drawnParts } from "./eot-draft.js";
import { anchorsFor, carries } from "./prosify.js";
import { readPiece } from "./revision-spiral.js";
import { askQuestions } from "./steer.js";

export const LOOP_SCHEMA = "EOLoopCheck@1";

/** The piece as the floor: every selected statement as its own source
 *  sentence, in outline order. True by construction; loop zero. */
export function floorPiece(draft) {
  return drawnParts(draft).map((p) => ({ id: p.id, pieces: p.children.map((pt) => ({ text: pt.text, carries: [pt.id] })) }));
}

export function measurePiece(piece, { draft, ground = "", task = "", parse = null, loadBearing = null } = {}) {
  const A = anchorsFor(draft);
  const said = piece.flatMap((p) => (p.pieces ?? []).map((pc) => pc.text));
  const ids = drawnParts(draft).flatMap((p) => p.children.map((pt) => pt.id));
  const carried = ids.filter((id) => carries(A.get(id), said).ok).length;
  // The ASK's questions, not the ones some section happened to be placed
  // under (measured: OHS read "answers 2 of 2" with no section placed under
  // "what the audit found").
  const asked = askQuestions(task);
  const questions = asked.length > 1 ? asked : [];
  const present = new Set(piece.filter((p) => (p.pieces ?? []).length).map((p) => drawnParts(draft).find((d) => d.id === p.id)?.answers).filter(Boolean));
  const read = readPiece({ piece, draft, ground, task, parse });
  const licensed = read.findings.filter((f) => f.licenses).length;
  // THE DEDUPE (error-corrected 2026-10-02, chasing the boundary-eulogy run):
  // the mouth repeated one invented sentence seven times and the measure
  // called the piece "20 facts carried." Two corrections:
  //   (1) DISTINCT, NOT OCCURRENCES — `carried` already counts ids (distinct),
  //       so the repetition does not inflate the fact count; but the FOLD
  //       that collapses the repeats was UNDONE as "worse" because the piece
  //       still stood with them. The sentence count must not reward
  //       repetition either — repetitionPenalty names it.
  //   (2) ORIGINATION MUST NOT COUNT AS CARRIED — a mouth sentence that
  //       reuses the ground's vocabulary ("wheel", "figure", "boundary")
  //       passes carries()'s overlap test even when the fact's content is
  //       never stated. A fact is CARRIED only when a sentence in the piece
  //       is an admitted flesh of that fact — the mouth may phrase, never
  //       originate (the admission law this file already cites). The
  //       repetition the boundary run ate WAS such an origination: seven
  //       sentences, none in the ground, each counted "carried." The carried
  //       count is now the DISTINCT set of draft statements the piece's
  //       admitted sentences anchor, and originated sentences are counted.
  const repetitionPenalty = said.length - new Set(said.map((s) => s.trim())).size;
  const { carried: carriedUnique, originated } = measureOrigination(piece, draft, A, said);
  return {
    carried: carriedUnique, of: ids.length,
    originated,
    repetitionPenalty,
    answered: questions.length ? questions.filter((q) => present.has(q)).length : null, questions: questions.length,
    licensed,
    sentences: said.length, words: said.join(" ").split(/\s+/).filter(Boolean).length,
    loadBearing,
  };
}

/** THE ORIGINATION CHECK — a fact is carried only by an admitted flesh of
*  that fact, never by a mouth sentence that merely reuses its vocabulary.
  *  The piece's sentences are matched back to the draft statements they were
  *  admitted from (prosify's onRecord carries `carries` per sentence); a
  *  sentence the mouth wrote that anchors no draft statement is ORIGINATED —
  *  a fabrication by the admission law, and it must not count the fact carried.
  *  THE BRIDGE POSITION IS EXEMPT (falsified 2026-10-02): turnPass prepends a
  *  transition sentence as the FIRST piece of a part (finish.js:396,
  *  applyBridge), and it carries [] BY DESIGN — it is a licensed turn, gated
  *  by Clark's missing_transition finding and turnPass's own takes-up/hands-on
  *  checks. Flagging it originated would undo every turns pass. So the
  *  first piece of a part is never itself flagged; a fabrication is a mouth
  *  sentence the mouth inserted INSIDE the flesh, after the part's opening.
  *  Fallback: when the piece lacks carry-metadata, dedupe identical sentences
  *  and flag any sentence that shares >half its words with no draft statement
  *  as originated (a nomination, disclosed, never a proof). */
function measureOrigination(piece, draft, A) {
  const ids = drawnParts(draft).flatMap((p) => p.children.map((pt) => pt.id));
  const byId = new Map(ids.map((id) => [id, A.get(id)]));
  const carried = new Set();
  const originated = [];
  for (const p of piece) {
    const seenHere = new Set();
    const pieces = p.pieces ?? [];
    for (let k = 0; k < pieces.length; k++) {
      const pc = pieces[k];
      const text = String(pc.text ?? "").trim();
      const isBridgePosition = k === 0;
      if (!text || seenHere.has(text)) { if (seenHere.has(text)) originated.push({ text, why: "repeated verbatim" }); continue; }
      seenHere.add(text);
      if (Array.isArray(pc.carries) && pc.carries.length) {
        for (const id of pc.carries) if (byId.has(id)) carried.add(id);
        continue;
      }
      if (isBridgePosition) continue; // a licensed turn, not a fabrication
      // no carry metadata: does the sentence anchor a draft statement?
      const hits = [...byId.entries()].filter(([, a]) => carries(a, [text]).ok).map(([id]) => id);
      if (hits.length) hits.forEach((id) => carried.add(id));
      else originated.push({ text, why: "no draft statement it anchors" });
    }
  }
  return { carried: carried.size, originated };
}

/** Did this loop leave the piece at least as useful as the last one? Truth
 *  first: fewer facts carried, or fewer questions answered, is worse whatever
 *  else improved; then more findings licensing a revision is worse. */
//  Each loop is judged on ITS OWN charge (measured: judging the prose loop
//  against the floor's zero findings undid every prose pass, and the pipeline
//  fell back to the source sentences). The prose loop's charge is voice, so
//  new findings are its expected work for the loops after it; it may not lose
//  facts or questions. Every later loop exists to reduce findings, so it may
//  not add any either.
export function judgeLoop(prev, now, { addsFindings = false } = {}) {
  if (!prev) return { verdict: "first", keep: true, why: "loop zero: the floor, true by construction" };
  // ORIGINATION IS WORSE, WHATEVER ELSE IMPROVED (error-corrected 2026-10-02):
  // the mouth may phrase, never originate (admission law). A loop that adds
  // a sentence anchoring no draft statement has fabricated; it is undone
  // even if the fact count looks fine — the fabrication was counted carried
  // before this correction, which is precisely the boundary-eulogy defect.
  if ((now.originated?.length ?? 0) > (prev.originated?.length ?? 0)) return { verdict: "worse", keep: false, why: `originated ${now.originated.length} sentence(s) anchoring no draft statement — the mouth may phrase, never originate` };
  if (now.carried < prev.carried) return { verdict: "worse", keep: false, why: `carries ${now.carried} of ${now.of} facts, the last loop carried ${prev.carried}` };
  if (now.answered != null && prev.answered != null && now.answered < prev.answered) return { verdict: "worse", keep: false, why: `answers ${now.answered} of ${now.questions} questions, the last loop answered ${prev.answered}` };
  if (now.licensed > prev.licensed && addsFindings) return { verdict: "kept", keep: true, why: `loses nothing it may not; ${now.licensed - prev.licensed} new finding(s) are for the loops after it to read` };
  if (now.licensed > prev.licensed) return { verdict: "worse", keep: false, why: `${now.licensed} findings still license a revision, the last loop left ${prev.licensed}` };
  const better = now.carried > prev.carried || now.licensed < prev.licensed || (now.answered ?? 0) > (prev.answered ?? 0);
  return { verdict: better ? "better" : "same", keep: true, why: better ? "gains on truth or findings, loses nothing" : "loses nothing" };
}

export function loopLine(name, m, j) {
  const loadBearingNote = m.loadBearing != null ? ` · thesis load-bearing: ${m.loadBearing}` : "";
  const originationNote = (m.originated?.length ?? 0) ? ` · originated ${m.originated.length} (${m.originated.map((o) => (o.text ?? "").slice(0, 24) || o.why).join(" | ")})` : "";
  const repetitionNote = m.repetitionPenalty ? ` · ${m.repetitionPenalty} verbatim repeat(s)` : "";
  return `${name}: ${j.verdict}${j.keep ? "" : " — UNDONE"}\ncarries ${m.carried} of ${m.of} facts${m.questions ? ` · answers ${m.answered} of ${m.questions} questions` : ""}${originationNote}${repetitionNote} · ${m.licensed} finding(s) licensing a revision · ${m.sentences} sentences, ${m.words} words${loadBearingNote}\n${j.why}`;
}
