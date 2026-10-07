// tools/fold-account.mjs — the one place an account is read in the fold's repos
// (the five compute repos + janus, the mark).
//
// The declaration (fold-workspace.json, at the-fold's root) carries the account;
// every URL anywhere is derived from it. A future account move edits the
// declaration only, then runs tools/repoint-links.mjs and tools/check-account.mjs.
//
// REPO-AWARE. Only the five *migrating* repos move to the new account (janus is
// created there, not migrated, but rides the same account rule). Any other
// repo under the same org (a legacy sibling: ohs-custody, eoPriors,
// eoreaderhandbook, legacy-engine.1, reading-training, …) STAYS on the legacy
// account — repointing it would be a dead link. So a link is judged by the pair
// (org, repo), never the org alone.
//
// Rules (both tools share them):
//   * repo ∈ migrating  → org must be the declared account, repo the new name;
//   * repo ∉ migrating  → org must stay the legacy account (unchanged);
//   * a third-party org (neither account) is never touched.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url)); // the-fold/tools
export const FOLD_DIR = path.resolve(HERE, "..");                  // the-fold/
export const WORKSPACE = process.env.FOLD_WORKSPACE_ROOT ?? path.dirname(FOLD_DIR);
export const DECL_PATH = process.env.FOLD_WORKSPACE_JSON ?? path.join(FOLD_DIR, "fold-workspace.json");

export const declaration = JSON.parse(fs.readFileSync(DECL_PATH, "utf8"));
export const ACCOUNT = process.env.FOLD_ACCOUNT ?? declaration.account;
export const HOST = declaration.host ?? "github.com";
export const LEGACY = Object.freeze([...(declaration["legacy-accounts"] ?? [])]);
export const LEGACY_SET = new Set(LEGACY);
export const RENAME = Object.freeze({ ...(declaration["url-renames"] ?? {}) });

/** Repo names that ride the migration: the five new names, their legacy dir
 *  names, and both sides of every url-rename. */
export const MIGRATING = new Set([
  ...Object.keys(declaration.repos ?? {}),
  ...Object.values(declaration.repos ?? {}).map((r) => r.legacyDir).filter(Boolean),
  ...Object.keys(RENAME),
  ...Object.values(RENAME),
]);

export const SKIP_DIRS = new Set([".git", "node_modules", "vendor", "dist", "build", ".next", "__pycache__", ".cache", "coverage", ".venv"]);
export const TEXT_EXT = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html", ".htm", ".json", ".md", ".markdown", ".sh", ".bash", ".zsh", ".yml", ".yaml", ".toml", ".txt", ".py"]);
export const isSkippedFile = (rel) => {
  if (rel.split("/").some((seg) => SKIP_DIRS.has(seg))) return true;
  return /(^|\/)(package-lock\.json|fold-workspace\.json|fold-account\.mjs|.*\.min\.(js|css))$/.test(rel);
};

/** The five repos, resolved to real dirs on disk (new name, else legacy name). */
export function repos() {
  const out = [];
  for (const [name, meta] of Object.entries(declaration.repos ?? {})) {
    const base = name === "the-fold" ? FOLD_DIR : path.join(WORKSPACE, meta.dir);
    const legacy = meta.legacyDir ? path.join(WORKSPACE, meta.legacyDir) : null;
    const dir = fs.existsSync(path.join(base, ".git")) ? base
      : (legacy && fs.existsSync(path.join(legacy, ".git")) ? legacy : base);
    out.push({ name, role: meta.role, dir, exists: fs.existsSync(path.join(dir, ".git")) });
  }
  return out;
}

export function trackedFiles(dir) {
  try {
    return execSync("git ls-files -z", { cwd: dir, encoding: "buffer" })
      .toString("utf8").split("\0").filter(Boolean);
  } catch { return []; }
}

// A link is `prefix org / repo` (or `org.github.io / repo`). `repo` may carry a
// `.git` suffix, preserved on rewrite. The prefix is one of the four the system
// uses; anything else is not a repo link and is left alone.
const NAME = "[A-Za-z0-9._-]+";
const ORGNAME = "[A-Za-z0-9-_.]+";
const REPO_LINK = new RegExp(`\\b(github\\.com/|raw\\.githubusercontent\\.com/|github:)(${ORGNAME})/(${NAME})`, "g");
const PAGES_LINK = new RegExp(`\\b(${ORGNAME})\\.github\\.io/(${NAME})`, "g");

const splitGit = (tok) => (tok.endsWith(".git") ? { name: tok.slice(0, -4), suffix: ".git" } : { name: tok, suffix: "" });

/** Rewrite every repo link whose (org, repo) `decide(org, repo)` maps to a new
 *  pair. `decide` returns `{ org, repo }` or null (leave the match untouched). */
export function transformLinks(text, decide) {
  let out = text.replace(REPO_LINK, (m, prefix, org, tok) => {
    const { name, suffix } = splitGit(tok);
    const d = decide(org, name);
    return d ? `${prefix}${d.org}/${d.repo}${suffix}` : m;
  });
  out = out.replace(PAGES_LINK, (m, org, tok) => {
    const { name, suffix } = splitGit(tok);
    const d = decide(org, name);
    return d ? `${d.org}.github.io/${d.repo}${suffix}` : m;
  });
  return out;
}

/** Every repo link's (org, repo, kind) in `text` — for the control's scan. */
export function scanLinks(text) {
  const found = [];
  const run = (re, kind, pages) => {
    const r = new RegExp(re.source, "g");
    let m;
    while ((m = r.exec(text)) !== null) {
      const org = pages ? m[1] : m[2];
      const { name } = splitGit(pages ? m[2] : m[3]);
      found.push({ org, repo: name, kind });
    }
  };
  run(REPO_LINK, "repo", false);
  run(PAGES_LINK, "pages", true);
  return found;
}
