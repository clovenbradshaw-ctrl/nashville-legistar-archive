#!/usr/bin/env node
// vendor-sync.mjs — copy the notebook pane's khora files into vendor/ BYTE-IDENTICAL, from a sibling checkout, and record where
// they came from. Never edit a file under vendor/ in place: change it upstream, then run this.
//
//   node vendor-sync.mjs [--from ../khora]           copy, and write vendor/eoreader7/NOTEBOOK-VENDOR.json (commit + sha256 of each file)
//   node vendor-sync.mjs --check [--from ../khora]   exit 1 if any vendored copy differs from the upstream file or from the recorded hash
//
// Only the files the Data notebook pane needs are listed here; the older vendored files are logged by hand in VENDORING.md.
import fs from "node:fs"; import path from "node:path"; import { createHash } from "node:crypto"; import { execFileSync } from "node:child_process";
export const FILES = ["native/kernel/sha256.js", "native/the-fold/surface/bench.mjs", "native/the-fold/surface/notebook.mjs", "native/the-fold/surface/notebook-store.mjs", "native/the-fold/surface/notebook-workspace.mjs"];
const here = path.dirname(new URL(import.meta.url).pathname), rec = path.join(here, "vendor/eoreader7/NOTEBOOK-VENDOR.json");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const a = process.argv.slice(2), from = path.resolve(here, a.includes("--from") ? a[a.indexOf("--from") + 1] : "../khora"), check = a.includes("--check");
let bad = 0; const out = {};
for (const f of FILES) {
  const dst = path.join(here, "vendor/eoreader7", f), src = path.join(from, f);
  if (check) {
    const want = fs.existsSync(rec) ? JSON.parse(fs.readFileSync(rec, "utf8")).files[f] || JSON.parse(fs.readFileSync(rec, 'utf8')).additionalFiles?.[f]?.sha256 : null, have = fs.existsSync(dst) ? sha(fs.readFileSync(dst)) : null;
    if (!have || have !== want) { console.log(`DRIFT   ${f}: vendored copy ${have ? "does not match the recorded hash" : "is missing"}`); bad++; continue; }
    if (fs.existsSync(src) && sha(fs.readFileSync(src)) !== have) { console.log(`BEHIND  ${f}: upstream (${from}) has changed since it was vendored`); bad++; continue; }
    console.log(`same    ${f}`);
  } else { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); out[f] = sha(fs.readFileSync(dst)); console.log(`copied  ${f}`); }
}
if (!check) {
  let commit = null; try { commit = execFileSync("git", ["-C", from, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
  let dirty = null; try { dirty = execFileSync("git", ["-C", from, "status", "--porcelain", "--", ...FILES], { encoding: "utf8" }).trim() || null; } catch {}
  fs.writeFileSync(rec, JSON.stringify({ repo: "scores-patch-points/khora", commit, uncommittedAtSync: dirty, at: new Date().toISOString(), files: out }, null, 1) + "\n");
}
process.exit(bad ? 1 : 0);
