// kernel/wheel.js — THE WHEEL (Void / Beings / Fold = DEF / EVA / REC), the
// one act, three positions. Every stage of the artifact pipeline is one pass
// of the wheel: it DECLARES what would satisfy it (DEF·Ground), MEASURES a
// figure against that ground (EVA — a real difference from a rebuilt ground,
// never a softmax), and LANDS the difference as the fold (REC — append-only;
// the pattern is the next stage's ground). The ledger is the REC layer; a
// correction is a superseding entry, never an edit.
//
// Handle: Friston / Warburg — the future shape drawn from the past priors,
// arranged by affinity; the felt is the economy of the reader's own
// predictions (Damasio / Gendlin / Peirce's pathos cell).
export const WHEEL_SCHEMA = "EOWheel@1";

export function createWheelLedger({ task = "" } = {}) {
  const turns = [];
  const tip = { ground: null };
  return {
    schema: WHEEL_SCHEMA,
    task,
    // DEF: declare the void — what would satisfy this stage. Nothing is
    // measured before the ground is declared (the wheel's first move).
    def(phase, satisfaction, { basis = null } = {}) { tip.def = { phase, satisfaction, basis }; return this; },
    // EVA: measure the present against the DEF — a real difference.
    eva(phase, measure, { basis = null, verdict = null } = {}) { tip.eva = { phase, measure, basis, verdict }; return this; },
    // REC: land the difference — append-only; the pattern is the next ground.
    rec(phase, landing, { basis = null, operator = null, grain = null, face = null } = {}) {
      const turn = { seq: turns.length + 1, phase, operator, grain, face, def: tip.def ?? null, eva: tip.eva ?? null, rec: landing, basis };
      turns.push(turn);
      tip.def = null; tip.eva = null; tip.ground = landing;
      return turn;
    },
    // ONE PASS: DEF → EVA → REC, in one call — the universal rhythm. Every
    // turn names its OPERATOR (the void's nine: NUL→SIG→INS→SEG→CON→SYN→
    // DEF→EVA→REC), its GRAIN (the wheel's three: Ground/Figure/Pattern), and
    // the FACE that owns the move (Gore gathers, Wolfe writes, Murch edits,
    // Ranke grounds, Kelsen resolves, LaVar grades — else the void itself).
    turn(phase, satisfaction, measure, landing, { evaBasis = null, basis = null, operator = null, grain = null, face = null } = {}) {
      this.def(phase, satisfaction);
      this.eva(phase, measure, { basis: evaBasis });
      return this.rec(phase, landing, { basis, operator, grain, face });
    },
    // the fold: the ledger is the cone, the tip is the contraction.
    tip: () => ({ ...tip }),
    get ledger() { return turns; },
    toJSON() { return { schema: WHEEL_SCHEMA, task, turns: [...turns] }; },
  };
}