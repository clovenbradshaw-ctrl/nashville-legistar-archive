// bench-run.mjs — the one crossing: run code in the fold's own sandbox and put
// the run on the bench ledger. The code is stored; scope and result are read
// off its output by bench.mjs, never supplied by the caller.
import { runSandboxedJs } from "../sandboxed-agent.js";
import { addRun } from "./bench.mjs";

/** runOnBench(log, { id, card, role, code, inputs }) -> { log, run } | { error } */
export function runOnBench(log, { id, card, role, code, inputs = [] }) {
  const t0 = Date.now();
  const r = runSandboxedJs(code);
  const out = addRun(log, { id, card, role, code, output: r.output, ok: r.ok, inputs, ms: Date.now() - t0 });
  if (out.error) return out;
  return { log: out.log, run: out.log.entries[out.log.entries.length - 1] };
}
