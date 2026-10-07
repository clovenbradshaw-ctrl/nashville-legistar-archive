// aposiopesis.js — Aposiopesis, the archon of what trails off: names every
// sentence a source cuts short with a trailing ellipsis, and separates the
// ones a fuller sentence elsewhere completes from the ones nothing
// completes.
//
// Handle: ἀποσιώπησις (aposiopesis, "becoming silent") — the classical
// rhetorical figure for an utterance broken off before its end. Here the
// break is never rhetorical: it is a fetched page's own preview convention
// (a search engine's snippet ellipsis, a "read more" caption, any source
// that truncates its own text) — and this archon's one job is to say,
// honestly, which sentences trail off and whether anything elsewhere
// finishes them.
//
// The distinction, found live (fact-block.js's own header, P181, "a
// truncated web-page preview and its own fuller restatement are the same
// text, not two facts"): a truncated preview and its own fuller
// restatement elsewhere in the SAME material are the same fact wearing two
// shapes — DOMINATED, and safe to drop, because nothing is lost. A
// truncated preview with nothing to complete it is DIFFERENT: dropping it
// would lose real information no duplicate justifies losing (pinned by
// fact-block.test.mjs's own "an ellipsis with nothing to complete it
// survives untouched" case). This archon draws that one line and reports
// BOTH sides, because P181's own fix only ever asked the first question —
// live traffic shows the second case is the common one: an ordinary
// DuckDuckGo search-results digest routinely carries several
// trailing-ellipsis snippets with nothing in the same material to complete
// them, and every one of those "…" markers reaches the model's own context
// exactly as before P181, unflagged, because there was never a duplicate
// to catch. Dropping them would be a second bug (real, unique information
// lost); this organ's job is only to let a caller DISCLOSE that gap
// honestly instead of staying silent about it.
//
// PURE. `splitSentences` and `normalize` are injected (cast.js pattern) so
// this organ shares exactly one sentence model and one dedup-key shape
// with whatever else the caller already uses — never a second, drifting
// copy of either.

const TRAILING_ELLIPSIS_RE = /(?:…|\.\.\.)\s*$/;

export function makeAposiopesis({ splitSentences, normalize } = {}) {
  if (typeof splitSentences !== "function" || typeof normalize !== "function") {
    throw new TypeError("makeAposiopesis: splitSentences and normalize are injected — this organ has no sentence model of its own");
  }

  /**
   * find(passages) → { dominated, lone }
   *
   * `dominated` — a Set of normalized text, one entry per truncated
   * sentence for which some OTHER, longer sentence anywhere in `passages`
   * starts with it byte-for-byte (`subsumes`'s own shape, fact-block.js,
   * applied to a whole sentence instead of just a triple's object).
   * Order-independent: computed once over every sentence in every
   * passage, since a search-result digest is not reliably fetched before
   * or after the full page it duplicates.
   *
   * `lone` — every OTHER trailing-ellipsis sentence: truncated, and
   * nothing in this material completes it. Every caller keeps these whole
   * (dropping one loses real, unique information) — reported here so a
   * caller can name the gap ("N passage(s) offered a preview this
   * material never completes") instead of letting a bare "…" pass through
   * silently, as though the material were whole.
   */
  function find(passages) {
    const seen = [];
    for (const p of passages ?? []) {
      const text = String(p?.text ?? "");
      if (!text.trim()) continue;
      for (const s of splitSentences(text)) {
        const norm = normalize(s);
        if (norm) seen.push({ raw: s, norm, source: p?.ref ?? null });
      }
    }
    const dominated = new Set();
    const lone = [];
    for (const entry of seen) {
      if (!TRAILING_ELLIPSIS_RE.test(String(entry.raw).trim())) continue;
      const completed = seen.some(
        (o) => o.norm !== entry.norm && o.norm.length > entry.norm.length && o.norm.startsWith(entry.norm),
      );
      if (completed) dominated.add(entry.norm);
      else lone.push({ text: entry.raw, source: entry.source });
    }
    return { dominated, lone };
  }

  return { find };
}
