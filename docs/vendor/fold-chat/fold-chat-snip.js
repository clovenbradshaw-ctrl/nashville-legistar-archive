// fold-chat-snip.js — snip, credit, point back. Pure: no DOM, no IO, no model.
//
// The Fold finds a recipe; it does not rewrite it. When a read page declares a recipe, the card the person
// sees is that page's OWN ingredients and steps, verbatim, under the creator's name, with the way back to
// the page (khora/verbatim-snip: the source's bytes stay the source's). The model never retypes it: it may
// introduce which sources were found and how they differ, and that is all (Constitution II.9 — the mouth may
// phrase, never originate; and the creator's work is cited, not laundered into the model's voice).
//
// TIPPING is a feature in development. The Fold pays, sends and takes nothing. The "Tip the creator" control finds how the
// creator's own site says to support or reach them (fold-chat-tip.js, defined in fold-chat-support-routes.json): a tip page
// the person opens and pays on themselves (a direct tip page can really receive money; the Fold is not in that exchange),
// else an email draft the person sends, else the creator's own website and profiles. The card says so plainly.
import { contactOfPassage } from "./fold-chat-tip.js";

/** What the tip prompt says. One string, so the wording is the same wherever it appears and a test can pin it. */
export const TIP = Object.freeze({
  prompt: "Like this recipe? Tip its creator.",
  status: "Tipping is a feature in development. The button finds how the creator's own site says to support them: their tip page, which you open and pay on yourself, else an email draft you send yourself, else their own website and profiles. The Fold sends nothing and takes nothing.",
});

// Declared, not measured (Constitution II.11): enough for any real recipe, small enough that a stored turn never
// balloons localStorage. A recipe over the cap is not cut mid-step: it keeps whole items up to the cap and says so.
export const SNIP_LIMITS = Object.freeze({ maxSnips: 3, maxItems: 60, maxChars: 8000 });

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

/** One recipe snip from a passage that carries `recipe` (see fold-chat-web.js recipeDataFromHtml). Null if none. */
export function snipOfPassage(p, { now = () => new Date().toISOString() } = {}) {
  const r = p && p.recipe;
  if (!r || !(r.ingredients?.length || r.steps?.length)) return null;
  const url = String(p.url || p.source || "");
  let chars = 0, truncated = false;
  const keep = (arr) => {
    const out = [];
    for (const x of arr || []) {
      if (out.length >= SNIP_LIMITS.maxItems || chars + x.length > SNIP_LIMITS.maxChars) { truncated = true; break; }
      out.push(x); chars += x.length;
    }
    return out;
  };
  const ingredients = keep(r.ingredients), steps = keep(r.steps);
  return {
    kind: "recipe",
    verbatim: true,                          // the page's own words; nothing here was written by a model
    title: r.name || String(p.ref || "").split(" — ").slice(1).join(" — ") || host(url),
    credit: { author: r.author || "", publisher: r.publisher || "", site: host(url) },
    url,
    yield: r.yield || "", prep: r.prep || "", cook: r.cook || "", total: r.total || "", calories: r.calories || "",
    ingredients, steps, truncated,
    // how the creator's own page says to reach them (kept here only, for the card's tip control; never sent anywhere)
    ...((c) => (c ? { contact: c } : {}))(contactOfPassage(p)),
    snippedAt: now(),
  };
}

/** The recipe snips of a turn's passages: one per page, in the order read, at most SNIP_LIMITS.maxSnips. */
export function recipeSnips(passages, opts = {}) {
  const out = [], seen = new Set();
  for (const p of passages || []) {
    const s = snipOfPassage(p, opts);
    if (!s || seen.has(s.url)) continue;
    seen.add(s.url); out.push(s);
    if (out.length >= SNIP_LIMITS.maxSnips) break;
  }
  return out;
}

/** "Recipe by Sally McKenney · Sally's Baking Addiction" — the creator first; never invent one the page did not give. */
export function creditLine(s) {
  const who = s?.credit?.author, pub = s?.credit?.publisher, site = s?.credit?.site || "";
  const place = pub && pub.toLowerCase() !== (who || "").toLowerCase() ? pub : site;
  if (who && place) return `Recipe by ${who} · ${place}`;
  if (who) return `Recipe by ${who}`;
  return place ? `Recipe from ${place}` : "Recipe";
}

/** One line of facts (yield and times) from what the page declared; empty parts are left out. */
export function metaLine(s) {
  return [s.yield ? "Makes " + s.yield : "", s.prep ? "Prep " + s.prep : "", s.cook ? "Cook " + s.cook : "", s.total ? "Total " + s.total : "", s.calories ? s.calories : ""].filter(Boolean).join(" · ");
}

/** What the model is told on a turn that shows recipe cards: it must NOT retype the recipe. */
export const CARD_PROMPT = "Recipe cards from the sources are shown to the person directly, in the sources' own words. Do NOT write out, retype, summarise step by step, or reword any recipe. Reply in one or two plain sentences: say which sources were found and, if they clearly differ (an ingredient, an amount, a time or a temperature), name the difference.";
