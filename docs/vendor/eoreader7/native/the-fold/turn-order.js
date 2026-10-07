// turn-order.js — the turn's own checks in the cube's dependency order (P134).
//
// User, 2026-09-06, after watching a guard's finding get undone by a later
// rewrite: "put it in terms of the dependency order."
//
// That names the disease exactly. The turn had accumulated a dozen checks in
// the order they happened to be written, and each new one was slotted in by
// hand. So a decision made on evidence at one stage could be reversed by a
// stage that ran later and knew less — measured live (P133): the misquote
// check CUT a name the material contradicts, and the correction loop's own
// rewrite put it straight back. The fix at the time was to run the cut again
// afterwards, which is not an order, it is a patch shaped like one.
//
// `code-piece.js` (P117) already showed the discipline for building a
// program: the canonical chain NUL SIG INS SEG CON SYN DEF EVA REC IS a
// strict dependency order, and the joints of the work fall on it. The turn's
// checks have the same joints:
//
//   NUL  the question, and the emptiness it opens — what would answer it
//   SIG  the marks: retrieval, the snips, the atoms, what the question quotes
//   INS  what the material establishes — passages admitted, the cast
//   SEG  THE CUT: the premise checked, the misquotation found — a claim
//        separated from what the sources actually hold
//   CON  incidence: does this token belong in THIS claim (the guard)
//   SYN  the draft — the only cell the model writes in
//   DEF  the contract on what may ship
//   EVA  the checks: atoms against snips, the witness, the correction
//   REC  what is re-zeroed and what is learned
//
// THE LAW THIS BUYS, and it is the whole point: A FINDING AT AN EARLIER CELL
// IS A CONSTRAINT ON EVERY LATER ONE. SEG cuts a name; SYN may not write it,
// EVA may not restore it, REC may not learn it back. The instrument does not
// re-litigate at each stage what it already established on evidence — which
// is what a dependency order MEANS, as against a sequence of steps.
//
// A stage needing something a later cell produces is a dependency inversion
// and is refused AT CONSTRUCTION, the same way layers.js refuses the
// watcher's regress. Both are the same discipline: an order you can state is
// an order that can be checked.
//
// PURE.

/** The canonical chain. A strict dependency order, not a list of topics (code-piece.js's header states the same for programs). */
export const CHAIN = Object.freeze(["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"]);
const rank = (cell) => CHAIN.indexOf(String(cell ?? "").toUpperCase());

/**
 * plan(stages) → { order, constraints } or throws.
 * `stages`: [{ name, cell, needs?, gives?, }]. Ordered by the chain, then by
 * declaration within a cell. Every `needs` must be given by a cell at or
 * before this one; needing a later cell's product is the inversion.
 */
export function plan(stages = []) {
  const givenAt = new Map();
  for (const s of stages) {
    if (rank(s.cell) < 0) throw new TypeError(`${s.name}: ${s.cell} is not a cell of the chain`);
    for (const g of s.gives ?? []) {
      if (givenAt.has(g) && givenAt.get(g) !== rank(s.cell)) throw new TypeError(`${g} is established at two different cells`);
      givenAt.set(g, rank(s.cell));
    }
  }
  for (const s of stages) {
    for (const need of s.needs ?? []) {
      if (!givenAt.has(need)) throw new TypeError(`${s.name} needs ${need}, which no stage establishes`);
      if (givenAt.get(need) > rank(s.cell)) {
        throw new TypeError(`${s.name} (${s.cell}) needs ${need}, established later at ${CHAIN[givenAt.get(need)]} — a dependency inversion, refused at the gate`);
      }
    }
  }
  const order = [...stages].sort((a, b) => rank(a.cell) - rank(b.cell) || stages.indexOf(a) - stages.indexOf(b));
  return { order, givenAt };
}

/**
 * A finding, with the cell that established it. Later cells read it; none of
 * them may contradict it.
 */
export const finding = (cell, what, detail = {}) => Object.freeze({ cell, rank: rank(cell), what, ...detail });

/**
 * admissible(text, findings, { splitSentences }) → { text, refused }
 *
 * The enforcement. Every finding that FORBIDS something ({ forbids: [...] })
 * is applied to whatever a later cell produced. This is not a second pass of
 * the check — the check ran once, at its own cell, and this is the standing
 * consequence of what it found.
 */
export function admissible(text, findings = [], { splitSentences, from = "REC", exempt = new Set() } = {}) {
  const body = String(text ?? "");
  const forbidden = findings.filter((f) => (f.forbids ?? []).length && f.rank < rank(from));
  if (!forbidden.length || !body.trim() || typeof splitSentences !== "function") return { text: body, refused: [] };
  const kept = [];
  const refused = [];
  for (const raw of splitSentences(body)) {
    const sent = String(raw?.text ?? raw ?? "");
    if (!sent.trim()) continue;
    // What the instrument itself said stands: a finding's own statement quotes
    // the source and may contain the very token it forbids.
    if ([...exempt].some((t) => t && (sent.includes(t) || t.includes(sent)))) { kept.push(sent); continue; }
    const hit = forbidden.find((f) => (f.forbids ?? []).some((v) => sent.toLowerCase().includes(String(v).toLowerCase())));
    if (hit) { refused.push({ sentence: sent, because: hit.what, cell: hit.cell, forbids: hit.forbids }); continue; }
    kept.push(sent);
  }
  if (!refused.length) return { text: body, refused: [] };
  // Everything a later cell wrote was forbidden. What the earlier cell found
  // stands in its place — an established finding is not discarded because the
  // stage that ignored it produced nothing else.
  const standIn = forbidden.map((f) => f.says).filter(Boolean).join(" ").trim();
  return { text: kept.length ? kept.join(" ").trim() : (standIn || ""), refused };
}
