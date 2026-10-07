// notebook-views.mjs — ONE LEDGER, THREE STYLINGS. Chat, Generate and Notebook are three drawings of the same sealed logs;
// switching between them changes what is drawn and nothing that is recorded. Every one carries the same two panels:
//   Skills  the learned analyses, each with a switch (a person's recorded decision; off needs a reason)
//   Audit   which method produced which claim, who wrote it, what admitted it, who switched it, and whether the chains verify

import { resolveHandles, labelOf } from "./handles.mjs";
import { sourceOf, execsOf, editsOf, dataOf, stale, verify } from "./notebook.mjs";
import { phrase, statusOf, support, STATUSES } from "./bench.mjs";
import { COMMANDS } from "./notebook-commands.mjs";
import { audit } from "./notebook-audit.mjs";
import * as L from "./notebook-learn.mjs";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));



const CSS = `:root{--bg:#fff;--page:#eeeeee;--fg:#212121;--mut:#757575;--line:#cfcfcf;--code:#f7f7f7;--in:#303f9f;--out:#d84315;--sel:#42a5f5;--ok:#1b7f4b;--bad:#c62828;--warn:#8a5a00;--bar:#f5f5f5}
@media(prefers-color-scheme:dark){:root{--bg:#1b1b1d;--page:#121213;--fg:#e6e6e6;--mut:#9a9a9a;--line:#3a3a3d;--code:#252528;--in:#8c9eff;--out:#ff8a65;--sel:#64b5f6;--ok:#66d19e;--bad:#ff8a80;--warn:#e0b060;--bar:#232326}}
[hidden]{display:none!important}*{box-sizing:border-box}body{margin:0;background:var(--page);color:var(--fg);font:14px/1.5 "Helvetica Neue",Helvetica,Arial,sans-serif}
#top{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line)}#top .t1{display:flex;align-items:center;gap:12px;padding:6px 16px}#top h1{font-size:18px;margin:0;font-weight:500}
.badge{font-size:11px;border:1px solid var(--line);border-radius:3px;padding:0 6px;color:var(--mut)}.badge.ok{color:var(--ok);border-color:var(--ok)}.badge.bad{color:var(--bad);border-color:var(--bad)}
#bar{display:flex;gap:4px;flex-wrap:wrap;padding:4px 16px;background:var(--bar);border-top:1px solid var(--line)}#bar button,#bar a{font:inherit;font-size:12px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:3px;padding:3px 9px;cursor:pointer;text-decoration:none}#bar button:hover,#bar a:hover{border-color:var(--sel)}#bar .sp{flex:1}
#nb{max-width:1000px;margin:14px auto 120px;background:var(--bg);border:1px solid var(--line);padding:14px 10px;min-height:60vh}
.cell{display:flex;gap:6px;margin:6px 0;padding:2px 6px 2px 0;border-left:5px solid transparent}.cell.sel{border-left-color:var(--sel)}.cell:hover{border-left-color:var(--line)}.cell.sel:hover{border-left-color:var(--sel)}
.pr{flex:0 0 78px;text-align:right;font:12px/1.7 "DejaVu Sans Mono",monospace;color:var(--in);user-select:none;padding-top:5px}.pr.o{color:var(--out)}.pr .who{display:block;color:var(--mut);font-size:10px}
.body{flex:1;min-width:0}.code,textarea.code{border:1px solid var(--line);background:var(--code);border-radius:2px;padding:6px 8px;font:13px/1.45 "DejaVu Sans Mono",monospace;white-space:pre-wrap;margin:0;overflow:auto;width:100%;color:var(--fg)}
textarea.code{min-height:60px;resize:vertical;display:block}.sel textarea.code{border-color:var(--sel)}
.outp{padding:4px 8px;font:13px/1.45 "DejaVu Sans Mono",monospace;white-space:pre-wrap;margin:0;overflow:auto}.outp.bad{color:var(--bad)}.outp img{max-width:100%;display:block;margin:6px 0}
.meta{font-size:11px;color:var(--mut);padding:0 8px 2px}.stale{color:var(--warn)}
.md{padding:2px 8px}.md h1,.md h2,.md h3{margin:.4em 0 .2em;font-weight:500}.md code{background:var(--code);padding:0 4px}.md ul{margin:.3em 0}
.claim{border:1px solid var(--line);border-left:4px solid var(--mut);border-radius:2px;padding:6px 10px}.claim.computed_in_range,.claim.proved{border-left-color:var(--ok)}.claim .st{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--mut)}.claim.computed_in_range .st,.claim.proved .st{color:var(--ok)}
.chip{font-size:11px;border:1px solid var(--line);border-radius:9px;padding:0 7px;color:var(--mut)}.gap{color:var(--warn);font-size:12px}
.given{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px 88px}.given .f{border:1px solid var(--line);border-radius:3px;padding:2px 8px;font-size:12px;background:var(--bar)}
#cmd{position:fixed;left:0;right:0;bottom:0;background:var(--bg);border-top:1px solid var(--line);padding:8px 16px;z-index:6}#cmd input{width:100%;max-width:1000px;display:block;margin:0 auto;font:13px "DejaVu Sans Mono",monospace;padding:8px 10px;background:var(--code);color:var(--fg);border:1px solid var(--line);border-radius:3px}
#toast{position:fixed;left:50%;transform:translateX(-50%);bottom:64px;max-width:900px;width:calc(100% - 32px);background:var(--bg);border:1px solid var(--sel);border-radius:4px;padding:8px 12px;font:12px/1.5 "DejaVu Sans Mono",monospace;white-space:pre-wrap;max-height:50vh;overflow:auto;z-index:7;display:none;box-shadow:0 4px 18px #0003}#toast.on{display:block}#toast .x{float:right;cursor:pointer;color:var(--mut)}
#drop{position:fixed;inset:0;background:#42a5f544;border:3px dashed var(--sel);display:none;z-index:9;align-items:center;justify-content:center;font-size:22px}#drop.on{display:flex}`;


const EXTRA = `
.styles{display:flex;border:1px solid var(--line);border-radius:4px;overflow:hidden}.styles a{padding:2px 12px;font-size:12px;color:var(--fg);text-decoration:none;background:var(--bg);cursor:pointer;border-right:1px solid var(--line)}.styles a:last-child{border-right:0}.styles a.on{background:var(--sel);color:#fff}
.chat{max-width:820px;margin:14px auto 130px;padding:0 12px}.bub{display:flex;margin:12px 0}.bub.me{justify-content:flex-end}.bub .t{max-width:88%;border-radius:14px;padding:9px 14px;background:var(--bar);border:1px solid var(--line)}.bub.me .t{background:var(--sel);color:#fff;border-color:var(--sel)}.bub.ai .t{background:var(--bg);width:88%}.bub details{margin-top:8px}.bub summary{cursor:pointer;color:var(--mut);font-size:12px}
.bub .nbwrap{margin-top:6px;border-top:1px solid var(--line);padding-top:6px;background:var(--page);border-radius:6px}
.gen{max-width:780px;margin:18px auto 130px;background:var(--bg);border:1px solid var(--line);padding:24px 38px 30px;font-family:Georgia,"Times New Roman",serif}.gen h1{font-weight:400;font-size:26px;margin:.2em 0}.gen h2{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--mut);margin:22px 0 6px}
.gen table{border-collapse:collapse;width:100%;font:13px "Helvetica Neue",Helvetica,Arial,sans-serif}.gen td,.gen th{border-bottom:1px solid var(--line);padding:5px 8px;text-align:left;vertical-align:top}.gen .md p{font-size:15px}
#genbox{max-width:780px;margin:14px auto 0;display:flex;gap:8px;padding:0 4px}#genbox textarea{flex:1;min-height:54px;font:14px Georgia,serif;padding:8px 10px;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px}#genbox button{font-size:14px;padding:0 18px;background:var(--sel);color:#fff;border:0;border-radius:6px;cursor:pointer}
#drawer{position:fixed;top:0;right:0;bottom:0;width:min(520px,100vw);background:var(--bg);border-left:1px solid var(--line);z-index:8;box-shadow:-6px 0 20px #0002;transform:translateX(105%);transition:transform .15s;display:flex;flex-direction:column}#drawer.on{transform:none}
#drawer .hd{display:flex;gap:6px;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line)}#drawer .hd .tab{cursor:pointer;padding:2px 10px;border-radius:3px;font-size:13px}#drawer .hd .tab.on{background:var(--sel);color:#fff}#drawer .bd{overflow:auto;padding:10px 14px;font-size:13px}
.sk{border:1px solid var(--line);border-radius:5px;padding:8px 10px;margin:8px 0}.sk.off{opacity:.6}.sk .nm{font-weight:600}.sk .row{display:flex;gap:8px;align-items:center}.sw{width:38px;height:20px;border-radius:10px;background:var(--line);position:relative;cursor:pointer;flex:none;border:0}.sw.on{background:var(--ok)}.sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:8px;background:#fff;transition:left .12s}.sw.on::after{left:20px}
.fk{font-size:10px;padding:0 6px;margin-top:4px;border:1px solid var(--line);background:var(--bg);color:var(--mut);border-radius:9px;cursor:pointer;display:block}.fk:hover{color:var(--fg);border-color:var(--sel)}\n#tabs{display:flex;gap:2px;padding:4px 16px 0;overflow-x:auto;background:var(--bar);border-top:1px solid var(--line)}#tabs .tab{display:flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--line);border-bottom:0;border-radius:6px 6px 0 0;background:var(--page);color:var(--fg);text-decoration:none;font-size:12px;white-space:nowrap}#tabs .tab.on{background:var(--bg);font-weight:600;border-bottom:1px solid var(--bg);margin-bottom:-1px}#tabs .tab .ty{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#fff;background:var(--mut);border-radius:8px;padding:0 6px}#tabs .tab .ty.chat{background:#2e7d32}#tabs .tab .ty.generate{background:#8e24aa}#tabs .tab .ty.notebook{background:#1565c0}#tabs .x{color:var(--mut);cursor:pointer;margin-left:2px}#tabs .plus{padding:4px 10px;cursor:pointer;color:var(--mut);font-size:14px}#newmenu{position:absolute;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:4px;z-index:9;box-shadow:0 4px 14px #0003}#newmenu button{display:block;width:100%;text-align:left;margin:2px 0}.lineage{font-size:12px;color:var(--mut);padding:4px 16px;background:var(--bar)}
.k{color:var(--mut)}.mono{font:12px "DejaVu Sans Mono",monospace}#drawer pre{background:var(--code);border:1px solid var(--line);padding:6px;overflow:auto;font-size:11px;white-space:pre-wrap;margin:4px 0}
.ok{color:var(--ok)}.brk{color:var(--bad);font-weight:600}.mchip{cursor:pointer;color:var(--in);border-bottom:1px dotted}
`;
const inline = (t) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<i>$2</i>");
/** A small markdown: headings, bold/italic/code, bullet lists, paragraphs. Everything escaped first. */
export function mdToHtml(src) {
  const out = []; let list = false;
  for (const line of String(src).split("\n")) {
    const h = line.match(/^(#{1,3})\s+(.*)$/), li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (list) { out.push("</ul>"); list = false; }
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); else if (line.trim()) out.push(`<p style="margin:.3em 0">${inline(line)}</p>`);
  }
  if (list) out.push("</ul>");
  return out.join("");
}


const tabsHtml = (tabs, cur, live) => (tabs ? `<div id="tabs">${tabs.map((c) => `<a class="tab ${c.id === cur ? "on" : ""}" href="?c=${esc(c.id)}" title="${esc(c.id)}${c.parent ? ` · forked from ${esc(c.parent)}` : ""}"><span class="ty ${esc(c.type)}">${esc(c.type)}</span>${esc(c.title)}${c.parent ? " ⑂" : ""}${live && c.id === cur ? `<span class="x" data-op="ws-close" title="close this tab (kept on the record)">×</span>` : ""}</a>`).join("")}${live ? `<span class="plus" data-op="ws-plus" title="new conversation">＋</span>` : ""}</div>` : "");
export const STYLES = Object.freeze([["chat", "Chat"], ["generate", "Generate"], ["notebook", "Notebook"]]);

const forkBtn = (o, at) => (o.live && o.fork ? `<button class="fk" data-op="fork" data-at="${esc(at)}" title="fork this conversation from here — a new tab that starts with everything up to this cell">⑂ fork</button>` : "");
function cellNb(st, c, o) {
  const { live, sel, handles, count } = o;
  const src = sourceOf(st.nb, c.id), ex = execsOf(st.nb, c.id), last = ex.at(-1), edits = editsOf(st.nb, c.id).length;
  const cls = `cell${sel === c.id ? " sel" : ""}`, attr = `id="${esc(c.id)}" data-cell="${esc(c.id)}" data-type="${c.type}"`;
  const proposed = c.proposed ? ` <span class="chip">proposed by ${esc(c.author)}</span>` : "";
  const meth = c.method ? ` <span class="chip mchip" data-op="open-skill" data-id="${esc(c.method.id)}" title="method ${esc(c.method.id)} · code ${esc(c.method.codeSha ?? "")} — click for its card">method: ${esc(c.method.name)}</span>` : "";
  if (c.type === "markdown") return `<section class="${cls}" ${attr}><div class="pr"><span class="who">${esc(c.id)}</span>${forkBtn(o, c.id)}</div><div class="body"><div class="md" ${live ? `title="double-click to edit"` : ""}>${mdToHtml(src)}</div>${live ? `<textarea class="code" data-src="${esc(c.id)}" hidden>${esc(src)}</textarea>` : ""}${edits ? `<div class="meta">${edits} edit(s)</div>` : ""}${proposed}</div></section>`;
  if (c.type === "claim") {
    const s = statusOf(st.bench, c.id), sup = support(st.bench, c.id);
    const btns = live ? STATUSES.filter((x) => STATUSES.indexOf(x) > STATUSES.indexOf(s)).map((x) => `<button data-op="promote" data-card="${esc(c.id)}" data-to="${x}">promote → ${esc(labelOf(handles, "status", x))}</button>`).join(" ") : "";
    return `<section class="${cls}" ${attr}><div class="pr"><span class="who">${esc(c.id)}</span>${forkBtn(o, c.id)}</div><div class="body"><div class="claim ${s}"><div class="st">${esc(labelOf(handles, "status", s))} · claim · ${sup.checks.length} check(s) · ${sup.controls.length} control(s) that failed as they should${sup.failed.length ? ` · <span style="color:var(--bad)">${sup.failed.length} check(s) came back false</span>` : ""}</div>${esc(phrase(st.bench, c.id))}<div style="margin-top:4px">${btns}</div></div>${proposed}${meth}</div></section>`;
  }
  const why = stale(st, c.id), n = last ? count(last) : " ";
  const figs = (last?.figures ?? []).map((f) => `<img alt="figure ${esc(f.name)} (sha256 ${f.sha.slice(0, 12)})" src="data:image/png;base64,${f.png}">`).join("");
  const bound = c.for ? `<span class="chip">${esc(c.role)} of ${esc(c.for)}</span> ` : "";
  const box = live ? `<textarea class="code" data-src="${esc(c.id)}" rows="${Math.min(18, Math.max(2, src.split("\n").length))}" spellcheck="false">${esc(src)}</textarea>` : `<pre class="code">${esc(src)}</pre>`;
  return `<section class="${cls}" ${attr}><div class="pr">In&nbsp;[${last ? n : "&nbsp;"}]:<span class="who">${esc(c.lang)} · ${esc(c.id)}</span>${forkBtn(o, c.id)}</div><div class="body">${bound}${meth}${proposed}${box}${last ? `</div></section><section class="cell${sel === c.id ? " sel" : ""}" data-out="${esc(c.id)}"><div class="pr o">Out&nbsp;[${n}]:</div><div class="body"><pre class="outp ${last.ok ? "" : "bad"}">${esc(last.output) || (last.figures.length ? "" : "(no output)")}</pre>${figs}<div class="meta">${last.ms ?? "?"} ms · ${ex.length} run(s) · code ${last.codeSha.slice(0, 10)} · saw ${Object.keys(last.dataShas).length} file(s) · scope ${esc(last.scope.kind)}${last.result === null ? "" : ` · result ${last.result}`}${edits ? ` · ${edits} edit(s)` : ""}${why ? ` · <span class="stale">⚠ ${esc(why)}</span>` : ""}</div>` : `<div class="meta">${why ? `<span class="stale">${esc(why)}</span>` : ""}</div>`}</div></section>`;
}

const givenHtml = (st) => { const g = dataOf(st.nb).map((d) => `<span class="f" title="${esc(d.gaps.map((x) => x.kind + ": " + x.reason).join("\n"))}"><b>${esc(d.name)}</b> ${esc(d.dataKind)} · ${d.chars} chars${d.tables ? ` · ${d.tables} table(s)` : ""}${d.gaps.length ? ` · <span class="gap">⚠ ${d.gaps.map((x) => esc(x.kind)).join(", ")}</span>` : ""}</span>`).join(""); return g ? `<div class="given">${g}</div>` : ""; };

/** groups: an `askN` note opens a turn and its `ansN` note closes it; everything between is the work. */
function turns(st) {
  const cells = st.nb.entries.filter((e) => e.kind === "cell"), out = []; let cur = null;
  for (const c of cells) {
    if (c.type === "markdown" && /^ask\d+x*$/.test(c.id)) { cur = { ask: c, work: [], ans: null }; out.push(cur); continue; }
    if (cur && c.type === "markdown" && /^ans\d+x*$/.test(c.id)) { cur.ans = c; cur = null; continue; }
    if (cur) cur.work.push(c); else out.push({ loose: c });
  }
  return out;
}

function chatView(st, o) {
  const b = turns(st).map((t) => {
    if (t.loose) return t.loose.type === "markdown" ? `<div class="bub me"><div class="t md">${mdToHtml(sourceOf(st.nb, t.loose.id))}${forkBtn(o, t.loose.id)}</div></div>` : `<div class="bub ai"><div class="t"><div class="nbwrap">${cellNb(st, t.loose, o)}</div></div></div>`;
    const asked = sourceOf(st.nb, t.ask.id).match(/\*\*Asked:\*\* ([\s\S]*?)\n\n/)?.[1] ?? "";
    const note = sourceOf(st.nb, t.ask.id).split("\n\n").slice(1).join("\n\n");
    return `<div class="bub me"><div class="t">${esc(asked)}</div></div><div class="bub ai"><div class="t">${t.ans ? `<div class="md">${mdToHtml(sourceOf(st.nb, t.ans.id))}</div>` : ""}${t.ans ? forkBtn(o, t.ans.id) : ""}<details><summary>how this was produced · ${t.work.length} cells · the method, its controls, the runs</summary><div class="md" style="margin:6px 0">${mdToHtml(note)}</div><div class="nbwrap">${t.work.map((c) => cellNb(st, c, o)).join("")}</div></details></div></div>`;
  }).join("");
  return `<div class="chat">${givenHtml(st).replace('margin:0 0 10px 88px', "")}${b || `<p style="color:var(--mut);text-align:center;margin-top:40px">Ask about your data in plain words — or <code>/ingest</code> a file first.</p>`}</div>`;
}

function generateView(st, o) {
  const A = audit(st, o.dir), ts = turns(st).filter((t) => t.ask);
  const claimsRows = (cs) => cs.map((c) => `<tr><td><b>${esc(c.id.replace(/^k-/, ""))}</b><br>${esc(c.text)}</td><td>${esc(labelOf(o.handles, "status", c.status))}</td><td>${c.method ? `<span class="mchip" data-op="open-skill" data-id="${esc(c.method.id)}">${esc(c.method.name)}</span>` : "by hand"}</td><td>${c.check ? `${c.check.result} <span class="k mono">${esc(c.check.hash)}</span>` : "—"}</td><td>${c.control ? `${c.control.result} <span class="k mono">${esc(c.control.hash)}</span>` : "—"}</td><td>${c.promotions.length ? c.promotions.map((p) => `${esc(p.to)} · ${esc(p.by)}`).join("<br>") : "not adopted"}${o.live ? STATUSES.filter((x) => STATUSES.indexOf(x) > STATUSES.indexOf(c.status)).map((x) => `<br><button data-op="promote" data-card="${esc(c.id)}" data-to="${x}">→ ${esc(labelOf(o.handles, "status", x))}</button>`).join("") : ""}</td></tr>`).join("");
  const docs = ts.map((t) => { const q = sourceOf(st.nb, t.ask.id).match(/\*\*Asked:\*\* ([\s\S]*?)\n\n/)?.[1] ?? ""; const ids = new Set(t.work.filter((c) => c.type === "claim").map((c) => c.id)); const cs = A.claims.filter((c) => ids.has(c.id));
    const how = sourceOf(st.nb, t.ask.id).split("\n\n").slice(1).join("\n\n");
    return `<h1>${esc(q)}</h1><div class="md">${t.ans ? mdToHtml(sourceOf(st.nb, t.ans.id).replace(/\n\*\*Claims \(proposed[\s\S]*$/, "")) : ""}</div>${t.ans ? forkBtn(o, t.ans.id) : ""}<h2>How this was found</h2><div class="md">${mdToHtml(how)}</div><h2>Claims and what stands behind them</h2><table><tr><th>claim</th><th>status</th><th>method</th><th>check</th><th>control (must be false)</th><th>adopted?</th></tr>${claimsRows(cs)}</table>`; }).join("<hr style='border:0;border-top:1px solid var(--line);margin:30px 0'>");
  const used = A.methods.map((m) => `<li><span class="mchip" data-op="open-skill" data-id="${esc(m.id)}">${esc(m.name ?? m.id)}</span> — ${m.on ? "on" : "<b>OFF</b>"}; written by ${esc(m.learnedBy)}; used ${m.uses}×</li>`).join("");
  const c = A.chains, ok = (x) => (x.ok ? `<span class="ok">verifies</span>` : `<span class="brk">BROKEN — ${esc(x.reason)}</span>`);
  return `<div id="genbox">${o.live ? `<textarea id="gen" placeholder="Describe what to generate — e.g. “is the u column Kolmogorov-like, and do any columns have bursts?”"></textarea><button data-op="gen">Generate</button>` : ""}</div><div class="gen">${givenHtml(st).replace('margin:0 0 10px 88px', "")}${docs || `<p style="color:var(--mut)">Nothing generated yet. Describe what you want above.</p>`}<h2>Methods used</h2><ul>${used || "<li>none</li>"}</ul><h2>Audit</h2><p style="font:13px Helvetica,Arial,sans-serif">Notebook chain ${ok(c.notebook)} · claim ledger ${ok(c.bench)} · learned methods ${ok(c.analyses)}. <span class="mchip" data-op="drawer" data-tab="audit">open the full audit</span></p></div>`;
}

function notebookView(st, o) {
  const cells = st.nb.entries.filter((e) => e.kind === "cell").map((c) => cellNb(st, c, o)).join("");
  return `<div id="nb">${givenHtml(st)}${cells || `<p style="margin:20px 88px;color:var(--mut)">Empty. Drop a file anywhere, or type below: <code>/ingest paper.pdf</code>, <code>/help</code>, or a question in plain words.</p>`}</div>`;
}

function drawerHtml(st, o) {
  const A = audit(st, o.dir), lib = L.library(o.dir), all = lib.length && lib.every((k) => k.effectiveOn);
  const skills = lib.map((k) => `<div class="sk ${k.effectiveOn ? "" : "off"}" id="sk-${esc(k.id)}"><div class="row"><span class="nm">${esc(k.name)}</span><span style="flex:1"></span>${o.live ? `<button class="sw ${k.effectiveOn ? "on" : ""}" data-op="switch" data-id="${esc(k.id)}" data-on="${k.effectiveOn ? 0 : 1}" title="${k.effectiveOn ? "on — click to turn off (a reason is recorded)" : "off — click to turn on"}"></button>` : `<span class="chip">${k.effectiveOn ? "on" : "off"}</span>`}</div>
<div class="k mono">${esc(k.id)} · used ${k.uses}× · written by ${esc(k.lineage?.mouth ?? "?")}</div><div>${esc(k.claim.replaceAll("{{COL}}", "‹column›"))}</div>
${k.switch?.decided ? `<div class="k">switch: ${k.switch.on ? "on" : "off"} by ${esc(k.switch.by)}${k.switch.why ? ` — ${esc(k.switch.why)}` : ""}</div>` : `<div class="k">switch: default (on) — nobody has decided</div>`}${k.conceded ? `<div class="brk">CONCEDED — ${esc(k.conceded.because)}</div>` : ""}
${o.skillsBase ? `<div class="k"><a href="${esc(o.skillsBase)}#${esc("learned:analysis/" + k.id)}">full card in the Skills surface ↗</a></div>` : ""}<details><summary class="k">why it was admitted, and its code</summary><div class="k">admitted by ${(k.evidence?.runs ?? []).map((r) => `${r.role}@${esc(r.col)}=${r.result}`).join(", ")}; ${esc(k.evidence?.generalisation ?? "")}</div><div class="k">check</div><pre>${esc(k.check)}</pre><div class="k">control</div><pre>${esc(k.control)}</pre></details></div>`).join("");
  const chain = (n, x) => `<div>${n}: ${x.ok ? `<span class="ok">verifies</span>${x.entries != null ? ` (${x.entries} entries)` : ""}` : `<span class="brk">BROKEN at ${esc(x.at)} — ${esc(x.reason)}</span>`}</div>`;
  const claims = A.claims.map((c) => `<div class="sk"><div class="nm">${esc(c.id)} <span class="chip">${esc(c.status)}</span></div><div>${esc(c.text)}</div><div class="k">produced by ${c.method ? `<span class="mchip" data-op="open-skill" data-id="${esc(c.method.id)}">${esc(c.method.name)}</span> <span class="mono">code ${esc((c.method.codeSha ?? "").slice(0, 10))}</span>` : "hand-written cells"}${c.proposedBy ? ` · proposed by ${esc(c.proposedBy)}` : ""}</div><div class="k mono">check ${c.check ? `${esc(c.check.cell)} → ${c.check.result} · seal ${esc(c.check.hash)}` : "not run"} · control ${c.control ? `${esc(c.control.cell)} → ${c.control.result} · seal ${esc(c.control.hash)}` : "not run"}</div><div class="k">${c.promotions.length ? c.promotions.map((p) => `${esc(p.to)} by ${esc(p.by)} · seal ${esc(p.hash)}`).join("; ") : "not adopted by anyone"}</div></div>`).join("");
  const hist = A.methods.map((m) => `<div class="sk"><div class="nm">${esc(m.name ?? m.id)} — ${m.on ? "ON" : m.conceded ? "CONCEDED" : "OFF"}</div><div class="k">switch history: ${m.switchHistory?.length ? m.switchHistory.map((h) => `${h.kind === "flag" ? "flag" : h.on ? "on" : "off"} by ${esc(h.by)}${h.why ? ` (${esc(h.why)})` : ""}`).join(" → ") : "never touched"}</div></div>`).join("");
  return `<div id="drawer" class="${o.drawer ? "on" : ""}"><div class="hd"><span class="tab ${o.tab === "skills" ? "on" : ""}" data-op="drawer" data-tab="skills">Skills</span><span class="tab ${o.tab === "audit" ? "on" : ""}" data-op="drawer" data-tab="audit">Audit</span><span style="flex:1"></span><span class="tab" data-op="drawer" data-tab="">✕</span></div><div class="bd">
${o.tab === "audit" ? `<h3 style="margin:.2em 0">Chains</h3>${chain("notebook", A.chains.notebook)}${chain("claim ledger", A.chains.bench)}${chain("learned methods", A.chains.analyses)}<h3>Claims → methods</h3>${claims || "<div class='k'>no claims yet</div>"}<h3>Switches on methods used</h3>${hist || "<div class='k'>none used</div>"}<div class="k" style="margin-top:8px">Every line is read from a sealed ledger. <code>/audit</code> prints the same in text.</div>`
  : `<p class="k">Everything the notebook can do to analyse was <b>learned</b> here — none of it is built in. Each is a skill: it can be turned off (a reason is recorded), and is audited in the next tab.</p><div class="row"><b>All learned analyses</b><span style="flex:1"></span>${o.live ? `<button class="sw ${all ? "on" : ""}" data-op="switch" data-id="all" data-on="${all ? 0 : 1}"></button>` : ""}</div>${skills || `<p class="k">Nothing learned yet. Ask a question (a model writes it and the gate admits it), or teach it with <code>/learn</code>.</p>`}`}
</div></div>`;
}

export function renderPage(st, { live = false, by = "", handles = resolveHandles({}).handles, sel = null, style = "notebook", dir = null, drawer = false, tab = "skills", base = "", skillsBase = null, tabs = null, current = null, lineage = null } = {}) {
  style = STYLES.some(([k]) => k === style) ? style : "notebook";
  const v = verify(st), ok = v.notebook.ok && v.bench.ok, allExecs = st.nb.entries.filter((e) => e.kind === "exec");
  const o = { live, sel, handles, dir, base, skillsBase, fork: Boolean(tabs), count: (e) => allExecs.indexOf(e) + 1 };
  const lib = dir ? L.library(dir) : [], on = lib.filter((k) => k.effectiveOn).length, sv = dir ? L.verifyStore(dir) : { ok: true };
  const main = style === "chat" ? chatView(st, o) : style === "generate" ? generateView(st, o) : notebookView(st, o);
  const bar = live && style === "notebook" ? `<div id="bar"><button data-op="run-sel" title="Ctrl+Enter">▶ Run</button><button data-op="run-all">▶▶ Run all</button><button data-op="add-type" data-t="code">+ Code</button><button data-op="add-type" data-t="md">+ Markdown</button><button data-op="add-type" data-t="claim">+ Claim</button><button data-op="cmd" data-c="/tools">Tools</button><button data-op="cmd" data-c="/data">Data</button><button data-op="cmd" data-c="/help">/ Commands</button><span class="sp"></span><a href="${base}/ipynb" download="notebook.ipynb">⤓ .ipynb</a></div>` : "";
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Notebook</title><style>${CSS}${EXTRA}</style>
<div id="top"><div class="t1"><h1>${style === "chat" ? "Chat" : style === "generate" ? "Generate" : "Notebook"}</h1><div class="styles">${STYLES.map(([k, l]) => `<a class="${k === style ? "on" : ""}" data-op="style" data-s="${k}" href="?${current ? `c=${current}&` : ""}style=${k}" title="how this conversation is drawn — the type flag">${l}</a>`).join("")}</div><span class="badge ${ok && sv.ok ? "ok" : "bad"}">${ok && sv.ok ? "chains verify" : "CHAIN BROKEN"}</span><span class="badge">Python 3 · no network</span>${live ? `<span class="badge">as ${esc(by)}</span>` : `<span class="badge">read-only</span>`}<span style="flex:1"></span><a class="badge mchip" data-op="drawer" data-tab="skills" href="#">Skills · ${on}/${lib.length} on</a><a class="badge mchip" data-op="drawer" data-tab="audit" href="#">Audit</a></div>${tabsHtml(tabs, current, live)}${lineage ? `<div class="lineage">⑂ ${lineage}</div>` : ""}${bar}</div>
${main}${dir ? drawerHtml(st, { ...o, drawer, tab }) : ""}
${live ? `<div id="cmd"><input id="line" list="cmds" autocomplete="off" spellcheck="false" placeholder="${style === "generate" ? "or a command — /help" : "ask in plain words, or /help — /ingest /learn /skill /audit /run"}" autofocus><datalist id="cmds">${COMMANDS.map(([c]) => `<option value="${esc(c.split(" ")[0])} ">`).join("")}</datalist></div><div id="toast"></div><div id="drop">Drop to ingest</div>` : ""}
${live ? `<script>const C=${JSON.stringify(current)};const BASE=${JSON.stringify(base)};const STYLE=${JSON.stringify(style)};let sel=${JSON.stringify(sel)},dr=${JSON.stringify({ on: drawer, tab })};const $=(q,r=document)=>r.querySelector(q);
const toast=(t)=>{const e=$("#toast");e.innerHTML='<span class="x" onclick="this.parentNode.classList.remove(\\'on\\')">✕</span>'+t.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));e.classList.add("on")};
const refresh=async()=>{const h=await (await fetch(BASE+"/?c="+(C||"")+"&style="+STYLE+"&sel="+(sel||"")+"&drawer="+(dr.on?1:0)+"&tab="+dr.tab)).text();const d=new DOMParser().parseFromString(h,"text/html");for(const q of ["#top","#nb",".chat",".gen","#genbox","#drawer"]){const a=$(q),b=$(q,d);if(a&&b)a.replaceWith(b);else if(!a&&b)document.body.insertBefore(b,$("#cmd"));else if(a&&!b)a.remove()}bind()};
const call=async(b)=>{const r=await fetch(BASE+"/api",{method:"POST",body:JSON.stringify({c:C,...b})});const j=await r.json();if(j.goto){location.href=BASE+"/?c="+j.goto;return j}if(j.selected)sel=j.selected;if(j.error)toast("✕ "+j.error);else if(j.notice)toast(j.notice);await refresh();return j};
function pick(id){sel=id;document.querySelectorAll(".cell").forEach(c=>c.classList.toggle("sel",c.dataset.cell===id||c.dataset.out===id))}
function bind(){document.querySelectorAll("[data-src]").forEach(t=>{t.onfocus=()=>pick(t.dataset.src);t.onkeydown=async e=>{if(e.key==="Enter"&&(e.shiftKey||e.ctrlKey)){e.preventDefault();const id=t.dataset.src;await call({op:"edit",cell:id,source:t.value,quiet:true});const c=document.querySelector('[data-cell="'+id+'"]');if(c.dataset.type==="code")await call({op:"run",cell:id});const nxt=[...document.querySelectorAll('[data-cell]')];const i=nxt.findIndex(x=>x.dataset.cell===id);if(e.shiftKey&&nxt[i+1])document.querySelector('[data-src="'+nxt[i+1].dataset.cell+'"]')?.focus();else $("#line").focus()}}});
document.querySelectorAll(".cell").forEach(c=>c.onclick=()=>pick(c.dataset.cell||c.dataset.out));document.querySelectorAll(".md").forEach(m=>m.ondblclick=()=>{const t=m.parentNode.querySelector("textarea");if(!t)return;m.hidden=true;t.hidden=false;t.focus()})}
bind();
document.addEventListener("click",async e=>{const el=e.target.closest("[data-op]");if(!el)return;const d=el.dataset,o=d.op;
if(o==="style"){e.preventDefault();if(C){await call({op:"ws-retype",type:d.s});location.href=BASE+"/?c="+C}else location.href="?style="+d.s}
if(o==="fork"){const t=prompt("Name the fork (it starts with everything up to here; the parent is untouched, and promotions do not carry over)","");if(t===null)return;await call({op:"ws-fork",at:d.at,title:t||null})}
if(o==="ws-plus"){document.getElementById("newmenu")?.remove();const m=document.createElement("div");m.id="newmenu";m.innerHTML=["chat","generate","notebook"].map(function(t){return '<button data-op="ws-new" data-t="'+t+'">new '+t+"</button>"}).join("");const r=el.getBoundingClientRect();m.style.left=r.left+"px";m.style.top=(r.bottom+window.scrollY)+"px";document.body.appendChild(m)}
if(o==="ws-new"){await call({op:"ws-new",type:d.t})}
if(o==="ws-close"){e.preventDefault();if(confirm("Close this tab? The conversation stays on the record.")){await call({op:"ws-close"})}}
if(o==="drawer"){e.preventDefault();dr={on:d.tab!=="",tab:d.tab||dr.tab};await refresh()}
if(o==="open-skill"){dr={on:true,tab:"skills"};await refresh();document.getElementById("sk-"+d.id)?.scrollIntoView({block:"center"})}
if(o==="switch"){const on=d.on==="1";let why=null;if(!on){why=prompt("Why turn this off? (recorded, with your name, in the skill ledger)");if(why===null)return;if(!why.trim()){toast("✕ a reason is needed to switch a method off");return}}else{why=prompt("Why turn it on? (optional)")||null}await call({op:"skill",which:d.id,on,why})}
if(o==="promote")call({op:"promote",card:d.card,to:d.to});
if(o==="gen"){const t=$("#gen").value.trim();if(t){$("#gen").value="";await call({op:"line",line:t})}}
if(o==="run-sel"){if(sel)call({op:"run",cell:sel});else toast("select a code cell first")}
if(o==="run-all")call({op:"runmany",which:"all"});
if(o==="cmd")call({op:"line",line:d.c});
if(o==="add-type"){$("#line").value=d.t==="code"?"/py ":d.t==="md"?"/md ":"/claim ";$("#line").focus()}});
$("#line").addEventListener("keydown",async e=>{if(e.key==="Enter"&&e.target.value.trim()){const l=e.target.value;e.target.value="";await call({op:"line",line:l})}});
let dc=0;addEventListener("dragenter",e=>{e.preventDefault();dc++;$("#drop").classList.add("on")});addEventListener("dragleave",()=>{if(--dc<=0)$("#drop").classList.remove("on")});addEventListener("dragover",e=>e.preventDefault());
addEventListener("drop",async e=>{e.preventDefault();dc=0;$("#drop").classList.remove("on");for(const f of e.dataTransfer.files){const b=new Uint8Array(await f.arrayBuffer());let s="";for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode.apply(null,b.subarray(i,i+8192));await call({op:"upload",name:f.name,base64:btoa(s)})}});
</script>` : ""}`;
}
