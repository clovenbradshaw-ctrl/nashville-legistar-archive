// build-log.js — anything built is an append-only log with EO notation.
//
// A build (a code artifact, a table, an html/svg render — anything the
// conversation produces and keeps) is never a mutable object. It is a thread
// on the engine's own task log (eoreader6 engine/holon/task-log.js): its
// birth is a PROPOSE, every edit is a SUPERSEDE that keeps the past, every
// run attaches a RESULT, and what the app shows is a FOLD over the entries —
// the projected build, at whatever cursor position the reader has scrubbed
// to, downloadable there. "The code" is not a field that gets overwritten;
// it is the answer to "fold the log up to here."
//
// The EO typing is mechanical, from the ACT, never from the content (the
// cube is not a content classifier — POLICIES/CLAUDE.md both carry the
// refuted measurement). The constitutive entries carry it:
//
//   PROPOSE   → INS · Figure · produced — BIRTH. Generate · Existence: a
//               new whole brought into being, in the domain of "is this
//               thing here at all" (the handbook's own axes, 201-nine-verbs;
//               the sibling bare-metal-eo-matrix-app reads it identically —
//               "INS creates new entities with permanent anchor IDs").
//               Corrected from SEG (2026-08-17, user direction: "INS is
//               birth"): the SEG typing read the MECHANICS (a fence snipped
//               out of the turn's answer — task-log's proposeDiscovered
//               cell) rather than the ACT (an artifact coming into being).
//               The snip is how the segment reached us; the birth is what
//               the entry records. SEG keeps its true station below, as the
//               delta primitive that cuts a reach-unit out. INS → SYN runs
//               forward in the engine's own order (… DEF → INS → SYN …), so
//               the referee stays silent — pinned, as ever, against the
//               real checker.
//   SUPERSEDE → SYN · Figure · produced — a new whole compiled from the
//               prior version and the edit. SEG → SYN … SYN never runs the
//               algebra backward (checkCubeProgression stays silent on a
//               build thread; the conformance test pins this against the
//               engine's own checker). A SUPERSEDE comes in two carriages:
//               FULL (the entry holds the whole code, reviseBuild) and
//               PATCH (the entry holds only a delta, patchBuild) — same
//               kind, same cell, because the typing is from the ACT
//               (supersession) and both acts supersede one version with the
//               next. The patch carriage is the one a small model can be
//               right about: it states the smallest change, and the FOLD
//               compiles the new whole mechanically — which is SYN's own
//               verb ("compile: a whole composed from parts") read
//               literally: the parts are the prior version and the delta,
//               and the composer is foldBuild, never the model retyping
//               bytes it was not asked to touch.
//
// THE DELTA'S OWN PRIMITIVES ARE THE OPERATORS (user direction,
// 2026-08-17: "use the 9 operators as the primitives"). A patch is a list
// of ops, each typed by the operator whose act it is:
//
//   INS · admit   — new bytes come into being, bound after an anchor the
//                   projection already holds ({op:"INS", find, add} —
//                   `add` lands immediately after `find`).
//   SEG · snip    — a reach-unit is cut out ({op:"SEG", find} — `find` is
//                   removed).
//   SYN · compile — a span is recompiled ({op:"SYN", find, add} — `find`
//                   becomes `add`).
//
// All three reduce to one mechanical application rule — the op's bytes
// must appear in the projection EXACTLY ONCE — so an op that names bytes
// the projection does not hold is a typed gap (`unlocated`), an op whose
// bytes appear twice is a typed gap (`ambiguous`), and application is
// atomic: one failing op and NOTHING lands. Never a silent no-op, never a
// guess at intent.
//
// WHY THE PRIMITIVES LIVE INSIDE ONE SYN ENTRY RATHER THAN AS ENTRIES OF
// THEIR OWN — the same wall that forced REC into its own thread, conceded
// to rather than argued with: checkCubeProgression walks a supersedes-
// chained thread and flags any adjacent pair that runs the production
// order backward, and the order is one-way (INS fires before SYN; SEG
// before INS). A deletion entry (SEG) landing after an insertion entry
// (INS) — the normal case, iterating on a widget — would flag on the
// engine's own referee. So the ENTRY is the supersession (SYN, the fold
// compiles) and the OPS carry the operator primitives as the delta's own
// vocabulary. The algebra's order is why; it is stated here so the next
// pass does not re-derive it or, worse, bolt the ops on untyped.
//   EVIDENCE  → REC · Figure · produced — a RE-ZERO. The operator judged the
//               projection ("I don't like the colours", "it's broken") and
//               the ground it was built on is conceded; the entry records the
//               trigger verbatim and names the version it concedes.
//               operators.js: REC is "rezero" — Generate · Interpretation,
//               "a new ambient ground begins".
//   RESULT    → no operator. A result attaches an answer to a task that
//               already exists; stamping an operator on it would re-type the
//               task in the fold — task-log.js::produce()'s own discipline,
//               carried rather than re-derived.
//
// WHY A RE-ZERO IS TWO ENTRIES, AND WHY IT OPENS A GROUND. The engine's
// production order is NUL SEG SIG CON EVA DEF INS SYN REC, and it is one-way:
// isProductionOrder("SYN","REC") is true, isProductionOrder("REC","SYN") is
// FALSE. So a thread that re-zeroes can never be edited again without running
// the algebra backward — which would be a real defect, not a formality, since
// editing a widget after complaining about it is the normal case. The fix is
// to take REC at its word: a re-zero begins a NEW AMBIENT GROUND. The
// concession is its own single-entry thread (EVIDENCE · REC), and the new
// ground is born the way any production is born, as a PROPOSE · SEG, with no
// `supersedes` link back — a re-zero concedes a ground, it does not compile a
// new whole out of the old one. Threads read [SEG SYN SYN…] [REC] [SEG SYN…]
// and the engine's own checker stays silent across all of them, forever, for
// any number of grounds. Nothing is rewound: every ground's entries stay on
// the log and every cursor position still folds back byte-identically.
//
// This module is the disclosed amendment to "this repo is not a cube
// consumer" (CLAUDE.md, holonic layer): for BUILDS, and builds only, the
// operator half of the task-log vocabulary is now carried, by user direction
// (2026-08-16). holon.js's plan log is unchanged.
//
// Pure, organs injected: the engine module arrives as an argument because
// this file is imported by both the page (which loads task-log.js from
// /engine) and the node tests (which load it by relative path) — the same
// pattern cast.js already carries, for the same reason. Used, never copied.

// PROVENANCE IS FOREVER (user direction, 2026-08-17: "carrying the
// provenance forever is also more important than definitive public domain
// signals"). A build seeded from found work carries `received` — the
// seed.js provenance shape: source url, repo, path, license-as-found-or-
// null, retrieval date — on its birth entry; every re-zero RE-CARRIES the
// origin's provenance onto the new ground's birth (ancestry never resets
// with the ground); the fold surfaces it; and every export stamps it as a
// comment header, so a downloaded file carries its ancestry on its face.

import { commentHeader } from "./seed.js";

/** The closed vocabulary of delta primitives — operator names, because the
 * operators ARE the primitives (header). Closed: an op outside it is
 * malformed, never coerced. */
export const PATCH_OPS = Object.freeze(["INS", "SEG", "SYN"]);

/**
 * Which of the nine a delta actually IS, computed from the delta's own
 * shape — never taken from the label the model wrote.
 *
 * MEASURED, 2026-08-17, and this is why the function exists. Asked for one
 * edit with an `op` field, both gemma2:2b and qwen2.5-coder:1.5b routinely
 * answer `op: "INS"` while supplying an `add` that plainly REPLACES `find`
 * (the whole button, restyled). Applied at its word that admits the new
 * bytes and keeps the old ones — the widget ends up with two buttons, a
 * broken artifact that passed every mechanical wall because the walls
 * checked the bytes and trusted the label. That is L5 exactly: a
 * compliance-critical fact left to the model's own instruction-following.
 * So the model supplies only `find` and `add` — the bytes, which it CAN be
 * right about — and the act is read off them:
 *
 *   add is empty            → SEG · snip     (a reach-unit is cut out)
 *   add contains find whole → INS · admit    (new bytes join what stays)
 *   otherwise               → SYN · compile  (the span becomes a new one)
 *
 * A caller that states its own op (a hand-written patch, a test) keeps it:
 * derivation is for what the mouth produced, not a wall against authorship.
 */
export function deriveOp({ find, add }) {
  if (typeof add !== "string" || add === "") return "SEG";
  if (add !== find && add.includes(find)) return "INS";
  return "SYN";
}

/** The delta as the log will carry it: the model's bytes, the derived act.
 * `add` is normalized to what each op means mechanically — an INS carries
 * only the bytes it admits, so the projection is never asked to hold the
 * anchor twice. */
export function readOps(raw) {
  if (!Array.isArray(raw)) return null;
  const ops = [];
  for (const o of raw) {
    if (!o || typeof o.find !== "string" || !o.find.length) continue;
    const add = typeof o.add === "string" ? o.add : "";
    const op = deriveOp({ find: o.find, add });
    if (op === "SEG") ops.push({ op, find: o.find });
    else if (op === "INS") {
      // add holds find plus new bytes; INS admits only the new ones, after
      // the anchor. Split on the anchor's own position so nothing is
      // duplicated and nothing is guessed.
      const at = add.indexOf(o.find);
      const before = add.slice(0, at);
      const after = add.slice(at + o.find.length);
      // Bytes on BOTH sides is not an admission after an anchor — it is a
      // recompilation of the span, and saying so is more honest than
      // splitting it into two acts nobody declared.
      if (before && after) ops.push({ op: "SYN", find: o.find, add });
      else if (after) ops.push({ op: "INS", find: o.find, add: after });
      else ops.push({ op: "SYN", find: o.find, add });
    } else ops.push({ op, find: o.find, add });
  }
  return ops.length ? ops : null;
}

/**
 * Apply a patch — a list of operator-typed ops — to a projection's code,
 * mechanically. Exact bytes, exactly once, atomic, typed gaps:
 *
 *   {op:"SYN", find, add} — `find` recompiled to `add`
 *   {op:"INS", find, add} — `add` admitted immediately after `find`
 *   {op:"SEG", find}      — `find` snipped out
 *
 * Ops apply in order, each against the text the previous op produced — a
 * later op may therefore anchor on bytes an earlier op admitted, and that
 * is a feature (the model states changes in reading order), stated here so
 * it is never mistaken for a bug.
 *
 * Returns {ok:true, code, touched} or {ok:false, gap} where gap names the
 * failing op by index and operator, with the bytes that failed — a reader
 * can act on it. No partial application ever escapes: one failing op fails
 * the whole patch. `touched` counts the places each op changed.
 *
 * `every` — AN ACT ON THE FORM RATHER THAN THE FIGURE, and the reason it
 * exists is measured, not assumed (2026-08-17). Under the strict rule the
 * dominant live failure was `ambiguous`: asked to "make the buttons
 * bigger", both small models named `style="font-size:12px;background:#eee"`
 * — which is on BOTH buttons, and which is what the operator meant. The
 * strict reading treats N matches as an unanswerable "which one"; but an
 * edit that is well-defined on every occurrence needs no choice, and
 * refusing it demands one nobody made. So `every` applies the op at every
 * occurrence and COUNTS them, and the count rides the entry and the note —
 * "changed in 2 places", never a silent multiple. Strict (`every: false`)
 * stays the default, so every existing caller and the whole conformance
 * suite keep the narrower wall.
 */
export function applyOps(code, ops, { every = false, within = null } = {}) {
  if (typeof code !== "string") {
    return { ok: false, gap: { kind: "no-projection", reason: "there is no code to patch" } };
  }
  if (!Array.isArray(ops) || !ops.length) {
    return { ok: false, gap: { kind: "malformed", reason: "a patch is a non-empty list of ops" } };
  }
  // `within` is SIG's gift: attention already scoped the arena, so the ops
  // apply against that slice alone — uniqueness is judged inside it, and
  // bytes outside it cannot be touched. The span is the one the scout
  // landed at patch time and rides the entry, so replay recompiles the
  // same act against the same arena.
  if (within) {
    const [a, b] = within;
    if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b > a && b <= code.length)) {
      return { ok: false, gap: { kind: "malformed", reason: `within must be a valid [start, end) span of the projection (got ${JSON.stringify(within)})` } };
    }
    const r = applyOps(code.slice(a, b), ops, { every });
    if (!r.ok) return r;
    return { ok: true, code: code.slice(0, a) + r.code + code.slice(b), touched: r.touched };
  }
  let out = code;
  const touched = [];
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i] ?? {};
    const op = typeof o.op === "string" ? o.op.toUpperCase() : null;
    if (!PATCH_OPS.includes(op)) {
      return { ok: false, gap: { kind: "malformed", at: i, op: o.op ?? null, reason: `op must be one of ${PATCH_OPS.join("/")}` } };
    }
    if (typeof o.find !== "string" || !o.find.length) {
      return { ok: false, gap: { kind: "malformed", at: i, op, reason: "find must be a non-empty string of the projection's own bytes" } };
    }
    if (op !== "SEG" && typeof o.add !== "string") {
      return { ok: false, gap: { kind: "malformed", at: i, op, reason: `${op} needs add: the bytes to ${op === "INS" ? "admit" : "compile in"}` } };
    }
    const count = out.split(o.find).length - 1;
    if (count === 0) {
      return { ok: false, gap: { kind: "unlocated", at: i, op, find: o.find, reason: "the op names bytes the projection does not hold" } };
    }
    if (count > 1 && !every) {
      return { ok: false, gap: { kind: "ambiguous", at: i, op, find: o.find, count, reason: `the op's bytes appear ${count} times — widen find until it is unique` } };
    }
    const replacement = op === "SEG" ? "" : op === "INS" ? o.find + o.add : o.add;
    out = every ? out.split(o.find).join(replacement) : out.replace(o.find, replacement);
    touched.push(every ? count : 1);
  }
  return { ok: true, code: out, touched };
}

/**
 * Bind the build-log operations to the engine's task-log module.
 *
 * `taskLog` is the namespace of engine/holon/task-log.js. Everything below
 * goes through its own `append` — so the vocabulary walls (kind, operator,
 * basis, grain) are the engine's walls, enforced at the moment an entry
 * comes to exist, never re-implemented here.
 */
export function makeBuildLog(taskLog) {
  const { createTaskLog, append, projectTasks, ENTRY_KINDS, OPERATOR_BASIS, STRUCTURE_OPERATORS, GRAIN_RANK } = taskLog;

  // The grains, read from the engine's own rank table rather than restated —
  // the names have one source of truth. Ground is where the ASK lives (NUL:
  // the first ground is received, never derived); Figure is where the
  // artifact lives.
  const GROUND = Object.keys(GRAIN_RANK).find((g) => GRAIN_RANK[g] === 0);
  const FIGURE = Object.keys(GRAIN_RANK).find((g) => GRAIN_RANK[g] === 1);

  // Ground 1 keeps the plain `b<n>.v<k>` address it has always had — a
  // re-zero is the only thing that ever introduces a ground segment, so a log
  // that never re-zeroed is addressed today exactly as it was yesterday, and
  // a stored one replays unchanged.
  const vid = (n, k, ground = 1) => (ground > 1 ? `b${n}.g${ground}.v${k}` : `b${n}.v${k}`);
  const rezeroId = (n, ground) => `b${n}.rezero.${ground}`;

  /** Fold the log up to (and including) `atSeq` — the projected build as of
   * that point. Omit `atSeq` for the live build. `null` means the thread has
   * no live version there (nothing yet, or retracted). */
  function foldBuild(log, atSeq = Infinity) {
    const entries = atSeq === Infinity ? log.entries : log.entries.filter((e) => e.seq <= atSeq);
    // The live VERSIONS — re-zero markers are live tasks too (they are
    // evidence about the build, never superseded), and they carry no code.
    // Folding to one would blank the projection at exactly the cursor
    // position where the reader most wants to see what was conceded.
    const tasks = projectTasks({ entries }).filter((t) => t.version != null);
    if (!tasks.length) return null;
    // One live version per ground; the last is the newest ground's — which
    // is the build as it now stands. projectTasks sorts by first_seq, so
    // "last" is "most recently born", not an accident of Map order.
    const t = tasks[tasks.length - 1];
    const ground = t.ground ?? 1;
    // The instruction is a build-log field, not engine vocabulary —
    // projectTasks does not carry it. Read it from the PROPOSE entry
    // that birthed this thread (the one matching this build's n).
    const propose = entries.find(
      (e) => e.kind === ENTRY_KINDS.PROPOSE && e.n === t.n,
    );
    // A SUPERSEDE in the patch carriage holds only its delta — the code is
    // the fold's to compile (the header's SYN reading, taken literally).
    // Walk this ground's constitutive entries: the last FULL-carriage entry
    // holds authoritative code and seg; every later patch applies in seq
    // order on top. A log with no patches walks straight to its last entry
    // and reads exactly as it always has.
    const thread = entries.filter(
      (e) => e.n === t.n && (e.ground ?? 1) === ground &&
        (e.kind === ENTRY_KINDS.PROPOSE || e.kind === ENTRY_KINDS.SUPERSEDE),
    );
    let base = thread.length - 1;
    while (base >= 0 && thread[base].patch) base--;
    let code = base >= 0 ? (thread[base].code ?? null) : null;
    const seg0 = base >= 0 ? (thread[base].seg ?? null) : null;
    // A stored patch that no longer applies is a typed gap on the fold,
    // never a silent hole: patchBuild refuses a non-applying patch at
    // append, so this branch is only reachable from a corrupted store —
    // and a corrupted store degrades to the last projectable version WITH
    // the gap named, the honest floor.
    let patchGap = null;
    for (let j = base + 1; j < thread.length; j++) {
      // `every` is read back OFF the entry, never re-decided here: the
      // projection must recompile exactly the act that landed, or a cursor
      // fold would disagree with the history it is folding.
      const r = applyOps(code ?? "", thread[j].patch?.ops, { every: !!thread[j].patch?.every, within: thread[j].patch?.within ?? null });
      if (r.ok) code = r.code;
      else {
        patchGap = { seq: thread[j].seq, version: thread[j].version ?? null, ...r.gap };
        break;
      }
    }
    const seg = seg0?.type === "code" && typeof code === "string" ? { ...seg0, code } : seg0;
    return {
      n: t.n,
      turn: t.turn,
      seg,
      caption: t.caption,
      instruction: propose?.instruction ?? null,
      received: propose?.received ?? null,
      version: t.version,
      ground,
      code,
      patchGap,
      reason: t.reason ?? null,
      lastRun: t.result ?? null,
      runParams: t.params ?? null,
      cell: t.cell,
      task_id: t.task_id,
      seqMax: log.nextSeq - 1,
    };
  }

  /** How many grounds this log has had — 1 until the first re-zero. */
  function groundCount(log) {
    return log.entries.reduce((n, e) => Math.max(n, e.ground ?? 1), 1);
  }

  /** A build is born: the artifact the turn produced, snipped and named.
   *  `instruction` is the model's own plan for what this code is —
   *  mechanically derived from the plan log's task, never left to
   *  instruction-following (L5). It lands in the PROPOSE entry and
   *  travels through the fold. */
  function proposeBuild({ n, turn, seg, caption, instruction = null, received = null }) {
    // The ask precedes the artifact — NUL is received first, the birth
    // answers it. A build with no stated instruction has no ask entry:
    // history that was never given is not invented (fromLegacy's own line).
    let log = askEntry(createTaskLog(), { n, turn, ground: 1, ask: instruction });
    return append(log, {
      kind: ENTRY_KINDS.PROPOSE,
      task_id: vid(n, 1),
      description: caption,
      // INS, not SEG: birth is Generate · Existence (header). The literal
      // is the same convention the REC entry already uses — the engine's
      // append is the wall either way.
      operator: "INS",
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: FIGURE,
      n,
      turn,
      seg,
      caption,
      instruction,
      version: 1,
      ground: 1,
      code: seg?.type === "code" ? seg.code : null,
      ...(received ? { received } : {}),
    });
  }

  /**
   * The operator judged the projection, and the ground it was built on is
   * conceded. Two entries, for the reason the header states: the concession
   * (EVIDENCE · REC · Figure · produced, its own thread, carrying the
   * operator's words verbatim and the version it concedes) and the birth of
   * the next ground (PROPOSE · SEG · Figure · produced, no `supersedes` —
   * a re-zero does not compile a new whole out of the old one).
   *
   * `trigger` is the operator's own words. It is REQUIRED: a re-zero with no
   * recorded reason is a version bump wearing an operator's name, and the
   * whole point of typing this act REC rather than SYN is that the reason is
   * what makes it one. `seg` is the artifact the new ground is born with —
   * the model's actual output, so a widget that comes back as a different
   * language says so on the log rather than inheriting the old one's.
   */
  function rezeroBuild(log, { code, seg = null, caption = null, trigger, tell = null, patch = null, matchedOn = null } = {}) {
    const cur = foldBuild(log);
    if (!cur) return log;
    if (typeof trigger !== "string" || !trigger.trim())
      throw new TypeError("rezeroBuild: a re-zero records the operator's own words as its trigger");
    const ground = groundCount(log) + 1;
    const nextSeg = seg ?? cur.seg;
    const nextCode = code ?? (nextSeg?.type === "code" ? nextSeg.code : null);
    // Churn is refused here exactly as it is in reviseBuild: an identical
    // projection changes no state, and a ground that concedes nothing is not
    // a concession. The complaint is still real — it just did not land.
    //
    // The comparison is STRUCTURAL, never by reference: foldBuild compiles
    // the projected seg fresh on every call (the patch carriage means `seg`
    // is an answer, not a stored object), so `seg === cur.seg` was an
    // identity test that could only ever hold for the literal null case.
    const sameSeg =
      seg == null ||
      (seg.type === cur.seg?.type && seg.lang === cur.seg?.lang && (seg.code ?? null) === (cur.seg?.code ?? null));
    if (nextCode === cur.code && sameSeg) return log;

    const conceded = append(log, {
      kind: ENTRY_KINDS.EVIDENCE,
      task_id: rezeroId(cur.n, ground),
      description: `re-zero: ${trigger}`,
      operator: "REC",
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: FIGURE,
      n: cur.n,
      turn: cur.turn,
      ground,
      trigger,
      tell,
      // The router's own evidence for a "resolved"/"judgment" tell — which
      // of the operator's words it matched, and against which of the
      // build's own (P3: unrecognized keys ride the fold as payload; this
      // one is named so the record — not just the log — can show it).
      // Never present for "named"/"anaphora", which are self-explaining.
      ...(matchedOn && matchedOn.length ? { matchedOn } : {}),
      concedes: cur.task_id,
      concededVersion: cur.version,
      concededGround: cur.ground,
    });

    // The new ground's amended ask: the operator's judgment IS what the
    // next ground answers to, landed beside its birth.
    const asked = askEntry(conceded, { n: cur.n, turn: cur.turn, ground, ask: trigger });

    // Provenance is forever: the ORIGIN's `received` re-carries onto every
    // ground's birth — a re-zero concedes a ground, never an ancestry.
    const origin = log.entries.find((e) => e.kind === ENTRY_KINDS.PROPOSE && e.n === cur.n && e.received);

    return append(asked, {
      kind: ENTRY_KINDS.PROPOSE,
      task_id: vid(cur.n, 1, ground),
      description: caption ?? cur.caption,
      operator: "INS",
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: FIGURE,
      n: cur.n,
      turn: cur.turn,
      seg: nextSeg,
      caption: caption ?? cur.caption,
      version: 1,
      ground,
      code: nextCode,
      trigger,
      // When the new ground's seed was compiled from the conceded
      // projection by a patch (the delta the model actually produced), the
      // ops ride the birth entry as provenance. The code stays FULL here by
      // design: a ground's PROPOSE is its own base — foldBuild's patch walk
      // never crosses a ground boundary, so the seed must stand alone. The
      // field is patchProvenance, NOT patch: foldBuild reads a truthy
      // `patch` as the delta carriage, and this entry's code is full.
      ...(patch ? { patchProvenance: patch } : {}),
      ...(origin?.received ? { received: origin.received } : {}),
    });
  }

  /**
   * A new version of the working code. The prior version stays on the log —
   * supersession keeps the past. Identical code appends nothing: an entry
   * that changes no state is churn, refused here rather than recorded as
   * work. `reason` says which act this was ("edit", "reset", "restore").
   */
  function reviseBuild(log, { code, reason = "edit" } = {}) {
    const cur = foldBuild(log);
    if (!cur || cur.code === code) return log;
    const k = cur.version + 1;
    return append(log, {
      kind: ENTRY_KINDS.SUPERSEDE,
      task_id: vid(cur.n, k, cur.ground),
      supersedes: vid(cur.n, cur.version, cur.ground),
      description: cur.caption,
      operator: STRUCTURE_OPERATORS.SYN,
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: FIGURE,
      n: cur.n,
      turn: cur.turn,
      seg: cur.seg,
      caption: cur.caption,
      version: k,
      ground: cur.ground,
      code,
      reason,
    });
  }

  /**
   * A new version stated as its DELTA — the patch carriage of SUPERSEDE
   * (header: same kind, same SYN · Figure · produced cell, because the act
   * is the same supersession; what differs is what the entry carries). The
   * entry holds only {patch: {ops}}; the new whole is compiled by foldBuild,
   * so the model's job was exactly the ops and nothing else.
   *
   * The gate is here, at append: the ops are applied against the live
   * projection first, and a patch that does not apply NEVER LANDS — the
   * refusal returns as a typed gap the caller can say out loud. The return
   * shape is {log, landed, gap, churn, version, code} rather than the bare
   * log, because "did not land, and here is why" is this function's whole
   * point — reviseBuild's silent-unchanged-log convention would swallow it.
   */
  function patchBuild(log, { ops, reason = "patch", tell = null, every = false, within = null } = {}) {
    const cur = foldBuild(log);
    if (!cur) return { log, landed: false, gap: { kind: "no-build", reason: "nothing has been proposed on this log" } };
    if (cur.seg?.type !== "code" || typeof cur.code !== "string") {
      return { log, landed: false, gap: { kind: "not-code", reason: "only a code build takes a patch" } };
    }
    const r = applyOps(cur.code, ops, { every, within });
    if (!r.ok) return { log, landed: false, gap: r.gap };
    if (r.code === cur.code) return { log, landed: false, churn: true };
    const k = cur.version + 1;
    const next = append(log, {
      kind: ENTRY_KINDS.SUPERSEDE,
      task_id: vid(cur.n, k, cur.ground),
      supersedes: vid(cur.n, cur.version, cur.ground),
      description: cur.caption,
      operator: STRUCTURE_OPERATORS.SYN,
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: FIGURE,
      n: cur.n,
      turn: cur.turn,
      caption: cur.caption,
      version: k,
      ground: cur.ground,
      patch: {
        ops: ops.map((o) => ({ op: String(o.op).toUpperCase(), find: o.find, ...(typeof o.add === "string" ? { add: o.add } : {}) })),
        ...(every ? { every: true, touched: r.touched } : {}),
        ...(within ? { within: [within[0], within[1]] } : {}),
      },
      reason,
      tell,
    });
    return { log: next, landed: true, version: k, code: r.code };
  }

  /**
   * The ASK joins the log — NUL · Ground · produced, its own micro-thread.
   * "The first ground is received, never derived": what the operator asked
   * for is the ambient ground the artifact answers to, and until now it
   * rode the PROPOSE as an untyped field. As an entry it is addressable,
   * quotable in later prompts, and exactly what a REC concedes — the new
   * ground's ask lands beside its birth, so a log reads ask → artifact →
   * versions → (concession → amended ask → artifact …). This is also the
   * log's first word on the grain axis beyond Figure — the axis the
   * lexical corpus measured as the strongest of the three.
   */
  function askEntry(log, { n, turn, ground, ask }) {
    if (typeof ask !== "string" || !ask.trim()) return log;
    return append(log, {
      kind: ENTRY_KINDS.EVIDENCE,
      task_id: `b${n}.ask.${ground}`,
      description: `ask: ${ask.slice(0, 80)}`,
      operator: "NUL",
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: GROUND,
      n,
      turn,
      ground,
      ask,
    });
  }

  /**
   * Attention lands ON the log — SIG · Figure · produced, its own
   * micro-thread. What the operator's words were looking at when the
   * change was asked for: the term that resolved and the byte-span it
   * scoped. Provenance the re-zero already wanted, and the arena the
   * patch that follows applies within.
   */
  function scoutBuild(log, { term, span } = {}) {
    const cur = foldBuild(log);
    if (!cur || !term || !Array.isArray(span)) return log;
    const k = log.entries.filter((e) => e.operator === "SIG").length + 1;
    return append(log, {
      kind: ENTRY_KINDS.EVIDENCE,
      task_id: `b${cur.n}.scout.${k}`,
      description: `scout: "${term}" → [${span[0]}, ${span[1]})`,
      operator: "SIG",
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: FIGURE,
      n: cur.n,
      turn: cur.turn,
      ground: cur.ground,
      scout: { term, span: [span[0], span[1]] },
    });
  }

  /**
   * A refused patch lands ON the log — DEF · Figure · produced, its own
   * micro-thread (the REC precedent: DEF fires before INS/SYN in the
   * one-way order, so it may not join a supersedes-chain that already
   * compiled). P14 already holds this line for skills: "tried and refused
   * is evidence" — a refusal that lives only in a return value teaches
   * nobody, and the next model call walks the same dead end. The entry
   * carries the gap and the ops that failed, so the next ask can SAY what
   * was already tried. The projection is untouched: a DEF entry carries no
   * version and no code, and foldBuild never sees it.
   */
  function refuseBuild(log, { ops = null, gap, reason = "patch" } = {}) {
    const cur = foldBuild(log);
    if (!cur || !gap) return log;
    const k = log.entries.filter((e) => e.operator === "DEF").length + 1;
    return append(log, {
      kind: ENTRY_KINDS.EVIDENCE,
      task_id: `b${cur.n}.refuse.${k}`,
      description: `refused: ${gap.kind ?? "gap"}`,
      operator: "DEF",
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: FIGURE,
      n: cur.n,
      turn: cur.turn,
      ground: cur.ground,
      refusal: { gap, ops },
      reason,
    });
  }

  /**
   * What a landing actually did, witnessed — EVA · Figure · produced, its
   * own micro-thread for the same production-order reason as DEF. The
   * witness is computed mechanically (witness.js — never a model's
   * self-report; L5 applied to "did it work"), and it is what aims the
   * next delta: a landing whose witness carries findings feeds them into
   * the following ask, which is the difference between blind iteration
   * and directed iteration.
   */
  function attachWitness(log, { witness } = {}) {
    const cur = foldBuild(log);
    if (!cur || !witness) return log;
    const k = log.entries.filter((e) => e.operator === "EVA").length + 1;
    return append(log, {
      kind: ENTRY_KINDS.EVIDENCE,
      task_id: `b${cur.n}.witness.${k}`,
      description: witness.ok ? "witness: clean" : `witness: ${witness.findings?.length ?? 0} finding(s)`,
      operator: "EVA",
      operator_basis: OPERATOR_BASIS.PRODUCED,
      grain: FIGURE,
      n: cur.n,
      turn: cur.turn,
      ground: cur.ground,
      of: cur.task_id,
      witness,
    });
  }

  // What a result entry keeps of each output stream. The runner's own cap is
  // 64KB per stream; a log that kept all of every run would grow past the
  // browser store's quota in a few dozen runs and persistence would fail
  // SILENTLY — the worst failure this design has. So the entry keeps a
  // declared budget and states what it dropped (`kept: {stdout: {kept, of}}`)
  // — P4's discipline: the number is declared, the gap is a result, never a
  // silent shrink. Units are string length, the same measure the runner's
  // own cap uses.
  const KEEP_STREAM_CHARS = 16 * 1024;

  const keepStreams = (outcome, keep) => {
    const data = outcome?.data;
    if (!data || typeof data !== "object") return outcome;
    const out = { ...outcome, data: { ...data } };
    for (const k of ["stdout", "stderr"]) {
      const s = data[k];
      if (typeof s === "string" && s.length > keep) {
        out.data[k] = s.slice(0, keep);
        out.data.kept = { ...(out.data.kept ?? {}), [k]: { kept: keep, of: s.length } };
      }
    }
    return out;
  };

  /**
   * A run's outcome, attached to the version that ran. `params` are the
   * run's declared numbers (lang, caps); `outcome` is what actually happened
   * (exit code, output, timedOut — or the typed failure to reach the
   * runner), its streams held to the declared keep budget. No operator:
   * results attach, they never re-type.
   */
  function attachRun(log, { params = null, outcome, keepChars = KEEP_STREAM_CHARS } = {}) {
    const cur = foldBuild(log);
    if (!cur) return log;
    return append(log, {
      kind: ENTRY_KINDS.RESULT,
      task_id: cur.task_id,
      result: keepStreams(outcome, keepChars),
      params,
    });
  }

  /** The build leaves the live set. Its entries remain — a retraction is an
   * entry too, never an erasure. */
  function retractBuild(log) {
    const cur = foldBuild(log);
    if (!cur) return log;
    return append(log, { kind: ENTRY_KINDS.RETRACT, task_id: cur.task_id });
  }

  /** Retract every ground of a build — "delete this fold" as a reader
   * means it, not "revert to an earlier ground". A re-zero's new ground
   * carries no `supersedes` link back to the one before it (the header's
   * own reasoning: a re-zero concedes a ground, it does not compile a new
   * whole out of the old one) — so grounds are INDEPENDENT threads to
   * `projectTasks`, and retracting only the current one falls back to the
   * previous ground rather than emptying the build. Measured live, not
   * assumed: a single `retractBuild` on a twice-judged fold left the
   * earlier ground fully visible again. This repeats the single-ground
   * retraction against whatever `foldBuild` currently resolves to until
   * nothing live remains, bounded by the ground count so a defect here
   * fails loud (an unretracted remainder) rather than looping forever. */
  function retractAllGrounds(log) {
    let next = log;
    const bound = groundCount(log);
    for (let i = 0; i < bound; i++) {
      if (!foldBuild(next)) break;
      next = retractBuild(next);
    }
    return next;
  }

  /** One row per entry, for the cursor's own labelling — mechanical, from
   * the entry's kind and payload, never a model's phrasing. */
  function timeline(log) {
    return log.entries.map((e) => ({
      seq: e.seq,
      kind: e.kind,
      version: e.version ?? null,
      ground: e.ground ?? 1,
      operator: e.operator ?? null,
      grain: e.grain ?? null,
      // The trigger rides on the row so the cursor can say WHY the ground
      // moved, in the operator's own words — the one thing a version number
      // cannot carry.
      trigger: e.trigger ?? null,
      label:
        e.operator === "NUL"
          ? `ask · ${String(e.ask ?? "").slice(0, 48)}`
          : e.operator === "SIG"
            ? `scout · "${e.scout?.term}" → [${e.scout?.span?.[0]}, ${e.scout?.span?.[1]})`
            : e.operator === "DEF"
          ? `refused · ${e.refusal?.gap?.kind ?? "gap"}${e.refusal?.gap?.find ? ` · ${String(e.refusal.gap.find).slice(0, 32)}` : ""}`
          : e.operator === "EVA"
            ? e.witness?.ok
              ? "witness · clean"
              : `witness · ${e.witness?.findings?.length ?? 0} finding(s)`
            : e.operator === "REC"
          ? `re-zero · ground ${e.ground} · ${e.trigger}`
          : e.kind === ENTRY_KINDS.PROPOSE
            ? (e.ground ?? 1) > 1
              ? `g${e.ground} v1 · rebuilt`
              : `v1 · built`
            : e.kind === ENTRY_KINDS.SUPERSEDE
              ? e.patch
                ? `${(e.ground ?? 1) > 1 ? `g${e.ground} ` : ""}v${e.version} · patch · ${e.patch.ops.length} op${e.patch.ops.length === 1 ? "" : "s"} (${e.patch.ops.map((o) => o.op).join(" ")})`
                : `${(e.ground ?? 1) > 1 ? `g${e.ground} ` : ""}v${e.version} · ${e.reason ?? "revised"}`
              : e.kind === ENTRY_KINDS.RESULT
                ? `ran${e.result?.data?.rendered ? " (rendered)" : e.result?.ok === false ? " (failed)" : ""}`
                : e.kind,
    }));
  }

  const EXT = {
    python: "py",
    javascript: "js",
    js: "js",
    node: "js",
    shell: "sh",
    bash: "sh",
    html: "html",
    svg: "svg",
    json: "json",
    css: "css",
    markdown: "md",
    md: "md",
  };

  const csvCell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  /**
   * The build as a downloadable file, at any cursor position. The seq is in
   * the name because it IS the address: `build-3@5.py` says exactly which
   * fold of the log these bytes are. `toDocument` is injected (artifact.js
   * owns it) so an html build downloads as the same complete document the
   * preview renders.
   */
  function exportAt(log, atSeq, { toDocument = null } = {}) {
    const b = foldBuild(log, atSeq ?? Infinity);
    if (!b) return null;
    const seq = atSeq ?? b.seqMax;
    const seg = b.seg ?? {};
    // The forever-line: an export of a seeded build carries its ancestry on
    // its face — the header is derived from the fold's own provenance at
    // export time, so every cursor position's download says where the
    // lineage began.
    const stamp = (lang, text) => {
      const h = commentHeader(lang, b.received);
      return h && !text.startsWith(h) ? h + text : text;
    };
    if (seg.type === "table") {
      const rows = [seg.head ?? [], ...(seg.rows ?? [])];
      return {
        name: `build-${b.n}@${seq}.csv`,
        mime: "text/csv",
        text: rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n",
      };
    }
    const lang = String(seg.lang ?? "").toLowerCase();
    const code = b.code ?? seg.code ?? "";
    if (lang === "html") {
      return {
        name: `build-${b.n}@${seq}.html`,
        mime: "text/html",
        text: stamp("html", toDocument ? toDocument({ ...seg, code }) : code),
      };
    }
    if (lang === "svg") {
      return { name: `build-${b.n}@${seq}.svg`, mime: "image/svg+xml", text: stamp("svg", code) };
    }
    return {
      name: `build-${b.n}@${seq}.${EXT[lang] ?? "txt"}`,
      mime: "text/plain",
      text: stamp(lang, code),
    };
  }

  /**
   * Rebuild a log from its serialized entries alone — the resumption
   * property P3 already demands of plans, held here too. Every entry goes
   * back through the engine's own `append`, so a stored row that violates
   * the vocabulary throws instead of silently loading.
   */
  function replayEntries(entries) {
    let log = createTaskLog();
    for (const e of entries ?? []) log = append(log, e);
    return log;
  }

  /**
   * Migrate a pre-log build ({seg, code, lastRun} — the mutable shape this
   * module replaces). What was known becomes entries: the original as the
   * propose, the working code (if it differed) as one supersede, the last
   * run (if any) as a result. History that was never kept cannot be
   * invented; this is the honest floor, not a reconstruction.
   */
  function fromLegacy({ n, turn, seg, caption, code, lastRun }) {
    let log = proposeBuild({ n, turn, seg, caption });
    if (seg?.type === "code" && typeof code === "string" && code !== seg.code) {
      log = reviseBuild(log, { code, reason: "edit" });
    }
    if (lastRun) log = attachRun(log, { outcome: lastRun });
    return log;
  }

  /**
   * The cube as an automated conformance wall, at RUNTIME — "no X before
   * Y" enforced by the engine's own referee (checkCubeProgression walks
   * every thread against the real production order), not only by the test
   * suite. A flagged log is a typed defect the caller must surface; a
   * missing referee (an engine build without it) is reported as its own
   * gap, never a silent pass.
   */
  function conform(log) {
    if (typeof taskLog.checkCubeProgression !== "function") {
      return [{ kind: "no-referee", detail: "this engine build carries no checkCubeProgression" }];
    }
    return taskLog.checkCubeProgression(log);
  }

  return Object.freeze({
    conform,
    proposeBuild,
    reviseBuild,
    patchBuild,
    applyOps,
    readOps,
    deriveOp,
    refuseBuild,
    attachWitness,
    scoutBuild,
    rezeroBuild,
    attachRun,
    retractBuild,
    retractAllGrounds,
    foldBuild,
    groundCount,
    timeline,
    exportAt,
    replayEntries,
    fromLegacy,
  });
}
