// patch.js — the mechanical, model-free patch primitive this proxy's code
// door is built on. Ported verbatim from the-fold/build-log.js (the same
// physics-not-model-JSON precedent this project's own CLAUDE.md and this
// repo's proxy-runner.mjs already state: "small local models cannot be
// trusted to tool-call" applies just as hard to a hand-typed edit op).
//
// A model is asked for only `find`/`add` — the raw bytes of an edit, which
// it can actually be right about. The ACT (SEG/INS/SYN) is DERIVED from
// those bytes, never taken from a label the model wrote. Measured directly
// in the-fold's own build-log.js history: two small models routinely
// mislabel their own edit's op (both say "INS" while supplying bytes that
// plainly REPLACE the anchor); trusting the label produced a broken
// artifact every time, deriving it from the bytes did not.
//
// Pure. No engine import, no I/O — the caller reads/writes the real file.

/** The closed vocabulary of delta primitives — operator names, because the
 * operators ARE the primitives (header). Closed: an op outside it is
 * malformed, never coerced. */
export const PATCH_OPS = Object.freeze(["INS", "SEG", "SYN"]);

/**
 * Which of the nine a delta actually IS, computed from the delta's own
 * shape — never taken from the label the model wrote.
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
 * Ops apply in order, each against the text the previous op produced.
 *
 * Returns {ok:true, code, touched} or {ok:false, gap} where gap names the
 * failing op by index and operator, with the bytes that failed — a reader
 * can act on it. No partial application ever escapes: one failing op fails
 * the whole patch. `touched` counts the places each op changed.
 *
 * `every` applies the op at every occurrence and COUNTS them (never a
 * silent multiple); strict (`every: false`) stays the default.
 */
export function applyOps(code, ops, { every = false, within = null } = {}) {
  if (typeof code !== "string") {
    return { ok: false, gap: { kind: "no-projection", reason: "there is no code to patch" } };
  }
  if (!Array.isArray(ops) || !ops.length) {
    return { ok: false, gap: { kind: "malformed", reason: "a patch is a non-empty list of ops" } };
  }
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
