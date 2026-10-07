// notebook-dataset.mjs — THE WORKSPACE'S OVERALL DATASET: everything ingested AND everything generated, in one searchable place,
// with the difference between the two never blurred.
//
// Fold invariant: GENERATED CONTENT IS DATA ABOUT WHAT WAS DONE, NEVER EVIDENCE FOR ITSELF. Every finding, note, claim and measurement the
// notebook produced — in any conversation, whatever its type flag — joins the dataset, addressed to the sealed entry that made it and
// labelled `generated` with its author and, for a measurement, the run that printed it. It can be searched, quoted and carried into a
// later question as context. It is never counted as corroboration: a source is what somebody handed us, a generated item is what we
// said about it, and two generated items agreeing are one voice (P2: the model may never co-sign itself).
import { tokenize } from "../../organs/source.js";
import { sourceOf, dataOf } from "./notebook.mjs";
import { statusOf } from "./bench.mjs";

const stem = (w) => w.replace(/(ies|es|s)$/, "");
const toks = (s) => new Set(tokenize(String(s).replace(/[-\/_]/g, " ")).map(stem));

/** datasetOf(ws) -> items across every conversation (open or closed): { kind: "source"|"generated", type, conv, convTitle, cell, hash, text, by, status? } */
export function datasetOf(ws) {
  const out = [];
  for (const c of ws.list(true)) {
    const st = ws.state(c.id), base = { conv: c.id, convTitle: c.title, closed: c.closed };
    for (const d of dataOf(st.nb)) out.push({ ...base, kind: "source", type: "file", cell: d.name, hash: d.hash, text: `${d.name} (${d.dataKind}, ${d.chars} chars${d.tables ? `, ${d.tables} table(s)` : ""})`, by: d.by });
    for (const e of st.nb.entries) {
      if (e.kind === "cell") {
        const text = sourceOf(st.nb, e.id);
        if (e.type === "claim") out.push({ ...base, kind: "generated", type: "claim", cell: e.id, hash: e.hash, text, by: e.author, status: statusOf(st.bench, e.id), method: e.method?.id ?? null });
        else if (e.type === "markdown") out.push({ ...base, kind: "generated", type: /^ans/.test(e.id) ? "finding" : /^ask/.test(e.id) ? "question+method" : "note", cell: e.id, hash: e.hash, text, by: e.author });
      } else if (e.kind === "exec") for (const m of e.output.matchAll(/^#(finding|quality) (.*)$/gm)) out.push({ ...base, kind: "generated", type: m[1] === "finding" ? "measurement" : "data-quality", cell: e.cell, hash: e.hash, text: m[2], by: `run ${e.n} of ${e.cell}`, run: e.hash });
    }
  }
  return out;
}

/** search(items, query, { k, exclude }) -> the k best by shared words; every hit says whether it is a source or something we generated */
export function search(items, query, { k = 8, excludeConv = null, kind = null } = {}) {
  const q = toks(query);
  return items.filter((i) => i.conv !== excludeConv && (!kind || i.kind === kind)).map((i) => ({ i, n: [...toks(i.text)].filter((t) => q.has(t)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, k).map((x) => x.i);
}
export const label = (i) => `[${i.kind}${i.kind === "generated" ? `: ${i.type}` : ""} · ${i.convTitle} · ${i.cell}${i.status ? ` · ${i.status}` : ""} · by ${i.by}]`;
export function summary(items) { const c = { source: 0, generated: 0 }, by = {}; for (const i of items) { c[i.kind]++; by[i.type] = (by[i.type] ?? 0) + 1; } return { ...c, by }; }
