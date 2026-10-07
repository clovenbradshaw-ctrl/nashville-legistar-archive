#!/usr/bin/env node
// vendor-chat.mjs — copy the chat app's runtime files (repo: the-fold) into
// vendor/fold-chat/ BYTE-IDENTICAL, from the sibling repo, and record where
// they came from. Never edit a file under vendor/ in place: change it in
// the-fold, push, then run this.
//
//   node vendor-chat.mjs [--from ../the-fold]          copy + write vendor/fold-chat/CHAT-VENDOR.json
//   node vendor-chat.mjs --check [--from ../the-fold]  exit 1 if a vendored copy differs from the recorded hash or from upstream
//
// Same discipline as vendor-sync.mjs (the khora notebook pane): the chat
// app is a standalone repo (scores-patch-points/the-fold); this is the
// seam that pins it into the fold. It routes every inference through heimdall,
// so vendoring the UI does not vendor any model or key.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Every runtime file fold-chat.js imports, plus the page itself. The app is
// plain ES modules with no build step, so the vendored copy must carry the whole
// import graph or it breaks at load: the client wire, the grounding record, the
// discourse classifier, memory, web search, artifacts, the conversation fold
// (vendor/the-fold/fold.js), and index.html. Paths are relative and authored to
// match the app's own layout.
export const FILES = [
  "fold-chat.js",
  "fold-chat-client.js",
  "fold-chat-artifacts.js",
  "fold-chat-ground.js",
  "fold-chat-web.js",
  "fold-chat-memory.js",
  "fold-chat-discourse.js",
  "vendor/the-fold/fold.js",
  "index.html",
];
const here = path.dirname(new URL(import.meta.url).pathname);
const rec = path.join(here, "vendor/fold-chat/CHAT-VENDOR.json");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const args = process.argv.slice(2);
const from = path.resolve(here, args.includes("--from") ? args[args.indexOf("--from") + 1] : "../the-fold");
const check = args.includes("--check");
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
    console.log(`same    ${f}`);
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    out[f] = sha(fs.readFileSync(dst));
    console.log(`copied  ${f}`);
  }
}
if (!check) {
  let commit = null;
  try { commit = execFileSync("git", ["-C", from, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
  let dirty = null;
  try { dirty = execFileSync("git", ["-C", from, "status", "--porcelain", "--", ...FILES], { encoding: "utf8" }).trim() || null; } catch {}
  fs.writeFileSync(rec, JSON.stringify({ repo: "scores-patch-points/the-fold", commit, uncommittedAtSync: dirty, at: new Date().toISOString(), routesInferenceThrough: "heimdall bridge (localhost:8790)", files: out }, null, 1) + "\n");
}
process.exit(bad ? 1 : 0);