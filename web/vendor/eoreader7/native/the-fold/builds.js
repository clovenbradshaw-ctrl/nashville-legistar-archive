// builds.js — a build is a projection of an append-only log.
//
// The model does not "make code" and hand it over; it APPENDS an addendum to a
// build's log, and the code file on disk is PROJECTED from that log the way a
// working tree is checked out from git history. The log is the record; the
// file is a view of it. Every deposit, revision, editor save, reset, and run
// is one line in `record/builds/<slug>.jsonl` — never rewritten, never
// truncated — and each code-bearing addendum re-projects the file into
// `materials/<slug>.<hash8>.<ext>`, content-addressed, so every revision is a
// new file and every old one stays on disk like a git object.
//
// Pure and browser-safe (the same posture as skills.js): no DOM, no IO. The
// hashing is Web Crypto, so a test and a browser and the server all agree.
// The I/O half lives in serve.mjs, which owns the record.

// The verbs, each one a kind of addendum the model or the operator can append.
export const BUILD_KINDS = Object.freeze({
  DEPOSIT: "deposit",   // the model first produced this code (seed of the log)
  REVISION: "revision", // the model produced new code for an existing build
  EDIT: "edit",         // the operator edited the projection in the build editor
  RESET: "reset",       // the projection returns to the deposit (the model's original)
  RUN: "run",           // the projection was executed; the outcome is the addendum
});

/** The kinds whose addendum carries code — the ones that move the projection. */
export const CODE_KINDS = Object.freeze([
  BUILD_KINDS.DEPOSIT,
  BUILD_KINDS.REVISION,
  BUILD_KINDS.EDIT,
  BUILD_KINDS.RESET,
]);

/** The one writer who may append an addendum — never a free string. */
export const BUILD_AUTHORS = Object.freeze(["model", "me"]);

export const BUILD_MESSAGE_MAX = 200;

export function createBuildLog() {
  return Object.freeze({ entries: Object.freeze([]), nextSeq: 0 });
}

/**
 * The canonical payload an addendum's hash is computed over. The server adds
 * `at` and the fold adds `seq/prev/hash/added/removed`; the hash must survive
 * a re-append from the record line alone, so it covers exactly the fields a
 * re-append would supply.
 */
function canon(entry) {
  return JSON.stringify({
    kind: entry.kind,
    message: entry.message ?? "",
    code: typeof entry.code === "string" ? entry.code : "",
    author: entry.author ?? "",
    lang: entry.lang ?? "",
    run: entry.run ?? null,
    prev: entry.prev ?? null,
  });
}

/** Content address of an addendum — Web Crypto, browser and Node alike. */
export async function buildHash(entry) {
  const bytes = new TextEncoder().encode(canon(entry));
  const buf = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Git-style "+a/−b" line counts between two projections (multiset difference). */
export function lineDiff(a, b) {
  const lines = (s) => {
    const t = String(s ?? "");
    if (!t) return [];
    return t.replace(/\n$/, "").split("\n");
  };
  const A = lines(a);
  const B = lines(b);
  const count = (arr) => {
    const m = new Map();
    for (const l of arr) m.set(l, (m.get(l) ?? 0) + 1);
    return m;
  };
  const ca = count(A);
  const cb = count(B);
  let added = 0;
  let removed = 0;
  for (const [l, n] of cb) added += Math.max(0, n - (ca.get(l) ?? 0));
  for (const [l, n] of ca) removed += Math.max(0, n - (cb.get(l) ?? 0));
  return { added, removed };
}

/**
 * Append one sealed addendum. Returns the new log; the caller's log is never
 * touched (append-only is the discipline, and a frozen log is the proof).
 */
export async function appendBuild(log, entry) {
  if (!entry || typeof entry !== "object") throw new TypeError("appendBuild requires an entry object");
  if (!Object.values(BUILD_KINDS).includes(entry.kind))
    throw new TypeError(`appendBuild: unknown kind ${JSON.stringify(entry.kind)}`);
  if (typeof entry.message !== "string") throw new TypeError("appendBuild: every addendum carries a message string");
  if (!BUILD_AUTHORS.includes(entry.author)) throw new TypeError(`appendBuild: author must be one of ${BUILD_AUTHORS.join(", ")}`);
  if (CODE_KINDS.includes(entry.kind) && typeof entry.code !== "string")
    throw new TypeError(`appendBuild: ${entry.kind} must carry code`);
  if (entry.kind === BUILD_KINDS.RUN && (!entry.run || typeof entry.run !== "object"))
    throw new TypeError("appendBuild: run must carry its outcome");

  const prev = log.entries.length ? log.entries[log.entries.length - 1].seq : null;
  const seeded = { kind: entry.kind, message: entry.message, author: entry.author, prev };
  if (typeof entry.code === "string") seeded.code = entry.code;
  if (entry.lang) seeded.lang = entry.lang;
  if (entry.run) seeded.run = entry.run;
  if (entry.at) seeded.at = entry.at;

  const hash = await buildHash(seeded);
  const diff = CODE_KINDS.includes(entry.kind) ? lineDiff(projectCode(log), entry.code) : null;
  const sealed = Object.freeze({ ...seeded, seq: log.nextSeq, hash, ...(diff ? { added: diff.added, removed: diff.removed } : {}) });
  return Object.freeze({ entries: Object.freeze([...log.entries, sealed]), nextSeq: log.nextSeq + 1 });
}

/** The current projection: the code of the last code-bearing addendum. */
export function projectCode(log) {
  for (let i = log.entries.length - 1; i >= 0; i--) {
    if (typeof log.entries[i].code === "string") return log.entries[i].code;
  }
  return null;
}

const EXT_FOR = {
  python: "py",
  javascript: "js",
  js: "js",
  node: "js",
  shell: "sh",
  bash: "sh",
  html: "html",
  svg: "svg",
};

/** The projection's extension, from the code fence's language tag. */
export function extFor(lang) {
  return EXT_FOR[String(lang ?? "").toLowerCase()] ?? "txt";
}

/** A name from outside carries no guarantees — a slug is a route, not a label. */
export function slugify(name) {
  const slug = String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "build";
}

/** The content-addressed projection file for one addendum, e.g. countdown.3f2a1c9d.py */
export function fileFor(slug, hash, lang) {
  return `${slug}.${String(hash ?? "").slice(0, 8)}.${extFor(lang)}`;
}

/**
 * The mechanical anchor that routes new model code onto an existing build:
 * "revision to build 3" means the addendum extends build 3's log, not a new
 * one. Numbers only — nothing the model could phrase as intent is trusted;
 * the number IS the reference. "fold 3" is the same address in the panel's
 * visible vocabulary (builds are Folds in every rendered word), so both
 * spellings resolve.
 */
export function referencedBuild(text) {
  const m = String(text ?? "").match(/\b(?:build|fold)\s+#?(\d+)\b/i);
  return m ? { n: Number(m[1]) } : null;
}

/** The addendum's message, taken mechanically from the model's own prose. */
export function captureMessage(prose) {
  const first = String(prose ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l);
  if (!first) return "";
  const flat = first.replace(/\s+/g, " ");
  return flat.length > BUILD_MESSAGE_MAX ? `${flat.slice(0, BUILD_MESSAGE_MAX - 1)}…` : flat;
}

/** What a build's caption and chat handle say, counted off the log. */
export function describeBuild(log) {
  const last = log.entries.length ? log.entries[log.entries.length - 1] : null;
  let lastRun = null;
  for (let i = log.entries.length - 1; i >= 0; i--) {
    if (log.entries[i].kind === BUILD_KINDS.RUN) {
      lastRun = { ok: log.entries[i].run?.ok === true, at: log.entries[i].at ?? null };
      break;
    }
  }
  return { addenda: log.entries.length, head: last?.hash ?? null, lastRun };
}
