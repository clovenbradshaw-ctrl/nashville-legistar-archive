#!/usr/bin/env node
// vendor-eodb.mjs — copy the one eodb module this feature reuses into vendor/eodb/
// BYTE-IDENTICAL from the sibling checkout, and record where it came from. Never
// edit a file under vendor/ in place: change it in eodb, then run this.
//
//   node vendor-eodb.mjs [--from ../eodb]          copy + write vendor/eodb/EODB-VENDOR.json
//   node vendor-eodb.mjs --check [--from ../eodb]  exit 1 if the vendored copy drifted from the recorded hash or from upstream
//
// What is reused and why: src/media.js — the encrypted-attachment envelope
// (AES-CTR, a fresh key per blob, SHA-256 of the ciphertext, `__media: 2`
// reference). What is NOT reused: src/client.js (it patches the global IDBFactory
// at import time and assumes a password-vault session; the Holodeck holds a
// token session). media.js imports ./client.js and ./vault.js, so the bundle
// build (tools/vendor-matrix-sdk.mjs) resolves those two names to inert shims at
// BUILD time — the vendored bytes are never touched.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const here = path.dirname(new URL(import.meta.url).pathname);
const rec = path.join(here, "vendor/eodb/EODB-VENDOR.json");
const FILES = ["src/media.js"];
const sha = (b) => createHash("sha256").update(b).digest("hex");
const args = process.argv.slice(2);
const from = path.resolve(here, args.includes("--from") ? args[args.indexOf("--from") + 1] : "../eodb");
const check = args.includes("--check");
let bad = 0;
const out = {};

for (const f of FILES) {
  const src = path.join(from, f), dst = path.join(here, "vendor/eodb", f);
  if (check) {
    const recorded = fs.existsSync(rec) ? JSON.parse(fs.readFileSync(rec, "utf8")).files[f] : null;
    const have = fs.existsSync(dst) ? sha(fs.readFileSync(dst)) : null;
    if (!have || have !== recorded) { console.log(`DRIFT   ${f}: vendored copy ${have ? "does not match the recorded hash" : "is missing"}`); bad++; continue; }
    if (fs.existsSync(src) && sha(fs.readFileSync(src)) !== have) { console.log(`BEHIND  ${f}: upstream (${from}) has changed since it was vendored`); bad++; continue; }
    console.log(`same    ${f}`);
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    out[f] = sha(fs.readFileSync(dst));
    console.log(`copied  ${f}`);
  }
}
if (!check) {
  let commit = null, dirty = null;
  try { commit = execFileSync("git", ["-C", from, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not a checkout */ }
  try { dirty = execFileSync("git", ["-C", from, "status", "--porcelain", "--", ...FILES], { encoding: "utf8" }).trim() || null; } catch { /* not a checkout */ }
  fs.writeFileSync(rec, JSON.stringify({ repo: "eodb", commit, uncommittedAtSync: dirty, at: new Date().toISOString(), files: out }, null, 1) + "\n");
}
process.exit(bad ? 1 : 0);
