// adapters/code/scan.js — the WHAT-IS-THIS structural scan of a code hunk.
//
// The recursive prose reader is the wrong instrument for a giant code hunk:
// code forms ~zero referents/edges under the causal text perceiver (that is
// CORRECT and disclosed — see adapters/text/code-structure.js's negative
// control). But "what is this?" about a bundle is answerable from the code's
// OWN structure, and this module is that scan — the way a paleontologist reads
// a skeleton, not a summary: the module map, the vendor stack, the feature
// modules, the endpoints it declares, the declarations it carries. All read
// off the material's own bytes, all bounded, all disclosed.
//
// DISCIPLINES (the same law set code-structure.js already holds, extended to
// the bundle level):
//
//   SEPARATE CHANNEL — nothing here feeds the prose referent/cast system and
//   nothing is fed by it. Module names are read off import/asset syntax, never
//   granted identity by letter-casing.
//
//   RECEIVED-NAME CLASSIFICATION, DISCLOSED — deciding an asset is "vendor"
//   uses the package ecosystem's own received names (react, antd, …), the same
//   class of received knowledge as the PG file-format markers in spans.js.
//   The classification is a disclosed heuristic (`basis` per row), never a
//   verdict; the account the organ composes from it reports "vendor-classed",
//   not "is vendor".
//
//   BOUNDED, NEVER SILENT — a giant hunk is scanned within a declared window;
//   every byte skipped is counted in the disclosure, never silently dropped.
//
//   GATED, NOT TOP-N — candidate lists (assets, strings) are cut by declared
//   caps plus, in the organ, the injected dmdCut — never a bare budgeted
//   "first N".

const ASSET_EXT = new Set([".css", ".png", ".svg", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2", ".ttf", ".json", ".map", ".html", ".ico", ".avif"]);
const CODE_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py"]);
const CODE_OR_ASSET_EXT = new Set([...ASSET_EXT, ...CODE_EXT]);

// Received package-ecosystem names — the class of received knowledge spans.js
// already licenses for file formats. Kept tight and disclosed: this is how an
// asset is classified `vendor` when its name carries one of these as a whole
// word (`react-vendor-Cip7oHDo.js`, `antd-vendor-5tpoUGeT.js`).
const VENDOR_WORD = /(?:^|[-_.])(react|reactdom|antd|ant-design|apollo|syncfusion|maplibre|deck|turf|lodash|moment|axios|slate|draftjs|redux|gatsby|next|angular|vue|svelte|motion|framer|d3|echarts|chartjs|highcharts|leaflet|openlayers|three|pixi|socket|i18next|helmet|webpack|vite|esbuild)(?:[-_.]|$)/i;

// Framework/bundler fingerprints — each a distinct byte pattern that names the
// stack, with the plain name the account may say. Nothing here names an
// APPLICATION product; only libraries and bundlers are identified, and only
// when their own strings appear in the material.
const VENDOR_FINGERPRINTS = Object.freeze([
  { name: "Vite", re: /__vite__/ },
  { name: "webpack", re: /webpackJsonp|webpackChunk|__webpack_require__/ },
  { name: "React", re: /from\s*["']react["']|from\s*["']react-dom["']|createRoot\s*\(|React\.createElement/ },
  { name: "React Router", re: /from\s*["']react-router["']|react-router-dom/ },
  { name: "Apollo Client", re: /@apollo\/client|apollo-client/ },
  { name: "Ant Design", re: /["']antd["']|ant-design/ },
  { name: "Syncfusion", re: /@syncfusion\/|["']@syncfusion/ },
  { name: "MapLibre GL", re: /maplibre-gl/ },
  { name: "deck.gl", re: /@deckgl|@deck\.gl|deck\.gl/ },
  { name: "Turf", re: /["']@turf\/turf["']|["']turf["']/ },
  { name: "Lodash", re: /["']lodash["']/ },
  { name: "Moment", re: /["']moment["']/ },
  { name: "Slate", re: /["']slate["']|["']slate-react["']/ },
  { name: "GraphQL", re: /graphql|__generated__/ },
  { name: "dayjs", re: /["']dayjs["']/ },
  { name: "clsx", re: /["']clsx["']/ },
  { name: "echarts", re: /["']echarts["']/ },
]);

function isAssetLike(name) {
  const i = name.lastIndexOf(".");
  const ext = i === -1 ? "" : name.slice(i).toLowerCase();
  return ASSET_EXT.has(ext);
}

function isCodeLike(name) {
  const i = name.lastIndexOf(".");
  const ext = i === -1 ? "" : name.slice(i).toLowerCase();
  return CODE_EXT.has(ext);
}

// The bare module name — `assets/react-vendor-Cip7oHDo.js` and
// `./react-vendor-Cip7oHDo.js` both classify on `react-vendor-Cip7oHDo.js`
// (the vendor word must be word-bounded; a `/` before it is a path separator,
// not a word boundary).
const bareName = (name) => name.replace(/^\.\//, "").replace(/^(?:\.\/)*assets\//, "");

function classifyAsset(name) {
  const bare = bareName(name);
  if (isAssetLike(bare)) return { name, kind: "asset", basis: `ends in a static-asset extension` };
  if (VENDOR_WORD.test(bare)) return { name, kind: "vendor", basis: `name carries a received package name (VENDOR_WORD)` };
  // "ui-vendor-…", "utils-vendor-…": a vendor-CONVENTION chunk whose leading
  // word is not a known package. That is the app's own infrastructure with a
  // misleading name, and asserting it as a third-party vendor (or as one of
  // the app's feature modules) would both be wrong — it is disclosed as its
  // own kind, never silently merged into either.
  if (/[-_.]vendor[-_.]|vendor\./i.test(bare)) return { name, kind: "infra", basis: `vendor-convention chunk whose leading word is not a known package — the app's own infrastructure` };
  if (isCodeLike(bare)) return { name, kind: "feature", basis: `a code module named by its own asset path` };
  return { name, kind: "unknown", basis: `no extension, no vendor word — left unclassified` };
}

// Extract module/asset names: hashed bundle filenames and `assets/` paths
// (Vite's own naming convention), plus explicit `import … from "./x"` paths.
// The extension alternation covers every code AND static-asset extension the
// classifier knows, so a `.png` or `.woff2` in the map is as capturable as a
// `.js` — a map that silently dropped its static assets would understate the
// asset count by exactly the rows it skipped.
const EXT_ALT = [...CODE_OR_ASSET_EXT].map((e) => e.slice(1)).sort((a, b) => b.length - a.length).join("|");
const EXT_CLASS = `(?:${EXT_ALT})`;
const HASHED_ASSET_RE = new RegExp(`["']([A-Za-z0-9._@-]*[A-Za-z0-9]-[A-Za-z0-9]{8}\\.${EXT_CLASS})["']`, "g");
const ASSETS_DIR_RE = new RegExp(`["']((?:\\.\\/)?assets\\/[A-Za-z0-9._@/-]+\\.${EXT_CLASS})["']`, "g");
const IMPORT_PATH_RE = /(?:from\s*|import\s*\(\s*)["'](\.{0,2}\/[A-Za-z0-9._@/-]+\.(?:js|mjs|cjs|ts|tsx))["']/g;

// Python's own import syntax — `import flask`, `import os, sys`,
// `from flask import Flask`, `from . import x` — which IMPORT_PATH_RE's
// JS-quoted-path shape never matches (measured: real Flask source →
// zero module rows). Captures the TOP module word (`flask` from
// `flask.app`), the unit the map classifies on; relative dots stripped.
const PY_IMPORT_RE = /^[ \t]*(?:from\s+(\.?[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s+import\s+[^\n#]+|import\s+([A-Za-z_]\w*(?:\s*\.\s*[A-Za-z_]\w*)*(?:\s*,\s*[A-Za-z_]\w*(?:\s*\.\s*[A-Za-z_]\w*)*)*))/gm;

/**
 * importSpans(text) -> [{ start, end, statement, kind }]
 * Every import STATEMENT with byte offsets — the locator `moduleMapFrom`
 * deliberately does not provide (its rows are names, never addresses).
 * `kind` is "js" (quoted-path import) or "py" (`import`/`from…import`);
 * `statement` is the full matched line. The mechanical tier needs this
 * for import-block anchors (insert after the last span) and missing-import
 * fixes (INS at a real address). Fresh regexes per call — the module
 * consts above carry shared `lastIndex` state and must not be exported.
 */
export function importSpans(text) {
  const s = String(text ?? "");
  const out = [];
  const jsRe = new RegExp(IMPORT_PATH_RE.source, "gm");
  let m;
  while ((m = jsRe.exec(s))) {
    const lineStart = s.lastIndexOf("\n", m.index) + 1;
    let lineEnd = s.indexOf("\n", m.index);
    if (lineEnd === -1) lineEnd = s.length;
    out.push({ start: lineStart, end: lineEnd, statement: s.slice(lineStart, lineEnd), kind: "js" });
  }
  const pyRe = new RegExp(PY_IMPORT_RE.source, PY_IMPORT_RE.flags);
  while ((m = pyRe.exec(s))) {
    out.push({ start: m.index, end: m.index + m[0].length, statement: m[0], kind: "py" });
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

/**
 * moduleMapFrom(text, { maxAssets }) -> { rows, total, vendor, feature, asset, basis }
 * Every module/asset name the bundle's own bytes state — hashed filenames,
 * assets/ paths, explicit imports — classified vendor/feature/asset, capped at
 * `maxAssets` rows with the full unique count disclosed. `basis` states how
 * each row was found and classified; nothing here is a guess. The SAME asset
 * may be stated in two forms (`assets/ComponentShowcase-CUO93PKA.js` in the
 * deps array, `ComponentShowcase-CUO93PKA.js` in an import) — the dedup key is
 * the normalized bare name, so one asset is one row.
 */
export function moduleMapFrom(text, { maxAssets = 80 } = {}) {
  const s = String(text ?? "");
  const seen = new Set();
  const found = [];
  const add = (name) => {
    if (!name) return;
    const key = name.replace(/^\.\//, "").replace(/^assets\//, "");
    if (seen.has(key)) return;
    seen.add(key);
    found.push(name);
  };
  for (const re of [HASHED_ASSET_RE, ASSETS_DIR_RE, IMPORT_PATH_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) add(m[1]);
  }
  // Python imports ride the same dedup key; their basis is disclosed as
  // read off `import`/`from…import` syntax (never a JS quoted path).
  // `import a, b` yields one row per module; dotted paths collapse to top.
  PY_IMPORT_RE.lastIndex = 0;
  {
    let m;
    while ((m = PY_IMPORT_RE.exec(s))) {
      const mods = (m[1] ?? m[2] ?? "").split(",").map((x) => x.trim().split(".")[0].replace(/^\.+/, "")).filter(Boolean);
      for (const mod of mods) {
        if (/^[A-Za-z_]\w*$/.test(mod)) add(mod);
      }
    }
  }
  const rows = found.slice(0, maxAssets).map(classifyAsset);
  const vendor = rows.filter((r) => r.kind === "vendor").length;
  const feature = rows.filter((r) => r.kind === "feature").length;
  const asset = rows.filter((r) => r.kind === "asset").length;
  const infra = rows.filter((r) => r.kind === "infra").length;
  return {
    rows,
    total: found.length,
    vendor,
    feature,
    asset,
    infra,
    basis: `${found.length} module/asset names read off the bundle's own import/asset syntax (hashed filenames, assets/ paths, explicit JS imports, python import/from statements), ${feature} classed feature / ${vendor} vendor / ${asset} asset / ${infra} infra`,
  };
}

/**
 * vendorSignalsFrom(text) -> [{ name, count, offsets }]
 * The library/bundler stack, detected only where the material's own strings
 * name it. `offsets` are byte anchors into the text handed in.
 */
export function vendorSignalsFrom(text) {
  const s = String(text ?? "");
  const out = new Map();
  for (const fp of VENDOR_FINGERPRINTS) {
    fp.re.lastIndex = 0;
    let m;
    let count = 0;
    let first = -1;
    while ((m = fp.re.exec(s))) {
      count += 1;
      if (first === -1) first = m.index;
      if (count > 200) break;
    }
    if (count > 0) out.set(fp.name, { name: fp.name, count, offsets: [first] });
  }
  return [...out.values()].sort((a, b) => b.count - a.count);
}

// The leading word of a vendor-classed asset name ("react-vendor-Cip7oHDo.js"
// -> "React", "antd-vendor-5tpoUGeT.js" -> "Ant Design" via the known-name
// map below, else capitalised). Received package names, disclosed — the same
// class of received knowledge as VENDOR_WORD itself.
const VENDOR_ASSET_NAME = Object.freeze({ react: "React", reactdom: "React DOM", antd: "Ant Design", apollo: "Apollo Client", syncfusion: "Syncfusion", maplibre: "MapLibre GL", deck: "deck.gl", turf: "Turf", lodash: "Lodash", moment: "Moment", axios: "Axios", slate: "Slate", redux: "Redux", gatsby: "Gatsby", next: "Next.js", angular: "Angular", vue: "Vue", svelte: "Svelte", motion: "Motion", framer: "Framer", d3: "D3", echarts: "ECharts", chartjs: "Chart.js", highcharts: "Highcharts", leaflet: "Leaflet", openlayers: "OpenLayers", three: "Three.js", pixi: "PixiJS", i18next: "i18next", helmet: "Helmet", webpack: "webpack", vite: "Vite", esbuild: "esbuild" });
function vendorNameFromAsset(name) {
  const word = (name.match(/^(?:[^/]*\/)*([A-Za-z0-9]+)(?:[-_.]|$)/) ?? [])[1]?.toLowerCase();
  if (!word) return null;
  // Only a KNOWN package word becomes a vendor identity — "ui-vendor-…" and
  // "utils-vendor-…" are the app's own infrastructure chunks with a
  // vendor-convention name, and capitalising their unknown leading word into a
  // "vendor" would be an assertion the bytes do not support.
  return VENDOR_ASSET_NAME[word] ?? null;
}

// Merge fingerprint signals with the vendor-classed module-map rows, so a
// vendored chunk like "react-vendor-Cip7oHDo.js" names React even when the
// bundle never writes the literal `from "react"` (it imports from the vendored
// copy). The fingerprint count is the witness count; a map-only vendor (no
// fingerprint byte) is still admitted with `count: 0` and a disclosed basis —
// it is named by the map, which is a real byte fact.
function composeVendors(fingerprints, vendorRows) {
  const byName = new Map(fingerprints.map((f) => [f.name, { ...f, basis: "fingerprint bytes in the material" }]));
  for (const row of vendorRows) {
    const name = vendorNameFromAsset(row.name);
    if (!name) continue;
    if (byName.has(name)) {
      const rec = byName.get(name);
      rec.basis += `; vendor-classed map row "${row.name}"`;
      continue;
    }
    byName.set(name, { name, count: 0, offsets: [], basis: `vendor-classed map row "${row.name}"` });
  }
  return [...byName.values()].sort((a, b) => b.count - a.count);
}

const BANNER_RE = /\/\*![\s\S]*?\*\/|(?:\/\/|\/\*)\s*@license[\s\S]*?(?:\*\/|\n)|^\/\/!\s?.*$/gm;

/**
 * bannersFrom(text, { maxBanners }) -> [{ text, offset }]
 * The bundle's own declaration banners — the "bang banner" comment form and
 * @license comments, where a build artifact usually names itself and its
 * license. Never more than `maxBanners`, first-occurrence order, byte-anchored.
 */
export function bannersFrom(text, { maxBanners = 6 } = {}) {
  const s = String(text ?? "");
  BANNER_RE.lastIndex = 0;
  const out = [];
  let m;
  while ((m = BANNER_RE.exec(s))) {
    const banner = m[0].replace(/^\s*\/\*!\s?|\s*\*\/\s*$/g, "").replace(/\s+/g, " ").trim();
    if (!banner) continue;
    out.push({ text: banner.slice(0, 200), offset: m.index });
    if (out.length >= maxBanners) break;
  }
  return out;
}

// ── string-literal scan ──────────────────────────────────────────────────
// A hand-rolled scanner (no regex cross-quote bleed) over a bounded window:
// returns [{ value, offset }] for every `"…"` `'…'` `` `…` `` literal found.
function stringLiterals(s, { maxChars = 100_000, maxLiterals = 20_000 } = {}) {
  const text = s.slice(0, maxChars);
  const out = [];
  let i = 0;
  while (i < text.length && out.length < maxLiterals) {
    const c = text[i];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      let value = "";
      let closed = false;
      while (j < text.length) {
        const ch = text[j];
        if (ch === "\\") { value += ch + (text[j + 1] ?? ""); j += 2; continue; }
        if (ch === c) { closed = true; break; }
        value += ch;
        j += 1;
      }
      if (closed && value.length > 0) out.push({ value, offset: i });
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out;
}

const NOISE = new Set(["default", "undefined", "object", "string", "number", "function", "true", "false", "null", "module", "exports", "require", "__proto__", "constructor", "prototype", "window", "document", "Array", "Object", "String", "Number", "Boolean", "children", "props", "value", "key", "style", "className", "undefined", "self", "global"]);
const COMPONENT_SUFFIX = /(View|Page|Form|Modal|Drawer|Card|Panel|List|Editor|Admin|Login|Home|Search|Report|Status|Settings|Calendar|Survey|Asset|Program|User)$/;
const SLASH_PATH = /^\/?[A-Za-z0-9_.{}:-]+(?:\/[A-Za-z0-9_.{}:-]+){1,}$/;

// The organ's endpoint filter — the strings the scan kept that read as paths
// the artifact talks to. Exported so the what-organ composes the same bar
// rather than re-deriving a second one that can drift.
export const isEndpointLike = (text) => SLASH_PATH.test(String(text ?? "")) || /\/api\/|graphql|endpoint/i.test(String(text ?? ""));

function stringScore(value) {
  let score = 0;
  // An API/endpoint-bearing string outranks a bare asset path — the literal
  // that answers "what does it talk to" is higher-signal than one that merely
  // references its own bundle.
  if (/api|graphql|endpoint/i.test(value)) score += 4;
  if (SLASH_PATH.test(value)) score += 2;
  if (CODE_OR_ASSET_EXT.has(value.slice(value.lastIndexOf(".")).toLowerCase())) score += 1;
  if (value.includes(" ") && value.length >= 8 && value.length <= 60) score += 1;
  if (COMPONENT_SUFFIX.test(value)) score += 1;
  return score;
}

// A "clean literal" is one whose shape could be DATA, not a code fragment:
// letters, digits, underscore, slash, dot, colon, at-sign, hyphen, space.
// Minified code stuffs object keys and expressions into template literals
// (`},DATE_FORMAT_API:{DATE:`), and those are code, not high-information
// literals — a clean-shape bar keeps them out without a word list.
const CLEAN_LITERAL = /^[A-Za-z0-9_./:@ -]+$/;

function isGenericString(value) {
  if (value.length < 8 || value.length > 120) return true;
  if (value.includes("${")) return true; // template interpolation — code, not data
  if (/^assets\//.test(value)) return true; // module reference — the map owns it
  if (CODE_OR_ASSET_EXT.has(value.slice(value.lastIndexOf(".")).toLowerCase())) return true; // a module/asset path, not an endpoint
  if (!CLEAN_LITERAL.test(value)) return true;
  if (/^[\w$]+$/.test(value) && !COMPONENT_SUFFIX.test(value)) return true;
  if (NOISE.has(value)) return true;
  return false;
}

/**
 * distinctiveStringsFrom(text, { maxScanChars, maxKeep }) -> { rows, total, basis }
 * The high-information literals (endpoint/route paths, component-shaped names,
 * title-like strings), deduped with a witness count and first byte offset,
 * capped at `maxKeep`. `total` counts every string literal found in the scan
 * window, so the cap is a disclosed cut, never a silent first-N.
 */
export function distinctiveStringsFrom(text, { maxScanChars = 400_000, maxKeep = 24 } = {}) {
  const literals = stringLiterals(String(text ?? ""), { maxChars: maxScanChars });
  const seen = new Map();
  let scored = 0;
  for (const lit of literals) {
    if (isGenericString(lit.value)) continue;
    const score = stringScore(lit.value);
    if (score === 0) continue;
    scored += 1;
    const prev = seen.get(lit.value);
    if (prev) { prev.count += 1; continue; }
    seen.set(lit.value, { text: lit.value, count: 1, score, offset: lit.offset });
  }
  const rows = [...seen.values()].sort((a, b) => (b.score - a.score) || (b.count - a.count) || (b.text.length - a.text.length)).slice(0, maxKeep);
  return {
    rows,
    total: scored,
    literalsScanned: literals.length,
    basis: `scanned ${maxScanChars.toLocaleString()} chars for string literals; ${literals.length} literals, ${scored} scored non-generic, kept ${rows.length} (gated by score, witness count, then length)`,
  };
}

/**
 * scanHunk(text, { fileName, maxScanChars, maxAssets, maxStrings, maxBanners })
 * -> CodeHunkScan@1 — the composed structural scan with a full disclosure of
 * what was scanned and what was skipped. Pure; the organ composes the account.
 */
export function scanHunk(text, { fileName = "hunk", maxScanChars = 400_000, maxAssets = 80, maxStrings = 24, maxBanners = 6 } = {}) {
  const s = String(text ?? "");
  const scanned = s.slice(0, maxScanChars);
  const moduleMap = moduleMapFrom(scanned, { maxAssets });
  const fingerprints = vendorSignalsFrom(scanned);
  const vendors = composeVendors(fingerprints, moduleMap.rows.filter((r) => r.kind === "vendor"));
  const banners = bannersFrom(scanned, { maxBanners });
  const strings = distinctiveStringsFrom(scanned, { maxScanChars, maxKeep: maxStrings });
  return Object.freeze({
    schema: "CodeHunkScan@1",
    fileName,
    bytes: s.length,
    scannedChars: scanned.length,
    skippedChars: Math.max(0, s.length - scanned.length),
    sampled: s.length > scanned.length,
    moduleMap,
    vendors,
    banners,
    strings,
  });
}