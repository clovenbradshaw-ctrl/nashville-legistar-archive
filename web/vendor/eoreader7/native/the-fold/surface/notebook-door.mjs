// notebook-door.mjs — the notebook's analysis, as a DOOR in the production pipeline (proxy-runner.runProxyTurn).
//
//   /analyze <question>   or   /explore [what to look for]      with a table attached (csv, tsv, xlsx, ipynb tables…)
//
// The attachments are ingested by the same reader as everywhere else (organs/ingest.js); the question goes to the same planner the
// notebook uses — learned methods first, a model if one is set, otherwise the ant colony — and everything it does is a sealed
// entry in a notebook kept per session, using the SAME learned ledgers (ER7_LEARNED_DIR) the Skills surface reads. So a method a
// swarm found through this door is a skill someone can switch off at /skills, and it appears in the notebook's Audit.
// Nothing is answered by a model here: the reply is what the checks found, in their own words, plus what remains unproven.
import { ingest } from "../../organs/ingest.js";
import { learnedDir } from "../../organs/hard-read.js";
import { emptyNotebook, addData, sourceOf, dataOf } from "./notebook.mjs";
import { act } from "./notebook-surface.mjs";
import { sha } from "./notebook.mjs";

const DOOR = /^\s*\/(analy[sz]e|explore)\b\s*(.*)$/is;
export const isAnalysis = (task) => DOOR.test(String(task ?? ""));

/** analysisDoor({ task, attachments, notebook, by, dir, ctx }) -> { text, notebook, gaps, methods } | null (not this door) */
export async function analysisDoor({ task, attachments = [], notebook = null, by = "human:api", dir = learnedDir(), ctx = {} }) {
  const m = String(task ?? "").match(DOOR); if (!m) return null;
  let st = notebook ?? emptyNotebook(); const gaps = [];
  for (const a of attachments) {
    const name = String(a?.name ?? "").slice(0, 120); if (!name) continue;
    const bytes = a.base64 ? Buffer.from(String(a.base64), "base64") : Buffer.from(String(a.text ?? ""));
    if (!bytes.length) continue;
    const ing = ingest({ name, bytes }); gaps.push(...ing.gaps.map((g) => ({ file: name, ...g })));
    if (!ing.tables.length) continue;
    const seen = dataOf(st.nb).find((d) => d.name === name); const body = JSON.stringify({ text: ing.text, tables: ing.tables });
    if (seen && seen.sha === sha(body)) continue;
    const r = addData(st, ing, by); if (r.error) return { text: r.error, notebook: st, gaps, methods: [] }; st = r.state;
  }
  if (!dataOf(st.nb).length) return { text: "There is no table to analyse: attach a csv, tsv or xlsx (a PDF's text is not a time series), then ask again.", notebook: st, gaps, methods: [] };
  const verb = m[1].toLowerCase() === "explore" ? "explore" : "ask", question = m[2].trim();
  const r = await act(st, by, verb === "explore" ? { op: "explore", text: question } : { op: "ask", text: question || "explore this file for structure" }, { dir, ...ctx });
  if (r.error) return { text: r.error, notebook: st, gaps, methods: [] };
  const s = r.state, ans = sourceOf(s.nb, r.selected), askCell = sourceOf(s.nb, r.selected.replace(/^ans/, "ask"));
  const claims = s.nb.entries.filter((e) => e.kind === "cell" && e.type === "claim" && e.method);
  const methods = [...new Map(claims.map((c) => [c.method.id, c.method])).values()];
  const plain = (t) => t.replace(/\*\*/g, "").replace(/`/g, "");
  return { text: `${plain(askCell.split("\n\n").slice(1, 4).join("\n\n"))}\n\n${plain(ans)}\n\nMethods used (each can be switched off, with a reason, at /skills/): ${methods.map((k) => `${k.name} [${k.id}]`).join("; ") || "none"}.`, notebook: s, gaps, methods, selected: r.selected };
}
