// notebook-ipynb.mjs — Jupyter interchange. Export writes nbformat 4 with the fold's chain head in
// metadata; import turns cells into cell entries and keeps the file's own outputs as a
// `recorded` note (produced elsewhere — never shown as run here, `stale` says "never run").
import { emptyNotebook, addCell, sourceOf, execsOf, cellOf } from "./notebook.mjs";
import { statusOf, phrase } from "./bench.mjs";

const lines = (s) => { const a = String(s).split("\n"); return a.map((l, i) => (i < a.length - 1 ? l + "\n" : l)); };

export function toIpynb(state) {
  const cells = state.nb.entries.filter((e) => e.kind === "cell").map((c) => {
    if (c.type === "code") {
      const ex = execsOf(state.nb, c.id);
      const last = ex.at(-1);
      const outputs = last ? [{ output_type: "stream", name: "stdout", text: lines(last.output), }, ...last.figures.map((f) => ({ output_type: "display_data", data: { "image/png": f.png, "text/plain": ["<figure>"] }, metadata: {} }))] : [];
      return { cell_type: "code", metadata: { er7: { id: c.id, lang: c.lang, for: c.for, role: c.role, execs: ex.length, codeSha: last?.codeSha } }, execution_count: last ? ex.length : null, source: lines(sourceOf(state.nb, c.id)), outputs };
    }
    if (c.type === "claim") return { cell_type: "markdown", metadata: { er7: { id: c.id, claim: true, status: statusOf(state.bench, c.id) } }, source: lines(`**Claim (${statusOf(state.bench, c.id)})** — ${phrase(state.bench, c.id)}`) };
    return { cell_type: "markdown", metadata: { er7: { id: c.id } }, source: lines(sourceOf(state.nb, c.id)) };
  });
  const head = state.nb.entries.at(-1)?.hash ?? null;
  return { nbformat: 4, nbformat_minor: 5, metadata: { kernelspec: { name: "python3", display_name: "Python 3", language: "python" }, er7: { schema: "EONotebook@1", head, benchHead: state.bench.entries.at(-1)?.hash ?? null } }, cells };
}

export function fromIpynb(nbjson, { author = "human:import", state = emptyNotebook() } = {}) {
  let st = state; const notes = [];
  (nbjson.cells ?? []).forEach((c, i) => {
    const src = Array.isArray(c.source) ? c.source.join("") : String(c.source ?? "");
    const id = `imp${i + 1}`;
    const r = addCell(st, { id, type: c.cell_type === "code" ? "code" : "markdown", source: src, lang: "python", author });
    if (r.error) { notes.push({ cell: id, error: r.error }); return; }
    st = r.state;
    if (c.cell_type === "code" && (c.outputs ?? []).length) notes.push({ cell: id, recorded: "outputs in the file were produced elsewhere and are not shown as run here" });
  });
  return { state: st, notes };
}
