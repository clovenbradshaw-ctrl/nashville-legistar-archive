#!/usr/bin/env node
// vendor-chat.mjs — copy the chat app's runtime files (repo: the-fold) into
// vendor/fold-chat/ BYTE-IDENTICAL, from the sibling repo (or a given tree), and
// record where they came from. Never edit a file under vendor/ in place: change
// it in the-fold, push, then run this.
//
//   100% VENDORED. The set is not a hand-kept list: it is the full import closure
//   of the chat's own entry scripts in index.html, resolved relative to their own
//   files (fold-boot.js -> fold-chat.js -> … -> vendor/khora/…). If the chat gains
//   a module, re-running this carries it; --check fails if a vendored copy drifts.
//
//   node vendor-chat.mjs [--from ../the-fold]          copy + write vendor/fold-chat/CHAT-VENDOR.json
//   node vendor-chat.mjs --check [--from ../the-fold]  exit 1 if a vendored copy differs from the recorded hash or upstream
//
// The chat is a standalone ES-module app (scores-patch-points/the-fold); this is
// the seam that pins it into the fold.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const rec = path.join(here, "vendor/fold-chat/CHAT-VENDOR.json");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const args = process.argv.slice(2);
const from = path.resolve(here, args.includes("--from") ? args[args.indexOf("--from") + 1] : "../the-fold");
const check = args.includes("--check");

// ---- the closure: entry scripts in index.html, then every relative import ----
function resolveSpec(fromFile, spec) {
  if (!spec.startsWith(".")) return null;                 // bare specifier: not ours
  const p = path.resolve(path.dirname(fromFile), spec);
  for (const c of [p, p + ".js", p + ".mjs", p + ".json", p + ".css", path.join(p, "index.js")]) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}
function closure(root) {
  const seen = new Set();
  const scan = (file) => {
    if (seen.has(file) || !fs.existsSync(file)) return;
    seen.add(file);
    if (!/\.(js|mjs)$/.test(file)) return;
    const src = fs.readFileSync(file, "utf8");
    // static import/export ... from "spec"; side-effect import "spec"; dynamic import("spec")
    const re = /(?:import|export)\s*(?:[^'"]*?\bfrom\s*)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(src))) { const f = resolveSpec(file, m[1] || m[2]); if (f) scan(f); }
  };
  const htmlPath = path.join(root, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  scan(htmlPath); // the page itself is part of the vendored app
  for (const s of [...html.matchAll(/<script[^>]*src\s*=\s*["']([^"']+)["']/g)].map((x) => x[1])) if (!/^https?:/.test(s)) scan(path.join(root, s));
  for (const l of [...html.matchAll(/<link[^>]*href\s*=\s*["']([^"']+)["']/g)].map((x) => x[1])) if (!/^https?:/.test(l) && /\.css$/.test(l)) scan(path.join(root, l));
  return [...seen].map((f) => path.relative(root, f)).sort();
}

const FILES = closure(from);
let bad = 0;
const out = {};
for (const f of FILES) {
  const dst = path.join(here, "vendor/fold-chat", f);
  const src = path.join(from, f);
  if (check) {
    let want = null;
    try { want = JSON.parse(fs.readFileSync(rec, "utf8")).files[f] || null; } catch {}
    const have = fs.existsSync(dst) ? sha(fs.readFileSync(dst)) : null;
    if (!have || have !== want) { console.log(`DRIFT   ${f}: vendored copy ${have ? "does not match the recorded hash" : "is missing"}`); bad++; continue; }
    if (fs.existsSync(src) && sha(fs.readFileSync(src)) !== have) { console.log(`BEHIND  ${f}: upstream (${from}) changed since it was vendored`); bad++; continue; }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    out[f] = sha(fs.readFileSync(dst));
  }
}
if (check) { console.log(bad ? `${bad} file(s) drifted` : `all ${FILES.length} files same`); }
else {
  let commit = null;
  try { commit = execFileSync("git", ["-C", from, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
  let dirty = null;
  try { dirty = execFileSync("git", ["-C", from, "status", "--porcelain", "--", ...FILES], { encoding: "utf8" }).trim() || null; } catch {}
  fs.writeFileSync(rec, JSON.stringify({ repo: "scores-patch-points/the-fold", commit, uncommittedAtSync: dirty, at: new Date().toISOString(), vendored: "100% — the import closure of index.html's entry scripts", files: out }, null, 1) + "\n");
  console.log(`vendored ${FILES.length} file(s) from ${from} @ ${commit || "?"}`);
}
process.exit(bad ? 1 : 0);
