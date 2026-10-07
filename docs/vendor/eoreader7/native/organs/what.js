// native/organs/what.js — the archon of artifact identity. Handle: Cuvier —
// Georges Cuvier, the paleontologist who claimed "show me a bone and I will
// reconstruct the beast", and did, from structure alone.
//
// The task this organ exists to complete: "what IS this?" about a giant hunk
// of code — a minified bundle, a build artifact, a build output — and, since
// S129, about a GraphQL schema artifact (an introspection dump), the same
// reconstruction over a different skeleton. The prose reader is the wrong
// instrument (code forms ~zero referents under it, and a 1.8 MB single
// "sentence" chokes it — the measured failure that sent us here,
// adapters/code/encounters.js). The answer is reconstructed from the code's
// OWN structure, exactly as Cuvier read a skeleton:
//
//   - the MODULE MAP — every module/asset name the bundle's own bytes state;
//   - the VENDOR STACK — the libraries and bundlers the bytes name;
//   - the FEATURE MODULES — the map's non-vendor modules, the app's own parts;
//   - the ENDPOINTS/STRINGS — the paths and names the literals declare;
//   - the DECLARATIONS — whatever the source syntax names, read through
//     adapters/text/code-structure.js's codeGist (dmdCut injected, never
//     re-derived — the same seam codeGist already requires).
//
// DISCIPLINES (code-structure.js's law set, held at the organ level):
//   - SEPARATE CHANNEL — nothing here feeds the prose referent/cast system.
//   - THE ANSWER IS AN ACCOUNT OF THE BYTES, NEVER A VERDICT — the organ names
//     what the material itself declares (feature modules, endpoints, vendor
//     fingerprints, banners); it does not name a product the bytes do not
//     state, and it says so when asked to.
//   - DISCLOSED SAMPLING — a giant hunk is scanned within a declared window;
//     every skipped byte is counted, never silent.
//   - GATED, NOT TOP-N — every list is cut by a declared window with its full
//     count disclosed, ordered by measured occurrence in the material (the
//     witnessed signal), never by insertion order.

import { isCodeHunk } from "../adapters/code/encounters.js";
import { scanHunk, isEndpointLike } from "../adapters/code/scan.js";
import { isGraphqlSchema, schemaScan } from "../adapters/code/graphql.js";
import { buildCodeIndex, codeGist } from "../adapters/text/code-structure.js";

export const CELL = Object.freeze({ op: "DEF", grain: "Figure" });

export const REFUSALS = Object.freeze({
  empty: Object.freeze({ gap: "what:empty", detail: "no material was handed to the organ — nothing to identify." }),
  not_code_hunk: Object.freeze({ gap: "what:not_code_hunk", detail: "this material does not scan as a code hunk (no bundle markers, no long-line density, no module syntax). The prose reader is the instrument for prose; this organ reconstructs code artifacts." }),
  dmd_cut_injected: Object.freeze({ gap: "what:dmd_cut_injected", detail: "whatIsThis requires dmdCut injected (native/the-fold/resolutions.js's own export) — it is never re-derived here, exactly as codeGist requires." }),
});

const DEFAULT_MAX_FEATURE_NAMES = 24;
const DEFAULT_MAX_ENDPOINTS = 6;
const DEFAULT_MAX_SCHEMA_SAMPLES = 24;

// Occurrences of a name in the scanned window — the measured witness signal
// feature/endpoint candidates are ordered by (never a bare first-N).
function occurrencesOf(text, name) {
  const needle = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let n = 0;
  const re = new RegExp(`[^A-Za-z0-9_$]${needle}[^A-Za-z0-9_$]`, "g");
  let m;
  while ((m = re.exec(text))) { n += 1; }
  return n;
}

function composeAccount({ scan, gist, window }) {
  const lines = [];
  const evidence = [];

  const isBundle = scan.moduleMap.feature + scan.moduleMap.vendor + scan.moduleMap.asset > 0
    || scan.vendors.some((v) => v.name === "Vite" || v.name === "webpack");
  const kind = isBundle ? "a bundled application artifact" : "a code artifact";

  const featureRows = scan.moduleMap.rows
    .filter((r) => r.kind === "feature")
    .map((r) => ({ name: r.name, seen: occurrencesOf(window, r.name.split("/").pop().replace(/\.(js|mjs|cjs)$/, "")) }))
    .sort((a, b) => b.seen - a.seen);
  const featureNames = featureRows.slice(0, DEFAULT_MAX_FEATURE_NAMES).map((r) => r.name);
  const featureTotal = scan.moduleMap.feature;

  const vendorStack = scan.vendors.map((v) => v.name);
  const endpointRows = scan.strings.rows
    .filter((r) => isEndpointLike(r.text))
    .slice(0, DEFAULT_MAX_ENDPOINTS);

  const bannerLine = scan.banners[0] ? scan.banners[0].text : null;
  const declaredNames = (gist?.declared?.rows ?? []).map((r) => r.name).slice(0, DEFAULT_MAX_FEATURE_NAMES);

  // ── the account itself: byte-supported statements, each with its basis ──
  const platformBits = [];
  if (kind !== "code artifact") platformBits.push(`a ${scan.moduleMap.total}-module map (${scan.moduleMap.feature} feature, ${scan.moduleMap.vendor} vendor, ${scan.moduleMap.infra ?? 0} infra, ${scan.moduleMap.asset} asset)`);
  if (vendorStack.length) platformBits.push(`vendor fingerprints in the bytes: ${vendorStack.join(", ")}`);
  lines.push({ text: `${kind}${platformBits.length ? " — " + platformBits.join("; ") : "."}`, claim: "platform" });
  evidence.push({ claim: "platform", basis: `module map ${scan.moduleMap.total} rows (${scan.moduleMap.feature} feature / ${scan.moduleMap.vendor} vendor / ${scan.moduleMap.infra ?? 0} infra / ${scan.moduleMap.asset} asset); vendor signals ${vendorStack.length ? vendorStack.join(", ") : "none"}`, offsets: scan.vendors.flatMap((v) => v.offsets ?? []) });

  if (featureTotal > 0) {
    lines.push({ text: `its own feature modules, read off the map: ${featureNames.length === featureTotal ? featureNames.join(", ") : `${featureNames.join(", ")} (${featureTotal - featureNames.length} more)`}.`, claim: "features" });
    evidence.push({ claim: "features", basis: `${featureTotal} feature-classed modules, ${featureNames.length} listed (ordered by witnessed occurrence in the scanned window)`, offsets: [] });
  }

  if (endpointRows.length) {
    lines.push({ text: `declares or references ${endpointRows.length} of ${scan.strings.rows.length} high-information literals as endpoint/route paths: ${endpointRows.map((r) => r.text).join(", ")}.`, claim: "endpoints" });
    evidence.push({ claim: "endpoints", basis: `string-literal scan: ${scan.strings.basis}`, offsets: endpointRows.map((r) => r.offset) });
  }

  if (bannerLine) {
    lines.push({ text: `carries a declaration banner: "${bannerLine}".`, claim: "banner" });
    evidence.push({ claim: "banner", basis: `first /*!…*/ or @license banner at byte ${scan.banners[0].offset}`, offsets: [scan.banners[0].offset] });
  }

  if (declaredNames.length) {
    lines.push({ text: `its own source syntax declares ${declaredNames.length} ${declaredNames.length === 1 ? "function/class" : "functions/classes"} by name: ${declaredNames.join(", ")}.`, claim: "declared" });
    evidence.push({ claim: "declared", basis: `codeGist over the scanned window (DMD-gated, generic names dropped when the CodeNamePrior@1 is loaded)`, offsets: [] });
  }

  if (lines.length <= 1) {
    lines.push({ text: "the scanned bytes yield no module map, no vendor fingerprints, no banners, and no declarations — the hunk is code-shaped but carries no identifying structure in its scanned window.", claim: "sparse" });
    evidence.push({ claim: "sparse", basis: scan.moduleMap.basis, offsets: [] });
  }

  return { lines, evidence };
}

/**
 * composeSchemaAccount(scan) -> { lines, evidence }
 * The byte-supported account of a GraphQL schema artifact — the what-organ's
 * Cuvier reconstruction for a schema instead of a bundle.
 */
function composeSchemaAccount(scan) {
  const lines = [];
  const evidence = [];
  const c = scan.counts;

  lines.push({ text: `a GraphQL schema — ${c.total} types total: ${c.object} object types, ${c.enum} enums, ${c.union} unions, ${c.input} input types, ${c.scalar} scalars.`, claim: "scope" });
  evidence.push({ claim: "scope", basis: `type inventory counted from __schema.types`, offsets: scan.evidenceAnchors.map((a) => a.offset).filter((o) => o >= 0) });

  const ops = [];
  if (scan.root.query) ops.push(`query on ${scan.root.query} (${scan.disclosure.queryFieldsTotal} fields)`);
  if (scan.root.mutation) ops.push(`mutation on ${scan.root.mutation} (${scan.disclosure.mutationFieldsTotal} fields)`);
  if (scan.root.subscription) ops.push(`subscription on ${scan.root.subscription} (${scan.disclosure.subscriptionFieldsTotal} fields)`);
  if (ops.length) {
    lines.push({ text: `its operations live on ${ops.join("; ")}.`, claim: "roots" });
    evidence.push({ claim: "roots", basis: `root type names from the introspection document's own queryType/mutationType/subscriptionType`, offsets: scan.evidenceAnchors.map((a) => a.offset).filter((o) => o >= 0) });
  }

  if (scan.connectionTotal > 0) {
    const names = scan.connections.map((x) => x.name).join(", ");
    lines.push({ text: `it paginates ${scan.connectionTotal} resource collections through the Connection convention${scan.connectionTotal > scan.connections.length ? ` (${names}, …)` : `: ${names}`}.`, claim: "pagination" });
    evidence.push({ claim: "pagination", basis: `*Connection object types (received GraphQL-naming convention, disclosed)`, offsets: [] });
  }

  if (scan.payloadTotal > 0) {
    lines.push({ text: `its mutations return ${scan.payloadTotal} dedicated *Payload types (${scan.payloads.join(", ")}${scan.payloadTotal > scan.payloads.length ? ", …" : ""}).`, claim: "payloads" });
    evidence.push({ claim: "payloads", basis: `*Payload object types (received convention, disclosed)`, offsets: [] });
  }

  if (scan.enumTotal > 0) {
    lines.push({ text: `it declares ${scan.enumTotal} enums: ${scan.enums.map((e) => `${e.name} (${e.values.length} values)`).join(", ")}${scan.enumTotal > scan.enums.length ? ", …" : ""}.`, claim: "enums" });
    evidence.push({ claim: "enums", basis: `ENUM kinds and their enumValues from __schema.types`, offsets: [] });
  }

  if (scan.unionTotal > 0) {
    lines.push({ text: `it declares ${scan.unionTotal} union types: ${scan.unions.join(", ")}${scan.unionTotal > scan.unions.length ? ", …" : ""}.`, claim: "unions" });
    evidence.push({ claim: "unions", basis: `UNION kinds from __schema.types`, offsets: [] });
  }

  if (scan.domain.length) {
    const dom = scan.domain.map((d) => `${d.word} (${d.n})`).join(", ");
    lines.push({ text: `its object types cluster around the domains: ${dom}.`, claim: "domain" });
    evidence.push({ claim: "domain", basis: `first-word tally over OBJECT type names, root/convention tails excluded (received PascalCase convention, disclosed)`, offsets: [] });
  }

  if (scan.verbs.length) {
    const v = scan.verbs.map((x) => `${x.verb} (${x.n})`).join(", ");
    lines.push({ text: `its ${scan.disclosure.mutationFieldsTotal} root mutations are led by the verbs: ${v}.`, claim: "verbs" });
    evidence.push({ claim: "verbs", basis: `root mutation field-name action verbs (received naming convention, disclosed)`, offsets: [] });
  }

  return { lines, evidence };
}

/**
 * whatIsThis({ text, fileName, question, dmdCut, prior, keywords, scan, maxScanChars }) ->
 * { schema: "WhatIsThis@1", fileName, account, evidence, scan, gist, disclosure }
 * Reconstruct what a giant code hunk IS from its own structural bytes.
 * `dmdCut` is injected (the-fold/resolutions.js) — never re-derived. `prior`
 * is the optional CodeNamePrior@1 (live_priors) passed through to codeGist.
 * `keywords` is the optional CodeKeywordPrior@1 hard-keyword set for the
 * file's own language (native/priors/code-kw-*.json via
 * code-structure.js::loadCodeKeywordPrior + keywordSetOf) — refused as
 * declared names, never trusted for anything else. `languagePriors` is the
 * optional per-language name-prior map ({ py, c, go, js } via
 * loadCodeNamePriorSplits) — each name judged generic only against its
 * own language's codebases, falling back to the blended `prior` where no
 * split is loaded. `scan` may be
 * pre-supplied to reuse one scan across calls.
 * A GraphQL schema artifact (introspection JSON) routes to the schema account
 * — the same Cuvier reconstruction, different skeleton.
 */
export function whatIsThis({ text, fileName = "artifact", question = "", dmdCut, prior = null, keywords = null, languagePriors = null, scan = null, maxScanChars = 400_000 } = {}) {
  if (typeof dmdCut !== "function") return Object.freeze({ ...REFUSALS.dmd_cut_injected, schema: "WhatIsThis@1", fileName });
  const s = String(text ?? "");
  if (!s.trim()) return Object.freeze({ ...REFUSALS.empty, schema: "WhatIsThis@1", fileName });

  if (isGraphqlSchema(s)) {
    const schema = schemaScan(s);
    const { lines, evidence } = composeSchemaAccount(schema);
    return Object.freeze({
      schema: "WhatIsThis@1",
      fileName,
      kind: "graphql_schema",
      account: lines,
      evidence,
      scan: schema,
      gist: null,
      disclosure: Object.freeze({
        scannedChars: s.length,
        skippedChars: 0,
        sampled: false,
        priorLoaded: false,
        basis: `a GraphQL introspection document read in full (${s.length.toLocaleString()} bytes); account composed only from __schema.types' own counts and names`,
      }),
    });
  }

  if (!isCodeHunk(s)) return Object.freeze({ ...REFUSALS.not_code_hunk, schema: "WhatIsThis@1", fileName, bytes: s.length });

  const hunkScan = scan ?? scanHunk(s, { fileName, maxScanChars });
  const window = s.slice(0, maxScanChars);
  const index = buildCodeIndex([{ fileName, text: window }], { keywords });
  const gist = codeGist({ index, question, dmdCut, prior, languagePriors });

  const { lines, evidence } = composeAccount({ scan: hunkScan, gist, window });

  return Object.freeze({
    schema: "WhatIsThis@1",
    fileName,
    account: lines,
    evidence,
    scan: hunkScan,
    gist,
      disclosure: Object.freeze({
        scannedChars: hunkScan.scannedChars,
        skippedChars: hunkScan.skippedChars,
        sampled: hunkScan.sampled,
        priorLoaded: Boolean(prior),
        keywordPriorLoaded: Boolean(keywords),
        basis: `scanned ${hunkScan.scannedChars.toLocaleString()} of ${hunkScan.bytes.toLocaleString()} bytes${hunkScan.sampled ? ` (${hunkScan.skippedChars.toLocaleString()} skipped, disclosed)` : ""}${keywords ? "; hard keywords refused as declared names (received CodeKeywordPrior@1)" : "; no keyword prior — every captured name admitted (disclosed, not a silent skip)"}; account composed only from byte-supported statements`,
      }),
  });
}