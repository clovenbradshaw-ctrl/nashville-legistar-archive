#!/usr/bin/env node
// tools/vendor-er7.mjs — REFRESH THE KHORA'S VENDOR COPY, DETERMINISTICALLY.
//
// The fold (surface) runs the khora's organs in the browser. Those organs are
// VENDORED into vendor/eoreader7 so the page has no build step. Until now they
// were hand-copied per organ (the composed reader, for-whom, dmd landed by
// hand — the reinvention this script ends).
//
// THE RULE THIS SCRIPT ENFORCES: the khora (eoreader7) is the ONLY place an
// organ is defined; vendor/eoreader7 is a FROZEN COPY refreshed by this
// command, never edited by hand and never the source of a change. A browser
// port that needs a tweak puts it in the fold's own files (holodeck-*.js), or
// guards the khora organ — never edits the vendor copy directly.
//
// WHAT IS COPIED: the curated subset the page actually uses —
//   native/{organs,adapters,kernel,the-fold,priors}
// (only .js/.mjs/.json; nothing else — no tests, no eval, no docs).
//
// WHAT IS SKIPPED, TYPED: a file that imports a `node:` builtin cannot run in
// the browser. It is skipped and recorded in vendor-skips.json with the
// offending import, never silently dropped and never copied broken. The
// surface then KNOWS the organ is unported.
//
//   node tools/vendor-er7.mjs [--dry] [--src /path/eoreader7]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FOLD = path.resolve(HERE, "..");
const SRC = process.argv.includes("--src")
  ? process.argv[process.argv.indexOf("--src") + 1]
  : "/Users/mlacy/Documents/3.0/khora";
const DEST = path.join(FOLD, "vendor", "eoreader7");
const DRY = process.argv.includes("--dry");

const SUBSETS = ["organs", "adapters", "kernel", "the-fold", "priors", "interpretation"];
const NODE_IMPORT = /\bfrom\s+["']node:|import\s+["']node:|require\(["']node:/;
const SKIP_EXT = /\.(test|falsify)\.(js|mjs)$/;
// A node-only module whose ONLY importers defer it behind an isNode guard is
// safe to vendor: the browser never resolves it (its importers' static graph
// never includes it), and the port stays loadable under Node. Everything else
// with a node import is a NAMED unported gap.
const NODE_SAFE_ALLOW = new Set(["the-fold/canon-ground.mjs"]);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const a = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(a));
    else if (/\.(js|mjs|json)$/i.test(e.name) && !SKIP_EXT.test(e.name)) out.push(a);
  }
  return out;
}

let copied = 0, skipped = 0;
const skips = [];
const skipDir = path.join(DEST, "native");
fs.mkdirSync(skipDir, { recursive: true });

for (const subset of SUBSETS) {
  const srcDir = path.join(SRC, "native", subset);
  if (!fs.existsSync(srcDir)) continue;
  const files = walk(srcDir);
  for (const f of files) {
    const rel = path.relative(path.join(SRC, "native"), f);
    const dest = path.join(DEST, "native", rel);
    if (DRY) { copied++; continue; }
    const src = fs.readFileSync(f, "utf8");
    const nodeImp = NODE_IMPORT.exec(src);
    if (nodeImp && !NODE_SAFE_ALLOW.has(rel)) { skipped++; skips.push({ rel, import: nodeImp[0].trim(), why: "node builtin — cannot run in the browser until guarded" }); continue; }
    if (nodeImp && NODE_SAFE_ALLOW.has(rel)) { skipped++; skips.push({ rel, import: nodeImp[0].trim(), why: "node builtin, but ALL importers defer it behind an isNode guard — ported, browser never resolves it" }); }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f, dest);
    copied++;
  }
}

fs.writeFileSync(path.join(DEST, "vendor-skips.json"), JSON.stringify({ at: new Date().toISOString(), src: SRC, copied, skipped, skips }, null, 2));
console.log(`vendor refresh — ${DRY ? "(dry)" : ""}`);
console.log(`  src   ${SRC}`);
console.log(`  dest  ${DEST}`);
console.log(`  copied ${copied} files`);
console.log(`  skipped ${skipped} node-only file(s):`);
for (const s of skips) console.log(`    - ${s.rel}  (${s.import})`);
console.log(`\n  vendor-skips.json written — a skipped organ is a NAMED unported gap, never a silent drop.`);