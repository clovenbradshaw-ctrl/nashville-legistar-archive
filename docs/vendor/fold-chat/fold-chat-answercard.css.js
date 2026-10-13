// fold-chat-answercard.css.js — the answer card's look (see fold-chat-answercard.js), injected once as
// <style id="fold-answercard-style">. Everything is under `.answer-card`, so it cannot collide with the page's rules.
// Colours are the app's own variables (index.html :root, light AND dark: --ink --ink2 --mut --dim --line2 --side2 --ag
// --warn), each with a calm fallback for a bare page, so the theme switch needs no rules of its own here.
// The `.gap` block is the app's existing one (index.html `.gap`, `.gap-h`, `.gap-mark`, `.gap-kind`, `.gap-sub`,
// `.gap-text`): it is reused, not redefined; this file only places it.
// Nothing here is conveyed by colour alone: the answer is bold, the matched words are bold AND highlighted, the
// "could not check" lines carry a word, the disclosure has a caret.
export const ANSWERCARD_STYLE_ID = "fold-answercard-style";
export const ANSWERCARD_CSS = `
.answer-card { display: flex; flex-direction: column; gap: 8px; min-width: 0; max-width: 100%; margin: 2px 0 8px; color: var(--ink, #141416); }
.answer-card .answer-text { margin: 0; font-size: 17px; line-height: 1.45; overflow-wrap: anywhere; }
.answer-card .answer-text strong { font-weight: 700; }
.answer-card .answer-quote { margin: 0; padding: 2px 0 2px 11px; border-left: 3px solid var(--line2, #cfcfd7); color: var(--ink2, #44444e); font-size: var(--fs-sm, 13.5px); line-height: 1.55; overflow-wrap: anywhere; }
.answer-card .answer-quote mark { background: color-mix(in srgb, var(--ag, #0d7a70) 20%, transparent); color: inherit; font-weight: 600; border-radius: 3px; padding: 0 1px; }
.answer-card .answer-cite { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; font-size: var(--fs-xs, 12px); color: var(--mut, #5f5f6b); min-width: 0; }
.answer-card .answer-cite-title { overflow-wrap: anywhere; }
.answer-card .answer-path, .answer-card .answer-pointers { flex-basis: 100%; overflow-wrap: anywhere; }
.answer-card .answer-pointers a { margin-right: 8px; }
.answer-card .answer-cite a { color: var(--ink2, #44444e); text-decoration: underline; text-underline-offset: 2px; text-decoration-color: var(--line2, #cfcfd7); }
.answer-card .answer-cite a:hover { color: var(--ink, #141416); text-decoration-color: currentColor; }
.answer-card .answer-cite a:focus-visible, .answer-card .answer-trace > summary:focus-visible { outline: 2px solid var(--ag, #0d7a70); outline-offset: 2px; border-radius: 3px; }
.answer-card .answer-checked, .answer-card .answer-unmeasured { font-size: var(--fs-xs, 12px); line-height: 1.5; color: var(--mut, #5f5f6b); overflow-wrap: anywhere; }
.answer-card .answer-unmeasured { color: var(--warn, #a04a07); }
.answer-card .answer-contest { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.answer-card .answer-contest-k { margin: 0; font: 700 10.5px/1.5 Inter, system-ui, sans-serif; letter-spacing: .07em; text-transform: uppercase; color: var(--mut, #5f5f6b); }
.answer-card .contest-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 10px; min-width: 0; }
.answer-card .contest-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 8px 10px 9px; border: 1px solid var(--line2, #cfcfd7); border-radius: var(--r-md, 10px); background: var(--side2, #f1f1f4); }
.answer-card .contest-col .answer-quote { background: none; }
.answer-card .contest-filler { font-size: 15px; font-weight: 700; overflow-wrap: anywhere; }
.answer-card > .gap { margin: 0; }
.answer-card .gap .answer-quote { margin-top: 6px; }
.answer-card .gap .answer-cite { margin-top: 4px; }
.answer-card .answer-trace { font-size: var(--fs-xs, 12px); color: var(--mut, #5f5f6b); }
.answer-card .answer-trace > summary { cursor: pointer; list-style: none; display: inline-block; padding: 2px 0; color: var(--mut, #5f5f6b); }
.answer-card .answer-trace > summary::-webkit-details-marker { display: none; }
.answer-card .answer-trace > summary::before { content: "\\25B8  "; }
.answer-card .answer-trace[open] > summary::before { content: "\\25BE  "; }
.answer-card .answer-trace > summary:hover { color: var(--ink, #141416); }
.answer-card .trace-list { margin: 4px 0 0; padding-left: 22px; display: flex; flex-direction: column; gap: 4px; }
.answer-card .trace-line { line-height: 1.5; color: var(--ink2, #44444e); overflow-wrap: anywhere; }
.answer-card .trace-line::marker { color: var(--dim, #666673); }
.answer-card .trace-detail, .answer-card .trace-result, .answer-card .trace-searched { display: block; color: var(--mut, #5f5f6b); }
.answer-card .trace-unmeasured { font-weight: 600; color: var(--warn, #a04a07); }
.answer-card .trace-line.is-unmeasured { border-left: 2px dashed var(--warn, #a04a07); margin-left: -10px; padding-left: 8px; }
`;
