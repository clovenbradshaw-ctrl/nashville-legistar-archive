#!/usr/bin/env node
// tools/vendor-matrix-sdk.mjs — build the SAME-ORIGIN Matrix library bundle the
// Share panel loads, and record exactly what is in it.
//
// Why a bundle and not a CDN: this is the code that holds the encryption keys.
// A CDN that can serve it can serve a copy that sends the keys away. So it is
// built once, here, from pinned inputs, hashed, and served from wherever the page
// is served from.
//
//   node tools/vendor-matrix-sdk.mjs [--toolchain ../eodb]   build vendor/matrix-sdk/
//   node tools/vendor-matrix-sdk.mjs --check                 exit 1 if the built files differ from the recorded hashes
//
// --toolchain is a directory whose node_modules holds vite, vite-plugin-wasm,
// vite-plugin-top-level-await and matrix-js-sdk (eodb's, by default). Nothing is
// installed by this script and nothing is fetched.
//
// Output (vendor/matrix-sdk/): matrix-sdk.js, its .wasm, and MATRIX-SDK-VENDOR.json
// (versions, the hashes of every output, the hash of the vendored media.js, the
// shims used). The built files are NOT committed by default (≈7 MB with the
// crypto wasm) — the recipe and the record are; see docs/MATRIX-INVITES.md §9.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "vendor/matrix-sdk");
const recPath = path.join(outDir, "MATRIX-SDK-VENDOR.json");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const args = process.argv.slice(2);
const toolchain = path.resolve(root, args.includes("--toolchain") ? args[args.indexOf("--toolchain") + 1] : "../eodb");

const listFiles = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? listFiles(path.join(d, e.name)) : [path.join(d, e.name)]);
const outputs = () => (fs.existsSync(outDir) ? listFiles(outDir) : []).filter((f) => !f.endsWith("MATRIX-SDK-VENDOR.json") && !f.includes("/.build"));

if (args.includes("--check")) {
  if (!fs.existsSync(recPath)) { console.log("MISSING no record — run the build first"); process.exit(1); }
  const rec = JSON.parse(fs.readFileSync(recPath, "utf8"));
  let bad = 0;
  for (const [rel, want] of Object.entries(rec.outputs)) {
    const p = path.join(outDir, rel);
    const have = fs.existsSync(p) ? sha(fs.readFileSync(p)) : null;
    if (have !== want) { console.log(`DRIFT   ${rel}: ${have ? "hash differs from the record" : "missing"}`); bad++; } else console.log(`same    ${rel}`);
  }
  const media = path.join(root, "vendor/eodb/src/media.js");
  if (rec.inputs && rec.inputs["vendor/eodb/src/media.js"] && sha(fs.readFileSync(media)) !== rec.inputs["vendor/eodb/src/media.js"]) { console.log("DRIFT   vendor/eodb/src/media.js differs from what the bundle was built from"); bad++; }
  process.exit(bad ? 1 : 0);
}

const req = createRequire(path.join(toolchain, "package.json"));
const need = (name) => { try { return req.resolve(name); } catch { console.error(`toolchain ${toolchain} has no ${name}; pass --toolchain <dir with node_modules>`); process.exit(2); } };
const viteEntry = need("vite");
const { build } = await import(pathToFileURL(viteEntry).href);
const wasmPlugin = (await import(pathToFileURL(need("vite-plugin-wasm")).href)).default;
const tlaPlugin = (await import(pathToFileURL(need("vite-plugin-top-level-await")).href)).default;
// package.json is not always an exported subpath, so walk up from the resolved entry to the package's own
const pkgVersion = (name) => {
  let d = path.dirname(need(name));
  for (let i = 0; i < 8; i++, d = path.dirname(d)) {
    const p = path.join(d, "package.json");
    if (fs.existsSync(p)) { const j = JSON.parse(fs.readFileSync(p, "utf8")); if (j.name === name) return j.version; }
  }
  return "unknown";
};

const shims = path.join(root, "tools/matrix-sdk-shims");
const entry = path.join(root, "tools/matrix-sdk-entry.js");
const media = path.join(root, "vendor/eodb/src/media.js");
if (!fs.existsSync(media)) { console.error("vendor/eodb/src/media.js is missing — run node vendor-eodb.mjs first"); process.exit(2); }

fs.rmSync(outDir, { recursive: true, force: true });
await build({
  root,
  configFile: false,
  logLevel: "warn",
  resolve: {
    // the toolchain's matrix-js-sdk, and the two names the vendored media.js imports, to inert shims
    alias: [
      { find: /^matrix-js-sdk(\/.*)?$/, replacement: path.join(toolchain, "node_modules/matrix-js-sdk") + "$1" },
    ],
  },
  plugins: [
    // only the VENDORED media.js's two relative imports are redirected; the SDK's own ./client.js is untouched
    { name: "holodeck-eodb-shims", enforce: "pre", resolveId(source, importer) {
        if (importer && importer.replace(/\\/g, "/").endsWith("vendor/eodb/src/media.js")) {
          if (source === "./client.js") return path.join(shims, "client.js");
          if (source === "./vault.js") return path.join(shims, "vault.js");
        }
        return null;
    } },
    wasmPlugin(), tlaPlugin(),
  ],
  build: {
    target: "esnext",
    outDir,
    emptyOutDir: true,
    minify: true,
    sourcemap: false,
    lib: { entry, formats: ["es"], fileName: () => "matrix-sdk.js" },
    rollupOptions: { output: { assetFileNames: "assets/[name]-[hash][extname]", inlineDynamicImports: true } },
  },
  server: { fs: { allow: [root, toolchain] } },
});

const outs = {};
for (const f of outputs()) outs[path.relative(outDir, f)] = sha(fs.readFileSync(f));
fs.writeFileSync(recPath, JSON.stringify({
  built: new Date().toISOString(),
  toolchain: { vite: pkgVersion("vite"), wasmPlugin: pkgVersion("vite-plugin-wasm"), topLevelAwait: pkgVersion("vite-plugin-top-level-await") },
  matrixJsSdk: pkgVersion("matrix-js-sdk"),
  cryptoWasm: pkgVersion("@matrix-org/matrix-sdk-crypto-wasm"),
  inputs: { "vendor/eodb/src/media.js": sha(fs.readFileSync(media)), "tools/matrix-sdk-entry.js": sha(fs.readFileSync(entry)) },
  shims: ["tools/matrix-sdk-shims/client.js", "tools/matrix-sdk-shims/vault.js"],
  note: "eodb's media.js is bundled with ./client.js and ./vault.js resolved to inert shims; eodb's client.js (global IDBFactory patch, password vault) is not in this bundle.",
  outputs: outs,
}, null, 1) + "\n");
console.log("built", Object.keys(outs).map((k) => `${k} ${(fs.statSync(path.join(outDir, k)).size / 1024).toFixed(0)}KB`).join(", "));
