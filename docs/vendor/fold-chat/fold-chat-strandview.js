// fold-chat-strandview.js — draw a SOURCES-ONLY answer (see fold-chat-strand.js). DOM only; textContent only,
// so a page's own words can never become markup. One continuous reading column: the sources' passages,
// verbatim, thin rules between them, and on a quiet line under each the S# chip, who it is from, and the way
// back to the page. The only words that are not the sources' are those labels ("from <site>").
import { renderSnips } from "./fold-chat-snipview.js";
import { creditText } from "./fold-chat-strand.js";
import { tipControl } from "./fold-chat-tipview.js";
import { mountPager } from "./fold-chat-pagerview.js";
import { pagesOf } from "./fold-chat-pager.js";
import { pathWords } from "./fold-chat-origin.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const KIND = { lead: "lead", recipe: "recipe", howto: "how-to", faq: "FAQ", qa: "accepted answer", pointer: "pointer" };

/** One page: ONE source's passages, verbatim, then the quiet line (S# chip, credit, open, tip). */
function pageOf(group, i, toast) {
  const first = group.snips[0];
  const recipe = group.snips.find((s) => s.kind === "recipe" && s.card);
  const one = el("article", "strand-snip" + (recipe ? " strand-recipe" : ""));
  if (recipe) {
    // the structured card is the source's own recipe; draw it with the shared card
    const holder = el("div", "strand-card");
    renderSnips(holder, [recipe.card], { toast });
    one.append(holder);
  } else {
    const drawText = (s, into) => {
      const p = el("div", "strand-text");
      if (s.ellipsisBefore) p.append(el("span", "strand-el", "\u2026 "));
      p.append(document.createTextNode(String(s.text)));
      if (s.ellipsisAfter) p.append(el("span", "strand-el", " \u2026"));
      into.append(p);
    };
    // THE SMALLEST SPAN FIRST (fold-chat-answerspan.js): the clause that answers, large; the sentence it sits in is one tap away, and everything else this page
    // offered is behind "more from this page" — never the whole group by default. Words are textContent only, as everywhere in this view.
    const span = group.snips.find((s) => s.kind === "span");
    if (span) {
      const a = el("div", "strand-answer", String(span.text));
      one.append(a);
      if (span.context && span.context.text && String(span.context.text).trim() !== String(span.text).trim()) {
        const ctx = el("div", "strand-context", String(span.context.text));
        // THE SPAN IS NOT TRUSTED ALONE (measured: its confidence separates right from wrong only weakly, AUC ~0.75 on the held asks): below SURE it opens with its
        // sentence showing, unless a second, independent page carries the same figure/date/name (span.agreement >= 1)
        const sure = (span.confidence ?? 0) >= 0.9 || (span.agreement || 0) >= 1;
        ctx.hidden = sure;
        const btn = el("button", "strand-tap", "the sentence"); btn.type = "button"; btn.setAttribute("aria-expanded", String(!sure));
        btn.addEventListener("click", () => { ctx.hidden = !ctx.hidden; btn.setAttribute("aria-expanded", String(!ctx.hidden)); });
        one.append(btn, ctx);
      }
      const more = group.snips.filter((s) => s !== span && s.more);
      if (more.length) {
        const d = el("details", "strand-more"); d.append(el("summary", "", "more from this page"));
        for (const s of more) drawText(s, d);
        one.append(d);
      }
    } else for (const s of group.snips) drawText(s, one);
  }
  // THE PATH: where the claim was found and how it reached this page (an origin), or where an encyclopedia's lead was found and the pages it
  // points at (a pointer: each a link to fetch; the encyclopedia is a hop of the path, never the source)
  const pointerSnip = group.snips.find((s) => s.kind === "pointer");
  if (pointerSnip && Array.isArray(pointerSnip.pointers) && pointerSnip.pointers.length) {
    const pl = el("div", "strand-pointers");
    pl.append(el("span", "strand-via-k", "it points to: "));
    pointerSnip.pointers.slice(0, 6).forEach((pt, k) => {
      if (!/^https?:\/\//i.test(String(pt.url || ""))) return;
      if (k) pl.append(" ");
      const a = el("a", "", (pt.n ? `[${pt.n}] ` : "") + String(pt.label || pt.url));
      a.href = pt.url; a.target = "_blank"; a.rel = "noopener noreferrer";
      pl.append(a);
    });
    one.append(pl);
  }
  const via = (group.snips.find((s) => s.via && s.via.status === "origin") || pointerSnip || {}).via;
  const hops = via ? pathWords(via) : [];
  if (hops.length) {
    const pv = el("div", "strand-via");
    pv.append(el("span", "strand-via-k", pointerSnip ? "found on " : "found via "));
    (pointerSnip ? hops.slice(0, 1) : hops).forEach((h, k) => {
      if (k) pv.append(" \u2192 ");
      if (h.url) { const a = el("a", "", h.text); a.href = h.url; a.target = "_blank"; a.rel = "noopener noreferrer"; pv.append(a); } else pv.append(h.text);
    });
    one.append(pv);
  }
  const meta = el("div", "strand-meta");
  const chip = el("span", "src-n", first.n || "S" + (i + 1));
  chip.title = (first.n || "S" + (i + 1)) + " \u00b7 " + (first.title || first.site || "source");
  meta.append(chip);
  meta.append(el("span", "strand-credit", creditText(first)));
  const src = first.source;
  if (src && /^https?:\/\//i.test(src) && !pointerSnip) {
    const a = el("a", "strand-open", "open \u2197");
    a.href = src; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", "Open " + (first.title || first.site || "the source") + " in a new tab");
    meta.append(a);
  }
  const kinds = [...new Set(group.snips.map((s) => s.kind).filter((k) => k && k !== "passage"))];
  for (const k of kinds) meta.append(el("span", "strand-kind", KIND[k] || k));
  // a creator can be tipped from here (the recipe card carries its own control; an encyclopedia has no one to tip)
  if (!recipe && src && /^https?:\/\//i.test(src) && !/(^|\.)wikipedia\.org$/i.test(first.site || "")) {
    const contact = (group.snips.find((s) => s.contact) || {}).contact;
    const creator = first.credit && first.credit !== first.site ? first.credit : "";
    meta.append(tipControl({ url: src, title: first.title || "", creator, site: first.site || "", contact }, { toast, quiet: true }));
  }
  one.append(meta);
  return one;
}

/** Draw the strand under `body`. Draws nothing when there are no snips. Several sources are paged, one at a time. */
export function renderStrand(body, snips, { toast = null, gap = null } = {}) {
  const list = (Array.isArray(snips) ? snips : []).filter((s) => s && String(s.text || "").trim());
  if (!list.length) return;
  const col = el("section", "strand");
  col.setAttribute("aria-label", "Answer from the sources, unchanged");
  col.append(el("div", "strand-k", "from the sources, unchanged \u00b7 no model wrote this"));
  // no span cleared the threshold (strand.minimalGap, passed in by the chat): say so in the typed words, then the passages that came closest, as before
  if (gap && gap.text) col.append(el("div", "strand-gap", String(gap.text) + " \u00b7 the closest passages are below"));
  const pages = pagesOf(list).map((g, i) => ({ key: g.key, n: g.n, url: g.url, label: (g.n || "S" + (i + 1)) + " \u00b7 " + (g.snips[0].title || g.snips[0].site || "source"), node: pageOf(g, i, toast) }));
  col.append(mountPager(pages, { label: "Sources" }));
  body.append(col);
}
