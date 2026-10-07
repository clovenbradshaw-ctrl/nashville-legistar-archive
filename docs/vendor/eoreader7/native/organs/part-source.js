// Handle: Panizzi — Antonio Panizzi, the librarian who wrote the cataloguing
// rules: every item found, and every item recorded with where it came from.
//
// part-source.js — a page part SNIPPED, not written: found on the fly among
// published packages, kept only under a license that permits it, cut to the
// rules the page actually uses, and carried with its provenance. The engine
// draws its page from the fold (adapters/build/belief-page.js); what the page
// looks like is not the engine's to invent by hand either. So:
//
//   find     the need is declared by the renderer (the HTML elements it
//            emits); a need names its search ("classless css" for a
//            stylesheet that styles plain elements) and the registry is asked
//   license  a candidate is kept only when the registry's stated license is
//            in the permissive family below; the package's own LICENSE file
//            is fetched and travels with the snip (MIT and its kin ask that
//            the notice go with every copy)
//   choose   each kept candidate's stylesheets are read and the one whose
//            rules reach the most of the page's elements wins (fewest bytes
//            on a tie) — coverage measured, never a favourite
//   snip     only the rules whose selectors name an element the page emits
//            (plus :root, html, body, *), and any @media block holding one,
//            each with its exact byte range in the pinned file
//   stamp    package@version/path, its URL, license, sha256 of the file's
//            bytes and the byte ranges, in a /*! comment (kept by minifiers)
//            at the head of the snipped CSS; a license that asks for its
//            notice and ships none is refused
//
// Pure except for what is injected (`npm`: adapters/sources/npm-parts.js).
// No regular expressions.

export const PART_SOURCE_SCHEMA = "PartSource@1";

import { PERMISSIVE, NOTICE_REQUIRED, readLicense } from "./license-table.js";
export { PERMISSIVE, NOTICE_REQUIRED, readLicense };
/** What each need searches for, set by hand 2026-09-27: a stylesheet for a
 *  page of plain elements is what the registry calls "classless css". */
export const NEED_QUERIES = Object.freeze({ stylesheet: ["classless css"] });
const ALWAYS = new Set([":root", "html", "body", "*"]);
/** Top-level CSS blocks with their byte ranges: [{ head, start, end, inner }]
 *  (inner: the nested blocks of an @-rule). Comments and strings are skipped. */
export function cssBlocks(text, from = 0, to = text.length) {
  const out = [];
  let i = from, headStart = from;
  while (i < to) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "*") { const e = text.indexOf("*/", i + 2); i = e < 0 ? to : e + 2; if (text.slice(headStart, i).trim().startsWith("/*")) headStart = i; continue; }
    if (c === "\"" || c === "'") { const e = text.indexOf(c, i + 1); i = e < 0 ? to : e + 1; continue; }
    if (c === "{") {
      let depth = 1, j = i + 1;
      while (j < to && depth) {
        if (text[j] === "/" && text[j + 1] === "*") { const e = text.indexOf("*/", j + 2); j = e < 0 ? to : e + 2; continue; }
        // a quoted "}" (content: "}") is text, not the block's end
        if (text[j] === "\"" || text[j] === "'") { const q = text[j]; let e = j + 1; while (e < to && text[e] !== q) e += text[e] === "\\" ? 2 : 1; j = e + 1; continue; }
        if (text[j] === "{") depth++; else if (text[j] === "}") depth--;
        j++;
      }
      const head = text.slice(headStart, i).trim();
      let start = headStart;
      while (start < i && (text[start] === " " || text[start] === "\n" || text[start] === "\r" || text[start] === "\t")) start++;
      out.push({ head, start, end: j, inner: head.startsWith("@") ? cssBlocks(text, i + 1, j - 1) : [] });
      i = j; headStart = j;
      continue;
    }
    if (c === ";" && text.slice(headStart, i).trim().startsWith("@")) { i++; headStart = i; continue; }   // @import / @charset
    i++;
  }
  return out;
}

/** The element names a selector targets: "nav a:hover, .card > h3" -> a, nav, h3
 *  (a name led by ".", "#", ":" or "[" is a class, id, pseudo or attribute). */
export function selectorElements(selector) {
  const out = new Set();
  const s = String(selector ?? "").toLowerCase();
  let word = "", lead = "";
  const flush = () => { if (word && !".#:[-".includes(lead || " ") && !"0123456789".includes(word[0])) out.add(word); word = ""; };
  for (let i = 0; i <= s.length; i++) {
    const c = s[i] ?? " ";
    // an attribute selector's contents ("[type=text]") name no element
    if (c === "[") { flush(); const e = s.indexOf("]", i + 1); i = e < 0 ? s.length : e; continue; }
    const isWord = (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "-" || c === "_";
    if (isWord) { if (!word) lead = s[i - 1] ?? " "; word += c; continue; }
    flush();
  }
  for (const a of ALWAYS) if (s.split(",").some((part) => part.trim() === a)) out.add(a);
  return out;
}

/** snipCss(text, elements) -> { css, ranges, reached }: the rules that style
 *  an element the page emits, each at its exact byte range in `text`. */
export function snipCss(text, elements) {
  const want = new Set([...elements, ...ALWAYS]);
  const ranges = [];
  const reached = new Set();
  const takes = (b) => { const hit = [...selectorElements(b.head)].filter((e) => want.has(e)); hit.forEach((e) => reached.add(e)); return hit.length > 0; };
  for (const b of cssBlocks(text)) {
    if (b.head.startsWith("@font-face") || b.head.startsWith("@keyframes") || b.head.startsWith("@import")) continue;
    if (b.head.startsWith("@")) { if (b.inner.some(takes)) ranges.push([b.start, b.end]); continue; }
    if (takes(b)) ranges.push([b.start, b.end]);
  }
  const css = ranges.map(([a, z]) => text.slice(a, z)).join("\n");
  return { css, ranges, reached: [...reached].filter((e) => !ALWAYS.has(e)) };
}

/**
 * sourcePart({ need, elements, npm, maxCandidates }) -> Promise<part | null>
 *   part: { schema, need, css, provenance: { package, version, path, url,
 *           license, licenseText, sha256, ranges, reached, of, candidates } }
 */
export async function sourcePart({ need = "stylesheet", elements, npm, maxCandidates = 6 }) {
  const tried = [];
  let best = null;
  for (const q of NEED_QUERIES[need] ?? []) {
    const found = (await npm.search(q, maxCandidates)) ?? [];
    for (const p of found) {
      const lic = readLicense(p.license);
      const ok = lic.ok;
      tried.push({ name: p.name, version: p.version, license: p.license, kept: ok });
      if (!ok) continue;
      const files = (await npm.files(p.name, p.version)) ?? [];
      const sheets = files.filter((f) => f.path.endsWith(".css") && !f.path.endsWith(".min.css") && f.size < 60000).sort((a, b) => a.path.length - b.path.length).slice(0, 4);
      for (const f of sheets) {
        const got = await npm.file(p.name, p.version, f.path);
        if (!got?.text) continue;
        const s = snipCss(got.text, elements);
        const score = s.reached.length;
        if (!best || score > best.score || (score === best.score && s.css.length < best.snip.css.length)) best = { score, snip: s, p, f, got, lic };
      }
    }
  }
  if (!best || !best.score) return null;
  // the license text travels with the snip; a license that asks for its
  // notice and has none to give is not taken (the snip would break its terms)
  const files = (await npm.files(best.p.name, best.p.version)) ?? [];
  const licFile = files.filter((f) => { const n = f.path.toLowerCase().split("/").at(-1); return n.startsWith("license") || n.startsWith("licence") || n.startsWith("copying"); }).sort((a, b) => a.path.length - b.path.length)[0];
  const licenseText = licFile ? (await npm.file(best.p.name, best.p.version, licFile.path))?.text ?? null : null;
  if (!licenseText && best.lic.all.some((id) => NOTICE_REQUIRED.has(id))) return { schema: PART_SOURCE_SCHEMA, need, css: null, refused: `${best.p.name}@${best.p.version} is ${best.lic.chosen}, which asks for its notice, and ships no license text`, provenance: { candidates: tried } };
  // the ranges are BYTES of the file as served, and the hash is of those bytes
  const raw = best.got.bytes ? Buffer.from(best.got.bytes, "base64") : Buffer.from(best.got.text, "utf8");
  const toByte = (i) => Buffer.byteLength(best.got.text.slice(0, i), "utf8");
  const ranges = best.snip.ranges.map(([a, z]) => [toByte(a), toByte(z)]);
  return {
    schema: PART_SOURCE_SCHEMA, need, css: best.snip.css,
    provenance: { package: best.p.name, version: best.p.version, path: best.f.path, url: best.got.url, license: best.lic.chosen, stated: best.p.license, licenseText, sha256: best.got.sha256, bytes: raw.length, ranges, reached: best.snip.reached, of: [...elements], candidates: tried },
  };
}

/** The comment that travels at the head of the snipped CSS. */
export function provenanceComment(p) {
  const clean = (s) => String(s ?? "").split("*/").join("* /");
  return `/*! snipped, not written: ${clean(p.package)}@${clean(p.version)}${clean(p.path)}\n   ${clean(p.url)}\n   license ${clean(p.license)} · sha256 ${p.sha256}\n   bytes ${p.ranges.map(([a, z]) => `${a}-${z}`).join(", ")} of ${p.bytes ?? "?"}\n   styles: ${p.reached.join(", ")}\n${p.licenseText ? `\n${clean(p.licenseText).trim()}\n` : `\n(no license file in the package; the registry states ${clean(p.license)})\n`}*/`;
}
