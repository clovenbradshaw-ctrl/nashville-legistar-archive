#!/usr/bin/env node
// tools/repoint-links.mjs — move every link of the five MIGRATING repos from a
// former account/name to the declared account/name. Legacy siblings (ohs-custody,
// eoPriors, …) are left on their account.
//
//   edit fold-workspace.json  →  node tools/repoint-links.mjs --apply  →  node tools/check-account.mjs
//
// Default is a DRY RUN. Flags:
//   --apply                write (default: dry run)
//   --account=<name>       target account (default: the declaration's)
//   --set-account=<name>   also write it into fold-workspace.json (and move the
//                          current account into legacy-accounts)
//   --dirs                 also rewrite sibling dir prefixes (../eoreader7/→../khora/,
//                          ../live_priors/→../ethos/); OFF (publish-time step)
import fs from "node:fs";
import path from "node:path";
import { ACCOUNT, LEGACY, MIGRATING, RENAME, TEXT_EXT, isSkippedFile, repos, trackedFiles, transformLinks, declaration, DECL_PATH } from "./fold-account.mjs";

const argv = process.argv.slice(2);
const opt = (k) => { const p = argv.find((a) => a === `--${k}` || a.startsWith(`--${k}=`)); return p === undefined ? undefined : (p.includes("=") ? p.split("=").slice(1).join("=") : true); };

const APPLY = opt("apply") === true;
const DO_DIRS = opt("dirs") === true;
const setAccount = typeof opt("set-account") === "string" ? opt("set-account") : null;
const TARGET = setAccount ?? (typeof opt("account") === "string" ? opt("account") : ACCOUNT);
const LEGACY_ACCOUNTS = setAccount ? [...new Set([...(declaration["legacy-accounts"] ?? []), declaration.account])] : [...LEGACY];
const LEGACY_SET = new Set(LEGACY_ACCOUNTS);
const LEGACY_PRIMARY = LEGACY_ACCOUNTS[0] ?? null;

// The pair rule: migrating repo → target account + new name; any other repo of
// ours → stays on the legacy account; a foreign org → untouched.
const decide = (org, repo) => {
  if (org !== TARGET && !LEGACY_SET.has(org)) return null;
  if (MIGRATING.has(repo)) return { org: TARGET, repo: RENAME[repo] ?? repo };
  return LEGACY_PRIMARY && org !== LEGACY_PRIMARY ? { org: LEGACY_PRIMARY, repo } : null;
};

const DIR_RENAMES = [
  [/(^|[^A-Za-z0-9_.-])(?:\.\.\/)+eoreader7\//g, "$1../khora/"],
  [/(^|[^A-Za-z0-9_.-])(?:\.\.\/)+live_priors\//g, "$1../ethos/"],
];

const changedLines = (a, b) => { const A = a.split("\n"), B = b.split("\n"); let n = 0; for (let i = 0; i < Math.max(A.length, B.length); i++) if (A[i] !== B[i]) n++; return n; };

const hits = [];
let scanned = 0;
for (const repo of repos()) {
  if (!repo.exists) { console.error(`  skip (not a checkout): ${repo.name} → ${repo.dir}`); continue; }
  for (const rel of trackedFiles(repo.dir)) {
    if (isSkippedFile(rel) || !TEXT_EXT.has(path.extname(rel))) continue;
    const abs = path.join(repo.dir, rel);
    let text; try { text = fs.readFileSync(abs, "utf8"); } catch { continue; }
    scanned++;
    let next = transformLinks(text, decide);
    if (DO_DIRS) for (const [re, to] of DIR_RENAMES) next = next.replace(re, to);
    if (next !== text) {
      hits.push({ repo: repo.name, rel, lines: changedLines(text, next) });
      if (APPLY) fs.writeFileSync(abs, next);
    }
  }
}

if (setAccount && APPLY) {
  declaration.account = setAccount;
  declaration["legacy-accounts"] = LEGACY_ACCOUNTS;
  fs.writeFileSync(DECL_PATH, JSON.stringify(declaration, null, 2) + "\n");
  console.log(`declaration updated: account = ${setAccount}, legacy-accounts = [${LEGACY_ACCOUNTS.join(", ")}]`);
}

const total = hits.reduce((s, h) => s + h.lines, 0);
console.log(`\nrepoint-links ${APPLY ? "APPLIED" : "DRY RUN"} — target account: ${TARGET}`);
console.log(`migrating repos: ${[...MIGRATING].sort().join(", ")}`);
console.log(`legacy accounts: ${LEGACY_ACCOUNTS.join(", ") || "(none)"}${DO_DIRS ? "  · dir prefixes ON" : ""}`);
console.log(`scanned ${scanned} tracked files · ${hits.length} files would change · ${total} lines\n`);
for (const h of hits.sort((a, b) => b.lines - a.lines)) console.log(`  ${String(h.lines).padStart(3)}  ${h.repo}/${h.rel}`);
if (!APPLY && hits.length) console.log(`\nre-run with --apply to write.`);
