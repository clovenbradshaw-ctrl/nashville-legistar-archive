// notebook-store.mjs — one notebook ledger on disk (two chains and the ingested files), verified on load.
import fs from "node:fs"; import path from "node:path";
import { emptyNotebook, verify, NOTEBOOK_SCHEMA } from "./notebook.mjs";
const file = (dir) => path.join(dir, "notebook.json");

export function load(dir) {
  if (!fs.existsSync(file(dir))) return emptyNotebook();
  const j = JSON.parse(fs.readFileSync(file(dir), "utf8"));
  const st = { nb: { schema: NOTEBOOK_SCHEMA, entries: j.nb }, bench: { schema: "EOBench@1", entries: j.bench }, files: j.files ?? {} };
  const v = verify(st);
  if (!v.notebook.ok || !v.bench.ok) throw new Error(`the ledger does not verify: ${JSON.stringify(v)}`);
  return st;
}
export function save(dir, st) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(dir) + ".tmp", JSON.stringify({ nb: st.nb.entries, bench: st.bench.entries, files: st.files })); fs.renameSync(file(dir) + ".tmp", file(dir)); }
