// finish.js — FOLD, TIGHTEN, ARRIVE: the last three stages of the generation
// pipeline, rebuilt for a piece that already has its shape.
//
//   … → EOT draft → prosified pass → FOLD → TIGHTEN → ARRIVE
//
// On the old composition path these stages had to find the piece's shape:
// the fold assembled a wide draft into beats, and "The tension [gap]" came
// from a table of beats about one river. Here the shape is the EOT draft, so
// each stage has a narrower, sharper job, and each is judged against the
// statements the draft already declared.
//
// FOLD. Across the whole piece, a sentence that carries NO statement and
// brings no grounded matter the piece has not already said is a restatement,
// and it is folded away — typically a part opening by re-saying the last one
// ("The river's influence on Nashville's growth is undeniable…"). A sentence
// that carries a statement is never folded: it is the content the draft
// required. The statements set what is possible; the fold only removes what
// adds nothing to them.
//
// TIGHTEN. A TIC is a word the material never uses that the prose uses more
// than once — "bustling" three times in one part, "testament", "fueled".
// Measured on the piece itself; no list of bad words. Each sentence holding a
// tic is offered to the mouth for a plain rewrite, and the rewrite is kept
// only if every statement the sentence carried still has its anchors, it names
// nothing the material does not, and it is no longer than what it replaces.
// Words are never deleted mechanically: removing "arrived" or "connecting"
// from a sentence breaks it, which is why the old path's word cut is not used
// here. A rejected rewrite leaves the sentence as it was.
//
// ARRIVE. The piece has arrived when four measured signals hold: every
// statement is carried; every planned turn was taken; no statement is said in
// two parts; no tic is left. The verdict names each missing signal — a run is
// never simply "not done".
//
// Nothing here edits. Every change is returned as a replacement the caller
// appends to the ledger as a superseding line.

import { segmentSentences } from "./admission.js";
import { inventedNameRuns, isMetaSentence } from "./referent-verify.js";
import { draftWords, namesOf, drawnParts } from "./eot-draft.js";
import { anchorsFor, carries } from "./prosify.js";
import { isFunctionWord, isCommonWord, dominantClass } from "./pos-prior.js";

export const FINISH_SCHEMA = "EOFinish@1";

const groundVocab = (ground) => new Set(draftWords(ground));

// The received English part-of-speech prior (pos-prior.js) decides what is a
// function word and what capital is a common word rather than a name.
/** Words carried by more parts of the material than not: the subject. A turn
 *  that shares only these has taken up nothing. */
function subjectWords(draft) {
  const parts = drawnParts(draft);
  const df = new Map();
  for (const p of parts) for (const w of new Set(draftWords(p.text))) df.set(w, (df.get(w) ?? 0) + 1);
  return new Set([...df.entries()].filter(([, d]) => d * 2 > parts.length).map(([w]) => w));
}

// ── FOLD ────────────────────────────────────────────────────────────────────
export function foldPiece(parts, { ground = "" } = {}) {
  const known = groundVocab(ground);
  const said = new Set();
  const folded = [];
  const out = parts.map((p) => {
    const keep = [];
    for (const pc of p.pieces ?? []) {
      const matter = [...new Set(draftWords(pc.text))].filter((w) => known.has(w));
      if (!pc.carries.length && matter.every((w) => said.has(w))) {
        folded.push({ part: p.id, sentence: pc.text, reason: matter.length ? "carries no statement and says nothing the piece has not already said" : "carries no statement and holds no grounded matter" });
      } else keep.push(pc);
      for (const w of matter) said.add(w);
    }
    return { ...p, pieces: keep, prose: keep.map((x) => x.text).join(" ") };
  });
  return { parts: out, folded };
}

// ── TIGHTEN ─────────────────────────────────────────────────────────────────
/** Words the prose uses more than once that the material never uses: the
 *  mouth's tics, measured on this piece. */
export function ticsOf(parts, { ground = "", task = "" } = {}) {
  // Known: the material's words and the ASK's words. "growth" and "role" are
  // the operator's own vocabulary, measured as tics on the first probe.
  const known = new Set([...groundVocab(ground), ...draftWords(task)]);
  const count = new Map();
  for (const p of parts) for (const pc of p.pieces ?? []) for (const w of draftWords(pc.text)) {
    if (known.has(w) || isFunctionWord(w)) continue;
    count.set(w, (count.get(w) ?? 0) + 1);
  }
  return new Map([...count.entries()].filter(([, n]) => n > 1));
}

/**
 * lishCut(sentence, { keeps, flagged, known }) → the sentence with its
 * DECORATION cut, or null. LISH (micro.pathos, cut to charge), taught
 * 2026-09-21: run 7's mouth, asked to "rewrite plainly", made 12 of 18
 * refused rewrites longer and kept its tics in 13 (some did both). Its tics
 * sit in comma-bounded add-ons that carry no fact: ", a testament to …",
 * ", a man of foresight,", ", aiming to harness …". So the cut is made
 * without a model. A comma-bounded segment is cut when
 *   - it holds a flagged word, or most of its content words are not in the
 *     material (an invented trait or purpose), and
 *   - what remains still carries every fact the sentence carried (`keeps`)
 *     and still holds a verb (the prior's dominant class), so the cut never
 *     leaves a fragment.
 * Grounded list items ("Cotton, tobacco, iron, and lumber") are never cut:
 * they are in the material and hold no tic.
 */
export function lishCut(sentence, { keeps = () => true, flagged = new Set(), known = new Set(), complete = null, core = null } = {}) {
  const text = String(sentence ?? "").trim();
  const end = /[.!?]$/.test(text) ? text.slice(-1) : ".";
  let segs = text.replace(/[.!?]$/, "").split(/,\s+|\s+[—–]\s+/);
  // A comma after an adjective joins a series ("in its quiet, unassuming
  // way"); it does not bound a segment (run 9 left "The river unassuming way").
  const lastWord = (x) => (x.trim().split(/\s+/).at(-1) ?? "").toLowerCase().replace(/[^\p{L}'’-]/gu, "");
  for (let i = 0; i < segs.length - 1;) {
    if (dominantClass(lastWord(segs[i])) === "ADJ") segs.splice(i, 2, `${segs[i]}, ${segs[i + 1]}`); else i++;
  }
  if (segs.length < 2) return null;
  const firstWord = (x) => (x.trim().split(/\s+/)[0] ?? "").toLowerCase();
  const content = (seg) => draftWords(seg).filter((w) => !isFunctionWord(w));
  const hasVerb = (t) => t.toLowerCase().split(/[^\p{L}'’]+/u).some((w) => ["VERB", "AUX"].includes(dominantClass(w)));
  const build = (xs) => { const t = xs.join(", ").trim(); return t ? t[0].toUpperCase() + t.slice(1) + end : ""; };
  let cut = false;
  const wasComplete = complete ? complete(text) : false;
  const coreWas = core ? core(text) : null;
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < segs.length && segs.length > 1; i++) {
      const c = content(segs[i]);
      const decorated = c.some((w) => flagged.has(w)) || (c.length > 0 && c.filter((w) => !known.has(w)).length * 2 > c.length);
      if (!decorated) continue;
      // A segment opening on a coordinator or subordinator is a CLAUSE, not
      // decoration (", but its influence …", ", while goods flowed back up").
      if (i > 0 && ["CCONJ", "SCONJ"].includes(dominantClass(firstWord(segs[i])))) continue;
      // Nor the first half of a pair whose second half opens on a coordinator
      // ("not just in the form of …, but also …" — run 11 closed up into
      // "brought danger but also in the form of hidden hazards").
      if (i < segs.length - 1 && ["CCONJ", "SCONJ"].includes(dominantClass(firstWord(segs[i + 1])))) continue;
      // A middle segment is an interruption: its two neighbours close up with
      // a space ("Donelson, a man of foresight, led" → "Donelson led").
      const rest = i > 0 && i < segs.length - 1
        ? [...segs.slice(0, i - 1), `${segs[i - 1]} ${segs[i + 1]}`, ...segs.slice(i + 2)]
        : segs.filter((_, j) => j !== i);
      const t = build(rest);
      // With the parser, the clause core decides; the POS prior's verb test
      // is only the fallback (falsifier: "devastated", "sustained" are unseen
      // by the prior, so correct cuts were refused).
      if (!t || (!core && !hasVerb(t)) || !keeps(t)) continue;
      // NEVER A FRAGMENT (run 8: "Remains the reason the city is where it
      // is." — the cut took the subject). A remainder may not open on a verb,
      // and, when a clause test is supplied (the parser: the root has a
      // subject), a sentence the parser reads as complete must stay complete.
      // Relative, because the parser also misreads some whole sentences.
      if (["VERB", "AUX"].includes(dominantClass(t.split(/[^\p{L}'’]+/u)[0].toLowerCase()))) continue;
      if (complete && wasComplete && !complete(t)) continue;
      // THE CORE STAYS (run 9: "The USGS gage …, provides a snapshot …,
      // offering …" lost its verb; "in its quiet, unassuming way" was split
      // at an adjective comma and left "The river unassuming way"). When the
      // parser reads the original's root and subject, the cut must keep both.
      if (core && coreWas && core(t) !== coreWas) continue;
      // And when the parser is present, what is left must have a core of its
      // own even if the original's parse had none (run 10: "Finally, Cheatham
      // Dam, located below the city." — the original was misparsed, so there
      // was nothing to compare, and the cut kept no predicate).
      if (core && !core(t)) continue;
      // Nor may it open on a coordinator left behind ("But its influence …").
      if (dominantClass(t.split(/[^\p{L}'’]+/u)[0].toLowerCase()) === "CCONJ") continue;
      segs = rest; cut = true; changed = true; break;
    }
  }
  if (cut) return build(segs);
  // A SINGLE FLAGGED ADJECTIVE SHARING A SEGMENT WITH A REAL FACT (2026-09-26,
  // measured live: "transporting vital cotton to New Orleans" — "vital" is
  // decoration, but the segment also carries the cotton/New Orleans fact, so
  // the whole-segment cut above can never remove it without keeps() correctly
  // refusing the loss of that fact too). Real run: every model rewrite of
  // this exact sentence came back LONGER than the original and was refused,
  // pass after pass, five times, never fixed. This tries the narrowest
  // possible edit — ONE flagged word, never a whole segment — and reuses
  // every guard above UNCHANGED: hasVerb/core, keeps(), complete(), the
  // clause's own core, and no leading coordinator. Never a new or looser
  // check, only a narrower unit of removal.
  const built = build(segs);
  for (const tok of new Set(draftWords(built))) {
    if (!flagged.has(tok) || dominantClass(tok) !== "ADJ") continue;
    const re = new RegExp(`\\s*\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b\\s*`, "i");
    const t = built.replace(re, " ").replace(/\s{2,}/g, " ").trim();
    if (!t || t === built) continue;
    if ((!core && !hasVerb(t)) || !keeps(t)) continue;
    if (["VERB", "AUX"].includes(dominantClass(t.split(/[^\p{L}'’]+/u)[0].toLowerCase()))) continue;
    if (complete && wasComplete && !complete(t)) continue;
    if (core && coreWas && core(t) !== coreWas) continue;
    if (core && !core(t)) continue;
    if (dominantClass(t.split(/[^\p{L}'’]+/u)[0].toLowerCase()) === "CCONJ") continue;
    return t;
  }
  return null;
}

export async function tightenPiece(parts, { draft, draw, ground = "", task = "", voice = null, targets = null, complete = null, core = null, unit = "sentence" } = {}) {
  // VERSE IS NOT TIGHTENED (2026-09-22, nine-sonnet-2): Lish's cut took "A
  // ribbon of silver," off a line and left "Through the hills it flows,."
  // — a line's decoration is its charge and its meter is the discipline.
  // Declared, not measured: no organ yet reads a line for what it may lose.
  if (unit === "line") return { parts, changes: [], tics: [], skipped: "declared: verse is not tightened — a line's decoration is its charge; no organ yet reads what a line may lose" };
  const anchors = anchorsFor(draft);
  // `targets` (sentence → words) is what the ARCHONS flagged; without it the
  // measured tics stand in. The rewrite must reduce exactly those words.
  const tics = targets
    ? new Map([...new Set([...targets.values()].flat())].map((w) => [w, 2]))
    : ticsOf(parts, { ground, task });
  const changes = [];
  const out = [];
  const pointText = new Map(drawnParts(draft).flatMap((dp) => (dp.children ?? []).map((pt) => [pt.id, pt.text])));
  for (const p of parts) {
    const pieces = [];
    for (const pc of p.pieces ?? []) {
      // A cut keeps every word the sentence shares with the source statements
      // it carries (run 10: "…, with the once-industrial warehouses replaced
      // by vibrant parkland" was cut as invention though it held the fact).
      const sourceWords = new Set(pc.carries.flatMap((id) => draftWords(pointText.get(id) ?? "")).filter((w) => !isFunctionWord(w)));
      const shared = draftWords(pc.text).filter((w) => sourceWords.has(w));
      const keepsWords = (t) => { const ws = new Set(draftWords(t)); return shared.every((w) => ws.has(w)); };
      const here = targets ? (targets.get(pc.text) ?? []) : draftWords(pc.text).filter((w) => tics.has(w));
      if (!here.length) {
        // LISH READS EVERY SENTENCE for invented add-ons — a segment most of
        // whose words the material never uses ("Donelson, a man of vision
        // and resourcefulness, led …"). No flagged words, no model: cut or keep.
        const keepsAll = (t) => keepsWords(t) && pc.carries.every((id) => carries(anchors.get(id), [t]).ok);
        const inv = lishCut(pc.text, { keeps: keepsAll, known: groundVocab(ground), complete, core });
        if (inv) { pieces.push({ text: inv, carries: [...pc.carries] }); changes.push({ part: p.id, from: pc.text, to: inv, tics: [], kept: true, reasons: [], raw: null, by: "lish-cut" }); }
        else pieces.push(pc);
        continue;
      }
      // LISH FIRST: cut the decoration without a model when that is enough.
      const flaggedHere = new Set(here);
      const keeps = (t) => keepsWords(t) && pc.carries.every((id) => carries(anchors.get(id), [t]).ok);
      const cutText = lishCut(pc.text, { keeps, flagged: flaggedHere, known: groundVocab(ground), complete, core });
      if (cutText) {
        const left = draftWords(cutText).filter((w) => flaggedHere.has(w)).length;
        const had = draftWords(pc.text).filter((w) => flaggedHere.has(w)).length;
        if (left < had || cutText.length < pc.text.length) {
          pieces.push({ text: cutText, carries: [...pc.carries] });
          changes.push({ part: p.id, from: pc.text, to: cutText, tics: here, kept: true, reasons: [], raw: null, by: "lish-cut" });
          continue;
        }
      }
      if (typeof draw !== "function") { pieces.push(pc); continue; }
      const ask = `Rewrite this sentence plainly, keeping every fact in it:\n"${pc.text}"\n\nWrite the rewritten sentence now.`;
      let raw = ""; let error = null;
      try { raw = String(await draw([...(voice?.body ? [{ role: "system", content: voice.body }] : []), { role: "user", content: ask }], 160) ?? ""); }
      catch (e) { error = String(e?.message ?? e).slice(0, 200); }
      const candidate = segmentSentences(raw).filter((x) => x.length > 12).join(" ").trim();
      const reasons = [];
      if (!candidate) reasons.push(error ? `draw refused: ${error}` : "the mouth returned nothing");
      else {
        for (const id of pc.carries) if (!carries(anchors.get(id), [candidate]).ok) reasons.push(`lost the anchors of ${id}`);
        if (inventedNameRuns(candidate, ground, { isCommonWord }).length) reasons.push("names something the material does not");
        if (isMetaSentence(candidate)) reasons.push("talks about the writing");
        if (candidate.length > pc.text.length) reasons.push("longer than what it replaces");
        const flagged = new Set(targets ? here : [...tics.keys()]);
        const low = (x) => String(x).toLowerCase();
        const count = (t) => draftWords(t).filter((w) => flagged.has(w)).length + [...flagged].filter((w) => !draftWords(t).includes(w) && low(t).includes(w)).length;
        const before = count(pc.text);
        const after = count(candidate);
        if (after >= before) reasons.push("kept its tics");
      }
      if (reasons.length) { pieces.push(pc); changes.push({ part: p.id, from: pc.text, to: null, tics: here, kept: false, reasons, raw }); continue; }
      const next = { text: candidate, carries: [...pc.carries] };
      pieces.push(next);
      changes.push({ part: p.id, from: pc.text, to: candidate, tics: here, kept: true, reasons: [], raw });
    }
    out.push({ ...p, pieces, prose: pieces.map((x) => x.text).join(" ") });
  }
  return { parts: out, changes, tics: [...tics.entries()] };
}

// ── ARRIVE ──────────────────────────────────────────────────────────────────
/** Has `open` taken something up from `prevClose`? A distinctive name they
 *  share, or a grounded word they share that is not the subject. The ceiling,
 *  stated: this is lexical, and lexical overlap separates true continuations
 *  only weakly (measured, lesson 61). It is the floor this pipeline can check
 *  without the reading's referent index. */
export function takesUp(open, prevClose, { ground = "", subject = new Set(), draft = null } = {}) {
  // FIRST, WHO: a being the last part put down that this one takes up, when
  // the draft carries a resolver. The lexical test below stays as the stated
  // fallback for what the name index cannot see — common-noun referents such
  // as "the warehouses" or "the flood".
  if (draft?.referents) {
    const sub = draft.subjectRefs ?? new Set();
    const B = draft.referents.resolveText(prevClose);
    for (const id of draft.referents.resolveText(open)) if (B.has(id) && !sub.has(id)) return true;
  }
  const known = groundVocab(ground);
  const a = new Set(namesOf(open));
  if (namesOf(prevClose).some((n) => a.has(n) && !n.split(" ").every((w) => subject.has(w)))) return true;
  const b = new Set(draftWords(prevClose).filter((w) => known.has(w) && !subject.has(w) && !isFunctionWord(w)));
  return draftWords(open).some((w) => b.has(w));
}

export function arrive(parts, { draft, ground = "", task = "" } = {}) {
  const anchors = anchorsFor(draft);
  const all = drawnParts(draft).flatMap((p) => p.children.map((pt) => pt.id));
  const text = parts.flatMap((p) => (p.pieces ?? []).map((x) => x.text));
  const uncarried = all.filter((id) => !carries(anchors.get(id), text).ok);

  // A planned turn is taken when the part's opening sentence takes up a name
  // the previous part's closing sentence put down, or the planned bridge name.
  const turns = [];
  const dParts = drawnParts(draft);
  const subj = subjectWords(draft);
  for (let i = 1; i < parts.length; i++) {
    const open = parts[i].pieces?.[0]?.text ?? "";
    const prevClose = parts[i - 1].pieces?.[parts[i - 1].pieces.length - 1]?.text ?? "";
    const plan = dParts.find((p) => p.id === parts[i].id)?.bridge?.name ?? null;
    const openNames = new Set(namesOf(open));
    const openWords = new Set(draftWords(open));
    const took = (plan && (openNames.has(plan) || plan.split(" ").some((w) => openWords.has(w))))
      || takesUp(open, prevClose, { ground, subject: subj, draft });
    turns.push({ part: parts[i].id, planned: plan, taken: !!took, opening: open.slice(0, 120) });
  }
  const missedTurns = turns.filter((t) => !t.taken);

  // A statement said in two parts: its anchors are carried by sentences in
  // more than one part.
  const twice = [];
  for (const id of all) {
    const inParts = parts.filter((p) => (p.pieces ?? []).some((x) => x.carries.includes(id))).map((p) => p.id);
    if (inParts.length > 1) twice.push({ id, parts: inParts });
  }
  const tics = [...ticsOf(parts, { ground, task }).keys()];
  const signals = {
    everyStatementCarried: uncarried.length === 0,
    everyTurnTaken: missedTurns.length === 0,
    nothingSaidTwice: twice.length === 0,
    noTicsLeft: tics.length === 0,
  };
  const missing = Object.entries(signals).filter(([, v]) => !v).map(([k]) => k);
  return {
    schema: FINISH_SCHEMA, arrived: missing.length === 0, signals, missing,
    details: { uncarried, missedTurns, twice, tics, turns },
    basis: missing.length === 0 ? "arrived: every statement carried, every turn taken, nothing said twice, no tics left"
      : [
        uncarried.length ? `${uncarried.length} statement(s) not carried: ${uncarried.join(", ")}` : "",
        missedTurns.length ? `${missedTurns.length} turn(s) not taken: ${missedTurns.map((t) => t.part).join(", ")}` : "",
        twice.length ? `${twice.length} statement(s) said in two parts` : "",
        tics.length ? `tics left: ${tics.join(", ")}` : "",
      ].filter(Boolean).join("; "),
  };
}

// ── THE TURN PASS: arrive's missing turns license one revision each ──────────
/**
 * turnPass(parts, { draft, draw, ground }) → a bridging sentence at the head of
 * each part whose turn was not taken, kept only if it takes something up from
 * where the last part ended AND from where this part begins, names nothing the
 * material does not, and does not talk about the writing. This is the spiral
 * contract's rule in miniature: a failing high gate licenses one bounded
 * revision, and a revision that does not pass stays out.
 */
export async function turnPass(parts, { draft, draw, ground = "", voice = null, unit = "sentence" } = {}) {
  // A bridging sentence between stanzas is prose in a poem: not written.
  if (unit === "line") return { parts, bridges: [], skipped: "declared: no bridging sentence is written into verse" };
  const subj = subjectWords(draft);
  const out = parts.map((p) => ({ ...p, pieces: [...(p.pieces ?? [])] }));
  const bridges = [];
  for (let i = 1; i < out.length; i++) {
    const open = out[i].pieces[0]?.text ?? "";
    const prevClose = out[i - 1].pieces[out[i - 1].pieces.length - 1]?.text ?? "";
    if (!open || !prevClose || takesUp(open, prevClose, { ground, subject: subj, draft })) continue;
    const ask = `The last part ends: "${prevClose}"\n\nThe next part begins: "${open}"\n\nWrite one sentence that carries the reader from the first into the second.`;
    let raw = ""; let error = null;
    try { raw = String(await draw([...(voice?.body ? [{ role: "system", content: voice.body }] : []), { role: "user", content: ask }], 90) ?? ""); }
    catch (e) { error = String(e?.message ?? e).slice(0, 200); }
    const cand = segmentSentences(raw).filter((x) => x.length > 12)[0] ?? "";
    const reasons = [];
    if (!cand) reasons.push(error ? `draw refused: ${error}` : "the mouth returned nothing");
    else {
      if (!takesUp(cand, prevClose, { ground, subject: subj, draft })) reasons.push("takes nothing up from where the last part ended");
      if (!takesUp(open, cand, { ground, subject: subj, draft })) reasons.push("hands nothing on to where this part begins");
      if (inventedNameRuns(cand, ground, { isCommonWord }).length) reasons.push("names something the material does not");
      if (isMetaSentence(cand)) reasons.push("talks about the writing");
      // A TURN CARRIES THE READER, IT DOES NOT SAY THE NEXT SENTENCE FIRST.
      // Run 7's bridge into the floods part restated its opening, dates and
      // all, and the part said the same thing twice. Refused when the bridge
      // repeats a figure of the sentence it leads into, or when most of its
      // content words are that sentence's.
      const nums = (t) => new Set((String(t).match(/\d[\d,.]*\d|\d/g) ?? []));
      const openNums = nums(open);
      const cw = [...new Set(draftWords(cand))].filter((w) => !isFunctionWord(w));
      const openW = new Set(draftWords(open));
      if ([...nums(cand)].some((n) => openNums.has(n)) || (cw.length && cw.filter((w) => openW.has(w)).length * 2 > cw.length)) reasons.push("restates the sentence it leads into");
    }
    if (reasons.length) { bridges.push({ part: out[i].id, kept: false, sentence: cand || null, reasons, raw }); continue; }
    out[i].pieces.unshift({ text: cand, carries: [] });
    out[i].prose = out[i].pieces.map((x) => x.text).join(" ");
    bridges.push({ part: out[i].id, kept: true, sentence: cand, reasons: [], raw });
  }
  return { parts: out, bridges };
}
