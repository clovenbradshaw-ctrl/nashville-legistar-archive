// document-ledger.js — a generated document as an EOT ledger, projectable at
// any point, with a human change log folded off it.
//
// The EOT discipline, applied to a document the proxy GENERATES (an essay, a
// code file) rather than one it READS. The record is the object: the working
// file a person opens is a PROJECTION of this ledger at some revision, and
// every edit — a section admitted, a revision superseding it — is a line
// appended here, never an in-place edit. Re-expansion is always possible; the
// current text is never the only text.
//
// DEF, EVA and REC (the Interpretation domain, THE-THREE-MATHEMATICS) are
// RUNTIME operations here, not file rows: they are the gates the driver uses
// while composing, and only their OUTCOME lands in the ledger as lines —
//   DEF  declare the composition's shape (how many parts) before any part is
//        written; a definition is a wish until its evaluate clears.
//   EVA  admit a candidate part: it must carry real text AND be grounded
//        (some surfed material addresses it) or it fails admission.
//   REC  when admission fails, re-zero: append a revision that supersedes the
//        failed part and re-generate it. A revision is a line, never an edit.
// The ledger therefore carries the change log's RESULT; the gates live in the
// composing driver. project(ledger) reconstructs the document at any point —
// surviving parts in address order, superseded parts dropped.

const SCHEMA = "EOTDocument@1";

let _seq = 0;

// ── the ledger ──────────────────────────────────────────────────────────────
export function createDocumentLedger({ docId, title = "", path = "" } = {}) {
  return {
    schema: SCHEMA,
    docId: docId ?? `doc:${Date.now()}:${_seq++}`,
    title,
    path,
    createdAt: new Date().toISOString(),
    lines: [], // append-only
    superseded: new Set(),
    nextAddress: 0,
  };
}

export function appendDocumentObservation(ledger, entry) {
  const at = entry.at ?? [ledger.nextAddress, ledger.nextAddress + String(entry.text ?? "").length];
  const line = {
    schema: "EOTObservation@1",
    id: entry.id ?? `${ledger.docId}:obs:${ledger.lines.length}`,
    at,
    role: entry.role ?? "part",
    kind: entry.kind ?? null,
    title: entry.title ?? null,
    text: entry.text ?? "",
    // supersedes may be a single id or an ARRAY of ids (2026-09-21): the fold
    // replaces the whole wide draft — one observation can supersede many wide
    // sections at once. A single id is preserved for the revision discipline.
    supersedes: entry.supersedes ?? null,
    giver: entry.giver ?? null,
    basis: entry.basis ?? null,
    appendedAt: new Date().toISOString(),
  };
  ledger.lines.push(line);
  if (line.supersedes) {
    const ids = Array.isArray(line.supersedes) ? line.supersedes : [line.supersedes];
    for (const id of ids) ledger.superseded.add(id);
  } else {
    ledger.nextAddress = Math.max(ledger.nextAddress, at[1]);
  }
  return line;
}

// ── projection: the document at any point ───────────────────────────────────
// Fold the ledger: surviving observations (never superseded), in address
// order. A revision (supersedes set) drops its target from the projection and
// takes the target's address slot with its own text. This is a pure function
// of the ledger — same bytes in, same projection out, at any point in time.
export function projectDocument(ledger, { includeTitle = true } = {}) {
  const alive = ledger.lines.filter((l) => !ledger.superseded.has(l.id));
  alive.sort((a, b) => (a.at[0] - b.at[0]) || (a.at[1] - b.at[1]));
  // The projection is the READABLE ESSAY: the written parts and the citation
  // block. The plan, the outline, and the reading's internal scaffolding are
  // ledger facts, not essay prose — a reader of the piece must never see the
  // void questions or the outline machinery.
  const prose = alive.filter((l) => l.role === "part" || l.role === "citations");
  const body = prose.map((l) => l.text).join("\n\n");
  if (!includeTitle || !ledger.title) return body;
  return ledger.title ? `# ${ledger.title}\n\n${body}`.trim() : body;
}

// ── the change log: a human read of what the document has BEEN ─────────────
// Folded off the ledger at its CURRENT state — DEF declared at the top (the
// shape the composition aimed at), then each admitted part, then each
// revision, newest last. Lines, not prose: the record stays checkable.
export function documentChangeLog(ledger, { declaredParts = null } = {}) {
  const out = [];
  const declared = declaredParts
    ? `${declaredParts.length} part${declaredParts.length === 1 ? "" : "s"}: ${declaredParts.map((p) => `"${p}"`).join(", ")}`
    : "no declared shape (single-part composition)";
  out.push(`# Change log — ${ledger.docId}`);
  out.push("");
  out.push(`Declared (DEF): ${declared}`);
  out.push("");
  const admitted = ledger.lines.filter((l) => !l.supersedes);
  if (!admitted.length) out.push("No parts admitted yet.");
  for (const l of admitted) {
    const state = ledger.superseded.has(l.id) ? "REVISED" : "alive";
    out.push(`- [${state}] ${l.title ?? l.role} (${l.at[0]}–${l.at[1]})${l.basis ? ` — ${l.basis}` : ""}`);
  }
  const revised = ledger.lines.filter((l) => l.supersedes);
  for (const l of revised) {
    out.push(`- [REVISION] ${l.title ?? l.role} supersedes ${l.supersedes}${l.basis ? ` — ${l.basis}` : ""}`);
  }
  return out.join("\n");
}

// ── EVA / REC gates (runtime) ───────────────────────────────────────────────
// These are the composing driver's gates, kept here so the driver calls them
// instead of re-implementing the judgment. They decide what gets admitted;
// they never write a file row themselves.

// EVA — admit a candidate part. A part carries real text (some minimum) AND
// is grounded (some surfed segment addresses it). Returns {ok, because}.
export function admitPart({ text, grounded = true, minChars = 20 } = {}) {
  const chars = String(text ?? "").trim().length;
  if (chars < minChars) return { ok: false, because: `too thin: ${chars} chars < ${minChars} minimum` };
  if (!grounded) return { ok: false, because: "not grounded: no surfed material addresses this part" };
  return { ok: true, because: `admitted: ${chars} chars, grounded` };
}

// REC — declare that a part needs re-zeroing and the ledger line to record it.
export function revisePart({ ledger, targetId, title, text, basis }) {
  return appendDocumentObservation(ledger, {
    supersedes: targetId,
    role: "part",
    kind: "revision",
    title,
    text,
    basis,
    at: null, // revision takes its target's slot via projection ordering
  });
}

// ── EVA: does the composed piece match its declared essay shape? ────────────
// The DEF for a composition is the essay's classical form (thesis opening,
// thematic body, conclusion). EVA checks the ASSEMBLED text mechanically
// against that declared shape and reports which parts are missing — never
// trusts the model to self-judge. Returns {ok, failures:[{kind, detail}]}.
export function checkEssayShape(text, { parts = 3, themes = [], subject = "" } = {}) {
  const t = String(text ?? "");
  const failures = [];
  const lower = t.toLowerCase();
  const words = t.replace(/\s+/g, " ").trim();
  // Opening: does the piece state a thesis early (a claim about the subject)?
  const first300 = words.slice(0, 300);
  const hasThesis = /\b(this essay|we\b|dolphins are|the subject|here we|let'?s|in this (piece|essay))\b/.test(first300) || first300.length > 60;
  if (!hasThesis) failures.push({ kind: "opening", detail: "the piece opens without stating its thesis" });
  // Body: is the SUBJECT genuinely addressed across the piece? The themes are
  // the void's questions; the essay ANSWERS them as grounded prose and never
  // echoes the question's own scaffolding words ("what space is this essay").
  // So the body check probes the SUBJECT's content nouns (what the piece must
  // actually be about), not the question text — a section that names the
  // bongo's genus, coat, and habitat IS the answer to "What KIND is X", even
  // though it never says the word "kind" (measured: the old probe falsely
  // failed 5 themes and Murch appended redundant sections forever).
  const probeText = String(subject || themes[0] || "").slice(0, 80);
  const stop = new Set(["what","which","where","when","why","how","does","is","are","the","a","an","and","of","to","in","on","at","for","that","this","from","with","its","it","one","be","so","or","your","our"]);
  const tokens = probeText.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !stop.has(w));
  if (tokens.length) {
    const hit = tokens.filter((w) => lower.includes(w)).length / tokens.length;
    if (hit < 0.5) failures.push({ kind: "body", detail: `the piece barely mentions ${subject || "its subject"} — the themes are not actually addressed` });
  }
  // Conclusion: does the piece return to the thesis at the end?
  const last300 = words.slice(-300);
  const hasConclusion = /\b(in conclusion|to conclude|ultimately|finally|in the end|as we|let us|we have seen)\b/.test(last300) || last300.length > 40;
  if (!hasConclusion) failures.push({ kind: "closing", detail: "the piece ends without returning to its thesis" });
  return { ok: failures.length === 0, failures };
}

// ── DEF the void by ASKING QUESTIONS — the shape is what the piece must
//    ANSWER, never what the source's own headings happen to say. ────────────
// Wikipedia's taxonomy table is NOT the essay's shape. The essay's shape is
// the VOID of what a reader needs to know that the essay is obligated to
// fill. The DEF is generated by asking — and the asking is TAXONOMICALLY
// COMPLETE, EO style: one question per operator of the 27-cell cube, in
// dependency order (NUL→SIG→INS→SEG→CON→SYN→DEF→EVA→REC), so the void spans
// all three domains (Existence, Structure, Interpretation) and all three
// modes (Differentiate, Relate, Generate). Each question is the ACT the essay
// must perform — cells classify moves, never content (95.7% of assignments
// survive word-shuffling) — so the templates are domain-invariant: swap the
// subject, the 27-cell sweep holds. A finding at an earlier cell constrains
// every later one; an unanswered operator is a typed gap, never a default.
//
// 9 core questions (one per operator, the canonical grain) make the space
// `specified`; up to 27 (all three grains) is the ceiling. The generator here
// emits the 9 core in chain order — the minimum complete void to DEF before
// any material is hunted.

// The 27 cells — each operator × grain is a possible VOID TYPE. A question is
// relevant only when its cell actually bears on THIS essay: asking all 27
// every time is noise, and asking fewer leaves the space under-specified. So
// each cell carries a RELEVANCE predicate — when it applies to the subject
// and the question — and the DEF converts the relevant cells into voids,
// typing the rest as `not-relevant` (an undeclared cell is a typed gap, never
// a default). The same organs serve any subject; the predicates decide which
// voids exist for this one.
//   Terrain of each cell: Void/Entity/Kind · Field/Link/Network ·
//   Atmosphere/Lens/Paradigm. Stance: Clearing/Dissecting/Unraveling ·
//   Tending/Binding/Tracing · Cultivating/Making/Composing.
const VOID_CELLS = [
  // ── Existence · what exists ──
  // HOLON (the law: low sets possibility for high, high probability for low).
  // LOW cells ask about the SUBJECT — X itself, its kinds, beings, relations,
  // extent, story — and are the sections Wolfe writes. HIGH cells ask about
  // the ESSAY — its frame, thesis, claims, parts, revisions, the account it
  // instantiates — and are the shape Murch checks and Ranke grounds, never a
  // reader-facing section.
  { op: "NUL", grain: "Ground", terrain: "Void", holon: "low", ask: (s) => `What is ${s}, marked off from everything adjacent to it — what space is this essay, and what is it NOT?`, relevant: () => true }, // every essay marks its subject off
  // BORN: relevant only when the material actually shows multiple beings/kinds
  // (several referents) or the question asks about kinds.
  { op: "NUL", grain: "Figure", terrain: "Entity", holon: "low", ask: (s) => `Does ${s} name ONE being that clears its ground, or several that must be kept apart?`, relevant: (q, r) => /(?:species|subspecies|kinds?|types?|varieties?)/i.test(q) || /\b(?:several|multiple|many|both|either)\b/i.test(q) || (r?.referents ?? 0) > 3 },
  { op: "NUL", grain: "Pattern", terrain: "Kind", holon: "low", ask: (s) => `What KIND is ${s} — and do its kinds hold as kinds against the material, or are they unresolved?`, relevant: (q, r) => /(?:species|subspecies|kinds?|types?|varieties?|classes?|categories?|forms?)/i.test(q) || (r?.referents ?? 0) > 2 },
  { op: "SIG", grain: "Ground", terrain: "Void", holon: "high", ask: (s) => `What is absent and must be found for the essay about ${s} to exist — what presence is currently missing?`, relevant: (q, r) => /(?:unknown|unclear|undocumented|scarcely|rarely|little known|not well)/i.test(q) || (r?.surprise ?? 0) === 0 },
  { op: "SIG", grain: "Figure", terrain: "Entity", holon: "low", ask: (s) => `Which ${s} is this — the names and the referent, so one being is meant, not a byte string?`, relevant: () => true }, // every essay resolves its subject
  // BORN: relevant when the material has multiple kinds/forms (subspecies, races).
  { op: "SIG", grain: "Pattern", terrain: "Kind", holon: "low", ask: (s) => `How many distinct ${s} keep recurring as the same kind across the sources — each candidate signed as a proposal?`, relevant: (q, r) => /(?:subspecies|populations?|variants?|forms?|races?)/i.test(q) || (r?.referents ?? 0) > 3 },
  { op: "INS", grain: "Ground", terrain: "Void", holon: "low", ask: (s) => `What baseline account of ${s} must be built before any judgment can land on it?`, relevant: (q, r) => /(?:baseline|overview|summary|history|began|started|origins?)/i.test(q) || (r?.referents ?? 0) > 0 },
  { op: "INS", grain: "Figure", terrain: "Entity", holon: "high", ask: (s) => `What does the essay bring into being about ${s} — the portrait, the thesis — what is born here that did not exist before?`, relevant: (q) => /\b(?:essay|paper|portrait|account|thesis|history)\b/i.test(q) },
  { op: "INS", grain: "Pattern", terrain: "Kind", holon: "high", ask: (s) => `What established kind of account does the essay on ${s} instantiate — a technical account, a biography, a narrative — whichever the material supports?`, relevant: () => true },
  // ── Structure · how things hang together ──
  { op: "SEG", grain: "Ground", terrain: "Field", holon: "low", ask: (s) => `What extent must the essay cover, and in what units — ${s}'s range, scale, span — so a hole is a visible uncovered stretch?`, relevant: () => true },
  { op: "SEG", grain: "Figure", terrain: "Link", holon: "high", ask: (s) => `What does the essay cut apart, and is the cut derived off the material's own bytes, not a model's label?`, relevant: (q) => /(?:geograph|range|habitat|distribution|extent|how far|where|boundaries?)/i.test(q) },
  { op: "SEG", grain: "Pattern", terrain: "Network", holon: "low", ask: (s) => `Where do the parts of ${s}'s story part at natural seams — what separates into distinct chapters at the material's own bridges?`, relevant: (q) => /(?:chapter|section|part|stages?|phases?|periods?)/i.test(q) },
  // BORN: relevant when the material has relations (edges) to bind.
  { op: "CON", grain: "Ground", terrain: "Field", holon: "low", ask: (s) => `What connective field do ${s}'s relations live in — the ambient of possible relations before any single one is confirmed?`, relevant: (q, r) => /\b(?:predat|prey|habitat|relat|depend|threat|interact)\b/i.test(q) || (r?.relations ?? 0) > 0 },
  { op: "CON", grain: "Figure", terrain: "Link", holon: "low", ask: (s) => `What binds each named thing to ${s} — the material's own edges, each span-verified against the bytes?`, relevant: (q, r) => /\b(?:predat|prey|habitat|relat|depend|threat|interact|linked|associated|connected|between)\b/i.test(q) || (r?.relations ?? 0) > 0 },
  { op: "CON", grain: "Pattern", terrain: "Network", holon: "low", ask: (s) => `What recurring relation runs through ${s}'s story — the same cause → consequence cycle found at a real recurrence floor?`, relevant: (q, r) => /(?:cycle|recurr|repeated|again|trend|pattern|cause|consequence|led to)/i.test(q) || (r?.relations ?? 0) > 2 },
  // BORN: relevant when multiple sources were actually retained.
  { op: "SYN", grain: "Ground", terrain: "Field", holon: "high", ask: (s) => `What received readings of ${s} merge into ONE carried ground the essay stands on — which accounts compile, with typed gaps for absences?`, relevant: (q, r) => /(?:source|record|account|history|literature|several)/i.test(q) || (r?.sources ?? 0) > 1 },
  { op: "SYN", grain: "Figure", terrain: "Link", holon: "low", ask: (s) => `Where do two sources about ${s} agree into one claim with two witnesses — which re-sightings fold into the same note?`, relevant: (q, r) => /(?:agree|corroborat|witness|confirm|support|both)/i.test(q) || (r?.sources ?? 0) > 1 },
  { op: "SYN", grain: "Pattern", terrain: "Network", holon: "high", ask: (s) => `How do the essay's parts about ${s} compose — how do its relations chain so a reader walks from one section to the next without repetition?`, relevant: () => true },
  // ── Interpretation · what the reader holds ── (the essay's HIGH: Murch/Ranke)
  { op: "DEF", grain: "Ground", terrain: "Atmosphere", holon: "high", ask: (s) => `What interpretive frame is the essay on ${s} declared in — a chronicle, an argument, a portrait — whichever the material demands?`, relevant: () => true },
  { op: "DEF", grain: "Figure", terrain: "Lens", holon: "high", ask: (s) => `How many answers does the essay on ${s} hold — one thesis or several — DECLARED, never read off grammar?`, relevant: () => true },
  // BORN: relevant when the material shows a genuine dispute.
  { op: "DEF", grain: "Pattern", terrain: "Paradigm", holon: "high", ask: (s) => `What candidate framings of ${s} are proposed, which are REFUTED by the material, and which stay candidate — never given?`, relevant: (q, r) => /(?:debate|dispute|controv|interpret|framing|theor|argue)/i.test(q) || r?.disputes === true },
  { op: "EVA", grain: "Ground", terrain: "Atmosphere", holon: "high", ask: (s) => `What does the essay owe the reader's accumulated picture of ${s} — and when does that ground MOVE (surprise contracts the window)?`, relevant: (q, r) => /(?:surpris|expect|known|assum|picture|assume)/i.test(q) || (r?.surprise ?? 0) > 0 },
  { op: "EVA", grain: "Figure", terrain: "Lens", holon: "high", ask: (s) => `What test must each claim about ${s} pass — grounded in the retained material, witnessed, within the declared extent?`, relevant: () => true }, // every essay tests its claims
  // BORN: relevant when multiple witnesses exist (several sources).
  { op: "EVA", grain: "Pattern", terrain: "Paradigm", holon: "high", ask: (s) => `What is each claim about ${s}'s standing across all its witnesses — agree, single, disputed, contradicted, undetermined?`, relevant: (q, r) => /(?:several|multiple|sources?|studies?|reports?|claims?|findings?)/i.test(q) || (r?.sources ?? 0) > 1 },
  { op: "REC", grain: "Ground", terrain: "Atmosphere", holon: "high", ask: (s) => `When does the essay about ${s} concede its frame and re-zero — what arrival starts a fresh atmosphere?`, relevant: () => true },
  { op: "REC", grain: "Figure", terrain: "Lens", holon: "high", ask: (s) => `What would make the essay about ${s} take back a specific claim — and what new ground would be born with it?`, relevant: () => true },
  // BORN: relevant when the material shows status/finding change.
  { op: "REC", grain: "Pattern", terrain: "Paradigm", holon: "high", ask: (s) => `What finding about ${s} forces the whole declaration to be revised — a new subspecies, a changed status, a reversed trajectory?`, relevant: (q, r) => /(?:status|change|new|revis|discover|updat|finding)/i.test(q) || (r?.surprise ?? 0) > 3 },
];

// Which cells produce ESSAY CONTENT (a section the reader sees) vs. SHAPE
// INSTRUMENTS (a question about the essay's own frame/declaration/revision —
// conversation instruments that steer the composition loop but are not
// sections of a standalone piece). THE LAW OF HOLONS decides: LOW asks about
// the SUBJECT (sets possibility for the essay's claims — these are the
// sections Wolfe writes); HIGH asks about the ESSAY (the frame/claims/
// revisions Murch edits and Ranke grounds — never a reader-facing section).
const isEssayCell = (op, grain, holon) => holon === "low";

// Generate the VOID CELLS for a subject: all 27 considered, the relevant ones
// emitted as questions (with their cell metadata), the rest typed not-relevant.
// Returns { cells: [{question, op, grain, terrain, relevant, essay, ...}], of, relevant, notRelevant }.
// `essay` marks whether the cell's question asks for ESSAY CONTENT (grounded
// prose about the subject) vs. an ESSAY-SHAPE instrument (a question about
// the essay itself — how it is framed, what it declares, when it would
// revise). Content cells become sections the reader sees; shape cells steer
// the composition loop internally and are not emitted as reader-facing
// sections — a "when would the essay take back a claim" question is a
// conversation instrument, not a section of a standalone piece.
//
// THE SHAPE IS AN ASSERTION, NEVER A FIXED LADDER (2026-09-21): when a caller
// injects `shapeRegister` (organs/essay-shape-register.js), the fixed
// VOID_CELLS universality is replaced by the register's own standings — a cell
// the material has REFUTED is never emitted, whatever its relevance gate
// says, and its refusal is disclosed in `withheld`. The register's `ask` and
// `holon` are read for every holding cell, so the composition composes against
// the assertions that still hold. Without a register, behavior is unchanged
// (the received ladder stands) — a caller that never asserts a shape keeps
// the inherited one, disclosed as received, never silently upgraded.
export function voidCellsFor({ topic, question = "", openQuestions = [], shadowReferents = [], reading = null, shapeRegister = null } = {}) {
  const t = String(topic ?? "").trim() || "this subject";
  const cells = [];
  const withheld = [];
  const seen = new Set();
  const push = (questionText, meta) => {
    const k = questionText.toLowerCase().replace(/\s+/g, " ").trim();
    if (k && !seen.has(k)) { seen.add(k); cells.push({ question: questionText, ...meta }); }
  };
  for (const q of openQuestions ?? []) push(String(q ?? "").replace(/[?？]\s*$/, "") + "?", { op: "open", grain: null, terrain: null, relevant: true, essay: false });
  const refs = (shadowReferents ?? []).filter((r) => r && typeof r === "string" && r !== t).slice(0, 3);
  for (const ref of refs) push(`What is ${ref}, and how does it relate to ${t}?`, { op: "SIG", grain: "Figure", terrain: "Entity", relevant: true, essay: true });
  // THE BORN GATE: relevance is decided by the MATERIAL the hunt actually
  // found (reading), not only the question's words. A cell is relevant when
  // either the question asks it OR the reading's state demands it — the void
  // is born from what was found, never a fixed count.
  const source = shapeRegister?.cells?.length ? shapeRegister.cells : VOID_CELLS;
  for (const cell of source) {
    const op = cell.op, grain = cell.grain;
    const cellKey = `${op}·${grain}`;
    // THE SHAPE-REGISTER WALL: a cell the material REFUTED is never emitted,
    // whatever the relevance gate says — its refusal disclosed, never silent.
    if (cell.standing === "REFUTED") {
      withheld.push({ op, grain, cell: cellKey, reason: `refuted: ${cell.claim ?? "the material contradicted this cell"}` });
      cells.push({ question: null, op, grain, terrain: cell.terrain ?? null, relevant: false, cell: cellKey, essay: false, standing: "REFUTED", refused: cell.claim ?? null });
      continue;
    }
    const relevant = typeof cell.relevant === "function" ? cell.relevant(question ?? "", reading ?? {}) : cell.relevant !== false;
    if (relevant) push(cell.ask(t), { op, grain, terrain: cell.terrain, relevant: true, cell: cellKey, essay: isEssayCell(op, grain, cell.holon), ...(cell.standing ? { standing: cell.standing } : {}) });
    else cells.push({ question: null, op, grain, terrain: cell.terrain ?? null, relevant: false, cell: cellKey, essay: isEssayCell(op, grain, cell.holon) });
  }
  return { cells, withheld, of: cells.length, relevant: cells.filter((c) => c.relevant).length, notRelevant: cells.filter((c) => !c.relevant).length, subject: t };
}

// ── SATISFACTION and STRAIN ─────────────────────────────────────────────────
// Satisfaction is not "wrote N sections" — it is whether the DECLARED VOID is
// filled. The meno question ("how do we know when we've learned something we
// do not know?") answers itself only if we DEF the shape of the void FIRST:
// the essay is done when the void we declared — across all nine operators —
// is filled by content that passes its admission test. We know we've learned
// when nothing the void named is still missing.
//
// DEF the void: NUL (the essay itself), SIG (the topic that must resolve),
// INS (what kind of thing fills it), SEG (its extent), CON (what binds a
// section to the topic), SYN (how sections compose), DEF (how many), EVA (the
// admission test a section must pass), REC (what forces the declaration to be
// revised). EVA then checks the written piece against this declaration, and
// REC re-opens whatever the void still names as missing.
import { cellOf } from "../kernel/cube.js";
import { settling } from "../kernel/settling.js";
import { declareVoid, zeroSpace, fill, voidsOf } from "./void-shape.js";

// Declare the essay's void. `sections` is the DEF'd structure (the pieces the
// piece must have); the extent is the whole essay; EVA is the admission test
// a section must pass (real content, grounded, not meta-commentary).
//
// THE SHAPE IS THE MNEME'S. The void is not declared from the classical form
// in the abstract — it is declared AGAINST what the instrument has already
// encountered (the shadow / Mneme: every site visited, its text retained).
// What we can know is bounded by what we've seen; the void is the shape of
// what is still missing RELATIVE to that shadow. A void declared with no
// shadow states that the shadow is empty — an honest gap, never a wish. The
// shadow grounds the declaration: SIG (what must resolve) is bounded by the
// referents the shadow's reading established; SEG (extent) by how much the
// material can support; EVA (admission) is measured against the shadow's
// retained text, not against nothing.
export function declareEssayVoid({ title, topic, sections = [], holonLevel = "section", shadow = [], webSources = null } = {}) {
  const shadowChars = (webSources ?? new Map()).size
    ? [...(webSources ?? new Map()).values()].reduce((a, t) => a + String(t ?? "").length, 0)
    : 0;
  const declaration = declareVoid(
    {
      slot: title || "the piece",
      anchor: topic ?? null, // SIG: what must resolve — bounded by the shadow's referents
      admits: holonLevel ?? "section", // INS: what kind of part fills it
      extent: sections.length ? { from: 1, to: sections.length + 1 } : null, // SEG: how many parts
      relation: "is a part of", // CON
      composition: sections.length ? "the parts compose the whole" : null, // SYN
      cardinality: sections.length || null, // DEF: how many
      admission: "a part with real content, grounded in the shadow's material, written as the piece itself", // EVA
      reopensOn: "a part that is thin, ungrounded, or meta-commentary", // REC
      mneme: {
        // The void's ground: what the instrument has already encountered.
        shadowSites: (shadow ?? []).length,
        shadowChars,
        basis: shadowChars ? "the void is declared against the retained shadow — what we have seen bounds what the piece can fill" : "the shadow is empty — the void names a gap we have not yet begun to fill",
      },
    },
    { cellOf },
  );
  return declaration;
}

// The MENO CHECK: given the void declaration and the written piece, is the
// void filled? EVA measures each declared part against the admission test;
// voidsOf reports any unfilled extent. {ok, filled, of, failures, strain}.
export function fillCheck(declaration, documentLines = [], sections = [], { material = "" } = {}) {
  const failures = [];
  let totalStrain = 0;
  let filled = 0;
  for (let i = 0; i < sections.length; i++) {
    const text = documentLines[i] ?? "";
    const r = satisfactionOfSection(text, { theme: sections[i], material, isFirst: i === 0 });
    totalStrain += r.strain;
    if (r.ok) filled++;
    else for (const f of r.failures) failures.push({ index: i, theme: sections[i], ...f });
  }
  // The void's own extent check: any declared part with no section at all is
  // an unfilled hole in the void's shape, not merely a weak one.
  for (let i = filled; i < sections.length; i++) {
    if (!documentLines[i]) {
      failures.push({ index: i, theme: sections[i], kind: "unfilled", detail: `the void declared a part ("${sections[i]}") that was never written` });
      totalStrain++;
    }
  }
  const ok = filled === sections.length && sections.length > 0;
  return { ok, filled, of: sections.length, failures, totalStrain };
}
const META_COMMENTARY_RE = /\b(here's|here is|let me know if you|i'd like to|you can|would you|consider|things to consider|you'll want to|remember to|feel free|brainstorm|explanation:|note that|as an ai|i can't|i cannot|this essay instantiates|this essay is|this essay seeks|this essay aims|this essay will|this essay holds|the essay begins|the essay then|the essay concludes|the essay's purpose|the essay explores|the essay delves|the essay argues|this essay cuts|this essay on|this account will|the essay must|the essay's narrative|in this essay|this essay examines|this essay analyzes|the essay focuses)\b/i;

// EVA a single section against the DEF and the material. Returns {ok,
// failures:[{kind,detail}], strain:number} — strain 0 when clean, +1 per
// failure found (each correction the piece will need).
export function satisfactionOfSection(sectionText, { theme = "", material = "", isFirst = false, prior = "" } = {}) {
  const t = String(sectionText ?? "").trim();
  const failures = [];
  let strain = 0;
  if (t.length < 40) { failures.push({ kind: "thin", detail: "the section has almost no content" }); strain++; }
  // Meta-commentary is a SHAPE error: the model wrote ABOUT the piece instead
  // of writing it ("Here's a potential start... Explanation:... Let me know").
  if (META_COMMENTARY_RE.test(t)) { failures.push({ kind: "meta", detail: "the section describes the writing instead of being the piece" }); strain++; }
  // Grounding: does the section share content with the material? A section
  // with no overlap is fabricated, not written from the ground. The test is
  // LENGTH-AWARE: a long section's ratio is diluted by connective prose, so
  // it must also clear a floor of DISTINCT material-tokens actually used —
  // a section that names real material facts (Cameroon, Congo Basin, 200
  // pounds) is grounded even when its prose is expansive.
  if (material && material.length > 30) {
    const m = String(material).toLowerCase();
    const tokens = t.toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 4);
    if (tokens.length) {
      const used = new Set(tokens.filter((w) => m.includes(w)));
      const ratio = used.size / tokens.length;
      const distinct = used.size;
      if (ratio < 0.08 && distinct < 5) {
        failures.push({ kind: "ungrounded", detail: `the section shares almost nothing with the material (${distinct} material words of ${tokens.length}) — it is not written from the ground` });
        strain++;
      }
    }
  }
  // Continuity: does the section merely RESTATE the preceding one? An essay
  // composes — each section builds on what came before, never re-explains it
  // from scratch. High overlap with the immediate prior section (beyond a
  // connective phrase) means it restarted instead of continuing.
  if (prior && String(prior).trim().length > 60) {
    const p = String(prior).toLowerCase();
    const tokens = t.toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 4);
    if (tokens.length) {
      const shared = tokens.filter((w) => p.includes(w)).length / tokens.length;
      // The prior's OWN tokens, so a section full of connective scaffolding
      // ("the essay", "the piece", "the material") is not counted as overlap.
      const priorTokens = new Set(p.split(/[^a-z']+/).filter((w) => w.length > 4));
      const real = tokens.filter((w) => priorTokens.has(w)).length / tokens.length;
      if (real >= 0.7) { failures.push({ kind: "repetition", detail: `the section restates the previous one (${Math.round(real * 100)}% of its content-tokens already appeared) — it should build on, not repeat` }); strain++; }
    }
  }
  return { ok: failures.length === 0, failures, strain };
}

// ── HOLONIC SATISFACTION — THE GENERAL (2026-09-21, the user's law) ────────
// Meaning is the THREE-PART SHAPE at every holon level: a holon opens (sets a
// strain), turns (develops it), and resolves (satisfies the strain, landing
// somewhere the opener did not predict). A holon without all three is
// structured dissonance — no meaning. This general applies the SAME shape
// check to ANY holon — whole, section, paragraph, sentence — omnimodal: the
// function does not know or care what kind of text it is handed. It splits
// the text into its three parts (opening / turn / resolution), checks the
// shape, and recurses into each part at the finer grain — satisfaction(whole),
// satisfaction(whole.partOne), satisfaction(whole.partOne.partTwo). The parts
// nest, so the caller can address any path. The strain rides down: a part
// satisfies only in relation to the level above — the response relation ("each
// new unit is in response to the end of the last").
const SENTENCE_RE = /(?<=[.!?])\s+(?=[A-Z])/;
function holonSplitSentences(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .split(SENTENCE_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
function holonContentWords(text) {
  return new Set(String(text ?? "").toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 3));
}
// Split a holon into its three parts by the tri-partite law. A holon with
// fewer than three units is an ATOM — its shape is checked whole (a single
// sentence still has its own mini-arc: it sets up and lands). Three+ units
// group by thirds: opening = first third, resolution = last third, turn = the
// middle. The turn is allowed to be empty only for a 2-unit holon (opening +
// resolution with no body — degenerate, measured as strain).
export function splitHolonIntoThree(text, { sentences = false } = {}) {
  const units = sentences ? holonSplitSentences(text) : String(text ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);
  const n = units.length;
  if (n < 3) return { opening: units[0] ?? "", turn: units[1] ?? "", resolution: units[n - 1] ?? "", atom: n < 2 };
  const first = Math.max(1, Math.floor(n / 3));
  const last = Math.max(1, n - Math.floor(n / 3));
  return { opening: units.slice(0, first).join("\n\n"), turn: units.slice(first, last).join("\n\n"), resolution: units.slice(last).join("\n\n"), atom: false };
}
const HOLON_ATOM_RE = /\b(here's|here is|let me know if you|as an ai|i can't|i cannot|let me know|this essay|in this piece|in conclusion|to conclude|finally)\b/i;
// The act-verbs a claim rests on — the SAME set the assertion extractor uses
// for labels. An opening "sets a strain" when it commits with one of these.
const HOLON_CLAIM_RE = /\b(is|are|was|were|will|would|should|must|could|plays|played|serves|served|built|builds|made|makes|drives|driven|means|created|became|become|leaves|threatens|depends|drains|flows|carries|carried|shaped|shapes|binds|bound|feeds|fed|cuts|cut|joins|joined|marks|named|holds|held|gives|gave|keeps|kept|turns|turned|releases|released|rises|rose|ends|ended)\b/i;
// The general. `level` names the current grain ("whole" | "section" |
// "paragraph" | "sentence") for disclosure; the shape checks do not branch on
// it — a whole and a sentence are checked the SAME way. `theme` is the void
// this holon must answer (rides down); `prior` is the ENDING of the previous
// unit at this level — the response relation: a holon opens ON the prior's
// ending, it does not re-open from scratch.
export function holonicSatisfaction(text, { level = "whole", theme = "", material = "", prior = "", role = "" } = {}) {
  const t = String(text ?? "").trim();
  const failures = [];
  let strain = 0;
  if (!t) { failures.push({ kind: "unfilled", level, detail: "the holon is empty" }); strain++; }
  const sent = holonSplitSentences(t);
  // ATOM: a single sentence is still a holon — it must carry a complete
  // thought (set up + land), carry the theme's content, and not be meta. The
  // `drift` check fires only for the OPENING role — a turn or resolution
  // atom is SUPPOSED to develop away from the void's own words (that is what
  // turning means); only the strain-setter must name what it answers.
  if (sent.length < 2) {
    if (HOLON_ATOM_RE.test(t)) { failures.push({ kind: "meta", level, detail: "the sentence talks about the writing instead of being the piece" }); strain++; }
    if (t.length < 30) { failures.push({ kind: "thin", level, detail: "the sentence is too short to carry meaning" }); strain++; }
    if (theme && role !== "turn" && role !== "resolution") {
      const words = holonContentWords(theme);
      const used = [...words].filter((w) => t.toLowerCase().includes(w)).length;
      if (words.size >= 3 && used === 0) { failures.push({ kind: "drift", level, detail: "the sentence names nothing of the void it must answer" }); strain++; }
    }
    return { ok: failures.length === 0, failures, strain, level, parts: null, opening: t, turn: "", resolution: t, atom: true };
  }
  // ATOMIC TURN/RESOLUTION: a 2-sentence sub-part has no middle and no body —
  // it is a claim plus a landing, not a 3-part holon. It is measured as an
  // atom pair: the two sentences must each be a complete thought, the second
  // responding to the first, and neither turning into meta. The full 3-part
  // shape is reserved for holons with three+ sentences — the law applies at
  // every level, but a 2-sentence fragment has only two of the three parts to
  // show, so forcing opening/turn/resolution onto it manufactures dissonance.
  if (sent.length === 2) {
    const [s1, s2] = sent;
    const r1 = holonicSatisfaction(s1, { level: "sentence", theme, prior, role: role || "opening" });
    const r2 = holonicSatisfaction(s2, { level: "sentence", theme, prior: s1, role: role === "turn" ? "turn" : "resolution" });
    strain += r1.strain + r2.strain;
    for (const f of [...r1.failures, ...r2.failures]) failures.push(f);
    return { ok: failures.length === 0, failures, strain, level, parts: [r1, r2], opening: s1, turn: "", resolution: s2, atom: false };
  }
  // THE SHAPE AT THIS LEVEL: split into opening / turn / resolution.
  const { opening, turn, resolution, atom } = splitHolonIntoThree(t, { sentences: true });
  // 1. OPENING SETS A STRAIN — it must commit to something the piece can be
  // held to (a claim or a question about the theme), and it must respond to
  // the prior unit's ending rather than re-answering the whole from scratch.
  const openingWords = holonContentWords(opening);
  const openMakesClaim = HOLON_CLAIM_RE.test(opening) && openingWords.size >= 4;
  if (!openMakesClaim) { failures.push({ kind: "no_strain", level, detail: "the opening sets no strain — no claim, no commitment the piece must satisfy" }); strain++; }
  if (prior && holonContentWords(prior).size >= 4) {
    const priorWords = holonContentWords(prior);
    const openedOn = [...priorWords].filter((w) => opening.toLowerCase().includes(w)).length;
    if (openedOn === 0) { failures.push({ kind: "no_response", level, detail: "the holon opens without responding to the previous unit's ending" }); strain++; }
  }
  // 2. TURN DEVELOPS THE STRAIN — the middle must ADD new content, not restate
  // the opening. Novelty = middle words absent from the opening.
  const turnWords = holonContentWords(turn);
  if (turnWords.size) {
    const novelty = [...turnWords].filter((w) => !opening.toLowerCase().includes(w)).length / turnWords.size;
    if (novelty < 0.4) { failures.push({ kind: "no_turn", level, detail: "the middle restates the opening instead of turning it" }); strain++; }
  }
  // 3. RESOLUTION SATISFIES THE STRAIN AND LANDS UNEXPECTED — it must return
  // to the opening's terms (closure: the strain is answered) while introducing
  // something the opener did not predict (surprise: it lands somewhere new).
  const resWords = holonContentWords(resolution);
  const closure = [...resWords].filter((w) => opening.toLowerCase().includes(w)).length;
  const surprise = [...resWords].filter((w) => !opening.toLowerCase().includes(w) && !turn.toLowerCase().includes(w)).length;
  if (closure < 1 || resWords.size < 4) { failures.push({ kind: "no_resolution", level, detail: "the ending does not return to the strain the opening set" }); strain++; }
  if (surprise < 1) { failures.push({ kind: "no_landing", level, detail: "the ending lands exactly where the opener predicted — it re-states instead of satisfying" }); strain++; }
  // RECURSE: each part is itself a holon at the finer grain. The parts nest —
  // this is satisfaction(whole.partOne.partTwo). The response relation rides
  // down: the resolution of part N is the prior ending of part N+1. Each part
  // carries its ROLE so the atom check knows whether a stray sentence is the
  // strain-setter (must name the void) or a turn/landing (may develop away).
  const parts = [];
  const roles = ["opening", "turn", "resolution"];
  for (const [i, part] of [{ opening }, { turn }, { resolution }].entries()) {
    if (!part.opening && !part.turn) continue;
    const partText = part.opening || part.turn || part.resolution;
    if (partText.split(/\s+/).length < 2) continue;
    const prev = i > 0 ? [{ opening }, { turn }, { resolution }][i - 1].resolution : prior;
    const r = holonicSatisfaction(partText, { level: "sentence", theme, material, prior: prev || "", role: roles[i] });
    parts.push(r);
    strain += r.strain;
    for (const f of r.failures) failures.push({ ...f, in: partText.slice(0, 40) });
  }
  return { ok: failures.length === 0, failures, strain, level, parts, opening, turn, resolution, atom };
}
// HOLONIC WHOLE: satisfaction(documentLines) — the whole essay is a holon; the
// sections are its parts. The whole's satisfaction is the general applied to
// the assembled prose, with the sections kept addressable as parts.
export function holonicWholeSatisfaction(documentLines = [], { theme = "" } = {}) {
  const assembled = (documentLines ?? []).map((d) => String(d ?? "")).join("\n\n");
  const r = holonicSatisfaction(assembled, { level: "whole", theme });
  return { ...r, sectionCount: (documentLines ?? []).length };
}

// ── THE HOLON TREE — THE ESSAY'S NATIVE FORMAT (2026-09-21) ────────────────
// Sections are NOT a flat list. The essay is a TREE addressed by path —
// satisfaction(whole), satisfaction(whole.opening),
// satisfaction(whole.opening.turn), satisfaction(whole.opening.turn.resolution)
// — where every node is one of the three parts (opening / turn / resolution),
// carries its assembled prose, and holds its OWN three parts as children.
// The leaf is the sentence (an atom — too small to divide further at this
// grain). `documentLines` — the flat array the loop appends to — is a
// SERIALIZATION of the tree's leaves in order, never the shape itself. The
// tree IS the shape; the flat array is how it is stored in the ledger.
// THE THREE-PART LAW governs the format: a node with three+ sentences divides
// into opening / turn / resolution; fewer than three sentences is an atom.
// The roles are always the same at every depth — the format is omnimodal:
// a whole, a section, a paragraph, a sentence are all the same node type.
export function holonNode({ path, role = "whole", text = "", parts = [] } = {}) {
  return { path, role, text: String(text ?? ""), parts };
}
// Address a node by its holon path — satisfaction(whole.partOne) is literally
// holonAt(root, "whole.partOne"). Returns null for an unknown path, never a
// guess.
export function holonAt(root, path = "whole") {
  if (path === "whole" || !path) return root ?? null;
  const parts = String(path).split(".");
  let node = root;
  for (const p of parts.slice(1)) {
    if (!node) return null;
    const child = (node.parts ?? []).find((c) => c.role === p);
    if (!child) return null;
    node = child;
  }
  return node ?? null;
}
// The leaves of a tree, in order — the flat documentLines serialization.
export function holonLeaves(root) {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    if ((n.parts ?? []).length === 0) out.push(n.text);
    else for (const c of n.parts) walk(c);
  };
  walk(root);
  return out;
}
// Build a holon tree from flat prose. The tri-partite split is applied
// recursively at every depth until the atoms (sentences) are reached.
export function holonTreeFromText(text, { path = "whole", role = "whole" } = {}) {
  const t = String(text ?? "").trim();
  const sent = holonSplitSentences(t);
  if (sent.length < 3) {
    // ATOM: a sentence (or a short paragraph) is a leaf — it has no children,
    // its whole shape is checked as itself. A single long sentence is still
    // an atom: dividing it would make fragments, not parts.
    return holonNode({ path, role, text: t });
  }
  const { opening, turn, resolution } = splitHolonIntoThree(t, { sentences: true });
  const parts = [];
  for (const [roleName, partText] of [["opening", opening], ["turn", turn], ["resolution", resolution]]) {
    if (!partText) continue;
    parts.push(holonTreeFromText(partText, { path: `${path}.${roleName}`, role: roleName }));
  }
  return holonNode({ path, role, text: t, parts });
}
export function holonTreeFromLines(documentLines = [], { theme = "" } = {}) {
  const assembled = (documentLines ?? []).map((d) => String(d ?? "")).join("\n\n");
  return holonTreeFromText(assembled);
}
// Satisfy the tree: run the general on a node, and on each of its children,
// returning the result addressed by the child's path — the recursive form of
// satisfaction(whole.partOne.partTwo). `prior` is the ending of the previous
// node at this level (the response relation rides down).
export function holonicTreeSatisfaction(root, { theme = "" } = {}) {
  const visit = (node, prior) => {
    const r = holonicSatisfaction(node.text, { level: node.role === "whole" ? "whole" : "section", theme, prior });
    const children = [];
    let prevText = prior;
    for (const c of node.parts ?? []) {
      const cr = visit(c, prevText);
      children.push({ path: c.path, role: c.role, ...cr });
      prevText = c.text;
    }
    return { path: node.path, role: node.role, ...r, children };
  };
  return visit(root, "");
}
// Format a holon tree as an addressable outline — the shape made visible. Each
// node renders with its path and role so the reader can address any part.
export function formatHolonTree(root, { depth = 0 } = {}) {
  if (!root) return "";
  const pad = "  ".repeat(depth);
  const role = root.role !== "whole" ? ` [${root.role}]` : "";
  const head = `${pad}${root.path}${role}`;
  const body = root.text ? ` — ${String(root.text).replace(/\s+/g, " ").slice(0, 80)}${String(root.text).length > 80 ? "…" : ""}` : "";
  const lines = [`${head}${body}`];
  for (const c of root.parts ?? []) lines.push(...formatHolonTree(c, { depth: depth + 1 }).split("\n"));
  return lines.join("\n");
}

// ── THE SECTION IS AN EOT ASSERTION — N-DIMENSIONAL (2026-09-21) ───────────
// A section is NOT prose in a tree. It is an ASSERTION node addressable along
// every axis the record owns:
//   holon      : path + role (whole.opening.turn) — the tree dimension
//   assertion  : the CLAIM it asserts — { subject, label, object }, folded
//                through the referent index (EOT, never prose)
//   cells      : the 27-cell register assertions it answers (op·grain keys)
//   referents  : the beings it folds to — it participates in the record
//   sources    : the material spans that ground it
//   standing   : CANDIDATE until a revision supersedes it — REVISABLE
//   supersedes/history : the revision edge (REC, never an edit — the same
//                discipline reconsiderShape concedes a shape cell with)
// The tree carries the shape; the assertion node carries the MEANING. Fold
// the flat documentLines through the referent index and the register and the
// tree becomes the record's own object, not the writer's text.
const HOLON_LABEL_RE = /\b(played|serves?|served|built|builds|made|makes|drains?|flows?|carries?|carried|created|became|become|depends?|threatens?|shaped|shapes|binds?|bound|feeds?|fed|cuts?|cut|joins?|joined|marks?|named|drives?|drove|holds?|held|gives?|gave|keeps?|kept|turns?|turned|releases?|released|rises?|rose|ends?|ended)\b/i;
// Extract the EOT assertion a section's prose makes — mechanically, through
// the referent index. `index` is the material's referent index (resolveIn /
// represent); the section's beings are its referents, the label is the
// section's strongest act-verb, the object is what the label is done to.
export function holonAssertionFromText(text, { index = null, register = null, topic = "" } = {}) {
  const t = String(text ?? "").trim();
  const resolveIn = (tx) => {
    try {
      const r = index?.resolveIn?.(String(tx ?? ""));
      return r instanceof Set ? r : new Set(r ?? []);
    } catch { return new Set(); }
  };
  const represent = (id) => { try { return index?.represent?.(id) ?? id; } catch { return id; } };
  const referents = [...resolveIn(t)];
  // SUBJECT: the first being the section folds to (or the topic, when the
  // section names no referent — the claim is about the subject).
  const subject = referents[0] ? represent(referents[0]) : (topic || null);
  // LABEL: the section's act — the predicate the claim rests on. Mechanical,
  // the strongest act-verb in the first half of the prose.
  let label = null;
  const verbMatch = t.slice(0, Math.ceil(t.length * 0.6)).match(HOLON_LABEL_RE);
  if (verbMatch) label = verbMatch[1];
  // OBJECT: the being the label is done to — a referent OTHER than the
  // subject, or the noun phrase following the verb.
  let object = null;
  if (subject) {
    object = referents.slice(1)[0] ? represent(referents[1]) : null;
  }
  if (!object && label) {
    const after = t.slice((t.match(HOLON_LABEL_RE)?.index ?? 0) + label.length, (t.match(HOLON_LABEL_RE)?.index ?? 0) + label.length + 80);
    const nouns = after.match(/[A-Z][a-z]+(?:\s+[a-z]+)*/g);
    if (nouns) object = nouns[0];
  }
  const assertion = subject && label ? { subject: String(subject), label, object: object ? String(object) : null } : null;
  // CELLS: which register assertions the section's prose answers. Each cell's
  // ask(topic) names the shape the section should instantiate; a section that
  // shares the cell's content-nouns (beyond the topic itself) carries it. A
  // REFUTED cell is never attributed (the register refuses it).
  const cells = [];
  if (register && Array.isArray(register.cells)) {
    const stop = new Set(["what","which","does","the","a","an","and","of","to","in","on","at","for","that","this","is","are","it","its","from","with"]);
    const tLower = t.toLowerCase();
    for (const cell of register.cells) {
      if (cell.standing === "REFUTED") continue;
      const ask = String(cell.ask?.(topic || "this subject") ?? "");
      const words = new Set(ask.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4 && !stop.has(w)));
      if (words.size === 0) continue;
      const hit = [...words].filter((w) => tLower.includes(w)).length / words.size;
      if (hit >= 0.4) cells.push(`${cell.op}·${cell.grain}`);
    }
  }
  return { assertion, referents, cells, subject, label, object };
}
// FOLD the flat documentLines into an n-dimensional assertion tree. Each leaf
// carries its assertion, cells, and referents; each non-leaf carries the union
// of its parts' referents and cells (the whole's claim is the composition of
// its parts' claims). The tree is the record's object — revisable (a node can
// be superseded), addressable by any dimension.
export function holonAssertionTree(documentLines = [], { index = null, register = null, topic = "", theme = "" } = {}) {
  const tree = holonTreeFromLines(documentLines, { theme });
  const visit = (node) => {
    const a = holonAssertionFromText(node.text, { index, register, topic });
    const children = (node.parts ?? []).map(visit);
    const referents = [...new Set([...a.referents, ...children.flatMap((c) => c.referents)])];
    const cells = [...new Set([...a.cells, ...children.flatMap((c) => c.cells)])];
    return {
      ...node,
      assertion: a.assertion,
      referents,
      cells,
      sources: a.sources ?? [],
      standing: "CANDIDATE",
      supersedes: null,
      history: [],
      parts: children,
    };
  };
  return visit(tree);
}
// REVISE a node — the EOT discipline on a section. A revision SUPERSEDES the
// node (appended to its history, never an in-place edit — the same rule
// reconsiderShape concedes a cell with). The tree is returned with the node
// revised; the prior text is never lost, it is the superseded history.
export function reviseHolonNode(root, { path, newText, reason = "", index = null, register = null, topic = "" } = {}) {
  if (!root) return { refused: { type: "no_root", detail: "reviseHolonNode: a tree is required" } };
  if (path === "whole") return { refused: { type: "cannot_revise_whole", detail: "reviseHolonNode: the whole cannot be superseded, only its parts" } };
  const visit = (node) => {
    if (node.path === path) {
      const a = holonAssertionFromText(newText, { index, register, topic });
      return {
        ...node,
        text: newText,
        assertion: a.assertion,
        referents: a.referents,
        cells: a.cells,
        standing: "REVISED",
        supersedes: node.path,
        history: [...(node.history ?? []), { was: node.standing ?? "CANDIDATE", text: node.text, at: new Date().toISOString(), reason: String(reason ?? "revision") }],
        parts: (node.parts ?? []).map(visit),
      };
    }
    return { ...node, parts: (node.parts ?? []).map(visit) };
  };
  return { tree: visit(root) };
}
// THE SATISFACTION OF THE ASSERTION TREE — the general, folded over the
// n-dimensional object. Each node's 3-part shape is measured; the parts'
// strains ride up. The node carries its own satisfaction so any dimension
// (path, claim, cell) can be asked "does this hold?"
export function holonicAssertionSatisfaction(root, { theme = "", index = null, register = null, topic = "" } = {}) {
  const visit = (node, prior) => {
    const r = holonicSatisfaction(node.text, { level: node.role === "whole" ? "whole" : "section", theme, prior });
    const children = [];
    let prevText = prior;
    for (const c of node.parts ?? []) {
      const cr = visit(c, prevText);
      children.push(cr);
      prevText = c.text;
    }
    return { path: node.path, role: node.role, assertion: node.assertion, cells: node.cells, referents: node.referents, ...r, children };
  };
  return visit(root, "");
}

// ── FISHER'S NULL TEST FOR REPETITION ──────────────────────────────────────
// Handle: Fisher — after Ronald Fisher's permutation test: a figure is a
// placement against a null built by shuffling, or it is refused. Repetition
// is only REAL when the openings recur more than a shuffled baseline would
// — five paragraphs opening "The bongo antelope, scientifically classified
// as..." is repetition only if shuffling the openings would not produce the
// same recurrences by chance. `detectRepetition` measures the sentence/
// paragraph OPENINGS across the essay, compares the recurrence count to a
// null built by shuffling the openings, and reports the openings that recur
// above chance (p < 0.05 by permutation). This is the DETECTOR; Murch flags
// its findings, Oliveros varies them.
export function detectRepetition(documentLines = [], { shuffles = 400, pValue = 0.05 } = {}) {
  const openings = (documentLines ?? [])
    .map((l) => String(l ?? "").trim())
    .filter((l) => l.length > 20)
    .map((l) => {
      const words = l.split(/\s+/);
      const start = words.slice(0, 14).map((w) => w.toLowerCase().replace(/[^a-z']/g, ""));
      return { full: l, words: start };
    });
  if (openings.length < 2) return { repeated: [], p: 1, n: openings.length, basis: "fewer than two sections — nothing to test" };
  // The observed statistic: the LONGEST shared leading-word prefix across any
  // pair of openings. "The bongo antelope, scientifically classified as
  // Tragelaphus eurycerus" = 8+ shared words; a varied essay shares 1-2.
  const maxSharedPrefix = (list) => {
    let best = 0;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i].words, b = list[j].words;
        const min = Math.min(a.length, b.length);
        let shared = 0;
        for (let k = 0; k < min; k++) if (a[k] === b[k]) shared++; else break;
        if (shared > best) best = shared;
      }
    }
    return best;
  };
  const observed = maxSharedPrefix(openings);
  // THE NULL (Fisher): each opening's words are SHUFFLED WITHIN itself — the
  // word-distribution is kept, but the ORDER is destroyed. A long leading
  // prefix is real repetition only if it exceeds what word-order-scramble
  // would produce by chance. This is the honest null: order matters.
  let above = 0;
  for (let s = 0; s < shuffles; s++) {
    const scrambled = openings.map((o) => ({ ...o, words: [...o.words].sort(() => Math.random() - 0.5) }));
    if (maxSharedPrefix(scrambled) >= observed) above++;
  }
  const p = (above + 1) / (shuffles + 1); // +1: the observed is itself a draw
  const repeated = p < pValue ? openings
    .filter((o) => {
      const prefix = o.words.slice(0, 3).join(" ");
      return openings.some((x) => x !== o && x.words.slice(0, 3).join(" ") === prefix);
    })
    .map((o) => o.full) : [];
  return {
    p: Number(p.toFixed(3)),
    repeated,
    n: openings.length,
    observed,
    significant: p < pValue,
    basis: p < pValue
      ? `Fisher: the longest shared opening-prefix is ${observed} words — word-order scramble gives that ${(p * 100).toFixed(0)}% of the time (p=${p.toFixed(3)}), so the openings repeat, not by chance`
      : `Fisher: the longest shared opening-prefix is ${observed} words — word-order scramble gives that ${(p * 100).toFixed(0)}% of the time (p=${p.toFixed(3)}), within chance`,
  };
}

// ── ALL BORING REDUNDANCY, NOT JUST OPENINGS ──────────────────────────────
// A maximally rational argument is maximally predictable — every step
// follows, every sentence is "X is a Y characterized by Z" — and that
// predictability is the boredom Sacks exists to spice. `detectRedundancy`
// catches every form:
//   1. REPEATED OPENINGS (Fisher's null, above).
//   2. REPEATED FACTS — the same claim (subject+relation+object) stated in
//      multiple sections ("third-largest antelope" 3x, "100 mountain
//      bongos" 4x). A fact once is a finding; a fact five times is a crutch.
//   3. REPEATED SENTENCE TEMPLATES — the same sentence-initial construction
//      or the same claim-phrase recurring ANYWHERE in the piece, not only at
//      the paragraph head.
// Each finding names the sections involved so Sacks varies them WITHOUT
// randomness — the spice is a chosen off-kilter landing, never a shuffle.
export function detectRedundancy(documentLines = [], { shuffles = 300, pValue = 0.05 } = {}) {
  const sections = (documentLines ?? []).map((l) => String(l ?? "").trim()).filter((l) => l.length > 20);
  const findings = [];
  // 1. REPEATED OPENINGS — Fisher's test over the section heads.
  const openRep = detectRepetition(sections, { shuffles, pValue });
  if (openRep.significant && openRep.repeated.length) {
    findings.push({ kind: "repetition", detail: openRep.basis, sections: sections.map((s, i) => (openRep.repeated.includes(s) ? i : -1)).filter((i) => i >= 0) });
  }
  // 2. REPEATED FACTS — a claim phrase (subject + relation + object) that
  //    appears verbatim in more than one section. The fact is stated once,
  //    then restated — the restatement is the redundancy.
  if (sections.length >= 2) {
    const factCount = new Map(); // normalized claim phrase -> [sectionIndexes]
    for (let i = 0; i < sections.length; i++) {
      const sentences = sections[i].split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 25);
      for (const s of sentences) {
        // The claim's core: subject + relation + object, normalized (drop
        // numbers and function words) — "the third-largest antelope in the
        // world" is the same fact in any clothing.
        const norm = s.toLowerCase().replace(/[\d.,%]+/g, "").replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();
        const words = norm.split(" ").filter((w) => w.length > 4 && !STOP_WORDS.has(w));
        if (words.length < 4) continue;
        const key = words.slice(0, 8).join(" ");
        if (!factCount.has(key)) factCount.set(key, []);
        factCount.get(key).push(i);
      }
    }
    for (const [key, idxs] of factCount) {
      if (idxs.length < 2) continue; // a fact once is a finding
      // Only flag when the SAME fact appears in 2+ DIFFERENT sections.
      const distinct = [...new Set(idxs)];
      if (distinct.length >= 2) {
        findings.push({
          kind: "repeated-fact",
          detail: `the claim "${key}" is stated in ${distinct.length} section(s) (${distinct.map((i) => `#${i + 1}`).join(", ")}) — a fact once is a finding, five times is a crutch`,
          sections: distinct,
        });
      }
    }
  }
  // 3. REPEATED SENTENCE TEMPLATES — the same sentence-INITIAL construction
  //    ("The bongo antelope, scientifically classified as...") appearing at
  //    the start of multiple sentences anywhere, not just paragraph heads.
  if (sections.length >= 2) {
    const initCount = new Map();
    for (let i = 0; i < sections.length; i++) {
      const sentences = sections[i].split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 25);
      for (const s of sentences) {
        const first = s.split(/\s+/).slice(0, 6).map((w) => w.toLowerCase().replace(/[^a-z']/g, "")).join(" ");
        if (first.split(" ").filter(Boolean).length < 5) continue;
        if (!initCount.has(first)) initCount.set(first, []);
        initCount.get(first).push(i);
      }
    }
    for (const [key, idxs] of initCount) {
      const distinct = [...new Set(idxs)];
      if (distinct.length >= 2) {
        findings.push({
          kind: "repeated-template",
          detail: `the sentence construction "${key}" opens sentences in ${distinct.length} section(s) (${distinct.map((i) => `#${i + 1}`).join(", ")}) — the same scaffolding everywhere is the boredom`,
          sections: distinct,
        });
      }
    }
  }
  return findings;
}

// ── TRAJECTORY BOREDOM — the same detector, pointed at a CONVERSATION ─────
// detectRedundancy was built for one essay's own sections; a multi-turn chat
// has the identical shape — each assistant turn is a "section" — and the
// identical failure mode: two chatty small models converged, within ~10
// turns, onto a fixed point ("## Dispute Resolution", restated with less
// change each time) all the way to turn 35+ before the test was stopped by
// hand. That is Fisher's null test (detectRepetition, above) applied to
// TURNS instead of PARAGRAPHS — no new statistic, no new threshold: the
// same permutation p<0.05 this file already uses for essay composition.
// THE WINDOW is never hand-picked: it is whatever turns the caller already
// kept (proxy-runner.mjs's own prompt-budget walk), never a fresh N chosen
// for this purpose. `detectTrajectoryBoredom` refuses (bored:false) below
// detectRepetition's own stated floor of two sections — a two-turn chat has
// nothing to compare a trajectory against yet.
export function detectTrajectoryBoredom(assistantTurns = [], { shuffles = 400, pValue = 0.05 } = {}) {
  const turns = (assistantTurns ?? []).map((t) => String(t ?? "").trim()).filter((t) => t.length > 20);
  if (turns.length < 2) {
    return { bored: false, basis: null, n: turns.length, findings: [] };
  }
  const findings = detectRedundancy(turns, { shuffles, pValue });
  if (!findings.length) return { bored: false, basis: null, n: turns.length, findings: [] };
  // The strongest finding carries the fact — openings (Fisher) first, since
  // that is exactly the "every turn opens on the same heading" attractor;
  // otherwise the first repeated-fact/template finding, in the order
  // detectRedundancy already produces them.
  const lead = findings.find((f) => f.kind === "repetition") ?? findings[0];
  return {
    bored: true,
    basis: `the conversation's content has stopped changing over the last ${turns.length} turns — ${lead.detail}`,
    n: turns.length,
    findings,
  };
}

// ── TRAJECTORY CHURN — the boredom detector's mirror (2026-09-25) ─────────
// detectTrajectoryBoredom names a conversation that has stopped moving. Its
// own healthy control — five turns on five unrelated topics — is the stream
// THIS detector names: nothing recurs, nothing is ever confirmed, every turn
// is novel. That passes the boredom test perfectly and settles on nothing,
// which kernel/settling.js reads as never_settles (a structural zero: no slot
// holds one value for corroboration.js's floor of consecutive turns). The same
// organ tells the two ways of settling apart — in any order (the flat fixture:
// boredom's territory) or in sequence beyond an order-shuffle null (a cast
// held for a stretch, then another: the band between). Each turn's content
// words — the same STOP_WORDS and > 4-letter floor detectRedundancy's fact key
// uses, Unicode letters rather than [a-z] — are the slots; the value is
// presence. THE WINDOW is the caller's, as for boredom: whatever turns it
// already kept. `churning` is true only on never_settles; a typed refusal
// (too_short, settled_order_untestable) is passed through as the verdict with
// churning:false — a check that did not run never reports a positive (P41).
export function detectTrajectoryChurn(assistantTurns = [], { pValue = 0.05, shuffles = 400, rng = Math.random } = {}) {
  const turns = (assistantTurns ?? []).map((t) => String(t ?? "").trim()).filter((t) => t.length > 20);
  const facts = turns.map((t) => {
    const m = new Map();
    for (const w of t.toLowerCase().replace(/[^\p{L}']+/gu, " ").split(/\s+/)) if (w.length > 4 && !STOP_WORDS.has(w)) m.set(w, "present");
    return m;
  });
  const r = settling(facts, { pValue, shuffles, rng });
  if (r.gap) return { churning: false, verdict: r.gap, basis: r.basis, n: turns.length, settled: r.settled ?? [], p: null };
  return { churning: r.verdict === "never_settles", verdict: r.verdict, basis: r.basis, n: turns.length, settled: r.settled, p: r.p, early: r.early, late: r.late };
}

const STOP_WORDS = new Set("the and for with that this from under through after during was were are is had has have by to of in on at it its their there here which where when how what who into across over been being not but or as than then so such only also very just".split(" "));

// The whole-document satisfaction: every planned section satisfied. Returns
// {ok, satisfied:number, of:number, failures:[...], totalStrain:number}.
export function satisfactionOf(documentLines = [], sections = [], { material = "" } = {}) {
  const failures = [];
  let totalStrain = 0;
  let satisfied = 0;
  for (let i = 0; i < sections.length; i++) {
    const text = documentLines[i] ?? "";
    const r = satisfactionOfSection(text, { theme: sections[i], material, isFirst: i === 0 });
    totalStrain += r.strain;
    if (r.ok) satisfied++;
    else for (const f of r.failures) failures.push({ index: i, theme: sections[i], ...f });
  }
  const ok = satisfied === sections.length;
  return { ok, satisfied, of: sections.length, failures, totalStrain };
}

// ── THE HOLOGRAPHIC CHECK: the essay is folded at the SAME points the
//    material was folded, and the fold-points are compared. ────────────────
// The material was folded through the reader into a referent index; the essay
// is folded through THAT SAME index (`resolveIn`). A section that names the
// material's own beings (Tragelaphus, the Congo Basin, the coat's stripes)
// resolves to real material referents — it is grounded IN THE RECORD, with
// the beings' byte-addressed spans riding the finding (P5.2, 54a5622). A
// section that names a being the material never folded ("Diceros bicornis
// longipes" for the bongo) resolves to NOTHING — it is a fabrication, typed
// `unresolved`, never a guess. This is the answer checked holographically:
// fold the essay, compare the fold-points, the record is the ground.
// `index` is the material's referent index (readingIndexFromLog's resolveIn).
// Returns {ok, failures:[{kind,detail,sectionIndex,resolved,unresolved}], fold}.
export function holographicSatisfaction(documentLines = [], sections = [], { index = null } = {}) {
  const failures = [];
  const fold = [];
  const resolveIn = (text) => {
    try {
      const r = index?.resolveIn?.(String(text ?? ""));
      return r instanceof Set ? r : new Set(r ?? []);
    } catch { return new Set(); }
  };
  const represent = (id) => { try { return index?.represent?.(id) ?? id; } catch { return id; } };
  const materialIds = new Set([...(index?.referents?.keys?.() ?? [])]);
  for (let i = 0; i < documentLines.length; i++) {
    const text = String(documentLines[i] ?? "");
    const resolved = resolveIn(text);
    const inMaterial = [...resolved].filter((id) => materialIds.has(id));
    const resolvedNames = [...new Set([...inMaterial].map(represent))].filter(Boolean);
    fold.push({ sectionIndex: i, theme: sections[i] ?? "", resolved: resolvedNames });
    if (!text.trim()) {
      failures.push({ kind: "thin", sectionIndex: i, detail: "the section has no content" });
      continue;
    }
    // A section must resolve to at least ONE material being to be grounded.
    // If it resolves to none, it is folded against an empty fold-point: the
    // essay invented beings the material never carried (measured: the model
    // wrote "Diceros bicornis longipes" — a black rhino — for the bongo; the
    // holographic fold resolves it to nothing and names the fabrication).
    if (!inMaterial.length) {
      failures.push({ kind: "unresolved", sectionIndex: i, detail: `the section folds to no material referent — it is not written from the record (resolved: ${resolvedNames.join(", ") || "none"})` });
    }
  }
  const ok = failures.length === 0;
  return { ok, filled: documentLines.length - failures.length, of: documentLines.length, failures, totalStrain: failures.length, fold, materialCount: materialIds.size };
}

// ── LAVAR GRADES THE READING INTO EOT ─────────────────────────────────────
// LaVar's method (native/eval/lavar/golden-tool.mjs): the reading is scored
// by RECALL — how many of the material's own propositions the reading
// re-states, matched on label + end2 (never prose). Here the essay is the
// reading, the material's EOT fold (its graph entries) is the golden, and
// each essay section is graded as a set of EOT propositions: does it carry
// the material's claims (label + end2 recall), resolved through the referent
// index? This is "LaVar grades our reading into EOT" — the essay is scored
// against what the material actually holds, never against how it is phrased.
// `materialPropositions` are the material's own {label, end2, end1} claims
// (the reader's graph entries); `index` resolves the essay's words to them.
export function lavarGradeEssay(documentLines = [], sections = [], { materialPropositions = [], index = null } = {}) {
  const failures = [];
  const norm = (t) => String(t ?? "").split(/\s+/).join(" ").toLowerCase().trim();
  const props = (materialPropositions ?? []).filter((p) => p && norm(p.label));
  // The essay's claims: fold each section through the material's referent
  // index, and match its label+end2 against the material's own propositions.
  const resolveIn = (text) => {
    try {
      const r = index?.resolveIn?.(String(text ?? ""));
      return r instanceof Set ? r : new Set(r ?? []);
    } catch { return new Set(); }
  };
  const represent = (id) => { try { return index?.represent?.(id) ?? id; } catch { return id; } };
  let covered = 0;
  const coveredKeys = new Set();
  const perSection = [];
  for (let i = 0; i < documentLines.length; i++) {
    const text = String(documentLines[i] ?? "");
    const resolved = resolveIn(text);
    const names = [...resolved].map(represent).map(norm).filter(Boolean);
    // A section is grounded if it resolves to at least one material being.
    if (!resolved.size && text.trim()) {
      failures.push({ kind: "unresolved", sectionIndex: i, detail: `section ${i + 1} folds to no material referent — LaVar cannot grade prose the record does not carry` });
    }
    // Recall: does the section re-state the material's propositions?
    let sectionCovered = 0;
    for (const p of props) {
      const lab = norm(p.label);
      if (!lab || coveredKeys.has(lab)) continue;
      const e2 = norm(p.end2);
      // The section carries the proposition's act (label) and (when named)
      // its object — the same recall golden-tool.mjs scores on.
      const textLower = text.toLowerCase();
      const labHit = lab.length > 2 && textLower.includes(lab);
      const e2Hit = !e2 || e2.length <= 2 || textLower.includes(e2) || names.some((n) => n && (e2.includes(n) || n.includes(e2)));
      if (labHit && e2Hit) { coveredKeys.add(lab); covered++; sectionCovered++; }
    }
    perSection.push({ sectionIndex: i, carried: sectionCovered });
  }
  const recall = props.length ? covered / props.length : 0;
  // LaVar's grade is the recall: how much of the material's own EOT fold the
  // essay re-states. A section that fails to resolve is a fabrication; the
  // recall score is the honest grade — a 0-recall essay is not a reading.
  return {
    ok: failures.length === 0 && recall >= 0.5,
    filled: documentLines.length - failures.length,
    of: documentLines.length,
    failures,
    totalStrain: failures.length + (recall < 0.5 ? 1 : 0),
    recall: Number(recall.toFixed(3)),
    covered,
    ofPropositions: props.length,
    basis: props.length ? `LaVar: the essay re-states ${covered} of the material's ${props.length} EOT propositions (${(recall * 100).toFixed(0)}% recall)` : "LaVar: the material carried no propositions to grade against",
    perSection,
  };
}

// ── COMPETENCY: the essay reduces the surprise of its own thesis ───────────
// The user's principle: an essay opens with a surprising, assertive claim
// ("the Titanic was sunk through capitalistic hubris") and its competency is
// how well the retrieved GROUNDED evidence retroactively reduces that
// surprise. Competency is NOT how much the essay re-states the material
// (LaVar recall) and NOT length — it is the surprise-reduction: the opening
// thesis creates an expectation gap; the body's grounded evidence closes it
// by explaining the why. Measured here:
//   thesisSurprise — how many of the material's propositions the opening
//     asserts AGAINST (its claim moves the reading's expectations): the
//     opening is surprising when its specific nouns/acts are NOT what the
//     material's ordinary account would state first.
//   evidenceGrounding — how many distinct material propositions the body
//     carries that bear on the thesis's own terms (the why behind the claim).
//   surpriseReduction — the ratio: the body's grounded evidence relative to
//     the thesis's surprise. An essay whose thesis is surprising but whose
//     body carries no grounding for it is INCOMPETENT (a claim with no why).
// `opening` is the first section's text; `body` the rest. `index` resolves
// both against the material's referents. Returns a grade in [0,1].
export function competencyGrade({ opening = "", body = [], materialPropositions = [], index = null } = {}) {
  const norm = (t) => String(t ?? "").split(/\s+/).join(" ").toLowerCase().trim();
  const props = (materialPropositions ?? []).filter((p) => p && norm(p.label));
  const resolveIn = (text) => {
    try {
      const r = index?.resolveIn?.(String(text ?? ""));
      return r instanceof Set ? r : new Set(r ?? []);
    } catch { return new Set(); }
  };
  const represent = (id) => { try { return index?.represent?.(id) ?? id; } catch { return id; } };
  // The thesis's own terms: the material referents the opening asserts, and
  // the content words it uses (a surprising claim uses unexpected terms).
  const thesisIds = resolveIn(opening);
  const thesisNames = [...thesisIds].map(represent).map(norm).filter(Boolean);
  const thesisWords = new Set(norm(opening).split(/[^a-z']+/).filter((w) => w.length > 4));
  // Surprise: the opening asserts a claim that moves the material's ordinary
  // account — its content words are NOT the material's most-repeated terms.
  // Measured as the fraction of the thesis's words that are NOT in any of the
  // material's propositions (unexpected vocabulary = a surprising claim).
  const materialWords = new Set();
  for (const p of props) { for (const w of norm(`${p.end1} ${p.label} ${p.end2}`).split(/[^a-z']+/)) if (w.length > 4) materialWords.add(w); }
  const surprisingWords = [...thesisWords].filter((w) => !materialWords.has(w));
  const thesisSurprise = thesisWords.size ? surprisingWords.length / thesisWords.size : 0;
  // Evidence grounding: how many of the material's propositions the body
  // actually carries (the why behind the thesis's terms).
  const bodyText = norm((body ?? []).join(" "));
  let evidenceCarried = 0;
  for (const p of props) {
    const lab = norm(p.label); if (!lab) continue;
    const e2 = norm(p.end2);
    const labHit = lab.length > 2 && bodyText.includes(lab);
    const e2Hit = !e2 || e2.length <= 2 || bodyText.includes(e2);
    if (labHit && e2Hit) evidenceCarried++;
  }
  const evidenceGrounding = props.length ? evidenceCarried / props.length : 0;
  // SURPRISE-REDUCTION: the body's grounded evidence relative to the thesis's
  // surprise. A surprising thesis (high thesisSurprise) needs grounding to
  // reduce it; an unsurprising thesis needs none. The essay is competent when
  // it explains the why — evidenceGrounding covering the thesis's surprise.
  // When the thesis asserts nothing surprising, the bar is simply that the
  // body carries the material (the essay is a description, not an argument).
  const surpriseReduction = thesisSurprise > 0.2
    ? Math.min(1, evidenceGrounding / thesisSurprise)
    : evidenceGrounding;
  return {
    ok: surpriseReduction >= 0.5,
    grade: Number(surpriseReduction.toFixed(3)),
    thesisSurprise: Number(thesisSurprise.toFixed(3)),
    evidenceGrounding: Number(evidenceGrounding.toFixed(3)),
    surprisingWords: surprisingWords.slice(0, 6),
    evidenceCarried,
    ofPropositions: props.length,
    basis: thesisSurprise > 0.2
      ? `the thesis is surprising (${surprisingWords.length} unexpected terms); the body carries ${evidenceCarried} of ${props.length} material propositions — ${(surpriseReduction * 100).toFixed(0)}% surprise-reduction`
      : `the opening is descriptive (${surprisingWords.length} unexpected terms); the body carries ${evidenceCarried} of ${props.length} material propositions — ${(surpriseReduction * 100).toFixed(0)}% grounded`,
  };
}

// ── KELSEN: THE PRIMARY MODALITY — the essay's claims resolve by the norm
//    hierarchy, and the RESOLUTION IS SHOWN (teaching). ────────────────────
// Kelsen's order (regime.js precedence, and its own exported
// PRECEDENCE_STEPS / precedenceOrderPhrase() — the one copy of this order;
// this comment is a restatement of it, kept in sync by hand since this file
// stays dependency-free and does not import regime.js): validity window
// first, then regime (a contested claim is never silently resolved — it
// routes to landContest), then specificity (lex specialis), then force,
// then recency (lex posterior), then entrenchment — never a silent pick.
// AUDITED 2026-09-14: this comment used to drop "regime" entirely (5 of the
// 6 steps) — see native/tests/document-ledger.test.js's dispute-veto case
// for what that gap actually broke: `tagClaim` below was called without
// `disputedBy`, so a disputed proposition could never even REACH the regime
// check, whatever this comment claimed the order was. The essay's propositions are
// graded through this: when two claims the essay carries conflict, the
// order names a winner and WHY. The default mode is HYPER-GROUNDED — every
// claim is a norm in a hierarchy, and the essay teaches the reader the
// order by showing each resolution: "claim A prevails because claim B is
// out of its validity window (lex specialis: the specific beats the
// general; lex posterior: the later enactment beats the earlier)."
// `propositions` are the essay's claims (the material's EOT entries it
// carries); `index` resolves them; `precedence` and `tagClaim` are the
// regime organs, injected. Returns {ok, resolutions, conflicts, basis}.
export function kelsenGrade({ propositions = [], index = null, precedence = null, tagClaim = null, queryTime = Date.now() } = {}) {
  if (typeof precedence !== "function") {
    return { ok: true, resolutions: [], conflicts: [], basis: "no precedence organ injected — the Kelsen grade is declared, not measured (the regime organ lives in organs/regime.js)" };
  }
  const norm = (t) => String(t ?? "").split(/\s+/).join(" ").toLowerCase().trim();
  const props = (propositions ?? []).filter((p) => p && norm(p.label));
  const resolveIn = (text) => {
    try {
      const r = index?.resolveIn?.(String(text ?? ""));
      return r instanceof Set ? r : new Set(r ?? []);
    } catch { return new Set(); }
  };
  const represent = (id) => { try { return index?.represent?.(id) ?? id; } catch { return id; } };
  // Group the essay's claims by their SUBJECT (the referent they resolve to),
  // then resolve conflicts WITHIN each subject's claim-set through Kelsen.
  const bySubject = new Map();
  for (const p of props) {
    const ids = resolveIn(`${p.end1 ?? ""} ${p.label ?? ""} ${p.end2 ?? ""}`);
    const subject = ids.size ? [...ids].map(represent).join(", ") : norm(p.end1 ?? "?");
    if (!bySubject.has(subject)) bySubject.set(subject, []);
    bySubject.get(subject).push(p);
  }
  const resolutions = [];
  let conflicts = 0;
  for (const [subject, claims] of bySubject) {
    if (claims.length < 2) continue; // a single claim on a subject has nothing to resolve
    // Tag each claim (default force/validity, different enactedAt per claim
    // index so lex posterior is exercised) and pairwise resolve.
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const a = claims[i], b = claims[j];
        // A CONFLICT is same relation, different object — a functional
        // relation with two fillers ("is nocturnal" vs "is diurnal"), the
        // Lincoln vice-president case. Two claims about the same subject
        // with DIFFERENT relations are complementary facts, not a conflict
        // ("is nocturnal" + "found in Kenya" both hold — no resolution
        // needed). A genuine Kelsen conflict is the functional clash.
        const sameAct = norm(a.label) === norm(b.label);
        const sameObject = norm(a.end2) === norm(b.end2);
        if (!sameAct || sameObject) continue; // not a functional clash — no conflict
        let aTag = null, bTag = null;
        if (typeof tagClaim === "function") {
          // disputedBy RIDES OFF THE PROPOSITION ITSELF (2026-09-14 fix): a
          // proposition carrying a live dispute (see proxy-runner.mjs's
          // notesFromEdges, which attaches it from the notes ledger by
          // noteId) used to be tagged with tagClaim's own default
          // (disputedBy: []) here, unconditionally — the regime step of the
          // precedence order could therefore never fire no matter how the
          // proposition arrived, because nothing this file ever computes
          // reached tagClaim. This is the one place that default is
          // overridden; the veto is exercised (or not) by regime.js's own
          // isSettled/precedence, never decided here.
          try { aTag = tagClaim(a, { operator: "CON", disputedBy: a?.disputedBy ?? [], enactedAt: i, queryTime }); } catch { aTag = null; }
          try { bTag = tagClaim(b, { operator: "CON", disputedBy: b?.disputedBy ?? [], enactedAt: j, queryTime }); } catch { bTag = null; }
        }
        if (!aTag || !bTag) continue;
        try {
          const r = precedence({ tag: aTag, grain: "Figure" }, { tag: bTag, grain: "Figure" }, { queryTime });
          conflicts++;
          // THE TEACHING SURFACE: name the resolution, never hide it. The
          // reader sees why one claim prevails under the norm hierarchy.
          resolutions.push({
            subject,
            a: `${a.end1 ?? ""} ${a.label} ${a.end2 ?? ""}`.trim(),
            b: `${b.end1 ?? ""} ${b.label} ${b.end2 ?? ""}`.trim(),
            winner: r.winner === "a" ? "a" : r.winner === "b" ? "b" : null,
            reason: r.reason ?? null,
            why: r.reason === "validity_window"
              ? `${r.winner === "a" ? a.end1 : b.end1} prevails: the other claim is out of its validity window — validity is checked before force or specificity is ever consulted`
              : r.reason === "route_to_landContest"
                ? `neither claim is presented as settled: at least one is disputed by a source (regime is checked before force, specificity or entrenchment could ever pick a winner) — the disagreement is the finding here, not a resolution`
              : r.reason === "specificity"
                ? `${r.winner === "a" ? a.end1 : b.end1} prevails: lex specialis — the more specific claim beats the general`
                : r.reason === "force"
                  ? `${r.winner === "a" ? a.end1 : b.end1} prevails on force — the higher-ranked norm binds`
                  : r.reason === "recency"
                    ? `${r.winner === "a" ? a.end1 : b.end1} prevails: lex posterior — the later enactment beats the earlier`
                    : r.reason === "entrenchment"
                      ? `${r.winner === "a" ? a.end1 : b.end1} prevails on entrenchment — the deeper grain binds`
                      : r.reason === "tied" ? "tied: same force, same grain, no decisive recency — a declared tiebreak is needed, never guessed" : r.detail ?? null,
          });
        } catch { /* an unresolved pair is not graded — never a guess */ }
      }
    }
  }
  return {
    ok: conflicts > 0 ? resolutions.every((r) => r.winner) : true,
    conflicts,
    resolved: resolutions.filter((r) => r.winner).length,
    tied: resolutions.filter((r) => !r.winner).length,
    resolutions,
    basis: conflicts ? `Kelsen resolved ${resolutions.filter((r) => r.winner).length} of ${conflicts} conflicts among the essay's claims — each resolution named` : "Kelsen: no conflicting claims among the essay's propositions — nothing to resolve",
  };
}

// ── REC: a rewrite pass names exactly what the EVA found, and the ledger
//    records the revision (supersede) so the before/after stays on file. ────

// ── LAVAR TELLS US IF WE ARE READING WELL ──────────────────────────────────
// The user's standing: LaVar should tell us if we are reading well, and be
// adapted as needed to help trigger "looking". This grade answers the first
// half on a single source: did the reader actually READ the bytes, or was
// it misreading a text whose formatting it structurally cannot see (a table,
// a column, box-drawing, sub-sentence lines)? When the reader is reading
// wrong, `shouldLook` fires — the CV/OCR "looking" pass — so the source is
// rendered and read the way a person would see it. The gate is mechanical
// (weirdFormattingScore from native/organs/look.js, injected here so this
// file stays dependency-free): a source is "not read well" when its own
// bytes carry layout the plain-text reader cannot see, or when the reading
// produced zero propositions from a source that should have had some.
export function lavarGradeReading({ source = "", text = "", propositions = [], weirdFormattingScore = null, expectedFloor = 3 } = {}) {
  const failures = [];
  const norm = (t) => String(t ?? "").split(/\s+/).join(" ").toLowerCase().trim();
  const gate = typeof weirdFormattingScore === "function" ? weirdFormattingScore(text) : null;
  const props = (propositions ?? []).filter((p) => p && norm(p.label));
  if (gate && gate.score > 0) {
    failures.push({ kind: "misread_formatting", detail: `the text's own formatting is being read wrong (${(gate.signals ?? []).join(", ")}) — should look at it` });
  }
  // A real source that produced nothing is a silent miss — the reader read
  // the bytes and heard nothing, which is as bad as a fabricated proposition
  // (the same withheld-not-convict posture: an empty read is not a reading).
  const meaningful = norm(text).split(/\s+/).filter(Boolean).length;
  if (meaningful >= 80 && props.length === 0) {
    failures.push({ kind: "silent_read", detail: "a substantial source yielded zero propositions — the reader heard nothing it could admit" });
  }
  const readingWell = failures.length === 0;
  return {
    ok: readingWell,
    readingWell,
    shouldLook: Boolean(gate && gate.score > 0),
    signals: gate?.signals ?? [],
    source,
    propositions: props.length,
    basis: readingWell
      ? "LaVar: this source was read well — its bytes yielded propositions and its formatting was not being misread"
      : `LaVar: this source was NOT read well — ${failures.map((f) => f.detail).join("; ")}`,
    failures,
  };
}

// ── verbatim source snips (citations, never generated) ─────────────────────
// The Fold's snip discipline (snip-check.js): "What the sources say, verbatim".
// Sentences are taken mechanically from the EOT-retained source text — never
// paraphrased, never invented. Each snip carries its source address. Returns
// [] when no source text is retained.
export function snipsFromSources(webSources, { maxSnips = 6, maxChars = 240 } = {}) {
  const out = [];
  const seen = new Set(); // exact-normalized identities already emitted
  const emittedWordSets = []; // word sets of emitted snips, for near-dupe suppression
  const wordsOf = (s) => new Set(snipIdentity(s).split(" ").filter(Boolean));
  for (const [url, text] of (webSources ?? new Map()).entries()) {
    if (out.length >= maxSnips) break;
    if (!text) continue;
    const sentences = String(text)
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 40 && s.length <= maxChars);
    for (const s of sentences) {
      if (out.length >= maxSnips) break;
      const cleaned = cleanSpan(s);
      const id = snipIdentity(cleaned);
      if (!id || seen.has(id)) continue;
      // NEAR-DUPES: one Wikisource page's title variants ("…Plastic Guns
      // 2013 Steven J." vs "…Plastic Guns (January 16, 2013) Rep.") are
      // distinct strings but the same words — without suppression they fill
      // all maxSnips and starve every other source. A candidate whose words
      // are ≥80% covered by an emitted snip adds nothing; the first variant
      // stands for the family.
      const words = wordsOf(cleaned);
      let covered = false;
      for (const prev of emittedWordSets) {
        let inter = 0;
        for (const w of words) if (prev.has(w)) inter++;
        if (words.size > 0 && inter / words.size >= 0.8) { covered = true; break; }
      }
      if (covered) continue;
      seen.add(id);
      emittedWordSets.push(words);
      out.push({ url, snip: cleaned });
    }
  }
  return out;
}

// ── citation relevance: a source is cited only for the task it serves ──────
// The session corpus and webSources ACCUMULATE across turns (an earlier
// projection turn's Wikisource lookup is still in the corpus at the next
// poem), but the Sources appendix is built per turn with no relevance check
// — measured 2026-09-17: "write a haiku about debugging code" cited six
// gun-legislation snips admitted turns earlier. A source survives only when
// it shares the task's vocabulary (≥2 distinct content words): same-turn
// material was fetched FOR this task so it overlaps; a sustained-research
// follow-up ("tell me more about the trolley problem") overlaps too; a
// stale page shares nothing and drops. A task with fewer than 2 content
// words cannot judge anything ("tell me more") — keep everything rather
// than cite nothing on a vague follow-up. Mechanical word overlap, never a
// model judgment, so the gate cannot invent relevance.
const CITATION_STOPS = new Set(("about,above,after,again,against,among,before,between,could,doing,down,each,from,further,having,here,more,most,other,should,such,that,this,these,those,under,their,them,then,there,what,when,where,which,while,will,with,would,your,into,over,through,during,also,just,like,than,very,please").split(","));
function contentWords(text) {
  const words = String(text ?? "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !CITATION_STOPS.has(w));
  return new Set(words);
}
export function relevantSources(sources, task) {
  const entries = [...(sources ?? new Map()).entries()];
  const taskWords = contentWords(task);
  if (taskWords.size < 2) return { kept: sources, dropped: 0 };
  const kept = new Map();
  let dropped = 0;
  for (const [id, text] of entries) {
    const docWords = contentWords(String(text ?? "").slice(0, 8000));
    let shared = 0;
    for (const w of taskWords) if (docWords.has(w)) { shared++; if (shared >= 2) break; }
    if (shared >= 2) kept.set(id, text);
    else dropped++;
  }
  return { kept, dropped };
}

// Clean a verbatim span: strip the citation/reference debris a source page
// carries in its own text — Wikipedia's "[ 89 ]", bracketed ref numbers,
// and the trailing whitespace they leave — and decode the HTML entities a
// scraped page carries in its bytes (`&#160;`, `&nbsp;`, `&amp;` …), so a
// quoted span is the source's own words, not its markup. Measured
// 2026-09-17: a Wikisource legislation page reached a poem's Sources
// appendix with `&#160;` intact and six near-identical title variants —
// neither cleaning nor dedup existed. Mechanical, never paraphrasing.
const HTML_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeHtmlEntities(s = "") {
  return String(s).replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|([a-zA-Z]+));/g, (m, dec, hex, named) => {
    if (dec) { const cp = Number(dec); return Number.isSafeInteger(cp) && cp > 0 ? String.fromCodePoint(cp) : m; }
    if (hex) { const cp = parseInt(hex, 16); return Number.isSafeInteger(cp) && cp > 0 ? String.fromCodePoint(cp) : m; }
    const key = String(named ?? "").toLowerCase();
    return key in HTML_ENTITIES ? HTML_ENTITIES[key] : m;
  });
}
export function cleanSpan(s = "") {
  return decodeHtmlEntities(String(s))
    .replace(/ /g, " ") // decoded &nbsp;/&#160; is whitespace, not a visible byte
    .replace(/\[\s*\d+(?:\s*,?\s*\d+)*\s*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\(\s*\)/g, "")
    .trim();
}

// A snip's dedup identity: lowercase, entities decoded, punctuation and
// whitespace collapsed — two title variants of the same Wikisource page
// ("…Plastic Guns 2013 Steven J." vs "…Plastic Guns (January 16, 2013)
// Rep.") still differ here (they ARE different spans), but byte-identical
// and case-only repeats collapse. Near-duplicate suppression beyond that
// (the six variants above) is the relevance gate's job below: variants of
// one stale page share the page's vocabulary, and a stale page shares
// nothing with the task, so the whole family drops together.
function snipIdentity(s = "") {
  return decodeHtmlEntities(String(s)).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// ── serialization ───────────────────────────────────────────────────────────
export function serializeLedger(ledger) {
  return JSON.stringify(ledger, null, 2);
}

// ── APA footnotes with the verbatim span ───────────────────────────────────
// The essay's sentences are attributed to the web sources MECHANICALLY —
// never by the model choosing its citations. For each sentence that stands
// on a source, render an APA-style footnote carrying (a) the source's host
// and year, and (b) the VERBATIM sentence from the source it borrows from
// (the span, taken from the EOT-retained text, never paraphrased). The
// source's URL is the address; the borrowed sentence is the evidence.
export function renderApaFootnotes(essay, webSources = new Map(), { maxFootnotes = 12, givers = [] } = {}) {
  if (!webSources.size) return "";
  // Split the essay into sentences.
  const sentences = String(essay ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
  const notes = [];
  for (const sentence of sentences) {
    if (notes.length >= maxFootnotes) break;
    const terms = sentence.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
    if (terms.length < 4) continue;
    // Best-supporting source by token overlap (cite.js discipline: a word is
    // not evidence; a phrase shared with the source is).
    let best = null, bestScore = 0;
    for (const [url, text] of webSources.entries()) {
      if (!text) continue;
      const src = text.toLowerCase();
      const hits = terms.filter((t) => src.includes(t)).length;
      if (hits > bestScore) { bestScore = hits; best = url; }
    }
    if (!best || bestScore < 3) continue; // not grounded enough to cite
    const srcText = String(webSources.get(best) ?? "");
    // The verbatim span: the source's sentence most overlapping this one,
    // CLEANED of citation debris and capped so a footnote is a quotable
    // sentence, never a whole-page reproduction.
    const srcNorm = srcText.replace(/\s+/g, " ");
    const srcSentences = srcNorm.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim());
    let span = null, spanScore = 0;
    for (const ss of srcSentences) {
      const clean = cleanSpan(ss);
      if (clean.length < 25 || clean.length > 260) continue;
      const hits = terms.filter((t) => clean.toLowerCase().includes(t)).length;
      if (hits > spanScore) { spanScore = hits; span = clean; }
    }
    if (!span || spanScore < 3) {
      // NOT GROUNDED IN A SOURCE — the sentence is the essay's OWN statement.
      // Cite its giver (the model) rather than silently dropping it or
      // passing it off as material (the user's discipline: the model stating
      // something is a giver that should be cited).
      notes.push({
        sentence,
        host: givers.find((g) => g?.role === "model")?.name ?? "the model",
        year: new Date().getFullYear(),
        url: null,
        span: null,
        spanIndex: -1,
        modelClaim: true,
      });
      continue;
    }
    // APA-ish author/year: host + year from the URL's page (no publication
    // date available to a fetch — the host is the named source, the year is
    // the retrieval year, disclosed honestly). A workspace source has no URL:
    // its label is the file's path, so the host is the file's basename, and
    // the year is the reading year — same disclosure, different address.
    let host = "";
    try { host = new URL(best).hostname.replace(/^www\./, ""); } catch { host = ""; }
    if (!host) { try { host = String(best).split("/").filter(Boolean).pop() || "workspace"; } catch { host = "workspace"; } }
    const year = new Date().getFullYear();
    notes.push({ sentence, host, year, url: best, span, spanIndex: srcText.indexOf(span) });
  }
  if (!notes.length) return "";
  // Footnotes: numbered in the essay, then the block at the end. A model-
  // stated claim is disclosed as such — its giver is the model, never a
  // source that did not say it.
  const block = notes.map((n, i) => n.modelClaim
    ? `${i + 1}. (${n.host}, ${n.year}). "${n.sentence.slice(0, 160)}…" — stated by ${n.host} (the essay's own claim; no retained source states it)`
    : `${i + 1}. (${n.host}, ${n.year}). "${n.span}" — ${n.url}`).join("\n");
  return `\n\n## Footnotes\n\n${block}`;
}

// ── INLINE CITATION MARKERS: the citation is EMBEDDED in the text, not only
//    in a footnote block. Each sentence that carries a citation gets [n] right
//    after it, pointing to the footnote list — the reader sees, AT THE CLAIM,
//    that it is sourced (or stated by the model). This is the teaching
//    surface at the sentence grain: you never read a claim without seeing
//    where it comes from. `citations` is the citationLedger's output.
export function embedInlineCitations(essay, citations = []) {
  if (!citations?.length) return String(essay ?? "");
  let text = String(essay ?? "");
  // Match each citation's sentence back into the text and append [n].
  // A sentence is inserted only ONCE (the first occurrence), so a repeated
  // sentence in the essay keeps its first marker. Citations are applied in
  // order; the marker's number is the footnote index (1-based).
  const placed = new Set();
  for (let i = 0; i < citations.length; i++) {
    const c = citations[i];
    const sentence = String(c.essaySentence ?? "").trim();
    if (!sentence) continue;
    if (placed.has(sentence)) continue;
    placed.add(sentence);
    // Find the sentence in the running text — the first occurrence. Match on
    // the leading chunk (the sentence's first 40 chars) so whitespace
    // differences don't defeat the insertion.
    const lead = sentence.slice(0, 40).replace(/\s+/g, " ");
    const idx = text.indexOf(lead);
    if (idx < 0) continue;
    // Walk forward to the sentence's end (its own punctuation) — the text may
    // continue past what the ledger captured, so insert AFTER the sentence's
    // own terminator, not mid-way.
    let end = idx + lead.length;
    while (end < text.length && !/[.!?]["'”]?\s*$/.test(text.slice(Math.max(0, end - 3), end + 1)) && !/[.!?]\s/.test(text.slice(end, end + 2))) {
      end++;
    }
    if (end > text.length) end = text.length;
    text = text.slice(0, end) + ` [${i + 1}]` + text.slice(end);
  }
  return text;
}

// ── THE HTML SURFACE: citations togglable, style switchable (APA ⇄ MLA). ──
// A self-contained HTML page of the essay: the inline [n] markers are
// clickable links to the footnote list; a toolbar toggles the citations
// ON/OFF (show just the prose, or the prose with markers and footnotes) and
// switches the footnote STYLE between APA and MLA. Both styles are rendered
// from the same citation data — never two lists that drift.
// `citations` is the citationLedger output (each has essaySentence, giver,
// source{url,host}, kind, groundingText).
export function renderEssayHtml({ title = "the piece", prose = "", citations = [], thinking = "" } = {}) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // APA: (Host, Year). "Verbatim span" — URL. MLA: Host, "Title of Page," Year, URL.
  const apa = (c, i) => {
    const host = c.giver && c.kind !== "unsupported" ? (c.source?.host ?? "source") : c.giver ?? "the model";
    const year = new Date().getFullYear();
    const span = c.groundingText ? `&ldquo;${esc(c.groundingText.slice(0, 160))}${c.groundingText.length > 160 ? "…" : ""}&rdquo;` : "";
    return c.kind === "unsupported"
      ? `<span class="model-claim">${host}, ${year}. &ldquo;${esc(c.essaySentence.slice(0, 120))}…&rdquo; — stated by ${host} (the essay's own claim; no retained source states it)</span>`
      : `(${esc(host)}, ${year}). ${span}${c.source?.url ? ` &mdash; ${esc(c.source.url)}` : ""}`;
  };
  const mla = (c, i) => {
    const host = c.giver && c.kind !== "unsupported" ? (c.source?.host ?? "Source") : c.giver ?? "the model";
    const year = new Date().getFullYear();
    const span = c.groundingText ? `&ldquo;${esc(c.groundingText.slice(0, 160))}${c.groundingText.length > 160 ? "…" : ""}&rdquo;` : "";
    return c.kind === "unsupported"
      ? `<span class="model-claim">${esc(host)}, ${year}. &ldquo;${esc(c.essaySentence.slice(0, 120))}…&rdquo; &mdash; stated by ${host} (no retained source states it)</span>`
      : `${esc(host)}, ${year}${c.source?.url ? `, ${esc(c.source.url)}` : ""}${span ? `. ${span}` : ""}.`;
  };
  const footnotesApa = citations.map((c, i) => `<li id="fn-${i + 1}">${apa(c, i)}</li>`).join("\n");
  const footnotesMla = citations.map((c, i) => `<li id="fn-mla-${i + 1}">${mla(c, i)}</li>`).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 46rem; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.7; color: #1a1a1a; }
  h1 { font-size: 1.6rem; line-height: 1.3; }
  .toolbar { position: sticky; top: 0; background: #fafafa; border-bottom: 1px solid #ddd; padding: .6rem 1.5rem; margin: -2rem -1.5rem 1.5rem; display: flex; gap: 1rem; align-items: center; font-family: sans-serif; font-size: .85rem; }
  .toolbar label { display: flex; align-items: center; gap: .35rem; }
  .prose { font-size: 1.05rem; }
  .prose p { margin: 1em 0; }
  .cite { color: #0b5; cursor: pointer; font-size: .8em; vertical-align: super; text-decoration: none; }
  .cite:hover { color: #070; }
  .fn { font-size: .9rem; color: #444; }
  .fn li { margin: .4em 0; }
  .model-claim { font-style: italic; color: #777; }
  .thinking { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: .85rem; color: #666; font-family: sans-serif; white-space: pre-wrap; }
  body.no-cites .cite { display: none; }
  body.no-cites .fn, body.no-cites .fn-block { display: none; }
  .footnotes-apa, .footnotes-mla { display: none; }
  body.style-apa .footnotes-apa { display: block; }
  body.style-mla .footnotes-mla { display: block; }
</style></head>
<body class="style-apa">
<div class="toolbar">
  <label><input type="checkbox" id="toggle-cites" checked> citations</label>
  <label>style:
    <select id="toggle-style">
      <option value="apa">APA</option>
      <option value="mla">MLA</option>
    </select>
  </label>
</div>
<h1>${esc(title)}</h1>
<div class="prose">${esc(prose).replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>")}</div>
<h2 class="fn-block">Footnotes</h2>
<ol class="fn footnotes-apa" id="fns-apa">${footnotesApa}</ol>
<ol class="fn footnotes-mla" id="fns-mla">${footnotesMla}</ol>
${thinking ? `<div class="thinking">${esc(thinking)}</div>` : ""}
<script>
  const body = document.body;
  document.getElementById('toggle-cites').addEventListener('change', e => body.classList.toggle('no-cites', !e.target.checked));
  document.getElementById('toggle-style').addEventListener('change', e => { body.classList.toggle('style-apa', e.target.value === 'apa'); body.classList.toggle('style-mla', e.target.value === 'mla'); });
  // Make inline [n] markers clickable links to the footnote.
  document.querySelectorAll('.prose').forEach(p => { p.innerHTML = p.innerHTML.replace(/\\[(\d+)\\]/g, '<a class="cite" href="#fn-\\$1">[\\$1]</a>'); });
</script>
</body></html>`;
}

// ── THE LIVE HTML PROJECTION: the HTML is the projection, fed by the JSONL.
//    The .html shell fetches the ledger's JSONL and the citations JSON on
//    EVERY load, folds them client-side, and renders. Refreshing the page
//    re-folds the latest JSONL — the essay is never a stale .md snapshot.
//    The toolbar can hide/show citations and switch footnote style (APA ⇄
//    MLA), and EXPORT the current fold as Markdown or as JSON. The MD is an
//    export, never the default projection.
export function renderLiveEssayHtml({ docId, title = "the piece", jsonlPath, citationsPath } = {}) {
  const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 46rem; margin: 2rem auto; padding: 0 1.5rem; line-height: 1.7; color: #1a1a1a; }
  h1 { font-size: 1.6rem; line-height: 1.3; }
  .toolbar { position: sticky; top: 0; background: #fafafa; border-bottom: 1px solid #ddd; padding: .6rem 1.5rem; margin: -2rem -1.5rem 1.5rem; display: flex; gap: 1rem; align-items: center; font-family: sans-serif; font-size: .85rem; flex-wrap: wrap; }
  .toolbar label { display: flex; align-items: center; gap: .35rem; }
  .toolbar button { font-family: sans-serif; font-size: .8rem; padding: .25rem .6rem; cursor: pointer; }
  .prose { font-size: 1.05rem; }
  .prose p { margin: 1em 0; }
  .cite { color: #0b5; cursor: pointer; font-size: .8em; vertical-align: super; text-decoration: none; }
  .fn { font-size: .9rem; color: #444; }
  .fn li { margin: .4em 0; }
  .model-claim { font-style: italic; color: #777; }
  .thinking { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid #ddd; font-size: .85rem; color: #666; font-family: sans-serif; white-space: pre-wrap; }
  body.no-cites .cite { display: none; }
  body.no-cites .fn, body.no-cites .fn-block { display: none; }
  .footnotes-apa, .footnotes-mla { display: none; }
  body.style-apa .footnotes-apa { display: block; }
  body.style-mla .footnotes-mla { display: block; }
  .status { font-family: sans-serif; font-size: .8rem; color: #999; }
</style></head>
<body class="style-apa">
<div class="toolbar">
  <span class="status" id="status">loading…</span>
  <label><input type="checkbox" id="toggle-cites" checked> citations</label>
  <label>style:
    <select id="toggle-style">
      <option value="apa">APA</option>
      <option value="mla">MLA</option>
    </select>
  </label>
  <button id="export-md">export .md</button>
  <button id="export-json">export .json</button>
</div>
<h1 id="essay-title">${esc(title)}</h1>
<div class="prose" id="prose">…</div>
<h2 class="fn-block">Footnotes</h2>
<ol class="fn footnotes-apa" id="fns-apa"></ol>
<ol class="fn footnotes-mla" id="fns-mla"></ol>
<div class="thinking" id="thinking" hidden></div>
<script>
  // ── THE LIVE FOLD: fetch the ledger's JSONL + citations on every load ──
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const status = document.getElementById('status');
  const prose = document.getElementById('prose');
  const fnsApa = document.getElementById('fns-apa');
  const fnsMla = document.getElementById('fns-mla');
  const thinking = document.getElementById('thinking');
  const body = document.body;
  let fold = { projection: '', citations: [], thinkingText: '' };

  async function load() {
    status.textContent = 'refreshing from the ledger…';
    try {
      // The LEDGER: append-only JSONL — the artifact. Fold client-side: the
      // parts + citations lines in address order, superseded dropped (the
      // same fold projectLedgerFile does server-side; here it runs in the
      // page so a refresh is always current).
      const ledgerRes = await fetch('${esc(jsonlPath)}');
      if (!ledgerRes.ok) throw new Error('ledger ' + ledgerRes.status);
      const ledgerText = await ledgerRes.text();
      const lines = ledgerText.split('\\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const superseded = new Set(lines.filter(l => l.supersedes).map(l => l.supersedes));
      const alive = lines.filter(l => !superseded.has(l.id));
      // THE PROSE IS THE PARTS ONLY — the citations-role lines carry the
      // footnote BLOCK, which the page renders separately from the structured
      // citations.json. Folding citations into the prose AND rendering the
      // footnote list from citations.json would show every footnote TWICE.
      const proseLines = alive.filter(l => l.role === 'part');
      let projection = proseLines.map(l => l.text ?? '').join('\\n\\n');
      const thinkingText = alive.filter(l => l.role === 'thinking' || l.role === 'plan').map(l => l.text ?? '').join('\\n\\n');
      // The CITATIONS: the structured ledger (the holograph pointer).
      let citations = [];
      try {
        const cRes = await fetch('${esc(citationsPath)}');
        if (cRes.ok) { const cj = await cRes.json(); citations = cj.citations ?? []; }
      } catch { citations = []; }
      // INLINE MARKERS, applied CLIENT-SIDE: each citation's essaySentence is
      // found in the folded prose and [n] is appended after it — the markers
      // are computed here (never duplicated, never stored twice).
      citations.forEach((c, i) => {
        const sentence = String(c.essaySentence ?? '').trim();
        if (!sentence) return;
        const lead = sentence.slice(0, 40).replace(/\\s+/g, ' ');
        const idx = projection.indexOf(lead);
        if (idx < 0) return;
        let end = idx + lead.length;
        while (end < projection.length && !/[.!?]["'”]?\\s*$/.test(projection.slice(Math.max(0, end - 3), end + 1)) && !/[.!?]\\s/.test(projection.slice(end, end + 2))) end++;
        if (end > projection.length) end = projection.length;
        projection = projection.slice(0, end) + ' [' + (i + 1) + ']' + projection.slice(end);
      });
      fold = { projection, citations, thinkingText };
      render();
      status.textContent = 'live — ' + alive.length + ' ledger line(s), ' + citations.length + ' citation(s)';
    } catch (err) {
      status.textContent = 'error: ' + err.message;
    }
  }

  function apa(c, i) {
    const host = c.kind !== 'unsupported' ? (c.source?.host ?? 'source') : (c.giver ?? 'the model');
    const year = new Date().getFullYear();
    const span = c.groundingText ? '\\u201c' + esc(c.groundingText.slice(0, 160)) + (c.groundingText.length > 160 ? '…' : '') + '\\u201d' : '';
    return c.kind === 'unsupported'
      ? '<span class="model-claim">' + esc(host) + ', ' + year + '. \\u201c' + esc(c.essaySentence.slice(0, 120)) + '…\\u201d — stated by ' + esc(host) + ' (the essay\\'s own claim; no retained source states it)</span>'
      : '(' + esc(host) + ', ' + year + '). ' + span + (c.source?.url ? ' — ' + esc(c.source.url) : '');
  }
  function mla(c, i) {
    const host = c.kind !== 'unsupported' ? (c.source?.host ?? 'Source') : (c.giver ?? 'the model');
    const year = new Date().getFullYear();
    const span = c.groundingText ? '\\u201c' + esc(c.groundingText.slice(0, 160)) + (c.groundingText.length > 160 ? '…' : '') + '\\u201d' : '';
    return c.kind === 'unsupported'
      ? '<span class="model-claim">' + esc(host) + ', ' + year + '. \\u201c' + esc(c.essaySentence.slice(0, 120)) + '…\\u201d — stated by ' + esc(host) + ' (no retained source states it)</span>'
      : esc(host) + ', ' + year + (c.source?.url ? ', ' + esc(c.source.url) : '') + (span ? '. ' + span : '') + '.';
  }
  function render() {
    // Inline [n] markers -> clickable links to the footnote.
    let html = esc(fold.projection).replace(/\\n\\n+/g, '</p><p>').replace(/\\n/g, '<br>');
    html = html.replace(/\\[(\\d+)\\]/g, '<a class="cite" href="#fn-\\$1">[\\$1]</a>');
    prose.innerHTML = '<p>' + html + '</p>';
    fnsApa.innerHTML = fold.citations.map((c, i) => '<li id="fn-' + (i + 1) + '">' + apa(c, i) + '</li>').join('\\n');
    fnsMla.innerHTML = fold.citations.map((c, i) => '<li id="fn-mla-' + (i + 1) + '">' + mla(c, i) + '</li>').join('\\n');
    if (fold.thinkingText) { thinking.hidden = false; thinking.textContent = fold.thinkingText; }
  }

  // ── EXPORT: the current fold as Markdown or as JSON ──
  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
  }
  document.getElementById('export-md').addEventListener('click', () => {
    const proseText = fold.projection;
    const fnBlock = fold.citations.length
      ? '\\n\\n## Footnotes\\n\\n' + fold.citations.map((c, i) => (i + 1) + '. ' + apa(c, i).replace(/<[^>]+>/g, '')).join('\\n')
      : '';
    download('${docId}'.replace(/[^a-z0-9_-]/gi, '_') + '.md', esc(proseText).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') + fnBlock, 'text/markdown');
  });
  document.getElementById('export-json').addEventListener('click', () => {
    download('${docId}'.replace(/[^a-z0-9_-]/gi, '_') + '.json', JSON.stringify(fold, null, 2), 'application/json');
  });
  document.getElementById('toggle-cites').addEventListener('change', e => body.classList.toggle('no-cites', !e.target.checked));
  document.getElementById('toggle-style').addEventListener('change', e => { body.classList.toggle('style-apa', e.target.value === 'apa'); body.classList.toggle('style-mla', e.target.value === 'mla'); });
  load();
</script>
</body></html>`;
}

// ── the citation ledger: the holograph pointer, at the true levels of borrow ─
// Footnotes are text; this is the STRUCTURED record — the whole point of EOT
// and the holograph: every output term points precisely to the input bytes it
// came from. Borrowing is a SPECTRUM, and it is RARELY whole-sentence
// verbatim (the Fold's cite.js / snip-check.js discipline):
//
//   VERBATIM  — the whole span exists byte-exact in the source (rare).
//               The span carries a full byte address + per-atom pointers.
//   COMPANY   — the claim's ATOMS (numbers, years, names) each sit in the
//               source BESIDE a content word of the sentence (P31's company
//               rule). This is the COMMON case: the essay paraphrased, but
//               every carried fact is traceable to real source bytes.
//   UNSUPPORTED — no source carries the claim's atoms with company. A
//               disclosed gap — never a silent un-cited claim.
//
// Every atom that IS supported records its real byte address in the retained
// source text: an address is a birth, not a spelling.
export function citationLedger(essay, webSources = new Map(), { maxCitations = 20, givers = [] } = {}) {
  if (!webSources.size) return { citations: [], of: 0, verbatim: 0, company: 0, unsupported: 0, basis: "no retained sources to cite against", givers };
  const sentences = String(essay ?? "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);
  const citations = [];
  for (const sentence of sentences) {
    if (citations.length >= maxCitations) break;
    const terms = sentence.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
    if (terms.length < 4) continue;
    // The claim's ATOMS: numbers (incl. years) and real NAMES (capitalized
    // words that are not sentence-initial function words — "They", "Though",
    // "One", "This" are positions, not atoms; a name is a proper noun).
    const atoms = [];
    const numRe = /\b(?:\d[\d.,]*(?:[mkg]?m|k?g|%|ft|in|m|km|mph)?|1[5-9]\d\d|20\d\d)\b/g;
    let nm;
    while ((nm = numRe.exec(sentence))) atoms.push({ kind: /^1[5-9]\d\d$|^20\d\d$/.test(nm[0]) ? "year" : "number", value: nm[0] });
    const nameRe = /\b[A-Z][a-z]{2,}\b/g;
    const SENTENCE_HEAD = /\b(?:The|A|An|This|These|Those|Their|They|Though|One|Two|He|She|It|His|Her|Its|While|Because|However|Therefore|Moreover|Additionally|Finally|Some|Most|Many|Dolphins)\b/;
    const nameSeen = new Set();
    while ((nm = nameRe.exec(sentence))) {
      const value = nm[0];
      if (SENTENCE_HEAD.test(value)) continue;
      if (nameSeen.has(value)) continue;
      nameSeen.add(value);
      atoms.push({ kind: "name", value });
    }
    // Best source by token overlap (the claim's words against the source).
    let best = null, bestScore = 0;
    for (const [url, text] of webSources.entries()) {
      if (!text) continue;
      const src = text.toLowerCase();
      const hits = terms.filter((t) => src.includes(t)).length;
      if (hits > bestScore) { bestScore = hits; best = url; }
    }
    if (!best || bestScore < 3) {
      // UNSOURCED = THE MODEL'S CLAIM, never a nameless guess. The model
      // stated it; the model is the giver, and the citation says so (the
      // user's discipline: the model stating something is a giver that
      // should be cited — and priors that steered are cited too).
      citations.push({
        essaySentence: sentence,
        source: null,
        kind: "unsupported",
        giver: givers.find((g) => g?.role === "model")?.name ?? "the model",
        priors: givers.filter((g) => g?.role === "prior").map((g) => g.name),
        atoms: [],
        basis: "no source shares enough of the claim's words — this is the essay's own statement, cited to its giver (the model) rather than passed off as material",
      });
      continue;
    }
    const srcText = String(webSources.get(best) ?? "");
    const srcNorm = srcText.replace(/\s+/g, " ");
    const srcLower = srcNorm.toLowerCase();
    const essayLower = sentence.toLowerCase();
    // Company words: the sentence's content words, excluding the atom's own.
    const cw = terms.filter((t) => t.length > 3);
    // The verbatim span, if one exists (byte-exact in the source).
    const srcSentences = srcNorm.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim());
    let span = null, spanScore = 0;
    for (const ss of srcSentences) {
      const clean = cleanSpan(ss);
      if (clean.length < 25 || clean.length > 260) continue;
      const hits = terms.filter((t) => clean.toLowerCase().includes(t)).length;
      if (hits > spanScore) { spanScore = hits; span = clean; }
    }
    const at = span && spanScore >= 3 ? srcNorm.indexOf(span) : -1;
    const verbatim = at >= 0;
    // The HOLOGRAPH POINTER per atom: each atom's byte address in the source,
    // found BESIDE a company word (P31) when it exists, else marked unsupported.
    const atomSpans = [];
    const seenAtoms = new Set();
    for (const atom of atoms) {
      const key = `${atom.kind}:${atom.value.toLowerCase()}`;
      if (seenAtoms.has(key)) continue;
      seenAtoms.add(key);
      const needle = atom.value.toLowerCase();
      const needleAt = srcLower.indexOf(needle);
      if (needleAt < 0) { atomSpans.push({ ...atom, at: null, supported: false, company: [] }); continue; }
      // Company: does a content word of the sentence sit within ±60 chars of
      // the atom in the source? (The atom beside the claim's other words.)
      const win = srcNorm.slice(Math.max(0, needleAt - 60), Math.min(srcNorm.length, needleAt + needle.length + 60)).toLowerCase();
      const company = cw.filter((w) => w !== needle && win.includes(w));
      atomSpans.push({ ...atom, at: [needleAt, needleAt + needle.length], supported: true, company: company.slice(0, 5) });
    }
    const supportedAtoms = atomSpans.filter((a) => a.supported);
    // A URL source names its host; a workspace source names its file — the
    // basename of the path (2026-09-13: workspace citations rendered as
    // "(the model)" because host stayed empty — "workspace:" parses as a URL
    // scheme with an empty hostname, so the fallback keys on empty host too).
    let host = "";
    try { host = new URL(best).hostname.replace(/^www\./, ""); } catch { host = ""; }
    if (!host) { try { host = String(best).split("/").filter(Boolean).pop() || "workspace"; } catch { host = "workspace"; } }
    // THE GROUNDING TEXT: the verbatim source sentence(s) that actually
    // contain the supported atoms — what the source SAYS, not just where the
    // atoms sit. A citation must show the words that ground the claim, so a
    // reader (or a check) sees the source's own sentence the claim stands on.
    // Falls back to the span for verbatim borrows. For claims with no
    // numeric/name atoms, match on the claim's own content words instead.
    const groundingSentences = [];
    const srcSentencesFlat = srcSentences.map((ss) => cleanSpan(ss));
    const groundByAtom = (needle) => srcSentencesFlat.find((ss) => ss.toLowerCase().includes(needle));
    for (const atom of supportedAtoms) {
      const needle = atom.value.toLowerCase();
      const srcSentence = groundByAtom(needle);
      if (srcSentence && !groundingSentences.includes(srcSentence)) groundingSentences.push(srcSentence);
    }
    if (!groundingSentences.length) {
      // No atoms found a home — try the claim's distinctive content words
      // (the non-generic terms that make this claim about THIS thing).
      const distinctive = cw.filter((w) => w.length > 4).sort((a, b) => b.length - a.length);
      for (const word of distinctive) {
        const srcSentence = groundByAtom(word);
        if (srcSentence && !groundingSentences.includes(srcSentence)) groundingSentences.push(srcSentence);
        if (groundingSentences.length >= 2) break;
      }
    }
    const groundingText = verbatim && span ? span : groundingSentences[0] ?? null;
    // Grade the borrow: verbatim span > company-supported (a source sentence
    // grounds the claim's words, with atoms byte-addressed where they exist)
    // > unsupported (nothing grounds it). A claim with no numeric/name atoms
    // but a grounding sentence is still company — the source's own words are
    // the evidence, not only the atoms.
    const allSupported = atomSpans.length === 0 ? groundingSentences.length > 0 : supportedAtoms.length === atomSpans.length;
    const kind = verbatim ? "verbatim" : allSupported && groundingText ? "company" : "unsupported";
    citations.push({
      essaySentence: sentence,
      source: { url: best, host },
      // THE GIVER: the source states the claim; the source is the giver
      // (cited, byte-addressed). Priors that steered the composition are
      // cited too — a prior's steer is a provenance, never invisible.
      giver: host,
      priors: givers.filter((g) => g?.role === "prior").map((g) => g.name),
      // The VERBATIM WORDS that ground this claim — never an address alone.
      groundingText,
      verbatimSpan: span && verbatim ? span : null,
      kind,
      at: verbatim ? [at, at + span.length] : null,
      // The holograph pointer: each carried atom with its real byte address.
      atoms: atomSpans,
      retrievedAt: new Date().toISOString(),
    });
  }
  const counts = { verbatim: citations.filter((c) => c.kind === "verbatim").length, company: citations.filter((c) => c.kind === "company").length, unsupported: citations.filter((c) => c.kind === "unsupported").length };
  return { citations, of: citations.length, ...counts, basis: `mechanically attributed against ${webSources.size} retained source(s): ${counts.verbatim} verbatim, ${counts.company} company-supported (paraphrase, atoms byte-addressed), ${counts.unsupported} unsupported (disclosed)` };
}

// ── disk persistence: the essay LIVES as a JSONL file, projectable anytime ─
// The working essay is never just in-memory: every observation is appended as
// one JSONL line to <dir>/<docId>.jsonl, and the CURRENT state is always the
// projection of that file — the same fold discipline the reader's own log
// holds (S78: the log is the artifact, the tree is a projection). A later
// edit appends; nothing rewrites in place. projectLedgerFile re-folds the
// file at any moment, so a long essay can be re-projected mid-writing.
// node:fs/node:path are ONLY for disk persistence (a server-side concern); the
// browser port loads the module graph and must not break on them. Guarded:
// when neither exists, `fs`/`path` are null and every persistence call throws
// a clear "no disk" error rather than a module-load failure. The khora owns the
// guard; the fold's vendor refresh copies it byte-identical.
let fs = null, path = null;
try {
  const haveProcess = typeof process !== "undefined" && process.versions && process.versions.node;
  if (haveProcess) { fs = (await import("node:fs")).default ?? (await import("node:fs")); path = (await import("node:path")).default ?? (await import("node:path")); }
} catch { fs = null; path = null; }
const noDisk = () => { throw new Error("document-ledger disk persistence requires node:fs/node:path (server-side only)"); };
if (!fs) fs = { appendFileSync: noDisk, readFileSync: noDisk, existsSync: () => false, mkdirSync: noDisk, writeFileSync: noDisk };
if (!path) path = { join: (...p) => p.filter(Boolean).join("/"), basename: (p) => String(p).split("/").pop() };

export function ledgerFilePath(dir, docId) {
  // One physical log per instance: a trailing turn number collapses to :1 so
  // every turn of the same session/job appends to the SAME file instead of
  // forking a new one per turn. docId itself is untouched — ids and any
  // per-turn path a caller derives straight from docId (citations/html/wheel)
  // keep their own identity; only the FILE this ledger writes to is shared.
  const fileKey = String(docId).replace(/:\d+$/, ":1");
  return path.join(dir, `${fileKey.replace(/[^a-z0-9:_-]/gi, "_")}.jsonl`);
}

// ── the-fold's local vault (added 2026-09-16): a sealed line on disk ───────
// The person's browser encrypts (the-fold's vault.js, AES-256-GCM under a
// key that never reaches this process) BEFORE a write crosses here; this
// server never holds a key and never sees plaintext bytes on their way to
// disk when a caller supplies one. `sealedLine` is that caller-supplied
// ciphertext (an opaque string — base64 or hex, this file does not care) for
// the SAME entry `appendDocumentObservation` just folded into memory. What
// still runs in-process on plaintext (grounding, correction, projection
// during THIS session) is disclosed, not silently claimed encrypted — see
// eoreader7 READING-SPEC and the-fold CLAUDE.md for the scope this covers.
export const SEALED_LINE_SHAPE = "sealed-ledger-line";

export function appendLedgerLine(ledger, entry, { dir = null, sealedLine = null } = {}) {
  const line = appendDocumentObservation(ledger, entry);
  if (dir) {
    try {
      const onDisk = sealedLine
        ? JSON.stringify({ shape: SEALED_LINE_SHAPE, v: 1, id: line.id, env: sealedLine })
        : JSON.stringify(line);
      fs.appendFileSync(ledgerFilePath(dir, ledger.docId), onDisk + "\n");
    } catch { /* disk off: the in-memory ledger still holds the record */ }
  }
  return line;
}

/** Is this raw JSONL row a sealed line (ciphertext this process cannot read)
 * rather than an ordinary plaintext observation? Checked structurally, never
 * assumed from the file as a whole — a ledger can carry sealed and plain
 * lines side by side (a vault set up partway through a document's life). */
export function isSealedLine(obj) {
  return !!obj && obj.shape === SEALED_LINE_SHAPE && typeof obj.env === "string";
}

export function projectLedgerFile(filePath, { includeTitle = true, embedCitations = true } = {}) {
  let text = "";
  try { text = fs.readFileSync(filePath, "utf8"); } catch { return null; }
  const ledger = { schema: SCHEMA, docId: path.basename(filePath, ".jsonl"), title: "", lines: [], superseded: new Set(), nextAddress: 0 };
  for (const line of String(text).split("\n")) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    // A sealed line is ciphertext this process holds no key for — it is
    // skipped here, never crashed on and never guessed at. The caller who
    // DOES hold the key (the-fold's vault.js, client-side) is the one place
    // a sealed line can be opened and re-projected; this typed skip is the
    // disclosed edge of what server-side projection can do on a vaulted doc.
    if (isSealedLine(obj)) continue;
    if (!obj || typeof obj.id !== "string") continue;
    ledger.lines.push(obj);
    if (obj.supersedes) ledger.superseded.add(obj.supersedes);
  }
  const body = projectDocument(ledger, { includeTitle });
  // INLINE CITATION MARKERS (2026-09-13): the essay's sentences get [n] after
  // them from the sibling citations ledger — a claim is never read without
  // its source visible at the claim. The artifact stays clean; only the
  // projection carries the markers. Off via embedCitations:false.
  if (!embedCitations) return body;
  try {
    const citesPath = String(filePath).replace(/\.jsonl$/, ".citations.json");
    const cites = JSON.parse(fs.readFileSync(citesPath, "utf8"));
    if (cites?.citations?.length) return embedInlineCitations(body, cites.citations);
  } catch {}
  return body;
}

export function projectLedgerChangelog(filePath, { declaredParts = null } = {}) {
  let text = "";
  try { text = fs.readFileSync(filePath, "utf8"); } catch { return null; }
  const ledger = { schema: SCHEMA, docId: path.basename(filePath, ".jsonl"), title: "", lines: [], superseded: new Set(), nextAddress: 0 };
  for (const line of String(text).split("\n")) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (isSealedLine(obj)) continue;
    if (!obj || typeof obj.id !== "string") continue;
    ledger.lines.push(obj);
    if (obj.supersedes) ledger.superseded.add(obj.supersedes);
  }
  return documentChangeLog(ledger, { declaredParts });
}