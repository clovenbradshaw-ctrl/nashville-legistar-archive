// notebook.mjs — THE FOLD AS A NOTEBOOK: cells a person writes, runs anyone can re-run.
//
// Fold invariant: A NOTEBOOK IS A LOG, AND A RESULT IS WHAT RAN. Cells are an append-only,
// SHA-256-chained log (the bench's own seal): an edit is a NEW entry that supersedes, never a
// rewrite, and an output exists only as an `exec` entry that stored the code it ran, the
// hash of every data file it saw, and its stdout. An imported .ipynb's outputs are recorded as
// `recorded` (produced elsewhere) and never shown as if they had run here.
//
// Entries:  data   an ingested file (name, kind, sha, gaps)           — what the notebook was given
//           cell   { id, type: markdown|code|claim, lang, source, author }
//           edit   { cell, source, by }                                — supersedes; the past stays
//           exec   { cell, code, codeSha, dataShas, output, ok, figures, scope, result, ms }
// A `claim` cell IS a bench card; a code cell bound to a card (`for`, `role`) also lands its run
// on the bench, so the ladder (stated → conjectured → computed_in_range → proved) is the bench's
// and nothing here can move a status. Promotion is the bench's: a named human, never a model.

import { sha256 } from "../../kernel/sha256.js"; // pure, so a page can re-verify a seal (was node:crypto; byte-identical, conformance/sha256.test.mjs)
import { seal, verifyChain, parseRun, canon, emptyBench, addCard, addRun } from "./bench.mjs";

export const NOTEBOOK_SCHEMA = "EONotebook@1";
const sha = (s) => sha256(s);
const isModel = (w) => /^model:/i.test(String(w ?? ""));
const isHuman = (w) => /^(human|checker):\S+/i.test(String(w ?? ""));

export const emptyNotebook = () => ({ nb: Object.freeze({ schema: NOTEBOOK_SCHEMA, entries: Object.freeze([]) }), bench: emptyBench(), files: {} });
export const verify = (state) => ({ notebook: verifyChain(state.nb), bench: verifyChain(state.bench) });

const cellsOf = (nb) => nb.entries.filter((e) => e.kind === "cell");
export const cellOf = (nb, id) => cellsOf(nb).find((c) => c.id === id) ?? null;
export function sourceOf(nb, id) { let s = cellOf(nb, id)?.source ?? null; for (const e of nb.entries) if (e.kind === "edit" && e.cell === id) s = e.source; return s; }
export const editsOf = (nb, id) => nb.entries.filter((e) => e.kind === "edit" && e.cell === id);
export const execsOf = (nb, id) => nb.entries.filter((e) => e.kind === "exec" && e.cell === id);
export const dataOf = (nb) => { const m = new Map(); for (const e of nb.entries) if (e.kind === "data") m.set(e.name, e); return [...m.values()]; };

/** addData(state, ingested) — register an ingested file. Bytes live in state.files (text + tables),
 *  the ledger holds only their hash and the gaps the reader reported. */
export function addData(state, ing, by = "human:unknown") {
  if (!isHuman(by)) return { error: "data is added by a named human" };
  const body = JSON.stringify({ text: ing.text, tables: ing.tables });
  const files = { ...state.files, [ing.name]: { text: ing.text, tables: ing.tables ?? [] } };
  return { state: { ...state, files, nb: seal(state.nb, { kind: "data", name: ing.name, dataKind: ing.kind, sha: sha(body), chars: ing.text.length, tables: (ing.tables ?? []).length, gaps: ing.gaps ?? [], by }) } };
}

/** addCell(state, { id, type, source, lang, author, for, role }) */
export function addCell(state, { id, type, source, lang = "python", author, for: card = null, role = null, method = null }) {
  if (!id || cellOf(state.nb, id)) return { error: "cell id missing or already used" };
  if (!["markdown", "code", "claim"].includes(type)) return { error: "type must be markdown, code or claim" };
  if (!isHuman(author) && !isModel(author)) return { error: 'author must be named: "human:<name>" or "model:<name>"' };
  if (type === "code" && !["python", "js"].includes(lang)) return { error: "lang must be python or js" };
  if (type === "code" && card && role !== "check" && role !== "control") return { error: 'a code cell bound to a claim needs role "check" or "control"' };
  let bench = state.bench;
  if (type === "claim") { const r = addCard(bench, { id, text: source, author }); if (r.error) return r; bench = r.log; }
  return { state: { ...state, bench, nb: seal(state.nb, { kind: "cell", id, type, lang: type === "code" ? lang : null, source: String(source ?? ""), author, proposed: isModel(author), for: card, role, method }) } };
}

export function editCell(state, { cell, source, by }) {
  const c = cellOf(state.nb, cell);
  if (!c) return { error: "no such cell" };
  if (c.type === "claim") return { error: "a claim is not edited — a changed claim is a new claim, and the old one stays" };
  if (!isHuman(by) && !isModel(by)) return { error: "edits are by a named author" };
  if (String(source) === sourceOf(state.nb, cell)) return { error: "no change" };
  return { state: { ...state, nb: seal(state.nb, { kind: "edit", cell, source: String(source), by, proposed: isModel(by) }) } };
}

/** recordExec(state, { cell, output, ok, figures, ms, run }) — the runner's result becomes an entry.
 *  Scope and result are PARSED from the output (bench.parseRun), never supplied. */
export function recordExec(state, { cell, output, ok, figures = [], ms = null, env = null }) {
  const c = cellOf(state.nb, cell);
  if (!c || c.type !== "code") return { error: "not a code cell" };
  const code = sourceOf(state.nb, cell);
  const { scope, result } = parseRun(output);
  const dataShas = Object.fromEntries(dataOf(state.nb).map((d) => [d.name, d.sha]));
  const n = execsOf(state.nb, cell).length + 1;
  const nb = seal(state.nb, { kind: "exec", cell, n, code, codeSha: sha(code), lang: c.lang, dataShas, output: String(output).slice(0, 20000), ok, figures, scope, result, ms, ...(env ? { env } : {}) });
  let bench = state.bench;
  if (c.for) { const r = addRun(bench, { id: `${cell}#${n}`, card: c.for, role: c.role, code, output, ok, inputs: Object.keys(dataShas), ms }); if (r.error) return r; bench = r.log; }
  return { state: { ...state, nb, bench }, exec: nb.entries[nb.entries.length - 1] };
}

/** stale(state, cell) — the last run no longer matches the cell's source or the data it saw. */
export function stale(state, cell) {
  const last = execsOf(state.nb, cell).at(-1);
  if (!last) return "never run";
  if (last.codeSha !== sha(sourceOf(state.nb, cell))) return "source changed since the last run";
  const now = Object.fromEntries(dataOf(state.nb).map((d) => [d.name, d.sha]));
  if (canon(now) !== canon(last.dataShas)) return "data changed since the last run";
  return null;
}
export { sha };
