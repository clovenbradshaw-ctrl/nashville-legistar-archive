// hunt.js — STAGE 5: HUNT / GROUND (ethos). AUTHORITY EARNED BEFORE A WORD
// IS DRAFTED (2026-09-22).
//
// The user: "it hunts for content to fill the void, the grounding/ethos …
// the admitted material becomes the ground, fetched material never outranks
// it." The operator's material is the ground by being handed over — tier 0.
// What SURF brought back is a CANDIDATE until it earns admission, paragraph
// by paragraph, by carrying the void: a being of the subject (the referent
// organ over the operator's material, when it has a subject) or, when the
// ask names a subject and the operator handed nothing over, a content word
// of the ask's own subject phrase. A paragraph that carries neither — a
// site's furniture, a page about something else — is refused, and the
// refusal is written. Admitted paragraphs are tier 1: they join the ground
// AFTER the operator's material, and where a fetched statement repeats an
// operator statement, the operator's stands (arrange.js's duplicate rule
// reads the tier). Exemplar pages (what the form IS) are never ground:
// stage 4 read them for the shape and they are named here as such.
//
// No model call. No threshold: admission is carrying-or-not, the majority
// rule is the subject's own (referents.js), and a source with no admitted
// paragraph is refused whole.

import { draftWords } from "./eot-draft.js";
import { isFunctionWord } from "./pos-prior.js";

export const HUNT_SCHEMA = "EOHunt@1";

const paragraphsOf = (text) => String(text ?? "").split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).filter((p) => p);

/**
 * huntGround({ operator, surfed, task, topic, R, subject }) → EOHunt@1
 *   operator  { id, text }   the material handed over (tier 0); text may be ""
 *   surfed    EOSurf@1 | null
 *   R         the referent resolver over the operator's material, or null
 *   subject   Set of subject referent ids (draft.subjectRefs), or empty
 *   topic     the ask's subject phrase, or null
 */
export function huntGround({ operator = { id: "ground", text: "" }, surfed = null, topic = null, R = null, subject = new Set() } = {}) {
  const sources = [];
  const opText = String(operator.text ?? "");
  if (opText.trim()) sources.push({ id: operator.id, tier: 0, text: opText, why: "the operator's material: ground by being handed over", paragraphs: paragraphsOf(opText).length, admitted: paragraphsOf(opText).length });
  const hasSubject = R && subject && subject.size > 0;
  const topicWords = topic ? [...new Set(draftWords(topic).filter((w) => !isFunctionWord(w)))] : [];
  const carries = (par) => {
    if (hasSubject) { const ids = R.resolveText(par); for (const id of subject) if (ids.has(id)) return `names ${R.represent(id)}`; return null; }
    if (topicWords.length) { const ws = new Set(draftWords(par)); const hit = topicWords.find((w) => ws.has(w)); return hit ? `carries "${hit}"` : null; }
    return null;
  };
  const test = hasSubject ? "a paragraph is admitted when it names a being of the subject (referents.js over the operator's material)" : topicWords.length ? `a paragraph is admitted when it carries a word of the ask's subject ("${topicWords.join(", ")}")` : "no subject and no topic: nothing fetched can earn admission";
  const refused = [];
  let exemplars = 0;
  // FETCHED MATERIAL NEVER OUTRANKS — NOR OUTWEIGHS. Measured live 2026-09-22
  // (nine-live-2): three admitted pages brought 68 paragraphs against the
  // operator's 8, a fetched heading ("Nashville & History") became the
  // thesis, and the mouth voted 71 times over the swamp. The operator's own
  // extent is the bound: at most as many fetched paragraphs as the operator
  // handed over, the ones naming the most beings of the subject first. A
  // heading or a bare list item — no sentence ending in it — is not a
  // statement and earns nothing (the same seam eot-draft draws).
  const opParagraphs = paragraphsOf(opText).length;
  // The operator's shortest paragraph is the least a paragraph of this ground
  // can be (measured live 2026-09-22: a hatnote, "For other uses, see
  // Cumberland River (disambiguation).", names the subject, ends in a period,
  // and was admitted and selected into the skeleton). Below it, a fetched
  // paragraph is a fragment, not a paragraph of this ground.
  const wordsIn = (p) => p.split(/\s+/).filter(Boolean).length;
  // …measured over the operator's paragraphs that ARE paragraphs (a sentence
  // in them): the Cumberland fixture opens on a six-word heading, and the
  // eight-word hatnote walked in under it (nine-sonnet-2).
  const opSentenced = paragraphsOf(opText).filter((p) => /[.!?]["')\]]?(\s|$)/.test(p));
  const least = opSentenced.length ? Math.min(...opSentenced.map(wordsIn)) : 0;
  const subjectCount = (par) => (hasSubject ? [...subject].filter((id) => R.resolveText(par).has(id)).length : 1);
  const candidates = [];
  const perSource = new Map();
  for (const s of surfed?.sources ?? []) {
    if (s.status !== "fetched" || !s.text) continue;
    if (!(s.hunts ?? [s.hunt]).includes("material")) { exemplars++; continue; }
    const pars = paragraphsOf(s.text).map((p) => p.replace(/^[-•*]\s+/, ""));
    const sentenced = pars.filter((p) => /[.!?]["')\]]?(\s|$)/.test(p) && wordsIn(p) >= least);
    const kept = sentenced.map((p) => ({ p, why: carries(p) })).filter((x) => x.why).map((x) => ({ ...x, source: s, score: subjectCount(x.p), order: candidates.length }));
    perSource.set(s.url, { s, pars: pars.length, sentenced: sentenced.length, kept });
    candidates.push(...kept);
  }
  const bound = opParagraphs > 0 ? opParagraphs : null;
  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.order - b.order);
  const admittedSet = new Set(bound != null ? ranked.slice(0, bound) : ranked);
  for (const { s, pars, sentenced, kept } of perSource.values()) {
    const mine = kept.filter((k) => admittedSet.has(k));
    if (!kept.length) { refused.push({ id: s.host, url: s.url, why: `${pars} paragraph(s), ${sentenced} with a sentence and at least the operator's shortest paragraph's ${least} word(s), none ${hasSubject ? "names a being of the subject" : topicWords.length ? "carries a word of the subject" : "can be tested"}` }); continue; }
    if (!mine.length) { refused.push({ id: s.host, url: s.url, why: `${kept.length} of ${pars} paragraph(s) carried the subject, but the operator's own extent (${bound} paragraph(s)) was filled by paragraphs naming more of it` }); continue; }
    sources.push({ id: s.host, tier: 1, url: s.url, text: mine.map((x) => x.p).join("\n\n"), why: `${mine.length} of ${pars} paragraph(s) earned admission (e.g. ${mine[0].why})${kept.length > mine.length ? `; ${kept.length - mine.length} more carried the subject but the operator's extent was filled` : ""}`, paragraphs: pars, admitted: mine.length });
  }
  // The combined ground: tier 0 first, then tier 1 in surf order; every
  // source's byte range recorded so a span can be traced to its source.
  let ground = "", map = [];
  for (const s of sources) {
    if (ground) ground += "\n\n";
    const start = ground.length;
    ground += s.text;
    map.push({ id: s.id, tier: s.tier, url: s.url ?? null, start, end: ground.length });
  }
  const admitted = sources.filter((s) => s.tier === 1);
  return {
    schema: HUNT_SCHEMA, sources, map, ground, admitted: admitted.length, refused, exemplars, test,
    bound,
    basis: `${test}; ${admitted.length} fetched source(s) admitted (tier 1, after the operator's material${bound != null ? `, at most ${bound} paragraph(s) — the operator's own extent` : ", unbounded: nothing was handed over"}), ${refused.length} refused${exemplars ? `, ${exemplars} exemplar page(s) read for the shape only` : ""}${!opText.trim() && !admitted.length ? " — NO GROUND: nothing handed over, nothing earned" : ""}`,
  };
}

export function huntLines(h) {
  const out = [];
  for (const s of h.sources) out.push(`tier ${s.tier}  ${String(s.id).padEnd(28)} ${String(s.admitted).padStart(3)}/${String(s.paragraphs).padEnd(3)} paragraph(s)  ${s.url ?? ""}   ← ${s.why}`);
  for (const r of h.refused) out.push(`refused ${String(r.id).padEnd(28)} ${r.url}   ← ${r.why}`);
  return out;
}

/** Which source a byte offset of the combined ground falls in. */
export function sourceAt(map, offset) {
  return map.find((m) => offset >= m.start && offset < m.end) ?? null;
}
