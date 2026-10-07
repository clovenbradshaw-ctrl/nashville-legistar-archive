// notebook-plan.mjs — a question in plain language -> which file, which columns, which analyses. It POINTS; it never writes code.
//
//   Nothing is preset: the methods it can choose from are whatever this instance has LEARNED (notebook-learn.mjs). A model may only
//   point at a learned method or a column shown to it; without one, a plain word match, said as such, with every unmatched word listed.
import { tokenize } from "../../organs/source.js";
import { retrieve } from "./notebook-learn.mjs";
export const ALL_WORDS = new Set(["all", "everything", "overall", "full", "complete", "thorough", "thoroughly", "comprehensive", "whole", "overview"]);

const isTime = (n) => /^(t|time|time_?s|t_?s|timestamp)$/i.test(n);
const stem = (w) => w.replace(/(ies|es|s)$/, "");
export function numericColumns(table, sample = 300) {
  return table.header.filter((h, j) => {
    if (isTime(h)) return false;
    const vals = table.rows.slice(0, sample).map((r) => r[j]).filter((x) => x !== "" && x != null);
    return vals.length >= 0.5 * Math.min(sample, table.rows.length) && vals.every((x) => Number.isFinite(Number(x)));
  });
}
const words = (s) => String(s).toLowerCase().split(/[^a-z0-9\-\/]+/).filter(Boolean);

/** plan(question, files, { library, ask }) -> { file, table, columns, skills, matched, unmatched, via } | { refusal }
 *  `skills` are the learned methods the question retrieves; empty means "no method known" and the caller decides (a mouth, or a refusal). */
export async function plan(question, files, { library = [], ask = null } = {}) {
  const withTables = files.filter((f) => f.tables?.length);
  if (!withTables.length) return { refusal: "no table has been ingested — /ingest a csv, xlsx or a tabular file first (a PDF's text is not a time series)" };
  const qw = new Set(words(question).map(stem));
  const named = withTables.filter((f) => words(f.name.replace(/\.[a-z0-9]+$/i, "")).some((w) => qw.has(stem(w)) && w.length > 2));
  const file = named[0] ?? withTables.at(-1), table = file.tables[0];
  const numeric = numericColumns(table);
  if (!numeric.length) return { refusal: `${file.name} has no numeric columns to analyse`, file: file.name };
  const UNITS = new Set(["mps", "s", "hz", "k", "m", "ms", "pa"]);
  const said = numeric.filter((c) => words(c).some((w) => !UNITS.has(w) && qw.has(stem(w))));
  let columns = said.length ? said : numeric, via = "word overlap between the question and each learned method's name, description and claim (no model)";
  const live = library.filter((s) => s.effectiveOn !== false && !s.conceded), off = library.filter((s) => s.effectiveOn === false && !s.conceded);
  let hits = retrieve(live, question);
  if ([...qw].some((w) => ALL_WORDS.has(w))) { hits = live.map((skill) => ({ skill, hit: [] })); via = "your words asked for everything, so every learned method"; }
  if (ask && live.length) {
    try {
      const got = await ask({ question, skills: live.map((s) => ({ id: s.id, desc: `${s.name}: ${s.desc}` })), columns: numeric });
      const ids = (got.skills ?? []).filter((id) => live.some((s) => s.id === id)), cs = (got.columns ?? []).filter((c) => numeric.includes(c));
      if (ids.length) { hits = ids.map((id) => ({ skill: live.find((s) => s.id === id), hit: [] })); if (cs.length) columns = cs; via = "a model pointed at learned methods and columns (it could only choose from the list shown)"; }
    } catch (e) { via += ` — the model was unreachable (${String(e.message).slice(0, 60)})`; }
  }
  const qtok = [...new Set(tokenize(String(question).replace(/[-\/]/g, " ")).map(stem))];
  const matched = [...new Set(hits.flatMap((h) => h.hit))];
  const unmatched = qtok.filter((t) => !matched.includes(t) && !numeric.some((c) => words(c).map(stem).includes(t)));
  const offMatches = retrieve(off, question).map((h) => h.skill);
  return { file: file.name, table, columns, numeric, offMatches, skills: hits.map((h) => h.skill), matched, unmatched, via };
}
