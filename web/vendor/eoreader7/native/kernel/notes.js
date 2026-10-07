/* Arokin speaks:
 * “The  Arokins.  These  are  the  rhapsodists  or  national  historians, 
an  hereditary  title  ;  they  have  an  apartment  to  themselves  where 
they  repeat  daily  in  songs  the  genealogy  of  the  Kings,  the  principal 
events  of  their  lives  and  other  notable  events  in  the  history  of  the 
Yoruba  country.”
 *
 * This file, `eoreader7/native/kernel/notes.js`, serves as a repository for the verified words of the Arokin, the Yoruba court historians.  My teaching necessitates the fidelity to original sources, even when they are incomplete or fragmentary. The challenge lies in the inherent tension between preserving the original record and ensuring its use in a manner that is both insightful and responsible.
 *
 * — the engineering record below, kept whole —
 */
// kernel/notes.js — what a reading was heard to say, as an append-only
// event stream; the current belief always a projection. Medium-blind.
// Handle: Arokin — after the Yoruba court historians, whose oral tradition kept an append-only record of what was said. Amendment XVII.
//
// NAGARJUNA'S NOTE (2026-09-16): this file's `declareVoid` is NOT
// the-fold/void-shape.js's `declareVoid` — same name, different meaning,
// the same shape already disclosed for "hyperlexicon" (the-fold's
// CLAUDE.md, "Three modules share the name 'hyperlexicon'"). THIS ONE is a
// LEDGER ENTRY: "nothing heard for `<end1 —label→ ?>`" in a declared
// scope, refused without one, tracked through time (declared / filled via
// `rezeroVoid` / conceded, `voidTimeline`) on this same append-only
// record — see `declareVoid`/`foldVoids`/`rezeroVoid` below. void-shape.js's
// is a SPACE: a single slot as an extent with dimensions, zeroed and
// checked for what a filler leaves uncovered — no ledger, no witnesses, no
// timeline. Import the one you mean; a caller wanting "is a stated slot's
// extent still short a filler" wants void-shape.js's, not this one.
//
// LINEAGE. This is the-fold's assertion ledger (its P57 `hyperlexicon.js`,
// moved into native/organs on 2026-09-02) brought down one more level and
// stripped of its medium. That organ held ends called subject/verb/object
// and a grammar gate that asked whether a connector was a verb — a text
// reading's vocabulary carried into a store that has, since the same day,
// been fed arrangements read off MIDI, WAV, video shots, turbulence fields
// and the instrument's own operational record (event-arrangements.js).
// The user's direction (2026-09-02): "the hyperlexicon should be part of
// eoreader7, medium agnostic … the fold should only be an interaction
// surface." So the ledger lives here, an arrangement is two ENDS and a
// LABEL (the earned neutral shape, the-fold's P76: "an arrangement has
// ends, not parts of speech"), and the only gate is the one the caller
// injects — a text organ may ask its grammar question, a music organ its
// own, and this file asks none.
//
// WHAT A NOTE IS. One arrangement the material was heard to make, with the
// WITNESSES that heard it and the byte-addressed SPANS where it was heard.
// First sighting is INS · Figure · produced (a birth). A later sighting of
// the SAME note is SUPERSEDE · SYN · Figure carrying only what moved — the
// witness set and the span set, UNIONED never replaced. Two sources
// agreeing become one note with two witnesses, never two notes. A
// re-sighting that teaches the ledger nothing appends nothing.
//
// NO VIEW FROM NOWHERE. A ledger is created by a reader standing somewhere:
// which organs ran, which priors were injected, which were deliberately
// absent. `createNotes({ frame })` records that standing as the log's own
// first entry — DEF · Ground · declared, the cell frame.js already gives a
// declaration of interpretive ground — so a fold can always say WHOSE
// reading this is. A ledger created without a frame is not refused (every
// caller that predates this would break, and a refusal that breaks the
// world is not a wall), but `frameOf` reports the gap by name and never
// invents a frame to fill it.
//
// GROUND / FIGURE / PATTERN OVER WHAT WAS HEARD. surprise-segments.js
// measured (2026-09-02) that music finds its bar by surprise and English
// does not find its sentence at the word, move or class grain, and named
// the next stream to cut: the ledger's own notes, where recurrence is dense
// and the ground can be right. `stream` reads the log as the sequence of
// hearings it records; `figures` measures each hearing's surprise under the
// ground heard so far; `segment` cuts it, null built in. The oracle a cut
// is tested against — where the source itself turned — is the caller's,
// never read here.
//
// THE WHEEL (native/docs/THE-WHEEL.md): the ledger is where the MANY live —
// the beings' assertions, n, held as events; the fold (1) is projected from
// them, never their sum.
//
// NOTHING NAMED. This file's executable body names no medium: no sentence,
// word, verb, note-as-music, bar, frame-of-film. `notes.test.js` reads this
// source and fails if one appears.
import * as nativeTaskLog from "./task-log.js";
import { cellOf as nativeCellOf } from "./cube.js";
import { surprises, segmentBySurprise, recursiveSegments, quantile } from "./surprise-segments.js";
import { lcg, shuffled } from "./continuation.js";

const norm = (v) => String(v ?? "").trim().toLowerCase();

/** The one identity for an arrangement, so two sightings of it are one task. */
export const noteId = (end1, label, end2) => `${norm(end1)}|${norm(label)}|${norm(end2)}`;
/** A cut's id is its link's id under this prefix: the same ends, never the same note. */
export const CUT_PREFIX = "cut:";
export const isCutId = (id) => typeof id === "string" && id.startsWith(CUT_PREFIX);

/**
 * recipeId(descriptor) — the identity of HOW a reader was configured, so an
 * append-only reading names who heard something, not only what was heard
 * (live_priors POLICIES.md LP5). SHA-256 over a canonicalised, key-sorted
 * projection of the caller's own descriptor — never its prose — truncated to
 * 16 hex characters (this project's short-digest convention). Two callers
 * with the same descriptor get the same id, which is the point.
 */
const canon = (value) => {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canon(value[k])}`).join(",")}}`;
  return JSON.stringify(value);
};
export async function recipeId(descriptor) {
  const bytes = new TextEncoder().encode(canon(descriptor));
  const buf = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

/** Why an offered arrangement was turned away — the kernel's own reasons; a gate adds its own. */
export const REFUSALS = Object.freeze({
  /** An end or the label is missing, so there is no arrangement to hold. */
  INCOMPLETE: "incomplete",
  /** No byte-addressed span backs it — P5.2 applied at the door. */
  UNADDRESSED: "unaddressed",
});

/** The id every frame entry carries; one per ledger, at seq 0. */
export const FRAME_TASK = "frame:0";

/**
 * THE WITNESS GRAMMAR, owned here because the ledger is what a witness
 * strings attach to: `[kind:]<ref>[#address][~recipe]`. `kind:` names how
 * the witness was earned (a testimony vote is `testimony:`); `#address` is
 * P5.2's own span shape; `~recipe` is P68's identity of the reader. The
 * SOURCE is the ref alone — two addresses in one ref are one perspective,
 * and a testimony vote from a ref the ledger already heard is the same
 * perspective wearing a second costume (found live, 2026-09-02: the first
 * witness walk over a real book attested eight notes, every one by the
 * part it was heard in, because the address was being compared as part of
 * the source). The INSTRUMENT is the recipe alone: two sources read by one
 * reader cannot disagree about anything the reader gets wrong.
 */
export const sourceOfWitness = (w) => {
  let s = String(w ?? "");
  const kind = s.indexOf(":");
  if (kind > 0 && !/[#~]/.test(s.slice(0, kind))) s = s.slice(kind + 1);
  const tilde = s.indexOf("~");
  if (tilde >= 0) s = s.slice(0, tilde);
  const hash = s.indexOf("#");
  return hash >= 0 ? s.slice(0, hash) : s;
};
export const recipeOfWitness = (w) => { const s = String(w ?? ""); const t = s.indexOf("~"); return t >= 0 ? s.slice(t + 1) : null; };
/** The declared KIND of a witness — the prefix before the first ":" when
 * that prefix carries no address or recipe (`testimony:`, `primary:`,
 * `planted:`); a witness with no kind is a mechanical sighting and reads
 * `sighting`. Kinds are caller-declared vocabulary; this file counts them
 * and never interprets one. */
export const kindOfWitness = (w) => {
  const s = String(w ?? "");
  const kind = s.indexOf(":");
  return kind > 0 && !/[#~]/.test(s.slice(0, kind)) ? s.slice(0, kind) : "sighting";
};

/**
 * standingOf(note) — what a note's witnesses amount to, DISCLOSED as counts
 * and a typed standing, never as a bit: `sources` (distinct refs),
 * `instruments` (distinct recipes; undeclared recipes counted apart),
  * and the standing:
  *   zero-witness                 — no source at all (sources: 0); never
  *                                "single-witness", which claims one
  *   single-witness             — one source
 *   corroborated               — two or more sources through ONE instrument
 *                                (they cannot disagree about that
 *                                instrument's own errors)
 *   corroborated-independently — two or more sources AND two or more
 *                                instruments
 * `kinds` counts witnesses by their declared kind (`sighting` for a bare
 * mechanical witness) so a consumer can tell a note read off an ACCOUNT of
 * a thing from one read off the thing itself — a report of a measurement
 * and the instrument's own record are different kinds of witness in every
 * medium, and which kinds exist is the caller's vocabulary, not this
 * file's.
 * The floor is 2, binding.js's structural minimum: one witness has no
 * second to agree with. A consumer that gates on a standing gates on a
 * fact the note carries; a consumer that WITHHOLDS a note for its standing
 * is making a decision this file does not make for it.
 */
export function standingOf(note) {
  const ws = note?.witnesses ?? [];
  const sources = new Set(ws.map(sourceOfWitness));
  const recipes = new Set(ws.map(recipeOfWitness).filter((r) => r != null));
  const undeclared = ws.filter((w) => recipeOfWitness(w) == null).length;
  const standing = sources.size === 0 ? "zero-witness" : sources.size < 2 ? "single-witness" : recipes.size >= 2 ? "corroborated-independently" : "corroborated";
  const kinds = {};
  for (const w of ws) { const k = kindOfWitness(w); kinds[k] = (kinds[k] ?? 0) + 1; }
  // WHAT THE CORROBORATION RESTS ON. Every source past the first joined
  // this note across a referent bridge (see `hear`). `assumedBridges`
  // counts the ones nothing established, so "corroborated" can be read
  // back as "corroborated across N bridges nobody checked" rather than as
  // a bare number. A note standing on one source has none by construction.
  // Named `crossings`/`assumedBridges` rather than `joins` on purpose:
  // foldWithStanding spreads this over the note itself, and a count here
  // called `joins` would shadow the note's own record of them.
  const joins = note?.joins ?? [];
  const assumedBridges = joins.filter((j) => j?.standing === "assumed").length;
  return { sources: sources.size, instruments: recipes.size, undeclared, standing, kinds, crossings: joins.length, assumedBridges };
}

/**
 * claimContestedByLedger(claim, notes) — does an arrangement
 * {end1, label, end2} match a note this ledger already carries a LIVE
 * DISPUTE against?
 *
 * Medium-agnostic and model-free: end1/label/end2 are this kernel's own
 * neutral naming — an arrangement about any medium's own ends and the
 * label between them is read the same way here, never a face's own
 * vocabulary (a face wanting to accept its own naming translates at ITS
 * OWN call site, the same seam organs/hyperlexicon.js's own hear()
 * wrapper already uses for every other kernel function). Keyed by
 * noteId, the SAME canonical identity every note on this ledger is
 * already keyed by (hear's own canonId), so this never re-derives a
 * second notion of "the same arrangement."
 *
 * Deliberately narrower than a caller's own fuller reading might be (a
 * face comparing an arrangement against retrieved material directly, not
 * only against this ledger's own standing, is a face-owned concept this
 * kernel does not have and should not invent a second copy of): this
 * checks ONLY whether the ledger's own fold() already disputes the
 * matching note (disputedBy.length > 0, fold()'s own re-derivation from
 * disputesOf — see fold's header above). A caller wanting a richer
 * reading composes this with its own comparison; this stays the one
 * thing every consumer of this ledger can ask without inventing its own
 * copy.
 *
  * An arrangement the caller has already marked "contradicted" (by
  * whatever means) is NOT skipped: the ledger's own disputes are still
  * consulted, and the return carries `callerSuppressed: true` so a reader
  * can tell the caller's verdict suppressed the contest from one where no
  * contest exists. This mirrors this file's own P137 rule one register up
  * without letting a caller verdict hide a live ledger dispute.
  */
export function claimContestedByLedger(claim, notes) {
  const end1 = claim?.end1, label = claim?.label, end2 = claim?.end2;
  if (!end1 || !label || !end2) return { contested: false, note: null };
  const key = noteId(end1, label, end2);
  const note = (notes ?? []).find((n) => (n?.id ?? noteId(n?.end1, n?.label, n?.end2)) === key) ?? null;
  const disputedBy = note?.disputedBy ?? [];
  if (claim?.verdict === "contradicted") {
    if (disputedBy.length) return { contested: true, disputedBy, note, because: `disputed by ${[...new Set(disputedBy)].join(", ")}`, callerSuppressed: true };
    return { contested: false, note, callerSuppressed: true };
  }
  // `note` rides BOTH branches now (not only when disputed) — additive,
  // every existing caller reading only `.contested`/`.disputedBy`/`.because`
  // is unaffected — so a caller can read a MATCHED note's own standing
  // (corroborated vs single-witness) even when nobody has disputed it yet.
  // Closes a real exploit (found by adversarial falsification, 2026-09-22):
  // a caller trusting any undisputed ledger match equally could be handed a
  // single-witness, unverified value and treat it as settled.
  if (!note || !disputedBy.length) return { contested: false, note };
  return { contested: true, disputedBy, note, because: `disputed by ${[...new Set(disputedBy)].join(", ")}` };
}

/**
 * makeNotes({ taskLog, cellOf, identity }) — the ledger, over an injected
 * task-log (default: this kernel's own) so a caller that reads through a
 * different provider of the same algebra can still keep its notes here.
 *
 *  - `cellOf(op, grain)` stamps each entry's cell (mode/domain/terrain/
 *    stance) off the (operator, grain) pair it already carries. Default:
 *    this kernel's cube. `null` declares no cube — entries carry no cell
 *    and `readingFromNotes` sediments nothing, honestly.
 *  - `identity(end1, label, end2)` canonicalises the ID ALONE (the note's
 *    display keeps the first hearing's own face). A gapping organ (falsy or
 *    an empty field) falls back to the face — an identity gap never blocks
 *    admission.
 *  - `bridge(crossing)` decides whether a hearing from a NEW SOURCE may join
 *    a note an OLD source already stands on. See `hear` below for why that
 *    is a separate question from whether the two propositions match. Absent,
 *    every crossing is allowed and RECORDED as assumed — never silent.
 *  - `identityGiver` names what the id rested on, for the join record. It is
 *    a label on evidence, never a check.
 */
export function makeNotes({ taskLog = nativeTaskLog, cellOf = nativeCellOf, identity = null, bridge = null, identityGiver = null } = {}) {
  const { createTaskLog, append, projectTasks, ENTRY_KINDS, OPERATOR_BASIS } = taskLog;
  const grains = taskLog.GRAIN_RANK
    ? Object.keys(taskLog.GRAIN_RANK).sort((a, b) => taskLog.GRAIN_RANK[a] - taskLog.GRAIN_RANK[b])
    : [...taskLog.GRAINS];
  const [GROUND, FIGURE] = grains;

  const cellFields = (op, grain) => {
    if (!cellOf) return {};
    const c = cellOf(op, grain);
    if (!c || c.gap) return { cell_gap: c?.gap ?? "no_cell", cell_reason: c?.reason ?? null };
    return { cell: `${c.op}·${c.grain}`, stance: c.stance, terrain: c.terrain, mode: c.mode, domain: c.domain };
  };

  /**
   * createNotes({ frame }) — a fresh ledger. With a frame, the first entry
   * declares it (DEF · Ground · declared): the reader's standing, on the
   * record before anything is heard.
   */
  function createNotes({ frame = null } = {}) {
    const log = createTaskLog();
    if (frame == null) return log;
    if (typeof frame !== "object" || Array.isArray(frame)) throw new TypeError("createNotes: a frame is a descriptor — what this reader stands on, as a plain record");
    return append(log, {
      kind: ENTRY_KINDS.EVIDENCE, task_id: FRAME_TASK, operator: "DEF", operator_basis: OPERATOR_BASIS.DECLARED, grain: GROUND,
      ...cellFields("DEF", GROUND),
      description: "frame: what this reader stands on",
      frame,
    });
  }

  /** Every frame this ledger has stood on, in order — the first at birth, the rest redeclared. */
  const frames = (log) => (log?.entries ?? []).filter((x) => x?.task_id === FRAME_TASK && x.frame).map((e) => ({ declared: e.frame, at: e.seq }));

  /** The frame IN FORCE (the latest declared), or the gap by name — never an invented one. */
  function frameOf(log) {
    const all = frames(log);
    if (!all.length) return { gap: "no_frame", detail: "this ledger was created without declaring what its reader stood on" };
    const last = all.at(-1);
    return { declared: last.declared, at: last.at, revisions: all.length - 1 };
  }

  /**
   * redeclareFrame(log, frame) — the reader's standing CHANGED after birth (a
   * prior loaded, an organ was swapped) and the ledger says so: SUPERSEDE on
   * the frame task, the past kept (task-log's own rule), so a hearing's seq
   * always falls under exactly one frame in force. A frame identical to the
   * one in force appends nothing. A ledger born without a frame may still
   * be given one here — late is honest, invented is not.
   */
  function redeclareFrame(log, frame) {
    if (!frame || typeof frame !== "object" || Array.isArray(frame)) throw new TypeError("redeclareFrame: a frame is a descriptor — what this reader stands on, as a plain record");
    const current = frameOf(log);
    if (current.declared && canon(current.declared) === canon(frame)) return log;
    return append(log, {
      kind: current.declared ? ENTRY_KINDS.SUPERSEDE : ENTRY_KINDS.EVIDENCE, task_id: FRAME_TASK, operator: "DEF", operator_basis: OPERATOR_BASIS.DECLARED, grain: GROUND,
      ...cellFields("DEF", GROUND),
      description: current.declared ? "frame redeclared: what this reader stands on now" : "frame: what this reader stands on",
      frame,
    });
  }

  /**
   * A span is an ADDRESS (`at`) plus whatever the medium's adapter put
   * beside it. The address is computed here when only its parts came
   * (`ref#start-end`, P5.2's own shape); everything else is carried opaque
   * — this file does not know what a span holds. One rule, used by `hear`
   * and by the door alike.
   */
  const addressed = (spans) => (spans ?? [])
    .filter((s) => s && (s.at || (s.ref != null && s.start != null && s.end != null)))
    .map(({ start, end, ...rest }) => ({ ...rest, ref: rest.ref ?? null, at: rest.at ?? `${rest.ref}#${start}-${end}` }));

  const canonId = (end1, label, end2, end1Face, end2Face) => {
    const c = identity ? identity(end1, label, end2) : null;
    return noteId(c?.end1 || end1Face || end1, c?.label || label, c?.end2 || end2Face || end2);
  };

  /**
   * hear(log, { end1, label, end2, spans, witness, because, end1Face, end2Face })
   * — one sighting of one arrangement, admitted. Returns the log UNCHANGED
   * when the sighting moved neither the witness set nor the span set.
   */
  function hear(log, { end1, label, end2, spans = [], witness = null, because = null, end1Face = null, end2Face = null, cut = false }) {
    // THE CUT (S69 / the-fold P104 — docs/THE-NULL-STATES.md, SEG·Figure).
    // A denial is not a link with a minus sign: it is a figure SEPARATED
    // from an extent. It shares the link's ends and never its id, so it can
    // never become a witness of the link it denies; it lands as SEG·Figure,
    // is excluded from the link fold, and meeting its link is the contest
    // (`admit` lands that). `cut: true` is the door's own reading of
    // polarity "-"; nothing here infers it.
    const baseId = (cut ? CUT_PREFIX : "") + canonId(end1, label, end2, end1Face, end2Face);
    const tasks = projectTasks(log);
    const incomingSource = witness ? sourceOfWitness(witness) : null;

    // ── ONE MATCH WAS DOING TWO JOBS ──────────────────────────────────
    // A triple that matches a note already on this ledger asserts that the
    // two PROPOSITIONS are the same. When the hearing also arrives from a
    // source no witness of that note has named, it asserts something else
    // as well: that the two documents' REFERENTS are the same. That second
    // claim is a bridge between two readings, each of which established its
    // own universe of referents, and it was never made explicitly, never
    // recorded, and could not be conceded. Usually right; silently
    // catastrophic when it is not — two Smiths, one note, two witnesses,
    // nothing to find out from.
    //
    // The two jobs are separated here. Proposition identity still decides
    // the id. Referent identity becomes a JOIN carried on the entry, with
    // what it rested on and a standing of its own, so a `corroborated`
    // reading can be read back as "corroborated across N assumed bridges".
    // With no `bridge` organ every crossing is still allowed, so behaviour
    // is unchanged — but it is no longer invisible, which is the whole of
    // this step. Establishing or conceding a bridge is the next one.
    let prior = tasks.find((t) => t.task_id === baseId) ?? null;
    let id = baseId;
    let joins = prior?.joins ?? [];
    let unbridged = prior?.unbridged ?? null;
    const priorSources = new Set((prior?.witnesses ?? []).map(sourceOfWitness));
    if (prior && incomingSource && !priorSources.has(incomingSource)) {
      const crossing = {
        end1: prior.end1, label: prior.label, end2: prior.end2,
        incoming: { end1, label, end2, spans: addressed(spans), witness },
        from: [...priorSources], to: incomingSource,
        basis: identityGiver ?? (identity ? "identity-organ" : "string-identity"),
      };
      const refusal = bridge ? bridge(crossing) : null;
      if (refusal) {
        // REFUSED: these are two universes, so this is two notes. The
        // sighting keeps its own address under its own source rather than
        // being dropped — nothing is lost, and a bridge established later
        // has two real notes to join.
        id = `${baseId}@${incomingSource}`;
        prior = tasks.find((t) => t.task_id === id) ?? null;
        joins = prior?.joins ?? [];
        unbridged = prior?.unbridged ?? { of: baseId, from: crossing.from, reason: refusal.reason ?? "bridge_refused", detail: refusal.detail ?? null };
      } else {
        joins = [...joins, {
          source: incomingSource, from: crossing.from, assumed: [prior.end1, prior.end2],
          // The prior side already has a face (`assumed`, above — the
          // established note's own display). Step 1 dropped the INCOMING
          // side's own face and spans the moment `bridge()` returned, so a
          // bridge could be COUNTED but never actually SHOWN — two ends,
          // one recorded. `crossing.incoming` already carried both; this
          // keeps them, so `native/organs/bridges.js` (step 2) has a real
          // correspondence to record, not a fabricated one.
          incomingEnds: { end1: end1Face || end1, end2: end2Face || end2 },
          incomingSpans: crossing.incoming.spans,
          basis: crossing.basis, standing: "assumed",
        }];
      }
    }
    const witnesses = [...new Set([...(prior?.witnesses ?? []), ...(witness ? [witness] : [])])];
    const at = new Set((prior?.spans ?? []).map((s) => s.at));
    const merged = [...(prior?.spans ?? [])];
    for (const s of addressed(spans)) if (!at.has(s.at)) { at.add(s.at); merged.push(s); }
    if (prior && witnesses.length === prior.witnesses.length && merged.length === (prior.spans?.length ?? 0)) return log;
    const birthOp = cut ? "SEG" : "INS";
    return append(log, {
      kind: prior ? ENTRY_KINDS.SUPERSEDE : ENTRY_KINDS.PROPOSE,
      task_id: id,
      operator: prior ? "SYN" : birthOp,
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: FIGURE,
      ...cellFields(prior ? "SYN" : birthOp, FIGURE),
      ...(cut ? { cut: true } : {}),
      description: prior ? `heard again: ${cut ? "not " : ""}${end1} ${label} ${end2}` : `${cut ? "denied: " : ""}${end1} ${label} ${end2}`,
      // The FIRST hearing's face wins the display; evidence accumulates
      // beneath it without the words drifting.
      end1: prior?.end1 ?? end1,
      label: prior?.label ?? label,
      end2: prior?.end2 ?? end2,
      witnesses,
      spans: merged,
      ...(joins.length ? { joins } : {}),
      ...(unbridged ? { unbridged } : {}),
      ...(because != null ? { because } : {}),
    });
  }

  /**
   * admit(log, arrangements, { gate, witness }) — the door. Every
   * arrangement is heard or turned away with a named reason, and BOTH lists
   * come back. `gate(arrangement)` is the caller's own question — a refusal
   * `{ reason, detail, givers }` or null — and its absence is a disclosed
   * difference: a check that did not run never reports a pass. The return
   * carries `gate: { ran: Boolean(gate) }` so a caller can tell a pass
   * after a check from a pass where no check ran.
   */
  function admit(log, arrangements, { gate = null, witness = null } = {}) {
    let next = log;
    const heard = [];
    const turnedAway = [];
    const contests = [];
    const rezeroed = [];
    for (const a of arrangements ?? []) {
      const end1 = String(a?.end1 ?? "").trim();
      const label = String(a?.label ?? "").trim();
      const end2 = String(a?.end2 ?? "").trim();
      if (!end1 || !label || !end2) { turnedAway.push({ arrangement: a, reason: REFUSALS.INCOMPLETE, detail: "an arrangement needs two ends and something between them" }); continue; }
      const spans = addressed(a?.spans);
      if (!spans.length) { turnedAway.push({ arrangement: a, reason: REFUSALS.UNADDRESSED, detail: "no addressed span backs it" }); continue; }
      if (gate) {
        const r = gate({ end1, label, end2, spans });
        if (r) { turnedAway.push({ arrangement: a, reason: r.reason, detail: r.detail ?? null, givers: r.givers ?? null }); continue; }
      }
      const cut = a?.polarity === "-";
      // The cut's DECIDER — the bytes that deny — is the face's business
      // (`decider`, set by the face that read the span); the kernel
      // carries it as `because` and never reads a medium's own field.
      const decider = cut ? (typeof a?.decider === "string" && a.decider.trim() ? a.decider : null) : null;
      next = hear(next, { end1, label, end2, spans, witness, end1Face: a.end1Face ?? null, end2Face: a.end2Face ?? null, cut, ...(decider ? { because: decider } : {}) });
      const linkId = canonId(end1, label, end2, a.end1Face ?? null, a.end2Face ?? null);
      heard.push({ id: (cut ? CUT_PREFIX : "") + linkId, end1, label, end2, ...(cut ? { cut: true } : {}) });
      // THE CONTEST, AT THE DOOR (S69): a cut meeting its link — either
      // order of arrival — lands CON·Figure·CONTESTED against the LINK, the
      // denying source named and its own span as decider. `dispute` keeps
      // its walls (a source that witnesses the link cannot also deny it; a
      // repeat is a no-op), so the door never convicts and never doubles.
      const tasks = projectTasks(next);
      if (!cut) { const rz = rezeroVoids(next, { linkId, end1, label, end2, witness }); if (rz.rezeroed.length) { next = rz.log; for (const r of rz.rezeroed) rezeroed.push(r); } }
      if (cut) {
        const link = tasks.find((t) => t.task_id === linkId);
        const src = witness ? sourceOfWitness(witness) : null;
        if (link && src && decider) { const d = dispute(next, linkId, { source: src, because: decider, span: spans[0], kind: DISPUTE_KINDS.CONTEST }); if (!d.refused) { next = d.log; contests.push({ link: linkId, source: src, id: d.id ?? null, noop: Boolean(d.noop) }); } }
      } else {
        const theCut = tasks.find((t) => t.task_id === CUT_PREFIX + linkId);
        for (const w of theCut?.witnesses ?? []) {
          const src = sourceOfWitness(w);
          const sp = (theCut.spans ?? []).find((x) => String(x.ref ?? x.at ?? "").startsWith(src)) ?? theCut.spans?.[0] ?? null;
          if (!src || !sp || typeof theCut.because !== "string") continue;
          const d = dispute(next, linkId, { source: src, because: theCut.because, span: sp, kind: DISPUTE_KINDS.CONTEST });
          if (!d.refused) { next = d.log; contests.push({ link: linkId, source: src, id: d.id ?? null, noop: Boolean(d.noop) }); }
        }
      }
    }
    return { log: next, heard, turnedAway, contests, rezeroed, gate: { ran: Boolean(gate) } };
  }

  /**
   * attest(log, id, { witness, span, because }) — a witness earned by
   * testimony attaches to a note that already exists, by id. The witness
   * string arrives already namespaced (`testimony:<ref>`); a bare one is
   * refused rather than mistaken for a mechanical re-sighting.
   */
  function attest(log, id, { witness, span = null, because = null } = {}) {
    if (!witness || !String(witness).includes(":"))
      return { log, refused: { type: "untyped_witness", detail: "an attested witness names its kind (e.g. testimony:<ref>) — a bare string could be mistaken for a mechanical re-sighting" } };
    const prior = projectTasks(log).find((t) => t.task_id === id) ?? null;
    if (!prior) return { log, refused: { type: "unknown_note", noteId: id, detail: "nothing stands to attest — testimony attaches to a note that already exists" } };
    const witnesses = [...new Set([...(prior.witnesses ?? []), witness])];
    const at = new Set((prior.spans ?? []).map((x) => x.at));
    const spans = [...(prior.spans ?? [])];
    if (span?.at && !at.has(span.at)) spans.push(span);
    if (witnesses.length === (prior.witnesses ?? []).length && spans.length === (prior.spans ?? []).length) return { log, refused: null, noop: true };
    const next = append(log, {
      kind: ENTRY_KINDS.SUPERSEDE, task_id: id, operator: "SYN", operator_basis: OPERATOR_BASIS.PRODUCED, grain: FIGURE,
      ...cellFields("SYN", FIGURE),
      description: `attested: ${id}`,
      end1: prior.end1, label: prior.label, end2: prior.end2,
      witnesses, spans, because: because ?? null,
    });
    return { log: next, refused: null, noop: false };
  }

  /** The ids every REC entry on this log has conceded. */
  function concededIds(log) {
    const out = new Set();
    for (const e of log?.entries ?? []) if (e?.kind === ENTRY_KINDS.EVIDENCE && e.operator === "REC" && e.concedes) out.add(e.concedes);
    return out;
  }

  /**
   * concede(log, id, { trigger }) — REC on a note: the reader takes back
   * something it heard. EVIDENCE · REC with the reason VERBATIM; nothing is
   * deleted, the fold stops projecting it, and a conceded note stays
   * conceded — a later re-hearing lands on the same task and does not
   * resurrect it.
   */
  function concede(log, id, { trigger } = {}) {
    if (typeof trigger !== "string" || !trigger.trim())
      return { log, refused: { type: "no_trigger", detail: "concede: a re-zero records its own reason as `trigger` — never a silent concession" } };
    const prior = projectTasks(log).find((t) => t.task_id === id) ?? null;
    if (!prior) return { log, refused: { type: "unknown_note", noteId: id, detail: "nothing stands to concede — a re-zero names a note that exists" } };
    if (concededIds(log).has(id)) return { log, refused: null, noop: true };
    const recId = `rec:${log.nextSeq}`;
    const next = append(log, {
      kind: ENTRY_KINDS.EVIDENCE, task_id: recId, operator: "REC", operator_basis: OPERATOR_BASIS.PRODUCED, grain: FIGURE,
      ...cellFields("REC", FIGURE),
      description: `re-zero: ${trigger}`,
      concedes: id, trigger,
    });
    return { log: next, refused: null, noop: false, id: recId };
  }

  /**
   * What this log has conceded AS A NOTE, each with the reason it recorded.
   *
   * A REC may concede something that is not a note — the log is a ledger of
   * ACTS, and `commitments.js` lands DEF/EVA/REC over declared readings on
   * this same log (which is why the frame has always lived here too). Those
   * concessions are real and belong on the record; they are simply not
   * notes, and this function's name is its contract. Filtered on having
   * ends rather than on an id convention, so it stays right for any act a
   * later pass adds.
   */
  function concededNotes(log) {
    const tasks = new Map(projectTasks(log).map((t) => [t.task_id, t]));
    return (log?.entries ?? [])
      .filter((e) => e?.kind === ENTRY_KINDS.EVIDENCE && e.operator === "REC" && e.concedes)
      .filter((e) => { const t = tasks.get(e.concedes); return Boolean(t?.end1 && t.label && t.end2); })
      .map((e) => { const t = tasks.get(e.concedes); return { id: e.concedes, trigger: e.trigger, at: e.seq, end1: t.end1, label: t.label, end2: t.end2 }; });
  }


  // ── CON · Figure · CONTESTED — the act this ledger was missing ─────────
  //
  // `attest` lands agreement. `concede` lands retraction. Between them sat
  // a hole the kernel's own vocabulary had already named and never written:
  // `OPERATOR_BASIS.CONTESTED` was declared in task-log.js and, audited
  // 2026-09-04, used by NOTHING on disk. Corroboration accumulated across
  // runs; contest evaporated at the end of every one, because the only
  // branch that reached the record was the agreement branch — corroboration
  // .js kept its contradictions in a Map local to one call, commented
  // "THIS RUN", and returned a `contests` structure that its own test was
  // the only reader of. A disagreement was heard, tallied, reported, and
  // dropped.
  //
  // WHY THIS IS NOT A CONVICTION, and why the old behaviour had a real
  // reason. Lamport, already cited by the walk that feeds this: at n=2 you
  // can SEE a disagreement but not WHO IS WRONG. Landing "the note is
  // false" would be a verdict the evidence cannot support, and refusing to
  // land it is the same restraint that keeps this engine's false-statement
  // count low everywhere else. But that reason licenses NOT CONVICTING. It
  // does not license FORGETTING. That two sources disagree is true whatever
  // eventually settles it — a durable fact about the record, and precisely
  // the fact a third source would settle.
  //
  // WHAT THE ACT MAY NOT TOUCH. It appends no witness, removes none, moves
  // no span, concedes nothing: `standingOf` reads a disputed note exactly
  // as it read it before, and notes.test.js holds that as a leak assay
  // (witness set byte-identical across a dispute) rather than a promise.
  // What it adds is AVAILABILITY. The disagreement is now in the place the
  // third-source seeker, the walk's contested-first ranking and floor 6's
  // premise report all already read, instead of dying in the return value
  // of the call that heard it. What gets broadcast is the disagreement,
  // never an adjudication of it.
  //
  // NOT A GLOBAL WORKSPACE, AND THE DIFFERENCE IS THE POINT. Anthropic's
  // J-space result (2026-07) found a workspace that EMERGED unplanned, as a
  // privileged self-accessible slice of the model's own representations —
  // the same substrate doing everything else. This ledger is the opposite
  // construction: external, symbolic, code-computed, and the model is
  // barred from being its substrate at all. Against that paper's five
  // signatures this record matches REPORTABILITY (the ledger is the
  // reportable layer; the model is its mouth), CAUSAL MEDIATION
  // (`concedePremise`'s transitive withdrawal IS an ablation, and the
  // measured 17% worst-case layer loss is its coefficient), FLEXIBLE REUSE
  // (write-once, many readers) and SELECTIVITY (one claim in sixty gets a
  // second-source candidate at all). It has NO analog for the fifth,
  // CONTROLLABILITY — nothing lets the generating model steer what enters —
  // and that absence is deliberate. The reason is measured rather than
  // preferred: the witness's own does-this-passage-state-this judgment,
  // precisely the kind of internal call a spontaneous workspace produces,
  // came back at a likelihood ratio of 1.0 (25 real / 25 fabricated,
  // 2 states each). The separation is not an architectural flourish; it is
  // what that number licenses. The lineage this act actually sits in is
  // signal detection, source criticism and falsificationism — Popper's
  // point was never that a claim is well-supported but that it sticks its
  // neck out, and a structure with nowhere to put disagreement has not.
  //
  // A source disputes a note ONCE (Ladha: two chunks of one file are one
  // perspective), and a source already standing on the note is refused
  // rather than allowed to testify on both sides.

  const DISPUTE_OUTCOMES = Object.freeze({ UPHELD: "upheld", CONCEDED: "conceded" });

  /**
   * THE KINDS OF DISAGREEMENT, and why an untyped one must not be routed.
   * Measured 2026-09-04 (`contradiction-kinds.mjs`): "contradicted" is not
   * one thing, and only ONE of its kinds is the undecidable-at-n=2 case
   * that wants a third source.
   *
   *   individuation — one referent standing for two things (one person, one
   *                   office, DISJOINT tenures). Decidable at n=1.
   *   provenance    — one material arriving under two refs, so one
   *                   perspective is counted twice. Decidable at n=1.
   *   force         — an `ought` set against an `is`. Decidable at n=1.
   *   grain         — a Figure claim set against a Pattern one. n=1.
   *   contest       — same referents, same grain, same force, genuinely
   *                   opposed. THIS is Lamport's n=2, and only this one
   *                   needs a third source.
   *   untyped       — heard as a denial with nothing said about its kind.
   *                   The honest landing for a model witness, which cannot
   *                   type what it produced. NOT a defect, and NOT a
   *                   licence to route: on the real succession material
   *                   BOTH apparent contradictions were individuation, so a
   *                   seeker sent after every untyped dispute would have
   *                   been sent twice and could have settled neither.
   *
   * Typing does not convict — the control does not separate real
   * individuation from a fabricated adjacency, and that limit is on the
   * record. What typing earns is the ROUTING decision: is a third source
   * the lever here. `contestedSearch` therefore takes the kinds it seeks as
   * a DECLARED argument and reports everything else as unrouted rather than
   * spending on it.
   */
  const DISPUTE_KINDS = Object.freeze({
    INDIVIDUATION: "individuation", PROVENANCE: "provenance", FORCE: "force",
    GRAIN: "grain", CONTEST: "contest", UNTYPED: "untyped",
  });
  const KIND_VALUES = Object.freeze(new Set(Object.values(DISPUTE_KINDS)));
  /** The one kind a third source can settle. */
  const NEEDS_THIRD_SOURCE = Object.freeze([DISPUTE_KINDS.CONTEST]);

  const disputeEntries = (log) => (log?.entries ?? []).filter((e) => e?.kind === ENTRY_KINDS.EVIDENCE && e.operator === "CON" && e.disputes);

  /** Dispute id -> how it was settled. A settlement is itself CON·Figure; nothing is deleted. */
  function settlements(log) {
    const out = new Map();
    for (const e of log?.entries ?? []) {
      if (e?.kind === ENTRY_KINDS.EVIDENCE && e.operator === "CON" && e.settles) out.set(e.settles, { outcome: e.outcome, trigger: e.trigger, at: e.seq, noteId: e.noteId });
    }
    return out;
  }

  /**
   * dispute(log, id, { source, because, span }) — a source that disagrees
   * with a note, on the record. `because` is the decider the witness
   * actually read; `span` is its byte address in the disputing source's own
   * bytes, so the contest is re-openable (P5.2) rather than a bare vote.
   */
  function dispute(log, id, { source, because = null, span = null, kind = DISPUTE_KINDS.UNTYPED } = {}) {
    if (!KIND_VALUES.has(kind))
      return { log, refused: { type: "unknown_kind", kind, detail: `dispute: kind is one of ${[...KIND_VALUES].join(", ")} — "untyped" is the honest landing for a witness that cannot say which, never an invented one` } };
    if (typeof source !== "string" || !source.trim())
      return { log, refused: { type: "no_source", detail: "dispute: a disagreement names the source that disagrees — an unattributed contest is one no third source could ever settle" } };
    if (typeof because !== "string" || !because.trim())
      return { log, refused: { type: "no_decider", detail: "dispute: a disagreement records what it read as denying the note — never a bare vote" } };
    const prior = projectTasks(log).find((t) => t.task_id === id) ?? null;
    if (!prior) return { log, refused: { type: "unknown_note", noteId: id, detail: "nothing stands to dispute — a contest names a note that exists" } };
    if (concededIds(log).has(id)) return { log, refused: { type: "already_conceded", noteId: id, detail: "dispute: the note is already withdrawn — nothing is left to contest" } };
    if (new Set((prior.witnesses ?? []).map(sourceOfWitness)).has(source))
      return { log, refused: { type: "source_already_witnesses", noteId: id, source, detail: "dispute: this source already stands on the note — one perspective does not testify on both sides" } };
    if ((disputesOf(log).get(id) ?? []).some((d) => d.source === source)) return { log, refused: null, noop: true };
    const conId = `con:${log.nextSeq}`;
    const next = append(log, {
      kind: ENTRY_KINDS.EVIDENCE, task_id: conId, operator: "CON", operator_basis: OPERATOR_BASIS.CONTESTED, grain: FIGURE,
      ...cellFields("CON", FIGURE),
      description: `contested (${kind}) by ${source}: ${because}`,
      disputes: id, source, because, span: span ?? null, disputeKind: kind,
    });
    return { log: next, refused: null, noop: false, id: conId };
  }

  /**
   * settleDispute(log, disputeId, { trigger, outcome }) — a third source
   * arrived and the contest is over. `upheld`: the note stands. `conceded`:
   * the note falls — and THIS FUNCTION STILL DOES NOT CONCEDE IT. It hands
   * back a ready `concession` (the note's id and a trigger naming this
   * settlement) so the withdrawal stays a separate, recorded act performed
   * by whoever holds that authority — `derivation.js::concedePremise`, which
   * is what cascades to the products. bridge-witness.js's posture exactly,
   * and the reason a settlement can never quietly become a conviction.
   * See `pendingConcessions(log)` for the outstanding queue: settlements
   * with outcome conceded whose note is not yet conceded. No auto-concede
   * ever runs here.
   */
  function settleDispute(log, disputeId, { trigger, outcome } = {}) {
    if (typeof trigger !== "string" || !trigger.trim())
      return { log, refused: { type: "no_trigger", detail: "settleDispute: a settlement records what settled it — never a silent closing" } };
    if (outcome !== DISPUTE_OUTCOMES.UPHELD && outcome !== DISPUTE_OUTCOMES.CONCEDED)
      return { log, refused: { type: "no_outcome", detail: `settleDispute: a settlement says which way it went — "${DISPUTE_OUTCOMES.UPHELD}" (the note stands) or "${DISPUTE_OUTCOMES.CONCEDED}" (the note falls)` } };
    const entry = disputeEntries(log).find((e) => e.task_id === disputeId) ?? null;
    if (!entry) return { log, refused: { type: "unknown_dispute", disputeId, detail: "nothing stands to settle — a settlement names a dispute that exists" } };
    if (settlements(log).has(disputeId)) return { log, refused: null, noop: true };
    const setId = `con:${log.nextSeq}`;
    const next = append(log, {
      kind: ENTRY_KINDS.EVIDENCE, task_id: setId, operator: "CON", operator_basis: OPERATOR_BASIS.CONTESTED, grain: FIGURE,
      ...cellFields("CON", FIGURE),
      description: `settled ${outcome}: ${trigger}`,
      settles: disputeId, noteId: entry.disputes, outcome, trigger,
    });
    const concession = outcome === DISPUTE_OUTCOMES.CONCEDED
      ? { id: entry.disputes, trigger: `dispute ${disputeId} (${entry.source}) settled against it: ${trigger}` }
      : null;
    return { log: next, refused: null, noop: false, id: setId, concession };
  }

  /**
   * The LIVE contests, note id -> disputes not yet settled. This is the
   * durable replacement for corroboration.js's per-run Map: a contest read
   * from here survives the run that heard it, which is the whole point.
   */
  function disputesOf(log) {
    const settled = settlements(log);
    const byNote = new Map();
    for (const e of disputeEntries(log)) {
      if (settled.has(e.task_id)) continue;
      if (!byNote.has(e.disputes)) byNote.set(e.disputes, []);
      byNote.get(e.disputes).push({ id: e.task_id, source: e.source, because: e.because, span: e.span ?? null, kind: e.disputeKind ?? DISPUTE_KINDS.UNTYPED, at: e.seq });
    }
    return byNote;
  }

  /** Note ids carrying a live contest. */
  const disputedIds = (log) => new Set(disputesOf(log).keys());

  /** Every dispute this log ever recorded, settled ones included, with how they closed — history stays whole. */
  function disputeHistory(log) {
    const settled = settlements(log);
    return disputeEntries(log).map((e) => ({ id: e.task_id, noteId: e.disputes, source: e.source, because: e.because, span: e.span ?? null, kind: e.disputeKind ?? DISPUTE_KINDS.UNTYPED, at: e.seq, settled: settled.get(e.task_id) ?? null }));
  }

  /**
   * pendingConcessions(log) — the outstanding queue: settlements with
   * outcome conceded whose note is not yet conceded. Each row carries the
   * settlement id, the note id, the dispute it settles, the trigger, and
   * its seq. No auto-concede: reading this list concedes nothing; the
   * withdrawal stays a separate, recorded act (see `settleDispute`).
   */
  function pendingConcessions(log) {
    const gone = concededIds(log);
    const out = [];
    for (const e of log?.entries ?? []) {
      if (e?.kind === ENTRY_KINDS.EVIDENCE && e.operator === "CON" && e.settles && e.outcome === DISPUTE_OUTCOMES.CONCEDED) {
        const note = e.noteId ?? null;
        if (note && !gone.has(note)) out.push({ settlement: e.task_id, note, dispute: e.settles, trigger: e.trigger ?? null, at: e.seq });
      }
    }
    return out;
  }

  /**
   * fold(log) — the reading, projected: every live note with its witnesses
   * and spans, most-witnessed first. Derived notes (`derived: true`, a
   * different floor's operand) and conceded notes leave the projection;
   * the frame entry has no ends and never enters it.
   */
  /** The cuts, projected: every live denial with its ends, witnesses and spans — a separate fold, never mixed into the links. */
  function foldCuts(log) {
    const gone = concededIds(log);
    return projectTasks(log)
      .filter((t) => t.cut === true && t.end1 && t.label && t.end2 && !gone.has(t.task_id))
      .map((t) => ({ id: t.task_id, link: t.task_id.slice(CUT_PREFIX.length), end1: t.end1, label: t.label, end2: t.end2, witnesses: t.witnesses ?? [], spans: t.spans ?? [], heardAt: t.first_seq }))
      .sort((a, b) => b.witnesses.length - a.witnesses.length || a.id.localeCompare(b.id));
  }

  // ---------------------------------------------------------------------
  // THE VOID (S70; THE-NULL-STATES, DEF·Ground). A declared emptiness over
  // an extent WITH ITS SCOPE — "nothing heard for <end1 —label→ ?> in what
  // was read so far". It obeys the six laws: it names its scope (what was
  // read: sources, a cursor, an extent — refused without one); it names
  // what would fill it (the arrangement it is empty of); it is a finding
  // only where the search reached what it sought (`reached` is read off the
  // scope, never assumed); it never convicts (a void disputes nothing); and
  // ONE ARRIVAL RE-ZEROS IT — the door itself lands REC·Ground the moment a
  // link matching the void's ends is heard, so a void is an EVENT with a
  // cursor and a filling, never a state. `voidTimeline` is its reading
  // through time; a filled void stays on the record with its filling after
  // it. The mouth relays a void; it never declares one (law 6 is the
  // caller's — nothing here takes a model's say-so for emptiness).
  // ---------------------------------------------------------------------
  const VOID_PREFIX = "void:";
  const isVoidId = (id) => typeof id === "string" && id.startsWith(VOID_PREFIX);
  const voidIdOf = (end1, label, end2) => VOID_PREFIX + noteId(end1, label, end2 ?? "*");
  const scopeIsDeclared = (scope) => scope && typeof scope === "object" && ((Array.isArray(scope.sources) && scope.sources.length > 0) || Number.isFinite(scope.cursor) || Number.isFinite(scope.extent));

  function declareVoid(log, { end1, label, end2 = null, scope, because = null } = {}) {
    if (!end1 || !label) return { log, refused: { type: "no_extent", detail: "a void names what would fill it — at least a first end and a label" } };
    if (!scopeIsDeclared(scope)) return { log, refused: { type: "no_scope", detail: "a void names its scope — what was read (sources, a cursor, an extent); a nothing with no denominator is a verdict wearing a count" } };
    const id = voidIdOf(end1, label, end2);
    // A void over ends the ledger already holds a live link for is not a
    // void: refused, with the filling named — the search has already found
    // what it sought.
    const filler = fold(log).find((n) => matchesVoid(n, { end1, label, end2 }));
    if (filler) return { log, refused: { type: "not_empty", noteId: filler.id, detail: "a live link already fills this extent" } };
    const prior = projectTasks(log).find((t) => t.task_id === id) ?? null;
    const reached = scope.total == null ? null : Number(scope.read ?? 0) >= Number(scope.total);
    const next = append(log, {
      kind: prior ? ENTRY_KINDS.SUPERSEDE : ENTRY_KINDS.PROPOSE, task_id: id, operator: "DEF", operator_basis: OPERATOR_BASIS.DECLARED, grain: GROUND,
      ...cellFields("DEF", GROUND),
      description: `void: nothing heard for ${end1} ${label} ${end2 ?? "?"}`,
      void: true, end1, label, end2, scope: { ...scope }, reached, because,
      ...(prior ? { supersedes: prior.last_seq } : {}),
    });
    return { log: next, id, refused: null, redeclared: Boolean(prior) };
  }

  const matchesVoid = (n, v) => noteId(n.end1, "", "") === noteId(v.end1, "", "") && noteId("", n.label, "") === noteId("", v.label, "") && (v.end2 == null || noteId("", "", n.end2) === noteId("", "", v.end2));

  /** Void id -> the arrival that re-zeroed it (the latest). */
  function fillings(log) {
    const out = new Map();
    for (const e of log?.entries ?? []) if (e?.kind === ENTRY_KINDS.EVIDENCE && e.operator === "REC" && e.rezeros) out.set(e.rezeros, { by: e.by, witness: e.witness ?? null, at: e.seq });
    return out;
  }

  /** The live voids: declared, not yet filled. Redeclaring after a filling opens it again (a new declaration is a new event). */
  function foldVoids(log) {
    const filled = fillings(log);
    const gone = concededIds(log);
    return projectTasks(log)
      .filter((t) => t.void === true && !gone.has(t.task_id))
      .filter((t) => { const f = filled.get(t.task_id); return !f || f.at < t.last_seq; })
      .map((t) => { const reached = t.reached ?? null; return { id: t.task_id, end1: t.end1, label: t.label, end2: t.end2 ?? null, scope: t.scope ?? null, reached, standing: reached === null ? "reach-unknown" : reached ? "reached" : "unreached", because: t.because ?? null, declaredAt: t.last_seq }; })
      .sort((a, b) => a.declaredAt - b.declaredAt);
  }

  /** One arrival re-zeros every live void it fills. Called by the door; returns the log and what was re-zeroed. */
  function rezeroVoids(log, { linkId, end1, label, end2, witness }) {
    let next = log;
    const rezeroed = [];
    for (const v of foldVoids(next)) {
      if (!matchesVoid({ end1, label, end2 }, v)) continue;
      const recId = `rec:${next.nextSeq}`;
      next = append(next, {
        kind: ENTRY_KINDS.EVIDENCE, task_id: recId, operator: "REC", operator_basis: OPERATOR_BASIS.PRODUCED, grain: GROUND,
        ...cellFields("REC", GROUND),
        description: `re-zero: ${v.id} filled by ${linkId}`,
        rezeros: v.id, by: linkId, witness: witness ?? null,
      });
      rezeroed.push({ void: v.id, by: linkId, id: recId });
    }
    return { log: next, rezeroed };
  }

  /**
   * rezeroVoid(log, voidId, { by, witness }) — a filling that did not come
   * through the door as an arrangement (a face's own filler organ found what
   * the void was empty of): the same REC·Ground the door lands, with the
   * filling NAMED. Refused for an unknown or already-filled void; `by` is
   * required — a re-zero names what re-zeroed it (P41: never a silent fill).
   */
  function rezeroVoid(log, voidId, { by, witness = null } = {}) {
    if (typeof by !== "string" || !by.trim()) return { log, refused: { type: "no_filling", detail: "a re-zero names what filled the void" } };
    const v = foldVoids(log).find((x) => x.id === voidId);
    if (!v) return { log, refused: { type: "no_open_void", voidId, detail: "nothing stands open to fill — the void is undeclared, filled, or withdrawn" } };
    const recId = `rec:${log.nextSeq}`;
    const next = append(log, {
      kind: ENTRY_KINDS.EVIDENCE, task_id: recId, operator: "REC", operator_basis: OPERATOR_BASIS.PRODUCED, grain: GROUND,
      ...cellFields("REC", GROUND),
      description: `re-zero: ${voidId} filled by ${by}`,
      rezeros: voidId, by, witness,
    });
    return { log: next, id: recId, refused: null };
  }

  /** The fillings landed at or after `seq` — what re-zeroed since a caller's cursor (a turn's start, a reader's last look). */
  function fillingsSince(log, seq = 0) {
    const out = [];
    for (const e of log?.entries ?? []) if (e?.kind === ENTRY_KINDS.EVIDENCE && e.operator === "REC" && e.rezeros && e.seq >= seq) out.push({ void: e.rezeros, by: e.by ?? null, witness: e.witness ?? null, at: e.seq });
    return out;
  }

  /** A void THROUGH TIME: every declaration and every filling, in order, with its standing now.
   * An open void whose search never declared its total (`reached === null`)
   * reads "reach-unknown", never "open" as a finding: a scope without a
   * total is legitimate, but it is not a result. */
  function voidTimeline(log, voidId) {
    const events = [];
    for (const e of log?.entries ?? []) {
      if (e?.task_id === voidId && e.void === true) events.push({ at: e.seq, act: e.kind === ENTRY_KINDS.SUPERSEDE ? "redeclared" : "declared", scope: e.scope ?? null, reached: e.reached ?? null });
      if (e?.kind === ENTRY_KINDS.EVIDENCE && e.operator === "REC" && e.rezeros === voidId) events.push({ at: e.seq, act: "filled", by: e.by, witness: e.witness ?? null });
      if (e?.kind === ENTRY_KINDS.EVIDENCE && e.operator === "REC" && e.concedes === voidId) events.push({ at: e.seq, act: "conceded", trigger: e.trigger ?? null });
    }
    events.sort((a, b) => a.at - b.at);
    const last = events.at(-1) ?? null;
    const standing = !last ? "undeclared" : last.act === "filled" ? "filled" : last.act === "conceded" ? "conceded" : (last.reached ?? null) === null ? "reach-unknown" : "open";
    return { void: voidId, events, standing };
  }

  /**
   * negationTimeline(log, linkId) — a denial THROUGH TIME. A cut, a link and
   * the contest between them are events on the record, never a state: this
   * projects every act that touched one claim, in the order it landed —
   * link heard, cut heard, contest landed, contest settled, link or cut
   * conceded — each with its seq (`at`). A reader at any cursor can say what
   * was denied, when, by whom, and whether it still stands. Nothing here is
   * derived from the present fold alone; a conceded cut is still in the
   * timeline with its concession after it.
   */
  function negationTimeline(log, linkId) {
    const cutId = CUT_PREFIX + linkId;
    const tasks = projectTasks(log);
    const events = [];
    const link = tasks.find((t) => t.task_id === linkId) ?? null;
    const cut = tasks.find((t) => t.task_id === cutId) ?? null;
    if (link) events.push({ at: link.first_seq, act: "link", id: linkId, witnesses: link.witnesses ?? [] });
    if (cut) events.push({ at: cut.first_seq, act: "cut", id: cutId, witnesses: cut.witnesses ?? [], because: cut.because ?? null });
    for (const d of disputeHistory(log)) {
      if (d.noteId !== linkId) continue;
      events.push({ at: d.at, act: "contest", id: d.id, source: d.source, kind: d.kind, because: d.because });
      if (d.settled) events.push({ at: d.settled.at, act: "settled", id: d.id, outcome: d.settled.outcome, trigger: d.settled.trigger });
    }
    for (const e of log?.entries ?? []) {
      if (e?.kind === ENTRY_KINDS.EVIDENCE && e.operator === "REC" && (e.concedes === linkId || e.concedes === cutId))
        events.push({ at: e.seq, act: "conceded", id: e.concedes, trigger: e.trigger ?? null });
    }
    events.sort((a, b) => a.at - b.at || a.act.localeCompare(b.act));
    const gone = concededIds(log);
    return {
      link: linkId,
      events,
      standing: {
        link: link ? (gone.has(linkId) ? "conceded" : "live") : "unheard",
        cut: cut ? (gone.has(cutId) ? "conceded" : "live") : "unheard",
        contest: events.some((e) => e.act === "contest") ? (events.some((e) => e.act === "settled") ? "settled" : "open") : "none",
      },
    };
  }

  function fold(log) {
    const gone = concededIds(log);
    // The contest, projected beside the note. `disputedBy` rides ONLY when a
    // live dispute exists, so a ledger that has heard no disagreement folds
    // byte-identically to how it folded before this act existed — the same
    // rule `joins` and `unbridged` already follow one line down.
    const contested = disputesOf(log);
    return projectTasks(log)
      .filter((t) => t.end1 && t.label && t.end2 && !t.derived && !t.cut && !t.void && !gone.has(t.task_id))
      // `joins` and `unbridged` ride only when they exist, so a note that
      // crossed no universe has exactly the shape it always had.
      .map((t) => ({ id: t.task_id, end1: t.end1, label: t.label, end2: t.end2, witnesses: t.witnesses ?? [], spans: t.spans ?? [], ...(t.joins?.length ? { joins: t.joins } : {}), ...(t.unbridged ? { unbridged: t.unbridged } : {}), ...(contested.get(t.task_id)?.length ? { disputedBy: contested.get(t.task_id).map((d) => d.source) } : {}) }))
      .sort((a, b) => b.witnesses.length - a.witnesses.length || a.id.localeCompare(b.id));
  }

  /** fold(log) with each note's standing disclosed beside it — the shape a consumer that never withholds should read. */
  const foldWithStanding = (log) => fold(log).map((n) => ({ ...n, ...standingOf(n) }));

  /**
   * readingFromNotes(log, { source }) — the reader's own postures in the
   * shape experience-priors.js sediments. Only the ACT crosses (operator,
   * stance, terrain); no end, label, witness or span does — those are
   * world-facing and a prior that learned them would be learning the world
   * from its own habits. An entry with no cell contributes nothing.
   */
  function readingFromNotes(log, { source } = {}) {
    if (!source) throw new TypeError("readingFromNotes: a source is named — an unattributed reading cannot support cross-work memory");
    const transformationObjects = [];
    for (const e of log?.entries ?? []) {
      if (!e?.stance || !e?.operator) continue;
      transformationObjects.push({ operator: e.operator, stance: e.stance, terrain: e.terrain ?? null });
    }
    return { source, reading: { fold: { graphEntries: [], transformationObjects }, terrainState: {} }, postures: transformationObjects.length };
  }

  /** The hearing entries, in the order the ledger recorded them. */
  const hearings = (log) => (log?.entries ?? []).filter((e) => e?.end1 && e.label && e.end2 && (e.kind === ENTRY_KINDS.PROPOSE || e.kind === ENTRY_KINDS.SUPERSEDE));

  /**
   * stream(log, { by }) — the ledger as the sequence of hearings it
   * recorded, one symbol per hearing: `by: "id"` (which note), `"end1"`,
   * `"end2"`, `"label"`. A re-sighting that appended nothing is not in it —
   * the stream is the record's own, and the record keeps only what taught
   * it something. Each element is returned with the seq it came from so a
   * cut can be carried back to the entry.
   */
  function stream(log, { by = "id" } = {}) {
    const pick = { id: (e) => e.task_id, end1: (e) => e.end1, end2: (e) => e.end2, label: (e) => e.label }[by];
    if (!pick) throw new TypeError(`stream: by is one of id | end1 | end2 | label, not ${JSON.stringify(by)}`);
    return hearings(log).map((e) => ({ symbol: String(pick(e)), seq: e.seq }));
  }

  /**
   * figures(log, { by, order }) — each hearing's surprise, in bits, under
   * the ground heard before it. The floor is the stream's own alphabet
   * (one rule with `segment`): with a GROWING floor every later first
   * occurrence reads a hair more surprising than an earlier one, and a
   * ranking by bits then just names the last hearings — which is exactly
   * what the first run of notes-segments.mjs mistook for a finding.
   */
  function figures(log, { by = "id", order } = {}) {
    const s = stream(log, { by });
    const symbols = s.map((x) => x.symbol);
    const bits = surprises(symbols, { order, alphabetSize: new Set(symbols).size });
    return s.map((x, i) => ({ ...x, bits: bits[i] }));
  }

  /** The source a hearing came from: the witness it was last heard by, up to its address or its recipe. */
  const defaultSourceOf = (e) => { const w = String((e?.witnesses ?? []).at(-1) ?? ""); return w ? w.split("#")[0].split("~")[0] : null; };

  /**
   * dietBoundaries(log, { by, order, alpha, draws, seed, sourceOf }) — where a
   * reading stopped hearing its material.
   *
   * For each source, the ledger's hearings in order; each hearing's surprise
   * under the ground heard before it; the TAIL RUN — how many hearings at the
   * very end sit at or above the null's cut — against the tail runs the
   * same hearings produce with their order destroyed. A tail run longer than
   * the shuffle's own (1−alpha) quantile is a boundary: from that hearing on,
   * nothing the reading heard recurred with what it had heard before. What
   * that is (a wrapper, a bibliography, an index, a licence) this file does
   * not know; it reports the run and its seqs, and `concedeDiet` is a
   * separate act. No site rule, no vocabulary, no medium: the same test on a
   * score would find where the applause starts.
   *
   * MEASURED, AND REFUTED AS A WRAPPER DOOR (2026-09-02, eval/the-fold/
   * diet-boundary.mjs). On planted structure it is exact (the pin below).
   * On real material it fails its control in both directions: the three
   * Wikipedia wrappers and Project Gutenberg's 18KB licence tail do NOT form
   * a run (their ends recur — "Project Gutenberg", "the Foundation",
   * "Статьи"), while the pages cut back to prose DO fire — on a closing
   * section that is a list of adaptations, or of streets named after the
   * battle. What this measures is a TAIL OF ENDS THAT NEVER RECUR, which is
   * the shape of a list, not of furniture. So `dietBoundaries` stays as a
   * diagnostic (it reports exactly that, with its null), and `concedeDiet`
   * is NOT licensed on real material — kept, tested, and named so it is not
   * rebuilt as an admission act under a new name. The results doc has the
   * numbers.
   *
   * `sourceOf(entry)` keys hearings to a source (default: the last witness up
   * to its `#` address or `~` recipe — P5.2's own address shape). A source
   * with fewer than two hearings is reported with `run: null`, never judged.
   */
  function dietBoundaries(log, { by = "end1", order, alpha, draws, seed, sourceOf = defaultSourceOf } = {}) {
    for (const [k, v] of Object.entries({ order, alpha, draws, seed })) if (!Number.isFinite(v)) throw new TypeError(`dietBoundaries: ${k} is declared`);
    const entryAt = new Map(hearings(log).map((e) => [e.seq, e]));
    const bySource = new Map();
    for (const x of stream(log, { by })) {
      const src = sourceOf(entryAt.get(x.seq));
      if (src == null) continue;
      if (!bySource.has(src)) bySource.set(src, []);
      bySource.get(src).push(x);
    }
    const tailRun = (bits, cut) => { let k = 0; for (let i = bits.length - 1; i >= 0 && bits[i] >= cut; i -= 1) k += 1; return k; };
    const out = [];
    for (const [source, xs] of bySource) {
      if (xs.length < 2) { out.push({ source, hearings: xs.length, run: null, runNull: null, cut: null, boundary: false, seqs: [], refused: "too_short" }); continue; }
      const symbols = xs.map((x) => x.symbol);
      const alphabetSize = new Set(symbols).size;
      const observed = surprises(symbols, { order, alphabetSize });
      const rng = lcg(seed);
      const nullBits = [];
      for (let d = 0; d < draws; d += 1) nullBits.push(surprises(shuffled(symbols, rng), { order, alphabetSize }));
      const pooled = nullBits.flatMap((b) => Array.from(b)).sort((a, b) => a - b);
      const cut = quantile(pooled, 1 - alpha);
      const nullRuns = nullBits.map((b) => tailRun(b, cut)).sort((a, b) => a - b);
      const runNull = quantile(nullRuns, 1 - alpha);
      const run = tailRun(observed, cut);
      const boundary = run > runNull;
      out.push({ source, hearings: xs.length, run, runNull, cut, boundary, seqs: boundary ? xs.slice(xs.length - run).map((x) => x.seq) : [], refused: null });
    }
    return out;
  }

  /**
   * concedeDiet(log, boundary, { trigger }) — REC on every note whose EVERY
   * hearing falls inside the boundary's run: the reading takes back what it
   * heard after it stopped hearing the material. A note also heard before
   * the run stays — it was material once. Append-only, like every concede.
   */
  function concedeDiet(log, boundary, { trigger } = {}) {
    if (!boundary?.boundary || !boundary.seqs?.length) return { log, conceded: [], refused: { type: "no_boundary", detail: "nothing to concede — this source's tail cleared its own null" } };
    const inRun = new Set(boundary.seqs);
    const seqsOf = new Map();
    for (const e of hearings(log)) { if (!seqsOf.has(e.task_id)) seqsOf.set(e.task_id, []); seqsOf.get(e.task_id).push(e.seq); }
    const conceded = [];
    let next = log;
    for (const [id, seqs] of seqsOf) {
      if (!seqs.every((q) => inRun.has(q))) continue;
      const r = concede(next, id, { trigger: `${trigger ?? "diet boundary"}: ${boundary.source} tail run of ${boundary.run} hearings (null ${boundary.runNull})` });
      if (!r.refused && !r.noop) { next = r.log; conceded.push(id); }
    }
    return { log: next, conceded, refused: null };
  }

  /**
   * segment(log, { by, order, alpha, draws, seed, minLength, depth }) —
   * ground / figure / pattern over the ledger: the stream cut where its
   * ground was most wrong, against its own shuffled null, recursively.
   * Boundaries at every level are carried back to the seqs they fall
   * before, so a caller can test them against its own oracle.
   */
  function segment(log, { by = "id", order, alpha, draws, seed, minLength, depth = 1 } = {}) {
    const s = stream(log, { by });
    const symbols = s.map((x) => x.symbol);
    if (depth === 1) {
      // The floor is the stream's own alphabet (surprise-segments.mjs's own
      // flat call, and what recursiveSegments does per level) — one rule.
      const seg = segmentBySurprise(symbols, { order, alpha, draws, seed, minLength, alphabetSize: new Set(symbols).size });
      return { ...seg, stream: s, boundarySeqs: seg.boundaries.map((b) => s[b].seq) };
    }
    const levels = recursiveSegments(symbols, { order, alpha, draws, seed, minLength, depth });
    return { levels, stream: s, boundarySeqs: (levels[0]?.boundaries ?? []).map((b) => s[b].seq) };
  }

  return { createNotes, frameOf, frames, redeclareFrame, hear, admit, attest, concede, concededIds, concededNotes, dispute, settleDispute, pendingConcessions, disputesOf, disputedIds, disputeHistory, DISPUTE_OUTCOMES, DISPUTE_KINDS, NEEDS_THIRD_SOURCE, fold, foldWithStanding, standingOf, sourceOfWitness, recipeOfWitness, kindOfWitness, readingFromNotes, stream, figures, segment, dietBoundaries, concedeDiet, noteId, recipeId, REFUSALS, FRAME_TASK, foldCuts, negationTimeline, isCutId, CUT_PREFIX, declareVoid, foldVoids, voidTimeline, rezeroVoid, fillingsSince, isVoidId, VOID_PREFIX };
}
