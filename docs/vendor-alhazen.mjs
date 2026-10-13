#!/usr/bin/env node
// vendor-alhazen.mjs — vend the canonical optics pipeline (repo:
// scores-patch-points/Alhazen) into the fold BYTE-IDENTICAL, recorded.
// Alhazen is a single dependency-free UMD file (no import closure), so the
// vendoring seam is one file copied to the two places the fold loads it from.
//
//   node vendor-alhazen.mjs [--from ../Alhazen]           copy + write record
//   node vendor-alhazen.mjs --check [--from ../Alhazen]   exit 1 on drift
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const from = path.resolve(here, args.includes("--from") ? args[args.indexOf("--from") + 1] : "../Alhazen");
const check = args.includes("--check");
const sha = (b) => createHash("sha256").update(b).digest("hex");

const SRC = path.join(from, "alhazen.js");
const DEST = [
  path.join(here, "vendor/alhazen/alhazen.js"), // the pinned vendored copy
  path.join(here, "alhazen.js"),                // the copy index.html loads today
];
const REC = path.join(here, "vendor/alhazen/ALHAZEN-VENDOR.json");

const srcBytes = fs.existsSync(SRC) ? fs.readFileSync(SRC) : null;
if (!srcBytes) { console.error(`no canonical file at ${SRC}`); process.exit(1); }
const srcHash = sha(srcBytes);
let bad = 0;

if (check) {
  let want = null; try { want = JSON.parse(fs.readFileSync(REC, "utf8")).sha256; } catch {}
  for (const d of DEST) {
    const have = fs.existsSync(d) ? sha(fs.readFileSync(d)) : null;
    if (!have || have !== want) { console.log(`DRIFT ${path.relative(here, d)}: ${have || "missing"} != ${want}`); bad++; }
    else if (have !== srcHash) { console.log(`BEHIND ${path.relative(here, d)}: upstream changed since vendored`); bad++; }
  }
  console.log(bad ? `${bad} drift(s)` : "all copies same, at upstream");
  process.exit(bad ? 1 : 0);
}

for (const d of DEST) { fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, srcBytes); }
let commit = null, dirty = null;
try { commit = execFileSync("git", ["-C", from, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
try { dirty = execFileSync("git", ["-C", from, "status", "--porcelain", "--", "alhazen.js"], { encoding: "utf8" }).trim() || null; } catch {}
fs.writeFileSync(REC, JSON.stringify({ repo: "scores-patch-points/Alhazen", commit, uncommittedAtSync: dirty, at: new Date().toISOString(),
  vendored: "single UMD file, byte-identical", sha256: srcHash, copies: DEST.map((d) => path.relative(here, d)) }, null, 1) + "\n");
console.log(`vendored alhazen.js @ ${commit || "?"}${dirty ? " (uncommitted)" : ""} → ${DEST.map((d) => path.relative(here, d)).join(", ")}`);
