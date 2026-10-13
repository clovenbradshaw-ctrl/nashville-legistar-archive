// fold-blocks-kernel.js — ingests EOT, holds the assemblies, and disposes. The model proposes; this decides.
// Law 2 (the watchmaker): an assembly is a run of lines closed by `!EVA`. It is validated alone, against only what
// already stands; it commits whole or not at all. A failed assembly never touches the ones before it.
// Pure: no DOM, no IO, no model.
import { BLOCKS, TERRAINS, STANCES, OPS, DESERT, KINDS, expr, isColor, contrastRatio, THEME_DEFAULTS } from "./fold-blocks.js";

export const ERRORS = Object.freeze({
  syntax: { face: "ingest", fix: "Write only EOT shapes: `name : type`, `name.prop = value`, `a -> b`, `!EVA names`." },
  unassembled: { face: "Law 2", fix: "End the assembly with `!EVA <names>` before writing anything else." },
  "unknown-surface": { face: "catalog", fix: "Use a type from the catalog. A block the catalog lacks is a gap to report, not to invent." },
  "unknown-prop": { face: "catalog", fix: "Use only the properties this block declares." },
  "missing-prop": { face: "Act", fix: "Set every required property before the checkpoint." },
  "bad-value": { face: "Site", fix: "Give a value of the declared shape." },
  dependency: { face: "helix", fix: "Declare what this refers to (`name : type`) in this or an earlier assembly, before using it." },
  "terrain-mismatch": { face: "Site", fix: "Name a field the room's schema declares, or add it to the room." },
  "narrowing-violation": { face: "composition", fix: "Narrow the part, or widen its container deliberately with !REC." },
  "desert-cell": { face: "Act + Site", fix: DESERT.why },
  "grain-mixed": { face: "all three", fix: "Give the contract terrains and stances that share a grain (Ground, Figure or Pattern)." },
  contrast: { face: "Atmosphere", fix: "Pick ink and surface colours with at least 4.5:1 contrast." },
  unsourced: { face: "Link", fix: "Cite only keys a sources room declares, or drop the citation." },
  "closure-violation": { face: "composition", fix: "Leave the app's contract undeclared: it is computed as the envelope of its parts." },
  redefined: { face: "Act", fix: "A name keeps its type. Use a new name." },
  repeated: { face: "Existence", fix: "Each record is its own instance: make every row different." },
});
const err = (code, msg, line = null, target = null) => ({ code, face: ERRORS[code]?.face || "?", msg, fix: ERRORS[code]?.fix || "", line, target });

/* ---------------- ingest: the deterministic reader ---------------- */
const NAME = "[A-Za-z_][\\w-]*";
const RX = {
  blank: /^\s*(#.*)?$/,
  op: /^\s*!([A-Za-z]{3})\b\s*(.*)$/,
  def: new RegExp(`^\\s*(${NAME})((?:\\.${NAME})+)\\s*(\\+?=)\\s*(.*?)\\s*$`),
  ins: new RegExp(`^\\s*(${NAME}(?:\\.${NAME})*)\\s*:\\s*(${NAME})\\s*$`),
  con: new RegExp(`^\\s*(${NAME})\\s*->\\s*(${NAME})\\s*$`),
};
export function parseLine(raw, n) {
  const s = String(raw).replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(/\u2192/g, "->");
  if (RX.blank.test(s)) return null;
  let m;
  if ((m = RX.op.exec(s))) {
    const op = m[1].toUpperCase();
    if (!OPS.includes(op)) return { kind: "bad", n, raw, why: `!${m[1]} is not one of the nine operators` };
    if (op === "EVA") return { kind: "eva", n, raw, op, targets: m[2].split(",").map((x) => x.trim()).filter(Boolean) };
    if (op === "REC") { const d = RX.def.exec(m[2]); return d ? { kind: "def", n, raw, op, rec: true, name: d[1], path: d[2].slice(1).split("."), append: d[3] === "+=", value: d[4] } : { kind: "bad", n, raw, why: "!REC takes `name.prop = value` or `name.prop += value`" }; }
    return { kind: "mark", n, raw, op, targets: m[2].split(",").map((x) => x.trim()).filter(Boolean) };
  }
  if ((m = RX.def.exec(s))) return { kind: "def", n, raw, op: "DEF", name: m[1], path: m[2].slice(1).split("."), append: m[3] === "+=", value: m[4] };
  if ((m = RX.con.exec(s))) return { kind: "con", n, raw, op: "CON", from: m[1], to: m[2] };
  if ((m = RX.ins.exec(s))) return m[1].includes(".") ? { kind: "note", n, raw, op: "INS", note: `${m[1]} : ${m[2]} is implied (the schema is the room's own); ignored` } : { kind: "ins", n, raw, op: "INS", name: m[1], type: m[2].toLowerCase() };
  return { kind: "bad", n, raw, why: "not an EOT shape" };
}
const EOT_SHAPE = (s) => { const p = parseLine(s, 0); return p === null || p.kind !== "bad"; };
/** Clean a model's raw output: drop code fences and lines of prose. What was dropped is returned, never hidden. */
export function ingest(raw) {
  const kept = [], dropped = [];
  for (const line of String(raw ?? "").replace(/\r/g, "").split("\n")) {
    const t = line.trim();
    if (/^```/.test(t) || /^(eot|EOT):?$/.test(t)) continue;
    const u = t.replace(/^[-*]\s+/, "").replace(/^`(.*)`$/, "$1");
    if (EOT_SHAPE(u)) kept.push(u); else dropped.push(t);
  }
  return { text: kept.join("\n").trim(), dropped };
}
export function splitAssemblies(text) {
  const out = []; let cur = [];
  for (const line of String(text ?? "").split("\n")) { cur.push(line); if (/^\s*!EVA\b/i.test(line)) { out.push(cur.join("\n")); cur = []; } }
  if (cur.some((l) => !RX.blank.test(l))) out.push(cur.join("\n"));
  return out;
}

/* ---------------- values ---------------- */
const unquote = (v) => { const s = String(v ?? "").trim(); return /^"[\s\S]*"$/.test(s) || /^'[\s\S]*'$/.test(s) ? s.slice(1, -1) : s; };
const splitList = (v) => unquote(v).split(/\s*[,|]\s*/).map(unquote).filter(Boolean);
function parseValue(type, raw) {
  const opt = type.endsWith("?"); const t = opt ? type.slice(0, -1) : type;
  const s = unquote(raw);
  if (s === "~" || s === "") return { ok: true, value: null };
  if (t === "text") return { ok: true, value: s };
  if (t === "number") { const n = Number(s); return isFinite(n) ? { ok: true, value: n } : { ok: false, why: `"${s}" is not a number` }; }
  if (t === "list" || t === "fields" || t === "blocks") return { ok: true, value: splitList(s) };
  if (t === "room" || t === "field") return /^[\w-]+$/.test(s) ? { ok: true, value: s } : { ok: false, why: `"${s}" is not a name` };
  if (t === "name") return /^[A-Za-z_]\w*$/.test(s) ? { ok: true, value: s } : { ok: false, why: `"${s}" is not a plain name (letters, digits, _)` };
  if (t === "color") return isColor(s) ? { ok: true, value: s.toLowerCase() } : { ok: false, why: `"${s}" is not a #hex colour` };
  if (t === "expr") { const e = expr(s); return e.ok ? { ok: true, value: s } : { ok: false, why: `expression: ${e.error}` }; }
  if (t.startsWith("choice:")) { const opts = t.slice(7).split("|"); const v = s.toLowerCase(); return opts.includes(v) ? { ok: true, value: v } : { ok: false, why: `"${s}" is not one of ${opts.join(", ")}` }; }
  return { ok: true, value: s };
}
const required = (type) => !type.endsWith("?");
/** One value against its declared shape — the unit probe's literal framing. */
export function checkValue(type, raw) { return parseValue(type, raw); }
const baseType = (type) => type.replace(/\?$/, "");

/* ---------------- state ---------------- */
const ROOM_DEFAULT = Object.freeze({ ops: ["INS", "DEF", "CON"], terrains: ["Entity", "Kind"], stances: ["Making", "Binding", "Dissecting"] });
const clone = (x) => JSON.parse(JSON.stringify(x));
const emptyState = () => ({ entities: {}, order: [], links: [], marks: [], committed: 0 });
function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
const TYPES = () => ["room", "app", ...Object.keys(BLOCKS)];
function nearest(word, list) { let best = null, bd = 99; for (const w of list) { const d = lev(word, w); if (d < bd) { bd = d; best = w; } } return bd <= Math.max(2, Math.floor(word.length / 3)) ? best : null; }

function applyLine(st, L, touched, errors, notes) {
  if (L.kind === "ins") {
    const ex = st.entities[L.name];
    if (ex && ex.type !== L.type) { errors.push(err("redefined", `${L.name} is already a ${ex.type}; it cannot become a ${L.type}`, L.n, L.name)); return; }
    if (!ex) { st.entities[L.name] = { name: L.name, type: L.type, line: L.n, props: {}, raw: {}, schema: {}, rows: [], contract: null, contractSet: false }; st.order.push(L.name); }
    touched.add(L.name); return;
  }
  if (L.kind === "def") {
    const e = st.entities[L.name];
    if (!e) { errors.push(err("dependency", `${L.name} is used before it exists: declare \`${L.name} : <type>\` first`, L.n, L.name)); return; }
    touched.add(L.name);
    const [head, sub] = L.path;
    if (head === "contract") {
      if (!["ops", "terrains", "stances"].includes(sub)) { errors.push(err("unknown-prop", `contract has ops, terrains and stances; not ${sub}`, L.n, L.name)); return; }
      const vals = splitList(L.value).map((v) => (sub === "ops" ? v.toUpperCase() : v[0].toUpperCase() + v.slice(1).toLowerCase()));
      const legal = sub === "ops" ? OPS : sub === "terrains" ? Object.keys(TERRAINS) : Object.keys(STANCES);
      const bad = vals.filter((v) => !legal.includes(v));
      if (bad.length) { errors.push(err("bad-value", `${bad.join(", ")} ${bad.length > 1 ? "are" : "is"} not ${sub === "ops" ? "operators" : sub}`, L.n, L.name)); return; }
      e.contract = e.contract || clone(e.type === "room" ? ROOM_DEFAULT : BLOCKS[e.type]?.contract || { ops: [], terrains: [], stances: [] });
      const prev = e.contract[sub];
      e.contract[sub] = L.append ? [...new Set([...prev, ...vals])] : vals;
      if (e.committed && !L.rec && e.contract[sub].some((v) => !prev.includes(v))) errors.push(err("narrowing-violation", `${L.name}'s contract widens without !REC`, L.n, L.name));
      e.contractSet = true; e.contractLine = L.n; e.contractRec = e.contractRec || !!L.rec; return;
    }
    if (e.type === "room") {
      if (head === "schema" && sub) { e.schema[sub] = unquote(L.value) || "text"; return; }
      if (head === "rows" && unquote(L.value) === "~") { e.rows = []; return; }   // absence: the records are cleared, to be stated again
      if (head === "row" || head === "rows" || head === "add") { e.rows.push({ line: L.n, values: unquote(L.value).split(/\s*\|\s*/).map(unquote) }); return; }
      if (head === "name" || head === "title") { e.props.name = unquote(L.value); return; }
      errors.push(err("unknown-prop", `a room takes .schema.<field>, .row and .name; not .${L.path.join(".")}`, L.n, L.name)); return;
    }
    if (L.path.length > 1) { errors.push(err("unknown-prop", `${L.name}.${L.path.join(".")} is not a property`, L.n, L.name)); return; }
    if (L.append && e.raw[head] != null) e.raw[head] = e.raw[head] + ", " + L.value; else e.raw[head] = L.value;
    e.rawLine = { ...(e.rawLine || {}), [head]: L.n };
    return;
  }
  if (L.kind === "con") { for (const x of [L.from, L.to]) if (!st.entities[x]) errors.push(err("dependency", `${x} is linked before it exists`, L.n, x)); st.links.push([L.from, L.to]); touched.add(L.from); touched.add(L.to); return; }
  if (L.kind === "mark") { st.marks.push({ op: L.op, targets: L.targets, line: L.n }); return; }
  if (L.kind === "note") { notes.push(L.note); }
}

function checkContract(e, errors) {
  const c = e.contract; if (!c) return;
  const grains = (xs, table) => new Set(xs.map((x) => table[x]?.grain).filter(Boolean));
  const tg = grains(c.terrains, TERRAINS), sg = grains(c.stances, STANCES);
  if (c.terrains.length && c.stances.length && ![...tg].some((g) => sg.has(g))) errors.push(err("grain-mixed", `${e.name}: its terrains (${c.terrains.join(", ")}) and stances (${c.stances.join(", ")}) share no grain`, e.contractLine, e.name));
  if (c.ops.includes(DESERT.op) && c.terrains.some((t) => TERRAINS[t]?.grain === "Ground")) errors.push(err("desert-cell", `${e.name} would synthesize at Ground (${c.terrains.filter((t) => TERRAINS[t].grain === "Ground").join(", ")})`, e.contractLine, e.name));
  const def = BLOCKS[e.type]?.contract;
  if (def && !e.contractRec) for (const k of ["ops", "terrains", "stances"]) { const wide = c[k].filter((v) => !def[k].includes(v)); if (wide.length) errors.push(err("narrowing-violation", `${e.name} claims ${wide.join(", ")}, which a ${e.type} does not have`, e.contractLine, e.name)); }
}

function validateEntity(st, e, errors, notes) {
  const E = st.entities;
  if (e.type === "room") {
    const fields = Object.keys(e.schema);
    if (!fields.length) errors.push(err("terrain-mismatch", `room ${e.name} has no schema: declare at least one \`${e.name}.schema.<field> = text\``, e.line, e.name));
    e.data = [];
    const seenRow = new Map();
    for (const r of e.rows) {
      if (fields.length && r.values.length !== fields.length) { errors.push(err("bad-value", `a row of ${e.name} has ${r.values.length} value(s) for ${fields.length} field(s) (${fields.join(" | ")})`, r.line, e.name)); continue; }
      const id = String(r.values[0] || "").trim().toLowerCase();
      if (seenRow.has(id)) { errors.push(err("repeated", `${e.name} has "${r.values[0]}" twice: rows ${seenRow.get(id)} and ${e.data.length + 1} are the same record`, r.line, e.name)); continue; }
      seenRow.set(id, e.data.length + 1);
      e.data.push(Object.fromEntries(fields.map((f, i) => [f, r.values[i]])));
    }
    if (!e.contract) { e.contract = clone(ROOM_DEFAULT); notes.push(`room ${e.name}: no contract declared, so the narrow default (${ROOM_DEFAULT.ops.join(", ")}) was used`); }
    checkContract(e, errors); return;
  }
  if (e.type === "app") {
    const p = {};
    for (const [k, v] of Object.entries(e.raw)) {
      if (k === "kind") { const r = parseValue(`choice:${KINDS.join("|")}`, v); r.ok ? (p.kind = r.value) : errors.push(err("bad-value", `${e.name}.kind: ${r.why}`, e.rawLine[k], e.name)); }
      else if (k === "title") p.title = unquote(v);
      else if (k === "blocks") p.blocks = splitList(v);
      else if (k === "theme") p.theme = unquote(v);
      else errors.push(err("unknown-prop", `an app takes .kind, .title, .blocks and .theme; not .${k}`, e.rawLine[k], e.name));
    }
    if (!p.kind) errors.push(err("missing-prop", `${e.name}.kind is required (${KINDS.join(", ")})`, e.line, e.name));
    if (!p.blocks?.length) errors.push(err("missing-prop", `${e.name}.blocks must list the blocks, in order`, e.line, e.name));
    for (const b of p.blocks || []) { const x = E[b]; if (!x) errors.push(err("dependency", `${e.name} places ${b}, which does not exist`, e.rawLine.blocks, e.name)); else if (!x.committed && x !== e) errors.push(err("dependency", `${e.name} places ${b}, which has not passed its own checkpoint`, e.rawLine.blocks, e.name)); else if (x.type === "room" || x.type === "app") errors.push(err("bad-value", `${b} is a ${x.type}; only blocks are placed`, e.rawLine.blocks, e.name)); }
    if (p.theme && E[p.theme]?.type !== "theme") errors.push(err("dependency", `${e.name}.theme names ${p.theme}, which is not a theme`, e.rawLine.theme, e.name));
    // provenance: every cited key must be declared by a sources room in this app
    const keys = new Set(Object.values(E).filter((x) => x.type === "sources" && x.props.room && E[x.props.room]).flatMap((x) => (E[x.props.room].data || []).map((r) => String(Object.values(r)[0]))));
    for (const x of Object.values(E)) if (x.type === "text") for (const k of x.props.cite || []) if (!keys.has(k)) errors.push(err("unsourced", `${x.name} cites ${k}, which no sources room declares`, x.rawLine?.cite, x.name));
    // closure: the envelope of the parts, computed
    const parts = Object.values(E).filter((x) => x !== e && x.committed && x.contract);
    const env = { ops: [], terrains: [], stances: [] };
    for (const x of parts) for (const k of Object.keys(env)) env[k] = [...new Set([...env[k], ...x.contract[k]])];
    if (e.contractSet) for (const k of Object.keys(env)) { const a = [...e.contract[k]].sort().join(), b = [...env[k]].sort().join(); if (a !== b) errors.push(err("closure-violation", `${e.name}.contract.${k} is ${e.contract[k].join(", ") || "empty"}, but its parts make ${env[k].join(", ")}`, e.contractLine, e.name)); }
    e.envelope = env; e.props = p;
    const placed = new Set([...(p.blocks || []), ...Object.values(E).flatMap((x) => (BLOCKS[x.type]?.container ? x.props.children || [] : []))]);
    const loose = Object.values(E).filter((x) => BLOCKS[x.type] && !BLOCKS[x.type].ambient && !placed.has(x.name)).map((x) => x.name);
    if (loose.length) notes.push(`built but not placed: ${loose.join(", ")}`);
    return;
  }
  const def = BLOCKS[e.type];
  if (!def) { const near = nearest(e.type, TYPES()); errors.push(err("unknown-surface", `${e.type} is not in the catalog${near ? ` (did you mean ${near}?)` : ""}`, e.line, e.name)); return; }
  const props = {};
  for (const [k, v] of Object.entries(e.raw)) {
    const type = def.props[k];
    if (!type) { const near = nearest(k, Object.keys(def.props)); errors.push(err("unknown-prop", `a ${e.type} has no .${k}${near ? ` (did you mean .${near}?)` : ""}; it takes ${Object.keys(def.props).join(", ")}`, e.rawLine[k], e.name)); continue; }
    const r = parseValue(type, v);
    if (!r.ok) errors.push(err("bad-value", `${e.name}.${k}: ${r.why}`, e.rawLine[k], e.name)); else props[k] = r.value;
  }
  for (const [k, type] of Object.entries(def.props)) if (required(type) && (props[k] == null || (Array.isArray(props[k]) && !props[k].length)) && !(k in e.raw && errors.some((x) => x.target === e.name && x.line === e.rawLine[k]))) errors.push(err("missing-prop", `${e.name}.${k} is required (${baseType(type)})`, e.line, e.name));
  // references, in helix order: what this block names must already exist
  const roomKey = Object.keys(def.props).find((k) => baseType(def.props[k]) === "room");
  const room = roomKey && props[roomKey] ? E[props[roomKey]] : null;
  if (roomKey && props[roomKey]) {
    if (!room) errors.push(err("dependency", `${e.name}.${roomKey} names ${props[roomKey]}, which does not exist`, e.rawLine[roomKey], e.name));
    else if (room.type !== "room") errors.push(err("bad-value", `${props[roomKey]} is a ${room.type}, not a room`, e.rawLine[roomKey], e.name));
    else {
      for (const [k, type] of Object.entries(def.props)) {
        const bt = baseType(type);
        const names = bt === "field" && props[k] ? [props[k]] : bt === "fields" ? props[k] || [] : [];
        for (const f of names) if (!(f in room.schema)) errors.push(err("terrain-mismatch", `${e.name}.${k} = ${f}, but room ${room.name} has fields ${Object.keys(room.schema).join(", ") || "(none)"}`, e.rawLine[k], e.name));
      }
      const rc = room.contract || ROOM_DEFAULT;
      const need = (e.contract || def.contract).ops.filter((o) => o !== "NUL");
      const over = need.filter((o) => o !== "SEG" && o !== "CON" && !rc.ops.includes(o));
      if (over.length) errors.push(err("narrowing-violation", `${e.name} would fire ${over.join(", ")} into room ${room.name}, whose contract allows ${rc.ops.join(", ") || "nothing"}`, e.rawLine[roomKey], e.name));
    }
  }
  for (const k of Object.keys(def.props)) if (baseType(def.props[k]) === "blocks") for (const c of props[k] || []) { const x = E[c]; if (!x) errors.push(err("dependency", `${e.name} holds ${c}, which does not exist yet: declare it first`, e.rawLine[k], e.name)); else if (!BLOCKS[x.type] || BLOCKS[x.type].ambient) errors.push(err("bad-value", `${c} is a ${x.type} and cannot sit inside ${e.name}`, e.rawLine[k], e.name)); else if (c === e.name) errors.push(err("bad-value", `${e.name} cannot hold itself`, e.rawLine[k], e.name)); }
  if (e.type === "result") {
    if (props.expr) notes.push(`${e.name}: its computation was written by the model (an expression over the inputs), not taken from a catalog. It is checked for shape, not for meaning.`);
    else if (!errors.some((x) => x.target === e.name && x.code === "bad-value")) errors.push(err("missing-prop", `${e.name} needs an .expr that computes the answer from the inputs`, e.line, e.name));
  }
  if (e.type === "result" && props.expr) { const inputs = new Set(Object.values(E).filter((x) => x.type === "input").map((x) => x.props.name || unquote(x.raw.name))); for (const n of expr(props.expr).names) if (!inputs.has(n)) errors.push(err("dependency", `${e.name}.expr uses ${n}, but no input is named ${n}${inputs.size ? ` (inputs: ${[...inputs].join(", ")})` : ""}`, e.rawLine.expr, e.name)); }
  if (e.type === "input") { if (props.kind === "choice" && !(props.options || []).length) errors.push(err("missing-prop", `${e.name} is a choice, so it needs .options`, e.line, e.name)); const dup = Object.values(E).find((x) => x !== e && x.type === "input" && (x.props.name || unquote(x.raw.name)) === props.name); if (dup) errors.push(err("redefined", `two inputs are named ${props.name} (${dup.name}, ${e.name})`, e.rawLine.name, e.name)); }
  if (e.type === "theme") {
    const th = { ...THEME_DEFAULTS, ...Object.fromEntries(Object.entries(props).filter(([, v]) => v != null)) };
    const cr = contrastRatio(th.ink, th.surface);
    if (cr < 4.5) errors.push(err("contrast", `ink ${th.ink} on surface ${th.surface} is ${cr.toFixed(2)}:1`, e.rawLine.ink || e.rawLine.surface || e.line, e.name));
    const others = Object.values(E).filter((x) => x !== e && x.type === "theme" && x.committed);
    if (others.length) notes.push(`a second theme (${e.name}) replaces ${others.map((x) => x.name).join(", ")}`);
  }
  e.props = props;
  checkContract(e, errors);
}

/** One kernel per artifact. submit() takes ONE assembly (lines ending in `!EVA`) and returns its verdict. */
export function createKernel() {
  let st = emptyState();
  const history = [];
  function submit(text, { by = "model", label = null } = {}) {
    const lines = String(text ?? "").split("\n").map((l, i) => parseLine(l, i + 1)).filter(Boolean);
    const errors = [], notes = [], touched = new Set();
    for (const L of lines) if (L.kind === "bad") errors.push(err("syntax", `line ${L.n}: ${L.why}: ${L.raw.trim().slice(0, 80)}`, L.n));
    const evaIdx = lines.findIndex((L) => L.kind === "eva");
    if (evaIdx < 0) errors.push(err("unassembled", "the assembly has no `!EVA` checkpoint", lines.length ? lines[lines.length - 1].n : null));
    else if (lines.slice(evaIdx + 1).some((L) => L.kind !== "note")) errors.push(err("unassembled", "lines follow the `!EVA`; each assembly ends at its checkpoint", lines[evaIdx + 1].n));
    const stage = clone(st);
    for (const L of lines.slice(0, evaIdx < 0 ? lines.length : evaIdx)) if (L.kind !== "bad") applyLine(stage, L, touched, errors, notes);
    const targets = evaIdx >= 0 ? lines[evaIdx].targets : [];
    for (const t of targets) { if (!stage.entities[t]) errors.push(err("dependency", `!EVA names ${t}, which this assembly never declares`, lines[evaIdx].n, t)); else touched.add(t); }
    // dependents of anything touched are re-checked (a room's schema change can break a block bound to it)
    for (const x of Object.values(stage.entities)) if (x.committed && !touched.has(x.name) && Object.entries(x.raw || {}).some(([, v]) => splitList(v).some((n) => touched.has(n)))) touched.add(x.name);
    const order = [...touched].sort((a, b) => { const r = (n) => (stage.entities[n]?.type === "room" ? 0 : stage.entities[n]?.type === "app" ? 2 : 1); return r(a) - r(b); });
    for (const n of order) if (stage.entities[n] && stage.entities[n].type !== "app") validateEntity(stage, stage.entities[n], errors, notes);
    for (const n of order) if (stage.entities[n]?.type === "app") { stage.entities[n].committed = true; validateEntity(stage, stage.entities[n], errors, notes); }
    const ok = errors.length === 0 && lines.length > 0;
    const verdict = { ok, index: history.length, label, by, targets, touched: [...touched], errors, notes, text: String(text ?? "").trim(), lines: lines.length };
    if (ok) { for (const n of touched) stage.entities[n].committed = true; stage.committed++; st = stage; history.push(verdict); }
    return verdict;
  }
  return {
    submit,
    history: () => history.slice(),
    state: () => clone(st),
    names: () => Object.values(st.entities).filter((e) => e.committed).map((e) => ({ name: e.name, type: e.type, fields: e.type === "room" ? Object.keys(e.schema) : null, rows: e.type === "room" ? (e.data || []).length : null, input: e.type === "input" ? e.props.name : null })),
    model: () => toModel(st),
    reset: () => { st = emptyState(); history.length = 0; },
  };
}

/** The committed state as the renderer reads it. Only what passed a checkpoint is drawn. */
export function toModel(st) {
  const E = Object.values(st.entities).filter((e) => e.committed);
  const app = E.find((e) => e.type === "app") || null;
  const themes = E.filter((e) => e.type === "theme");
  const theme = (app?.props.theme && st.entities[app.props.theme]?.props) || themes[themes.length - 1]?.props || {};
  const rooms = Object.fromEntries(E.filter((e) => e.type === "room").map((e) => [e.name, { schema: e.schema, rows: e.data || [], contract: e.contract }]));
  const blocks = Object.fromEntries(E.filter((e) => BLOCKS[e.type]).map((e) => [e.name, { type: e.type, props: e.props, contract: e.contract || BLOCKS[e.type].contract }]));
  return { theme, rooms, blocks, app: app ? { name: app.name, ...app.props, envelope: app.envelope } : null, order: st.order.filter((n) => st.entities[n]?.committed) };
}

/** A whole EOT text, assembly by assembly; stops at the first that fails (the ones before it stand). */
export function assemble(text) {
  const k = createKernel(); const verdicts = [];
  for (const chunk of splitAssemblies(text)) { const v = k.submit(chunk); verdicts.push(v); if (!v.ok) break; }
  return { ok: verdicts.length > 0 && verdicts.every((v) => v.ok), verdicts, model: k.model(), kernel: k };
}
