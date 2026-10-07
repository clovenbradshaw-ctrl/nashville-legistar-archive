// archon-rules.js — WHAT THE ARCHONS WERE TAUGHT (2026-09-21).
//
// The revision grid names nine editors, each a cell of ethos/logos/pathos ×
// macro/meso/micro. Until today six of the nine had `probe: null` — a charge
// with no mechanics, so the grid could name what Clark or Kidder cares about
// but never catch it. Every one of the three pathos archons was among them.
// Meanwhile the generation pipeline was growing its own checks beside the grid
// — a tic counter, a restatement fold, a turn test — which is the wrong home
// for them: the user's direction was "the mechanics itself, our pathos
// archons, are meant to catch this… if you have new rules for the archons,
// teach them."
//
// So each rule measured on the live Cumberland runs is taught here to the
// archon whose charge it serves, and the grid's cells call these probes.
// Every finding names its editor, and the revision it licenses.
//
// A probe is `(text, ctx) → findings`. With only `text` (the old composition
// path) a probe does what it can on that text and nothing more. With `ctx` —
// { piece, draft, ground, task } — it reads the whole piece against the EOT
// draft. Nothing here calls a model or edits anything.
//
// STILL UNTAUGHT, NAMED RATHER THAN FAKED: Gornick (macro.pathos, what the
// piece is emotionally about underneath its subject) needs the measured
// surprise-tension-release curve, which only a reading's fold supplies; Orlean
// (meso.pathos, sensory grounding and human stakes) has no measurement here
// that would not be a word list.

import { pacingGrade } from "../organs/pacing.js";
import { draftWords, drawnParts, draftStem } from "./eot-draft.js";
import { anchorsFor, carries } from "./prosify.js";
import { ticsOf, takesUp } from "./finish.js";
import { segmentSentences } from "./admission.js";
import { spliceCeiling, detectSplice } from "./restatement.js";
import { isMetaSentence } from "./referent-verify.js";
import { readStance } from "../organs/stance.js";
import { buildReferents } from "./referents.js";

const partsOf = (ctx) => (Array.isArray(ctx?.piece) ? ctx.piece : null);
const sentencesOf = (part) => (part.pieces ?? []).map((pc) => pc.text);

/** ZINSSER (micro.ethos, strip the inflated diction that oversells) — TAUGHT:
 *  a TIC is a word neither the material nor the ask ever uses that the prose
 *  uses more than once ("bustling" three times in one part, "testament",
 *  "vital artery"). Measured on the piece, so it catches this mouth's habits
 *  in this piece rather than a fixed list's. Licenses a plain rewrite of each
 *  sentence holding one, kept only if its facts' anchors survive. */
export function zinsserTics(text, ctx = {}) {
  const piece = partsOf(ctx);
  if (!piece) return [];
  const tics = ticsOf(piece, { ground: ctx.ground ?? "", task: ctx.task ?? "" });
  const out = [];
  for (const p of piece) for (const s of sentencesOf(p)) {
    const words = [...new Set(draftWords(s).filter((w) => tics.has(w)))];
    if (words.length) out.push({ kind: "tic", part: p.id, sentence: s, words, detail: `"${words.join('", "')}" — words the material never uses, repeated by the prose`, licenses: "rewrite" });
  }
  return out;
}

/** LISH / KLINKENBORG (micro.pathos, cut to charge; cadence) — TAUGHT: Murch's
 *  flatline, applied per passage. A passage whose sentence lengths barely vary
 *  and never blink has no cadence. Reported, not revised: telling the mouth to
 *  "vary its rhythm" would be asking it to mimic a property in language, which
 *  the standing rule forbids. The finding is the record. */
export function klinkenborgCadence(text, ctx = {}) {
  const piece = partsOf(ctx);
  const passages = piece ? piece.map((p) => ({ part: p.id, text: sentencesOf(p).join(" ") })) : [{ part: null, text: String(text ?? "") }];
  const out = [];
  for (const { part, text: t } of passages) {
    if (!t.trim()) continue;
    const g = pacingGrade(t);
    if (g.flatline) out.push({ kind: "flat_cadence", part, detail: g.basis, licenses: null });
  }
  return out;
}

/** Does `text` name one of a statement's OWN distinguishing marks — one of
 *  its numbers, or a being it names (by word, or, with a referent resolver,
 *  by identity) — without being asked to carry ALL of them the way carries()
 *  demands? The same test carries() runs on a statement's anchor, loosened
 *  from EVERY mark to ANY ONE: a sentence sharing even one of a statement's
 *  own numbers or names is echoing that statement, not introducing ground of
 *  its own. anchorsFor() has already stripped the piece's subject beings out
 *  of every anchor, so a shared subject ("Nashville", "Cumberland") can never
 *  trigger this on its own — but a two-word name can still leave a lone
 *  generic word behind once its subject half is stripped ("Cumberland River"
 *  → "river"), and that word alone recurs in nearly every sentence of a river
 *  essay. anchor.own is already the measured, not-hand-set answer to which
 *  words are this ONE statement's alone (df===1 across every point of the
 *  draft) — a name word only counts as an echo when it is also there. */
function anchorEchoed(anchor, text) {
  if (!anchor) return false;
  if (anchor.numbers.some((n) => text.includes(n))) return true;
  if (anchor.refs && anchor.R) {
    const named = anchor.R.resolveText(text);
    return anchor.refs.some((id) => named.has(id));
  }
  const words = new Set(draftWords(text));
  const own = new Set(anchor.own);
  return anchor.names.some((alts) => alts.some((w) => own.has(w) && words.has(w)));
}

/** CLARK (meso.logos, one job per paragraph; transitions that earn their
 *  keep) — TAUGHT two rules. RESTATEMENT: a sentence that carries no statement
 *  of the draft and brings no grounded word the piece has not already said has
 *  no job — licenses a fold. A sentence that instead echoes one of an
 *  ALREADY-CARRIED statement's own numbers or names has no job either, even
 *  when it also uses a grounded word from elsewhere in the material the piece
 *  has not yet said — measured live (documents/layer-resolution-check-3, part
 *  a3): a connective sentence naming "Cheatham Dam" sat beside the floor that
 *  had just carried it, kept only because it also used "water" and "built",
 *  words the piece had not literally said before but that named no fact of
 *  their own. TRANSITION: a part whose opening takes nothing up from where the
 *  last part closed has an unearned transition — licenses one bridging
 *  sentence, kept only if it takes up the last part and hands on to this
 *  one. */
export function clarkJobsAndTransitions(text, ctx = {}) {
  const piece = partsOf(ctx);
  if (!piece || !ctx.draft) return [];
  const known = new Set(draftWords(ctx.ground ?? ""));
  const anchors = anchorsFor(ctx.draft);
  const subject = subjectOf(ctx.draft);
  const said = new Set();
  const carriedBefore = new Set();
  const out = [];
  for (const p of piece) for (const pc of p.pieces ?? []) {
    const matter = [...new Set(draftWords(pc.text))].filter((w) => known.has(w));
    const restatesSaid = !pc.carries.length && matter.length && matter.every((w) => said.has(w));
    const echoesCarried = !pc.carries.length && [...carriedBefore].some((id) => anchorEchoed(anchors.get(id), pc.text));
    if (restatesSaid || echoesCarried) {
      const detail = restatesSaid ? "carries no statement and says nothing the piece has not already said" : "carries no statement and echoes, by its own name or number, a statement the piece has already carried in full";
      out.push({ kind: "restatement", part: p.id, sentence: pc.text, detail, licenses: "fold" });
    }
    for (const w of matter) said.add(w);
    for (const id of pc.carries) carriedBefore.add(id);
  }
  for (let i = 1; i < piece.length; i++) {
    const open = piece[i].pieces?.[0]?.text ?? "";
    const prevClose = piece[i - 1].pieces?.[piece[i - 1].pieces.length - 1]?.text ?? "";
    if (open && prevClose && !takesUp(open, prevClose, { ground: ctx.ground ?? "", subject, draft: ctx.draft })) {
      out.push({ kind: "missing_transition", part: piece[i].id, detail: `the part opens on "${open.slice(0, 70)}…" and takes nothing up from "${prevClose.slice(0, 70)}…"`, licenses: "bridge" });
    }
  }
  return out;
}

/** CARO (macro.ethos, authority earned through verification) — TAUGHT: a
 *  sentence carrying no statement and holding no grounded word at all has no
 *  witness in the material. Licenses a fold. */
export function caroUnverified(text, ctx = {}) {
  const piece = partsOf(ctx);
  if (!piece) return [];
  const known = new Set(draftWords(ctx.ground ?? ""));
  const out = [];
  for (const p of piece) for (const pc of p.pieces ?? []) {
    if (pc.carries.length) continue;
    if (!draftWords(pc.text).some((w) => known.has(w))) out.push({ kind: "unverified", part: p.id, sentence: pc.text, detail: "no statement, and no word of it is in the material", licenses: "fold" });
  }
  return out;
}

/** KIDDER & TODD (meso.ethos, fair representation of sources) — TAUGHT: a
 *  statement the draft declared that the piece no longer carries misrepresents
 *  the material by omission. Licenses its floor, the source sentence itself. */
export function kidderToddOmissions(text, ctx = {}) {
  const piece = partsOf(ctx);
  if (!piece || !ctx.draft) return [];
  const anchors = anchorsFor(ctx.draft);
  const out = [];
  for (const dp of drawnParts(ctx.draft)) {
    const here = piece.find((p) => p.id === dp.id);
    const said = here ? sentencesOf(here) : [];
    for (const pt of dp.children) {
      const c = carries(anchors.get(pt.id), said);
      if (!c.ok) out.push({ kind: "statement_dropped", part: dp.id, statement: pt.id, source: pt.text, detail: `${pt.id} is not carried — missing ${[...c.missingNumbers, ...c.missingNames].join(", ") || "its own words"}`, licenses: "floor" });
    }
  }
  return out;
}

/** McPHEE (macro.logos, the structure the material actually wants) — TAUGHT:
 *  the piece's parts are the material's own seams in the material's order; a
 *  part missing or out of order is the shape broken. */
export function mcpheeShape(text, ctx = {}) {
  const piece = partsOf(ctx);
  if (!piece || !ctx.draft) return [];
  const want = drawnParts(ctx.draft).map((p) => p.id);
  const have = piece.map((p) => p.id);
  const out = [];
  for (const id of want) if (!have.includes(id)) out.push({ kind: "part_missing", part: id, detail: `part ${id} of the material's shape is not in the piece`, licenses: null });
  const order = have.filter((id) => want.includes(id));
  if (order.join(",") !== want.filter((id) => have.includes(id)).join(",")) out.push({ kind: "part_order", part: null, detail: `the piece's order ${order.join(",")} is not the material's ${want.join(",")}`, licenses: null });
  return out;
}

function subjectOf(draft) {
  const parts = drawnParts(draft);
  const df = new Map();
  for (const p of parts) for (const w of new Set(draftWords(p.text))) df.set(w, (df.get(w) ?? 0) + 1);
  return new Set([...df.entries()].filter(([, d]) => d * 2 > parts.length).map(([w]) => w));
}

/** GEBSER (the arrival archon, the ever-present origin) — TAUGHT 2026-09-21,
 *  named by the user as arrival's archon. His own terms, from Ursprung und
 *  Gegenwart (1949–1953; bibliography verified against gebser.org): the origin
 *  (Ursprung) stays operative in the present (Gegenwart); the integral
 *  structure (das Integrale) is aperspectival (aperspektivisch), holding every
 *  perspective without giving one the last word; its mark is diaphaneity
 *  (Diaphanie), the parts showing through one another.
 *
 *  So arrival is a STANDING RELATION, never a finish line. In Gebser the
 *  integral is not the last of five steps but a mode that lets the others show
 *  through, so this reading is re-taken after every alteration of the piece,
 *  and an arrived piece that is altered must arrive again. Diaphaneity is
 *  reported and never maximised: more transparency is not "further along".
 *  Four readings, the first three gating and the last reported:
 *
 *   ORIGIN PRESENT — every part carries at least one statement traced to its
 *     witness. A part of connective prose only has lost its origin.
 *   NOTHING OF THE ORIGIN LOST — every declared statement is carried somewhere
 *     in the whole.
 *   INTEGRAL — no taught archon's second reading still licenses a revision.
 *     Gebser does not replace the other editors; he reads through all of them
 *     at once, and arrival is when none of their perspectives has the last word.
 *   DIAPHANEITY — the share of the piece's sentences transparent to a witnessed
 *     statement. Reported, never gated: connective prose is legitimate, and a
 *     piece that was nothing but its sources would be a floor, not a piece. */
/** GORNICK (macro.pathos, what the piece is emotionally about underneath its
 *  ostensible subject) — TAUGHT 2026-10-02: THE STANCE THE PIECE ASSERTS AGAINST
 *  THE STANCE ITS MATERIAL HOLDS. Found by a fold experiment: a mouth handed the
 *  facet of the Elizabethan Poor Law ("work was provided… pensions… no
 *  complaints from the impotent poor") returned "the law's effectiveness… its
 *  success… a sense of fairness" — asserting a POSITIVE stance where the
 *  material's own stance is negative (the law was harshly enforced). The
 *  emotional undercurrent was inverted. The probe compares the piece's net
 *  stance (organs/stance.js, STANCE_GIVER — an English lens, recorded as such)
 *  against the ground's, per part where parts exist: a piece that argues the
 *  opposite evaluation of the material it stands on is a pathos error, and it
 *  licenses a fold — the sentence is dropped back to its own source, the piece's
 *  rhetoric removed from it. Reported with the words that carried the stance,
 *  never just a sign. */
export function gornickStance(text, ctx = {}) {
  const ground = String(ctx.ground ?? "");
  if (!ground.trim()) return [];
  const out = [];
  const piece = partsOf(ctx);
  const parts = piece ?? [{ id: null, pieces: segmentSentences(String(text ?? "")).map((s) => ({ text: s })) }];
  // the holon the piece stands on: the ground's own referents (emergent — the
  // being the material names, never a list)
  let referents = null;
  try { referents = buildReferents(ground); } catch { referents = null; }
  const holon = { theme: ctx.theme ?? "", ground, material: ground, referents, passages: [{ ref: null, text: ground }] };
  for (const p of parts) {
    const said = sentencesOf(p).join(" ");
    if (!said.trim()) continue;
    // READ THE STANCE AT THE LEVEL (the join), not the two-sign lexicon.
    const r = readStance(said, holon, { level: "whole" });
    // STANCE IS EMERGENT: the words that carried it are the material's OWN
    // distinctive words the piece holds (carried), or the relation that inverted
    // it — never a lexicon.
    const words = (r.strain && r.strain.carried ? r.strain.carried : []).slice(0, 6);
    if (r.stance === "against" || r.stance === "off_being") {
      out.push({ kind: r.stance === "against" ? "stance_against" : "off_being", cell: "macro.pathos", part: p.id,
        stance: r.stance, sign: r.sign,
        words,
        detail: r.stance === "against"
          ? `the piece reads ${r.sign < 0 ? "against" : "off"} the material it stands on${words.length ? " — it carries none of the material's commitment (" + words.slice(0, 4).join(", ") + ")" : ""}`
          : "the piece lands off the being the material names (theme word only)",
        basis: r.basis, licenses: "fold" });
    }
  }
  return out;
}

export function gebserArrival({ piece = [], draft = null, findings = [] } = {}) {
  const anchors = draft ? anchorsFor(draft) : new Map();
  const sentences = piece.flatMap((p) => (p.pieces ?? []).map((pc) => ({ part: p.id, ...pc })));
  const withoutOrigin = piece.filter((p) => !(p.pieces ?? []).some((pc) => pc.carries?.length)).map((p) => p.id);
  const lost = [];
  if (draft) {
    const all = sentences.map((x) => x.text);
    for (const dp of drawnParts(draft)) for (const pt of dp.children) if (!carries(anchors.get(pt.id), all).ok) lost.push(pt.id);
  }
  const stillObjecting = [...new Set(findings.filter((f) => f.licenses).map((f) => f.editor))];
  const transparent = sentences.filter((x) => x.carries?.length).length;
  const diaphaneity = sentences.length ? transparent / sentences.length : 0;
  const missing = [
    withoutOrigin.length ? `the origin is absent from ${withoutOrigin.join(", ")}` : "",
    lost.length ? `${lost.length} statement(s) of the origin lost: ${lost.join(", ")}` : "",
    stillObjecting.length ? `not yet integral — still objecting: ${stillObjecting.join(", ")}` : "",
  ].filter(Boolean);
  return {
    archon: "Jean Gebser", arrived: missing.length === 0, missing,
    diaphaneity: Number(diaphaneity.toFixed(2)), transparent, sentences: sentences.length,
    basis: missing.length === 0
      ? `arrived: the origin is present in every part, none of it lost, and no editor's perspective has the last word — ${transparent} of ${sentences.length} sentences transparent to a witnessed statement`
      : `${missing.join("; ")} — ${transparent} of ${sentences.length} sentences transparent to a witnessed statement`,
  };
}

/** HOUDINI (the exclusivity archon, outside the grid like Gebser) — TAUGHT
 *  2026-09-26, named by the user directly from the fold-and-cut theorem
 *  (Demaine, Demaine & Lubiw 1998; Bern, Demaine, Eppstein & Hayes 1999):
 *  any straight-lined shape can be produced by folding one sheet flat and
 *  making a single straight cut, PROVIDED the fold satisfies two conditions
 *  -- every wanted line lands on the cut (completeness) AND nothing else
 *  does (exclusivity). Gebser already checks the first half: origin
 *  present, nothing of the material lost. Nobody was checking the second
 *  half of a folded piece as a WHOLE, after assembly -- only per sentence,
 *  at admission time, where admission.js's own turn exemption is a real,
 *  named gap (a sentence that bonds to its prior landing skips the meta
 *  check entirely; a real leak observed live this session, "Embedded
 *  Information" — the mouth's own note on its phrasing, bonding to an
 *  ordinary preceding sentence — proved this exploitable and was closed
 *  only at an earlier gate, referent-verify.js's isMetaSentence, not by
 *  removing the exemption itself, since a real test depends on it for a
 *  legitimate case).
 *
 *  Houdini is the escape artist who, offstage, exposed fake mediums by
 *  performing their tricks himself and showing the seam. His check here is
 *  exactly that: re-run isMetaSentence — already real, already tested,
 *  unconditionally, with no turn exemption — over the WHOLE FINISHED piece,
 *  after every admission decision has already been made. A sentence that
 *  fooled the per-sentence gate at drafting time cannot fool this one,
 *  because this one runs later, over the assembled whole, and asks only
 *  "does this look like the mouth talking about itself" — the same
 *  question, asked a second time, from a place the first exemption cannot
 *  reach. Licenses a fold (the same mechanical action Clark and Caro's
 *  "has no job" findings already trigger): an apparatus leak has no job in
 *  the piece, whatever bonded it there. */
export function houdiniExclusivity(text, ctx = {}) {
  const piece = partsOf(ctx);
  const out = [];
  if (piece) {
    for (const p of piece) for (const s of sentencesOf(p)) {
      if (isMetaSentence(s)) out.push({ kind: "apparatus_leak", part: p.id, sentence: s, detail: "the mouth's own account of its phrasing choice or task, not the piece's content -- caught on the assembled whole, after admission, regardless of whether admission's own turn exemption let it through", licenses: "fold" });
    }
  } else {
    for (const s of segmentSentences(text)) if (isMetaSentence(s)) out.push({ kind: "apparatus_leak", sentence: s, detail: "the mouth's own account of its phrasing choice or task, not the piece's content", licenses: "fold" });
  }
  return out;
}

/** WILLIAMS (micro.logos, sentence cohesion) — TAUGHT 2026-09-21: A CAUSE
 *  CANNOT COME AFTER ITS EFFECT. Run 6 wrote "However, this flood [of 2010]
 *  spurred a long-term effort …" before "The Corps built locks and dams …
 *  beginning in the 1920s": the mouth linked two facts the material gives
 *  separately with a causal connective, and the extent says the link is
 *  impossible. The connective is a closed grammatical class; the cause's
 *  extent is the dates before the connective in its sentence, else the
 *  nearest earlier sentence's; the effect's is the dates after it, else the
 *  next sentence's. For "because of" / "in response to" the order reverses.
 *  A sentence carrying no statement licenses a fold (the link was its only
 *  job); one carrying statements licenses a rewrite that must drop the
 *  connective. Only a strict inversion is flagged — overlap is not. */
const CAUSE_FORWARD = /\b(spurred|spurs|prompted|prompts|led to|leads to|caused|causes|resulted in|results in|gave rise to|triggered|triggers|sparked|drove)\b/i;
const CAUSE_BACKWARD = /\b(because of|in response to|as a result of|in the wake of|owing to|due to)\b/i;
const yearsIn = (t) => [...String(t).matchAll(/\b(1[0-9]{3}|20[0-9]{2})(s)?\b/g)].map((m) => Number(m[1]) + (m[2] ? 5 : 0));
export function williamsCausalOrder(text, ctx = {}) {
  const piece = partsOf(ctx);
  const flat = piece
    ? piece.flatMap((p) => (p.pieces ?? []).map((pc) => ({ part: p.id, text: pc.text, carries: pc.carries ?? [] })))
    // Bare text: a blank line is a part seam, so the forward search still
    // stays inside a paragraph (falsifier: the null on the raw source flagged
    // "caused … damage" through the next paragraph's 1920s).
    : String(text ?? "").split(/\n\s*\n/).flatMap((para, k) => segmentSentences(para).map((t) => ({ part: `para${k}`, text: t, carries: [] })));
  const out = [];
  flat.forEach((s, i) => {
    const fwd = s.text.match(CAUSE_FORWARD), back = s.text.match(CAUSE_BACKWARD);
    const m = fwd ?? back;
    if (!m) return;
    const pre = s.text.slice(0, m.index), post = s.text.slice(m.index + m[0].length);
    // Backward, the search runs to the nearest dated sentence (an anaphor —
    // "this flood" — reaches back to its antecedent); forward it reads ONE
    // sentence only: a dateless effect is not dated by whatever comes next
    // (measured: "the 2010 flood caused damage" was dated by the next part's
    // 1920s and falsely flagged).
    // Forward it also stays inside the part: run 9's "caused … damage" in the
    // floods part was dated by the dams part's 1920s and falsely folded.
    const near = (k, dir) => { for (let j = k + dir; j >= 0 && j < flat.length; j += dir) { if (dir > 0 && flat[j].part !== flat[k].part) return []; const y = yearsIn(flat[j].text); if (y.length || dir > 0) return y; } return []; };
    const [causeSide, effectSide] = fwd ? [pre, post] : [post, pre];
    const cause = yearsIn(causeSide).length ? yearsIn(causeSide) : near(i, fwd ? -1 : +1);
    const effect = yearsIn(effectSide).length ? yearsIn(effectSide) : near(i, fwd ? +1 : -1);
    if (!cause.length || !effect.length) return;
    if (Math.max(...effect) < Math.min(...cause)) {
      out.push({
        kind: "cause_after_effect", part: s.part, sentence: s.text, words: [m[0].toLowerCase()],
        detail: `"${m[0]}" makes ${Math.min(...cause)} the cause of ${Math.max(...effect)}: the effect would come before its cause`,
        licenses: s.carries.length ? "rewrite" : "fold",
      });
    }
  });
  return out;
}

/** KIDDER & TODD (meso.ethos, fair representation of sources) — TAUGHT
 *  2026-09-21: A RELATION THE MATERIAL NEVER STATES. Run 6 wrote "The May
 *  2010 flood caused significant damage to the Cumberland River": every
 *  anchor survived, and the claim misrepresents the source (the damage was
 *  to the city). The check reads each prose sentence's parse: for every verb,
 *  its subject and each object or oblique. When both are words of the
 *  material but NO source sentence holds them together, the prose has linked
 *  what the material keeps apart.
 *
 *  IDENTITY THE MATERIAL ASSERTS COUNTS: "The Cumberland River is a major
 *  waterway" makes "waterway" another name for the river (a copula in the
 *  source's own parse), so "linked to this waterway" is witnessed wherever
 *  the river is (measured: run 8's only flag was that false positive).
 *
 *  Measured before teaching: the source checked against itself flags 0 of 26
 *  sentences; run 6, 2 of 29 (both real); run 7, 2 of 31 (both marginal — a
 *  parser misreading, and the river made the agent of "transported").
 *  Needs `ctx.parse` (the in-house parser); without it, it is silent and the
 *  gap is the parser's absence, not a pass.
 *  A sentence carrying statements licenses RESTORE — its own source
 *  sentences in its place, true by construction; one carrying none, a fold. */
export function kidderToddRelations(text, ctx = {}) {
  const piece = partsOf(ctx);
  if (!piece || typeof ctx.parse !== "function" || !ctx.ground) return [];
  const st = (w) => draftStem(String(w).toLowerCase());
  const words = (t) => new Set(String(t).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(st));
  const src = segmentSentences(ctx.ground).map(words);
  const known = new Set(src.flatMap((s) => [...s]));
  const alias = new Map();
  const link = (a, b) => { for (const [x, y] of [[a, b], [b, a]]) { if (!alias.has(x)) alias.set(x, new Set([x])); alias.get(x).add(y); } };
  for (const r of ctx.parse(ctx.ground, "ground")) {
    const m = r.meaning; if (!m) continue;
    const by = new Map(m.nodes.map((n) => [n.key, n]));
    for (const n of m.nodes) {
      const kids = (m.arcs ?? []).filter((a) => a.from === n.key);
      // The copula is a function word, so EOTRich absorbs it as a MARKER on
      // the predicate noun (rel "cop"), not an arc.
      const cop = (n.markers ?? []).some((k) => (m.markers ?? []).find((x) => x.key === k)?.rel === "cop") || kids.some((a) => a.rel === "cop");
      if (!cop) continue;
      for (const a of kids.filter((k) => /^nsubj/.test(k.rel))) { const s = by.get(a.to); if (s && n.upos === "NOUN") link(st(s.lemma), st(n.lemma)); }
    }
  }
  // A NAME'S OWN HEAD NOUN NAMES IT TOO: "Cumberland River" is "the river",
  // "Old Hickory Dam" is "the dam" (run 9 folded "Native American peoples
  // relied on the river" though the source says they "used the Cumberland").
  // Read from the referent organ's multi-word names when the draft has one.
  const R = ctx.draft?.referents;
  // Only for the SUBJECT's names: "the river" is the Cumberland in a piece
  // about the Cumberland, but "the dam" is not every dam (falsifier: "Wolf
  // Creek Dam founded Nashville" passed because Old Hickory Dam sits by
  // Nashville).
  const subjectWords = new Set([...(ctx.draft?.subjectRefs ?? [])].flatMap((id) => String(R?.represent(id) ?? "").toLowerCase().split(/\s+/).map(st)));
  if (R?.index?.referents) for (const id of R.index.referents) {
    const ws = String(R.represent(id) ?? "").replace(/^(the|a|an)\s+/i, "").split(/\s+/).filter(Boolean).map(st);
    if (ws.length > 1 && ws.some((w) => subjectWords.has(w))) for (const w of ws.slice(0, -1)) link(ws.at(-1), w);
  }
  const names = (w) => alias.get(w) ?? new Set([w]);
  const together = (a, b) => src.some((s) => [...names(a)].some((x) => s.has(x)) && [...names(b)].some((y) => s.has(y)));
  const out = [];
  for (const p of piece) for (const pc of p.pieces ?? []) {
    for (const r of ctx.parse(pc.text, "prose")) {
      const m = r.meaning; if (!m) continue;
      const by = new Map(m.nodes.map((n) => [n.key, n]));
      const bad = [];
      for (const v of m.nodes.filter((n) => n.upos === "VERB")) {
        const kids = (m.arcs ?? []).filter((a) => a.from === v.key);
        const nom = (a) => { const x = by.get(a.to); return x && ["NOUN", "PROPN"].includes(x.upos) ? st(x.lemma) : null; };
        const subj = kids.filter((a) => /^nsubj/.test(a.rel)).map(nom).filter(Boolean);
        const objs = kids.filter((a) => a.rel === "obj" || /^obl/.test(a.rel)).map(nom).filter(Boolean);
        for (const s of subj) for (const o of objs) if (s !== o && known.has(s) && known.has(o) && !together(s, o)) bad.push(`${s} —${v.lemma}→ ${o}`);
      }
      if (bad.length) out.push({ kind: "unwitnessed_relation", part: p.id, sentence: pc.text, carries: [...(pc.carries ?? [])], detail: `links what no source sentence holds together: ${bad.join("; ")}`, licenses: (pc.carries ?? []).length ? "restore" : "fold" });
    }
  }
  return out;
}

/** CLARK (meso.logos), TAUGHT 2026-09-21: A SENTENCE GLUED TO ITS OWN SOURCE.
 *  Run 12: "The Port of Nashville handles a diverse range of goods, including
 *  aggregates, grain, and steel as today the Port of Nashville handles barge
 *  traffic in aggregates, grain, and steel." A rewrite repeats a run of its own
 *  words longer than ANY source sentence repeats by chance (the ceiling is
 *  measured on the material, restatement.js). Licenses REPAIR: the half that
 *  is most verbatim a source sentence stands in its place. */
export function clarkSplice(text, ctx = {}) {
  const piece = partsOf(ctx);
  if (!piece || !ctx.ground) return [];
  const { ceiling } = spliceCeiling(ctx.ground);
  const out = [];
  for (const p of piece) for (const pc of p.pieces ?? []) {
    const hit = detectSplice(pc.text, ceiling, ctx.ground);
    if (hit) out.push({ kind: "splice", part: p.id, sentence: pc.text, repair: hit.repair, detail: `repeats "${hit.run}" (${hit.runLength} words; the source's own ceiling is ${ceiling})`, licenses: "repair" });
  }
  return out;
}
