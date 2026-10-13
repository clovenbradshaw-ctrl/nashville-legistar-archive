// fold-chat-workspace.js — the agent's project: files, edits, diffs, checkpoints.
//
// An agent that builds an app or edits a codebase works on a WORKSPACE — a set
// of files it can write, edit, rename and delete, with every change recorded so
// it can be shown as a diff, undone, and exported. This module is that and
// nothing else. It is pure (no DOM, no network, no clock) so the whole thing is
// testable in node; the surface supplies the file tree, the diff view and the
// live preview, and the loop (fold-chat-builder.js) supplies the work.
//
// Edits come from a model as TEXT, so the parser is strict about what counts as
// an edit and loud about what does not: a SEARCH/REPLACE block whose SEARCH text
// is not found (or not unique) is reported, never guessed at.

export const MAX_FILE_BYTES = 400_000;
export const MAX_FILES = 400;

const norm = (p) => String(p ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
/** A safe relative path, or null. No traversal, no absolute paths, no hidden dirs we refuse to write. */
export function safePath(p) {
  const n = norm(p);
  if (!n || n.length > 200) return null;
  if (n.split("/").some((seg) => seg === ".." || seg === "." || seg === "")) return null;
  if (/^(\.git|node_modules)(\/|$)/.test(n)) return null;
  if (/[\u0000-\u001f<>:"|?*]/.test(n)) return null;
  return n;
}

/** A workspace: { files: {path: content}, log: [ops], checkpoints: [{label, files}] }. */
export function createWorkspace(files = {}) {
  const ws = { files: {}, log: [], checkpoints: [] };
  for (const [p, c] of Object.entries(files)) { const sp = safePath(p); if (sp) ws.files[sp] = String(c); }
  return ws;
}

export const paths = (ws) => Object.keys(ws.files).sort();
export const snapshot = (ws) => ({ ...ws.files });

/** Save a named restore point. */
export function checkpoint(ws, label) {
  ws.checkpoints.push({ label: String(label ?? ""), files: snapshot(ws), at: ws.log.length });
  return ws.checkpoints.length - 1;
}

/** Roll the files back to checkpoint `i` (the checkpoint stays; later ones are dropped). */
export function restore(ws, i) {
  const c = ws.checkpoints[i];
  if (!c) return false;
  ws.files = { ...c.files };
  ws.checkpoints.length = i + 1;
  ws.log.push({ op: "restore", checkpoint: i, label: c.label });
  return true;
}

// ───────────────────────── applying edits ─────────────────────────

/** Apply ONE edit; returns { ok, path, op, error?, before, after }. Never throws. */
export function applyEdit(ws, e) {
  const op = e?.op;
  const path = safePath(e?.path);
  if (!path) return { ok: false, op, path: e?.path ?? null, error: `not a safe project path: ${JSON.stringify(e?.path ?? null)}` };
  const before = ws.files[path] ?? null;
  const fail = (error) => ({ ok: false, op, path, error, before, after: before });
  if (op === "write") {
    const content = String(e.content ?? "");
    if (content.length > MAX_FILE_BYTES) return fail(`file is ${content.length} bytes, over the ${MAX_FILE_BYTES} limit`);
    if (before === null && Object.keys(ws.files).length >= MAX_FILES) return fail(`workspace is full (${MAX_FILES} files)`);
    ws.files[path] = content;
    ws.log.push({ op: "write", path, created: before === null });
    return { ok: true, op, path, created: before === null, before, after: content };
  }
  if (op === "edit") {
    if (before === null) return fail("cannot edit a file that does not exist — write it first");
    const find = String(e.find ?? ""), replace = String(e.replace ?? "");
    if (!find) return fail("the SEARCH text is empty");
    const at = locate(before, find);
    if (at.error) return fail(at.error);
    const after = before.slice(0, at.start) + replace + before.slice(at.end);
    ws.files[path] = after;
    ws.log.push({ op: "edit", path, fuzzy: !!at.fuzzy });
    return { ok: true, op, path, before, after, fuzzy: !!at.fuzzy };
  }
  if (op === "delete") {
    if (before === null) return fail("cannot delete a file that does not exist");
    delete ws.files[path];
    ws.log.push({ op: "delete", path });
    return { ok: true, op, path, before, after: null };
  }
  if (op === "rename") {
    const to = safePath(e.to);
    if (!to) return fail(`not a safe project path: ${JSON.stringify(e.to ?? null)}`);
    if (before === null) return fail("cannot rename a file that does not exist");
    if (ws.files[to] !== undefined) return fail(`${to} already exists`);
    ws.files[to] = before; delete ws.files[path];
    ws.log.push({ op: "rename", path, to });
    return { ok: true, op, path, to, before, after: before };
  }
  return fail(`unknown edit operation: ${JSON.stringify(op ?? null)}`);
}

/** Find `find` in `text`: exact and unique, else whitespace-tolerant and unique, else an error that says why. */
function locate(text, find) {
  const first = text.indexOf(find);
  if (first >= 0) {
    if (text.indexOf(find, first + 1) >= 0) return { error: "the SEARCH text appears more than once — include more surrounding lines so it is unique" };
    return { start: first, end: first + find.length };
  }
  // whitespace-tolerant: same non-blank lines, ignoring leading/trailing space and line-end differences
  const lines = text.split("\n");
  const want = find.replace(/\r/g, "").split("\n").map((l) => l.trim());
  while (want.length && want[0] === "") want.shift();
  while (want.length && want[want.length - 1] === "") want.pop();
  if (!want.length) return { error: "the SEARCH text is blank" };
  const hits = [];
  for (let i = 0; i + want.length <= lines.length; i++) {
    let ok = true;
    for (let j = 0; j < want.length; j++) if (lines[i + j].trim() !== want[j]) { ok = false; break; }
    if (ok) hits.push(i);
  }
  if (hits.length === 1) {
    const i = hits[0];
    let start = 0; for (let k = 0; k < i; k++) start += lines[k].length + 1;
    let end = start; for (let k = 0; k < want.length; k++) end += lines[i + k].length + (i + k < lines.length - 1 ? 1 : 0);
    if (text[end - 1] === "\n" && !find.endsWith("\n")) end -= 1;
    return { start, end, fuzzy: true };
  }
  if (hits.length > 1) return { error: "the SEARCH text appears more than once (ignoring whitespace) — include more surrounding lines" };
  return { error: "the SEARCH text was not found in the file — it must match the file's current text exactly" };
}

/** Apply a list of edits in order. Returns { applied:[…], failed:[…], changed:[paths] }. One failure never blocks the rest. */
export function applyEdits(ws, edits) {
  const applied = [], failed = [], changed = new Set();
  for (const e of edits || []) {
    const r = applyEdit(ws, e);
    if (r.ok) { applied.push(r); changed.add(r.path); if (r.to) changed.add(r.to); }
    else failed.push(r);
  }
  return { applied, failed, changed: [...changed] };
}

// ───────────────────────── reading a model's answer as edits ─────────────────────────

const PATH_HINT = /^\s*(?:\/\/|#|<!--|\/\*|--)?\s*(?:file(?:name)?|path)\s*[:=]\s*`?([^\s`*]+)`?\s*(?:-->|\*\/)?\s*$/i;
const LINE_PATH = /^\s*(?:#{1,6}\s*|\*\*|`|\d+[.)]\s*)?(?:file(?:name)?\s*[:=]\s*)?`?\*{0,2}([\w@.\-\/]+\.[A-Za-z0-9]{1,8})\*{0,2}`?\*{0,2}:?\s*$/i;

/**
 * Read a model's answer as a list of edits. Understands, in this order:
 *   • SEARCH/REPLACE blocks under a path line:
 *         src/app.js
 *         <<<<<<< SEARCH
 *         old text
 *         =======
 *         new text
 *         >>>>>>> REPLACE
 *   • whole-file fenced blocks whose path is given by the fence info
 *     (```js path=src/app.js / ```src/app.js), a `// file: …` first line,
 *     or the line just above the fence;
 *   • a single unlabeled fenced block → written to `defaultPath` when given.
 * Returns { edits, notes } — `notes` says what was ignored or ambiguous.
 */
export function parseEdits(answer, { defaultPath = null, existing = [] } = {}) {
  const text = String(answer ?? "").replace(/\r\n/g, "\n");
  const edits = [], notes = [];

  // 1. SEARCH/REPLACE blocks
  const sr = /(?:^|\n)[ \t]*(?:```[^\n]*\n)?(?:([^\n<>]+)\n)?[ \t]*<{5,9} ?SEARCH[ \t]*\n([\s\S]*?)\n[ \t]*={5,9}[ \t]*\n([\s\S]*?)\n?[ \t]*>{5,9} ?REPLACE[ \t]*(?:\n[ \t]*```)?/g;
  let lastEnd = 0, m, any = false, lastPath = defaultPath;
  while ((m = sr.exec(text))) {
    any = true;
    let p = m[1] ? pathFromLine(m[1]) : null;
    if (!p) p = lastPath;
    if (!p) { notes.push("a SEARCH/REPLACE block had no file path above it"); continue; }
    lastPath = p;
    edits.push({ op: "edit", path: p, find: m[2], replace: m[3] });
    lastEnd = sr.lastIndex;
  }
  if (any) return { edits, notes };

  // 1b. unified-diff hunks (what models emit most when not told otherwise):
  //     `--- a/p` / `+++ b/p` / `@@` / lines prefixed ' ', '-', '+' — also inside a <<<<<<< path … >>>>>>> wrapper.
  const diffEdits = parseDiffHunks(text, { defaultPath: defaultPath || (existing.length === 1 ? existing[0] : null), notes });
  if (diffEdits.length) return { edits: diffEdits, notes };

  // 2. fenced blocks
  const fence = /(^|\n)([^\n]*)\n?```([^\n]*)\n([\s\S]*?)\n?```/g;
  const found = [];
  while ((m = fence.exec(text))) {
    const above = (m[2] || "").trim();
    const info = (m[3] || "").trim();
    let body = m[4];
    let p = pathFromInfo(info) || (above && pathFromLine(above)) || null;
    if (!p) {
      const first = body.split("\n", 1)[0];
      const hint = first.match(PATH_HINT);
      if (hint) { p = hint[1]; body = body.slice(first.length + 1); }
    }
    found.push({ path: p ? safePath(p) : null, rawPath: p, body, info });
  }
  if (found.length) {
    const labeled = found.filter((f) => f.path);
    if (labeled.length) {
      for (const f of labeled) edits.push({ op: "write", path: f.path, content: f.body.endsWith("\n") ? f.body : f.body + "\n" });
      for (const f of found.filter((x) => !x.path)) notes.push("a code block had no file path and was ignored");
      for (const f of found.filter((x) => !x.path && x.rawPath)) notes.push(`unsafe path ignored: ${f.rawPath}`);
      return { edits, notes };
    }
    if (found.length === 1 && defaultPath) {
      edits.push({ op: "write", path: safePath(defaultPath), content: found[0].body.endsWith("\n") ? found[0].body : found[0].body + "\n" });
      return { edits, notes };
    }
    if (found.length === 1 && existing.length === 1) {
      edits.push({ op: "write", path: existing[0], content: found[0].body.endsWith("\n") ? found[0].body : found[0].body + "\n" });
      return { edits, notes };
    }
    notes.push(`${found.length} code block(s) with no file path — nothing written`);
    return { edits, notes };
  }

  // 3. a bare answer with a default path
  const bare = text.trim();
  if (defaultPath && bare && !/^(sure|here|i |certainly|of course)/i.test(bare) && /[<{;=]/.test(bare)) {
    edits.push({ op: "write", path: safePath(defaultPath), content: bare + "\n" });
    return { edits, notes };
  }
  notes.push("no edits found in the answer");
  return { edits, notes };
}

/** Unified-diff hunks → edits. Each hunk becomes a SEARCH (context + removed lines) and a REPLACE (context + added lines). */
export function parseDiffHunks(text, { defaultPath = null, notes = [] } = {}) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const edits = [];
  let path = null, i = 0;
  const cleanPath = (p) => String(p).trim().replace(/^[ab]\//, "").replace(/\t.*$/, "").replace(/^`|`$/g, "");
  while (i < lines.length) {
    const L = lines[i];
    let m;
    if ((m = L.match(/^\+\+\+ (\S.*)$/))) { if (!/\/dev\/null/.test(m[1])) path = cleanPath(m[1]); i++; continue; }
    if ((m = L.match(/^--- (\S.*)$/)) && /^\+\+\+ /.test(lines[i + 1] || "")) { i++; continue; }
    if ((m = L.match(/^<{5,9} ?(?!SEARCH)(\S.*)$/)) && /\.[A-Za-z0-9]{1,8}$/.test(m[1].trim())) { path = cleanPath(m[1]); i++; continue; }
    if (/^@@/.test(L)) {
      // a path line just above the hunk header
      let j = i + 1; const find = [], repl = [];
      for (; j < lines.length; j++) {
        const h = lines[j];
        if (/^@@/.test(h) || /^(>{5,9}|={5,9}\s*$|```)/.test(h) || /^(\+\+\+|---) /.test(h) && /^(\+\+\+|---) \S/.test(h) && !/^[-+] /.test(h.slice(0, 2))) break;
        if (h.startsWith("-")) find.push(h.slice(1));
        else if (h.startsWith("+")) repl.push(h.slice(1));
        else if (h.startsWith(" ")) { find.push(h.slice(1)); repl.push(h.slice(1)); }
        else if (h === "") { const nx = lines[j + 1] ?? ""; if (/^[-+ ]/.test(nx) && !/^(---|\+\+\+) /.test(nx)) { find.push(""); repl.push(""); } else break; }
        else break;
      }
      const target = path || defaultPath;
      if (!target) notes.push("a diff hunk had no file path");
      else if (!find.length || find.every((x) => x === "")) notes.push(`a diff hunk for ${target} was a pure insertion with no context — it cannot be located`);
      else edits.push({ op: "edit", path: target, find: find.join("\n"), replace: repl.join("\n") });
      i = j; continue;
    }
    if (!path && (m = L.match(LINE_PATH)) && /\.[A-Za-z0-9]{1,8}$/.test(m[1]) && /^@@/.test(lines[i + 1] || "")) { path = m[1]; i++; continue; }
    i++;
  }
  return edits;
}

function pathFromInfo(info) {
  const kv = info.match(/(?:path|file(?:name)?|title)\s*=\s*"?([^\s"]+)"?/i);
  if (kv) return kv[1];
  const parts = info.split(/\s+/).filter(Boolean);
  for (const part of parts) if (/[\/.]/.test(part) && /\.[A-Za-z0-9]{1,8}$/.test(part) && !/^[a-z]+$/.test(part)) return part.replace(/^[`"']|[`"':]$/g, "");
  return null;
}
function pathFromLine(line) {
  const l = String(line).trim();
  const hint = l.match(PATH_HINT);
  if (hint) return hint[1];
  const m = l.match(LINE_PATH);
  if (m && /\.[A-Za-z0-9]{1,8}$/.test(m[1])) return m[1];
  return null;
}

// ───────────────────────── diffs ─────────────────────────

/** Line diff (LCS) → hunks [{op:"eq"|"add"|"del", line}] — small files, so O(n·m) is fine, capped. */
export function diffLines(a, b) {
  const A = a === null || a === undefined ? [] : String(a).split("\n");
  const B = b === null || b === undefined ? [] : String(b).split("\n");
  if (A.length * B.length > 4_000_000) return [...A.map((line) => ({ op: "del", line })), ...B.map((line) => ({ op: "add", line }))];
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ op: "eq", line: A[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ op: "del", line: A[i++] }); }
    else out.push({ op: "add", line: B[j++] });
  }
  while (i < n) out.push({ op: "del", line: A[i++] });
  while (j < m) out.push({ op: "add", line: B[j++] });
  return out;
}

/** {added, removed} line counts for a diff. */
export function diffStat(d) { let added = 0, removed = 0; for (const h of d) { if (h.op === "add") added++; else if (h.op === "del") removed++; } return { added, removed }; }

/** Collapse a diff to its changed hunks with `context` lines around them. */
export function hunksOf(d, context = 3) {
  const keep = new Array(d.length).fill(false);
  d.forEach((h, i) => { if (h.op !== "eq") for (let k = Math.max(0, i - context); k <= Math.min(d.length - 1, i + context); k++) keep[k] = true; });
  const out = []; let cur = null;
  d.forEach((h, i) => {
    if (keep[i]) { if (!cur) { cur = { lines: [] }; out.push(cur); } cur.lines.push(h); }
    else cur = null;
  });
  return out;
}

/** What changed between two snapshots: [{path, status:"added"|"modified"|"deleted", added, removed}] */
export function changesBetween(before, after) {
  const out = [];
  for (const p of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[p], b = after[p];
    if (a === b) continue;
    const st = diffStat(diffLines(a ?? null, b ?? null));
    out.push({ path: p, status: a === undefined ? "added" : b === undefined ? "deleted" : "modified", ...st });
  }
  return out.sort((x, y) => x.path.localeCompare(y.path));
}

// ───────────────────────── the tree ─────────────────────────

/** Nested tree from flat paths: [{name, path, type:"dir"|"file", children?}] — dirs first, then files, each A→Z. */
export function treeOf(pathList) {
  const root = { children: new Map() };
  for (const p of pathList) {
    let cur = root;
    const parts = p.split("/");
    parts.forEach((name, i) => {
      const isFile = i === parts.length - 1;
      if (!cur.children.has(name)) cur.children.set(name, { name, path: parts.slice(0, i + 1).join("/"), type: isFile ? "file" : "dir", children: isFile ? null : new Map() });
      cur = cur.children.get(name);
    });
  }
  const walk = (node) => [...node.children.values()]
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1))
    .map((n) => (n.type === "dir" ? { name: n.name, path: n.path, type: "dir", children: walk(n) } : { name: n.name, path: n.path, type: "file" }));
  return walk(root);
}

// ───────────────────────── previewing a multi-file page ─────────────────────────

/** The page to open for a workspace: index.html, else the first .html. */
export function entryOf(ws) {
  const ps = paths(ws);
  return ps.find((p) => p === "index.html") || ps.find((p) => /(^|\/)index\.html?$/i.test(p)) || ps.find((p) => /\.html?$/i.test(p)) || null;
}

const resolveRel = (from, ref) => {
  const r = String(ref).split("#")[0].split("?")[0];
  if (/^(?:[a-z]+:|\/\/|data:|#)/i.test(r)) return null;
  const base = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  const parts = (r.startsWith("/") ? r.slice(1) : base + r).split("/");
  const out = [];
  for (const s of parts) { if (s === "." || s === "") continue; if (s === "..") out.pop(); else out.push(s); }
  return out.join("/");
};

/**
 * One self-contained HTML string for the preview: local stylesheets and scripts
 * are inlined, so a multi-file page runs inside a sandboxed srcdoc with no
 * server. Returns { html, missing:[refs the page names but the workspace lacks],
 * inlined:[paths] }. ES-module imports between files are not rewritten — a
 * module script is inlined as written, and a relative import will surface as the
 * runtime error it is.
 */
export function bundleForPreview(ws, entry = entryOf(ws)) {
  if (!entry || ws.files[entry] === undefined) return { html: "", missing: [], inlined: [], entry: null };
  let html = ws.files[entry];
  const missing = [], inlined = [];
  html = html.replace(/<link\b([^>]*?)>/gi, (tag, attrs) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(attrs)) return tag;
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) return tag;
    const p = resolveRel(entry, href);
    if (p === null) return tag;
    if (ws.files[p] === undefined) { missing.push(href); return tag; }
    inlined.push(p);
    return `<style data-from="${p}">\n${ws.files[p].replace(/<\/style/gi, "<\\/style")}\n</style>`;
  });
  html = html.replace(/<script\b([^>]*?)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, pre, src, post) => {
    const p = resolveRel(entry, src);
    if (p === null) return tag;
    if (ws.files[p] === undefined) { missing.push(src); return tag; }
    inlined.push(p);
    const attrs = [(pre + " " + post).replace(/\s+/g, " ").trim(), `data-from="${p}"`].filter(Boolean).join(" ");
    return `<script ${attrs}>\n${ws.files[p].replace(/<\/script/gi, "<\\/script")}\n</script>`;
  });
  return { html, missing, inlined, entry };
}

// ───────────────────────── export: a zip with no dependencies ─────────────────────────

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (u8) => { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** A STORED (uncompressed) zip of the workspace as a Uint8Array. */
export function zipOf(ws) {
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  const u16 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255]);
  const u32 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  const push = (...parts) => { for (const p of parts) { chunks.push(p); offset += p.length; } };
  for (const p of paths(ws)) {
    const name = enc.encode(p), data = enc.encode(ws.files[p]), crc = crc32(data);
    const header = [u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)];
    central.push({ name, crc, size: data.length, offset });
    push(...header, name, data);
  }
  const cdStart = offset;
  for (const c of central) push(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.offset), c.name);
  const cdSize = offset - cdStart;
  push(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length), u32(cdSize), u32(cdStart), u16(0));
  const out = new Uint8Array(offset); let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

/** What a model needs to know about files it is NOT rewriting: the first lines and any top-level names. */
export function outline(ws, { maxLines = 12, only = null } = {}) {
  const out = [];
  for (const p of paths(ws)) {
    if (only && !only.includes(p)) continue;
    const lines = ws.files[p].split("\n");
    const names = [...ws.files[p].matchAll(/^(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]).slice(0, 12);
    out.push(`${p} (${lines.length} lines${names.length ? "; defines " + names.join(", ") : ""})\n${lines.slice(0, maxLines).join("\n")}`);
  }
  return out.join("\n\n");
}
