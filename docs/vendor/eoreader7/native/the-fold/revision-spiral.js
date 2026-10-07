// revision-spiral.js — THE SPIRAL OF THE THREE APPEALS (2026-09-21, the user's
// grid: ethos/logos/pathos × macro/meso/micro, mapped to real editors).
//
//   |          | ETHOS (credibility)  | LOGOS (logic)         | PATHOS (feeling)    |
//   | MACRO    | Caro — authority     | McPhee — the shape    | Gornick — the feel  |
//   | MESO     | Kidder/Todd — fair   | Clark — one job/para  | Orlean — stakes      |
//   | MICRO    | Zinsser — inflation  | Williams — cohesion   | Lish — charge /     |
//   |          |                       |                        | Klinkenborg — cadence|
//
// THE SPIRAL LAW (the physics, not a checklist): the three appeals FIGHT each
// other, so a pass never runs once. A Williams cohesion pass tightens a
// sentence and flattens its rhythm (a pathos cost); a Lish cut for charge
// strips a qualifier doing real ethos work (the honest hedge). So the control
// structure is: cut → immediately re-read for what the cut broke in the OTHER
// two dimensions → cut again. Three grains × three appeals is not nine
// independent passes; it is a SPIRAL that tightens with each rotation.
//
// THE ORDER (the user's law): all three at the MACRO grain first — does the
// shape earn trust, hold structure, know its feel — BEFORE zooming to
// paragraphs. Then the same three at MESO. Then MICRO. Then back up: a micro
// cut re-opens the macro question. Recursive, always — never waiting to the
// end, holonic at every level.
//
// THE LOGOS FLOOR: LOGOS is dead simple with hard non-redundancy (each fact
// once, frame-bearing identity). PATHOS NEVER REMOVES — it expands. The
// spiral's cuts are LOGOS work (Lish/Zinsser/McPhee are LOGOS re-verifiers of
// what pathos produced); pathos rounds re-expand the survivors.
//
// PURE. Each cell is a function (probe → findings), and the spiral is a value
// that records its own path (append-only — the piece's lineage is the log).

import { zinsserTics, klinkenborgCadence, clarkJobsAndTransitions, caroUnverified, kidderToddOmissions, mcpheeShape, williamsCausalOrder, kidderToddRelations, clarkSplice } from "./archon-rules.js";

export const REVISION_SPIRAL_SCHEMA = "EORevisionSpiral@1";
export const APPEALS = Object.freeze({ ETHOS: "ethos", LOGOS: "logos", PATHOS: "pathos" });
export const GRAINS = Object.freeze({ MACRO: "macro", MESO: "meso", MICRO: "micro" });

// ── THE GRID AS DATA — each cell is {editor, appeal, grain, probe}. The probe
// is the mechanical detector; the cell names who specializes in it. A probe
// returns findings [{kind, detail, span, fix}] or []. Cells without a
// mechanical probe carry the editor's name as the CHARGE (the capacity exists;
// the machine does what it can, names what it cannot).
// THE WORD LISTS ARE TABLES, NOT PATTERNS (KleeneUp, 2026-09-21): inflation
// words and tension-connector words are closed vocabularies — a Set of words,
// matched by membership, never a regex alternation. The probes below iterate
// the Sets explicitly; a word-list regex would be a table wearing regex
// clothes.
const INFLATION_WORDS = new Set(["vital","crucial","crucially","bustling","burgeoning","flourishing","sprawling","pivotal","instrumental","indispensable","ever-present","myriad","plethora"]);
const TENSION_CONNECTORS = new Set(["despite","although","even though","while"]);
const TENSION_PAYLOADS = new Set(["undeniable","clear","obvious","apparent","notable","significant","remarkable"]);
function findWordHits(text, set) {
  const words = String(text ?? "").toLowerCase().split(/[^a-z']+/);
  const hits = [];
  for (let i = 0; i < words.length; i++) {
    if (set.has(words[i])) hits.push({ word: words[i], index: i });
  }
  return hits;
}
export { INFLATION_WORDS, findWordHits };
function findFalseTensions(text) {
  // A connector ("despite X") followed in the same sentence by a payload word
  // ("undeniable") with no real logical work between them. The connector and
  // payload are tables; the SHAPE (connector ... payload in one sentence) is
  // the pattern the scan walks.
  const t = String(text ?? "");
  const hits = [];
  const sentenceSplit = splitSentences(t);
  for (const sent of sentenceSplit) {
    const lower = sent.toLowerCase();
    const hasConnector = [...TENSION_CONNECTORS].some((c) => lower.includes(c));
    const payload = [...TENSION_PAYLOADS].find((p) => lower.includes(p));
    if (hasConnector && payload) {
      hits.push({ kind: "false_tension", detail: `"${sent.slice(0, 60)}…" — the connector does no logical work (no real tension between the clauses)`, span: t.indexOf(sent) });
    }
  }
  return hits;
}

// THE SENTENCE SPLITTER — a TABLE + a TOKEN WALK, never a lookbehind
// (KleeneUp, 2026-09-21): a (?<=[.!?]) split breaks after every period,
// including "Dr." — the abbreviation failure. The ABBREV table and the walk
// end a sentence only when the last word is not an abbreviation AND the next
// token is capitalized. Same grammar as essay-fold's splitSentences.
const ABBREV = new Set(["dr","mr","mrs","ms","st","mt","us","usa","etc","eg","ie","vs","no","gen","gov","sen","rep","prof","sr","jr","phd","md","corps","co","inc","ltd"]);
const TERMINAL = new Set([".", "!", "?", "…"]);
function splitSentences(part) {
  const tokens = String(part).replace(/\s+/g, " ").trim().split(" ");
  const sentences = [];
  let cur = "";
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!cur) { cur = tok; continue; }
    const prevWord = cur.split(" ").pop().toLowerCase().replace(/[^a-z.]/g, "");
    const prevBase = prevWord.endsWith(".") ? prevWord.slice(0, -1) : prevWord;
    const lastChar = cur.charAt(cur.length - 1);
    const isTerminal = TERMINAL.has(lastChar);
    const isAbbrev = ABBREV.has(prevWord) || ABBREV.has(prevBase) || /^\.[A-Z]/.test(tok);
    const nextCaps = /^[A-Z]/.test(tok);
    if (isTerminal && nextCaps && !isAbbrev) {
      sentences.push(cur.trim());
      cur = tok;
    } else {
      cur += " " + tok;
    }
  }
  if (cur.trim()) sentences.push(cur.trim());
  return sentences;
}

export const GRID = Object.freeze([
  // ── MACRO ──
  { cell: "macro.ethos",  editor: "Robert Caro",        appeal: APPEALS.ETHOS,  grain: GRAINS.MACRO, charge: "authority earned through exhaustive verification before a word is drafted — ethos as sensed labor", probe: caroUnverified },
  { cell: "macro.logos",  editor: "John McPhee",        appeal: APPEALS.LOGOS,  grain: GRAINS.MACRO, charge: "find the structure the material actually wants — what shape makes this argument inevitable", probe: mcpheeShape },
  { cell: "macro.pathos", editor: "Vivian Gornick",     appeal: APPEALS.PATHOS, grain: GRAINS.MACRO, charge: "what the piece is emotionally about underneath its ostensible subject", probe: null },
  // ── MESO ──
  { cell: "meso.ethos",   editor: "Tracy Kidder & Richard Todd", appeal: APPEALS.ETHOS, grain: GRAINS.MESO, charge: "fair representation of sources and complexity within a passage", probe: (text, ctx) => [...kidderToddOmissions(text, ctx), ...kidderToddRelations(text, ctx)] },
  { cell: "meso.logos",   editor: "Roy Peter Clark",    appeal: APPEALS.LOGOS,  grain: GRAINS.MESO, charge: "one job per paragraph, clean sequencing, transitions that earn their keep", probe: (text, ctx) => [...clarkJobsAndTransitions(text, ctx), ...clarkSplice(text, ctx)] },
  { cell: "meso.pathos",  editor: "Susan Orlean",       appeal: APPEALS.PATHOS, grain: GRAINS.MESO, charge: "sensory grounding and human stakes embedded inside reported material", probe: null },
  // ── MICRO ──
  { cell: "micro.ethos",  editor: "William Zinsser",    appeal: APPEALS.ETHOS,  grain: GRAINS.MICRO, charge: "strip the inflated diction that oversells", probe: (text, ctx) => {
    // His original list stays; what he was TAUGHT (2026-09-21) is the
    // measured tic, which catches this mouth's own habits in this piece.
    // Over a whole piece his list reports PER SENTENCE, so each hit licenses
    // the rewrite of the sentence it is in; over bare text it reports as before.
    const listed = ctx?.piece
      ? ctx.piece.flatMap((p) => (p.pieces ?? []).flatMap((pc) => {
          const hits = findWordHits(pc.text, INFLATION_WORDS).map((h) => h.word);
          return hits.length ? [{ kind: "inflation", cell: "micro.ethos", part: p.id, sentence: pc.text, words: [...new Set(hits)], detail: `"${[...new Set(hits)].join('", "')}" asserts importance instead of showing it`, licenses: "rewrite" }] : [];
        }))
      : findWordHits(text, INFLATION_WORDS).map((h) => ({ kind: "inflation", cell: "micro.ethos", detail: `"${h.word}" asserts importance instead of showing it`, span: h.index, word: h.word }));
    return [...listed, ...zinsserTics(text, ctx)];
  } },
  { cell: "micro.logos",  editor: "Joseph M. Williams", appeal: APPEALS.LOGOS,  grain: GRAINS.MICRO, charge: "sentence cohesion — diagnoses the false-tension 'Despite X, Y' move", probe: (text, ctx) => [...findFalseTensions(text), ...williamsCausalOrder(text, ctx)] },
  { cell: "micro.pathos", editor: "Lish / Klinkenborg", appeal: APPEALS.PATHOS, grain: GRAINS.MICRO, charge: "cut to charge (Lish); cadence, the sentence that knows what it's doing (Klinkenborg)", probe: klinkenborgCadence },
]);

export function cellOf(cell) { return GRID.find((c) => c.cell === cell) ?? null; }
export function cellsByGrain(grain) { return GRID.filter((c) => c.grain === grain); }
export function cellsByAppeal(appeal) { return GRID.filter((c) => c.appeal === appeal); }

// ── run one grain's three appeals over a text ──────────────────────────────
// Returns the mechanical findings each probe makes (cells with no probe name
// their charge and yield no findings — the machine does what it can, names
// what it cannot). Used by the spiral to know what a pass BROKE.
export function runGrain(text, grain) {
  const findings = [];
  for (const cell of cellsByGrain(grain)) {
    if (typeof cell.probe === "function") {
      const f = cell.probe(text) ?? [];
      for (const x of f) findings.push(x);
    }
  }
  return findings;
}

// ── the spiral ─────────────────────────────────────────────────────────────
// A pass is a cut. The spiral's law: after a cut, IMMEDIATELY re-read the text
// for what the cut broke in the OTHER two appeals, then cut again. The spiral
// descends macro → meso → micro, then re-ascends (a micro cut re-opens the
// macro question), recording every rotation in its append-only log.
export function createSpiral({ text = "", log = [] } = {}) {
  return { schema: REVISION_SPIRAL_SCHEMA, text: String(text ?? ""), log, rotations: 0 };
}

// One rotation: cut with the given cell, then re-read for what the cut broke
// in the other two appeals at the same grain. Returns the spiral with the cut
// and the re-read findings appended to its log (append-only, never an edit).
//
// HOLONIC ROTATION (2026-09-21, the design's F2/F3): a rotation operates at a
// LEVEL (whole/section/paragraph/sentence — the holon tree node), and after
// the cut it re-reads the PARENT (the ancestor whose strain the cut may have
// moved). Each entry records `level`, `gathered` (the new world the act added
// — a fact, a resolved strain, an absorbed source), and `parentReRead` (what
// the cut did to the parent). A rotation that gathers NO new world is refused
// (F3: the spiral is a spiral, not a loop — two adjacent no-gather rotations
// are impossible).
export function rotate(spiral, { cell, cut, basis = "", level = "whole", gathered = null, parent = null, parentSat = null } = {}) {
  const c = cellOf(cell);
  if (!c) return { ...spiral, refused: { type: "unknown_cell", cell } };
  if (gathered != null && Number(gathered) <= 0) {
    // F3 — a rotation that gathered nothing is a loop, refused.
    return { ...spiral, refused: { type: "no_gathered_world", cell, level, basis: String(basis ?? "") } };
  }
  const after = typeof cut === "function" ? cut(spiral.text) : (typeof cut === "string" ? cut : spiral.text);
  // THE SPIRAL LAW: re-read what the cut broke in the OTHER two appeals.
  const grain = c.grain;
  const others = cellsByGrain(grain).filter((o) => o.appeal !== c.appeal);
  const broke = [];
  for (const o of others) {
    if (typeof o.probe === "function") {
      const f = o.probe(after) ?? [];
      for (const x of f) broke.push({ ...x, brokenBy: c.cell, after: cell });
    }
  }
  // F2 — the PARENT RE-READ: a micro cut re-opens the macro question. When a
  // parent (or a parent-satisfaction function) is given, the rotation records
  // what the cut did to the ancestor — whether it broke the parent's shape.
  let parentReRead = null;
  if (parent != null && typeof parent === "string") {
    parentReRead = {
      before: String(parent ?? "").slice(0, 120),
      after: String(after ?? "").slice(0, 120),
      changed: String(after ?? "") !== String(parent ?? ""),
    };
  }
  if (parentSat && typeof parentSat === "function") {
    const beforeSat = parentSat(spiral.text);
    const afterSat = parentSat(after);
    parentReRead = {
      ...(parentReRead ?? {}),
      strainBefore: beforeSat?.strain ?? null,
      strainAfter: afterSat?.strain ?? null,
      brokeParent: (afterSat?.strain ?? 0) > (beforeSat?.strain ?? 0),
    };
  }
  const entry = {
    at: new Date().toISOString(), rotation: (spiral.rotations ?? 0) + 1,
    cell: c.cell, editor: c.editor, appeal: c.appeal, grain,
    level, gathered: gathered != null ? Number(gathered) : null,
    basis: String(basis ?? "").slice(0, 160),
    textAfter: String(after ?? "").slice(0, 240),
    broke, // what the cut broke in the other two appeals — the re-read
    parentReRead, // what the cut did to the parent — the holonic re-read (F2)
  };
  return { schema: REVISION_SPIRAL_SCHEMA, text: String(after ?? ""), log: [...(spiral.log ?? []), entry], rotations: (spiral.rotations ?? 0) + 1 };
}

// ── project the spiral's path ──────────────────────────────────────────────
export function spiralPath(spiral) {
  return (spiral.log ?? []).map((e) => `[${e.grain}.${e.appeal}@${e.level}] ${e.editor} — ${e.basis}${e.gathered != null ? `  ·  +${e.gathered} world` : ""}${e.broke.length ? `  ·  BROKE: ${e.broke.map((b) => b.kind).join(", ")}` : ""}${e.parentReRead?.brokeParent ? "  ·  BROKE PARENT" : ""}`);
}

// ── READ THE WHOLE PIECE BY EVERY ARCHON (2026-09-21) ──────────────────────
/**
 * readPiece({ piece, draft, ground, task }) → { findings, untaught }
 * Every cell's probe reads the piece; every finding carries its editor, its
 * appeal and grain, and the revision it licenses. Cells still without a probe
 * are returned by name, so the gap is on the record rather than silent.
 */
export function readPiece(ctx = {}) {
  const text = (ctx.piece ?? []).flatMap((p) => (p.pieces ?? []).map((pc) => pc.text)).join(" ");
  const findings = [];
  const untaught = [];
  for (const c of GRID) {
    if (typeof c.probe !== "function") { untaught.push({ cell: c.cell, editor: c.editor, charge: c.charge }); continue; }
    for (const f of c.probe(text, ctx) ?? []) findings.push({ ...f, cell: c.cell, editor: c.editor, appeal: c.appeal, grain: c.grain });
  }
  return { findings, untaught };
}
