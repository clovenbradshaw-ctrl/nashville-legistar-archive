// fold-chat-pager.js — paging state for several snips, and which snips are ONE page. Pure: no DOM.
//
// A turn can return several snips (a recipe from each of three sites; passages from five sources). They are shown
// ONE PAGE AT A TIME, with Prev / Next, a "2 of 5" counter and dots; it never wraps (the ends disable the button).
// A page is a SOURCE: two passages of the same page are one page with two passages, never two pages that look alike
// (the last turn showed S2 twice). Pure so the rules are tested without a browser; the hand is fold-chat-pagerview.js.

const keyOf = (s, i) => String(s && (s.n || s.url || s.source) || "p" + i);
const urlKey = (u) => String(u || "").replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();

/**
 * Group snips into pages, one per SOURCE (same S# or same page address), in the order first seen.
 * Returns [{ key, n, url, snips:[…] }]. Snips with neither an id nor an address are each their own page.
 */
export function pagesOf(snips) {
  const pages = [], byN = new Map(), byUrl = new Map();
  (Array.isArray(snips) ? snips : []).forEach((s, i) => {
    if (!s) return;
    const u = urlKey(s.url || s.source);
    let page = (s.n && byN.get(s.n)) || (u && byUrl.get(u)) || null;
    if (!page) { page = { key: keyOf(s, i), n: s.n || "", url: s.url || s.source || "", snips: [] }; pages.push(page); }
    page.snips.push(s);
    if (s.n) byN.set(s.n, page);
    if (u) byUrl.set(u, page);
  });
  return pages;
}

/** The page a key names: an S# ("S2") or a page address (a citation chip's link). -1 when none. */
export function pageIndexOf(pages, key) {
  const k = String(key || "").trim();
  if (!k) return -1;
  const u = urlKey(k);
  return (pages || []).findIndex((p) => p.n === k || p.key === k || (u && urlKey(p.url) === u));
}

/** The paging state: { index, count, canPrev, canNext, label, dots } — a value; every move returns a new one. Never wraps. */
export function pager(count, index = 0) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const i = n ? Math.min(n - 1, Math.max(0, Math.floor(Number(index) || 0))) : 0;
  const state = {
    index: i, count: n,
    paged: n > 1,                         // a single page shows no pager
    canPrev: i > 0, canNext: i < n - 1,
    label: n ? `${i + 1} of ${n}` : "",
    go: (j) => pager(n, j),
    next: () => pager(n, i + 1),
    prev: () => pager(n, i - 1),
    first: () => pager(n, 0),
    last: () => pager(n, n - 1),
  };
  return Object.freeze(state);
}

/** A key press as a move: ArrowRight/ArrowDown-free — only Left/Right (and Home/End); anything else is not ours. */
export function stepOfKey(key, state) {
  if (key === "ArrowRight") return state.next();
  if (key === "ArrowLeft") return state.prev();
  if (key === "Home") return state.first();
  if (key === "End") return state.last();
  return null;
}

/** A horizontal swipe as a move: a clear sideways drag (>= `min` px, mostly horizontal) goes forward or back. */
export function stepOfSwipe(dx, dy, state, min = 40) {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? state.next() : state.prev();
}
