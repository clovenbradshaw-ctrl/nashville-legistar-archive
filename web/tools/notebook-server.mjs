// Local, persistent Jupyter runtime for the static Holodeck surface.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { openWorkspace } from '../vendor/eoreader7/native/the-fold/surface/notebook-workspace.mjs';
import { addCell, editCell, addData, recordExec, sourceOf, execsOf, dataOf } from '../vendor/eoreader7/native/the-fold/surface/notebook.mjs';
import { seal, promote, statusOf } from '../vendor/eoreader7/native/the-fold/surface/bench.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const hash = s => createHash('sha256').update(s).digest('hex');
const plain = o => o.output_type === 'stream' ? o.text : o.output_type === 'error' ? o.traceback.join('\n') : o.data?.['text/plain'] || '';
const loopback = u => { try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(u).hostname); } catch { return false; } };

export class JupyterSession {
  constructor(dir, python = process.env.HOLODECK_PYTHON || 'python3') {
    fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
    this.dir = dir; this.pending = new Map(); this.seq = 0; this.pid = null; this.status = 'starting';
    this.child = spawn(python, ['-u', path.join(ROOT, 'tools/jupyter-session.py'), dir], { stdio: ['pipe', 'pipe', 'pipe'] });
    let diagnostic = '';
    this.child.stderr.on('data', b => { diagnostic = (diagnostic + b).slice(-4000); });
    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Jupyter kernel startup timed out')), 45000);
      const fail = e => { clearTimeout(timer); reject(e); for (const p of this.pending.values()) p.reject(e); this.pending.clear(); this.status = 'offline'; };
      this.child.on('error', fail);
      this.child.on('exit', () => fail(new Error(diagnostic || 'Jupyter kernel exited. Install tools/notebook-requirements.txt with your Python interpreter.')));
      createInterface({ input: this.child.stdout }).on('line', line => {
        let j; try { j = JSON.parse(line); } catch { return; }
        if (j.ready) { clearTimeout(timer); this.python = j.python; this.pid = j.pid; this.status = 'idle'; resolve(); }
        else if (this.pending.has(j.id)) { const p = this.pending.get(j.id); this.pending.delete(j.id); if (j.pid) this.pid = j.pid; this.status = 'idle'; j.error ? p.reject(new Error(j.error)) : p.resolve(j); }
      });
    });
  }
  async request(body) {
    await this.ready; this.status = 'busy';
    return new Promise((resolve, reject) => { const id = ++this.seq; this.pending.set(id, { resolve, reject }); this.child.stdin.write(JSON.stringify({ id, ...body }) + '\n'); });
  }
  interrupt() { if (this.status === 'busy' && this.pid) process.kill(this.pid, 'SIGINT'); }
  close() { if (this.status === 'busy' && this.pid) { try { this.interrupt(); } catch {} } this.child.stdin.end(); }
}

export function toIpynb(st) {
  const cells = st.nb.entries.filter(e => e.kind === 'cell').map(c => {
    const ex = execsOf(st.nb, c.id).at(-1);
    const base = { id: c.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64), cell_type: c.type === 'code' ? 'code' : 'markdown', metadata: { holodeck: { id: c.id, author: c.author, standing: c.type === 'code' ? 'shown' : 'received', runSeal: ex?.hash } }, source: sourceOf(st.nb, c.id) };
    return c.type === 'code' ? { ...base, execution_count: ex?.env?.execution_count ?? null, outputs: ex?.env?.outputs || [] } : base;
  });
  return { nbformat: 4, nbformat_minor: 5, metadata: { kernelspec: { name: 'python3', display_name: 'Python 3 (ipykernel)', language: 'python' }, language_info: { name: 'python' }, holodeck: { head: st.nb.entries.at(-1)?.hash || null } }, cells };
}

export function createNotebookServer({ dir = path.join(os.homedir(), '.holodeck/notebooks'), by = 'human:local', python, origins = [] } = {}) {
  const workspaces = new Map(), sessions = new Map(), queues = new Map();
  const wsFor = name => {
    const key = hash(String(name || 'default')).slice(0, 24);
    if (!workspaces.has(key)) { const folder = path.join(dir, key); const ws = openWorkspace(folder); if (!ws.list().length) ws.create({ type: 'notebook', by }); workspaces.set(key, { ws, folder, key }); }
    return workspaces.get(key);
  };
  const session = (W, cid) => { const key = W.key + '/' + cid; if (!sessions.has(key) || sessions.get(key).status === 'offline') sessions.set(key, new JupyterSession(path.join(W.folder, 'kernels', cid), python)); return sessions.get(key); };
  const run = async (W, cid, cell) => {
    const st = W.ws.state(cid), c = st.nb.entries.find(e => e.kind === 'cell' && e.id === cell);
    if (c?.type !== 'code') throw new Error('Select a Python code cell');
    if (c.lang !== 'python') throw new Error('The Jupyter kernel runs Python cells');
    const kernel = session(W, cid); await kernel.ready;
    for (const [name, file] of Object.entries(st.files)) fs.writeFileSync(path.join(kernel.dir, 'data', path.basename(name)), file.base64 ? Buffer.from(file.base64, 'base64') : file.text || '');
    const t0 = Date.now(); const watchdog = setTimeout(() => { try { kernel.interrupt(); } catch {} }, 300000);
    let r; try { r = await kernel.request({ code: sourceOf(st.nb, cell) }); } finally { clearTimeout(watchdog); }
    const figures = r.outputs.filter(o => o.data?.['image/png']).map((o, i) => ({ name: `figure-${i + 1}.png`, png: o.data['image/png'], sha: hash(Buffer.from(o.data['image/png'], 'base64')) }));
    const recorded = recordExec(st, { cell, output: r.outputs.map(plain).join('\n'), ok: r.ok, figures, ms: Date.now() - t0, env: { python: kernel.python, runtime: 'jupyter', standing: 'shown', execution_count: r.execution_count, outputs: r.outputs, rawDataShas: Object.fromEntries(Object.entries(st.files).map(([name, f]) => [name, hash(f.base64 ? Buffer.from(f.base64, 'base64') : f.text || '')])), kernelSession: W.key + '/' + cid, priorRunSeal: st.nb.entries.filter(e => e.kind === 'exec').at(-1)?.hash || null } });
    W.ws.save(cid, recorded.state);
    return r;
  };
  const state = (W, cid) => {
    const st = W.ws.state(cid), conv = W.ws.get(cid), ex = st.nb.entries.filter(e => e.kind === 'exec'), k = sessions.get(W.key + '/' + cid);
    const claims = st.nb.entries.filter(e => e.kind === 'cell' && e.type === 'claim').map(c => ({ id: c.id, text: c.source, status: statusOf(st.bench, c.id), method: null, promotions: st.bench.entries.filter(e => e.kind === 'promote' && e.card === c.id), check: null, control: null }));
    const items = dataOf(st.nb).map(d => ({ kind: 'source', label: d.name, text: `${d.name} · ${d.chars} characters` }));
    return { by, conv, tabs: W.ws.list(), lineage: conv.parent ? [{ id: conv.parent, title: W.ws.get(conv.parent)?.title, at: conv.forkedAt, cutHash: conv.forkHash, notCarried: conv.notCarried }] : [],
      server: { runtime: 'jupyter', env: { python: k?.python || 'starts on first run', isolated: false }, model: null, kernel: k?.status || 'not started' },
      ledgers: { nb: st.nb.entries, bench: st.bench.entries, workspace: W.ws.entries(), analyses: [] }, library: [], audit: { claims, methods: [] },
      dataset: { items, summary: { source: items.length, generated: ex.length } }, methods: { text: `${ex.length} recorded Python cell execution(s), using a persistent IPython kernel. Runs preserve source, input hashes, execution order and outputs; earlier kernel state can affect later cells. Restart and run all to reproduce the notebook in cell order.` } };
  };
  const act = async (W, cid, b) => {
    const ws = W.ws;
    if (b.op === 'ws-new') { const r = ws.create({ type: b.type || 'notebook', title: b.title, by }); if (r.error) throw new Error(r.error); return { goto: r.id }; }
    if (b.op === 'ws-fork') { const r = ws.fork(cid, { at: b.at || 'end', by }); if (r.error) throw new Error(r.error); return { goto: r.id, notice: 'Fork created. Its new kernel starts empty; run cells to rebuild its variables.' }; }
    if (b.op === 'ws-retype') return ws.retype(cid, b.type, by);
    if (b.op === 'ws-rename') return ws.rename(cid, b.title, by);
    if (b.op === 'ws-close') { const r = ws.close(cid, by); if (r.error) return r; sessions.get(W.key + '/' + cid)?.close(); return { goto: ws.list()[0]?.id }; }
    if (b.op === 'kernel-restart') { const key = W.key + '/' + cid; sessions.get(key)?.close(); sessions.delete(key); const k = session(W, cid); await k.ready; const st = ws.state(cid); ws.save(cid, { ...st, nb: seal(st.nb, { kind: 'kernel-restart', by, at: Date.now() }) }); return { notice: 'Kernel restarted. Variables cleared; recorded outputs remain.' }; }
    if (b.op === 'run') { await run(W, cid, b.cell); return { selected: b.cell }; }
    if (b.op === 'runmany') { for (const c of ws.state(cid).nb.entries.filter(e => e.kind === 'cell' && e.type === 'code')) { const r = await run(W, cid, c.id); if (!r.ok) return { notice: 'Run all stopped at ' + c.id + ' because the cell raised an error.' }; } return {}; }
    let st = ws.state(cid), r;
    if (b.op === 'edit') { r = editCell(st, { cell: b.cell, source: b.source, by }); if (r.error === 'no change') return {}; }
    else if (b.op === 'add') { const id = 'cell-' + st.nb.entries.length + '-' + Date.now().toString(36); r = addCell(st, { id, type: b.type || 'code', source: b.source || '', lang: 'python', author: by }); r.selected = id; }
    else if (b.op === 'import-ipynb') {
      const j = b.notebook;
      if (j?.nbformat !== 4 || !Array.isArray(j.cells)) throw new Error('Choose a valid nbformat 4 .ipynb notebook');
      if (j.metadata?.kernelspec?.language && j.metadata.kernelspec.language !== 'python') throw new Error('This notebook requires a non-Python kernel');
      for (const c of j.cells) if (!['code', 'markdown', 'raw'].includes(c.cell_type) || !(typeof c.source === 'string' || Array.isArray(c.source) && c.source.every(x => typeof x === 'string'))) throw new Error('Invalid notebook cell');
      const created = ws.create({ type: 'notebook', title: b.name?.replace(/\.ipynb$/i, '') || 'Imported notebook', by });
      st = ws.state(created.id);
      for (const [i, c] of j.cells.entries()) {
        if (!['code', 'markdown', 'raw'].includes(c.cell_type)) throw new Error('Unsupported cell type');
        const next = addCell(st, { id: `import-${i + 1}`, type: c.cell_type === 'code' ? 'code' : 'markdown', source: Array.isArray(c.source) ? c.source.join('') : c.source || '', author: by });
        if (next.error) throw new Error(next.error); st = next.state;
      }
      st = { ...st, nb: seal(st.nb, { kind: 'import', name: b.name, by, sha: hash(JSON.stringify(j)), recordedElsewhere: true }) }; ws.save(created.id, st);
      return { goto: created.id, notice: 'Notebook imported into a new tab. Imported outputs were produced elsewhere; run cells here to record new outputs.' };
    } else if (b.op === 'upload') {
      const name = path.basename(b.name || 'data.txt'), bytes = Buffer.from(b.base64 || '', 'base64');
      r = addData(st, { name, text: bytes.toString('utf8'), tables: [], kind: 'file', gaps: [] }, by);
      r.state.files[name] = { ...r.state.files[name], base64: bytes.toString('base64') };
      r.state = { ...r.state, nb: seal(r.state.nb, { kind: 'file-bytes', name, sha256: hash(bytes), by }) };
    } else if (b.op === 'dataset') return { notice: dataOf(st.nb).map(d => d.name + ' · ' + d.chars + ' characters').join('\n') || 'No data files yet. Upload or drop a file into the notebook.' };
    else if (b.op === 'promote') { const p = promote(st.bench, { card: b.card, to: b.to, by }); r = p.error ? p : { state: { ...st, bench: p.log } }; }
    else if (b.op === 'line') {
      if (b.line.trim() === '/data') return act(W, cid, { op: 'dataset' });
      if (b.line.startsWith('/py ')) { const a = await act(W, cid, { op: 'add', source: b.line.slice(4) }); return act(W, cid, { op: 'run', cell: a.selected }); }
      return { notice: 'Write Python in a code cell; Shift+Enter saves, runs and advances. Files are under ./data/. Use Chat or Fold in the workspace toolbar for questions or artifact generation.' };
    } else throw new Error('Use the workspace Chat or Fold mode for conversation and artifact generation. This runtime executes your Python notebook cells.');
    if (r?.error) throw new Error(r.error); if (r?.state) ws.save(cid, r.state); return { selected: r?.selected || null };
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1'), origin = req.headers.origin;
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL('http://' + req.headers.host).hostname)) { res.writeHead(403); res.end('Invalid host'); return; }
      if (origin && !loopback(origin) && !origins.includes(origin)) { res.writeHead(403); res.end('Origin not allowed; use the local Holodeck URL'); return; }
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Holodeck-Notebook, X-Holodeck-Workspace'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
      if (url.pathname.startsWith('/notebook/')) {
        const W = wsFor(req.headers['x-holodeck-workspace'] || url.searchParams.get('w'));
        const pick = id => W.ws.list().find(c => c.id === id) || W.ws.list()[0];
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'GET' && url.pathname === '/notebook/state') { const c = pick(url.searchParams.get('c')); res.end(JSON.stringify(state(W, c.id))); return; }
        if (req.method === 'GET' && url.pathname === '/notebook/ipynb') { const c = pick(url.searchParams.get('c')); res.end(JSON.stringify(toIpynb(W.ws.state(c.id)), null, 2)); return; }
        if (req.method === 'POST' && url.pathname === '/notebook/api') {
          if (req.headers['x-holodeck-notebook'] !== '1') { res.writeHead(403); res.end(JSON.stringify({ error: 'Notebook request header required' })); return; }
          let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 32 * 1024 * 1024) throw new Error('File exceeds 32 MB'); }
          const b = JSON.parse(body), c = pick(b.c), key = W.key + '/' + c.id;
          if (b.op === 'kernel-interrupt') { sessions.get(key)?.interrupt(); res.end(JSON.stringify({ notice: 'Interrupt requested' })); return; }
          const previous = queues.get(key) || Promise.resolve();
          const job = previous.catch(() => {}).then(() => act(W, c.id, b)); queues.set(key, job);
          const r = await job; if (queues.get(key) === job) queues.delete(key); res.end(JSON.stringify(r)); return;
        }
        res.writeHead(404); res.end(JSON.stringify({ error: 'No such notebook route' })); return;
      }
      const filename = path.resolve(ROOT, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      const rel = path.relative(ROOT, filename);
      if (rel.startsWith('..') || rel.split(path.sep).some(p => p.startsWith('.')) || !['.html', '.js', '.mjs', '.json', '.css', '.svg', '.png', '.woff2'].includes(path.extname(filename))) { res.writeHead(404); res.end(); return; }
      const type = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
      let content = fs.readFileSync(filename); if (filename === path.join(ROOT, 'index.html')) content = content.toString().replace('<head>', '<head><script>window.__holodeckNotebookBase=location.origin;</script>'); res.setHeader('Content-Type', type[path.extname(filename)] || 'application/octet-stream'); res.end(content);
    } catch (e) { res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: e.message })); }
  });
  server.on('close', () => { for (const s of sessions.values()) s.close(); });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k, fallback) => args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : fallback;
  const server = createNotebookServer({ dir: opt('dir', undefined), by: opt('by', 'human:local'), python: opt('python', undefined), origins: args.flatMap((a, i) => a === '--origin' ? [args[i + 1]] : []) });
  const port = Number(opt('port', 8900)); server.listen(port, '127.0.0.1', () => console.log(`Holodeck + Jupyter: http://127.0.0.1:${port}/`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
