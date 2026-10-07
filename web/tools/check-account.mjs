#!/usr/bin/env node
// tools/check-account.mjs — the control built to fail (Step 5 / Step 6).
//
// Fails if a MIGRATING repo's link still names a legacy account, or if a
// non-migrating repo (a legacy sibling) was wrongly moved to the new account.
// Repo-aware: a sibling like ohs-custody legitimately stays on the legacy
// account and is not flagged. The declaration and this tooling are exempt.
import fs from "node:fs";
import path from "node:path";
import { ACCOUNT, LEGACY, LEGACY_SET, MIGRATING, TEXT_EXT, isSkippedFile, repos, trackedFiles, scanLinks } from "./fold-account.mjs";

const bad = [];
let scanned = 0;
for (const repo of repos()) {
  if (!repo.exists) { console.error(`  skip (not a checkout): ${repo.name} → ${repo.dir}`); continue; }
  for (const rel of trackedFiles(repo.dir)) {
    if (isSkippedFile(rel) || !TEXT_EXT.has(path.extname(rel))) continue;
    let text; try { text = fs.readFileSync(path.join(repo.dir, rel), "utf8"); } catch { continue; }
    scanned++;
    text.split("\n").forEach((line, i) => {
      for (const { org, repo: r } of scanLinks(line)) {
        if (LEGACY_SET.has(org) && MIGRATING.has(r)) bad.push({ repo: repo.name, rel, line: i + 1, why: `migrating repo ${r} still on legacy account ${org}`, org, r });
        else if (org === ACCOUNT && !MIGRATING.has(r)) bad.push({ repo: repo.name, rel, line: i + 1, why: `non-migrating repo ${r} wrongly moved to ${org} (should stay on a legacy account)`, org, r });
      }
    });
  }
}

console.log(`check-account — account=${ACCOUNT} · legacy=[${LEGACY.join(", ")}] · migrating=[${[...MIGRATING].sort().join(", ")}] · scanned ${scanned} tracked files`);
if (bad.length) {
  console.error(`\nFAIL — ${bad.length} link(s) violate the account rule:\n`);
  for (const b of bad) console.error(`  ${b.repo}/${b.rel}:${b.line}  ${b.org}/${b.r} — ${b.why}`);
  console.error(`\nRun: node tools/repoint-links.mjs --apply`);
  process.exit(1);
}
console.log(`ok — migrating repos on ${ACCOUNT}; no legacy sibling moved; account-portable.`);
