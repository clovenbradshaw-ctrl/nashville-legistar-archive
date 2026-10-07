// Handle: Ostrom — Elinor Ostrom, who showed a commons holds when its
// boundaries are clear and every use of it can be seen and accounted for.
// An artifact built from other people's words and parts is a commons: every
// element on it owes an account of where it came from.
//
// provenance-cover.js — the check that every element of an artifact has that
// account. A renderer returns { artifact, map }: the map names, for every
// text and every visible attribute value it emitted, what it rests on — note
// ids in the ledger's fold, or an engine word by its key in the renderer's
// own closed catalog. This organ reads the artifact itself (not the map) and
// asks of each element on it:
//
//   is it in the map?             an element the map does not name is
//                                 uncovered — text no one can account for
//   does its account resolve?     each note id must be in the fold (a
//                                 conceded note is not); each engine word
//                                 must be in the catalog with exactly that
//                                 text (an engine key cannot carry any text)
//
// The artifact is read in its own terms, never through the renderer, so a
// renderer that emits text around its mapper is caught. For a page: text
// between tags outside <style> and <script>, and the values of title,
// placeholder, alt and aria-label. No regular expressions.

export const PROVENANCE_COVER_SCHEMA = "ProvenanceCover@1";
const VISIBLE_ATTRS = new Set(["title", "placeholder", "alt", "aria-label"]);
const unesc = (s) => String(s).split("&quot;").join("\"").split("&lt;").join("<").split("&gt;").join(">").split("&amp;").join("&");

/** The elements a page shows: [{ text, where }] — text nodes and visible
 *  attribute values, decoded, trimmed, empty ones dropped. */
export function pageLeaves(html) {
  const out = [];
  const s = String(html ?? "");
  let i = 0, skipUntil = null;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    const text = s.slice(i, lt < 0 ? s.length : lt);
    if (!skipUntil && text.trim()) out.push({ text: unesc(text.trim()), where: "text" });
    if (lt < 0) break;
    const gt = s.indexOf(">", lt);
    if (gt < 0) break;
    const tag = s.slice(lt + 1, gt);
    const name = tag.split(" ")[0].split("\n")[0].toLowerCase();
    if (skipUntil) { if (name === `/${skipUntil}`) skipUntil = null; i = gt + 1; continue; }
    if (name === "style" || name === "script") skipUntil = name;
    else if (!name.startsWith("/") && !name.startsWith("!")) {
      // attribute values: name="value"
      let k = name.length;
      while (k < tag.length) {
        const eq = tag.indexOf("=\"", k);
        if (eq < 0) break;
        let a = eq - 1; while (a >= 0 && tag[a] !== " " && tag[a] !== "\n") a--;
        const attr = tag.slice(a + 1, eq).toLowerCase();
        const close = tag.indexOf("\"", eq + 2);
        if (close < 0) break;
        const value = tag.slice(eq + 2, close);
        if (VISIBLE_ATTRS.has(attr) && value.trim()) out.push({ text: unesc(value.trim()), where: `@${attr}` });
        k = close + 1;
      }
    }
    i = gt + 1;
  }
  return out;
}

/**
 * uncovered({ artifact, map, fold, engineWords, leaves }) -> { schema, ok, uncovered, unresolved, covered }
 *   uncovered   elements on the artifact the map does not account for
 *   unresolved  map entries whose account does not resolve (a note not in
 *               the fold, an unknown engine key, an engine key with other text)
 */
export function uncovered({ artifact, map, fold, engineWords = {}, leaves = pageLeaves }) {
  const live = new Set((fold ?? []).map((n) => n.id));
  const unresolved = [];
  const pool = new Map();
  for (const m of map ?? []) {
    const text = String(m.text ?? "").trim();
    const bad = [];
    if (!m.src?.length) bad.push("no source");
    for (const src of m.src ?? []) {
      if (String(src).startsWith("engine:")) {
        const key = String(src).slice("engine:".length);
        if (!(key in engineWords)) bad.push(`unknown engine word ${key}`);
        else if (engineWords[key] !== text) bad.push(`engine word ${key} is "${engineWords[key]}", not "${text}"`);
      } else if (!live.has(src)) bad.push(`note ${src} is not on the record`);
    }
    if (bad.length) { unresolved.push({ text, why: bad }); continue; }
    pool.set(text, (pool.get(text) ?? 0) + 1);
  }
  const missing = [];
  let covered = 0;
  for (const leaf of leaves(artifact)) {
    const n = pool.get(leaf.text) ?? 0;
    if (n > 0) { pool.set(leaf.text, n - 1); covered++; } else missing.push(leaf);
  }
  return { schema: PROVENANCE_COVER_SCHEMA, ok: missing.length === 0 && unresolved.length === 0, uncovered: missing, unresolved, covered };
}
