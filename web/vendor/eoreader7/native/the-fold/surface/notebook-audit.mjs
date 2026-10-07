// notebook-audit.mjs — HOW EVERY CLAIM HERE WAS PRODUCED, FROM THE LOGS ALONE.
// Nothing is summarised by anyone: each row is read off a sealed ledger (notebook, bench, the learned-analysis library,
// the skill-toggles ledger). A claim is traced to the method that produced it, the method to who wrote it and what admitted
// it, and the method to every switch ever made on it. The three chains are re-verified on every call.
import { verify as verifyNb, cellOf, sourceOf, execsOf } from "./notebook.mjs";
import { statusOf, support } from "./bench.mjs";
import * as L from "./notebook-learn.mjs";

export function audit(st, dir) {
  const v = verifyNb(st), store = L.verifyStore(dir), lib = L.library(dir);
  const cells = st.nb.entries.filter((e) => e.kind === "cell");
  const claims = cells.filter((c) => c.type === "claim").map((c) => {
    const chk = cells.find((x) => x.for === c.id && x.role === "check"), ctl = cells.find((x) => x.for === c.id && x.role === "control");
    const ec = chk && execsOf(st.nb, chk.id).at(-1), en = ctl && execsOf(st.nb, ctl.id).at(-1);
    const promos = st.bench.entries.filter((e) => e.kind === "promote" && e.card === c.id).map((e) => ({ to: e.to, by: e.by, evidence: e.evidence, hash: e.hash.slice(0, 12) }));
    return { id: c.id, text: c.source, author: c.author, status: statusOf(st.bench, c.id), method: c.method ?? null, proposedBy: c.proposed ? c.author : null,
      check: ec ? { cell: chk.id, run: ec.n, result: ec.result, scope: ec.scope, codeSha: ec.codeSha.slice(0, 12), hash: ec.hash.slice(0, 12) } : null,
      control: en ? { cell: ctl.id, run: en.n, result: en.result, scope: en.scope, codeSha: en.codeSha.slice(0, 12), hash: en.hash.slice(0, 12) } : null,
      promotions: promos, sup: (({ checks, controls, failed }) => ({ checks: checks.length, controls: controls.length, failed: failed.length }))(support(st.bench, c.id)) };
  });
  const usedIds = [...new Set(claims.map((c) => c.method?.id).filter(Boolean))];
  const methods = usedIds.map((id) => {
    const k = lib.find((x) => x.id === id);
    if (!k) return { id, missing: true };
    return { id, name: k.name, claim: k.claim, learnedBy: k.lineage?.mouth, question: k.lineage?.question, learnedAt: k.learnedAt, codeSha: k.codeSha, gate: k.evidence, uses: k.uses, on: k.effectiveOn, conceded: k.conceded, switchHistory: L.history(dir, id).map((e) => ({ kind: e.kind, on: e.on, by: e.by, why: e.why, seq: e.seq })), check: k.check, control: k.control };
  });
  return { chains: { notebook: v.notebook, bench: v.bench, analyses: store }, claims, methods, library: lib.map((k) => ({ id: k.id, name: k.name, on: k.effectiveOn, conceded: Boolean(k.conceded), uses: k.uses, learnedBy: k.lineage?.mouth })) };
}
const ok = (c) => (c.ok ? `ok (${c.entries ?? "?"} entries)` : `BROKEN at ${c.at}: ${c.reason}`);
export function auditText(a) {
  const out = [`chains: notebook ${ok(a.chains.notebook)} · bench ${ok(a.chains.bench)} · learned analyses ${ok(a.chains.analyses)}`];
  for (const c of a.claims) out.push(`\n${c.id} [${c.status}] ${c.text.slice(0, 90)}\n  produced by ${c.method ? `${c.method.name} (${c.method.id}, code ${c.method.codeSha?.slice(0, 10)})` : "hand-written cells (no learned method)"}${c.proposedBy ? `, proposed by ${c.proposedBy}` : ""}\n  check ${c.check ? `${c.check.cell} run ${c.check.run} → ${c.check.result} over ${c.check.scope.kind} · seal ${c.check.hash}` : "not run"}; control ${c.control ? `${c.control.cell} → ${c.control.result} · seal ${c.control.hash}` : "not run"}\n  promotions: ${c.promotions.length ? c.promotions.map((p) => `${p.to} by ${p.by}`).join("; ") : "none — nobody has adopted it"}`);
  for (const m of a.methods) out.push(m.missing ? `\nmethod ${m.id}: MISSING from the library` : `\nmethod ${m.id} "${m.name}" — ${m.on ? "ON" : m.conceded ? "CONCEDED" : "OFF"}, used ${m.uses}×\n  written by ${m.learnedBy} for "${m.question}"\n  admitted by: ${(m.gate?.runs ?? []).map((r) => `${r.role}@${r.col}=${r.result}`).join(", ")}; ${m.gate?.generalisation}\n  switch history: ${m.switchHistory.length ? m.switchHistory.map((h) => `${h.kind === "flag" ? "flag" : h.on ? "on" : "off"} by ${h.by}${h.why ? ` (${h.why})` : ""}`).join(" → ") : "never touched (default on)"}`);
  return out.join("\n");
}
