// fold-blocks-edit.js — a person's hand on the artifact. An edit is not a mutation: it is one more assembly, written in EOT
// by the app on the person's behalf, checked by the kernel like any other, and kept in the same history. Undo is the
// inverse assembly, appended — the log only grows. Pure: no DOM.
import { BLOCKS } from "./fold-blocks.js";

const clean = (v) => String(v ?? "").replace(/\s*\n\s*/g, " ").trim();
const show = (raw) => { const s = String(raw ?? "").trim(); return s === "~" ? "" : s.replace(/^"([\s\S]*)"$/, "$1"); };

/** What a person can change on one part: its declared properties, and the records of the room it reads. */
export function editorFor(kernel, name) {
  const st = kernel.state(); const e = st.entities[name];
  if (!e || !e.committed) return null;
  const def = BLOCKS[e.type];
  if (!def) return null;
  const fields = Object.entries(def.props).filter(([, t]) => !/^(blocks|room)\??$/.test(t)).map(([key, t]) => {
    const base = t.replace(/\?$/, "");
    return { key, type: base.startsWith("choice:") ? "choice" : base, options: base.startsWith("choice:") ? ["", ...base.slice(7).split("|")] : null, required: !t.endsWith("?"), value: show(e.raw[key]) };
  });
  const roomKey = Object.keys(def.props).find((k) => def.props[k].replace(/\?$/, "") === "room");
  const r = roomKey && e.raw[roomKey] ? st.entities[show(e.raw[roomKey])] : null;
  const room = r && r.type === "room" ? { name: r.name, fields: Object.keys(r.schema), rowsText: r.rows.map((x) => x.values.join(" | ")).join("\n") } : null;
  return { name, type: e.type, about: def.about, fields, room };
}

/** The assembly an edit amounts to, and its inverse. Only what changed is written. Null when nothing changed. */
export function editEOT(kernel, name, values = {}, rowsText = null) {
  const ed = editorFor(kernel, name); if (!ed) return null;
  const fwd = [], back = [], touched = new Set();
  for (const f of ed.fields) {
    if (!(f.key in values)) continue;
    const now = clean(values[f.key]), was = f.value;
    if (now === was) continue;
    fwd.push(`${name}.${f.key} = ${now === "" ? "~" : now}`); back.push(`${name}.${f.key} = ${was === "" ? "~" : was}`); touched.add(name);
  }
  if (ed.room && rowsText != null) {
    const norm = (t) => String(t).split("\n").map((l) => l.split("|").map((x) => x.trim()).join(" | ")).filter((l) => l.replace(/[|\s]/g, "")).join("\n");
    const now = norm(rowsText), was = norm(ed.room.rowsText);
    if (now !== was) {
      fwd.push(`${ed.room.name}.rows = ~`, ...now.split("\n").filter(Boolean).map((l) => `${ed.room.name}.row = ${l}`));
      back.push(`${ed.room.name}.rows = ~`, ...was.split("\n").filter(Boolean).map((l) => `${ed.room.name}.row = ${l}`));
      touched.add(ed.room.name);
    }
  }
  if (!fwd.length) return null;
  const eva = `!EVA ${[...touched].join(", ")}`;
  return { text: fwd.join("\n") + "\n" + eva, inverse: back.join("\n") + "\n" + eva, touched: [...touched] };
}

/** The parts a person can edit, in order: the look first, then every placed block. */
export function editableParts(kernel) {
  const st = kernel.state();
  return st.order.filter((n) => st.entities[n]?.committed && BLOCKS[st.entities[n].type]).map((n) => ({ name: n, type: st.entities[n].type }))
    .sort((a, b) => (a.type === "theme" ? -1 : b.type === "theme" ? 1 : 0));
}
