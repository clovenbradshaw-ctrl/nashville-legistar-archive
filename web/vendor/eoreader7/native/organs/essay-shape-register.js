// native/organs/essay-shape-register.js — THE ESSAY'S SHAPE IS AN ASSERTION,
// NEVER A FIXED LADDER. Koestler's holon law run honestly: the shape the
// composition composes against is itself a holon — a WHOLE (the declared
// claim "an essay must ask this") and a PART (of the register, revisable by
// the material). Wilson's own closing law applies here verbatim: "CURRENT
// BEST (asymptotic — no final answer, always revisable)."
//
// WHAT THIS FIXES. document-ledger.js's `VOID_CELLS` is a fixed 27-cell
// ladder — eight of its cells assert universality with `relevant: () =>
// true` ("every essay marks its subject off", "every essay resolves its
// subject", "every essay tests its claims", ...). That is the same
// convention-hardcode S129 already retired for the whitepaper, still alive
// in the essay pipeline: the shape was inherited, never asserted. The
// batteries-and-lighthouses essay failed because the shape came from a fixed
// table + a session's bleed, not from a declaration that could be refuted.
//
// THE REGISTER. Each of the 27 cells is an ASSERTION:
//   { op, grain, terrain, holon, ask, claim, standing, history }
// where `claim` is the universal statement the cell's ask rests on, and
// `standing` starts CANDIDATE (unrefuted — mechanically defensible forever,
// never given). A specimen that demonstrates the claim's falsity refutes the
// cell: `reconsiderShape` CONCEDES it (REC — the concession is appended to
// the cell's history, never an edit, exactly hl-acquire's rule), and the
// cell is dropped from every future void. A CANDIDATE cell may be promoted
// to GIVEN only by a named giver — the same requireGiver wall hl.js holds.
//
// PURE. No fetch, no DOM, no model call. The register is a value; the
// refutation is a pure function of the material's measured shape. The
// composition reads `voidFor` through the register; the falsify tier attacks
// the register itself.

export const SHAPE_REGISTER_SCHEMA = "EOEssayShapeRegister@1";
export const STANDINGS = Object.freeze({
  CANDIDATE: "CANDIDATE", // unrefuted — an assertion the material has not contradicted
  REFUTED: "REFUTED",     // a specimen falsified the universal claim — conceded, dropped from voids
  GIVEN: "GIVEN",         // promoted by a named giver — never automatic
});

// ── THE 27 CELLS AS ASSERTIONS ─────────────────────────────────────────────
// The received ladder, re-declared as assertions. Each cell names its claim
// and the SPECIFIC counterexample that would refute it (the falsifying
// control — a claim without one is not an assertion, it is a prejudice).
// `ask` is the same question the composition emits when the cell holds.
export const SHAPE_ASSERTIONS = Object.freeze([
  // ── Existence · what exists ──
  { op: "NUL", grain: "Ground", terrain: "Void", holon: "low", ask: (s) => `What is ${s}, marked off from everything adjacent to it — what space is this essay, and what is it NOT?`, claim: "every essay marks its subject off from what it is not", falsifying: "a whole document whose subject is never marked off (a pure table, a list, a ledger — no 'what it is NOT') still reads as itself" },
  { op: "NUL", grain: "Figure", terrain: "Entity", holon: "low", ask: (s) => `Does ${s} name ONE being that clears its ground, or several that must be kept apart?`, claim: "a subject names one being, or several that must be kept apart", falsifying: "a subject that is not a being at all (a process, a relation, a state) still composes" },
  { op: "NUL", grain: "Pattern", terrain: "Kind", holon: "low", ask: (s) => `What KIND is ${s} — and do its kinds hold as kinds against the material, or are they unresolved?`, claim: "a subject has kinds that hold as kinds against the material", falsifying: "a subject with no kinds (a unique artifact, a single event) still composes" },
  { op: "SIG", grain: "Ground", terrain: "Void", holon: "high", ask: (s) => `What is absent and must be found for the essay about ${s} to exist — what presence is currently missing?`, claim: "an essay names what is absent and must be found", falsifying: "a document that composes from material already present, never naming an absence" },
  { op: "SIG", grain: "Figure", terrain: "Entity", holon: "low", ask: (s) => `Which ${s} is this — the names and the referent, so one being is meant, not a byte string?`, claim: "every essay resolves its subject to a referent", falsifying: "a document with no referent to resolve (a purely procedural instruction, a spec sheet)" },
  { op: "SIG", grain: "Pattern", terrain: "Kind", holon: "low", ask: (s) => `How many distinct ${s} keep recurring as the same kind across the sources — each candidate signed as a proposal?`, claim: "a subject's kinds recur as candidates across sources", falsifying: "a subject that appears in exactly one source, never recurring" },
  { op: "INS", grain: "Ground", terrain: "Void", holon: "low", ask: (s) => `What baseline account of ${s} must be built before any judgment can land on it?`, claim: "a judgment lands only on a built baseline account", falsifying: "a document that judges without building a baseline (an assertion from authority)" },
  { op: "INS", grain: "Figure", terrain: "Entity", holon: "high", ask: (s) => `What does the essay bring into being about ${s} — the portrait, the thesis — what is born here that did not exist before?`, claim: "an essay brings a thesis into being", falsifying: "a document that carries no thesis (a reference, an index)" },
  { op: "INS", grain: "Pattern", terrain: "Kind", holon: "high", ask: (s) => `What established kind of account does the essay on ${s} instantiate — a technical account, a biography, a narrative — whichever the material supports?`, claim: "every essay instantiates an established kind of account", falsifying: "a document that instantiates no established kind (a novel one-off form)" },
  // ── Structure · how things hang together ──
  { op: "SEG", grain: "Ground", terrain: "Field", holon: "low", ask: (s) => `What extent must the essay cover, and in what units — ${s}'s range, scale, span — so a hole is a visible uncovered stretch?`, claim: "every essay declares the extent it covers", falsifying: "a document with no declared extent (an open-ended stream of notes)" },
  { op: "SEG", grain: "Figure", terrain: "Link", holon: "high", ask: (s) => `What does the essay cut apart, and is the cut derived off the material's own bytes, not a model's label?`, claim: "the essay's cuts derive from the material's own bytes", falsifying: "a document cut by the writer's own shape, not the material's" },
  { op: "SEG", grain: "Pattern", terrain: "Network", holon: "low", ask: (s) => `Where do the parts of ${s}'s story part at natural seams — what separates into distinct chapters at the material's own bridges?`, claim: "a subject's story parts at natural seams", falsifying: "a subject with no seams (a single continuous event)" },
  { op: "CON", grain: "Ground", terrain: "Field", holon: "low", ask: (s) => `What connective field do ${s}'s relations live in — the ambient of possible relations before any single one is confirmed?`, claim: "a subject's relations live in a connective field", falsifying: "a subject with no relations (a standalone fact)" },
  { op: "CON", grain: "Figure", terrain: "Link", holon: "low", ask: (s) => `What binds each named thing to ${s} — the material's own edges, each span-verified against the bytes?`, claim: "named things bind to the subject by span-verified edges", falsifying: "a document whose parts never bind to a subject (a loose collection)" },
  { op: "CON", grain: "Pattern", terrain: "Network", holon: "low", ask: (s) => `What recurring relation runs through ${s}'s story — the same cause → consequence cycle found at a real recurrence floor?`, claim: "a subject's story runs on a recurring relation", falsifying: "a subject with no recurring relation (a one-off occurrence)" },
  { op: "SYN", grain: "Ground", terrain: "Field", holon: "high", ask: (s) => `What received readings of ${s} merge into ONE carried ground the essay stands on — which accounts compile, with typed gaps for absences?`, claim: "an essay compiles received readings into one carried ground", falsifying: "a document standing on a single reading, nothing compiled" },
  { op: "SYN", grain: "Figure", terrain: "Link", holon: "low", ask: (s) => `Where do two sources about ${s} agree into one claim with two witnesses — which re-sightings fold into the same note?`, claim: "two sources about a subject can agree into one claim", falsifying: "a subject with a single source — no agreement possible" },
  { op: "SYN", grain: "Pattern", terrain: "Network", holon: "high", ask: (s) => `How do the essay's parts about ${s} compose — how do its relations chain so a reader walks from one section to the next without repetition?`, claim: "an essay's parts compose without repetition", falsifying: "a document whose parts are a flat list, never chained" },
  // ── Interpretation · what the reader holds ──
  { op: "DEF", grain: "Ground", terrain: "Atmosphere", holon: "high", ask: (s) => `What interpretive frame is the essay on ${s} declared in — a chronicle, an argument, a portrait — whichever the material demands?`, claim: "every essay is declared in an interpretive frame", falsifying: "a document with no frame (a raw transcript)" },
  { op: "DEF", grain: "Figure", terrain: "Lens", holon: "high", ask: (s) => `How many answers does the essay on ${s} hold — one thesis or several — DECLARED, never read off grammar?`, claim: "an essay declares how many answers it holds", falsifying: "a document that never declares its answer count (a Q&A log)" },
  { op: "DEF", grain: "Pattern", terrain: "Paradigm", holon: "high", ask: (s) => `What candidate framings of ${s} are proposed, which are REFUTED by the material, and which stay candidate — never given?`, claim: "an essay proposes candidate framings and refutes some by the material", falsifying: "a document with a single framing, none proposed and none refuted" },
  { op: "EVA", grain: "Ground", terrain: "Atmosphere", holon: "high", ask: (s) => `What does the essay owe the reader's accumulated picture of ${s} — and when does that ground MOVE (surprise contracts the window)?`, claim: "an essay owes the reader's accumulated picture of the subject", falsifying: "a document that assumes no reader picture (a pure reference)" },
  { op: "EVA", grain: "Figure", terrain: "Lens", holon: "high", ask: (s) => `What test must each claim about ${s} pass — grounded in the retained material, witnessed, within the declared extent?`, claim: "every essay tests its claims against retained material", falsifying: "a document whose claims are never tested against material (an opinion)" },
  { op: "EVA", grain: "Pattern", terrain: "Paradigm", holon: "high", ask: (s) => `What is each claim about ${s}'s standing across all its witnesses — agree, single, disputed, contradicted, undetermined?`, claim: "each claim's standing is read across its witnesses", falsifying: "a claim with one witness — no cross-witness standing to read" },
  { op: "REC", grain: "Ground", terrain: "Atmosphere", holon: "high", ask: (s) => `When does the essay about ${s} concede its frame and re-zero — what arrival starts a fresh atmosphere?`, claim: "an essay concedes its frame and re-zeros", falsifying: "a document that never re-zeros (a single-shot answer)" },
  { op: "REC", grain: "Figure", terrain: "Lens", holon: "high", ask: (s) => `What would make the essay about ${s} take back a specific claim — and what new ground would be born with it?`, claim: "an essay can take back a specific claim", falsifying: "a document that never retracts (a fixed decree)" },
  { op: "REC", grain: "Pattern", terrain: "Paradigm", holon: "high", ask: (s) => `What finding about ${s} forces the whole declaration to be revised — a new subspecies, a changed status, a reversed trajectory?`, claim: "a finding can force the whole declaration to be revised", falsifying: "a document that no finding could revise (a tautology)" },
]);

const byCell = new Map(SHAPE_ASSERTIONS.map((a) => [`${a.op}·${a.grain}`, a]));

/** The assertion for one cell, or null. */
export function assertionFor(op, grain) {
  return byCell.get(`${op}·${grain}`) ?? null;
}

/**
 * createShapeRegister() → the register, every cell CANDIDATE with an empty
 * history. A value, never a singleton: each composition reads its own copy so
 * one document's refutation never silently mutates a shared table.
 */
export function createShapeRegister() {
  return {
    schema: SHAPE_REGISTER_SCHEMA,
    cells: SHAPE_ASSERTIONS.map((a) => ({ op: a.op, grain: a.grain, terrain: a.terrain, holon: a.holon, ask: a.ask, claim: a.claim, falsifying: a.falsifying, standing: STANDINGS.CANDIDATE, history: [] })),
  };
}

/** The register's cells, with CANDIDATE cells first (the asserted shape). */
export function cellsOf(register) {
  return [...(register?.cells ?? [])].sort((a, b) => (a.standing === STANDINGS.CANDIDATE ? -1 : 1) - (b.standing === STANDINGS.CANDIDATE ? -1 : 1));
}

/**
 * voidFor({ topic, question, register, relevant }) → the void, emitted ONLY
 * from cells that still hold. `relevant` is the caller's relevance function
 * (the VOID_CELLS gates — this register does not re-derive them); a cell that
 * is REFUTED is never emitted, whatever the relevance gate says, and its
 * refusal is disclosed in `withheld`. A cell with no standing (unknown to the
 * register) is emitted on the relevance gate alone — the register never
 * refuses a shape it was never told about.
 */
export function voidFor({ topic = "this subject", question = "", register = null, relevant = () => true, reading = null } = {}) {
  const t = String(topic ?? "").trim() || "this subject";
  const cells = [];
  const withheld = [];
  const source = Array.isArray(register?.cells) ? register.cells : SHAPE_ASSERTIONS;
  for (const cell of source) {
    const cellKey = `${cell.op}·${cell.grain}`;
    const isRefuted = cell.standing === STANDINGS.REFUTED;
    if (isRefuted) { withheld.push({ op: cell.op, grain: cell.grain, cell: cellKey, reason: `refuted: ${cell.claim}` }); continue; }
    if (!relevant(question, reading)) continue;
    cells.push({ question: cell.ask(t), op: cell.op, grain: cell.grain, terrain: cell.terrain, holon: cell.holon, cell: cellKey, relevant: true, essay: cell.holon === "low", standing: cell.standing });
  }
  return { cells, withheld, of: cells.length, subject: t };
}

/**
 * reconsiderShape({ register, refutedCells, specimen }) → the register after
 * CONCESSION. `refutedCells` names the cell keys a specimen demonstrated
 * false; each CANDIDATE cell named is CONCEDED (standing → REFUTED, the
 * concession appended to its history with the specimen — REC, never an edit).
 * A cell already REFUTED is not re-conceded (idempotent). A cell not in the
 * register is refused the concession (unknown — never guessed).
 */
export function reconsiderShape({ register, refutedCells = [], specimen = null } = {}) {
  if (!register || register.schema !== SHAPE_REGISTER_SCHEMA) return { refused: { type: "not_a_register", detail: "reconsiderShape: an EOEssayShapeRegister@1 is required" } };
  const cells = register.cells.map((cell) => {
    const key = `${cell.op}·${cell.grain}`;
    if (cell.standing !== STANDINGS.CANDIDATE) return cell;
    if (!(refutedCells ?? []).includes(key)) return cell;
    return {
      ...cell,
      standing: STANDINGS.REFUTED,
      history: [...cell.history, { was: STANDINGS.CANDIDATE, at: new Date().toISOString(), specimen: String(specimen ?? "?"), trigger: `a specimen demonstrated the claim false: ${cell.claim}` }],
    };
  });
  return { register: { ...register, cells }, conceded: cells.filter((c, i) => register.cells[i].standing === STANDINGS.CANDIDATE && c.standing === STANDINGS.REFUTED).map((c) => `${c.op}·${c.grain}`) };
}

/**
 * promoteShape({ register, cells, giver }) → CANDIDATE cells promoted to
 * GIVEN by a NAMED giver (hl.js's requireGiver wall — never automatic, never
 * the register's own decision). A promotion without a giver is refused.
 */
export function promoteShape({ register, cells = [], giver = null } = {}) {
  if (!giver || !String(giver).trim()) return { refused: { type: "giver_required", detail: "promoteShape: a named giver is required — promotion is never automatic" } };
  if (!register || register.schema !== SHAPE_REGISTER_SCHEMA) return { refused: { type: "not_a_register", detail: "promoteShape: an EOEssayShapeRegister@1 is required" } };
  const want = new Set(cells.map((c) => String(c).trim()));
  const cellsOut = register.cells.map((cell) => {
    const key = `${cell.op}·${cell.grain}`;
    if (cell.standing !== STANDINGS.CANDIDATE || !want.has(key)) return cell;
    return { ...cell, standing: STANDINGS.GIVEN, history: [...cell.history, { was: STANDINGS.CANDIDATE, at: new Date().toISOString(), giver: String(giver), trigger: `promoted by named giver ${giver}` }] };
  });
  return { register: { ...register, cells: cellsOut }, promoted: cellsOut.filter((c, i) => register.cells[i].standing === STANDINGS.CANDIDATE && c.standing === STANDINGS.GIVEN).map((c) => `${c.op}·${c.grain}`) };
}

/**
 * repairStaleComposition({ register, sections, specimen }) — the HOLONIC
 * repair for a bored (flat-repetition) piece. Meyer's surprise, run on the
 * register: "boredom is surprising" — a piece that restates the same section
 * across N slots is a FELT DEVIATION OF ZERO, which is itself the signal.
 *
 * THE NINE TERRAINS, AT ONCE. The flat list is not one failure — it is the
 * whole composition's, readable in every terrain the register asserts:
 *   Void      (NUL)      — the piece never marks its extent; every part is the same extent
 *   Entity    (SIG)      — one being restated, several kept apart never named
 *   Kind      (INS)      — one kind of account fills every slot
 *   Field     (SEG/CON)  — the extent never widens; the connective field is one relation
 *   Link      (CON/SYN)  — every part binds the same relation to the subject
 *   Network   (SYN)      — the parts do NOT chain; they stack — the falsifying control of SYN·Pattern
 *   Atmosphere(DEF)      — the frame never moves; one register throughout
 *   Lens      (EVA/DEF)  — one test repeated; no claim is taken back or re-tested
 *   Paradigm  (REC/DEF)  — no candidate framing is proposed; one is never refuted
 * The repair reads the SPECIMEN (the flat sections) against every assertion,
 * CONCEDES each cell whose falsifying control the specimen demonstrates, and
 * re-composes the flat list by CHAINING — a merge that keeps the sections'
 * distinct content and fuses the restatements, the merge landing as the
 * SYN·Pattern concession (the flat list, chained).
 *
 * PURE. No fetch, no model call. The merge is mechanical — and it sits on
 * REFERENTS, never on spans (2026-09-21, the user's correction): a section
 * is paired as a restatement not by its byte-span similarity but by the
 * BEINGS it resolves to. Two sections that carry the SAME referents (the
 * reader's established beings — the Cumberland River, Nashville, the Corps)
 * are one claim restated; two sections that carry DIFFERENT beings are kept
 * apart, never fused. `referents` is the caller's reading index (the
 * sessionReferentIndex's `resolveIn`/`represent`), the same identity face
 * the holographic satisfaction folds against. When no index is supplied,
 * the merge falls back to span tokens (a degraded mode, disclosed as such)
 * — the referent ground is the truth, the span fallback a measured gap.
 *
 * Falsifying control: a piece with genuine variety (no section shares a
 * referent with another) must NOT be refuted or merged — the repair never
 * touches a composed whole, and never fuses two different beings into one
 * voice.
 */
export function repairStaleComposition({ register = null, sections = [], specimen = "measured flat list", referents = null } = {}) {
  const reg = register && register.schema === SHAPE_REGISTER_SCHEMA ? register : createShapeRegister();
  const lines = Array.isArray(sections) ? sections.map((s) => String(s ?? "").trim()).filter(Boolean) : [];
  if (lines.length < 2) return { conceded: [], merged: lines, register: reg, referents: referents ?? null, basis: "fewer than two sections — nothing to test" };

  // THE REFERENT FACE (the truth) with a span fallback (the measured gap).
  // resolveIn returns the beings a text names (a Set of ids); represent gives
  // the longest surface. On referents: two sections pair when they resolve to
  // the SAME beings. On spans: the word-overlap fallback, disclosed as such.
  const resolveBeings = (text) => {
    if (!referents || typeof referents.resolveIn !== "function") return null;
    try {
      const ids = referents.resolveIn(String(text ?? ""));
      const set = ids instanceof Set ? ids : new Set(ids ?? []);
      return [...set].map((id) => { try { return referents.represent?.(id) ?? id; } catch { return id; } });
    } catch { return null; }
  };
  const spanTokens = (s) => {
    const words = String(s).toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 4 && !["there", "their", "which", "about", "would", "could", "these", "those", "river", "essay", "piece"].includes(w));
    return [...new Set(words)];
  };
  const beingsOf = (text) => resolveBeings(text) ?? spanTokens(text);
  const beingSource = resolveBeings(lines[0]) ? "referents" : "spans";

  const groups = [];
  const used = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (used.has(i)) continue;
    const a = new Set(beingsOf(lines[i]));
    const group = [i];
    used.add(i);
    for (let j = i + 1; j < lines.length; j++) {
      if (used.has(j)) continue;
      const b = new Set(beingsOf(lines[j]));
      let shared = 0;
      for (const t of a) if (b.has(t)) shared++;
      const ratio = shared / Math.min(a.size, b.size);
      if (ratio >= 0.5 && a.size >= 1 && b.size >= 1) { group.push(j); used.add(j); }
    }
    if (group.length > 1) groups.push(group);
  }
  if (!groups.length) return { conceded: [], merged: lines, register: reg, referents: referents ?? null, basis: `no flat list — the sections vary (grounded on ${beingSource}); the ground holds` };

  // THE CONCESSIONS, ACROSS THE NINE TERRAINS: every cell whose falsifying
  // control the flat specimen demonstrates is REFUTED (REC, never an edit).
  // SYN·Pattern is the direct one ("a flat list, never chained"); the others
  // are the same flatness read in their own terrain.
  const flatCells = [
    "NUL·Ground", "SIG·Figure", "INS·Pattern", "SEG·Ground",
    "CON·Figure", "CON·Pattern", "SYN·Pattern", "SYN·Figure",
    "DEF·Ground", "DEF·Figure", "DEF·Pattern", "EVA·Pattern",
    "REC·Pattern",
  ];
  const after = reconsiderShape({ register: reg, refutedCells: flatCells, specimen });

  // THE MERGE: keep the LONGEST variant of each flat group, fold any distinct
  // content the shorter carries, and chain the kept parts in order. The flat
  // list becomes a chained list — the SYN·Pattern falsifying control answered.
  const merged = [];
  const handled = new Set();
  for (let i = 0; i < lines.length; i++) {
    if (handled.has(i)) continue;
    const g = groups.find((grp) => grp.includes(i));
    if (!g) { merged.push(lines[i]); continue; }
    for (const idx of g) handled.add(idx);
    const parts = g.map((idx) => lines[idx]).sort((x, y) => y.length - x.length);
    const keep = parts[0];
    // Distinctness is ALSO referent-grounded: a sentence that carries a being
    // the kept section does NOT already carry is a different being, folded in
    // — a sentence that only restates the kept beings is the same claim, dropped.
    const keptBeings = new Set(beingsOf(keep));
    const distinct = parts.slice(1)
      .map((p) => p.split(/(?<=[.!?])\s+/))
      .flat()
      .filter((sentence) => {
        const t = beingsOf(sentence);
        if (!t.length) return false;
        const carried = t.filter((w) => keptBeings.has(w)).length;
        return carried / t.length < 0.5;
      });
    merged.push([keep, ...distinct].join(" "));
  }

  // THE PERSPECTIVES WITHIN THE CONTENT, KEPT APART (2026-09-21, Mahavira +
  // Scheherazade). The merge fuses RESTATEMENTS of one standpoint — it must
  // never fuse TWO standpoints into one voice. Each flat group is one holder's
  // recurrence; the chained piece must still name WHOSE account each surviving
  // part carries. The content's own declared speakers (Scheherazade's heading
  // table) and the essay's declared holders are read off the merged bytes and
  // kept as a binding table: a standpoint the material itself marks off (the
  // Corps, the river towns, the recreation economy) is a perspective the piece
  // keeps apart, never the essay's single voice wearing everyone's facts.
  const standpointOf = (section) => {
    const heading = /^#{1,6}\s+(.+)$/m.exec(String(section ?? ""))?.[1] ?? null;
    if (heading) return heading.trim();
    const holder = /^([A-Z][A-Za-z' -]{2,40})\s*[:—-]/.exec(String(section ?? "").trim())?.[1] ?? null;
    if (holder) return holder.trim();
    return null;
  };
  const standpoints = [...new Set(merged.map(standpointOf).filter(Boolean))];

  // The refutation's specimen is grounded FOR WHOM (Panini) and the refuted
  // cells ride the register; the perspectives map is the Mahavira disclosure:
  // which standpoints the chained piece holds apart, so the merge is never a
  // voice-flattening. Both are returned with the repair.
  const perspectives = Object.freeze({
    forWhom: null, // the caller's declared experiencer — filled by the caller (proxy) with pathos.forWhom
    keptApart: Object.freeze(standpoints),
    rule: "a merge fuses restatements of ONE standpoint, never two standpoints into one voice — Mahavira's standpoints kept apart, Scheherazade's nested tellers bound to their frames",
  });

  return {
    conceded: after.conceded,
    merged,
    register: after.register,
    referents: referents ?? null,
    groundedOn: beingSource,
    perspectives,
    basis: `stale composition repaired on ${beingSource}: ${groups.length} flat group(s) merged (${lines.length} → ${merged.length} chained part(s)); ${after.conceded.length} shape assertion(s) refuted across the nine terrains; ${standpoints.length} content standpoint(s) kept apart`,
  };
}