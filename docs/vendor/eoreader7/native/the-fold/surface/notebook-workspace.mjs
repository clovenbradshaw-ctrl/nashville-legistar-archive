// notebook-workspace.mjs — SEVERAL CONVERSATIONS, EACH ITS OWN LEDGER, EACH FLAGGED chat / generate / notebook, FORKABLE.
//
// Fold invariant: A FORK IS A PREFIX, NOT A COPY OF A CONCLUSION. A conversation is a sealed notebook log (notebook.mjs). Forking one
// takes the parent's log up to a chosen point — the SAME entries with the SAME hashes, so the prefix verifies as the parent's own —
// and continues on a new branch. The parent is never touched. Decisions do not travel: a claim's promotion is a person's act on the
// ledger it was made on, so the fork starts those claims fresh (the count of promotions left behind is recorded, not hidden).
// The type flag (chat | generate | notebook) is only how the conversation is DRAWN; changing it is a recorded act that changes no cell.
//
//   <dir>/workspace.json        the sealed log of create / fork / retype / rename / close acts
//   <dir>/c/<id>/notebook.json  one conversation's ledger (notebook.mjs / notebook-surface.mjs load+save)
import fs from "node:fs"; import path from "node:path";
import { seal, verifyChain, emptyBench, addCard, addRun } from "./bench.mjs";
import { emptyNotebook, cellOf } from "./notebook.mjs";
import { load, save } from "./notebook-store.mjs";

export const WORKSPACE_SCHEMA = "EOWorkspace@1";
export const TYPES = Object.freeze(["chat", "generate", "notebook"]);
const isHuman = (w) => /^human:\S+/i.test(String(w ?? ""));
const wsFile = (dir) => path.join(dir, "workspace.json");
const convDir = (dir, id) => path.join(dir, "c", id);

/** fold(entries) -> Map(id -> { id, title, type, parent, forkedAt, forkHash, notCarried, closed, created, history }) */
export function fold(entries) {
  const m = new Map();
  for (const e of entries) {
    if (e.kind === "create" || e.kind === "fork") m.set(e.id, { id: e.id, title: e.title, type: e.type, parent: e.parent ?? null, forkedAt: e.at ?? null, forkHash: e.cutHash ?? null, notCarried: e.notCarried ?? null, closed: false, created: e.at_time, by: e.by, history: [{ seq: e.seq, kind: e.kind, by: e.by }] });
    else if (m.has(e.id)) { const c = m.get(e.id); c.history.push({ seq: e.seq, kind: e.kind, by: e.by, to: e.to ?? null }); if (e.kind === "retype") c.type = e.to; if (e.kind === "rename") c.title = e.to; if (e.kind === "close") c.closed = true; if (e.kind === "reopen") c.closed = false; }
  }
  return m;
}

export function openWorkspace(dir) {
  fs.mkdirSync(dir, { recursive: true });
  let log = { schema: WORKSPACE_SCHEMA, entries: [] };
  if (fs.existsSync(wsFile(dir))) log = { schema: WORKSPACE_SCHEMA, entries: JSON.parse(fs.readFileSync(wsFile(dir), "utf8")) };
  const persist = () => { fs.writeFileSync(wsFile(dir) + ".tmp", JSON.stringify(log.entries)); fs.renameSync(wsFile(dir) + ".tmp", wsFile(dir)); };
  const act = (body) => { log = seal(log, { ...body, at_time: Date.now() }); persist(); return log.entries.at(-1); };
  const nextId = () => `c${[...fold(log.entries).keys()].length + 1}`;
  // a notebook that existed before workspaces becomes the first conversation, in place (nothing is rewritten)
  if (!log.entries.length && fs.existsSync(path.join(dir, "notebook.json"))) { fs.mkdirSync(convDir(dir, "c1"), { recursive: true }); fs.copyFileSync(path.join(dir, "notebook.json"), path.join(convDir(dir, "c1"), "notebook.json")); act({ kind: "create", id: "c1", type: "notebook", title: "Notebook", by: "human:migration" }); }
  const ws = {
    list: (all = false) => [...fold(log.entries).values()].filter((c) => all || !c.closed),
    get: (id) => fold(log.entries).get(id) ?? null,
    verify: () => verifyChain(log),
    entries: () => log.entries,
    create({ type = "notebook", title = null, by }) {
      if (!isHuman(by)) return { error: "a conversation is opened by a named person" }; if (!TYPES.includes(type)) return { error: `type must be one of ${TYPES.join(", ")}` };
      const id = nextId(); fs.mkdirSync(convDir(dir, id), { recursive: true }); save(convDir(dir, id), emptyNotebook());
      act({ kind: "create", id, type, title: title || `${type[0].toUpperCase()}${type.slice(1)} ${id.slice(1)}`, by }); return { id };
    },
    state: (id) => load(convDir(dir, id)),
    save: (id, st) => save(convDir(dir, id), st),
    retype(id, type, by) { if (!isHuman(by)) return { error: "a flag is changed by a named person" }; if (!TYPES.includes(type)) return { error: `type must be one of ${TYPES.join(", ")}` }; const c = ws.get(id); if (!c) return { error: "no such conversation" }; if (c.type === type) return { id }; act({ kind: "retype", id, to: type, from: c.type, by }); return { id }; },
    rename(id, title, by) { if (!isHuman(by)) return { error: "renaming is by a named person" }; if (!ws.get(id)) return { error: "no such conversation" }; act({ kind: "rename", id, to: String(title).slice(0, 80), by }); return { id }; },
    close(id, by) { if (!isHuman(by)) return { error: "closing is by a named person" }; if (!ws.get(id)) return { error: "no such conversation" }; act({ kind: "close", id, by }); return { id }; },
    /** fork(id, { at, title, type, by }) — `at` is a cell id (everything up to and including that cell's last entry) or "end". */
    fork(id, { at = "end", title = null, type = null, by }) {
      if (!isHuman(by)) return { error: "a fork is made by a named person" };
      const parent = ws.get(id); if (!parent) return { error: "no such conversation" };
      const st = ws.state(id); const E = st.nb.entries; let cut = E.length - 1;
      if (at !== "end") { if (!cellOf(st.nb, at)) return { error: `no cell "${at}" to fork from` }; cut = -1; E.forEach((e, i) => { if (e.id === at || e.cell === at || e.name === at) cut = i; }); if (cut < 0) return { error: `no entries for "${at}"` }; }
      // the prefix keeps its own seals; the claim ledger is REPLAYED without promotions (decisions do not travel)
      const prefix = E.slice(0, cut + 1); let nb = { schema: st.nb.schema, entries: prefix }, bench = emptyBench();
      for (const e of prefix) {
        if (e.kind === "cell" && e.type === "claim") { const r = addCard(bench, { id: e.id, text: e.source, author: e.author }); if (!r.error) bench = r.log; }
        if (e.kind === "exec") { const c = prefix.find((x) => x.kind === "cell" && x.id === e.cell); if (c?.for) { const r = addRun(bench, { id: `${e.cell}#${e.n}`, card: c.for, role: c.role, code: e.code, output: e.output, ok: e.ok, inputs: Object.keys(e.dataShas ?? {}), ms: e.ms }); if (!r.error) bench = r.log; } }
      }
      const wanted = new Set(prefix.filter((e) => e.kind === "data").map((e) => e.name)), files = Object.fromEntries(Object.entries(st.files).filter(([n]) => wanted.has(n)));
      const notCarried = st.bench.entries.filter((e) => e.kind === "promote").length;
      const nid = nextId(); fs.mkdirSync(convDir(dir, nid), { recursive: true });
      save(convDir(dir, nid), { nb, bench, files });
      act({ kind: "fork", id: nid, parent: id, at, cutHash: prefix.at(-1)?.hash ?? null, cutSeq: cut, type: type ?? parent.type, title: title || `fork of ${parent.title}`, notCarried, by });
      return { id: nid, cut, notCarried, entries: prefix.length };
    },
  };
  return ws;
}
