// nagarjuna.js — Nagarjuna, the archon in charge of THE FOUR CORNERS: every
// mechanical conclusion this instrument reaches is is / is-not / both /
// neither, and there is exactly ONE lattice for that, never two.
//
// Handle: Nāgārjuna, the Madhyamaka philosopher. His catuṣkoṭi (the
// tetralemma) states a claim's only real positions as A, not-A, both, or
// neither — and his own radical move, chasing that fourth corner, was to
// show that even "none of the four" has to be nameable, or the whole
// scheme silently smuggles in a fifth, unexamined position. Śūnyatā
// (emptiness) is not nothingness — a candidate that is currently UNBOUND
// has no fixed, independent nature yet; what it is depends on what has
// been checked against it, not on an eternal fact sitting behind the
// question. That is the discipline this file exists to keep: a void is a
// real epistemic state, not an absence to be embarrassed about or a fifth
// value to invent around.
//
// User direction, 2026-09-16, mid-build on a general (non-puzzle-shaped)
// mechanical reasoning engine: "Nagarjuna, get this all aligned." Found,
// reading the code rather than asking what it should say: this codebase
// had ALREADY built the tetralemma once, correctly, in
// eoreader7/native/interpretation/hl.js — Belnap-Dunn FDE, four verdicts
// (bound/contradicted/contested/unbound) plus a fifth, hl.js's own
// "genuine inexpressibility outside that lattice" (beyond-reach), with a
// real involution (`flip`). native/organs/precision-race.js — built the
// SAME session, hours earlier — had reinvented three of the four corners
// under different names (SETTLED/CONTRADICTION/UNDERDETERMINED), the
// exact drift class this repo's own postmortems keep naming (the
// operator-order divergence, the runtime-type ternary duplicated across
// two call sites). Separately, `declareVoid` is exported by BOTH
// the-fold/void-shape.js (a single extent with dimensions, one filler)
// and eoreader7/native/kernel/notes.js (a ledger entry with a scope and a
// timeline) — same name, unrelated meaning, neither file's header said so.
//
// THE RULES HE KNOWS. Every one mechanical, checked against real values or
// real file headers — never a matter of taste:
//
//   one-lattice        A binding that claims to BE bound/contradicted/
//                      contested/unbound/beyond-reach is hl.js's own
//                      string, byte for byte — never a re-typed synonym
//                      (P2's own drift lesson, applied to a verdict
//                      lattice instead of an operator order).
//   involution-holds   flip(bound)=contradicted, flip(contradicted)=bound,
//                      and contested/unbound/beyond-reach are each their
//                      own fixed point (hl.js's R3) — a claimed tetralemma
//                      that fails this is not the lattice it claims to be.
//   same-name-named    An export name reused across files for a DIFFERENT
//                      meaning needs each file's own header to name every
//                      sibling — the precedent this repo already set for
//                      itself ("Three modules share the name
//                      'hyperlexicon'", CLAUDE.md) — or a reader silently
//                      imports the wrong one.
//
// PURE: no fetch, no DOM, no fs. hl.js's own lattice values and `flip` are
// injected (the cast.js pattern) so this module never imports a specific
// checkout layout; file headers for the collision check are passed in as
// plain strings, already read by the caller.

export const SEVERITY = Object.freeze({ STRIKE: "strike", REFUSE: "refuse", FLAG: "flag" });

export const RULES = Object.freeze([
  { id: "one-lattice", cites: "hl.js (Belnap-Dunn FDE)", severity: SEVERITY.STRIKE, says: "a verdict claiming to be bound/contradicted/contested/unbound/beyond-reach is hl.js's own string, never a re-typed synonym" },
  { id: "involution-holds", cites: "hl.js R3", severity: SEVERITY.STRIKE, says: "flip(bound)=contradicted, flip(contradicted)=bound, contested/unbound/beyond-reach are each their own fixed point" },
  { id: "same-name-named", cites: "CLAUDE.md — 'Three modules share the name hyperlexicon'", severity: SEVERITY.FLAG, says: "a name reused across files for a different meaning needs each file's own header to name every sibling" },
]);

/**
 * makeNagarjuna({ lattice, flip }) — `lattice` is hl.js's own exported
 * value object ({BOUND, CONTRADICTED, CONTESTED, UNBOUND, BEYOND_REACH}),
 * `flip` is hl.js's own involution function. Both injected, never
 * re-derived, so this file can never drift from the one it is checking
 * against by definition.
 */
export function makeNagarjuna({ lattice, flip } = {}) {
  if (!lattice || typeof flip !== "function") {
    throw new Error("nagarjuna: lattice and flip must be injected from hl.js — there is nothing to check against otherwise");
  }
  const CANON = new Set(Object.values(lattice));

  /**
   * checkLatticeUsage(bindings) — `bindings` is a map/array of
   * `{ name, value }` a caller BELIEVES is hl.js's lattice (e.g. a
   * re-exported CONCLUSION object). Flags any value that is not literally
   * one of hl.js's own five strings — a synonym, a typo, or a second
   * lattice under a shared vocabulary all read the same way here: it does
   * not equal the canonical value, so it is not the canonical value.
   */
  function checkLatticeUsage(bindings) {
    const rows = Array.isArray(bindings) ? bindings : Object.entries(bindings ?? {}).map(([name, value]) => ({ name, value }));
    const findings = [];
    for (const { name, value } of rows) {
      if (!CANON.has(value)) {
        const rule = RULES.find((r) => r.id === "one-lattice");
        findings.push({ rule: rule.id, severity: rule.severity, cites: rule.cites, detail: `"${name}" = ${JSON.stringify(value)} is not one of hl.js's own lattice values`, name, value });
      }
    }
    return { findings, checked: rows.length };
  }

  /**
   * checkInvolution({ BOUND, CONTRADICTED, CONTESTED, UNBOUND, BEYOND_REACH })
   * — runs the injected `flip` over a candidate value set and confirms
   * Belnap's structure: bound/contradicted swap, the rest are fixed
   * points. Values default to the injected canonical lattice, so calling
   * with no argument re-proves hl.js's own flip is still the involution
   * it claims to be — this file's own self-test, not assumed.
   */
  function checkInvolution(values = lattice) {
    const findings = [];
    const pairs = [
      [values.BOUND, values.CONTRADICTED],
      [values.CONTRADICTED, values.BOUND],
      [values.CONTESTED, values.CONTESTED],
      [values.UNBOUND, values.UNBOUND],
      [values.BEYOND_REACH, values.BEYOND_REACH],
    ];
    for (const [input, expected] of pairs) {
      if (input === undefined) continue; // caller's set doesn't declare this corner — nothing to check
      const got = flip(input);
      if (got !== expected) {
        const rule = RULES.find((r) => r.id === "involution-holds");
        findings.push({ rule: rule.id, severity: rule.severity, cites: rule.cites, detail: `flip(${JSON.stringify(input)}) = ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}` });
      }
    }
    return { findings, holds: findings.length === 0 };
  }

  /**
   * checkNameCollision({ name, files }) — `files` is `[{ path, header }]`,
   * every file (read by the caller, this module touches no fs) that
   * exports a binding called `name`. Two or more files sharing a name is
   * not itself a violation — the violation is a header that does not say
   * so. `header` is checked for the OTHER files' own basenames; a file
   * naming none of its siblings is flagged.
   */
  function checkNameCollision({ name, files }) {
    const list = Array.isArray(files) ? files : [];
    if (list.length < 2) return { findings: [], collision: false };
    const basename = (p) => String(p ?? "").split("/").pop();
    const findings = [];
    for (const f of list) {
      const others = list.filter((o) => o.path !== f.path).map((o) => basename(o.path));
      const named = others.filter((sib) => String(f.header ?? "").includes(sib));
      if (named.length < others.length) {
        const missing = others.filter((sib) => !named.includes(sib));
        const rule = RULES.find((r) => r.id === "same-name-named");
        findings.push({ rule: rule.id, severity: rule.severity, cites: rule.cites, detail: `${basename(f.path)} exports "${name}" but its header never names ${missing.join(", ")}`, path: f.path, missing });
      }
    }
    return { findings, collision: true, exporters: list.map((f) => f.path) };
  }

  return { checkLatticeUsage, checkInvolution, checkNameCollision };
}
