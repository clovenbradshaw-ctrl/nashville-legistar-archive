// moves.js — the cube as the enumeration of every move available, and the
// computed answer to "which ones does this instrument actually have an organ
// for."
//
// THE DISTINCTION THIS FILE RESTS ON, because getting it wrong is a refuted
// move this repo has already measured. The cube may NOT be asked what a piece
// of text IS — `packages/engine/operators.js` records that 95.7% of cell
// assignments survived shuffling the words inside 2,527 paragraphs, so a
// terrain derived from content is noise wearing a name. What the cube CAN do
// is classify the MOVES: operator × grain is a closed, complete space of acts,
// and asking "which of these have I got an organ for" is a question about this
// codebase, not about the material. Nothing here reads a byte of content.
//
// WHY IT WAS BUILT. A page titled "List of prime ministers of Queen Victoria"
// was fetched, saved with its line structure intact, and yielded ZERO edges:
//
//     William Lamb The Viscount Melbourne
//     20 June 1837 – 30 August 1841
//
//     Sir Robert Peel
//     30 August 1841 – 29 June 1846
//     …
//
// Ten holders, exact terms, and the reading apparatus returned nothing — so
// the model was handed the raw lines and read the first name out of the list.
// The tempting diagnosis is "the verb vocabulary is too narrow," and this
// repo has already spent nine measured configurations on that theory
// (eval/results/mine-1-FINAL-COMPARISON.md). The enumeration below gives the
// real one, and it is not about vocabulary at all: `relations` occupies CON at
// LINK — Structure, Figure grain, one labelled edge between two ends. A list's
// meaning is carried by the RECURRENCE of an arrangement, which is Pattern
// grain by definition. There is no connector in any row, so a Figure-grain
// organ returns zero on this material correctly and permanently, however wide
// its vocabulary grows.
//
// That prediction is falsifiable and was checked before this file was
// written: not few edges, ZERO edges. A vocabulary gap degrades; a grain
// mismatch floors.
//
// The cell the reading needs — CON at Network — comes back EMPTY from the
// registry, and it is the same hole CLAUDE.md's own build-log accounting
// already names from the other direction ("CON (binding folds into systems)
// and the Pattern grain … are the named remainder, each its own pass").
// Two independent walks, one hole.

/**
 * makeMoves({ operators }) — the move space, against the engine's own tables.
 * `operators` is the native kernel cube injected (the cast.js pattern every
 * other organ here uses) — `native/kernel/cube.js`'s `GRAINS`,
 * `TERRAIN_BY_DOMAIN`, `OPERATOR_CHAIN` and `cellOf` — so the cells can never
 * drift from the algebra. The legacy engine namespace this file originally
 * consumed (`operatorOf`, a literal `OPERATOR_ORDER`) no longer exists there;
 * `operatorOf` is synthesized from `cellOf` exactly as the engine's own
 * capability-coverage driver does (`cellOf(op, "Ground")` — mode and domain
 * do not vary with grain), and the order is `OPERATOR_CHAIN`.
 */
export function makeMoves({ operators }) {
  const { GRAINS, TERRAIN_BY_DOMAIN, OPERATOR_CHAIN, cellOf } = operators;
  const specOf = (op) => cellOf(op, "Ground"); // {mode, domain} — grain-independent; gap-shaped like the legacy operatorOf

  /**
   * everyMove() — all 27 cells. Nine operators, three grains; the terrain is
   * DERIVED (`TERRAIN_BY_DOMAIN[domain][grain]`), never chosen, because an
   * operator's domain is fixed by its letter alone — capacities.js's own
   * header records two rows caught domain-illegal by exactly this arithmetic.
   */
  function everyMove() {
    const moves = [];
    for (const op of OPERATOR_CHAIN) {
      const { mode, domain } = specOf(op);
      for (const grain of GRAINS) {
        moves.push({ op, grain, mode, domain, terrain: TERRAIN_BY_DOMAIN[domain][grain], cell: `${op}·${grain}` });
      }
    }
    return moves;
  }

  /**
   * coverage(capabilities) — which moves this instrument has an organ for.
   *
   * A capability declares `op` and `terrain`; its GRAIN is recovered from the
   * terrain rather than trusted from a second field, so a row cannot claim a
   * grain its own terrain contradicts. A compound op ("SIG+INS") occupies
   * every cell it names — `distinguish` really is two operators in one motion
   * (grid.js), and pretending otherwise would report a covered cell as empty.
   *
   * An entry naming a terrain its operator's domain cannot reach is returned
   * as `illegal`, never silently dropped and never counted as coverage.
   */
  function coverage(capabilities) {
    const held = new Map();
    const illegal = [];
    for (const cap of capabilities ?? []) {
      for (const op of String(cap?.op ?? "").split("+").map((s) => s.trim()).filter(Boolean)) {
        const spec = specOf(op);
        if (spec?.gap) { illegal.push({ ...cap, op, why: spec.reason }); continue; }
        const row = TERRAIN_BY_DOMAIN[spec.domain];
        const grain = GRAINS.find((g) => row[g] === cap.terrain);
        if (!grain) {
          illegal.push({ ...cap, op, why: `${op} is ${spec.domain}-domain and can never land on ${cap.terrain}` });
          continue;
        }
        const cell = `${op}·${grain}`;
        held.set(cell, [...(held.get(cell) ?? []), cap.id]);
      }
    }
    const moves = everyMove().map((m) => ({ ...m, organs: held.get(m.cell) ?? [] }));
    return {
      moves,
      covered: moves.filter((m) => m.organs.length),
      empty: moves.filter((m) => !m.organs.length),
      illegal,
    };
  }

  /**
   * neighbours(cell) — the moves one step away: same operator at another
   * grain, or another operator at the same grain.
   *
   * This is what turns an empty cell into a lead rather than a shrug. An
   * empty cell whose SAME OPERATOR is occupied at a neighbouring grain is the
   * strongest kind of gap: the act is one this instrument already performs,
   * just never at that resolution — which is exactly the shape of a
   * Figure-grain reader failing on a Pattern-grain arrangement, and is
   * reported as `sameActOtherGrain` rather than left for a reader to spot.
   */
  function neighbours(cell, covered) {
    const [op, grain] = String(cell).split("·");
    const at = new Set((covered ?? []).map((m) => m.cell));
    return {
      sameActOtherGrain: GRAINS.filter((g) => g !== grain && at.has(`${op}·${g}`)).map((g) => `${op}·${g}`),
      sameGrainOtherAct: OPERATOR_CHAIN.filter((o) => o !== op && at.has(`${o}·${grain}`)).map((o) => `${o}·${grain}`),
    };
  }

  return { everyMove, coverage, neighbours };
}
