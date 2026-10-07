// holodeck-ingest-player.js — replays one ingest, event by event, from the trace the real functions recorded
// (index.html: readAny, splitSentences, analyze, holoKit, paradigms). Nothing here re-reads the content: the log is the
// trace, and the holograph is rebuilt from the trace's own events up to the playhead, so rewinding un-folds it exactly.
// Two clocks: "Steps" gives every event the same airtime; "Real time" uses the recorded performance.now() offsets.
import { mountMap } from './holodeck-map.js';

const STAGES = {
  bytes: ['Bytes', '--dim'], decode: ['Decode', '--pink'], text: ['Text', '--blue'], sentences: ['Statements', '--ink2'],
  names: ['Names', '--acc'], figures: ['Figures', '--amber'], dates: ['Dates', '--date'], frame: ['Frame', '--green'],
   canon: ['Identity', '--acc2'], junk: ['Keep or set aside', '--mut'], echo: ['Echoes', '--blue'], store: ['Store', '--mut'], hang: ['Hang', '--date'],
  holograph: ['Holograph', '--acc'], null: ['Null', '--amber'], fort: ['Fort', '--amber'], paradigm: ['Paradigm', '--pink'], engine: ['Engine', '--acc2'],
};
const REAL_SPEEDS = [[1, '1×'], [0.1, '1/10×'], [0.01, '1/100×'], [0.001, '1/1,000×'], [1e-4, '1/10,000×'], [1e-5, '1/100,000×']];
const STEP_SPEEDS = [[2, '2 events/s'], [8, '8 events/s'], [30, '30 events/s'], [120, '120 events/s'], [600, '600 events/s']];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
const ms = t => t < 1 ? t.toFixed(3) : t < 100 ? t.toFixed(2) : t < 10000 ? t.toFixed(1) : Math.round(t).toLocaleString();

const CSS = `
.hdp{position:fixed;inset:0;z-index:9999;background:var(--bg);color:var(--ink);display:grid;grid-template-rows:auto 1fr auto;font:14px/1.45 'Hanken Grotesk',system-ui,sans-serif}
.hdp *{box-sizing:border-box}
.hdp-top{display:flex;align-items:baseline;gap:6px 14px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--line)}
.hdp-top h2{margin:0;font:500 19px/1.2 'Newsreader',Georgia,serif;text-wrap:balance}
.hdp-top .meta{font:12px 'JetBrains Mono',ui-monospace,monospace;color:var(--dim)}
.hdp-top .sp{flex:1}
.hdp button{all:unset;cursor:pointer;color:var(--mut);font:500 13px 'Hanken Grotesk',sans-serif;padding:4px 6px;border-radius:4px}
.hdp select{background:none;color:var(--mut);border:0;font:500 13px 'Hanken Grotesk',sans-serif;cursor:pointer}
.hdp button:hover{color:var(--ink)}.hdp .pl{color:var(--acc);font-weight:600;min-width:64px}.hdp button:focus-visible,.hdp select:focus-visible{outline:2px solid var(--acc);outline-offset:1px}
.hdp button[aria-pressed=true]{color:var(--ink);box-shadow:inset 0 -2px 0 var(--acc);border-radius:0}
.hdp-body{display:grid;grid-template-columns:minmax(300px,38%) 1fr;min-height:0}
.hdp-log{border-right:1px solid var(--line);display:grid;grid-template-rows:auto 1fr auto;min-height:0}
.hdp-h{font:600 11px 'JetBrains Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);padding:10px 14px 6px}
.hdp-rows{overflow-y:auto;position:relative;font:12px/24px 'JetBrains Mono',ui-monospace,monospace;min-height:0}
.hdp-row{position:absolute;left:0;right:0;height:24px;display:grid;grid-template-columns:78px 96px 1fr;gap:8px;padding:0 12px;white-space:nowrap;cursor:pointer;color:var(--ink2)}
.hdp-row span{overflow:hidden;text-overflow:ellipsis}
.hdp-row .t{color:var(--dim);text-align:right;font-variant-numeric:tabular-nums}
.hdp-row .st{font-weight:500}
.hdp-row:hover{background:var(--s1)}.hdp-row.cur{background:var(--sel2);color:var(--ink)}
.hdp-row.fut{opacity:.28}
.hdp-now{border-top:1px solid var(--line);padding:8px 14px 10px;min-height:72px}
.hdp-now .k{font:600 11px 'JetBrains Mono',monospace;letter-spacing:.1em;text-transform:uppercase}
.hdp-now p{margin:4px 0 0;font-size:14px;color:var(--ink);max-width:70ch}
.hdp-right{display:grid;grid-template-rows:auto 1fr;min-height:0}
.hdp-lens{border-bottom:1px solid var(--line);padding:4px 18px 12px;max-height:34vh;overflow:auto}
.hdp-lens .txt{font:16px/1.6 'Newsreader',Georgia,serif;color:var(--mut);white-space:pre-wrap;max-width:80ch}
.hdp-lens .doc{font:12px 'JetBrains Mono',monospace;color:var(--dim);margin-bottom:4px}
.hdp-lens .s{color:var(--ink2)}.hdp-lens .s.on{color:var(--ink);background:var(--sel)}
.hdp-lens .nm{box-shadow:inset 0 -2px 0 var(--acc);color:var(--ink)}.hdp-lens .fg{box-shadow:inset 0 -2px 0 var(--amber)}.hdp-lens .dt{box-shadow:inset 0 -2px 0 var(--date)}
.hdp-lens .fu{text-decoration:line-through;opacity:.5}.hdp-lens .hit{outline:2px solid var(--acc);border-radius:2px}
.hdp-lens .big{font:13px 'JetBrains Mono',monospace;color:var(--ink2);padding:10px 0}
.hdp-graph{position:relative;min-height:0;grid-row:2}
.hdp-key{position:absolute;left:14px;bottom:10px;display:flex;flex-wrap:wrap;gap:12px;font:12px 'Hanken Grotesk',sans-serif;color:var(--dim);pointer-events:none}
.hdp-key i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:-1px}
.hdp-par{position:absolute;right:14px;top:50px;font:500 13px 'Hanken Grotesk';color:var(--pink);text-align:right;max-width:50%}
.hdp-bar{border-top:1px solid var(--line);padding:6px 18px calc(12px + env(safe-area-inset-bottom,0px));display:grid;gap:8px}
.hdp-rib{position:relative;height:18px;cursor:pointer;touch-action:none}
.hdp-rib canvas{width:100%;height:100%;display:block}
.hdp-ctl{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.hdp-ctl .rd{font:12px 'JetBrains Mono',monospace;color:var(--ink2);font-variant-numeric:tabular-nums;margin-left:auto}
.hdp-seg{display:inline-flex;gap:2px;margin-left:10px}
@media (max-width:820px){.hdp-body{grid-template-columns:1fr;grid-template-rows:40% 60%}.hdp-log{border-right:0;border-bottom:1px solid var(--line)}}
`;


// Replay state is a pure fold of the trace: the same events 0..k always give the same picture, whichever way the playhead came.
const fresh = () => ({ nodes: new Map(), edges: new Map(), marks: new Map(), paradigm: '', echo: new Map(), odd: new Map(), lastSt: new Map(), occ: new Map() });
const node = (S, n) => S.nodes.get(n) || (S.nodes.set(n, { n, c: 0, st: 'cand', mine: false }), S.nodes.get(n));
const ek = (a, b) => a < b ? a + '\u0001' + b : b + '\u0001' + a;
const mark = (S, e, cls) => { if (e.doc == null || e.s == null) return; (S.marks.get(e.doc) || (S.marks.set(e.doc, []), S.marks.get(e.doc))).push({ s: e.s, e: e.e, cls }); };
function apply(S, e) {
  if (e.stage === 'sentences') { mark(S, e, e.kind === 'statement' ? 's' : e.kind === 'furniture' ? 'fu' : ''); if (e.kind === 'statement') S.lastSt.set(e.doc, e); }
  else if (e.kind === 'name') { mark(S, e, 'nm'); const x = node(S, e.name); if (x.st === 'cand') x.c++;
    const ls = S.lastSt.get(e.doc); if (ls) { const L = S.occ.get(e.name) || (S.occ.set(e.name, []), S.occ.get(e.name)); if (!L.some(o => o.doc === e.doc && o.id === ls.id)) L.push({ doc: e.doc, id: ls.id, s: ls.s, e: ls.e }); } }
  else if (e.kind === 'figure') mark(S, e, 'fg');
  else if (e.kind === 'date') mark(S, e, 'dt');
  else if (e.kind === 'merge') { const f = S.nodes.get(e.from); if (f && f.st === 'cand') { S.nodes.delete(e.from); node(S, e.to).c += f.c; }
    const mv = S.occ.get(e.from); if (mv) { S.occ.delete(e.from); const t = S.occ.get(e.to) || []; mv.forEach(r => { if (!t.some(q => q.doc === r.doc && q.id === r.id)) t.push(r); }); S.occ.set(e.to, t); } }
  else if (e.kind === 'prior') { (e.nodes || []).forEach(p => { const x = node(S, p.n); x.st = 'prior'; x.c = p.c; }); (e.edges || []).forEach(p => S.edges.set(ek(p.a, p.b), { a: p.a, b: p.b, c: p.c, neg: false, mine: false })); }
  else if (e.kind === 'drop') (e.names || []).forEach(n => { const x = S.nodes.get(n); if (x && x.st === 'cand') x.st = 'drop'; });
  else if (e.kind === 'admit') { (e.ns || []).forEach(n => { const x = node(S, n); if (x.st !== 'prior' || !x.mine) x.mine = true; x.st = 'fold'; x.c++; });
    (e.pairs || []).forEach(([a, b]) => { const key = ek(a, b); const E = S.edges.get(key) || { a, b, c: 0, neg: false, mine: true }; E.c++; E.mine = true; if (e.neg) E.neg = true; S.edges.set(key, E); }); }
  else if (e.kind === 'pair') S.echo.set(e.id, (S.echo.get(e.id) || []).concat(e));
  else if (e.stage === 'fort' && e.standing) S.odd.set(e.name, e.standing);
  else if (e.stage === 'paradigm') S.paradigm = e.kind === 'group' ? 'Paradigm “' + e.label + '” · ' + e.n + ' sources' : 'No paradigm';
}
export function foldTrace(T, k = T.ev.length - 1) { const S = fresh(); for (let i = 0; i <= k; i++) apply(S, T.ev[i]); return S; }

let styled = false, current = null;
export function open(T, opt = {}) {
  if (current) current.close();
  if (!styled) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); styled = true; }
  current = mount(T, opt);
}

function mount(T, opt = {}) {
  const ev = T.ev, N = ev.length, css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
  const docs = new Map((T.docs || []).map(d => [d.id, d]));
  const root = document.createElement('div'); root.className = 'hdp'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Replay of how this was read');
  root.innerHTML = `
    <div class="hdp-top"><h2>How “${esc(T.label)}” was read</h2>
      <span class="meta" title="Real wall-clock time of the ingest. Timings include the cost of recording each event.">real run ${ms(T.ms || ev[N - 1].t)} ms · ${N.toLocaleString()} events</span><span class="sp"></span>
      <button type="button" data-a="copy">Copy trace</button><button type="button" data-a="close" aria-label="Close replay" title="Close (Esc)">✕</button></div>
    <div class="hdp-body">
      <div class="hdp-log" style="grid-template-rows:1fr auto"><div class="hdp-rows" tabindex="0"><div class="hdp-sz"></div></div><div class="hdp-now"></div></div>
      <div class="hdp-right"><div class="hdp-lens"></div>
        <div class="hdp-graph"><div class="hdp-par"></div>
          <div class="hdp-key"><span><i style="background:var(--acc)"></i>folded from what you added</span><span><i style="background:var(--blue)"></i>already in the picture</span><span><i style="border:1.5px solid var(--dim)"></i>found, not yet admitted</span><span><i style="border:1.5px dashed var(--dim)"></i>ring: holds more names, click to open</span><span><i style="background:var(--bad)"></i>bond negated in what you added</span><span><i style="border:2px solid var(--amber)"></i>odd: Fort raised it and it stands</span></div></div></div>
    </div>
    <div class="hdp-bar"><div class="hdp-rib" title="Drag to scrub"><canvas></canvas></div>
      <div class="hdp-ctl">
        <button type="button" data-a="start" title="Back to the first event (Home)">|◀</button>
        <button type="button" data-a="back" title="One event back (←)">◀|</button>
        <button type="button" data-a="rev" title="Rewind (J)" aria-label="Rewind">◀◀</button>
        <button type="button" data-a="play" class="pl" title="Play or pause (Space)">▶ Play</button>
        <button type="button" data-a="fwd" title="One event forward (→)">|▶</button>
        <span class="hdp-seg" role="group" aria-label="Clock"><button type="button" data-a="steps">Steps</button><button type="button" data-a="real">Real time</button></span>
        <label style="display:flex;align-items:center" title="Speed"><select data-a="speed" id="hdp-speed"></select></label>
        <span class="rd"></span></div></div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s);
  const rowsEl = $('.hdp-rows'), sz = $('.hdp-sz'), nowEl = $('.hdp-now'), lens = $('.hdp-lens'), par = $('.hdp-par');
  const rc = $('.hdp-rib canvas'), rd = $('.rd'), speedSel = $('#hdp-speed');

  // ---------- clock ----------
  let real = false, dir = 0, pos = 0, k = 0, speed = 30;
  const clockOf = i => real ? ev[i].t : i, maxPos = () => clockOf(N - 1) || 1;
  const idxAt = p => { let lo = 0, hi = N - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (clockOf(m) <= p) lo = m; else hi = m - 1; } return lo; };
  function fillSpeeds() {
    const L = real ? REAL_SPEEDS : STEP_SPEEDS; speedSel.innerHTML = L.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    if (real) { const want = (T.ms || ev[N - 1].t) / 20000; speed = (L.find(([v]) => v <= Math.max(want, 1e-5)) || L[L.length - 1])[0]; } else speed = 30;
    speedSel.value = String(speed);
    $('[data-a=steps]').setAttribute('aria-pressed', String(!real)); $('[data-a=real]').setAttribute('aria-pressed', String(real));
  }
  const setClock = r => { real = r; pos = clockOf(k); fillSpeeds(); drawRibbon(); };
  const seek = i => { k = Math.max(0, Math.min(N - 1, i)); pos = clockOf(k); render(true); };
  const setDir = d => { dir = d; $('[data-a=play]').textContent = dir === 1 ? '❚❚ Pause' : '▶ Play'; $('[data-a=rev]').textContent = dir === -1 ? '❚❚' : '◀◀'; last = performance.now(); };

  // ---------- state rebuilt from events 0..k ----------
  let S = null, sk = -1;
  function stateAt(i) { if (!S || i < sk) { S = fresh(); sk = -1; } while (sk < i) apply(S, ev[++sk]); return S; }

  // ---------- log (virtualised) ----------
  const RH = 24;
  function renderLog(follow) {
    const H = rowsEl.clientHeight, top = rowsEl.scrollTop; sz.style.height = (N * RH) + 'px';
    if (follow) { const y = k * RH; if (y < top + RH * 2 || y > top + H - RH * 4) rowsEl.scrollTop = Math.max(0, y - H * 0.6); }
    const a = Math.max(0, Math.floor(rowsEl.scrollTop / RH) - 5), b = Math.min(N, a + Math.ceil(H / RH) + 10);
    let h = ''; for (let i = a; i < b; i++) { const e = ev[i], S0 = STAGES[e.stage] || [e.stage, '--dim'];
      h += `<div class="hdp-row${i === k ? ' cur' : i > k ? ' fut' : ''}" data-i="${i}" style="top:${i * RH}px" title="${esc(e.msg)}"><span class="t">${ms(e.t)}</span><span class="st" style="color:var(${S0[1]})">${esc(S0[0])}</span><span>${esc(e.msg)}</span></div>`; }
    sz.innerHTML = h;
    const e = ev[k], S0 = STAGES[e.stage] || [e.stage, '--dim'], dt = k ? e.t - ev[k - 1].t : e.t;
    nowEl.innerHTML = `<div class="k" style="color:var(${S0[1]})">${esc(S0[0])} · ${esc(e.kind)} · +${ms(dt)} ms since the previous event</div><p>${esc(e.msg)}</p>`;
  }
  rowsEl.addEventListener('scroll', () => { if (!dir) renderLog(false); });
  rowsEl.addEventListener('click', e => { const r = e.target.closest('.hdp-row'); if (r) { setDir(0); seek(+r.dataset.i); } });

  // ---------- source lens ----------
  function renderLens(S) {
    const e = ev[k]; let did = e.doc; if (did == null) for (let i = k; i >= 0 && did == null; i--) did = ev[i].doc;
    const d = did != null && docs.get(did);
    lens.hidden = !d || !d.text; if (lens.hidden) return;
    let at = e.s; if (at == null) for (let i = k; i >= 0; i--) if (ev[i].doc === did && ev[i].s != null) { at = ev[i].s; break; }
    at = at || 0; const a = Math.max(0, at - 260), b = Math.min(d.text.length, at + 520);
    const M = (S.marks.get(did) || []).filter(m => m.cls && m.e > a && m.s < b); const cur = e.s != null && e.doc === did ? e : null;
    const cuts = new Set([a, b]); M.forEach(m => { cuts.add(Math.max(a, m.s)); cuts.add(Math.min(b, m.e)); }); if (cur) { cuts.add(Math.max(a, cur.s)); cuts.add(Math.min(b, cur.e)); }
    const P = [...cuts].sort((x, y) => x - y); let h = a ? '…' : '';
    let sOn = null; for (let i = k; i >= 0; i--) if (ev[i].kind === 'statement' && ev[i].doc === did) { sOn = ev[i]; break; }
    for (let i = 0; i < P.length - 1; i++) { const x = P[i], y = P[i + 1]; if (y <= x) continue; const cls = new Set();
      M.forEach(m => { if (m.s <= x && m.e >= y) cls.add(m.cls); }); if (sOn && sOn.s <= x && sOn.e >= y && cls.has('s')) cls.add('on'); if (cur && cur.s <= x && cur.e >= y) cls.add('hit');
      h += cls.size ? `<span class="${[...cls].join(' ')}">${esc(d.text.slice(x, y))}</span>` : esc(d.text.slice(x, y)); }
    lens.innerHTML = `<div class="doc" style="padding-top:8px">${esc(d.title)} · ${esc(d.type || '')} · characters ${a.toLocaleString()}–${b.toLocaleString()} of ${d.text.length.toLocaleString()}</div><div class="txt">${h}${b < d.text.length ? '…' : ''}</div>`;
    const hit = lens.querySelector('.hit') || lens.querySelector('.on'); if (hit && dir) hit.scrollIntoView({ block: 'nearest' });
  }

  // ---------- holograph: the shared map engine (holodeck-map.js), fed from the fold at the playhead ----------
  let dpr = 1;
  const map = mountMap($('.hdp-graph'), { padBottom: 30, wheelZoom: true, empty: 'Names appear here as they are found, then fold into the picture.', sentence: o => { const d = docs.get(o.doc); return d && d.text ? d.text.slice(o.s, o.e) : ''; } });
  function size() { dpr = window.devicePixelRatio || 1; const q = rc.getBoundingClientRect(); rc.width = q.width * dpr; rc.height = q.height * dpr; drawRibbon(); }
  const mapData = S => { const e = ev[k]; return { nodes: [...S.nodes.values()], edges: [...S.edges.values()], docs: [...docs.values()], occ: S.occ, odd: S.odd, hot: new Set([e.name, e.to, ...(e.ns || [])].filter(Boolean)), hotPairs: e.pairs || [] }; };

  function drawRibbon() {
    const g = rc.getContext('2d'), w = rc.width, h = rc.height; g.clearRect(0, 0, w, h); const mp = maxPos();
    for (let i = 0; i < N; i++) { const x0 = clockOf(i) / mp * w, x1 = i + 1 < N ? clockOf(i + 1) / mp * w : w; g.fillStyle = css((STAGES[ev[i].stage] || [0, '--dim'])[1]); g.globalAlpha = 0.85; g.fillRect(x0, h * 0.25, Math.max(1, x1 - x0), h * 0.5); }
    g.globalAlpha = 1; const x = pos / mp * w; g.fillStyle = css('--ink'); g.fillRect(x - dpr, 0, 2 * dpr, h);
  }
  const scrub = e => { const r = rc.getBoundingClientRect(); const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); setDir(0); pos = f * maxPos(); k = idxAt(pos); render(true); };
  let dragging = false; $('.hdp-rib').addEventListener('pointerdown', e => { dragging = true; e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); scrub(e); });
  $('.hdp-rib').addEventListener('pointermove', e => { if (dragging) scrub(e); }); $('.hdp-rib').addEventListener('pointerup', () => { dragging = false; });

  function render(follow) {
    const St = stateAt(k); renderLog(follow); renderLens(St); map.set(mapData(St)); par.textContent = St.paradigm; drawRibbon();
    rd.textContent = (real ? 't = ' + ms(pos) + ' of ' + ms(ev[N - 1].t) + ' ms' : 'event ' + (k + 1).toLocaleString() + ' of ' + N.toLocaleString()) + ' · real ' + ms(ev[k].t) + ' ms';
  }

  // ---------- loop ----------
  let last = performance.now(), raf = 0, frame = 0;
  function loop(now) {
    const dt = Math.min(100, now - last); last = now;
    if (dir && dt > 0) { pos += dir * (real ? dt * speed : dt / 1000 * speed);
      if (pos >= maxPos()) { pos = maxPos(); setDir(0); } else if (pos < 0) { pos = 0; setDir(0); }
      else { const nk = idxAt(pos); if (nk !== k) { k = nk; render(true); } else drawRibbon(); } }
    raf = requestAnimationFrame(loop);
  }

  // ---------- controls ----------
  root.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (!a) return; const act = a.dataset.a;
    if (act === 'close') close(); else if (act === 'play') setDir(dir === 1 ? 0 : (k >= N - 1 ? (seek(0), 1) : 1)); else if (act === 'rev') setDir(dir === -1 ? 0 : (k <= 0 ? (seek(N - 1), -1) : -1));
    else if (act === 'start') { setDir(0); seek(0); } else if (act === 'back') { setDir(0); seek(k - 1); } else if (act === 'fwd') { setDir(0); seek(k + 1); }
    else if (act === 'steps') setClock(false); else if (act === 'real') setClock(true);
    else if (act === 'copy') { const txt = JSON.stringify(T); navigator.clipboard && navigator.clipboard.writeText(txt).then(() => { a.textContent = 'Copied'; }, () => { a.textContent = 'Copy failed'; }); } });
  speedSel.addEventListener('change', () => { speed = +speedSel.value; });
  const onKey = e => { if (e.target.tagName === 'SELECT') return;
    if (e.key === 'Escape') close(); else if (e.key === ' ') { e.preventDefault(); setDir(dir ? 0 : 1); } else if (e.key === 'ArrowLeft') { setDir(0); seek(k - 1); } else if (e.key === 'ArrowRight') { setDir(0); seek(k + 1); }
    else if (e.key === 'j' || e.key === 'J') setDir(-1); else if (e.key === 'k' || e.key === 'K') setDir(0); else if (e.key === 'l' || e.key === 'L') setDir(1); else if (e.key === 'Home') { setDir(0); seek(0); } else if (e.key === 'End') { setDir(0); seek(N - 1); } };
  document.addEventListener('keydown', onKey);
  const ro = new ResizeObserver(() => { size(); render(false); }); ro.observe($('.hdp-right'));
  function close() { cancelAnimationFrame(raf); ro.disconnect(); map.destroy(); document.removeEventListener('keydown', onKey); root.remove(); if (current && current.root === root) current = null; }

  fillSpeeds(); size(); seek(opt.seek != null ? opt.seek : 0);
  if (opt.seek == null && !matchMedia('(prefers-reduced-motion: reduce)').matches) setDir(1);
  raf = requestAnimationFrame(loop);
  return { root, close };
}
