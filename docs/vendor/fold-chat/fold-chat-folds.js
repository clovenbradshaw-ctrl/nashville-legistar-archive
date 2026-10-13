// fold-chat-folds.js — FOLDS: the agent's artifact threads, beside the chat. A fold is one artifact and its whole making:
// an append-only log of EOT assemblies (the model's, the app's, the person's). The log IS the fold — reopening one replays
// its set-down assemblies into a fresh kernel, deterministically. The workspace is a terminal-like session on the left
// (the ask, each assembly's units and who filled them, follow-ups, edits, undos) and the artifact's canvas on the right.
// Making goes through the block kit's weave (library → box → hunt → mouth, unit by unit); the model is whichever the
// chat would use (the in-tab model when nothing else answers). Nothing here writes HTML for the model to fill.
import * as client from "./fold-chat-client.js";
import { render } from "./fold-blocks.js";
import { createKernel } from "./fold-blocks-kernel.js";
import { monologue } from "./fold-blocks-make.js";
import { editorFor, editEOT, editableParts } from "./fold-blocks-edit.js";
import { createMemory, contentWords } from "./fold-blocks-weave.js";
import { longKind, urlOf, runEssay, runExtract, addSection, replaceInArtifact, extendEssay } from "./fold-chat-longform.js";
import { createWorkspace, treeOf, applyEdits, parseEdits, diffLines, diffStat, snapshot as wsSnapshot } from "./fold-chat-workspace.js";
// THE APP'S OWN FALSIFIER — the same organ the answer lane uses. A made page is
// not trusted because it renders; its CLAIMS are falsified against the material
// that was read, and a failing claim sends the turn back (REC→NUL) to be corrected.
import { falsifyAnswer, claimSentences, FAILING } from "./fold-chat-falsify-answer.js";
// THE CUBE + THE GATE, woven in: every act lands on one of the 27 coherent
// cells (cellOf), the turn is typed before any draw (gateTurn), and the turn's
// loop-back edges run as a bounded recursion (runSpiral).
import { RUNGS, cellOf, cellLine, gateTurn, runSpiral } from "./fold-chat-cube.js";
// THE WEAVE, in the browser (an experiment): the page is stitched from what was
// read — field first, mouth only the residue, every byte logged with provenance.
import { createBuild, unitsFromOutline, snipFor, grounded, assetFor } from "./fold-chat-build.js";
// THE ASK, FOLDED; THE PRODUCT, JOINED. EVA is a join over addressed atoms, not a
// model holding the whole ask or the whole page: the ask folds into bounded spans,
// each read locally into verbatim-verified atoms; the render is the other side.
import { askSpans, atomsFrom, missingAtoms, unreadSpans, atomLine } from "./fold-chat-require.js";
// THE MEASURED STOP (THE-STIGMERGIC-PIPELINE §5): the turn's fuel is a FLOOR;
// the stop is the DMD decay (or cycle) of the turn's own trajectory.
import { createTurnGate, stopLine } from "./fold-chat-dmd.js";
// THE OUTSIDE INTERPRETER: the signals a turn's own residual cannot supply. The
// DMD gate reads the residual (experiment-recursion.mjs: the loop cannot close
// itself); these close it — NEW GROUND (a search that adds nothing) and a
// REPEATED STATE (the turn came back to where it was).
import { createProgressGuard, novelGround, stateOf, isConverging } from "./fold-chat-outside.js";

const KEY = "fold-chat:folds@1";
// THE WEAVE EXPERIMENT: ?stitch=1 makes the make stitch the page from what was
// read (field first, the mouth only the residue) instead of drawing it whole.
const STITCH = (typeof location !== "undefined") && new URLSearchParams(location.search).get("stitch") === "1";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "fd_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
// PHEROMONE TRAILS — the ant's memory over the log. A path that led to a held page
// is reinforced; a path that soured is marked down; every deposit lets all trails
// evaporate a little, so stale ground is forgotten. The hunt then follows the
// strongest trail first. (Ant-swarm protocol: deposit · evaporate · follow.)
const TRAIL_KEY = "fold-chat:trails@1";
const EVAPORATE = 0.85;
const loadTrails = () => { try { return JSON.parse(localStorage.getItem(TRAIL_KEY)) || {}; } catch { return {}; } };
const saveTrails = (t) => { try { localStorage.setItem(TRAIL_KEY, JSON.stringify(t)); } catch {} };
const pheromone = (k) => { try { return loadTrails()[k] || 0; } catch { return 0; } };
const domainKey = (m) => String((m && (m.source || m.url)) || "").replace(/^https?:\/\//i, "").split(/[/?#:]/)[0].toLowerCase();
/** Lay a batch of trails: evaporate once, then add. A negative amount sours the ground. */
function trail(keys, amount = 1) {
  const t = loadTrails();
  for (const k of Object.keys(t)) { t[k] *= EVAPORATE; if (Math.abs(t[k]) < 0.05) delete t[k]; }
  for (const k of keys) t[k] = (t[k] || 0) + amount;
  saveTrails(t); return t;
}
// THE OPERATORS (organs/cube.mjs): every act is one, and the log carries which.
const OPG = Object.freeze({ NUL: "∅", SIG: "○", INS: "●", SEG: "｜", CON: "⋈", SYN: "△", DEF: "⊢", EVA: "⊨", REC: "◉" });
const opg = (e) => (e && e.op && OPG[e.op] ? `<span class="fs-op" title="${esc(e.op)}">${OPG[e.op]}</span>` : "");const ago = (t) => { const s = Math.round((Date.now() - t) / 1000); return s < 60 ? "just now" : s < 3600 ? Math.round(s / 60) + "m" : s < 86400 ? Math.round(s / 3600) + "h" : Math.round(s / 86400) + "d"; };
// PLAIN LANGUAGE. This surface is read by a person, not a machine: every internal
// operator and speaker is said in words a person would use, and the raw glyph,
// the cube cell and the provenance stay behind a disclosure for whoever wants
// the machinery. (Legibility is the point; the log is still underneath it.)
const STEP = Object.freeze({ NUL: "Starting", SIG: "Searching the web", INS: "Adding", SEG: "Planning the pieces", CON: "Checking what we have", SYN: "Building", DEF: "Understanding the ask", EVA: "Testing it", REC: "Fixing" });
const WHO = Object.freeze({ fold: "The Fold", app: "The Fold", model: "The writer", mouth: "The writer", you: "You", library: "Library", hunt: "The web", box: "The box", gap: "Missing", wall: "Blocked" });
const KIND_WORD = Object.freeze({ app: "web page", essay: "sourced essay", extract: "parsed page", website: "website", widget: "widget", document: "document", codebase: "codebase" });
const LANE_WORD = Object.freeze({ refuse: "a refusal", received: "a build from what you gave", refused: "a refusal", grounded: "a build over the sources", mechanical: "a build", shown: "a question for Chat" });
const stepWord = (e) => (e && e.op && STEP[e.op]) || "Working";
const whoWord = (by) => WHO[by] || (by ? String(by)[0].toUpperCase() + String(by).slice(1) : "The Fold");
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return String(u || "").replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/^www\./, ""); } };
/** A source as a chip: the domain you can trust-at-a-glance, the title on hover. */
const sourceChip = (s) => {
  const url = s.url || "";
  const title = s.title || s.source || url;
  const label = hostOf(url) || String(title).slice(0, 42);
  return `<a class="fs-source" href="${esc(url || "#")}" target="_blank" rel="noreferrer" title="${esc(title)}">${esc(label)}</a>`;
};
// THE TRUST LEDGER: what was read, what the page claims, and whether it ran —
// read back off the fold's own log, so it survives a reopen and is never a
// separate shadow copy of the truth.
function trustOf(f) {
  const log = (f && f.log) || [];
  let sources = null, claims = null, run = null;
  for (const e of log) {
    if (e.sources && e.sources.length) sources = e.sources;
    if (e.claims) claims = e.claims;
    if (e.run) run = e.run;
  }
  return { sources, claims, run };
}
/** An ask that makes a thing (a page, a widget, a document) rather than asks a question. Declared words; when unsure: no. */
export function isMakeAsk(text) {
  const q = String(text || "").toLowerCase();
  if (longKind(text)) return true;
  return /\b(make|build|create|design|draft|write|set up|spin up|generate|mock up)\b/.test(q) && /\b(site|website|page|landing|widget|calculator|converter|estimator|tool|document|doc|guide|report|memo|handbook|brief|one-pager|flyer|menu)\b/.test(q);
}

const CSS = `
.main.folding > :not(.topbar):not(.foldspace){display:none!important}
.main.folding .topchat{display:none!important}
.foldspace{flex:1;min-height:0;min-width:0;display:grid;grid-template-columns:minmax(320px,430px) minmax(0,1fr);border-top:1px solid var(--line);background:var(--bg);font-family:var(--sans)}
.fs-sess,.fs-canvas{min-width:0}

/* ── the session: a person's log, not a machine's ─────────────────────────── */
.fs-sess{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--line);background:var(--bg)}
.fs-head{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--line)}
.fs-head b{flex:1;min-width:0;font-size:var(--fs-md);font-weight:650;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fs-chip{font:600 var(--fs-xs)/1 var(--sans);color:var(--ag-deep);background:var(--ag-soft);border-radius:var(--r-pill);padding:4px 9px;white-space:nowrap}
.fs-sp{flex:1}
.fs-btn{height:32px;padding:0 12px;border-radius:var(--r-pill);border:1px solid var(--line2);background:var(--bg);color:var(--ink);font:500 var(--fs-sm) var(--sans);white-space:nowrap;cursor:pointer}
.fs-btn:hover{background:var(--side2)}.fs-btn.on{background:var(--link);border-color:var(--link);color:var(--on-link)}
.fs-btn.go{background:var(--ag);border-color:var(--ag);color:#fff;font-weight:650}.fs-btn.go:hover{background:var(--ag-deep);border-color:var(--ag-deep)}
.fs-btn:disabled{opacity:.5;cursor:default}

.fs-log{flex:1;min-height:0;overflow:auto;padding:16px 14px 22px;display:flex;flex-direction:column;gap:16px;font:var(--fs-md)/1.55 var(--sans)}

/* one turn = one ask and the work it set off */
.fs-turn{display:flex;flex-direction:column;gap:10px}
.fs-ask{align-self:flex-end;max-width:92%;background:var(--ag-soft);color:var(--ink);border-radius:var(--r-lg);padding:8px 12px;font-size:var(--fs-md);font-weight:550;overflow-wrap:anywhere;text-align:right}
.fs-steps{display:flex;flex-direction:column;margin-left:5px;border-left:2px solid var(--line)}

/* one step: a status dot on the spine, a plain verb, a plain line */
.fs-row{position:relative;display:flex;gap:10px;align-items:flex-start;padding:7px 0 7px 18px}
.fs-row::before{content:"";position:absolute;left:-6px;top:11px;width:10px;height:10px;border-radius:50%;background:var(--line2);box-shadow:0 0 0 3px var(--bg)}
.fs-row.ok::before{background:var(--ok)}
.fs-row.bad::before{background:var(--bad)}
.fs-row.run::before{background:var(--ag);box-shadow:0 0 0 3px var(--bg),0 0 0 6px color-mix(in srgb,var(--ag) 22%,transparent);animation:fspulse 1.3s ease-in-out infinite}
@keyframes fspulse{50%{opacity:.4}}
.fs-row-body{min-width:0;flex:1;display:flex;flex-direction:column;gap:3px}
.fs-line{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.fs-glyph{--g:var(--ag-deep);font:700 var(--fs-sm)/1 var(--mono);color:var(--g);width:1.5em;height:1.5em;flex:none;display:inline-flex;align-items:center;justify-content:center;position:relative;border-radius:50%}
.fs-row.bad .fs-glyph{--g:var(--bad)}
.fs-row.info .fs-glyph{--g:var(--mut)}
.fs-glyph.g-ground::after{content:"";position:absolute;left:.22em;right:.22em;bottom:0;height:2px;border-radius:1px;background:var(--g)}
.fs-glyph.g-figure{border:1.5px solid var(--g)}
.fs-glyph.g-pattern{background:var(--g);color:var(--bg)}
.fs-verb{font-weight:650;color:var(--ink);font-size:var(--fs-sm)}
.fs-who{font:600 var(--fs-2xs)/1.2 var(--sans);color:var(--mut);text-transform:uppercase;letter-spacing:.05em}
.fs-text{color:var(--ink2);font-size:var(--fs-sm);overflow-wrap:anywhere}
.fs-why{color:var(--mut);font-size:var(--fs-xs);overflow-wrap:anywhere}
.fs-note{color:var(--mut);font-size:var(--fs-xs)}
.fs-err{color:var(--bad);font-size:var(--fs-sm)}
.fs-more{border:0;background:none;color:var(--link);padding:0;font:500 var(--fs-xs) var(--sans);cursor:pointer;align-self:flex-start}
.fs-more::before{content:"▸ "}
.fs-row.open .fs-more::before{content:"▾ "}
.fs-detail{display:none;font:var(--fs-xs)/1.5 var(--mono);color:var(--mut);background:var(--side2);border-radius:var(--r-sm);padding:8px 10px;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:4px}
.fs-row.open .fs-detail{display:block}
.fs-tech{color:var(--mut)}
.fs-units{display:flex;flex-direction:column;gap:3px;margin-top:6px}
.fs-u{display:grid;grid-template-columns:minmax(70px,auto) minmax(0,1fr) auto;gap:6px;align-items:baseline;font-size:var(--fs-xs)}
.fs-u .k{color:var(--mut)}.fs-u .v{color:var(--ink);overflow-wrap:anywhere}.fs-u .s{grid-column:2/4;color:var(--bad)}
.fs-undo{border:1px solid var(--line2);background:var(--bg);border-radius:var(--r-pill);font:var(--fs-xs) var(--sans);padding:2px 9px;cursor:pointer;color:var(--ink2)}
.fs-undo:hover{border-color:var(--link);color:var(--link)}
.fs-sel{font:var(--fs-xs)/1.4 var(--sans);color:var(--link);background:color-mix(in srgb,var(--link) 10%,var(--bg));border-radius:var(--r-pill);padding:3px 9px}

/* THE REASONING ITSELF — shown as it happens, kept open when it lands. */
.fs-thinkblock{border-left:2px solid var(--line2);margin:2px 0 2px 18px;padding:4px 0 4px 10px}
.fs-thinkblock.streaming{border-color:var(--ag);background:color-mix(in srgb,var(--ag) 5%,transparent)}
.fs-thinkblock .fs-think-h{display:flex;align-items:center;gap:7px;font:600 var(--fs-2xs)/1.3 var(--sans);color:var(--mut);text-transform:uppercase;letter-spacing:.05em;cursor:pointer}
.fs-thinkblock .fs-think-h:hover{color:var(--ink)}
.fs-thinkblock .fs-think-t{font:var(--fs-sm)/1.6 var(--sans);color:var(--ink2);white-space:pre-wrap;overflow-wrap:anywhere;margin-top:4px;font-style:italic}
.fs-thinkblock.collapsed .fs-think-t{display:none}
.fs-thinkblock.streaming .fs-think-t::after{content:"▍";color:var(--ag);animation:fspulse 1s steps(1) infinite;font-style:normal}
.fs-time{font:600 var(--fs-2xs)/1.2 var(--mono);color:var(--mut);margin-left:auto;white-space:nowrap}
.fs-row.streaming .fs-time{color:var(--ag-deep)}
.fs-spin{display:inline-block;width:11px;height:11px;border-radius:50%;border:2px solid color-mix(in srgb,var(--ag) 28%,transparent);border-top-color:var(--ag);animation:fsspin .8s linear infinite;flex:none}
@keyframes fsspin{to{transform:rotate(360deg)}}
.fs-mark{font:700 var(--fs-2xs)/1 var(--sans);width:1.5em;height:1.5em;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;flex:none}
.fs-mark.ok{color:var(--ok);background:var(--ok-soft)}
.fs-mark.warn{color:var(--warn);background:color-mix(in srgb,var(--warn) 14%,var(--bg))}
.fs-mark.bad{color:var(--bad);background:color-mix(in srgb,var(--bad) 14%,var(--bg))}

/* trust — made visible, not buried */
.fs-sources{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.fs-source{display:inline-flex;align-items:center;font:500 var(--fs-xs)/1 var(--sans);color:var(--ink2);background:var(--bg);border:1px solid var(--line);border-radius:var(--r-pill);padding:4px 10px;text-decoration:none;max-width:100%}
.fs-source:hover{border-color:var(--link);color:var(--link)}
.fs-badge{display:inline-flex;align-items:center;gap:5px;font:600 var(--fs-xs)/1 var(--sans);border-radius:var(--r-pill);padding:4px 10px;white-space:nowrap}
.fs-badge.ok{color:var(--ok);background:var(--ok-soft)}
.fs-badge.warn{color:var(--warn);background:color-mix(in srgb,var(--warn) 13%,var(--bg))}
.fs-badge.bad{color:var(--bad);background:color-mix(in srgb,var(--bad) 13%,var(--bg))}
.fs-badge.mut{color:var(--mut);background:var(--side2)}
.fs-badge.run{color:var(--ag);background:var(--ag-soft)}
.fs-caveat{padding:7px 14px;background:var(--bg);border-bottom:1px solid var(--line);color:var(--warn);font-size:var(--fs-xs);overflow-wrap:anywhere}

/* composer */
.fs-comp{border-top:1px solid var(--line);padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:var(--bg)}
.fs-comp textarea{border:1.5px solid var(--line2);border-radius:var(--r-lg);padding:10px 12px;font:var(--fs-md)/1.5 var(--sans);resize:none;background:var(--bg);color:var(--ink);min-height:52px}
.fs-comp textarea:focus{outline:none;border-color:var(--ag)}
.fs-comp .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.fs-comp .inrow{display:flex;gap:8px;align-items:flex-end}.fs-comp .inrow textarea{flex:1;min-width:0}

/* canvas */
.fs-canvas{display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--side2)}
.fs-trust{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:10px 14px;background:var(--bg);border-bottom:1px solid var(--line)}
.fs-cbar{display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg);border-bottom:1px solid var(--line);flex-wrap:wrap}
.fs-frame{flex:1;min-height:0;padding:12px;display:flex}.fs-frame iframe{flex:1;border:0;border-radius:var(--r-md);background:#fff;box-shadow:var(--shadow)}
.fs-eot{flex:1;min-height:0;overflow:auto;margin:12px;background:var(--bg);border-radius:var(--r-md);padding:14px;font:var(--fs-xs)/1.6 var(--mono);white-space:pre-wrap;color:var(--ink)}
.fs-empty{margin:auto;max-width:400px;text-align:center;color:var(--mut);font-size:var(--fs-md);line-height:1.6;padding:24px}
.fs-empty b{color:var(--ink);font-weight:650;font-size:var(--fs-base)}
.fs-starters{display:flex;flex-direction:column;gap:6px;margin-top:16px;text-align:left}
.fs-starter{border:1px solid var(--line);background:var(--bg);border-radius:var(--r-md);padding:9px 12px;font:var(--fs-sm) var(--sans);color:var(--ink2);cursor:pointer;text-align:left}
.fs-starter:hover{border-color:var(--ag);color:var(--ink)}

/* the editor */
.fs-ed{border-top:1px solid var(--line);padding:12px 14px;display:flex;flex-direction:column;gap:8px;max-height:46%;overflow:auto;background:var(--bg);font-family:var(--sans)}
.fs-ed label{display:flex;flex-direction:column;gap:3px;font-size:var(--fs-xs);font-weight:600;color:var(--ink2)}
.fs-ed input,.fs-ed select,.fs-ed textarea{font:var(--fs-sm) var(--sans);border:1px solid var(--field-line);border-radius:var(--r-sm);padding:7px 9px;background:var(--bg);color:var(--ink)}

/* the folds list, in the sidebar */
.fd-item{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;text-align:left;padding:7px 10px;border-radius:var(--r-md);font-size:var(--fs-md);color:var(--ink2)}
.fd-item:hover,.fd-item.on{background:var(--side2);color:var(--ink)}.fd-item .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fd-item .k{font:var(--fs-2xs)/1 var(--sans);color:var(--ag-deep)}
@media (max-width:1180px){.foldspace{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr)}.fs-sess{border-right:0}.foldspace[data-view="session"] .fs-canvas{display:none}.foldspace[data-view="canvas"] .fs-sess{display:none}.fs-vt{display:inline-flex!important}}
.fs-vt{display:none}`;

const CODE_CSS = `
.fs-code{display:grid;grid-template-columns:minmax(140px,220px) minmax(0,1fr);height:100%;min-height:0}
.fs-by{font:700 10.5px/1.2 var(--mono);color:#fff;border-radius:4px;padding:2px 5px;white-space:nowrap;display:inline-block}
.fs-by.model,.fs-by.mouth{background:var(--ag)}.fs-by.app,.fs-by.box{background:#5f5f6b}.fs-by.you{background:var(--link)}.fs-by.library{background:#7c3aed}.fs-by.hunt{background:#a16207}.fs-by.gap,.fs-by.wall{background:var(--bad)}
.fs-tree{overflow:auto;border-right:1px solid var(--line);padding:6px;display:flex;flex-direction:column;gap:1px}
.fs-tbtn{text-align:left;font:var(--fs-xs)/1.4 var(--mono);color:var(--ink2);background:none;border:0;border-radius:var(--r-sm);padding:4px 7px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fs-tbtn:hover{background:var(--side2)}.fs-tbtn.on{background:var(--side2);color:var(--ink);font-weight:600}
.fs-cview{display:flex;flex-direction:column;min-width:0;min-height:0}
.fs-ch{display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--line);font:600 var(--fs-sm) var(--mono);color:var(--ink2)}
.fs-file{flex:1;overflow:auto;margin:0;padding:12px;font:var(--fs-sm)/1.5 var(--mono);white-space:pre;color:var(--ink)}
.fs-chg{padding:8px 10px;border-bottom:1px solid var(--line)}
.fs-chg-h{display:flex;gap:8px;align-items:center;font:var(--fs-xs) var(--mono);color:var(--mut);margin-bottom:4px}
.fs-diff{margin:0;padding:8px;background:var(--side2);border-radius:var(--r-sm);font:var(--fs-xs)/1.45 var(--mono);white-space:pre;overflow:auto}
.fs-think{padding:6px 10px;margin:2px 0 2px 10px;border-left:2px solid var(--line2);color:var(--ink2);font:var(--fs-sm)/1.5 var(--sans)}
.fs-think-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.fs-think-h .fs-sp{flex:none}
.fs-think-label{flex:1;min-width:0;color:var(--ink);font-weight:600}
.fs-think .t{color:var(--ink)}
.fs-think .w{color:var(--mut);font:var(--fs-xs)/1.45 var(--mono);margin-top:2px}
.fs-think.bad{border-left-color:var(--bad)}
.fs-think.bad .t{color:var(--bad)}
.fs-think.streaming{border-left-color:var(--acc-deep)}
.fs-op{display:inline-block;width:1.1em;text-align:center;color:var(--acc-deep);font-weight:700}
.fs-think .lbl{color:var(--mut);font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.06em}
.fs-st{margin-top:4px;white-space:pre-wrap;font:var(--fs-xs)/1.5 var(--mono);color:var(--mut);max-height:220px;overflow:auto;background:color-mix(in srgb,var(--ink) 4%,transparent);border-radius:var(--r-sm);padding:6px 8px}
.fs-think.streaming .fs-st::after{content:"▮";color:var(--acc-deep);animation:fsblink 1s steps(1) infinite;margin-left:1px}
@keyframes fsblink{50%{opacity:0}}
`;

export function mountFolds({ main, list, newBtn = null, railBtn = null, getModelId, toast = () => {}, onOpen = () => {}, onClose = () => {}, research = null }) {
  if (!document.getElementById("fold-folds-style")) { const st = document.createElement("style"); st.id = "fold-folds-style"; st.textContent = CSS + CODE_CSS; document.head.append(st); }
  let folds = []; try { folds = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { folds = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(folds.map((f) => ({ ...f, log: f.log.slice(-400) })))); } catch {} };
  const memory = createMemory();
  const queue = [];
  let cur = null, kernel = null, running = null, live = null, sel = null, editMode = false, tab = "preview", ed = null, edErr = [];
  let rungNow = RUNGS[0]; // the rung the pipeline is standing on — each act lands on its cube cell
  // THE LIVE CLOCK: the working row's elapsed time, ticked by one cheap interval
  // while a turn is running, never re-rendered (paint already repaints enough).
  let liveStart = 0;
  const secs = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? s + "s" : (Math.round(s / 60)) + "m"; };
  const setLive = (label, units = []) => { live = { label, units }; liveStart = Date.now(); };
  if (typeof setInterval === "function") setInterval(() => {
    if (!running || space.hidden) return;
    const now = Date.now();
    space.querySelectorAll(".fs-time").forEach((el) => { const t0 = Number(el.dataset.t0 || 0); if (t0) el.textContent = secs(now - t0); });
  }, 1000);
  const space = document.createElement("section"); space.className = "foldspace"; space.hidden = true; space.setAttribute("aria-label", "Fold");
  main.append(space);

  function rebuild(f) { const k = createKernel(); for (const e of f.log) if (e.ok && e.text && e.kind === "assembly") k.submit(e.text, { by: e.by, label: e.label }); return k; }
  function renderList() {
    if (!list) return;
    list.innerHTML = folds.length ? "" : `<div class="fs-note" style="padding:6px 10px;font-size:var(--fs-sm)">No folds yet</div>`;
    for (const f of [...folds].sort((a, b) => b.updated - a.updated)) {
      const b = document.createElement("button"); b.type = "button"; b.className = "fd-item" + (cur && cur.id === f.id && !space.hidden ? " on" : "");
      b.innerHTML = `<span class="t">${esc(f.title)}</span>${f.kind ? `<span class="k">${esc(KIND_WORD[f.kind] || f.kind)}</span>` : ""}<span class="k">${ago(f.updated)}</span>`;
      b.onclick = () => open(f.id); list.append(b);
    }
  }
  function complete(signal0) {
    const model = getModelId?.();
    return async (messages, { maxTokens, signal, onToken, stop } = {}) => {
      if (!model) throw new Error("no model is available to draw with");
      const sys = messages.filter((x) => x.role === "system").map((x) => x.content).join("\n\n"), rest = messages.filter((x) => x.role !== "system");
      const msgs = sys && rest.length ? [{ ...rest[0], content: sys + "\n\n" + rest[0].content }, ...rest.slice(1)] : rest;
      const cut = new AbortController(); let acc = "", ended = false; const sig = signal || signal0; const fwd = () => cut.abort(); sig?.addEventListener("abort", fwd, { once: true });
      try {
        const r = await client.chat(model, msgs, { maxTokens, signal: cut.signal, temperature: 0.2, totalTimeoutMs: 300000,
          onToken: (t) => { acc += t; onToken?.(t); if (!ended && (stop === "line" ? /\S[^\n]*\n/.test(acc.replace(/^\s*```[^\n]*\n/, "")) : /(^|\n)\s*!EVA[^\n]*\n/i.test(acc))) { ended = true; cut.abort(); } } });
        return r.text;
      } catch (e) { if (ended) return acc; throw e; } finally { sig?.removeEventListener("abort", fwd); }
    };
  }
  const push = (e) => { const c = e.cell || (e.op ? cellOf(e.op, rungNow) : null); const entry = { at: Date.now(), ...e }; if (c && !c.gap) entry.cell = c; cur.log.push(entry); cur.updated = Date.now(); save(); };
  // STREAMING: the model's thinking, LIVE — a streaming entry grows as tokens
  // arrive (throttled repaint), then stays on the record as what it thought.
  let streamTimer = null;
  const streamInto = (label, op) => {
    const c = cellOf(op || "SIG", rungNow);
    cur.log.push({ at: Date.now(), kind: "think", by: "fold", op: op || "SIG", label, text: "", streaming: true, ...(c && !c.gap ? { cell: c } : {}) });
    const idx = cur.log.length - 1;
    liveStart = Date.now();
    paint();
    return (t) => { cur.log[idx].text += String(t ?? ""); if (!streamTimer) streamTimer = setTimeout(() => { streamTimer = null; paint(); }, 120); };
  };
  const endStream = () => { const e = cur.log[cur.log.length - 1]; if (e && e.streaming) { e.streaming = false; paint(); } };

  function stripFence(s) { const m = String(s || "").match(/```[a-zA-Z]*\n([\s\S]*?)```/); return (m ? m[1] : String(s || "")).trim(); }
  // A BEHAVIOUR (a timer, a game, an animation) is not a value the block kit can
  // compute — the fold writes it as ONE self-contained page (SYN), RUNS it and
  // OBSERVES what it does (EVA), records the finding (REC), and re-opens (NUL)
  // with the finding as the atom until it holds. The loop is the agent.
  async function buildApp(text, draw, signal, finding = null, prior = null, onToken = null, material = null, outline = null) {
    // FITS THE WINDOW (Gary's law): the prompt is bounded so a small model's window
    // is never blown by material + plan + prior, which is how a make came back
    // empty ("the model returned no page") without the mouth ever being wrong.
    const fix = finding ? `\n\nYour previous page FAILED when it was run: ${finding}. Write a version without that failure.` : "";
    const base = prior ? `\n\nHere is the current page. Change it as asked and keep everything else working:\n\`\`\`html\n${String(prior).slice(0, 3000)}\n\`\`\`` : "";
    const plan = outline ? `\n\nA plan for the page (follow it):\n${String(outline).slice(0, 900)}` : "";
    const src = material && material.length ? `\n\nUse these REAL sources for the content; do not invent facts, and put each source's url on the page (a link or a small credit):\n${material.slice(0, 4).map((m, i) => `[${i + 1}] ${m.source} — ${m.url}\n${String(m.text || "").slice(0, 500)}`).join("\n\n")}` : "";
    // A page is HTML if it CARRIES markup — not only the few tags the old test named.
    const isHtml = (s) => /<\s*(!doctype|html|head|body|div|button|script|style|canvas|svg|input|main|section|article|header|footer|nav|h1|h2|h3|p|ul|ol|li|table|form)/i.test(s) || /^\s*<!doctype/i.test(s);
    const sys = "You write ONE complete, self-contained HTML document that actually works when opened in a browser. Inline CSS and JavaScript only; no external files; no prose. Use only facts from the sources you are given, when sources are given.";
    let out = null;
    try { out = await draw([
      { role: "system", content: sys },
      { role: "user", content: `Build this, as one working page: ${text}\n\nOutput only the HTML document, inside a single fenced code block.${plan}${src}${base}${fix}` },
    ], { maxTokens: 2200, signal, onToken }); } catch { out = null; }
    let html = stripFence(out);
    // FRESH FROM THE SPEC (lesson #25/#4), never handed its own failure: a busy
    // prompt that came back without a page is re-asked as ONE small, clean ask.
    if (!isHtml(html)) {
      onToken?.("\n◉ re-asking fresh, smaller\n");
      try { out = await draw([
        { role: "system", content: "You write ONE complete, self-contained HTML document. Inline CSS and JavaScript only. Output only the HTML." },
        { role: "user", content: `Write a complete, working HTML page for: ${text}\n\nOutput only the HTML document, inside one fenced code block.` },
      ], { maxTokens: 1800, signal, onToken }); } catch { out = null; }
      html = stripFence(out);
    }
    return isHtml(html) ? html : null;
  }
  // EVA by observation: run the page in a hidden sandboxed frame and SEE what it
  // does — errors on its own surface, whether it rendered, and whether anything
  // changed over time (a behaviour is only real if it moves).
  function observePage(html, { ms = 1200, timeout = 7000 } = {}) {
    return new Promise((resolve) => {
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;height:600px;border:0";
      const inject = `<script>(function(){var e=[];window.onerror=function(m){e.push(String(m));};function snap(){try{return String((document.body&&document.body.innerText)||"");}catch(x){return "";}}function labs(){try{var q=document.querySelectorAll('button,a,[role=button],option,label');return Array.prototype.map.call(q,function(el){return (el.textContent||"").trim();}).slice(0,80);}catch(x){return [];}}window.addEventListener("load",function(){var a=snap();setTimeout(function(){try{parent.postMessage({__observe:1,err:e,t0:a,t1:snap(),nodes:document.getElementsByTagName("*").length,tags:(document.body&&document.body.innerHTML||"").length,labels:labs()},"*");}catch(x){}},${ms});});setTimeout(function(){try{parent.postMessage({__observe:1,err:e,t0:snap(),t1:snap(),nodes:document.getElementsByTagName("*").length,labels:labs()},"*");}catch(x){}},${ms + 800});})();<\/script>`;
      const srcdoc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + inject) : /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, (m) => m + inject) : inject + html;
      const done = (d) => { window.removeEventListener("message", onMsg); clearTimeout(to); try { frame.remove(); } catch { /* gone */ } resolve(d); };
      const onMsg = (ev) => { if (ev.source !== frame.contentWindow) return; const d = ev.data || {}; if (d.__observe) done(d); };
      window.addEventListener("message", onMsg);
      const to = setTimeout(() => done({ err: ["observation timed out"], t0: "", t1: "", nodes: 0, labels: [] }), timeout);
      frame.srcdoc = srcdoc; document.body.appendChild(frame);
    });
  }

  // READ THE ASK — the fold's real thinking, not a lookup. The model is asked to
  // say what the ask IS (action, object, deliverable, what it needs, what a thing
  // that satisfies it would do), as facts it can reason from. The app then routes
  // by that reading. Nothing here is a canned template.
  async function readAsk(ask, draw, signal, onToken, prev = null) {
    const ctx = prev ? `You already built this. The ask is a CHANGE to it.\n\nWhat exists now — title "${prev.title}":\n\`\`\`html\n${String(prev.html || "").slice(0, 1600)}\n\`\`\`\n\n` : "";
    const out = await draw([
      { role: "system", content: "You read an ask and think out loud about what it is and what it should become. Think briefly, like a person sizing up the job before starting. There is no menu of categories — induce the kind from the ask itself." },
      { role: "user", content: `${ctx}The ask: "${ask}"\n\nThink out loud in a few short lines, then end with exactly these labelled lines:\nWHAT: <what this ask is — the kind of thing it wants, induced from the ask, not chosen from a list>\nSATISFY: <one sentence: what a thing that satisfies this ask would actually DO>\nNEEDS: <what it needs that a self-contained page could not invent itself — inputs, or a live data source, or time to run, or nothing>` },
    ], { maxTokens: 400, signal, onToken });
    const grab = (k) => { const m = new RegExp(`^\\s*${k}\\s*:\\s*(.+)$`, "im").exec(out); return m ? m[1].trim().replace(/^["']|["']$/g, "") : null; };
    const r = { what: grab("WHAT"), satisfy: grab("SATISFY"), needs: grab("NEEDS") };
    return (r.what || r.satisfy) ? r : null;
  }

  // READ THE REQUIREMENTS — the ask FOLDED, not comprehended. The ask is cut into
  // bounded spans; each span is read LOCALLY (the model never sees the whole ask,
  // so an arbitrarily long ask still works); an atom is kept only if it is
  // verbatim in its own span (fold-chat-require.js). The join that grades the
  // product is mechanical. One model call per span, bounded width.
  async function readAtoms(ask, draw, signal) {
    const spans = askSpans(ask);
    const atoms = [];
    for (const span of spans) {
      let out = "";
      try {
        out = await draw([
          { role: "system", content: "You list what a piece of an ask requires the finished page to SHOW — only exact words, labels or numbers that appear in the text you are given. One per line. If it requires nothing showable, reply NONE." },
          { role: "user", content: `Text:\n${span.text}\n\nList each exact label, word or number the finished page must show, one per line, copied from the text above.` },
        ], { maxTokens: 150, signal });
      } catch { out = ""; }
      atoms.push(...atomsFrom(out, span));
    }
    return { spans, atoms };
  }

  /** The page's PROSE: strip script/style/comments/tags, decode the basics. */
  function pageText(htmlValue) {
    return String(htmlValue || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ").trim();
  }
  /** Falsify the page's claims against what was read — the app's own organ. Returns
   *  the failing claims (unsupported / contested / weak); null when there is no material. */
  function gatePage(htmlValue, material) {
    if (!material || !material.length) return null;
    const sentences = claimSentences(pageText(htmlValue)).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 5).slice(0, 40);
    if (!sentences.length) return null;
    let r; try { r = falsifyAnswer(sentences, material); } catch { return null; }
    return { summary: r.summary, failed: r.claims.filter((c) => FAILING.has(c.verdict)) };
  }
  /** THE STITCH (the weave experiment): decompose the outline into units, fill
   *  each from the FIELD (the passages that were read) by snip+address, ask the
   *  MOUTH only for the residue, gate every byte, and project the page from the
   *  log. Returns the build ({ artifact, verdict, log }) or null. */
  async function tryStitch(text, material, outline, draw, ac, atoms = []) {
    const units = unitsFromOutline(outline, { max: 8 });
    if (!units.length) return null;
    const model = getModelId?.();
    return createBuild({
      units,
      field: (u) => assetFor(u, material) || snipFor(u, material),
      gate: (u, code) => grounded(u, code, material),
      draw: async (u) => {
        const out = await draw([
          { role: "system", content: "You write ONE short HTML fragment for ONE piece of a page — no <html> shell, no prose, no markdown. Use only the facts you are given." },
          { role: "user", content: `The piece: ${u.name}\nWhat it is: ${u.spec || "(unspecified)"}\nFacts you may use (only these):\n${material.map((m) => `- ${String(m.text).slice(0, 300)}`).join("\n")}` },
        ], { maxTokens: 400, signal: ac.signal });
        return { code: stripFence(out), model };
      },
      assemble: (joined, order, us) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{font:16px/1.6 system-ui,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;color:#17171a}h2{margin:1.4em 0 .4em}section{margin:0 0 1em}</style></head><body>${us.map((u) => u.code).join("\n")}</body></html>`,
      test: async (code) => {
        const obs = await observePage(code);
        if (obs.err && obs.err.length) return { ok: false, reason: `the page threw: ${obs.err[0]}` };
        if (obs.nodes < 4) return { ok: false, reason: "the page rendered nothing" };
        // THE JOIN: the render is one side, the ask's atoms the other — mechanical.
        const missing = missingAtoms(atoms, { labels: obs.labels, text: obs.t0 });
        if (missing.length) return { ok: false, reason: `the page does not show ${atomLine(missing)} — the ask names them` };
        return { ok: true, reason: `ran · ${obs.nodes} nodes · every required item shown` };
      },
    });
  }
  /** Climb the cube: grain = the ask's own words; terrain = the ask in its want;
   *  domain = the kind of thing it is, broadly. Returns the refined SEARCH subject. */
  function refineSubject(text, want, rung) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (rung === "terrain") { const w = want && (want.satisfy || want.what); return `${t}${w ? " — " + String(w).slice(0, 120) : ""}`; }
    if (rung === "domain") return `${t} reference example`;
    return t;
  }
  // THE PIPELINE — one turn, the whole movement, streamed, operator-tagged:
  //   (1) what does the person want?      DEF — read the ask (induced)
  //   (2) go find examples                SIG — web: engines → readers → passages
  //   (3) does that change the want?      DEF — re-read against the material
  //   (4) outline what we'd need          SEG — the pieces, from the material
  //   (5) inventory the pieces we have    CON — sources / codebase / model; name lacks
  //   (6) weave it together               SYN → EVA(observe) → REC → NUL (recursion)
  async function runPipeline(text, ac) {
    const draw = complete(ac.signal);
    const slice = (s) => String(s ?? "");
    const prev = (cur.artifact && cur.artifact.kind === "app") ? { title: cur.title, html: cur.artifact.html } : null;
    const prior = (cur.artifact && cur.artifact.kind === "app") ? cur.artifact.html : null;
    const behaviour = /\b(countdown|timer|stopwatch|clock|animation|game|carousel|slideshow|chart|plot|canvas)\b/i.test(text);
    const overlapFrac = (a, b) => { const A = new Set(contentWords(a || "")), B = new Set(contentWords(b || "")); if (!A.size || !B.size) return 1; let n = 0; for (const w of A) if (B.has(w)) n += 1; return n / A.size; };
    // THE GATE, WOVEN IN — before any draw. The chat's own judgment (the
    // constitution's router, vendor/fold/reasoning-stages.mjs `route`): what kind
    // of turn is this, and who may speak? A turn that cannot be stated is a wall;
    // `refuse` stops here, before the mouth is ever asked.
    const lane = gateTurn({ text, build: isMakeAsk(text) || !!cur.codebase, hasMaterial: false, satisfiable: true });
    push({ kind: "think", by: "app", op: "NUL", say: `This is ${LANE_WORD[lane.lane] || lane.lane} — ${lane.why}` });
    setLive("checking what this turn is");
    paint();
    if (lane.lane === "refuse") { push({ kind: "note", by: "app", op: "REC", text: "", ok: false, errors: [{ code: "refused", msg: lane.why }] }); return; }
    // KNOW WHEN TO QUIT: a fold MAKES. A question reaches here by mistake (a
    // make-verb, a codebase, or an existing artifact is what earns a build), so
    // the fold stops before it searches or draws — no page for "who is the
    // president?". One act, zero draws, and it is done.
    const wantsBuild = /\b(make|build|create|design|draft|write|generate|spin up|set up|mock up|prototype|implement|turn .* into|add|change|edit|redo)\b/i.test(text) || isMakeAsk(text) || !!cur.codebase || !!(cur.artifact && (cur.artifact.html || cur.artifact.doc));
    if (!wantsBuild) {
      push({ kind: "think", by: "app", op: "REC", say: `“${text.replace(/\s+/g, " ").trim().slice(0, 70)}” is a question, not a thing to make — I only build things here. Ask it in Chat instead.` });
      paint();
      return;
    }
    // THE SPIRAL — the six stages, taken on a rung of the cube, RECURSIVE. A
    // contradiction at (3) or a lack at (5) re-opens an earlier rung INSIDE one
    // pass (grain → terrain → domain); a weave that does not hold re-opens the
    // WHOLE turn (runSpiral) with its finding as the new atom. FUEL_TURN is the
    // FLOOR; the DMD gate of the turn's trajectory is the STOP (below).
    const FUEL_TURN = 6;
    let visitedRungs = [], lastMaterial = null, held = false;
    // THE OUTSIDE SIGNALS (across the whole turn): the ask folded into addressable
    // requirement atoms, the ground already read, a memo so the same subject is
    // searched once, and the progress guard that stops a turn returning to itself.
    const ground = new Set();
    const searchMemo = new Map();
    const progress = createProgressGuard();
    // THE ASK, FOLDED (one bounded local read per span — the model never holds the
    // whole ask). `required` is the join's ask-side; `unread` is the fold's own
    // named ignorance, said once.
    const folded = await readAtoms(text, draw, ac.signal);
    const required = folded.atoms;
    for (const span of unreadSpans(folded.spans, required)) {
      push({ kind: "think", by: "app", op: "DEF", text: `no requirement read from “${span.text.trim().slice(0, 60)}” — that part of the ask is unchecked (a named gap).`, ok: true });
    }
    if (required.length) push({ kind: "think", by: "app", op: "DEF", text: `the ask requires: ${atomLine(required)}`, ok: true });
    paint();
    // ONE PASS: (1) read the want → (2) hunt examples → (3) re-read → (4) outline
    // → (5) inventory → (6) weave. Returns { held, finding, refused }.
    async function onePass(atom) {
    let depth = 0, subject = text, reading = null, want = null, material = null, outline = "", need = null, novel = [];
    visitedRungs = [];
    for (;;) {
      rungNow = RUNGS[depth];
      visitedRungs.push(RUNGS[depth]);
      // (1) WHAT DOES THE PERSON WANT?  (re-read on a climb)
      let r1 = null;
      const itok = streamInto(depth === 0 ? "reading what you're asking for" : `reading it again through what I found`, "DEF");
      try { r1 = await readAsk(text, draw, ac.signal, itok, prev); } catch { r1 = null; }
      endStream();
      if (r1 && (r1.what || r1.satisfy)) reading = r1;
      if (!reading) setLive("reading what you're asking for");
      const mono = monologue(text, reading);
      for (const l of mono.lines) push({ kind: "think", by: "fold", op: "DEF", say: l.say, why: l.why, ok: !l.bad });
      paint();
      if (!mono.satisfiable) { push({ kind: "note", by: "app", op: "REC", text: "", ok: false, errors: [{ code: "cannot satisfy", msg: mono.why }] }); return { refused: true }; }
      // (2) GO FIND EXAMPLES — on the current rung's subject. A subject already
      // searched this turn is NOT fetched again (the memo): the same ground
      // cannot be new, so a repeat is not progress.
      material = null;
      novel = [];
      if (typeof research === "function") {
        if (searchMemo.has(subject)) {
          material = searchMemo.get(subject);
          push({ kind: "think", by: "app", op: "SIG", text: material && material.length ? `same ground as before: ${material.map((m) => m.source).join(", ")} — no new source` : "the same search came back empty — no new ground", ok: false });
          paint();
        } else {
          const htok = streamInto("going out to find how others built it", "SIG");
          setLive("looking for how others built it");
          try {
            const w = await research(subject, { onStep: (s) => { if (s.phase === "searching") htok(`\nsearch ${s.scope}: ${s.q}`); else if (s.phase === "found") htok(`\n${s.engine} · ${s.n} result(s)`); else if (/snippet|reading|read/.test(s.phase)) htok(`\nread ${s.url || s.site || ""}`); } });
            material = ((w && w.passages) || []).map((p) => ({ source: p.source || p.ref || p.domain || p.url, url: p.url, text: p.text || p.snippet || "", images: p.images || p.image || null })).filter((m) => m.text).slice(0, 6);
            material.sort((a, b) => pheromone("src:" + domainKey(b)) - pheromone("src:" + domainKey(a))); // follow the trail: ground that held before leads
          } catch { material = null; }
          endStream();
          searchMemo.set(subject, material);
          const ng = novelGround(material, ground);
          novel = ng.novel;
          for (const k of ng.keys) ground.add(k);
          push({ kind: "think", by: "app", op: "SIG", text: material && material.length ? `kept ${material.length} usable source(s): ${material.map((m) => m.source).join(", ")}` : "nothing usable out there — I'll build from what I know", ok: true, ...(material && material.length ? { sources: material.map((m) => ({ title: m.source, url: m.url })) } : {}) });
          paint();
        }
      }
      // (3) DOES THIS CHANGE WHAT THEY WANT?
      want = reading; let contradiction = null;
      if (material && material.length) {
        const rtok = streamInto("checking whether this changes the build", "DEF");
        setLive("checking whether the sources change it");
        let reread = null;
        try { reread = await readAsk(text, draw, ac.signal, rtok, null, material); } catch { reread = null; }
        endStream();
        if (reread && (reread.what || reread.satisfy)) {
          want = reread;
          push({ kind: "think", by: "fold", op: "DEF", text: `rereading it against the sources: ${reread.what || reread.satisfy}` });
          if (reading && reading.what && reread.what && overlapFrac(reading.what, reread.what) < 0.34) contradiction = reread.what;
        }
      }
      // (4) OUTLINE WHAT WE'D NEED
      const otok = streamInto("sketching the shape it needs", "SEG");
      setLive("sketching the shape it needs");
      outline = "";
      try {
        outline = await draw([
          { role: "system", content: "You plan a single self-contained web page. Be concrete and short; no preamble." },
          { role: "user", content: `The ask: ${text}\n${want && want.satisfy ? `It is satisfied when: ${want.satisfy}\n` : ""}${material && material.length ? `Real sources:\n${material.map((m, i) => `[${i + 1}] ${m.source} — ${slice(m.text).slice(0, 140)}`).join("\n")}\n` : ""}\nList the pieces the page needs, one per line — its sections and the facts to show (use the sources). Then one line: NEEDS: <what you lack, or "nothing">.` },
        ], { maxTokens: 400, signal: ac.signal, onToken: otok });
      } catch { /* no outline */ }
      endStream();
      // (5) INVENTORY THE PIECES
      const haveL = [], lackL = [];
      if (material && material.length) haveL.push(`${material.length} source(s)`); else lackL.push("sources");
      if (cur.codebase) haveL.push("a codebase");
      haveL.push("the in-tab model");
      const needsLine = /^\s*NEEDS:\s*(.+)$/im.exec(outline || "");
      need = needsLine && !/^\s*nothing\b/i.test(needsLine[1]) ? needsLine[1].trim() : null;
      push({ kind: "think", by: "app", op: "CON", text: `I'm building from ${haveL.join(", ")}${lackL.length || need ? ` — and I'm short ${[...lackL, need].filter(Boolean).join(", ")}` : ""}` });
      setLive(material && material.length ? "checking what I have" : "checking what I have — no sources yet");
      paint();
      // THE LOOP-BACK EDGES (bounded, and only on NEW GROUND): a contradiction
      // climbs to re-read the want; a lack climbs to search the ground differently.
      // A climb that found NO NEW source cannot converge — the outside signal is
      // absent — so it is not taken; the turn builds from what it has.
      if (depth < RUNGS.length - 1 && contradiction && novel.length) {
        depth += 1; subject = refineSubject(text, want, RUNGS[depth]);
        push({ kind: "think", by: "fold", op: "REC", text: `What I found pushes against what you asked (“${slice(contradiction).slice(0, 90)}”) — I'll look again with that in mind.` });
        paint(); continue;
      }
      if (depth < RUNGS.length - 1 && need && novel.length) {
        depth += 1; subject = `${refineSubject(text, want, RUNGS[depth])} ${need}`;
        push({ kind: "think", by: "fold", op: "REC", text: `I still lack ${slice(need).slice(0, 80)} — hunting for that one thing.` });
        paint(); continue;
      }
      if (need && !novel.length && material && material.length) {
        push({ kind: "think", by: "fold", op: "REC", text: `the searches kept returning the same ground — “${slice(need).slice(0, 70)}” is not something to fetch; I'll build it myself.` });
        paint();
      }
      break;
    }
    // (6) WEAVE IT TOGETHER — and REC→NUL when the observation fails.
    let finding = atom.finding || null, html = null, held = false;
    // THE MEASURED RESIDUAL (the DMD observable): how far the page is from holding —
    // the real test's own output (observation errors + failing claims), never a text length.
    let residual = 1, obsErrors = 0, failedClaims = 0;
    // THE EXPERIMENT (the weave, ?stitch=1): before asking the mouth for a whole
    // page, STITCH it from what was read — field first (snipped by address), the
    // mouth only the residue, every byte gated and logged with its provenance.
    if (STITCH && !finding && material && material.length) {
      const st = await tryStitch(text, material, outline, draw, ac, required);
      if (st) {
        for (const c of st.log) {
          const by = c.source === "field" ? "library" : c.source === "hunt" ? "hunt" : "mouth";
          if (c.kind === "fill") push({ kind: "assembly", by, op: "SYN", label: `${c.unit} · ${c.source}`, text: String(c.code).slice(0, 400), ok: true, address: c.address || null });
          else if (c.kind === "refusal") push({ kind: "think", by: "app", op: "REC", text: `refused ${c.unit} from ${c.source}: ${c.reason}`, ok: false });
          else if (c.kind === "unfilled") push({ kind: "think", by: "app", op: "NUL", text: `unfilled ${c.unit}: ${c.reason}`, ok: false });
          else if (c.kind === "verdict") push({ kind: "assembly", by: "app", op: "EVA", label: `stitch verdict · ${c.ok ? "holds" : "not held"}`, text: c.reason || "", ok: c.ok === true, ...(c.ok ? { run: { ok: true, finding: null } } : {}) });
        }
        push({ kind: "think", by: "app", op: "CON", text: `stitched ${st.artifact.units.length}/${st.artifact.order.length} units — ${st.artifact.provenance.map((p) => `${p.unit}←${p.source}`).join(", ")}`, ok: true });
        paint();
        if (st.verdict?.ok && st.artifact.complete) {
          html = st.artifact.code; held = true;
          cur.artifact = { kind: "app", html, title: text.slice(0, 48) };
          push({ kind: "assembly", by: "app", op: "SYN", label: "the page (stitched from the sources)", text: html, ok: true });
          toast("Held — stitched from the sources.");
          paint();
          lastMaterial = material;
          return { held: true, finding: null, refused: false, residual: 0 };
        }
        push({ kind: "think", by: "app", op: "REC", text: `the stitched page did not hold (${st.verdict?.reason || "incomplete"}) — drawing the whole page instead.`, ok: false });
        paint();
      }
    }
    for (let round = 1; round <= 3; round += 1) {
      setLive(round === 1 ? "drawing it together" : "drawing it together again");
      push({ kind: "think", by: "fold", op: "SYN", text: round === 1 ? "Now I draw it together from the pieces." : `Round ${round}: drawing it again, the finding in mind.` });
      paint();
      const wtok = streamInto(round === 1 ? "drawing it together" : "drawing it again", "SYN");
      try { html = await buildApp(text, draw, ac.signal, finding, prior, wtok, material, outline); } catch (e) { html = null; push({ kind: "note", by: "app", op: "REC", text: "", ok: false, errors: [{ code: "draw-failed", msg: String((e && e.message) || e).slice(0, 160) }] }); }
      endStream();
      if (!html) { residual = 1; push({ kind: "note", by: "app", op: "REC", text: "", ok: false, errors: [{ code: "empty", msg: "the model returned no page" }] }); break; }
      cur.artifact = { kind: "app", html, title: text.slice(0, 48) };
      push({ kind: "assembly", by: "model", op: "SYN", label: "the page", text: html, ok: true });
      paint();
      setLive("running it to see how it behaves");
      const obs = await observePage(html);
      finding = obs.err && obs.err.length ? `the page threw: ${obs.err[0]}`
        : (obs.nodes < 4 ? "the page rendered nothing"
          : (behaviour && String(obs.t0).trim() === String(obs.t1).trim() ? "nothing changes over time — the behaviour is not running" : null));
      obsErrors = obs.err?.length || 0;
      push({ kind: "assembly", by: "app", op: "EVA", label: finding ? "observed: " + finding : "observed: it runs and holds", text: `errors ${obs.err?.length || 0} · nodes ${obs.nodes} · changed ${String(obs.t0) !== String(obs.t1)}`, ok: !finding, run: { ok: !finding, finding: finding || null, errors: obs.err?.length || 0, nodes: obs.nodes } });
      paint();
      // GATE THE CLAIMS (the app's falsifier): a page that renders is not yet a
      // page that holds — falsify what it asserts against the material that was read.
      if (!finding && material && material.length) {
        const gate = gatePage(html, material);
        if (gate && gate.failed.length) {
          finding = `the page asserts ${gate.failed.length} thing(s) the sources do not support: ${gate.failed.slice(0, 3).map((c) => `“${slice(c.s).slice(0, 90)}”`).join("; ")} — assert only what the sources hold`;
          push({ kind: "think", by: "app", op: "EVA", text: `claims: ${gate.summary.backed}/${gate.summary.claims} backed · ${gate.failed.length} failing`, why: finding, ok: false, claims: { backed: gate.summary.backed, total: gate.summary.claims, failed: gate.failed.length, examples: gate.failed.slice(0, 3).map((c) => c.s) } });
        } else if (gate) {
          push({ kind: "think", by: "app", op: "EVA", text: `claims: ${gate.summary.backed}/${gate.summary.claims} backed by the sources`, ok: true, claims: { backed: gate.summary.backed, total: gate.summary.claims, failed: 0, examples: [] } });
        }
        failedClaims = gate ? gate.failed.length : 0;
        paint();
      }
      // THE JOIN (the ask's atoms against what the page observably shows): a page
      // can render, run and hold its claims and still not show what was asked.
      if (!finding) {
        const missing = missingAtoms(required, { labels: obs.labels, text: obs.t0 });
        if (missing.length) {
          finding = `the page does not show ${atomLine(missing)} — the ask names them`;
          push({ kind: "think", by: "app", op: "EVA", text: `not the ask: missing ${atomLine(missing)}`, why: finding, ok: false });
          paint();
        }
      }
      residual = finding ? (1 + obsErrors + failedClaims) : 0;
      if (!finding) { held = true; toast("Held — the sources hold and it runs."); break; }
      push({ kind: "note", by: "app", op: "REC", text: "", ok: false, errors: [{ code: "finding", msg: finding }] });
      paint();
    }
    lastMaterial = material;
    return { held, finding, refused: false, residual, need, sig: stateOf({ ground: [...ground], need, finding, outline }) };
    }
    // THE RECURSION: one pass, then re-open the WHOLE turn while it does not
    // hold. The FUEL is the FLOOR; the STOP is the DMD decay/cycle of the turn's
    // own trajectory (createTurnGate — streaming, causal, nothing from the
    // future). A settled or cycling turn is released as a NUL, not run to the cap.
    const turnGate = createTurnGate();
    const hist = [];   // the residual per pass, so a CONVERGING turn is left to the DMD
    let dmdStop = null, progressStop = null;
    await runSpiral({
      atom: { text, finding: null }, grain: RUNGS[0], fuel: FUEL_TURN,
      step: async (cur, i) => {
        if (i > 0) { rungNow = RUNGS[0]; push({ kind: "think", by: "fold", op: "REC", text: `◉ re-opening the whole turn (pass ${i + 1}) — the finding: ${slice(cur.atom.finding).slice(0, 90)}` }); paint(); }
        const r = await onePass(cur.atom);
        held = r.held;
        if (r.refused || r.held) return { done: true };
        // THE DMD FIRST (the measured stop): observe, then let the gate decide.
        hist.push(r.residual);
        turnGate.observe({ held: false, finding: r.finding, residual: r.residual });
        const d = turnGate.decide();
        if (d.fire) {
          dmdStop = d;
          push({ kind: "think", by: "app", op: "REC", say: stopLine(d) });
          paint();
          return { done: true };
        }
        // THE OUTSIDE SIGNAL, as a safety net the DMD cannot be trusted to supply
        // (a flat residual never fires it — experiment-recursion.mjs). Stop when a
        // pass adds NO new ground, a state repeats, ONCE the trajectory has had
        // three points to show it is converging: a settling residual (each pass
        // smaller than the last) is left to the DMD, which fires it honestly.
        const converging = isConverging(hist);
        const p = progress.note({ sig: r.sig, groundSize: ground.size });
        if (p.stagnant && hist.length >= 3 && !converging) {
          progressStop = { repeats: p.repeats, stale: p.stale };
          push({ kind: "think", by: "app", op: "REC", say: `the turn came back to the same ground with nothing new (${p.repeats}×, ${p.stale} pass(es) without new ground) — nothing outside it changed, so it cannot close itself; I stop here and release what it has.` });
          paint();
          return { done: true };
        }
        return { recurse: { atom: { text, finding: r.finding }, grain: RUNGS[0], reason: `unheld: ${r.finding}` } };
      },
    });
    if (!held && progressStop) toast("Left open — nothing new was found after " + progressStop.repeats + " tries; I stopped rather than loop.");
    else if (!held && dmdStop) toast("Left open — the turn's own modes " + (dmdStop.reason === "oscillating" ? "cycle" : "have settled") + " (measured, not the cap).");
    else if (!held) toast("Left open — the turn still does not hold after " + FUEL_TURN + " passes.");
    // LAY THE TRAIL: reinforce the path that held (the rungs climbed, the sources
    // read); sour the ground that gave nothing. The next turn follows the strongest.
    const srcKeys = (lastMaterial || []).map((m) => "src:" + domainKey(m)).filter((k) => k !== "src:");
    const keys = [...visitedRungs.map((r) => "rung:" + r), ...srcKeys];
    if (keys.length) {
      trail(keys, held ? 1 : -0.6);
      push({ kind: "think", by: "app", op: "EVA", text: held ? `pheromone: reinforced ${keys.join(", ")}` : `pheromone: soured ${keys.join(", ")} — that ground gave nothing`, ok: held });
      paint();
    }
  }

  async function runAsk(text) {
    if (!cur || running) return;
    const ac = new AbortController(); running = ac;
    if (!kernel && cur.log.some((e) => e.kind === "assembly" && e.ok && e.text)) kernel = rebuild(cur);
    const first = !cur.artifact || !(cur.artifact.html || cur.artifact.doc);
    const lk = cur.artifact ? cur.artifact.kind : (!kernel ? longKind(text) : null);
    push({ kind: "ask", by: "you", text: "", ask: text, ok: true, op: "NUL" });
    if (first && cur.title === "New fold") cur.title = text.slice(0, 48);
    // SHOW IT IMMEDIATELY. The first thing is a model call (the reading) and the
    // first call is the slow one — so paint the ask and a working line BEFORE the
    // await, never a blank screen until the model speaks.
    setLive(first ? "reading what you're asking for" : "reading your follow-up"); paint();
    // THE PIPELINE: (1) what does the person want → (2) find examples → (3) does
    // that change the want → (4) outline → (5) inventory → (6) weave; REC→NUL at
    // any point. One turn, the whole movement, streamed and operator-tagged.
    if (!lk && !cur.codebase) {
      await runPipeline(text, ac);
      running = null; live = null; paint(); renderList();
      return;
    }
    setLive(first ? "reading what you're asking for" : "reading your follow-up"); paint();
    try {
      if (lk) {
        const onStep = (e) => { const { artifact, ...rest } = e; push({ kind: "assembly", ...rest }); if (artifact) cur.artifact = { ...cur.artifact, ...artifact, kind: lk }; live.units = []; paint(); };
        const onLive = (l) => { live.label = l; liveStart = Date.now(); paint(); };
        cur.kind = lk;
        const lit = /["\u201c']([^"\u201d']+)["\u201d']\s*(?:to|with|into|\u2192|->)\s*["\u201c']([^"\u201d']+)["\u201d']/i.exec(text);
        const addM = lk === "essay" && /\b(add|include|another|new)\b[^.]*?\bsection\b\s*(?:on|about|called|titled|for)?\s*[:"\u201c]?\s*(.+?)["\u201d]?\s*$/i.exec(text);
        const cx = complete(ac.signal);
        if (!cur.artifact || (lk === "extract" && urlOf(text) && !lit)) {
          const r = lk === "essay" ? await runEssay(text, { complete: cx, signal: ac.signal, onStep, onLive }) : await runExtract(text, { signal: ac.signal, onStep, onLive });
          if (r.html) cur.artifact = { kind: lk, html: r.html, files: r.files || [], doc: r.doc };
          toast(r.ok ? (lk === "essay" ? "Essay written from sources." : "Page parsed.") : "It did not hold. The record says why.");
        } else if (lit) {
          const r = replaceInArtifact(cur.artifact, lit[1], lit[2]);
          if (r) cur.artifact = r;
          push({ kind: "assembly", by: "app", label: `replace \u201c${lit[1]}\u201d \u2192 \u201c${lit[2]}\u201d`, text: "", ok: !!r, errors: r ? [] : [{ code: "not changed", msg: `\u201c${lit[1]}\u201d does not appear`, fix: "" }], notes: r ? ["a literal replacement is app-owned: no model was asked"] : [] });
        } else if (lk === "essay" && /\b(longer|lengthen|expand|extend|more (detail|depth|sections)|add \d+ more|go deeper|\d[\d,]*\s*words|\d+\s*(sections|parts))\b/i.test(text)) {
          const n = await extendEssay(cur.artifact.doc, text, { complete: cx, signal: ac.signal, onStep, onLive });
          if (n) toast(`Added ${n} section${n === 1 ? "" : "s"}.`);
        } else if (addM) {
          await addSection(cur.artifact.doc, addM[2].trim(), { complete: cx, signal: ac.signal, onStep, onLive });
        } else if (lk === "essay" && text.length <= 70 && !/[?]$/.test(text)) {
          await addSection(cur.artifact.doc, text.replace(/^(add|write|cover|include)\s+(a\s+)?(section\s+)?(on|about)?\s*/i, "").replace(/[.!]+$/, ""), { complete: cx, signal: ac.signal, onStep, onLive });
        } else { push({ kind: "note", by: "app", text: "", ok: false, errors: [{ code: "not changed", msg: lk === "essay" ? "Follow-ups here: make it longer, 1500 words, add 4 more sections, change \u201cx\u201d to \u201cy\u201d, or add a section on <topic>." : "Follow-ups here: change \u201cx\u201d to \u201cy\u201d, or paste another URL to parse." }] });
        }
      } else { push({ kind: "note", by: "app", text: "", ok: false, errors: [{ code: "no path", msg: "this ask reached no builder" }] }); }
    } catch (e) { push({ kind: "note", by: "app", text: "", ok: false, errors: [{ code: "failed", msg: String(e?.message || e) }] }); }
    finally { const stopped = ac.signal.aborted; running = null; live = null; if (ed) openEditor(ed.name); paint(); renderList(); if (stopped) queue.length = 0; else if (queue.length) runAsk(queue.shift()); }
  }
  function openEditor(name) { const x = kernel && editorFor(kernel, name); ed = x ? { ...x, values: Object.fromEntries(x.fields.map((f) => [f.key, f.value])), rows: x.room ? x.room.rowsText : null } : null; edErr = []; }
  function applyEdit() {
    if (!ed || !kernel) return; const e = editEOT(kernel, ed.name, ed.values, ed.rows); if (!e) return;
    const v = kernel.submit(e.text, { by: "you", label: `edit ${ed.name}` });
    push({ kind: "assembly", by: "you", label: `edit ${ed.name}`, text: e.text, ok: v.ok, errors: v.errors, inverse: v.ok ? e.inverse : null });
    if (v.ok) { const words = contentWords((cur.log.find((x) => x.kind === "ask")?.ask || "") + " " + (cur.kind || "")); for (const f of ed.fields) { const now = String(ed.values[f.key] ?? "").trim(); if (now === f.value) continue; const shape = `${ed.type}.${f.key}`; if (f.value) memory.reject(shape, f.value, "you replaced it"); if (now) memory.keep(shape, now, words, "you"); } openEditor(ed.name); }
    else edErr = v.errors;
    paint();
  }
  function undo(i) { const en = cur.log[i]; if (!en?.inverse || en.undone) return; const v = kernel.submit(en.inverse, { by: "you", label: "undo" }); if (v.ok) en.undone = true; push({ kind: "assembly", by: "you", label: `undo · ${en.label}`, text: en.inverse, ok: v.ok, errors: v.errors }); if (ed) openEditor(ed.name); paint(); }

  let frame = null, frameHtml = "";
  function paint() {
    if (!cur || space.hidden) return;
    const oldTa = space.querySelector(".fs-comp textarea");
    const keepComp = oldTa?.value ?? "";
    const hadFocus = !!oldTa && document.activeElement === oldTa, selA = oldTa?.selectionStart ?? 0, selB = oldTa?.selectionEnd ?? 0;
    const hasArt = kernel && kernel.names().some((n) => n.type === "app" || n.type !== "room");
    const html = cur.artifact?.html || (hasArt ? render(kernel.model()) : "");
    const started = !!(kernel || cur.artifact || cur.codebase);
    const tr = trustOf(cur);
    // how is this fold doing, in one word?
    let lastAskIdx = -1;
    for (let i = cur.log.length - 1; i >= 0; i--) if (cur.log[i].kind === "ask") { lastAskIdx = i; break; }
    const since = lastAskIdx < 0 ? cur.log : cur.log.slice(lastAskIdx);
    const hasIssue = since.some((e) => e.ok === false);
    let state = null;
    if (running) state = { t: "Working…", c: "run" };
    else if (started || cur.log.length) state = hasIssue ? { t: "Needs attention", c: "bad" } : (tr.run && tr.run.ok ? { t: "Ready", c: "ok" } : (cur.log.length ? { t: "In progress", c: "mut" } : null));
    const rowCls = (e) => e.ok === false ? "bad" : e.streaming ? "run" : (e.kind !== "think" && e.ok ? "ok" : (e.kind === "think" ? "info" : ""));
    const techOf = (e) => {
      const bits = [];
      if (e.op) bits.push(`${stepWord(e)} (${e.op}${OPG[e.op] ? " " + OPG[e.op] : ""})`);
      if (e.by) bits.push(`spoken by ${whoWord(e.by)} (${e.by})`);
      if (e.cell) bits.push(cellLine(e.cell));
      return bits.join(" · ");
    };
    // A ROW is one plain step on the turn's spine. The raw operator, the cube
    // cell and the units are still there — behind the disclosure, on purpose.
    const rowHtml = (e, i) => {
      if (e.kind === "think" && ("streaming" in e)) {
        // THE REASONING ITSELF — visible as it happens, kept open after it lands.
        // A spinning ring + a ticking time while it works; a ✓/◉/✗ mark when it settles.
        const live0 = e.streaming;
        const mark = live0 ? `<span class="fs-spin" aria-hidden="true"></span>` : (e.ok === false ? `<span class="fs-mark bad">✗</span>` : (e.op === "REC" ? `<span class="fs-mark warn">◉</span>` : `<span class="fs-mark ok">✓</span>`));
        const time = live0 ? `<span class="fs-time" data-t0="${esc(e.at || 0)}">${secs(Date.now() - (e.at || Date.now()))}</span>` : "";
        const cap = live0 ? "thinking it through" : esc(stepWord(e).toLowerCase());
        return `<div class="fs-thinkblock${live0 ? " streaming" : ""}"><div class="fs-think-h" data-think="${i}">${mark}<span>${cap}</span>${time}</div><div class="fs-think-t">${esc(e.text || "")}</div></div>`;
      }
      const cls = rowCls(e);
      const grain = e.cell && e.cell.grain ? ` g-${e.cell.grain.toLowerCase()}` : "";
      const glyph = (e.op && OPG[e.op]) ? `<span class="fs-glyph${grain}" title="${esc(e.cell ? cellLine(e.cell) : e.op)}">${esc(OPG[e.op])}</span>` : "";
      const verb = e.kind === "codebase" ? "Codebase added" : stepWord(e);
      const who = e.by ? `<span class="fs-who">${esc(whoWord(e.by))}</span>` : "";
      const title = (e.kind !== "think" && e.label) ? `<span class="fs-text" style="font-weight:600">${esc(e.label)}</span>` : "";
      const bodyTxt = e.say || (e.kind !== "think" ? "" : e.text) || "";
      const body = bodyTxt ? `<div class="fs-text">${esc(bodyTxt)}</div>` : "";
      const why = (e.why && e.why !== bodyTxt) ? `<div class="fs-why">${esc(e.why)}</div>` : "";
      const errs = (e.errors || []).map((x) => `<div class="fs-err">${esc(x.msg || x.code || x)}</div>`).join("");
      const notes = (e.notes || []).map((n) => `<div class="fs-note">${esc(n)}</div>`).join("");
      const srcs = (e.sources || []).map(sourceChip).join("");
      const srcWrap = srcs ? `<div class="fs-sources"><span class="fs-who">read</span>${srcs}</div>` : "";
      const units = (e.units || []).map((u) => `<div class="fs-u"><span class="k">${esc(u.key)}</span><span class="v">${esc(u.value || "(empty)")}</span><span class="fs-who">${esc(whoWord(u.by))}</span>${(u.scars || []).map((s) => `<span></span><span class="s">✗ ${esc(s)}</span>`).join("")}</div>`).join("");
      const hasUnits = !!(e.units && e.units.length);
      const tech = techOf(e);
      const detail = (hasUnits || tech) ? `<div class="fs-detail">${hasUnits ? `<div class="fs-units">${units}</div>` : ""}${tech ? `<div class="fs-tech">${esc(tech)}</div>` : ""}</div>` : "";
      const detailLabel = hasUnits ? `${e.units.filter((u) => u.by === "mouth").length}/${e.units.length} parts` : "details";
      const toggle = (hasUnits || tech) ? `<button type="button" class="fs-more" data-detail="${i}" aria-label="${esc(detailLabel)}" title="${esc(detailLabel)}"></button>` : "";
      const undoBtn = (e.inverse && e.ok && !e.undone && !running) ? `<button type="button" class="fs-undo" data-undo="${i}">Undo</button>` : "";
      return `<div class="fs-row ${cls}"><div class="fs-row-body"><div class="fs-line">${glyph}<span class="fs-verb">${esc(verb)}</span>${who}</div>${title}${body}${why}${errs}${notes}${srcWrap}${detail}${toggle}${undoBtn}</div></div>`;
    };
    // GROUP the log into turns: one ask, then the work it set off. A turn is
    // the unit a person reads; everything inside it is steps on a spine.
    const turns = [];
    for (const e of cur.log) {
      if (e.kind === "ask") turns.push({ ask: e.ask, rows: [] });
      else if (turns.length) turns[turns.length - 1].rows.push(e);
      else turns.push({ ask: null, rows: [e] });
    }
    let gi = 0;
    const turnsHtml = turns.map((t) => `<div class="fs-turn">${t.ask !== null ? `<div class="fs-ask">${esc(t.ask)}</div>` : ""}<div class="fs-steps">${t.rows.map((e) => rowHtml(e, gi++)).join("")}</div></div>`).join("");
    const emptyState = `<div class="fs-empty"><b>What should this make?</b><div style="margin-top:6px">A page, a widget, a document, a sourced essay — or paste a URL to pull its tables and lists. Each piece is read, built and checked, and every step is kept where you can see it.</div><div class="fs-starters"><button type="button" class="fs-starter" data-starter="0">Build a tip calculator with 10%, 15% and 20% buttons</button><button type="button" class="fs-starter" data-starter="1">Build a countdown timer with Start, Pause and Reset</button><button type="button" class="fs-starter" data-starter="2">Build a one-page site for a small business</button></div></div>`;
    const liveHtml = (live ? `<div class="fs-row run"><div class="fs-row-body"><div class="fs-line"><span class="fs-glyph">◐</span><span class="fs-verb">${esc(live.label)}</span><span class="fs-spin" data-live-spin aria-hidden="true"></span><span class="fs-time" data-t0="${liveStart || Date.now()}" data-live-time>0s</span><span class="fs-who">The Fold</span></div>${live.units.length ? `<div class="fs-units">${live.units.map((u) => `<div class="fs-u"><span class="k">${esc(u.key)}</span><span class="v">${esc(u.value || "…")}</span><span class="fs-who">${esc(whoWord(u.by))}</span></div>`).join("")}</div>` : ""}</div></div>` : "") + queue.map((q) => `<div class="fs-ask" style="opacity:.6">${esc(q)}<span class="fs-note" style="margin-left:8px">queued</span></div>`).join("");
    const parts = kernel ? editableParts(kernel) : [];
    const edHtml = ed ? `<div class="fs-ed"><b style="font:600 var(--fs-sm) var(--sans)">${esc(ed.name)} · ${esc(ed.type)}</b>${ed.fields.map((f) => `<label>${esc(f.key)}${f.options ? `<select data-f="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(o)}"${o === ed.values[f.key] ? " selected" : ""}>${esc(o || "(default)")}</option>`).join("")}</select>` : `<input data-f="${esc(f.key)}" value="${esc(ed.values[f.key] ?? "")}">`}</label>`).join("")}${ed.room ? `<label>records of ${esc(ed.room.name)} (${esc(ed.room.fields.join(" | "))})<textarea data-rows="1" rows="4">${esc(ed.rows || "")}</textarea></label>` : ""}${edErr.map((x) => `<div class="fs-err">${esc(x.code)} · ${esc(x.msg)}</div>`).join("")}<div class="row" style="display:flex;gap:6px"><button type="button" class="fs-btn on" data-apply="1">Check and apply</button><button type="button" class="fs-btn" data-edclose="1">Close</button></div></div>` : "";
    // THE CODEBASE: a worktree on the left, one file on the right, seen as a
    // PROJECTION (the bytes now) or as the LOG of changes that produced it.
    let codeView = "";
    if (cur.codebase && tab === "code") {
      const names = Object.keys(cur.codebase.files).sort();
      const tgt = cur.codeTarget || names[0];
      const content = tgt ? String(cur.codebase.files[tgt] ?? "") : "";
      const changes = (cur.codeChanges || []).filter((c) => c.path === tgt);
      const mode = cur.codeMode || "projection";
      const body = mode === "log"
        ? (changes.length
          ? changes.map((c, i) => { const d = diffLines(c.before, c.after); const st = diffStat(d); return `<div class="fs-chg"><div class="fs-chg-h"><span class="fs-by ${esc(c.by)}">${esc(c.by)}</span><b>${esc(c.label || c.op)}</b>${i === 0 ? "" : `<span>+${st.added} −${st.removed}</span>`}</div><pre class="fs-diff">${d.filter((h) => h.op !== "ctx" && h.op !== "same").map((h) => (h.op === "add" ? "+ " : h.op === "del" ? "- " : "  ") + esc(h.text)).join("\n")}</pre></div>`; }).join("")
          : `<div class="fs-empty">No changes recorded for ${esc(tgt || "this file")} yet.</div>`)
        : `<pre class="fs-file">${esc(content)}</pre>`;
      codeView = `<div class="fs-code"><div class="fs-tree">${names.map((p) => `<button type="button" class="fs-tbtn${p === tgt ? " on" : ""}" data-cf="${esc(p)}">${esc(p)}</button>`).join("")}</div><div class="fs-cview"><div class="fs-ch"><b>${esc(tgt || "")}</b><span class="fs-sp"></span><button type="button" class="fs-btn${mode === "projection" ? " on" : ""}" data-cmode="projection">Projection</button><button type="button" class="fs-btn${mode === "log" ? " on" : ""}" data-cmode="log">Log (${changes.length})</button></div>${body}</div></div>`;
    }
    if (!space.firstChild) space.innerHTML = `<div class="fs-sess"></div><div class="fs-canvas"></div>`;
    if (!space.dataset.view) space.dataset.view = "session";
    const sessEl = space.querySelector(".fs-sess"), canvasEl = space.querySelector(".fs-canvas");
    sessEl.innerHTML = `<div class="fs-head"><span class="fs-chip">${esc(KIND_WORD[cur.kind] || cur.kind || "agent")}</span><b>${esc(cur.title)}</b>${state ? `<span class="fs-badge ${state.c}">${state.t}</span>` : ""}<span class="fs-sp"></span><button type="button" class="fs-btn fs-vt" data-view="canvas">Preview →</button><button type="button" class="fs-btn" data-new="1" title="New fold">＋ New</button><button type="button" class="fs-btn" data-close="1" title="Back to chat">Chat</button></div>
      <div class="fs-log" aria-live="polite">${turnsHtml || emptyState}${liveHtml}</div>${edHtml}
      <div class="fs-comp">${sel && kernel ? `<div class="row"><span class="fs-sel">◎ ${esc(sel)}</span><button type="button" class="fs-more" data-unsel="1">clear</button></div>` : ""}<div class="inrow"><textarea rows="2" aria-label="${started ? "Follow up on this fold" : "What should this fold make"}">${esc(keepComp)}</textarea>${running ? `<button type="button" class="fs-btn" data-stop="1">Stop</button>` : `<button type="button" class="fs-btn go" data-send="1">${started ? "Send" : "Make it"}</button>`}</div>
        ${!started ? `<div class="row">${["auto", "website", "widget", "document"].map((k) => `<button type="button" class="fs-btn${(cur.kindPick || "auto") === k ? " on" : ""}" data-kind="${k}">${k}</button>`).join("")}</div>` : ""}</div>`;
    const trustSig = [tr.sources?.length || 0, tr.claims?.backed || 0, tr.claims?.failed || 0, tr.run?.ok ? 1 : 0].join(",");
    const ckey = [tab, editMode, html, parts.length, tab === "eot" ? cur.log.length : 0, trustSig, cur.codebase ? [cur.codeTarget, cur.codeMode, (cur.codeChanges || []).length].join(",") : ""].join("|");
    if (canvasEl.__key !== ckey) {
      canvasEl.__key = ckey;
      const trustBar = (tr.sources || tr.claims || tr.run) ? `
        <div class="fs-trust">${tr.sources ? `<span class="fs-who">read from</span>${tr.sources.map(sourceChip).join("")}` : ""}<span class="fs-sp"></span>${tr.claims ? `<span class="fs-badge ${tr.claims.failed ? "warn" : "ok"}" title="the page's claims were checked against the sources">${tr.claims.failed ? `${tr.claims.failed} claim${tr.claims.failed === 1 ? "" : "s"} not supported` : `claims supported · ${tr.claims.backed}/${tr.claims.total}`}</span>` : ""}${tr.run ? `<span class="fs-badge ${tr.run.ok ? "ok" : "bad"}" title="the page was run in a sandbox">${tr.run.ok ? "runs & holds" : "did not hold"}</span>` : ""}</div>${tr.claims?.examples?.length ? `<div class="fs-caveat">The sources do not support: ${tr.claims.examples.map((x) => `“${esc(x)}”`).join("; ")}</div>` : ""}` : "";
      canvasEl.innerHTML = `${trustBar}<div class="fs-cbar"><button type="button" class="fs-btn fs-vt" data-view="session">← Session</button><button type="button" class="fs-btn${tab === "preview" ? " on" : ""}" data-tab="preview">Preview</button><button type="button" class="fs-btn${tab === "eot" ? " on" : ""}" data-tab="eot">EOT</button>${cur.codebase ? `<button type="button" class="fs-btn${tab === "code" ? " on" : ""}" data-tab="code">Code</button>` : ""}<span class="fs-sp"></span>${parts.length ? `<button type="button" class="fs-btn${editMode ? " on" : ""}" data-edit="1">${editMode ? "Editing · click a part" : "Edit"}</button>` : ""}${html ? `<button type="button" class="fs-btn" data-dl="1">Download HTML</button>` : ""}${(cur.artifact?.files || []).map((f, i) => `<button type="button" class="fs-btn" data-file="${i}">${esc(f.name)}</button>`).join("")}</div>
        ${tab === "code" && cur.codebase ? codeView : tab === "eot" ? `<pre class="fs-eot">${esc(cur.log.filter((e) => e.ok && e.text).map((e) => `# ${esc(whoWord(e.by))} · ${e.label}\n${e.text}`).join("\n\n") || "(nothing set down yet)")}</pre>` : html ? `<div class="fs-frame"><iframe title="The fold's artifact" sandbox="allow-scripts allow-forms"></iframe></div>` : `<div class="fs-empty">The artifact appears here as its parts pass.</div>`}`;
      frame = canvasEl.querySelector("iframe"); if (frame) { frame.srcdoc = html; frameHtml = html; }
    }
    const log = space.querySelector(".fs-log"); log.scrollTop = log.scrollHeight;
    const ta = space.querySelector(".fs-comp textarea");
    if (hadFocus) { ta.focus(); try { ta.setSelectionRange(selA, selB); } catch {} }
    ta.onkeydown = (ev) => { if (ev.key === "Enter" && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); send(); } };
    space.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { space.dataset.view = b.dataset.view; paint(); }));
    space.querySelectorAll("[data-kind]").forEach((b) => (b.onclick = () => { cur.kindPick = b.dataset.kind === "auto" ? null : b.dataset.kind; paint(); }));
    space.querySelectorAll("[data-detail]").forEach((b) => (b.onclick = () => b.closest(".fs-row").classList.toggle("open")));
    space.querySelectorAll("[data-think]").forEach((b) => (b.onclick = () => b.closest(".fs-thinkblock").classList.toggle("collapsed")));
    space.querySelectorAll("[data-undo]").forEach((b) => (b.onclick = () => undo(+b.dataset.undo)));
    space.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { tab = b.dataset.tab; paint(); }));
    space.querySelectorAll("[data-cf]").forEach((b) => (b.onclick = () => { cur.codeTarget = b.dataset.cf; paint(); }));
    space.querySelectorAll("[data-cmode]").forEach((b) => (b.onclick = () => { cur.codeMode = b.dataset.cmode; paint(); }));
    space.querySelectorAll("[data-f]").forEach((x) => (x.oninput = x.onchange = () => { ed.values[x.dataset.f] = x.value; }));
    const rows = space.querySelector("[data-rows]"); if (rows) rows.oninput = () => { ed.rows = rows.value; };
    const on = (sel2, fn) => { const x = space.querySelector(sel2); if (x) x.onclick = fn; };
    on("[data-send]", send); on("[data-stop]", () => running?.abort()); on("[data-close]", close); on("[data-new]", () => create());
    on("[data-unsel]", () => { sel = null; paint(); }); on("[data-apply]", applyEdit); on("[data-edclose]", () => { ed = null; paint(); });
    on("[data-edit]", () => { editMode = !editMode; paint(); });
    const STARTERS = ["Build a tip calculator with 10%, 15% and 20% buttons", "Build a countdown timer with Start, Pause and Reset", "Build a one-page site for a small business"];
    space.querySelectorAll("[data-starter]").forEach((b) => (b.onclick = () => { const t = space.querySelector(".fs-comp textarea"); if (t) { t.value = STARTERS[+b.dataset.starter] || ""; send(); } }));
    space.querySelectorAll("[data-file]").forEach((b) => (b.onclick = () => { const f = cur.artifact.files[+b.dataset.file]; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([f.text], { type: f.mime })); a.download = f.name; a.click(); }));
    on("[data-dl]", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([frameHtml], { type: "text/html" })); a.download = (cur.title || "fold").replace(/[^\w-]+/g, "-").slice(0, 40) + ".html"; a.click(); });
  }
  function send() { const ta = space.querySelector(".fs-comp textarea"); const t = ta?.value.trim(); if (!t) return; ta.value = ""; if (running) { queue.push(t); paint(); toast("Queued. It runs when the current step finishes."); return; } runAsk(t); }
  window.addEventListener("message", (ev) => {
    if (!frame || ev.source !== frame.contentWindow) return; const d = ev.data || {};
    if (d.fold === "ready") { frame.contentWindow.postMessage({ fold: "edit", on: editMode }, "*"); frame.contentWindow.postMessage({ fold: "select", name: sel }, "*"); }
    if (d.fold === "pick" && d.name) { sel = d.name; openEditor(d.name); paint(); }
  });

  function open(id) {
    const f = folds.find((x) => x.id === id); if (!f) return;
    if (!running) queue.length = 0;
    if (running && cur && cur.id !== id) { toast("This fold is still working; stop it first."); return; }
    space.innerHTML = ""; space.dataset.view = "session"; cur = f; kernel = f.log.some((e) => e.kind === "assembly" && e.ok && e.text) ? rebuild(f) : null; sel = null; ed = null; editMode = false; tab = "preview";
    space.hidden = false; main.classList.add("folding"); onOpen(f); paint(); renderList();
    setTimeout(() => space.querySelector(".fs-comp textarea")?.focus(), 0);
  }
  function create(ask = null) {
    if (running) { toast("A fold is still working; stop it first."); return null; }
    const f = { id: uid(), title: ask ? ask.slice(0, 48) : "New fold", kind: ask ? longKind(ask) : null, created: Date.now(), updated: Date.now(), log: [] };
    folds.push(f); save(); open(f.id);
    if (ask) runAsk(ask);
    return f.id;
  }
  function close() { space.hidden = true; main.classList.remove("folding"); onClose(); renderList(); }
  // A CODEBASE: files loaded into a workspace (fold-chat-workspace.js). Seen two
  // ways, per file — as a PROJECTION (the bytes now) and as the LOG (the changes
  // that produced them). The file is a fold of its own change history.
  function setCodebase(files = {}) {
    const ws = createWorkspace(files);
    if (!cur) create();
    cur.codebase = ws;
    cur.codeChanges = Object.keys(ws.files).sort().map((p) => ({ at: Date.now(), path: p, op: "add", before: "", after: ws.files[p], by: "you", label: "imported" }));
    cur.codeTarget = Object.keys(ws.files).find((p) => /(^|\/)(index\.html|README\.md|package\.json)$/i.test(p)) || Object.keys(ws.files).sort()[0] || null;
    cur.codeMode = "projection";
    tab = "code";
    push({ kind: "codebase", by: "you", label: `codebase · ${Object.keys(ws.files).length} files`, ok: true });
    paint(); renderList();
    return cur.id;
  }
  if (newBtn) newBtn.onclick = () => create();
  if (railBtn) railBtn.onclick = () => (space.hidden ? (folds.length ? open([...folds].sort((a, b) => b.updated - a.updated)[0].id) : create()) : close());
  renderList();
  return { create, setCodebase, open, close, isOpen: () => !space.hidden, list: () => folds.map((f) => ({ id: f.id, title: f.title, kind: f.kind })) };
}
