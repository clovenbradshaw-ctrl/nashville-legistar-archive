// seed.js — CRISPR mechanics for builds: find existing work, ingest it with
// provenance, and let the fold's own iteration edit it in place.
//
// The lineage is eochat's eval/agent/crispr-search.mjs and CRISPR.md
// (retrieve → gate → verify → splice → retain), re-earned here rather than
// ported wholesale: the measured finding carried over is that MECHANICAL
// archetype extraction (grammar patterns) beat model-assisted extraction on
// every small model actually available (qwen2.5-coder:1.5b, gemma2:2b,
// phi3:mini all wrong-or-null) — the intelligence lives outside the model.
//
// The user's direction, verbatim (2026-08-17): "go have it scrub for a
// pre-build copyright free version before building it's own, carry
// provenance"; "carrying the provenance forever is also more important than
// definitive public domain signals"; "if we can get it to grab any
// arbitrary repo and ingest with provenance and edit in place, anything is
// possible". So:
//
//   - PROVENANCE IS THE INVARIANT, the license signal is a grade. A seed
//     with a known-permissive SPDX id may be spliced automatically; one
//     with any other stated license is OFFERED, never silently spliced; one
//     with no license signal is offered as `unknown`. Whatever happens, the
//     provenance (source url, repo, path, license-as-found-or-null,
//     retrieval date) rides the build's birth entry and is re-carried onto
//     every later ground — ancestry never resets — and is stamped into
//     every export as a comment header, so a downloaded file carries its
//     own ancestry on its face.
//   - Pure module, organs injected (the cast.js pattern): no network here.
//     The explore server owns the crossings (P13's shape); this module
//     folds what the caller fetched and is tested offline.
//
// Closed classes, givers named: SPDX license ids (giver: spdx.org);
// INDEFINITE_DETERMINERS arrive injected from the engine's prior register
// (giver: lang/en — the same class widget.js routes on).

/** Licenses a seed may be spliced from AUTOMATICALLY — permissive or
 * public-domain-equivalent SPDX ids (giver: spdx.org; the set is the
 * standard permissive family, not a judgment call per repo). Everything
 * else still seeds by OFFER with its license shown — provenance over
 * gatekeeping, per user direction — but never silently. */
export const PERMISSIVE_SPDX = Object.freeze(new Set([
  "CC0-1.0",
  "Unlicense",
  "0BSD",
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "CC-BY-4.0",
  "WTFPL",
]));

/** Grade a license signal. `seedable` — splice automatically; `stated` — a
 * real license the operator can act on, offered never auto-spliced;
 * `unknown` — no usable signal (including GitHub's NOASSERTION). The grade
 * NEVER blocks provenance from being carried — it only decides whether the
 * splice is automatic. */
export function gradeLicense(spdx) {
  const id = typeof spdx === "string" && spdx && spdx !== "NOASSERTION" ? spdx : null;
  if (id && PERMISSIVE_SPDX.has(id)) return { grade: "seedable", spdx: id };
  if (id) return { grade: "stated", spdx: id };
  return { grade: "unknown", spdx: null };
}

/**
 * Does this message demand a NEW artifact of a known kind? Mechanical, from
 * closed classes only: a non-interrogative sentence holding an indefinite
 * determiner (an artifact being INTRODUCED — widget.js's own routing
 * reasoning) and naming a language this instrument knows how to keep.
 * `langs` and `indefinites` are injected — the caller's technical
 * vocabulary and the engine's prior register; this module carries no word
 * list of its own.
 */
export function buildAsk(question, { langs, indefinites } = {}) {
  const q = String(question ?? "").trim();
  if (!q || q.endsWith("?")) return null;
  const tokens = q.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean);
  const lang = tokens.find((t) => langs?.has?.(t) ?? false) ?? null;
  if (!lang) return null;
  if (!tokens.some((t) => indefinites?.has?.(t) ?? false)) return null;
  return { lang };
}

/**
 * The archetype — what existing thing the ask points at — extracted by
 * grammar, never by a model (the eochat-measured finding named in the
 * header). Patterns in specificity order: "like X (but) for Y" and
 * "a clone of X" name a comparison target outright; otherwise the noun
 * phrase after the first indefinite determiner, cut at the lang name, a
 * comma, or a preposition trailing the phrase. Returns null rather than a
 * guess — a scrub with no archetype searches on nothing and is skipped.
 */
export function archetypeOf(question, { indefinites, lang = null } = {}) {
  const q = String(question ?? "").toLowerCase().replace(/[?.!]+$/, "");
  let m = q.match(/\blike\s+(.+?)(?:\s+but\b|\s+for\b|,|$)/);
  if (m) return m[1].trim() || null;
  m = q.match(/\b(?:a|an)\s+clone\s+of\s+(.+?)(?:,|$)/);
  if (m) return m[1].trim() || null;
  m = q.match(/\b(.+?)\s+clone\b/);
  if (m) {
    let head = m[1].split(/,|\b(?:make|build|create|me|us)\b/).pop().trim();
    // The determiner introduced the artifact; it is not part of its name.
    head = head.split(/\s+/).filter((w, i) => !(i === 0 && (indefinites?.has?.(w) || w === "the"))).join(" ");
    if (head) return `${head} clone`;
  }
  const words = q.split(/\s+/);
  const at = words.findIndex((w) => indefinites?.has?.(w));
  if (at === -1) return null;
  const phrase = [];
  for (const w of words.slice(at + 1)) {
    if (w === lang || /^[,;]/.test(w) || ["in", "with", "using", "that", "which", "for"].includes(w)) break;
    phrase.push(w.replace(/[,;]+$/, ""));
    if (/[,;]$/.test(w)) break;
  }
  const out = phrase.join(" ").trim();
  return out || null;
}

/** File extensions this instrument can keep as a fold, by language — the
 * same technical vocabulary build-log.js's EXT writes downloads with, read
 * here in the other direction. */
export const INGEST_EXTS = Object.freeze({
  html: "html",
  htm: "html",
  svg: "svg",
  py: "python",
  js: "javascript",
  mjs: "javascript",
  css: "css",
  json: "json",
  md: "markdown",
  sh: "shell",
});

/** Declared ingestion budgets — named numbers, stated in the record and the
 * chip, never silent truncation (P4). */
export const INGEST_MAX_FILES = 12;
export const INGEST_MAX_BYTES = 262_144; // per file

/**
 * From a GitHub contents listing (the API's own rows: {name, path, type,
 * size, download_url}), the files this instrument would ingest: known
 * extensions, within the byte budget, machinery skipped by declared rule
 * (dotfiles, lockfiles, minified bundles). Capped at INGEST_MAX_FILES with
 * the drop COUNTED on the result, never silent.
 */
export function admissibleFiles(entries) {
  const rows = (Array.isArray(entries) ? entries : [])
    .filter((e) => e && e.type === "file" && typeof e.name === "string")
    .filter((e) => !e.name.startsWith("."))
    .filter((e) => !/(?:^|[-.])(?:lock|min)\.|package-lock|yarn\.lock/.test(e.name))
    .map((e) => {
      const ext = e.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
      return ext && INGEST_EXTS[ext] ? { path: e.path, name: e.name, size: e.size ?? 0, lang: INGEST_EXTS[ext], url: e.download_url ?? null } : null;
    })
    .filter(Boolean)
    .filter((e) => e.size <= INGEST_MAX_BYTES);
  return { files: rows.slice(0, INGEST_MAX_FILES), of: rows.length, dropped: Math.max(0, rows.length - INGEST_MAX_FILES) };
}

/**
 * Pick the ONE file to seed a single-artifact build from, or null — a
 * refusal, never a guess (DEF's posture): exactly one admissible file of
 * the asked language, or a conventional entry file (index.*) among many.
 */
export function pickSeedFile(entries, lang) {
  const { files } = admissibleFiles(entries);
  const ofLang = files.filter((f) => f.lang === lang);
  if (ofLang.length === 1) return ofLang[0];
  const index = ofLang.find((f) => /^index\./i.test(f.name));
  return index ?? null;
}

/** The provenance shape every ingested entry carries — normalized once so
 * every consumer (fold, export header, chip, record) reads one shape. */
export function seedProvenance({ repo, path = null, url, license = null, stars = null, retrievedAt }) {
  return {
    host: "github.com",
    repo: String(repo ?? ""),
    path,
    url: String(url ?? ""),
    license: gradeLicense(license).spdx,
    licenseGrade: gradeLicense(license).grade,
    stars,
    retrievedAt: String(retrievedAt ?? ""),
  };
}

/** The forever-line: a comment stamped into every export of a seeded build,
 * so the downloaded file carries its own ancestry on its face. Comment
 * syntax by language; a language with no comment syntax gets no header
 * rather than a corrupted file. */
export function commentHeader(lang, prov) {
  if (!prov?.url) return "";
  const line = `seeded from ${prov.url}${prov.license ? ` · ${prov.license}` : " · license unknown"}${prov.retrievedAt ? ` · ${prov.retrievedAt.slice(0, 10)}` : ""}`;
  const l = String(lang ?? "").toLowerCase();
  if (l === "html" || l === "svg" || l === "markdown" || l === "md") return `<!-- ${line} -->\n`;
  if (l === "python" || l === "shell" || l === "bash" || l === "sh") return `# ${line}\n`;
  if (l === "javascript" || l === "js" || l === "css") return `/* ${line} */\n`;
  return "";
}

/** Read an "ingest this repo" command: /ingest <github url or owner/name>.
 * The door carries the address mechanically — no model ever routes it. */
export function parseIngestCommand(text) {
  const m = String(text ?? "").trim().match(/^\/ingest\s+(\S+)\s*$/);
  if (!m) return null;
  const raw = m[1].replace(/^https?:\/\/(?:www\.)?github\.com\//i, "").replace(/\.git$/, "").replace(/\/+$/, "");
  const parts = raw.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { repo: `${parts[0]}/${parts[1]}` };
}
