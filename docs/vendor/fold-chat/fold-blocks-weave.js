// fold-blocks-weave.js — Penelope's spine, brought to the block kit. The unit is the ATOM: one slot (`name.prop`), one void
// cell. Each is filled in law order — LIBRARY (remembered, by frame) → BOX (derived) → HUNT (snipped from the stone: the
// person's own words) → MOUTH (drawn, last, one line, a completion anchor). Each fill is PROBED by several framings
// (shape · echo · invented referent · repetition · bounds); a failure SHARPENS the atom (a positive instruction, never a
// louder re-ask) and only that unit is redrawn — every unit that passed is KEPT. The assembly is then set down whole by
// the kernel (Hora); a kernel error on a line goes back to the unit on that line, nowhere else.
// The mouth does not learn; the SYSTEM does: kept values enter the library, the scoreboard counts who filled each
// shape, and a shape the mouth walls on three times becomes a STANDING RULE (never asked again; box-owned or a named gap).
// Pure apart from the memory's store (injected; localStorage by default).
import { BLOCKS } from "./fold-blocks.js";
import { checkValue } from "./fold-blocks-kernel.js";

/* ---------------- declared defaults (Constitution II.11: declared, not measured) ---------------- */
export const DECLARED = Object.freeze({
  unitAttempts: 3,          // the mouth's spiral per unit
  kernelRounds: 2,          // a kernel error goes back to its unit this many times
  promoteAfter: 3,          // mouth walls on one shape, across runs, before it becomes a standing rule (GL-LD-07: a hand-set count)
  frameOverlap: 2,          // shared content words for a library entry to match by frame
  words: { title: 14, sub: 32, text: 60, label: 8, heading: 6, brand: 6, cta: 6, image: 10, item: 5 },
});
const STOP = new Set("a an the and or of to in on at by for with from that this is are was be as it its our my your their we you they i me us them who what which when where how about into over under per each one two three some any all very just also only page site website widget document make build create want need like please".split(" "));
export const contentWords = (s) => [...new Set(String(s || "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])].filter((w) => w.length > 2 && !STOP.has(w));
const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;
const cap = (s) => String(s || "").replace(/^\s*(a|an|the)\s+/i, "").replace(/^./, (c) => c.toUpperCase());

/* ---------------- memory: the library, the scoreboard, the standing rules ---------------- */
function defaultStore() { try { return globalThis.localStorage || null; } catch { return null; } }
export function createMemory(store = defaultStore(), key = "fold-blocks:memory@1") {
  const blank = () => ({ library: [], score: {}, standing: {}, rejected: [] });
  let m = blank();
  try { const raw = store?.getItem(key); if (raw) m = { ...blank(), ...JSON.parse(raw) }; } catch { m = blank(); }
  const save = () => { try { store?.setItem(key, JSON.stringify(m)); } catch {} };
  const sc = (shape) => (m.score[shape] = m.score[shape] || { library: 0, box: 0, hunt: 0, mouth: 0, mouthFail: 0, walls: 0, you: 0 });
  return {
    data: () => JSON.parse(JSON.stringify(m)),
    /** By FRAME, never by name: the same shape, asked in words that overlap. Rejected values are never recalled. */
    recall(shape, frameWords) {
      let best = null, bestN = 0;
      for (const e of m.library) {
        if (e.shape !== shape || m.rejected.some((r) => r.shape === shape && r.value === e.value)) continue;
        const n = e.words.filter((w) => frameWords.includes(w)).length;
        if (n >= DECLARED.frameOverlap && (n > bestN || (n === bestN && e.by === "you"))) { best = e; bestN = n; }
      }
      return best ? { ...best, overlap: bestN } : null;
    },
    keep(shape, value, frameWords, by) {
      if (!value || m.rejected.some((r) => r.shape === shape && r.value === value)) return;
      const i = m.library.findIndex((e) => e.shape === shape && e.value === value);
      if (i >= 0) m.library[i] = { ...m.library[i], words: [...new Set([...m.library[i].words, ...frameWords])], by: by === "you" ? "you" : m.library[i].by, at: Date.now() };
      else m.library.push({ id: "L" + (m.library.length + 1), shape, value, words: frameWords, by, at: Date.now() });
      if (m.library.length > 400) m.library = m.library.slice(-400);
      if (by === "you") sc(shape).you++;
      save();
    },
    /** A person replaced or undid a value: it leaves the library and is never recalled again. */
    reject(shape, value, why) { if (!value) return; m.rejected.push({ shape, value, why, at: Date.now() }); m.library = m.library.filter((e) => !(e.shape === shape && e.value === value)); save(); },
    count(shape, door, ok = true) {
      const s = sc(shape);
      if (door === "mouth" && !ok) s.mouthFail++; else if (door === "wall") s.walls++; else s[door] = (s[door] || 0) + 1;
      if (door === "wall" && s.walls >= DECLARED.promoteAfter && !m.standing[shape]) m.standing[shape] = { since: Date.now(), why: `the mouth walled on ${shape} ${s.walls} times`, owner: BOX[shape] ? "box" : "gap" };
      save();
    },
    standing: (shape) => m.standing[shape] || null,
    forget() { m = blank(); save(); },
  };
}

/* ---------------- the stone: the person's own words, snipped by address ---------------- */
const snipAt = (ask, rx) => { const x = rx.exec(ask); return x ? { value: x[1].trim(), at: [x.index + x[0].indexOf(x[1]), x.index + x[0].indexOf(x[1]) + x[1].length] } : null; };
const FORM_PURPOSE = [[/\b(book|booking|reserve|appointment|class|session)/i, { fields: "Name, Email, Date", submit: "Request a booking", cta: "Book now", title: "Book a place" }],
  [/\b(sign ?up|subscribe|newsletter|join|register)/i, { fields: "Name, Email", submit: "Sign up", cta: "Sign up", title: "Join us" }],
  [/\b(order)/i, { fields: "Name, Email, Order details", submit: "Place an order", cta: "Order now", title: "Place an order" }],
  [/\b(contact|enquir|inquir|message|get in touch|quote)/i, { fields: "Name, Email, Message", submit: "Send", cta: "Get in touch", title: "Get in touch" }]];
const purposeOf = (ask) => (FORM_PURPOSE.find(([rx]) => rx.test(ask)) || [null, FORM_PURPOSE[3][1]])[1];
export const HUNT = Object.freeze({
  "nav.brand": (u, c) => snipAt(c.ask, /\b(?:called|named)\s+["“]?([A-Z][\w&'’ -]{1,40}?)["”]?(?=[,.:;]|\s+(?:in|at|for|with)\b|$)/) || snipAt(c.ask, /["“]([^"”]{2,40})["”]/),
  "heading.text": (u, c) => (u.name === "t" || u.name === "title") ? (() => { const s = snipAt(c.ask, /^\s*((?:an?|the)?\s*[^:.,;]{3,80})/i); return s && { ...s, value: cap(s.value) }; })() : null,
  "footer.text": (u, c) => { const p = snipAt(c.ask, /\b(?:in|at)\s+([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,3})/u); const b = c.filled.get("top.brand"); return p && b ? { value: `${b} · ${p.value}`, at: p.at } : null; },
  "input.value": (u, c) => { const label = c.filled.get(`${u.name}.label`) || ""; const w = contentWords(label)[0]; return w ? snipAt(c.ask, new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%?\\s*(?:-\\s*)?${w}`, "i")) : null; },
});
/* ---------------- the box: shapes derived, never drawn. `late` rules read other units, so they run after the first pass ---------------- */
const slug = (s) => String(s || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || null;
export const BOX = Object.freeze({
  "form.fields": { run: (u, c) => purposeOf(c.ask).fields },
  "form.submit": { run: (u, c) => purposeOf(c.ask).submit },
  "form.title": { run: (u, c) => purposeOf(c.ask).title },
  "hero.cta": { run: (u, c) => (c.plan.includes("book : form") ? purposeOf(c.ask).cta : null) },
  "nav.items": { late: true, run: (u, c) => { const it = [c.filled.get("list.heading"), c.plan.includes("book : form") ? (purposeOf(c.ask).cta.split(" ")[0]) : null, c.filled.get("end.text") ? "Visit" : null].filter(Boolean); return it.length >= 2 ? it.join(", ") : null; } },
  "input.name": { late: true, run: (u, c) => slug(c.filled.get(`${u.name}.label`)) },
});

/* ---------------- the probe: several framings; meaning is what survives them ---------------- */
const FIG = /(?:[£$€¥]\s?\d[\d,.]*|\d[\d,.]*\s?(?:%|am|pm|hrs?|hours?|mins?|minutes?|years?|days?|weeks?|months?|kg|km|miles?)|\b\d{1,2}:\d{2}\b|\b\d{2,}\b)/gi;
const figuresIn = (s) => (String(s || "").match(FIG) || []).map((x) => x.replace(/\s+/g, "").toLowerCase());
export function probe(u, value, c) {
  const v = String(value ?? "").trim();
  if (!v) return { ok: false, code: "empty", why: "nothing was written" };
  const shape = checkValue(u.propType, v);
  if (!shape.ok) return { ok: false, code: "shape", why: shape.why };
  const tt = u.propType.replace(/\?$/, "");
  if (tt !== "expr" && (/[<>{}]|^\s*[\w#.-]+\s*=|\be\.g\.|\bvalue\b|^\(|\bTODO\b|lorem/i.test(v) || ((tt === "text" || tt === "list") && /^[a-z]+(_[a-z]+)+$/i.test(v)) || v.toLowerCase() === u.prop || v === u.spec)) return { ok: false, code: "echo", why: "it repeats the instructions instead of being the content" };
  const t = u.propType.replace(/\?$/, "");
  if (t === "text" || t === "list") {
    const limit = u.cell ? (DECLARED.words[u.cell] ?? 12) : t === "list" ? 40 : DECLARED.words[u.prop] ?? DECLARED.words.text;
    if (words(v) > limit) return { ok: false, code: "bounds", why: `it is ${words(v)} words; at most ${limit}` };
    if (t === "list") { const n = v.split(/\s*,\s*/).filter(Boolean).length; if (u.prop === "items" && (n < 2 || n > 6)) return { ok: false, code: "bounds", why: `it lists ${n}; two to six` }; }
    // a starting value a person will set is not a claim; every other figure must come from the material
    const material = u.shape === "input.value" ? figuresIn(v) : figuresIn(c.ask + " " + c.material);
    const invented = figuresIn(v).filter((f) => !material.includes(f));
    if (invented.length) return { ok: false, code: "invented", why: `${invented.join(", ")} ${invented.length > 1 ? "are" : "is"} not in your request`, invented };
  }
  for (const [k, other] of c.filled) if (k !== u.key && other && other.toLowerCase() === v.toLowerCase() && v !== "—" && (u.cell ? k.endsWith("." + u.cell) && u.cell !== "price" : u.prop === k.split(".").pop() || u.prop === "text")) return { ok: false, code: "repeat", why: `it repeats ${k}` };
  return { ok: true };
}
/** SHARPEN: the failure's why becomes a positive instruction (lesson 28: state the operation, never "do not"). */
export function sharpen(u, atom, p) {
  const add = {
    empty: "Write it now, on this one line.", shape: `It must be ${p.why.replace(/^.*?is not /, "")}.`.replace(/\.\.$/, "."),
    echo: "Write the words a visitor reads, nothing else.", bounds: `Keep it short: ${p.why.split("; ")[1] || "fewer words"}.`,
    invented: u.prop === "row" ? "Use words only for any amount, time or count your request did not give; write — in its place." : "Use words only; leave out numbers, prices and times your request did not give.",
    repeat: `Make it different from ${p.why.replace("it repeats ", "")}.`, kernel: `Fix this: ${p.why}.`,
  }[p.code] || p.why;
  return atom.includes(add) ? atom : `${atom}\n${add}`;
}

/* ---------------- one unit per slot ---------------- */
export function unitsOf(skeleton, hints = "") {
  const types = new Map(), out = [], seen = {}, fields = {}, rows = {};
  const H = Object.fromEntries(String(hints).split("\n").map((l) => /^\s*([\w. -]+?):\s*(.+)$/.exec(l)).filter(Boolean).map((m) => [m[1].trim(), m[2].trim()]));
  String(skeleton).split("\n").forEach((l, line) => {
    const ins = /^\s*([\w-]+)\s*:\s*([\w-]+)\s*$/.exec(l); if (ins) { types.set(ins[1], ins[2].toLowerCase()); return; }
    const sch = /^\s*([\w-]+)\.schema\.([\w-]+)\s*=/.exec(l); if (sch) { (fields[sch[1]] = fields[sch[1]] || []).push(sch[2]); return; }
    const d = /^\s*([\w-]+)\.([\w-]+)\s*=\s*$/.exec(l); if (!d) return;
    const [, name, prop] = d, block = types.get(name) || "room";
    if (block === "room" && prop === "row") {   // a record is not one atom: each of its cells is
      rows[name] = (rows[name] || 0) + 1; const n = rows[name];
      for (const f of fields[name] || ["value"]) out.push({ key: `${name}.row#${n}.${f}`, name, prop: "row", cell: f, rowN: n, block, propType: "text", line, shape: `room.${f}`, spec: H[f] || `the ${f} of record ${n}` });
      return;
    }
    const propType = block === "room" ? (prop === "row" ? "text" : "text") : BLOCKS[block]?.props[prop] || "text?";
    seen[name + "." + prop] = (seen[name + "." + prop] || 0) + 1;
    const n = seen[name + "." + prop];
    out.push({ key: `${name}.${prop}${n > 1 ? "#" + n : ""}`, name, prop, block, propType, line, shape: `${block}.${prop}`, spec: H[`${name}.${prop}`] || H[prop] || BLOCKS[block]?.about || prop });
  });
  return out;
}
const mouthPrompt = (u, atom, c) => [
  { role: "system", content: "You complete ONE line of a small file. Write only the value after the =, on one line. No quotes, no explanation." },
  { role: "user", content: `Request: ${c.ask}\n\nSet so far:\n${[...c.filled].filter(([, v]) => v).map(([k, v]) => `${k.replace(/#\d+$/, "")} = ${v}`).join("\n") || "(nothing yet)"}\n\nThe value for ${u.key} (${u.cell ? `record ${u.rowN} of ${u.name}, its ${u.cell}` : u.block}): ${atom}\n${u.key} =` },
];
const firstLine = (raw, u) => String(raw || "").replace(/\r/g, "").split("\n").map((l) => l.trim()).filter((l) => l && !/^```/.test(l))[0]?.replace(/^[\w#.-]+\s*=\s*/, "").replace(/^["'`]|["'`]$/g, "").trim() || "";

/** Fill one unit in law order. Returns its disposition and every attempt (the scars). */
async function fillUnit(u, c, { late = false } = {}) {
  const fw = contentWords(c.ask + " " + c.kind);
  const done = (value, by, extra = {}) => { c.filled.set(u.key, value); return { key: u.key, unit: u, value, by, attempts: [], ...extra }; };
  const box = BOX[u.shape] || BOX[`${u.block}.${u.prop}`];
  if (!late) {
    const lib = c.memory?.recall(u.shape, fw);
    if (lib && probe(u, lib.value, c).ok) return done(lib.value, "library", { address: `library#${lib.id} (${lib.overlap} words in common${lib.by === "you" ? ", written by you" : ""})` });
  }
  if (box && (late || !box.late)) { const v = box.run(u, c); if (v && probe(u, v, c).ok) return done(v, "box", { address: `box:${u.shape}` }); }
  if (box?.late && !late) return null;   // wait for the units this one reads
  const hunt = HUNT[u.shape]; if (hunt) { const h = hunt(u, c); if (h && probe(u, h.value, c).ok) return done(h.value, "hunt", { address: `your request [${h.at[0]}–${h.at[1]}]` }); }
  const standing = c.memory?.standing(u.shape);
  if (standing) { c.filled.set(u.key, ""); return { key: u.key, unit: u, value: "", by: "gap", attempts: [], address: `standing rule: ${standing.why}` }; }
  return mouthFill(u, c, u.spec);
}
async function mouthFill(u, c, atom0, prior = []) {
  let atom = atom0; const attempts = [...prior];
  for (let a = 0; a < DECLARED.unitAttempts; a++) {
    if (c.signal?.aborted) break;
    const t0 = Date.now();
    const raw = await c.complete(mouthPrompt(u, atom, c), { maxTokens: u.prop === "row" ? 48 : 40, signal: c.signal, stop: "line" });
    let v = firstLine(raw, u);
    let p = probe(u, v, c);
    // SHAPE FROM THE STONE: a row whose only fault is an invented figure is cut, not redrawn — the figure leaves, a named gap stays.
    if (!p.ok && p.code === "invented" && u.cell) { attempts.push({ value: v, ok: true, why: `cut ${p.invented.join(", ")} (not in your request)`, ms: Date.now() - t0 }); c.memory?.count(u.shape, "mouth", true); c.filled.set(u.key, "—"); return { key: u.key, unit: u, value: "—", by: "mouth", attempts, address: "drawn, then cut: a named gap" }; }
    if (!p.ok && p.code === "invented" && u.prop === "row") { const cut = v.split("|").map((x) => (figuresIn(x).some((f) => p.invented.includes(f)) ? "—" : x.trim())).join(" | "); if (probe(u, cut, c).ok) { attempts.push({ value: v, ok: true, why: `cut ${p.invented.join(", ")} (not in your request)`, ms: Date.now() - t0 }); c.memory?.count(u.shape, "mouth", true); c.filled.set(u.key, cut); return { key: u.key, unit: u, value: cut, by: "mouth", attempts, address: "drawn, then cut" }; } }
    attempts.push({ value: v, ok: p.ok, why: p.ok ? null : `${p.code}: ${p.why}`, ms: Date.now() - t0 });
    c.memory?.count(u.shape, "mouth", p.ok);
    if (p.ok) { c.filled.set(u.key, v); return { key: u.key, unit: u, value: v, by: "mouth", attempts }; }
    const next = sharpen(u, atom, p);
    if (next === atom && a > 0) break;   // the loop refuses to re-draw an unsharpened atom
    atom = next;
  }
  c.memory?.count(u.shape, "wall");
  c.filled.set(u.key, "");
  return { key: u.key, unit: u, value: "", by: "wall", attempts };
}

/**
 * weaveAssembly — fill every unit of a skeleton, set the assembly down, route kernel errors back to their units.
 * Returns { ok, text, units, verdict, dropped }.
 */
export async function weaveAssembly({ skeleton, hints = "", ask, kind, kernel, complete, memory = null, signal = null, onUnit = () => {}, beforeSubmit = null, label = "assembly" }) {
  const units = unitsOf(skeleton, hints);
  const room = kernel.names().filter((n) => n.type === "room").map((r) => (kernel.state().entities[r.name].data || []).map((x) => Object.values(x).join(" ")).join(" ")).join(" ");
  const c = { ask, kind, plan: skeleton, filled: new Map(), material: room, memory, complete, signal, inputs: () => { const st = kernel.state(); return [...kernel.names().filter((n) => n.type === "input").map((n) => ({ input: n.input, label: st.entities[n.name].props.label })), ...[...c.filled].filter(([k]) => /\.name$/.test(k) && c.filled.get(k)).map(([k, v]) => ({ input: v, label: c.filled.get(k.replace(/\.name$/, ".label")) }))]; } };
  const res = new Map();
  for (const late of [false, true]) for (const u of units) { if (res.has(u.key) || signal?.aborted) continue; const r = await fillUnit(u, c, { late }); if (r) { res.set(u.key, r); onUnit(r); } }
  const compose = (skip = new Set()) => {
    const lines = String(skeleton).split("\n"); const out = []; const seen = {}, rowsSeen = {};
    for (const l of lines) {
      const ins = /^\s*([\w-]+)\s*:/.exec(l); if (ins && skip.has(ins[1])) continue;
      const eva = /^\s*!EVA\s+(.+)$/i.exec(l); if (eva) { const keep = eva[1].split(/\s*,\s*/).filter((n) => !skip.has(n)); if (keep.length) out.push(`!EVA ${keep.join(", ")}`); continue; }
      const d = /^\s*([\w-]+)\.([\w-]+)\s*=\s*$/.exec(l);
      if (d && d[2] === "row" && units.some((x) => x.cell && x.name === d[1])) { if (skip.has(d[1])) continue; rowsSeen[d[1]] = (rowsSeen[d[1]] || 0) + 1; const n = rowsSeen[d[1]]; const cells = units.filter((x) => x.cell && x.name === d[1] && x.rowN === n).map((x) => res.get(x.key)?.value || "—"); if (cells.some((x) => x !== "—")) out.push(`${d[1]}.row = ${cells.join(" | ")}`); continue; }
      if (d) { if (skip.has(d[1])) continue; const k0 = `${d[1]}.${d[2]}`; seen[k0] = (seen[k0] || 0) + 1; const v = res.get(seen[k0] > 1 ? `${k0}#${seen[k0]}` : k0)?.value; if (v) out.push(`${k0} = ${v}`); continue; }
      const dd = /^\s*([\w-]+)\./.exec(l); if (dd && skip.has(dd[1])) continue;
      out.push(l);
    }
    return out.join("\n");
  };
  let text = compose(), verdict = null, dropped = [];
  const lineOf = (t) => { const ls = t.split("\n"); return (n) => ls[n - 1] || ""; };
  for (let round = 0; round <= DECLARED.kernelRounds; round++) {
    if (signal?.aborted) break;
    beforeSubmit?.(text);
    verdict = kernel.submit(text, { by: "model", label });
    if (verdict.ok) break;
    // route each error back to the unit on its line; only those are redrawn
    const L = lineOf(text); const again = new Map();
    for (const e of verdict.errors) {
      const ln = L(e.line); const m = /^([\w-]+)\.([\w-]+)\s*=/.exec(ln);
      const u = m ? units.find((x) => x.name === m[1] && x.prop === m[2] && res.get(x.key)?.value && ln.endsWith(res.get(x.key).value)) : units.find((x) => x.name === e.target && /required|needs/.test(e.msg) && !res.get(x.key)?.value && e.msg.includes(`.${x.prop}`));
      if (u && round < DECLARED.kernelRounds) again.set(u.key, { u, why: e.msg });
    }
    if (!again.size || round === DECLARED.kernelRounds) {
      // Hora: what cannot be set down leaves; the rest stands. Each part named in an error is dropped once, and said so.
      const bad = new Set(verdict.errors.map((e) => e.target).filter((t) => t && units.some((u) => u.name === t)));
      if (!bad.size || dropped.length) break;
      dropped = [...bad]; text = compose(bad);
      if (!/^\s*!EVA\s+\S/im.test(text)) break;
      beforeSubmit?.(text); verdict = kernel.submit(text, { by: "model", label });
      break;
    }
    for (const { u, why } of again.values()) { const prev = res.get(u.key); const r = await mouthFill(u, c, sharpen(u, u.spec, { code: "kernel", why }), prev?.attempts || []); res.set(u.key, r); onUnit(r); }
    text = compose(new Set(dropped));
  }
  // what passed is remembered; what walled is counted
  if (verdict?.ok) for (const r of res.values()) if (r.value && (r.by === "mouth" || r.by === "hunt" || r.by === "box")) { memory?.keep(r.unit.shape, r.value, contentWords(ask + " " + kind), r.by); if (r.by !== "mouth") memory?.count(r.unit.shape, r.by); }
  return { ok: !!verdict?.ok, text, units: [...res.values()], verdict, dropped };
}
