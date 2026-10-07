// The Holodeck notebook surface. Default runtime: tools/notebook-server.mjs,
// with a persistent ipykernel worker per conversation and workspace. Runs,
// edits, forks and claims use the existing EOReader7 append-only ledger code;
// every chain is verified again in this browser. The older EOReader7 data
// notebook server is still supported where its richer state API is available.
import { verifyChain, phrase, statusOf, support, STATUSES } from './vendor/eoreader7/native/the-fold/surface/bench.mjs';
import { sourceOf, execsOf, editsOf, dataOf, stale } from './vendor/eoreader7/native/the-fold/surface/notebook.mjs';

export const DEFAULT_SERVER = 'http://127.0.0.1:8900';
const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
/** serverBase(stored) -> a loopback base URL; anything else is refused (this pane never talks to a non-local host). */
export function serverBase(stored) { const s = String(stored || '').trim().replace(/\/+$/, ''); return LOOPBACK.test(s) ? s : DEFAULT_SERVER; }

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>');
/** mdToHtml — headings, bold/italic/code, bullets, paragraphs; everything escaped first (the same small markdown the fold's views use). */
export function mdToHtml(src) {
  const out = []; let list = false;
  for (const line of String(src ?? '').split('\n')) {
    const h = line.match(/^(#{1,3})\s+(.*)$/), li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    if (h) out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`); else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('');
}

/** verifyState(S) -> { nb, bench, workspace, analyses } each { ok, at?, reason? } — computed HERE, from the raw entries. */
export function verifyState(S) {
  const v = {}; for (const k of ['nb', 'bench', 'workspace', 'analyses']) v[k] = verifyChain({ entries: (S && S.ledgers && S.ledgers[k]) || [] });
  return v;
}
/** turnsOf(nb) — an `askN` note opens a turn and its `ansN` note closes it; everything between is the work (as the fold's views group it). */
export function turnsOf(nb) {
  const cells = nb.entries.filter((e) => e.kind === 'cell'), out = []; let cur = null;
  for (const c of cells) {
    if (c.type === 'markdown' && /^ask\d+x*$/.test(c.id)) { cur = { ask: c, work: [], ans: null }; out.push(cur); continue; }
    if (cur && c.type === 'markdown' && /^ans\d+x*$/.test(c.id)) { cur.ans = c; cur = null; continue; }
    if (cur) cur.work.push(c); else out.push({ loose: c });
  }
  return out;
}
const TYPES = [['chat', 'Chat'], ['generate', 'Generate'], ['notebook', 'Notebook']];
/** runsCells(S) — the pane's cell-runtime modes: a local IPython kernel, or Pyodide in this tab. The colony ledger is neither. */
const runsCells = (S) => !!S && ['jupyter', 'pyodide'].includes(S.server && S.server.runtime);

const CSS = `
.hnb{display:flex;flex-direction:column;gap:10px;font:14px/1.5 'Hanken Grotesk',system-ui,sans-serif;color:var(--ink)}
.hnb *{box-sizing:border-box}.hnb [hidden]{display:none!important}
.hnb button{font:500 13px 'Hanken Grotesk',sans-serif;background:none;border:1px solid var(--line2);border-radius:8px;padding:4px 11px;color:var(--ink);cursor:pointer}
.hnb button:hover{border-color:var(--acc)}.hnb button.pri{background:var(--acc2);border-color:var(--acc2);color:#fff}
.hnb .mono,.hnb code,.hnb pre,.hnb textarea{font-family:'JetBrains Mono',ui-monospace,monospace}
.hnb .mode{display:flex;gap:8px 12px;align-items:center;flex-wrap:wrap;font:500 13px 'Hanken Grotesk';color:var(--mut)}
.hnb .dot{width:8px;height:8px;border-radius:50%;flex:none}
.hnb .badge{font:500 12px 'JetBrains Mono';border:1px solid var(--line2);border-radius:999px;padding:0 8px;color:var(--mut)}.hnb .badge.ok{color:var(--ok);border-color:var(--ok)}.hnb .badge.bad{color:var(--bad);border-color:var(--bad);font-weight:600}
.hnb .tabs{display:flex;gap:4px;overflow-x:auto;border-bottom:1px solid var(--line);padding-bottom:0;scrollbar-width:thin}
.hnb .tab{all:unset;display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--line);border-bottom:0;border-radius:8px 8px 0 0;background:var(--s2);white-space:nowrap;cursor:pointer;font:500 13px 'Hanken Grotesk';color:var(--ink2)}
.hnb .tab.on{background:var(--s1);color:var(--ink);box-shadow:inset 0 2px 0 var(--acc)}
.hnb .ty{font:600 10px 'JetBrains Mono';letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:0 6px;color:var(--bg)}.hnb .ty.chat{background:var(--green)}.hnb .ty.generate{background:var(--pink)}.hnb .ty.notebook{background:var(--blue)}
.hnb .tab .x{color:var(--dim);padding:0 2px}.hnb .tab .x:hover{color:var(--bad)}
.hnb .plus{position:relative}.hnb .menu{position:absolute;z-index:30;top:100%;left:0;background:var(--s1);border:1px solid var(--line2);border-radius:8px;padding:4px;display:flex;flex-direction:column;gap:2px;min-width:170px}
.hnb .menu button{border:0;text-align:left}
.hnb .lineage{font:400 13px 'Hanken Grotesk';color:var(--mut)}
.hnb .seg{display:flex;border:1px solid var(--line2);border-radius:8px;overflow:hidden}.hnb .seg button{border:0;border-radius:0;color:var(--mut)}.hnb .seg button.on{background:var(--sel);color:var(--ink)}
.hnb .bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.hnb .cell{display:grid;grid-template-columns:86px minmax(0,1fr);gap:4px 10px;padding:4px 0;border-left:3px solid transparent}.hnb .cell.sel{border-left-color:var(--acc)}
.hnb .pr{text-align:right;font:500 12px/1.9 'JetBrains Mono';color:var(--acc);user-select:none}.hnb .pr.o{color:var(--amber)}.hnb .pr .who{display:block;color:var(--dim);font-size:11px;line-height:1.3;overflow-wrap:anywhere}
.hnb textarea.code{width:100%;min-height:44px;resize:vertical;background:var(--s2);color:var(--ink);border:1px solid var(--line2);border-radius:8px;padding:7px 9px;font-size:13px;line-height:1.45;outline:none}
.hnb textarea.code:focus{border-color:var(--acc)}
.hnb pre.out{margin:0;white-space:pre-wrap;overflow:auto;max-height:420px;font-size:13px;color:var(--ink2);background:none;padding:2px 2px}.hnb pre.out.bad{color:var(--bad)}
.hnb img.fig{max-width:100%;display:block;margin:6px 0;border-radius:6px;background:#fff}
.hnb .meta{font:400 12px 'JetBrains Mono';color:var(--dim)}.hnb .stale{color:var(--amber)}
.hnb .md p{margin:.3em 0}.hnb .md h3,.hnb .md h4,.hnb .md h5{margin:.5em 0 .2em;font:600 15px 'Hanken Grotesk'}.hnb .md ul{margin:.2em 0 .2em 1.1em;padding:0}.hnb .md code{background:var(--s2);padding:0 4px;border-radius:4px;font-size:.9em}
.hnb .claim{border:1px solid var(--line);border-left:4px solid var(--dim);border-radius:8px;padding:8px 12px;background:var(--s1)}.hnb .claim.computed_in_range,.hnb .claim.proved{border-left-color:var(--ok)}
.hnb .claim .st{font:600 11px 'JetBrains Mono';letter-spacing:.05em;text-transform:uppercase;color:var(--mut)}
.hnb .chip{font:500 11px 'JetBrains Mono';border:1px solid var(--line2);border-radius:999px;padding:0 7px;color:var(--mut);display:inline-block;margin:2px 4px 2px 0}
.hnb .fk{font:500 11px 'JetBrains Mono';padding:0 7px;margin-top:4px;border-radius:999px;color:var(--mut)}
.hnb .given{display:flex;flex-wrap:wrap;gap:6px}.hnb .given span{border:1px solid var(--line);border-radius:6px;padding:1px 8px;font:12px 'JetBrains Mono';color:var(--ink2);background:var(--s1)}
.hnb .bub{display:flex}.hnb .bub.me{justify-content:flex-end}.hnb .bub .t{max-width:88%;border-radius:18px;padding:10px 14px;background:var(--s1);border:1px solid var(--line)}
.hnb .bub.me .t{background:#8b5cf6;color:#fff;border-color:#8b5cf6;border-radius:20px 20px 4px 20px}.hnb .bub.ai .t{width:92%;font:400 16px/1.6 'Newsreader',serif}
.hnb details>summary{cursor:pointer;color:var(--mut);font:500 13px 'Hanken Grotesk'}
.hnb .gen{background:var(--s1);border:1px solid var(--line);border-radius:12px;padding:22px 28px;font:400 16px/1.6 'Newsreader',serif}
.hnb .gen h2{font:500 24px/1.25 'Newsreader',serif;margin:.2em 0}.hnb .gen h6{font:600 11px 'JetBrains Mono';letter-spacing:.08em;text-transform:uppercase;color:var(--acc);margin:18px 0 6px}
.hnb table{border-collapse:collapse;width:100%;font:13px 'Hanken Grotesk'}.hnb td,.hnb th{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}
.hnb .cmd{position:sticky;bottom:0;z-index:12;background:var(--hdr);backdrop-filter:blur(8px);padding:8px 0 2px;border-top:1px solid var(--line)}
.hnb .cmd textarea{display:block;resize:none;max-height:40vh;overflow:auto;width:100%;background:var(--s1);border:1px solid var(--line2);border-radius:10px;padding:9px 12px;color:var(--ink);font:400 15px 'Hanken Grotesk';outline:none}.hnb .cmd textarea:focus{border-color:var(--acc)}
.hnb .notice{white-space:pre-wrap;font:12px/1.5 'JetBrains Mono';background:var(--s1);border:1px solid var(--line2);border-radius:10px;padding:8px 12px;max-height:45vh;overflow:auto;position:relative}.hnb .notice.err{border-color:var(--bad);color:var(--bad)}.hnb .notice .x{position:absolute;right:8px;top:4px;cursor:pointer;color:var(--dim)}
.hnb-portal{display:contents}.hnb .drawer{position:fixed;top:0;right:0;bottom:0;width:min(560px,100vw);z-index:60;background:var(--bg);border-left:1px solid var(--line2);display:flex;flex-direction:column;box-shadow:-8px 0 24px #0005}
.hnb .drawer .hd{display:flex;gap:6px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line)}.hnb .drawer .bd{overflow:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px}
.hnb .sk{border:1px solid var(--line);border-radius:10px;padding:8px 12px;background:var(--s1)}.hnb .sk.off{opacity:.75}.hnb .sk .row{display:flex;gap:8px;align-items:center}
.hnb .sw{width:40px;height:22px;border-radius:11px;background:var(--line2);position:relative;border:0;padding:0;flex:none}.hnb .sw.on{background:var(--ok)}.hnb .sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:8px;background:#fff;transition:left .12s}.hnb .sw.on::after{left:21px}
.hnb .why{display:flex;gap:6px;margin-top:6px}.hnb .why input{flex:1;background:var(--s2);border:1px solid var(--line2);border-radius:8px;color:var(--ink);padding:4px 8px;font:13px 'Hanken Grotesk'}
.hnb .ok{color:var(--ok)}.hnb .brk{color:var(--bad);font-weight:700}.hnb .k{color:var(--mut)}
.hnb .empty{border:1px dashed var(--line2);border-radius:12px;padding:18px 20px;display:flex;flex-direction:column;gap:8px}
.hnb .drop{outline:2px dashed var(--acc);outline-offset:4px}
@media (max-width:640px){.hnb .cell{grid-template-columns:1fr}.hnb .pr{text-align:left}.hnb .gen{padding:14px}.hnb .drawer{width:100vw}}
`;

/** mount(el, { base, fetch }) — draw the pane into `el`. Returns { refresh, state } for tests and callers. Re-mounting into a new element
 *  (the host view re-rendered) keeps the current conversation. */
const LAST = { base: null, S: null }; // the last state drawn, so a remount (the host view re-rendered) draws at once instead of flashing "Connecting…"
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
let PY_MOD = null; // the in-tab Pyodide runtime module, imported once; the pane falls back to it when no local server answers
const browserEngine = (workspace) => { if (!PY_MOD) PY_MOD = import(new URL('holodeck-pyodide.js', import.meta.url).href); return PY_MOD.then((M) => M.pyodideEngine({ workspace })); };
const LIVE = new Map(); // base -> { root, api }: ONE pane per server. The host (React) may hand us a new element on any re-render;
                       // the pane's root is MOVED into it, so work in flight, focus and the open drawer survive (a second instance would race the first).
export function mount(el, opts = {}) {
  const base = serverBase(opts.base ?? store.get('hd:notebook'));
  if (typeof window !== 'undefined') window.__hnbMounts = (window.__hnbMounts || 0) + 1;
  const workspace = String(opts.workspace || 'default');
  const key = base + ':' + workspace;
  const live = !opts.fetch && LIVE.get(key);
  if (live) { if (live.root.parentNode !== el) { el.innerHTML = ''; el.appendChild(live.root); } return live.api; }
  let engine = null, engineStarting = false; // engine: the Pyodide runtime, chosen only if the local server does not answer
  const rawFetch = opts.fetch || ((u, o) => fetch(u, o));
  const F = (u, o = {}) => engine ? engine.fetch(u, o) : rawFetch(u, { ...o, headers: { ...o.headers, 'X-Holodeck-Workspace': workspace, 'X-Holodeck-Notebook': '1' } });
  if (!document.getElementById('hnb-css')) { const s = document.createElement('style'); s.id = 'hnb-css'; s.textContent = CSS; document.head.appendChild(s); }
  const ui = { c: store.get('hd:nb:c:' + key) || '', S: !opts.fetch && LAST.base === key ? LAST.S : null /* a pane with its own fetch never starts from another pane's state */, err: null, notice: null, noticeErr: false, drawer: null, sel: null, menu: false, why: {}, dsq: '', dsHits: null, busy: '', starting: false };
  let storedDrafts = []; try { storedDrafts = JSON.parse(store.get('hd:nb:drafts:' + key) || '[]'); } catch {}
  const drafts = new Map(storedDrafts); const persistDrafts = () => store.set('hd:nb:drafts:' + key, JSON.stringify([...drafts])); let commandDraft = '';
  const root = document.createElement('div'); root.className = 'hnb'; el.innerHTML = ''; el.appendChild(root);
  // the drawer lives in a body-level portal: the host page's ancestors (backdrop-filter, transforms) would otherwise turn position:fixed
  // into position-within-the-column, and on a phone the drawer would be a strip instead of the whole screen
  const portal = document.createElement('div'); portal.className = 'hnb hnb-portal'; document.body.appendChild(portal);
  const $q = (sel) => root.querySelector(sel) || portal.querySelector(sel);
  setInterval(() => { portal.style.display = root.isConnected ? 'contents' : 'none'; }, 400); // the drawer goes when the pane goes (another view)

  async function refresh() {
    try { const r = await F(`${base}/notebook/state${ui.c ? `?c=${encodeURIComponent(ui.c)}` : ''}`, { cache: 'no-store' }); if (!r.ok) throw new Error(`the server answered ${r.status}`); ui.S = await r.json(); ui.err = null; ui.c = ui.S.conv.id; store.set('hd:nb:c:' + key, ui.c); if (!opts.fetch) { LAST.base = key; LAST.S = ui.S; } }
    catch (e) {
      ui.S = null; ui.err = String(e && e.message || e);
      if (!opts.fetch && !engine && !engineStarting) { // no local server: start the notebook's own Python in this tab, by itself
        engineStarting = true; ui.starting = true; draw();
        browserEngine(workspace).then((eng) => { engine = eng; ui.starting = false; return refresh(); })
          .catch((err) => { engineStarting = false; ui.starting = false; ui.err = 'Python in the browser did not start: ' + String(err && err.message || err); draw(); });
        return;
      }
    }
    draw();
  }
  async function call(body, { quiet = false } = {}) {
    ui.busy = body.op; draw();
    try {
      const r = await F(`${base}/notebook/api`, { method: 'POST', body: JSON.stringify({ c: ui.c, ...body }) }); const j = await r.json();
      if (!j.error && body.op === 'edit') { drafts.delete(ui.c + ':' + body.cell); persistDrafts(); }
      if (j.goto) { ui.c = j.goto; commandDraft = ''; } if (j.selected) ui.sel = j.selected;
      if (j.error) { ui.notice = j.error; ui.noticeErr = true; } else if (j.notice && !quiet) { ui.notice = j.notice; ui.noticeErr = false; }
      await refresh(); ui.busy = ''; draw(); return j; // busy clears only once the new state is drawn
    } catch (e) { ui.busy = ''; ui.notice = 'The local notebook server did not answer: ' + String(e && e.message || e); ui.noticeErr = true; draw(); return { error: ui.notice }; }
  }

  // ── drawing ──────────────────────────────────────────────────────────────
  const st = () => ({ nb: { entries: ui.S.ledgers.nb }, bench: { entries: ui.S.ledgers.bench } });
  const forkBtn = (at) => `<button class="fk" data-act="fork" data-at="${esc(at)}" title="Fork this conversation from here: a new tab that starts with everything up to this point, seal for seal">⑂ fork</button>`;
  function cellHtml(s, c, counter) {
    const src = drafts.get(ui.c + ':' + c.id) ?? sourceOf(s.nb, c.id), ex = execsOf(s.nb, c.id), last = ex.at(-1), edits = editsOf(s.nb, c.id).length, sel = ui.sel === c.id ? ' sel' : '';
    const proposed = c.proposed ? `<span class="chip">proposed by ${esc(c.author)}</span>` : '';
    const meth = c.method ? `<span class="chip" title="method ${esc(c.method.id)} · code ${esc(c.method.codeSha || '')}">method: ${esc(c.method.name)}</span>` : '';
    const who = `<span class="who">${esc(c.id)}</span>${forkBtn(c.id)}`;
    if (c.type === 'markdown') return `<div class="cell${sel}" data-cell="${esc(c.id)}" data-type="markdown"><div class="pr">${who}</div><div><div class="md" data-md="${esc(c.id)}" title="double-click to edit">${mdToHtml(src)}</div><textarea class="code" data-src="${esc(c.id)}" hidden>${esc(src)}</textarea>${edits ? `<div class="meta">${edits} edit(s)</div>` : ''}${proposed}</div></div>`;
    if (c.type === 'claim') {
      const status = statusOf(s.bench, c.id), sup = support(s.bench, c.id);
      const up = STATUSES.filter((x) => STATUSES.indexOf(x) > STATUSES.indexOf(status)).map((x) => `<button data-act="promote" data-card="${esc(c.id)}" data-to="${x}">promote → ${esc(x.replace(/_/g, ' '))}</button>`).join(' ');
      return `<div class="cell${sel}" data-cell="${esc(c.id)}" data-type="claim"><div class="pr">${who}</div><div><div class="claim ${esc(status)}"><div class="st">${esc(status.replace(/_/g, ' '))} · ${sup.checks.length} check(s) · ${sup.controls.length} control(s) that failed as they should${sup.failed.length ? ` · <span class="brk">${sup.failed.length} check(s) came back false</span>` : ''}</div><div>${esc(phrase(s.bench, c.id))}</div><div class="bar" style="margin-top:6px">${up}</div></div>${proposed}${meth}</div></div>`;
    }
    const why = stale(s, c.id), n = last ? (last.env?.execution_count ?? counter(last)) : ' ';
    const figs = (last?.figures || []).map((f) => `<img class="fig" alt="figure ${esc(f.name)} (sha256 ${esc(String(f.sha).slice(0, 12))})" src="data:image/png;base64,${f.png}">`).join('');
    const htmlOutputs = (last?.env?.outputs || []).filter(o => o.data?.['text/html']).map(o => `<iframe title="Cell output" sandbox="" srcdoc="${esc(Array.isArray(o.data['text/html']) ? o.data['text/html'].join('') : o.data['text/html'])}" style="width:100%;height:240px;border:1px solid var(--line);background:white;border-radius:8px"></iframe>`).join('');
    const rows = Math.min(18, Math.max(2, src.split('\n').length));
    const bound = c.for ? `<span class="chip">${esc(c.role)} of ${esc(c.for)}</span>` : '';
    return `<div class="cell${sel}" data-cell="${esc(c.id)}" data-type="code"><div class="pr">In [${last ? n : '&nbsp;'}]:${who.replace('<span class="who">', `<span class="who">${esc(c.lang)} · `)}</div><div>${bound}${meth}${proposed}<textarea class="code" data-src="${esc(c.id)}" rows="${rows}" spellcheck="false">${esc(src)}</textarea>${last ? '' : `<div class="meta">${why ? `<span class="stale">${esc(why)}</span>` : ''}</div>`}</div></div>` +
      (last ? `<div class="cell${sel}" data-out="${esc(c.id)}"><div class="pr o">Out [${n}]:${last.env && (last.env.runtime === 'jupyter' || last.env.runtime === 'pyodide') ? '<span class="who">raw output · shown</span>' : ''}</div><div><pre class="out${last.ok ? '' : ' bad'}">${esc(last.output) || (last.figures.length ? '' : '(no output)')}</pre>${figs}${htmlOutputs}<details class="meta"><summary>Run details${why ? ' · ' + esc(why) : ''}</summary><div>${last.ms ?? '?'} ms · ${ex.length} run(s) · code ${esc(last.codeSha.slice(0, 10))} · saw ${Object.keys(last.dataShas).length} file(s) · scope ${esc(last.scope.kind)}${last.result === null ? '' : ` · result ${last.result}`}${last.env && last.env.python ? ` · python ${esc(last.env.python)}, ${last.env.numpy ? 'numpy ' + esc(last.env.numpy) : 'Jupyter'}` : ''}${edits ? ` · ${edits} edit(s)` : ''}${why ? ` · <span class="stale">⚠ ${esc(why)}</span>` : ''}</div></details></div></div>` : '');
  }
  const givenHtml = (s) => { const g = dataOf(s.nb).map((d) => `<span title="${esc((d.gaps || []).map((x) => x.kind + ': ' + x.reason).join('\n'))}"><b>${esc(d.name)}</b> ${esc(d.dataKind)} · ${d.chars} chars${d.tables ? ` · ${d.tables} table(s)` : ''}${(d.gaps || []).length ? ` · ⚠ ${esc(d.gaps.map((x) => x.kind).join(', '))}` : ''}</span>`).join(''); return g ? `<div class="given">${g}</div>` : ''; };
  const asked = (s, t) => (sourceOf(s.nb, t.ask.id).match(/\*\*Asked:\*\* ([\s\S]*?)\n\n/) || [])[1] || '';
  const howNote = (s, t) => sourceOf(s.nb, t.ask.id).split('\n\n').slice(1).join('\n\n');

  function notebookView(s, counter) {
    const cells = s.nb.entries.filter((e) => e.kind === 'cell').map((c) => cellHtml(s, c, counter)).join('');
    const jupyter = runsCells(ui.S); // Jupyter and the in-tab Pyodide runtime both run cells; only the colony shows claims
    return `<div class="bar"><button data-act="run-sel" title="Shift+Enter in a cell">▶ Run</button><button data-act="run-all">▶▶ Run all</button><button data-act="add" data-t="code">+ Code</button><button data-act="add" data-t="markdown">+ Markdown</button>${jupyter ? '' : '<button data-act="add" data-t="claim">+ Claim</button>'}<label style="cursor:pointer;border:1px solid var(--line2);border-radius:8px;padding:4px 11px">Upload data<input data-file type="file" multiple hidden></label><button data-act="line" data-line="/data">Data</button><button data-act="line" data-line="/tools">Tools</button><button data-act="line" data-line="/help">/ Commands</button></div>${givenHtml(s)}<div class="cells">${cells || `<p class="k">Empty. Drop a file on this pane, or type below — a question in plain words, <code>/py 1+1</code>, or <code>/help</code>.</p>`}</div>`;
  }
  function chatView(s, counter) {
    const b = turnsOf(s.nb).map((t) => {
      if (t.loose) return t.loose.type === 'markdown' ? `<div class="bub me"><div class="t md">${mdToHtml(sourceOf(s.nb, t.loose.id))}${forkBtn(t.loose.id)}</div></div>` : `<div class="bub ai"><div class="t">${cellHtml(s, t.loose, counter)}</div></div>`;
      return `<div class="bub me"><div class="t">${esc(asked(s, t))}</div></div><div class="bub ai"><div class="t">${t.ans ? `<div class="md">${mdToHtml(sourceOf(s.nb, t.ans.id))}</div>${forkBtn(t.ans.id)}` : '<span class="k">no answer recorded</span>'}<details><summary>how this was produced · ${t.work.length} cells · the method, its controls, the runs</summary><div class="md">${mdToHtml(howNote(s, t))}</div><div class="cells">${t.work.map((c) => cellHtml(s, c, counter)).join('')}</div></details></div></div>`;
    }).join('');
    return `${givenHtml(s)}${b || `<p class="k">Ask about your data in plain words — or drop a file on this pane first.</p>`}`;
  }
  function generateView(s) {
    const A = ui.S.audit, ts = turnsOf(s.nb).filter((t) => t.ask);
    const row = (c) => `<tr><td><b>${esc(c.id.replace(/^k-/, ''))}</b><br>${esc(c.text)}</td><td>${esc(c.status)}</td><td>${c.method ? esc(c.method.name) : 'by hand'}</td><td>${c.check ? `${c.check.result} <span class="mono k">${esc(c.check.hash)}</span>` : '—'}</td><td>${c.control ? `${c.control.result} <span class="mono k">${esc(c.control.hash)}</span>` : '—'}</td><td>${c.promotions.length ? c.promotions.map((p) => `${esc(p.to)} · ${esc(p.by)}`).join('<br>') : 'not adopted'}${STATUSES.filter((x) => STATUSES.indexOf(x) > STATUSES.indexOf(c.status)).map((x) => `<br><button data-act="promote" data-card="${esc(c.id)}" data-to="${x}">→ ${esc(x.replace(/_/g, ' '))}</button>`).join('')}</td></tr>`;
    const docs = ts.map((t) => { const ids = new Set(t.work.filter((c) => c.type === 'claim').map((c) => c.id)); const cs = A.claims.filter((c) => ids.has(c.id));
      return `<section data-gen="${esc(t.ask.id)}"><h2>${esc(asked(s, t))}</h2><div class="md">${t.ans ? mdToHtml(sourceOf(s.nb, t.ans.id).replace(/\n\*\*Claims \(proposed[\s\S]*$/, '')) : ''}</div>${forkBtn((t.ans || t.ask).id)}<h6>How this was found</h6><div class="md">${mdToHtml(howNote(s, t))}</div><h6>Claims and what stands behind them</h6><table><tr><th>claim</th><th>status</th><th>method</th><th>check</th><th>control (must be false)</th><th>adopted?</th></tr>${cs.map(row).join('')}</table></section>`; }).join('<hr style="border:0;border-top:1px solid var(--line);margin:26px 0">');
    const v = verifyState(ui.S), ok = (x) => (x.ok ? '<span class="ok">verifies</span>' : `<span class="brk">CHAIN BROKEN at ${esc(x.at)} — ${esc(x.reason)}</span>`);
    return `<div class="bar"><input data-gen-q placeholder="Describe what to find out — e.g. “is the bursty column heavy-tailed?”" style="flex:1;min-width:200px;background:var(--s1);border:1px solid var(--line2);border-radius:8px;color:var(--ink);padding:6px 10px;font:14px 'Hanken Grotesk'"><button class="pri" data-act="gen">Generate</button></div><div class="gen">${givenHtml(s)}${docs || '<p class="k">Nothing generated yet.</p>'}<h6>Methods</h6><p data-methods>${esc(ui.S.methods.text)}</p><h6>Audit</h6><p style="font:13px 'Hanken Grotesk'">Checked in this page: notebook chain ${ok(v.nb)} · claim ledger ${ok(v.bench)} · workspace ${ok(v.workspace)} · learned methods ${ok(v.analyses)}. <button data-act="drawer" data-tab="audit">Open the full audit</button></p></div>`;
  }
  function drawerHtml() {
    const S = ui.S, lib = S.library, all = lib.length && lib.every((k) => k.effectiveOn), tab = ui.drawer;
    const v = verifyState(S), chain = (n, x, len) => `<div>${n}: ${x.ok ? `<span class="ok">verifies here</span> (${len} entries)` : `<span class="brk">CHAIN BROKEN at ${esc(x.at)} — ${esc(x.reason)}</span>`}</div>`;
    let body = '';
    if (tab === 'skills') {
      const card = (k) => { const off = !k.effectiveOn; const why = ui.why[k.id];
        return `<div class="sk ${off ? 'off' : ''}" data-skill="${esc(k.id)}"><div class="row"><b>${esc(k.name)}</b><span style="flex:1"></span><button class="sw ${off ? '' : 'on'}" data-act="switch" data-id="${esc(k.id)}" data-on="${off ? 1 : 0}" title="${off ? 'off — click to turn on' : 'on — click to turn off (a reason is recorded)'}"></button></div>
<div class="meta">${esc(k.id)} · used ${k.uses}× · written by ${esc(k.lineage?.mouth || '?')}</div><div>${esc(String(k.claim).replaceAll('{{COL}}', '‹column›'))}</div>
<div class="k">${k.switch?.decided ? `switch: ${k.switch.on ? 'on' : 'off'} by ${esc(k.switch.by)}${k.switch.why ? ` — ${esc(k.switch.why)}` : ''}` : 'switch: default (on) — nobody has decided'}${off && k.switch?.offBecause && !k.switch?.decided ? ` — ${esc(k.switch.offBecause)}` : ''}</div>${k.conceded ? `<div class="brk">CONCEDED — ${esc(k.conceded.because)}</div>` : ''}
${why != null ? `<div class="why"><input data-why="${esc(k.id)}" placeholder="why switch it ${why === 'off' ? 'off (required)' : 'on (optional)'}" value=""><button class="pri" data-act="switch-go" data-id="${esc(k.id)}" data-on="${why === 'on' ? 1 : 0}">Switch ${why}</button><button data-act="switch-cancel" data-id="${esc(k.id)}">Cancel</button></div>` : ''}
<details><summary>why it was admitted, and its code</summary><div class="k">admitted by ${(k.evidence?.runs || []).map((r) => `${esc(r.role)}@${esc(r.col)}=${r.result}`).join(', ')}; ${esc(k.evidence?.generalisation || '')}</div><pre class="out">${esc(k.check)}</pre><div class="k">control</div><pre class="out">${esc(k.control)}</pre></details></div>`; };
      const allWhy = ui.why.all;
      body = `<p class="k">Everything this notebook can do to analyse was learned here — written by a model, taught from your own cells, or found by the ant colony — and admitted only by the gate. Each is a skill: turning one off is recorded with your reason, and a method that is off is never used; nothing is written around it. The same switch is on the server's <a href="${esc(base)}/skills/" target="_blank" rel="noopener">Skills page ↗</a>.</p>
<div class="sk" data-skill="all"><div class="row"><b>All learned analyses</b><span style="flex:1"></span><button class="sw ${all ? 'on' : ''}" data-act="switch" data-id="all" data-on="${all ? 0 : 1}"></button></div>${allWhy != null ? `<div class="why"><input data-why="all" placeholder="why switch all ${allWhy} ${allWhy === 'off' ? '(required)' : '(optional)'}"><button class="pri" data-act="switch-go" data-id="all" data-on="${allWhy === 'on' ? 1 : 0}">Switch ${allWhy}</button><button data-act="switch-cancel" data-id="all">Cancel</button></div>` : ''}</div>${lib.map(card).join('') || '<p class="k">Nothing learned yet. Ask a question (a model writes a method, or the colony searches), or teach it with <code>/learn</code>.</p>'}`;
    } else if (tab === 'audit') {
      const A = S.audit;
      const claims = A.claims.map((c) => `<div class="sk"><b>${esc(c.id)}</b> <span class="chip">${esc(c.status)}</span><div>${esc(c.text)}</div><div class="k">produced by ${c.method ? `${esc(c.method.name)} <span class="mono">code ${esc((c.method.codeSha || '').slice(0, 10))}</span>` : 'hand-written cells'}${c.proposedBy ? ` · proposed by ${esc(c.proposedBy)}` : ''}</div><div class="meta">check ${c.check ? `${esc(c.check.cell)} → ${c.check.result} · seal ${esc(c.check.hash)}` : 'not run'} · control ${c.control ? `${esc(c.control.cell)} → ${c.control.result} · seal ${esc(c.control.hash)}` : 'not run'}</div><div class="k">${c.promotions.length ? c.promotions.map((p) => `${esc(p.to)} by ${esc(p.by)} · seal ${esc(p.hash)}`).join('; ') : 'not adopted by anyone'}</div></div>`).join('');
      const meths = A.methods.map((m) => m.missing ? `<div class="sk brk">method ${esc(m.id)}: MISSING from the library</div>` : `<div class="sk"><b>${esc(m.name)}</b> — ${m.on ? 'ON' : m.conceded ? 'CONCEDED' : 'OFF'}, used ${m.uses}×<div class="k">written by ${esc(m.learnedBy)} for “${esc(m.question)}”</div><div class="meta">admitted by: ${(m.gate?.runs || []).map((r) => `${esc(r.role)}@${esc(r.col)}=${r.result}`).join(', ')}; ${esc(m.gate?.generalisation || '')}</div><div class="k">switch history: ${m.switchHistory?.length ? m.switchHistory.map((h) => `${h.kind === 'flag' ? 'flag' : h.on ? 'on' : 'off'} by ${esc(h.by)}${h.why ? ` (${esc(h.why)})` : ''}`).join(' → ') : 'never touched (default on)'}</div></div>`).join('');
      body = `<h4 style="margin:.2em 0">Chains — re-verified in this page</h4>${chain('notebook', v.nb, S.ledgers.nb.length)}${chain('claim ledger', v.bench, S.ledgers.bench.length)}${chain('workspace (tabs, forks, flags)', v.workspace, S.ledgers.workspace.length)}${chain('learned methods', v.analyses, S.ledgers.analyses.length)}<div class="k">The switch ledger is append-only but not hash-chained upstream; its history is shown as recorded.</div>
<h4>Claims → methods</h4>${claims || '<div class="k">no claims yet</div>'}<h4>Methods used → author → admission → switches</h4>${meths || '<div class="k">no learned method used in this conversation</div>'}`;
      if (runsCells(S)) body += '<h4>Executed cells · raw output (shown)</h4>' + S.ledgers.nb.filter(e => e.kind === 'exec').map(e => `<details class="sk"><summary>In [${esc(e.env?.execution_count ?? '?')}] · ${esc(e.cell)} · ${e.ok ? 'completed' : 'error'}</summary><div class="meta">seal ${esc(e.hash)} · previous run ${esc(e.env?.priorRunSeal || 'none')}</div><pre class="out">${esc(e.code)}</pre><pre class="out">${esc(e.output)}</pre></details>`).join('');
    } else if (tab === 'dataset') {
      const D = S.dataset, items = ui.dsHits || D.items.slice(-40).reverse();
      body = `<p class="k">The whole workspace's dataset: every file ingested and everything generated, in any conversation and any mode (${D.summary.source} source(s), ${D.summary.generated} generated item(s)). <b>Generated items are context about what was done — never evidence for themselves</b>; two generated items agreeing are one voice.</p><div class="why"><input data-dsq placeholder="search the dataset" value="${esc(ui.dsq)}"><button class="pri" data-act="ds-search">Search</button></div>${items.map((i) => `<div class="sk" data-ds-kind="${esc(i.kind)}"><div class="meta">${esc(i.label)}</div><div>${esc(i.text)}</div></div>`).join('') || '<div class="k">nothing yet</div>'}`;
    }
    return `<div class="drawer" data-drawer="${esc(tab)}"><div class="hd">${[['skills', 'Skills'], ['audit', 'Audit'], ['dataset', 'Dataset']].map(([k, l]) => `<button class="${k === tab ? 'pri' : ''}" data-act="drawer" data-tab="${k}">${l}</button>`).join('')}<span style="flex:1"></span><button data-act="drawer" data-tab="">✕</button></div><div class="bd">${body}</div></div>`;
  }

  function draw() {
    root.querySelectorAll('textarea[data-src]').forEach(t => {
      if (root.dataset.conv && root.dataset.conv !== ui.c) return;
      const id = ui.c + ':' + t.dataset.src;
      const saved = ui.S && sourceOf({ entries: ui.S.ledgers.nb }, t.dataset.src);
      if (t.value !== saved) { drafts.set(id, t.value); persistDrafts(); }
    });
    const cmdBefore = root.querySelector('[data-cmd]'); if (cmdBefore && root.dataset.conv === ui.c) commandDraft = cmdBefore.value;

    if (!ui.S) {
      portal.innerHTML = '';
      root.innerHTML = ui.starting
        ? `<div class="empty"><span style="font:500 18px 'Newsreader',serif">Starting Python in your browser…</span><span class="k" style="text-wrap:pretty">No local notebook server answered, so the notebook is starting its own Python with Pyodide (CPython in WebAssembly). The runtime is a one-time download from the CDN; after that, cells, files and outputs stay in this tab — no server, no install.</span><span class="meta">Loading Pyodide…</span></div>`
        : `<div class="empty"><span style="font:500 18px 'Newsreader',serif">Connect your Jupyter notebook.</span><span class="k" style="text-wrap:pretty">Code runs in a persistent Python kernel on your machine. Install the notebook dependencies once, then start Holodeck from its checkout. Open the printed local URL.</span><pre class="out">python3 -m pip install -r tools/notebook-requirements.txt
npm run notebook</pre><span class="meta">${ui.err ? esc(ui.err) : 'Connecting…'}</span><button style="align-self:flex-start" data-act="retry">Look again</button></div>`;
      bind(); return;
    }
    const S = ui.S, s = st(), c = S.conv, type = c.type, runtime = S.server.runtime, jupyter = runsCells(S), pyodide = runtime === 'pyodide', env = S.server.env || {}, v = verifyState(S), allOk = v.nb.ok && v.bench.ok && v.workspace.ok && v.analyses.ok;
    const allExecs = s.nb.entries.filter((e) => e.kind === 'exec'), counter = (e) => allExecs.indexOf(e) + 1;
    const lib = S.library, on = lib.filter((k) => k.effectiveOn).length;
    const tabs = S.tabs.map((t) => `<button class="tab${t.id === c.id ? ' on' : ''}" data-act="goto" data-c="${esc(t.id)}" title="${esc(t.id)}${t.parent ? ` · forked from ${esc(t.parent)}` : ''}"><span class="ty ${esc(t.type)}">${esc(t.type)}</span>${esc(t.title)}${t.parent ? ' ⑂' : ''}${t.id === c.id ? '<span class="x" data-act="close" title="close this tab — kept on the record">×</span>' : ''}</button>`).join('');
    const lineage = S.lineage.length ? `⑂ ${S.lineage.map((l, i) => `${i ? 'which was ' : ''}forked from “${esc(l.title)}” (${esc(l.id)}) after ${esc(l.at)} — cut at seal ${esc(String(l.cutHash || '').slice(0, 12))}; ${l.notCarried ? `${l.notCarried} promotion(s) stayed with the parent` : 'no promotions left behind'}`).join(' · ')}. The first entries are the parent's own, with the same seals.` : '';
    const main = type === 'chat' ? chatView(s, counter) : type === 'generate' ? generateView(s) : notebookView(s, counter);
    root.dataset.conv = ui.c;
    root.innerHTML = `<div class="mode"><span class="dot" style="background:var(--ok)"></span><span style="color:var(--ink2)">${pyodide ? 'Running in this tab' : 'Served by ' + esc(base.replace(/^https?:\/\//, ''))}</span><span class="badge">acting as ${esc(S.by)}</span><span class="badge">${pyodide ? `Pyodide ${esc(env.pyodide || '')} · Python ${esc(env.python || 'starting')}` : `Python ${esc(env.python || '?')}${jupyter ? '' : ' · numpy ' + esc(env.numpy || 'not installed')}`}</span>${jupyter ? '' : `<span class="badge ${env.isolated ? 'ok' : 'bad'}">${env.isolated ? 'no network in cells' : 'cells NOT network-isolated'}</span>`}<span class="badge">${S.server.model ? `method-writing model: ${esc(S.server.model)}` : pyodide ? 'Pyodide (WebAssembly) — no server needed' : jupyter ? 'Jupyter / IPython · kernel ' + esc(S.server.kernel) : 'no model — the ant colony learns'}</span><span class="badge ${allOk ? 'ok' : 'bad'}" data-chains>${allOk ? 'chains verify (checked here)' : 'CHAIN BROKEN'}</span><span style="flex:1"></span>${jupyter ? '' : `<button data-act="drawer" data-tab="skills">Skills · ${on}/${lib.length} on</button>`}<button data-act="drawer" data-tab="audit">Audit</button><button data-act="drawer" data-tab="dataset">Dataset</button></div>
<div class="tabs" data-tabs>${tabs}<span class="plus"><button class="tab" data-act="menu" title="new conversation">＋</button>${ui.menu ? `<span class="menu">${(jupyter ? TYPES.filter(([k]) => k === 'notebook') : TYPES).map(([k, l]) => `<button data-act="new" data-type="${k}"><span class="ty ${k}">${k}</span> ${l}</button>`).join('')}</span>` : ''}</span></div>
${lineage ? `<div class="lineage" data-lineage>${lineage}</div>` : ''}
<div class="bar"><span class="k">${jupyter ? '' : 'Draw this conversation as'}</span>${jupyter ? '<span class="badge">Python notebook</span>' : `<span class="seg" data-flag>${TYPES.map(([k, l]) => `<button class="${k === type ? 'on' : ''}" data-act="retype" data-type="${k}" title="the type flag — changing it is recorded, and changes only the drawing">${l}</button>`).join('')}</span>`}<span style="flex:1"></span><button data-act="rename" title="rename this tab">Rename</button><button data-act="fork" data-at="end">⑂ Fork all</button><button data-act="dl" data-path="ipynb" data-name="${esc(c.id)}.ipynb">⤓ .ipynb</button>${runtime === 'jupyter' ? `<button data-act="dl" data-path="bundle" data-name="${esc(c.id)}-bundle.zip" title="notebook + data + helper library + run_all.py — re-runs in a clean python3 and compares every #finding/#result line">⤓ Bundle</button>` : ''}
<label style="cursor:pointer;border:1px solid var(--line2);border-radius:8px;padding:4px 11px">Import .ipynb<input data-import type="file" accept=".ipynb,application/json" hidden></label>
${runtime === 'jupyter' ? '<button data-act="kernel-interrupt">Interrupt</button>' : ''}${jupyter ? '<button data-act="kernel-restart">Restart kernel</button><button data-act="restart-run">Restart & run all</button>' : ''}</div>
${ui.notice ? `<div class="notice${ui.noticeErr ? ' err' : ''}" data-notice><span class="x" data-act="dismiss">✕</span>${esc(ui.notice)}</div>` : ''}
<div data-view="${esc(type)}">${main}</div>
<div class="cmd"><textarea data-cmd aria-label="Notebook command" rows="1" placeholder="${ui.busy ? 'Working… (' + esc(ui.busy) + ')' : jupyter ? 'Run Python with /py, or edit a cell above · Shift+Enter runs a cell' : 'Ask about your data in plain words, or /help — Enter sends, Shift+Enter adds a line'}" autocomplete="off" spellcheck="false">${esc(commandDraft)}</textarea></div>
`;
    portal.innerHTML = ui.drawer ? drawerHtml() : '';
    bind();
  }

  // ── acting ───────────────────────────────────────────────────────────────
  const cellIds = () => [...root.querySelectorAll('[data-cell]')].map((x) => x.dataset.cell);
  async function saveCell(id) { const t = root.querySelector(`textarea[data-src="${CSS_ESC(id)}"]`); if (t) await call({ op: 'edit', cell: id, source: t.value }, { quiet: true }); }
  async function saveDrafts() {
    const edited = [...drafts.entries()].filter(([k]) => k.startsWith(ui.c + ':'));
    for (const [k, source] of edited) { const r = await call({ op: 'edit', cell: k.slice(ui.c.length + 1), source }, { quiet: true }); if (r.error) throw new Error(r.error); }
  }
  const CSS_ESC = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/"/g, '\\"'));
  async function onAct(a, ds) {
    const S = ui.S;
    if (a === 'retry') return refresh();
    if (a === 'kernel-interrupt') {
      const r = await F(`${base}/notebook/api`, { method: 'POST', body: JSON.stringify({ c: ui.c, op: 'kernel-interrupt' }) });
      const j = await r.json(); ui.notice = j.error || j.notice; ui.noticeErr = !!j.error; draw(); return;
    }
    if (ui.busy) return;
    if (['goto', 'retype', 'add', 'drawer', 'fork', 'new', 'dl', 'rename', 'run-all', 'restart-run', 'kernel-restart'].includes(a)) await saveDrafts();
    if (a === 'kernel-restart' || a === 'restart-run') {
      const r = await call({ op: 'kernel-restart' });
      if (!r.error && a === 'restart-run') await call({ op: 'runmany', which: 'all' }); return;
    }
    if (a === 'goto') { ui.c = ds.c; ui.sel = null; ui.notice = null; return refresh(); }
    if (a === 'menu') { ui.menu = !ui.menu; return draw(); }
    if (a === 'new') { ui.menu = false; return call({ op: 'ws-new', type: ds.type }); }
    if (a === 'close') { if (!confirm('Close this tab? It stays on the record and can be seen in the workspace log.')) return; return call({ op: 'ws-close' }); }
    if (a === 'retype') return call({ op: 'ws-retype', type: ds.type });
    if (a === 'rename') { const t = prompt('New title for this tab', S.conv.title); if (t && t.trim()) return call({ op: 'ws-rename', title: t.trim() }); return; }
    if (a === 'fork') return call({ op: 'ws-fork', at: ds.at || 'end' });
    if (a === 'dl') { const r = await F(`${base}/notebook/${ds.path}?c=${encodeURIComponent(ui.c)}`); const blob = await r.blob(); const u = URL.createObjectURL(blob); const x = document.createElement('a'); x.href = u; x.download = ds.name; document.body.appendChild(x); x.click(); x.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); return; }
    if (a === 'dismiss') { ui.notice = null; return draw(); }
    if (a === 'drawer') { ui.drawer = ds.tab || null; ui.dsHits = null; return draw(); }
    if (a === 'promote') return call({ op: 'promote', card: ds.card, to: ds.to });
    if (a === 'run-sel') { const id = ui.sel || cellIds().at(-1); if (!id) return; await saveCell(id); return call({ op: 'run', cell: id }); }
    if (a === 'run-all') return call({ op: 'runmany', which: 'all' });
    if (a === 'add') return call(ds.t === 'code' ? { op: 'add', type: 'code', lang: 'python', source: '' } : { op: 'add', type: ds.t, source: ds.t === 'claim' ? (prompt('The claim, in your words') || '') : 'A note' });
    if (a === 'line') return call({ op: 'line', line: ds.line });
    if (a === 'gen') { const q = $q('[data-gen-q]'); if (q && q.value.trim()) return call({ op: 'ask', text: q.value.trim() }); return; }
    if (a === 'switch') { ui.why[ds.id] = ds.on === '1' ? 'on' : 'off'; return draw(); }
    if (a === 'switch-cancel') { delete ui.why[ds.id]; return draw(); }
    if (a === 'switch-go') { const inp = $q(`[data-why="${CSS_ESC(ds.id)}"]`); const why = inp ? inp.value.trim() : ''; const onv = ds.on === '1';
      if (!onv && !why) { ui.notice = 'Switching a method off needs a reason — it is what the next person reads.'; ui.noticeErr = true; return draw(); }
      delete ui.why[ds.id]; return call({ op: 'skill', which: ds.id, on: onv, why: why || null }); }
    if (a === 'ds-search') { const q = ($q('[data-dsq]') || {}).value || ''; ui.dsq = q; if (!q.trim()) { ui.dsHits = null; return draw(); } const j = await call({ op: 'dataset', query: q }, { quiet: true }); ui.notice = j.notice; ui.noticeErr = !!j.error; ui.dsHits = searchLocal(S.dataset.items, q); return draw(); }
  }
  function searchLocal(items, q) { const w = new Set(String(q).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((x) => x.length > 2).map((x) => x.replace(/(ies|es|s)$/, ''))); return items.map((i) => ({ i, n: String(i.text).toLowerCase().split(/[^\p{L}\p{N}]+/u).map((x) => x.replace(/(ies|es|s)$/, '')).filter((x) => w.has(x)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 20).map((x) => x.i); }

  function bind() {
    [...root.querySelectorAll('[data-act]'), ...portal.querySelectorAll('[data-act]')].forEach((b) => { b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); onAct(b.dataset.act, b.dataset).catch(e => { ui.notice = e.message; ui.noticeErr = true; draw(); }); }; });
    root.querySelectorAll('textarea[data-src]').forEach((t) => {
      t.oninput = () => { drafts.set(ui.c + ':' + t.dataset.src, t.value); persistDrafts(); };
      t.onfocus = () => { ui.sel = t.dataset.src; root.querySelectorAll('.cell').forEach((c) => c.classList.toggle('sel', c.dataset.cell === ui.sel || c.dataset.out === ui.sel)); };
      t.onkeydown = async (e) => {
        if (ui.busy || e.key !== 'Enter' || !(e.shiftKey || e.ctrlKey || e.metaKey)) return;
        e.preventDefault(); const id = t.dataset.src, ids = cellIds(), next = ids[ids.indexOf(id) + 1];
        await call({ op: 'edit', cell: id, source: t.value }, { quiet: true });
        const kind = (root.querySelector(`[data-cell="${CSS_ESC(id)}"]`) || { dataset: {} }).dataset.type;
        if (kind === 'code' || (ui.S && ui.S.ledgers.nb.some((x) => x.kind === 'cell' && x.id === id && x.type === 'code'))) await call({ op: 'run', cell: id });
        if (e.shiftKey) { if (next) { ui.sel = next; const n = root.querySelector(`textarea[data-src="${CSS_ESC(next)}"]`); if (n && !n.hidden) n.focus(); } else { await call({ op: 'add', type: 'code', lang: 'python', source: '' }); const n = root.querySelector(`textarea[data-src="${CSS_ESC(ui.sel)}"]`); if (n) n.focus(); } }
      };
    });
    root.querySelectorAll('[data-md]').forEach((m) => { m.ondblclick = () => { const t = root.querySelector(`textarea[data-src="${CSS_ESC(m.dataset.md)}"]`); if (!t) return; m.hidden = true; t.hidden = false; t.focus(); }; });
    const dataFiles = root.querySelector('[data-file]');
    if (dataFiles) dataFiles.onchange = async e => { for (const f of e.target.files) await upload(f); };
    const importer = root.querySelector('[data-import]');
    if (importer) importer.onchange = async e => { const f = e.target.files[0]; if (!f) return;
      try { await saveDrafts(); await call({ op: 'import-ipynb', name: f.name, notebook: JSON.parse(await f.text()) }); }
      catch (e) { ui.notice = e.message; ui.noticeErr = true; draw(); }
    };
    const line = root.querySelector("[data-cmd]"); if (line) { line.oninput = () => { commandDraft = line.value; line.style.height = 'auto'; line.style.height = line.scrollHeight + 'px'; };
      line.onkeydown = async (e) => { if (e.key !== 'Enter' || e.shiftKey) return; e.preventDefault(); if (!line.value.trim()) return; const v = line.value.trim(); line.value = ''; commandDraft = '';
      if (/^\/export\b/.test(v)) return onAct('dl', { path: 'ipynb', name: ui.c + '.ipynb' });
      const r = await call({ op: 'line', line: v }); if (r.error) { commandDraft = v; draw(); } }; }
    const dsq = $q('[data-dsq]'); if (dsq) dsq.onkeydown = (e) => { if (e.key === 'Enter') onAct('ds-search', {}); };
    const gq = $q('[data-gen-q]'); if (gq) gq.onkeydown = (e) => { if (e.key === 'Enter') onAct('gen', {}); };
  }
  // drop a file anywhere on the pane: it is uploaded to the server's ingest (any kind; the reader's gaps are shown, never hidden)
  // stopPropagation: the holodeck page has its own drop-anywhere ingest; a file dropped HERE is data for the notebook, not a source for the reader
  root.addEventListener('dragover', (e) => { if (ui.S) { e.preventDefault(); e.stopPropagation(); root.classList.add('drop'); } });
  root.addEventListener('dragleave', () => root.classList.remove('drop'));
  async function upload(f) {
    if (ui.busy) return;
    await saveDrafts();
    if (/\.ipynb$/i.test(f.name)) { try { return await call({ op: 'import-ipynb', name: f.name, notebook: JSON.parse(await f.text()) }); } catch (e) { ui.notice = e.message; ui.noticeErr = true; draw(); return; } }
    const b = new Uint8Array(await f.arrayBuffer()); let bin = '';
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return call({ op: 'upload', name: f.name, base64: btoa(bin) });
  }
  root.addEventListener('drop', async e => { e.preventDefault(); e.stopPropagation(); root.classList.remove('drop'); for (const f of e.dataTransfer.files) await upload(f); });


  if (ui.S) draw(); refresh();
  const api = { refresh, ui, call };
  if (!opts.fetch) LIVE.set(key, { root, api });
  return api;
}
