// fold-chat-agentfeed.css.js — the agent run feed's look: a coding agent's
// transcript (Claude Code / OpenCode), not a dashboard. Plain words only; the
// technical text hides behind "details" buttons (see fold-chat-agentfeed-words.js). Monospace, left-aligned,
// no boxes. One line per action with a status bullet; its result hangs under it
// behind a ⎿ connector; everything secondary is dim; colour means state only
// (green done · red failed · amber retry/wait · accent while running).
//
// Why nothing here squeezes: every line is a two-column GRID (glyph | text) whose
// text column is minmax(0, 1fr) and holds plain inline text. The old rows were a
// nowrap-less flex row of label + detail + timer with `overflow-wrap: anywhere`
// on the detail — `anywhere` makes a flex child's min-content ONE character, so
// when the label was `flex: none` the detail was shrunk to a single character
// wide and wrapped one glyph per line. Inline text in a grid column cannot do
// that: it always gets the whole column.
//
// Everything is under `.cc-run` (a NEW prefix — it cannot collide with the older
// .ar-* rules in index.html). It reads the page's variables and has fallbacks, so
// it also works in a bare harness page.

export const FEED_STYLE_ID = "fold-agentfeed-style";

export const FEED_CSS = `
.cc-run {
  --cc-ink: var(--ink, #141416); --cc-txt: var(--ink2, #44444e); --cc-dim: var(--mut, #5f5f6b); --cc-line: var(--line, #e4e4e9);
  --cc-acc: var(--ag, #0d7a70); --cc-acc-soft: var(--ag-soft, #e7f6f3); --cc-chip: var(--side2, #f1f1f4);
  --cc-ok: #15803d; --cc-bad: #b91c1c; --cc-warn: #b45309; --cc-seal: #0e7490;
  display: block; min-width: 0; max-width: 100%; margin: 6px 0 10px;
  font: var(--fs-sm, 12.5px)/1.5 var(--mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  color: var(--cc-txt); text-align: left; letter-spacing: 0;
}
html[data-theme="dark"] .cc-run { --cc-ok: #4ade80; --cc-bad: #f87171; --cc-warn: #fbbf24; --cc-seal: #67e8f9; }
@media (prefers-color-scheme: dark) { html:not([data-theme]) .cc-run { --cc-ok: #4ade80; --cc-bad: #f87171; --cc-warn: #fbbf24; --cc-seal: #67e8f9; } }
.cc-run * { box-sizing: border-box; }
.cc-run button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; }
.cc-run button:focus-visible, .cc-run summary:focus-visible, .cc-run .cc-clickable:focus-visible { outline: 2px solid var(--cc-acc); outline-offset: 2px; border-radius: 3px; }

/* one action: glyph | text. The text column is the whole rest of the row. */
.cc-line { display: grid; grid-template-columns: 2ch minmax(0, 1fr); column-gap: 1ch; padding: 1px 0; }
.cc-g { text-align: center; color: var(--cc-dim); user-select: none; }
.cc-body { min-width: 0; overflow-wrap: anywhere; color: var(--cc-ink); }
.cc-lab { font-weight: 600; }
.cc-at, .cc-tm, .cc-note { color: var(--cc-dim); font-weight: 400; }
.cc-tm { font-variant-numeric: tabular-nums; }
.cc-step.cc-ok > .cc-line .cc-g { color: var(--cc-ok); }
.cc-step.cc-bad > .cc-line .cc-g { color: var(--cc-bad); }
.cc-step.cc-warn > .cc-line .cc-g, .cc-step.cc-warn > .cc-line .cc-lab { color: var(--cc-warn); }
.cc-step.cc-seal > .cc-line .cc-g, .cc-step.cc-seal > .cc-line .cc-lab { color: var(--cc-seal); }
.cc-step.cc-run > .cc-line .cc-g { color: var(--cc-acc); animation: cc-blink 1.1s ease-in-out infinite; }
.cc-step.cc-info > .cc-line .cc-lab { color: var(--cc-txt); font-weight: 500; }
@keyframes cc-blink { 50% { opacity: .25; } }

/* what an action produced — hangs under it behind the connector */
.cc-res { margin-left: calc(2ch + 1ch); }
.cc-r { display: grid; grid-template-columns: 2ch minmax(0, 1fr); column-gap: 1ch; color: var(--cc-dim); }
.cc-r > .cc-c { color: var(--cc-dim); user-select: none; }
.cc-txt { min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
.cc-open .cc-txt { -webkit-line-clamp: unset; line-clamp: unset; display: block; overflow: visible; }
.cc-txt.cc-clip { cursor: pointer; }
.cc-r.cc-ok .cc-m { color: var(--cc-ok); } .cc-r.cc-bad { color: var(--cc-bad); } .cc-r.cc-warn { color: var(--cc-warn); } .cc-r.cc-seal { color: var(--cc-seal); }
.cc-r.cc-bad .cc-m { color: var(--cc-bad); }
.cc-r.cc-find { color: var(--cc-warn); }
.cc-r.cc-seal .cc-txt { white-space: normal; }
.cc-run .cc-more { margin-left: calc(6ch); color: var(--cc-dim); text-align: left; }
.cc-run .cc-more:hover, .cc-txt.cc-clip:hover { color: var(--cc-ink); }
.cc-run .cc-more:hover { text-decoration: underline; }
.cc-r[hidden] { display: none; }
.cc-audit { cursor: pointer; border-radius: 3px; } .cc-audit:hover .cc-txt { color: var(--cc-ink); text-decoration: underline; text-decoration-color: var(--cc-line); text-underline-offset: 3px; }

/* the agent loop's own tool calls, nested under the step that made them */
.cc-tools { margin-left: calc(2ch + 1ch); }
.cc-tool { display: block; color: var(--cc-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0; }
.cc-tool b { font-weight: 600; color: var(--cc-txt); }
.cc-tool .cc-st { color: var(--cc-warn); }
.cc-run .cc-tools + .cc-more { display: block; margin-left: 3ch; }
.cc-tool[hidden], .cc-run .cc-more[hidden], .cc-run .cc-tools + .cc-more[hidden] { display: none; }

/* round dividers and the repair header */
.cc-round { color: var(--cc-dim); margin: 7px 0 1px; display: flex; align-items: center; gap: 1ch; }
.cc-round::after { content: ""; flex: 1; border-top: 1px dotted var(--cc-line); min-width: 1ch; }
.cc-round:first-child { margin-top: 0; }

/* the plan: a compact checklist, collapsed to one line once work starts */
.cc-plan { margin: 0 0 3px; }
.cc-plan > summary { list-style: none; cursor: pointer; color: var(--cc-dim); display: block; user-select: none; padding: 1px 0; }
.cc-plan > summary::-webkit-details-marker { display: none; }
.cc-plan > summary::before { content: "▸"; display: inline-block; width: 2ch; margin-right: 1ch; text-align: center; }
.cc-plan[open] > summary::before { content: "▾"; }
.cc-plan > summary:hover { color: var(--cc-ink); }
.cc-plan .cc-pn { color: var(--cc-ink); font-weight: 600; }
.cc-plan .cc-pp { font-variant-numeric: tabular-nums; }
.cc-plan ul { list-style: none; margin: 0 0 3px; padding: 0 0 0 calc(2ch + 1ch); }
.cc-pi { display: grid; grid-template-columns: 2ch minmax(0, 1fr); column-gap: 1ch; color: var(--cc-dim); }
.cc-pi .cc-pg { text-align: center; }
.cc-pi.cc-done .cc-pg { color: var(--cc-ok); } .cc-pi.cc-done { color: var(--cc-dim); }
.cc-pi.cc-active { color: var(--cc-ink); } .cc-pi.cc-active .cc-pg { color: var(--cc-acc); }
.cc-pi.cc-fail .cc-pg { color: var(--cc-bad); } .cc-pi.cc-fail { color: var(--cc-bad); }
.cc-pi.cc-skip { color: var(--cc-dim); opacity: .75; }
.cc-pi.cc-pending { color: var(--cc-txt); }
.cc-pt { min-width: 0; overflow-wrap: anywhere; }

/* the one live status line, like Claude Code's "✻ Composing… (41s · esc to interrupt)" */
.cc-live { display: grid; grid-template-columns: 2ch minmax(0, 1fr); column-gap: 1ch; margin-top: 6px; color: var(--cc-acc); }
.cc-live[hidden] { display: none; }
.cc-live .cc-g { color: var(--cc-acc); }
.cc-live-t { min-width: 0; overflow-wrap: anywhere; }
.cc-live-v { font-weight: 600; }
.cc-live-m { color: var(--cc-dim); font-variant-numeric: tabular-nums; }
.cc-vw { margin-left: 1.2ch; padding: 0 .5ch !important; border-radius: 4px; font-size: .9em; line-height: 1.4; color: var(--cc-dim) !important; opacity: .7; }
.cc-vw:hover { opacity: 1; color: var(--cc-fg, currentColor) !important; }
.cc-stop { color: var(--cc-dim) !important; text-decoration: underline; text-decoration-color: var(--cc-line); text-underline-offset: 3px; margin-left: 1ch; }
.cc-stop:hover { color: var(--cc-bad) !important; text-decoration-color: currentColor; } .cc-stop:disabled { opacity: .5; cursor: default; }
.cc-hint { grid-column: 2; color: var(--cc-dim); font-style: italic; min-width: 0; overflow-wrap: anywhere; }
.cc-hint[hidden] { display: none; }

/* the result line, once it is over */
.cc-foot { margin-top: 7px; padding-top: 5px; border-top: 1px dotted var(--cc-line); }
.cc-foot[hidden] { display: none; }
.cc-foot .cc-fl { font-weight: 600; color: var(--cc-ink); }
.cc-run.cc-s-ok .cc-foot .cc-fl { color: var(--cc-ok); }
.cc-run.cc-s-bad .cc-foot .cc-fl { color: var(--cc-bad); }
.cc-run.cc-s-stopped .cc-foot .cc-fl { color: var(--cc-dim); }
.cc-foot .cc-res { margin-left: 0; } .cc-run .cc-foot .cc-more { margin-left: 3ch; }
.cc-retry { margin-top: 3px; color: var(--cc-acc); text-decoration: underline; text-underline-offset: 3px; font-weight: 600; }
.cc-retry:hover { color: var(--cc-ink); } .cc-retry:disabled { opacity: .5; cursor: default; }
.cc-retry[hidden] { display: none; }

/* the technical text: one small "details" button per step, one global switch in the footer.
   Both are real buttons (keyboard + click); hover alone reveals nothing. */
.cc-run .cc-dt { color: var(--cc-dim); font-size: .9em; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; margin-left: .6ch; opacity: .85; }
.cc-run .cc-dt:hover, .cc-run .cc-dt[aria-expanded="true"] { color: var(--cc-ink); opacity: 1; }
.cc-run .cc-dt[hidden] { display: none; }
.cc-plan > .cc-dt { margin-left: calc(2ch + 1ch); }
.cc-tech { display: none; margin: 2px 0 3px calc(2ch + 1ch); padding: 3px 0 3px 1ch; border-left: 2px solid var(--cc-line); color: var(--cc-dim); white-space: pre-wrap; overflow-wrap: anywhere; min-width: 0; font-size: .92em; }
.cc-step.cc-tech-open > .cc-tech, .cc-plan.cc-tech-open > .cc-tech, .cc-tech-all .cc-tech { display: block; }
.cc-tech:empty { display: none !important; }
.cc-foot .cc-foot-tech { margin-left: 0; }
.cc-run .cc-tt { display: block; margin-top: 5px; color: var(--cc-dim); text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 3px; }
.cc-run .cc-tt:hover { color: var(--cc-ink); }
.cc-r.cc-link { color: var(--cc-acc); }

@media (prefers-reduced-motion: reduce) { .cc-step.cc-run > .cc-line .cc-g { animation: none; } }
`;
