// fold-chat-pagerview.js — draw several snips ONE PAGE AT A TIME (state and rules: fold-chat-pager.js). DOM only.
//
// Every page sits in the same grid cell, so the box is as tall as the tallest page and nothing jumps when you turn
// the page. The page not shown is hidden with visibility (still laid out, never focusable, never read out) and marked
// inert. Prev / Next (disabled at the ends: never wraps), a "2 of 5" counter, dots, Left/Right keys when the pager has
// focus, a swipe on touch. A single page is returned bare: no pager, no controls.
import { pager, stepOfKey, stepOfSwipe, pageIndexOf } from "./fold-chat-pager.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const TYPING = /^(input|textarea|select)$/i;

/**
 * @param pages  [{ key, n?, label?, node }]  label: what a dot's tooltip says ("S2 · site")
 * @param opts   { label }  the carousel's accessible name
 * @returns the node to append: `pages[0].node` itself when there is only one page, else the pager.
 */
export function mountPager(pages, { label = "Sources", onChange = null } = {}) {
  const list = (pages || []).filter((p) => p && p.node);
  if (list.length <= 1) return list[0] ? list[0].node : document.createDocumentFragment();
  let st = pager(list.length, 0);
  const root = el("div", "pager");
  root.tabIndex = 0;
  root.setAttribute("role", "group"); root.setAttribute("aria-roledescription", "carousel"); root.setAttribute("aria-label", label);
  const stage = el("div", "pager-stage");
  // ONE control bar, ABOVE the page (cards are tall: it is in view without scrolling past the recipe).
  const bars = ["top"].map((where) => {
    const bar = el("div", "pager-bar pager-bar-" + where);
    const prev = el("button", "pager-btn pager-prev", "\u2039 Prev"); prev.type = "button";
    const next = el("button", "pager-btn pager-next", "Next \u203a"); next.type = "button";
    const count = el("span", "pager-count");
    const dots = el("span", "pager-dots");
    prev.setAttribute("aria-label", "Previous source"); next.setAttribute("aria-label", "Next source");
    count.setAttribute("aria-live", "polite");
    const dotEls = list.map((p, i) => {
      const d = el("button", "pager-dot"); d.type = "button";
      d.title = p.label || (p.n ? p.n : `Source ${i + 1}`);
      d.setAttribute("aria-label", `Go to ${p.label || p.n || "source " + (i + 1)} (${i + 1} of ${list.length})`);
      d.append(el("span", "pager-dot-i"));
      d.addEventListener("click", () => go(st.go(i)));
      dots.append(d); return d;
    });
    prev.addEventListener("click", () => go(st.prev()));
    next.addEventListener("click", () => go(st.next()));
    bar.append(prev, count, next, dots);
    return { bar, prev, next, count, dotEls };
  });
  const slides = list.map((p, i) => {
    const s = el("div", "pager-page");
    s.setAttribute("role", "group"); s.setAttribute("aria-roledescription", "slide"); s.setAttribute("aria-label", `${i + 1} of ${list.length}`);
    s.dataset.key = p.key || ""; if (p.n) s.dataset.n = p.n;
    s.append(p.node); stage.append(s); return s;
  });
  root.append(bars[0].bar, stage);

  function paint() {
    slides.forEach((s, i) => { const on = i === st.index; s.classList.toggle("is-on", on); s.setAttribute("aria-hidden", on ? "false" : "true"); if (on) s.removeAttribute("inert"); else s.setAttribute("inert", ""); });
    for (const b of bars) {
      b.dotEls.forEach((d, i) => { d.classList.toggle("is-on", i === st.index); if (i === st.index) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
      b.prev.disabled = !st.canPrev; b.next.disabled = !st.canNext;
      b.count.textContent = st.label;
    }
    root.dataset.index = String(st.index); root.dataset.count = String(st.count);
    const cur = list[st.index]; if (cur && cur.n) root.dataset.n = cur.n; else delete root.dataset.n;
  }
  function go(s) { if (!s || s.index === st.index) return; st = s; paint(); if (typeof onChange === "function") onChange(st.index); }
  root.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || TYPING.test(e.target.tagName || "") || e.target.isContentEditable) return;
    const s = stepOfKey(e.key, st); if (!s) return;
    e.preventDefault(); go(s);
  });
  let down = null;
  stage.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") return; down = { x: e.clientX, y: e.clientY }; });
  stage.addEventListener("pointerup", (e) => { if (!down) return; const d = down; down = null; const s = stepOfSwipe(e.clientX - d.x, e.clientY - d.y, st); if (s) go(s); });
  stage.addEventListener("pointercancel", () => { down = null; });
  // the handle other code uses: a citation chip asks the pager to show its page
  root.pagerShow = (key) => { const i = typeof key === "number" ? key : pageIndexOf(list.map((p) => ({ key: p.key, n: p.n || "", url: p.url || "" })), key); if (i < 0) return false; go(st.go(i)); return true; };
  paint();
  return root;
}

/** A citation chip's jump: show the page that `key` (an S# or a page address) names, in the pager inside `scope`. */
export function jumpToSnip(scope, key) {
  const root = scope && scope.querySelectorAll ? [...scope.querySelectorAll(".pager")].find((p) => p.pagerShow && p.pagerShow(key)) : null;
  if (!root) return false;
  try { root.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } catch { /* scrolling is a courtesy */ }
  return true;
}
