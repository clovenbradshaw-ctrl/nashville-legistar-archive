// holodeck-pyodide.js — THE NOTEBOOK WHEN THERE IS NO SERVER: CPython in this tab, via Pyodide.
//
// tools/notebook-server.mjs is the richer runtime (a persistent IPython kernel beside eoreader7). This module is the
// browser's own runtime, started the moment the pane cannot reach a local server: Pyodide (CPython compiled to
// WebAssembly) executes the cells, matplotlib figures are captured inline, and the SAME vendored ledger code seals
// every run — so the pane's chains still verify here, and an exported .ipynb still re-runs elsewhere. The only thing
// that leaves the tab is the one-time download of the runtime from the CDN the page already loads from; the cells run
// with no network (Pyodide has no sockets), and the workspace (cells, outputs, files) is kept in this browser.
import { sha256, sha256Bytes } from './vendor/eoreader7/native/kernel/sha256.js';
import { addCell, editCell, recordExec, sourceOf, execsOf, dataOf, addData, cellOf } from './vendor/eoreader7/native/the-fold/surface/notebook.mjs';
import { seal, emptyBench, addCard, addRun, promote, statusOf } from './vendor/eoreader7/native/the-fold/surface/bench.mjs';

export const PYODIDE_VERSION = '314.0.7';
export const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const SCHEMA_NB = 'EONotebook@1';
const SCHEMA_WS = 'EOWorkspace@1';

const memoryStore = { get: () => null, set: () => {} };
const browserStore = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { console.warn('The in-browser notebook could not be saved (browser storage is full or blocked):', e && e.message || e); } },
};

const b64ToBytes = (b64) => { const bin = atob(b64 || ''); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; };
const bytesOf = (f) => f.base64 ? b64ToBytes(f.base64) : new TextEncoder().encode(f.text || '');
const basename = (n) => String(n || 'data.txt').split(/[\\/]/).pop() || 'data.txt';
const plain = (o) => o.output_type === 'stream' ? o.text : o.output_type === 'error' ? (o.traceback || []).join('\n') : (Array.isArray(o.data?.['text/plain']) ? o.data['text/plain'].join('') : o.data?.['text/plain'] || '');
const jsonResponse = (obj, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => obj, blob: async () => new Blob([typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)], { type: 'application/json' }) });

/** toIpynb(state) — the same nbformat 4 the server writes, built from the ledger here (nbformat requires these fields). */
export function toIpynb(st) {
  const cells = st.nb.entries.filter((e) => e.kind === 'cell').map((c) => {
    const ex = execsOf(st.nb, c.id).at(-1);
    const base = { id: c.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64), cell_type: c.type === 'code' ? 'code' : 'markdown', metadata: { holodeck: { id: c.id, author: c.author, standing: c.type === 'code' ? 'shown' : 'received', runSeal: ex?.hash } }, source: sourceOf(st.nb, c.id) };
    return c.type === 'code' ? { ...base, execution_count: ex?.env?.execution_count ?? null, outputs: ex?.env?.outputs || [] } : base;
  });
  return { nbformat: 4, nbformat_minor: 5, metadata: { kernelspec: { name: 'python3', display_name: 'Python 3 (Pyodide)', language: 'python' }, language_info: { name: 'python' }, holodeck: { head: st.nb.entries.at(-1)?.hash || null } }, cells };
}

const PRELUDE = `
import ast, base64, io, json, sys, traceback

_HNB = {"namespaces": {}, "outputs": []}

def _hnb_jsonable(v):
    if isinstance(v, bytes):
        return base64.b64encode(v).decode("ascii")
    if isinstance(v, dict):
        return {str(k): _hnb_jsonable(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_hnb_jsonable(x) for x in v]
    return v

class _HNBPublisher:
    def publish(self, data, metadata=None, source=None, transient=None, update=False, **kw):
        _HNB["outputs"].append({"output_type": "display_data", "data": _hnb_jsonable(data), "metadata": _hnb_jsonable(metadata or {})})
    def clear_output(self, wait=False):
        _HNB["outputs"] = []
    def set_parent(self, parent):
        pass
    def parent_header(self):
        return {}

def _hnb_format(obj):
    try:
        from IPython.core.formatters import DisplayFormatter
        data, metadata = DisplayFormatter().format(obj)
        return _hnb_jsonable(data), _hnb_jsonable(metadata or {})
    except Exception:
        return {"text/plain": repr(obj)}, {}

def _hnb_display(*objs, **kw):
    for o in objs:
        data, metadata = _hnb_format(o)
        _HNB["outputs"].append({"output_type": "display_data", "data": data, "metadata": metadata})

def _hnb_setup_ipython():
    if "IPython.core.interactiveshell" not in sys.modules:
        return
    try:
        from IPython.core.interactiveshell import InteractiveShell
        shell = InteractiveShell.instance()
        shell.display_pub = _HNBPublisher()
    except Exception:
        pass

def _hnb_patch_mpl():
    if "matplotlib.pyplot" not in sys.modules:
        return
    try:
        import matplotlib
        matplotlib.use("Agg", force=True)
        import matplotlib.pyplot as plt
        if not getattr(plt.show, "_hnb_patched", False):
            def _show(*a, **k):
                _hnb_figs()
            _show._hnb_patched = True
            plt.show = _show
    except Exception:
        pass

def _hnb_figs():
    if "matplotlib.pyplot" not in sys.modules:
        return
    try:
        import matplotlib.pyplot as plt
        for n in plt.get_fignums():
            buf = io.BytesIO()
            plt.figure(n).savefig(buf, format="png")
            _HNB["outputs"].append({"output_type": "display_data", "data": {"image/png": base64.b64encode(buf.getvalue()).decode("ascii")}, "metadata": {}})
        plt.close("all")
    except Exception:
        pass

def _hnb_ns(cid):
    ns = _HNB["namespaces"].get(cid)
    if ns is None:
        import builtins
        ns = {"__name__": "__main__", "__builtins__": builtins, "display": _hnb_display}
        _HNB["namespaces"][cid] = ns
    return ns

def _hnb_reset(cid):
    _HNB["namespaces"].pop(cid, None)

def _hnb_run(cid, code, count):
    ns = _hnb_ns(cid)
    _hnb_setup_ipython()
    _HNB["outputs"] = []
    out, err = io.StringIO(), io.StringIO()
    old_out, old_err = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = out, err
    ok = True
    try:
        _hnb_patch_mpl()
        tree = ast.parse(code, "<holodeck-cell>")
        if tree.body and isinstance(tree.body[-1], ast.Expr):
            tail = ast.Expression(body=tree.body[-1].value)
            if len(tree.body) > 1:
                exec(compile(ast.Module(body=tree.body[:-1], type_ignores=[]), "<holodeck-cell>", "exec"), ns)
            val = eval(compile(tail, "<holodeck-cell>", "eval"), ns)
            if val is not None:
                data, metadata = _hnb_format(val)
                _HNB["outputs"].append({"output_type": "execute_result", "data": data, "metadata": metadata, "execution_count": count})
        else:
            exec(compile(tree, "<holodeck-cell>", "exec"), ns)
    except BaseException:
        ok = False
        kind, value = sys.exc_info()[0], sys.exc_info()[1]
        _HNB["outputs"].append({"output_type": "error", "ename": getattr(kind, "__name__", "Error"), "evalue": str(value), "traceback": traceback.format_exc().splitlines()})
    finally:
        sys.stdout, sys.stderr = old_out, old_err
        _hnb_figs()
    stdout, stderr = out.getvalue(), err.getvalue()
    outputs = []
    if stdout:
        outputs.append({"output_type": "stream", "name": "stdout", "text": stdout})
    outputs.extend(_HNB["outputs"])
    if stderr:
        outputs.append({"output_type": "stream", "name": "stderr", "text": stderr})
    return json.dumps({"ok": ok, "outputs": outputs, "execution_count": count, "python": sys.version.split()[0]})

import builtins as _hnb_builtins
_hnb_builtins.display = _hnb_display
`;

const ENGINES = new Map();
/** pyodideEngine({ workspace, by, store }) -> the one engine for that workspace in this page (loading starts at once). */
export function pyodideEngine(opts = {}) {
  const workspace = String(opts.workspace || 'default');
  if (!ENGINES.has(workspace)) ENGINES.set(workspace, createPyodideEngine({ ...opts, workspace }));
  return ENGINES.get(workspace);
}

/** createPyodideEngine({ workspace, by, store, autoload }) — the engine itself; exported so the ledgers and workspace can be
 *  exercised without a browser (autoload:false + a Map-backed store), the same way the pane's other guarantees are tested. */
export function createPyodideEngine({ workspace = 'default', by = 'human:in-browser', store = browserStore, autoload = true } = {}) {
  const key = 'hd:pyodide:v1:' + workspace;
  let data = read();
  let pyodide = null, pyVersion = null, loadError = null, loadPromise = null;
  const counts = new Map();

  function read() {
    const raw = store.get(key);
    if (!raw) return { log: [], convs: {} };
    try { const j = JSON.parse(raw); if (Array.isArray(j.log) && j.convs && typeof j.convs === 'object') return j; } catch (e) {}
    return { log: [], convs: {} };
  }
  function persist() { try { store.set(key, JSON.stringify(data)); } catch (e) { console.warn('The in-browser notebook could not be saved:', e); } }
  function sealLog(body) { const log = { schema: SCHEMA_WS, entries: data.log }; const next = seal(log, body); data.log = next.entries; persist(); return data.log.at(-1); }
  const logEntries = () => data.log;
  function fold() {
    const m = new Map();
    for (const e of data.log) {
      if (e.kind === 'create' || e.kind === 'fork') m.set(e.id, { id: e.id, title: e.title, type: e.type, parent: e.parent ?? null, forkedAt: e.at ?? null, forkHash: e.cutHash ?? null, notCarried: e.notCarried ?? null, closed: false, created: e.at_time, by: e.by, history: [{ seq: e.seq, kind: e.kind, by: e.by }] });
      else if (m.has(e.id)) { const c = m.get(e.id); c.history.push({ seq: e.seq, kind: e.kind, by: e.by, to: e.to ?? null }); if (e.kind === 'retype') c.type = e.to; if (e.kind === 'rename') c.title = e.to; if (e.kind === 'close') c.closed = true; }
    }
    return m;
  }
  const list = () => [...fold().values()].filter((c) => !c.closed);
  const nextId = () => `c${fold().size + 1}`;
  function createConv({ type = 'notebook', title = null } = {}) {
    if (!['chat', 'generate', 'notebook'].includes(type)) return { error: `type must be one of chat, generate, notebook` };
    const id = nextId();
    data.convs[id] = { nb: [], bench: [], files: {} };
    sealLog({ kind: 'create', id, type, title: title || `${type[0].toUpperCase()}${type.slice(1)} ${id.slice(1)}`, by, at_time: Date.now() });
    return { id };
  }
  function openConv() { let l = list(); if (!l.length) { createConv({ type: 'notebook' }); l = list(); } return l[0]; }
  const pick = (id) => list().find((c) => c.id === id) || openConv();
  const stateOf = (cid) => { const c = data.convs[cid]; return c ? { nb: { schema: SCHEMA_NB, entries: c.nb }, bench: { schema: 'EOBench@1', entries: c.bench }, files: c.files || {} } : null; };
  function saveState(cid, st) { data.convs[cid] = { nb: st.nb.entries, bench: st.bench.entries, files: st.files }; persist(); }

  function beginLoad() {
    if (!loadPromise) loadPromise = (async () => {
      const mod = await import(PYODIDE_INDEX + 'pyodide.mjs');
      const py = await mod.loadPyodide({ indexURL: PYODIDE_INDEX });
      await py.runPythonAsync(PRELUDE);
      pyodide = py; pyVersion = py.version;
      return py;
    })().catch((e) => { loadError = e; throw e; });
    return loadPromise;
  }
  const ready = () => beginLoad();
  if (autoload) beginLoad();

  function writeFiles(st) {
    if (!pyodide) return;
    pyodide.runPython('import os\nos.makedirs("data", exist_ok=True)');
    for (const [name, f] of Object.entries(st.files)) pyodide.FS.writeFile('data/' + basename(name), bytesOf(f));
  }

  async function run(cid, cell) {
    const st = stateOf(cid);
    const c = st.nb.entries.find((e) => e.kind === 'cell' && e.id === cell);
    if (c?.type !== 'code') throw new Error('Select a Python code cell');
    if (c.lang !== 'python') throw new Error('The Pyodide kernel runs Python cells');
    await ready();
    const code = sourceOf(st.nb, cell);
    try { await pyodide.loadPackagesFromImports(code); } catch (e) { /* an import that fails is shown in the cell's own traceback */ }
    writeFiles(st);
    const count = (counts.get(cid) || 0) + 1; counts.set(cid, count);
    pyodide.globals.set('_hnb_cid', String(cid)); pyodide.globals.set('_hnb_code', code); pyodide.globals.set('_hnb_count', count);
    const t0 = Date.now();
    const r = JSON.parse(pyodide.runPython('_hnb_run(_hnb_cid, _hnb_code, _hnb_count)'));
    const outputs = r.outputs || [];
    const figures = outputs.filter((o) => o.data?.['image/png']).map((o, i) => ({ name: `figure-${i + 1}.png`, png: o.data['image/png'], sha: sha256Bytes(b64ToBytes(o.data['image/png'])) }));
    const rawDataShas = Object.fromEntries(Object.entries(st.files).map(([name, f]) => [basename(name), sha256Bytes(bytesOf(f))]));
    const recorded = recordExec(st, { cell, output: outputs.map(plain).join('\n'), ok: r.ok, figures, ms: Date.now() - t0, env: { python: r.python, runtime: 'pyodide', standing: 'shown', execution_count: count, outputs, rawDataShas, kernelSession: workspace + '/' + cid, priorRunSeal: st.nb.entries.filter((e) => e.kind === 'exec').at(-1)?.hash || null } });
    if (recorded.error) throw new Error(recorded.error);
    saveState(cid, recorded.state);
    return r;
  }

  async function act(b) {
    const c = pick(b.c);
    const cid = c.id;
    if (b.op === 'kernel-interrupt') return { notice: 'Pyodide runs a cell to completion in this tab; there is no separate kernel process to interrupt. Restart the kernel if a cell will not finish.' };
    if (b.op === 'ws-new') { const r = createConv({ type: b.type || 'notebook', title: b.title }); if (r.error) throw new Error(r.error); return { goto: r.id }; }
    if (b.op === 'ws-retype') { if (c.type === b.type) return { id: cid }; sealLog({ kind: 'retype', id: cid, to: b.type, from: c.type, by }); return { id: cid }; }
    if (b.op === 'ws-rename') { sealLog({ kind: 'rename', id: cid, to: String(b.title).slice(0, 80), by }); return { id: cid }; }
    if (b.op === 'ws-close') { sealLog({ kind: 'close', id: cid, by }); return { goto: openConv().id }; }
    if (b.op === 'ws-fork') {
      const st = stateOf(cid), E = st.nb.entries; let cut = E.length - 1;
      if (b.at && b.at !== 'end') { if (!cellOf(st.nb, b.at)) throw new Error(`no cell "${b.at}" to fork from`); cut = -1; E.forEach((e, i) => { if (e.id === b.at || e.cell === b.at || e.name === b.at) cut = i; }); if (cut < 0) throw new Error(`no entries for "${b.at}"`); }
      const prefix = E.slice(0, cut + 1); let bench = emptyBench();
      for (const e of prefix) {
        if (e.kind === 'cell' && e.type === 'claim') { const r = addCard(bench, { id: e.id, text: e.source, author: e.author }); if (!r.error) bench = r.log; }
        if (e.kind === 'exec') { const cell = prefix.find((x) => x.kind === 'cell' && x.id === e.cell); if (cell?.for) { const r = addRun(bench, { id: `${e.cell}#${e.n}`, card: cell.for, role: cell.role, code: e.code, output: e.output, ok: e.ok, inputs: Object.keys(e.dataShas ?? {}), ms: e.ms }); if (!r.error) bench = r.log; } }
      }
      const wanted = new Set(prefix.filter((e) => e.kind === 'data').map((e) => e.name));
      const files = Object.fromEntries(Object.entries(st.files).filter(([n]) => wanted.has(basename(n))));
      const notCarried = st.bench.entries.filter((e) => e.kind === 'promote').length;
      const id = nextId(); data.convs[id] = { nb: [], bench: emptyBench().entries, files: {} };
      saveState(id, { nb: { schema: st.nb.schema, entries: prefix }, bench, files });
      sealLog({ kind: 'fork', id, parent: cid, at: b.at || 'end', cutHash: prefix.at(-1)?.hash ?? null, cutSeq: cut, type: c.type, title: `fork of ${c.title}`, notCarried, by });
      return { goto: id, notice: 'Fork created. Its new kernel starts empty; run cells to rebuild its variables.' };
    }
    if (b.op === 'kernel-restart') { delete counts[cid]; if (pyodide) pyodide.runPython(`_hnb_reset(${JSON.stringify(String(cid))})`); const st = stateOf(cid); saveState(cid, { ...st, nb: seal(st.nb, { kind: 'kernel-restart', by, at: Date.now() }) }); return { notice: 'Kernel restarted. Variables cleared; recorded outputs remain.' }; }
    if (b.op === 'run') { await run(cid, b.cell); return { selected: b.cell }; }
    if (b.op === 'runmany') { for (const cell of stateOf(cid).nb.entries.filter((e) => e.kind === 'cell' && e.type === 'code')) { const r = await run(cid, cell.id); if (!r.ok) return { notice: 'Run all stopped at ' + cell.id + ' because the cell raised an error.' }; } return {}; }
    let st = stateOf(cid), r;
    if (b.op === 'edit') { r = editCell(st, { cell: b.cell, source: b.source, by }); if (r.error === 'no change') return {}; }
    else if (b.op === 'add') { const id = 'cell-' + st.nb.entries.length + '-' + Date.now().toString(36); r = addCell(st, { id, type: b.type || 'code', source: b.source || '', lang: 'python', author: by }); r.selected = id; }
    else if (b.op === 'import-ipynb') {
      const j = b.notebook;
      if (j?.nbformat !== 4 || !Array.isArray(j.cells)) throw new Error('Choose a valid nbformat 4 .ipynb notebook');
      if (j.metadata?.kernelspec?.language && j.metadata.kernelspec.language !== 'python') throw new Error('This notebook requires a non-Python kernel');
      for (const cell of j.cells) if (!['code', 'markdown', 'raw'].includes(cell.cell_type) || !(typeof cell.source === 'string' || Array.isArray(cell.source) && cell.source.every((x) => typeof x === 'string'))) throw new Error('Invalid notebook cell');
      const created = createConv({ type: 'notebook', title: b.name?.replace(/\.ipynb$/i, '') || 'Imported notebook' });
      st = stateOf(created.id);
      for (const [i, cell] of j.cells.entries()) {
        const next = addCell(st, { id: `import-${i + 1}`, type: cell.cell_type === 'code' ? 'code' : 'markdown', source: Array.isArray(cell.source) ? cell.source.join('') : cell.source || '', author: by });
        if (next.error) throw new Error(next.error); st = next.state;
      }
      saveState(created.id, { ...st, nb: seal(st.nb, { kind: 'import', name: b.name, by, sha: sha256(JSON.stringify(j)), recordedElsewhere: true }) });
      return { goto: created.id, notice: 'Notebook imported into a new tab. Imported outputs were produced elsewhere; run cells here to record new outputs.' };
    } else if (b.op === 'upload') {
      const name = basename(b.name), bytes = b64ToBytes(b.base64 || '');
      r = addData(st, { name, text: new TextDecoder('utf-8', { fatal: false }).decode(bytes), tables: [], kind: 'file', gaps: [] }, by);
      r.state.files[name] = { ...r.state.files[name], base64: b.base64 };
      r.state = { ...r.state, nb: seal(r.state.nb, { kind: 'file-bytes', name, sha256: sha256Bytes(bytes), by }) };
    } else if (b.op === 'dataset') return { notice: dataOf(st.nb).map((d) => d.name + ' · ' + d.chars + ' characters').join('\n') || 'No data files yet. Upload or drop a file into the notebook.' };
    else if (b.op === 'promote') { const p = promote(st.bench, { card: b.card, to: b.to, by }); r = p.error ? p : { state: { ...st, bench: p.log } }; }
    else if (b.op === 'line') {
      if (b.line.trim() === '/data') return act({ ...b, op: 'dataset' });
      if (b.line.startsWith('/py ')) { const a = await act({ ...b, op: 'add', source: b.line.slice(4) }); return act({ ...b, op: 'run', cell: a.selected }); }
      return { notice: 'Write Python in a code cell; Shift+Enter saves, runs and advances. Files are under ./data/. This tab runs Python itself (Pyodide); start tools/notebook-server.mjs and open the page from it for the persistent IPython kernel.' };
    } else throw new Error('This runtime executes your Python notebook cells; use the workspace for conversation and artifact generation.');
    if (r?.error) throw new Error(r.error); if (r?.state) saveState(cid, r.state); return { selected: r?.selected || null };
  }

  function state(cid) {
    const conv = fold().get(cid);
    const st = stateOf(cid), ex = st.nb.entries.filter((e) => e.kind === 'exec');
    const claims = st.nb.entries.filter((e) => e.kind === 'cell' && e.type === 'claim').map((e) => ({ id: e.id, text: e.source, status: statusOf(st.bench, e.id), method: null, promotions: st.bench.entries.filter((x) => x.kind === 'promote' && x.card === e.id), check: null, control: null }));
    const items = dataOf(st.nb).map((d) => ({ kind: 'source', label: d.name, text: `${d.name} · ${d.chars} characters` }));
    const kernel = loadError ? 'offline' : pyodide ? 'ready' : 'starting';
    return { by, conv, tabs: list(), lineage: conv.parent ? [{ id: conv.parent, title: fold().get(conv.parent)?.title, at: conv.forkedAt, cutHash: conv.forkHash, notCarried: conv.notCarried }] : [],
      server: { runtime: 'pyodide', env: { python: pyVersion || (loadError ? 'unavailable' : 'starting'), pyodide: PYODIDE_VERSION, isolated: true }, model: null, kernel },
      ledgers: { nb: st.nb.entries, bench: st.bench.entries, workspace: logEntries(), analyses: [] }, library: [], audit: { claims, methods: [] },
      dataset: { items, summary: { source: items.length, generated: ex.length } }, methods: { text: `${ex.length} recorded Python cell execution(s), run by Pyodide (CPython in WebAssembly) in this tab. The kernel is persistent per conversation while the page is open; files are under ./data/; exported notebooks re-run outside the page.` } };
  }

  async function engineFetch(url, opts = {}) {
    let path = String(url), query = '';
    try { const u = new URL(String(url), 'http://localhost/'); path = u.pathname; query = u.searchParams.get('c') || ''; } catch (e) {}
    try {
      if (path.endsWith('/notebook/state')) return jsonResponse(state(pick(query).id));
      if (path.endsWith('/notebook/ipynb')) return jsonResponse(toIpynb(stateOf(pick(query).id)));
      if (path.endsWith('/notebook/api')) { const b = JSON.parse(opts.body || '{}'); return jsonResponse(await act(b)); }
      if (path.endsWith('/notebook/bundle')) return jsonResponse({ error: 'The bundle route belongs to the local notebook server; this tab runs Pyodide, and the .ipynb export re-runs wherever Python is. Start tools/notebook-server.mjs for bundles.' }, 404);
    } catch (e) { return jsonResponse({ error: e && e.message || String(e) }, 400); }
    return jsonResponse({ error: 'No such notebook route' }, 404);
  }

  return { fetch: engineFetch, ready, state, act, workspace, by, get pyodide() { return pyodide; }, get error() { return loadError; } };
}
