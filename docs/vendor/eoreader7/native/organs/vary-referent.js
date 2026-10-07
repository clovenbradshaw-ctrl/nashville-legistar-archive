// native/organs/vary-referent.js — the pathos-surface variation primitive.
//
// The two-surface law (2026-09-21): a paragraph has an EOT surface (pure
// logos + ethos — atoms pointing at referents, prettyName OR hashId) and a
// pathos NL surface (compelling prose). The pathos surface must not repeat
// the same referent surface in sentence after sentence — it varies with
// pronouns and synonyms. THIS organ is that variation, done mechanically:
// given a sentence and the atom's OWN end1 surface (which may be a proper
// noun with capitals — beyond variation.js::snipVariation's lowercase-noun
// opening heuristic), it swaps the referent's surface for a synonym/pronoun
// and preserves the label and everything after it.
//
// Why not reuse snipVariation: it rewrites a sentence OPENING by a lowercase
// noun-run heuristic that (a) mis-segments a capitalized referent ("the
// Analytical Engine can do" → noun run swallows "can do") and (b) DROPS the
// label. A referent-aware swap knows the referent's surface from the atom,
// so the label survives. Deterministic, free, typed — a mechanical EOT
// transformation (variation.js's own ladder: mechanical first, model only
// when no mechanical transform exists).
export function varyReferent(sentence, { referent = null, synonyms = [] } = {}) {
  const t = String(sentence ?? "").trim();
  if (!t) return null;
  if (!referent) return null;
  const forms = [referent];
  const alt = synonyms?.length ? [...synonyms] : [];
  const candidates = [...alt, ...forms].map((s) => String(s).trim()).filter(Boolean);

  // The referent's surface may appear at the start, optionally after an
  // article/connective ("the Analytical Engine", "The Analytical Engine").
  // Match it as a unit — the WHOLE referent, never a prefix of a longer word.
  const pattern = new RegExp(`^((?:The|A|An|This|That)\\s+)?(${esc(referent)})([,;:]?\\s+)`);
  const m = pattern.exec(t);
  if (!m) return null;

  const prefix = m[1] ?? "";
  const sep = m[3];
  const rest = t.slice(m[0].length);

  // Choose a DIFFERENT surface: a synonym (or the referent itself if a
  // synonym is the current opener and we need a plain referent pass). Prefer
  // a candidate that differs from the referent surface.
  const opener = (c) => {
    const clean = c.trim();
    const hasArticle = /^(the|a|an)\s+/i.test(clean);
    const head = hasArticle ? clean : `${prefix.trim() ? prefix.trim() + " " : "The "}${clean}`;
    return head.charAt(0).toUpperCase() + head.slice(1);
  };
  let chosen = null;
  for (const c of candidates) {
    if (c.toLowerCase() === referent.toLowerCase()) continue; // the swap must change the surface
    chosen = opener(c);
    break;
  }
  if (!chosen) return null;
  return `${chosen}${rest ? sep.replace(/[,;:]?\s+$/, " ") + rest : ""}`.replace(/\s{2,}/g, " ");
}

function esc(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}