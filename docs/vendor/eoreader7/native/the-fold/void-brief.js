// void-brief.js — turn a live question and its material into a declared
// void, so a reader can SEE the space being zeroed on a real turn.
//
// The bridge between the question the person asked and void-shape.js's
// arithmetic. Everything it declares is either read off the material or
// read off an injected organ; nothing here invents a number, and every
// operator it cannot answer is left undeclared rather than defaulted, so
// `undeclaredOf` reports the truth about how well the space was specified.
//
// WHAT IT DELIBERATELY DOES NOT DO: name the fillers. Measured live
// 2026-08-26, twice — the engine's own slot query over full fetched pages
// returns "Though he", "Congress" and "22nd Amendment" as candidate vice
// presidents, and a naive capitalised-name scan over the same material
// returns "Learn More" and "Mary's Charlatans Employees". Feeding either
// list to a model as candidate answers would make the answer worse than
// saying nothing, so this brief reports the SPACE and leaves the filler
// side visibly open. The void is honest about being empty; that is the
// whole point of it, and a brief that filled it with junk to look finished
// would be the failure it exists to expose.
//
// Organs are injected (the cast.js discipline): `slotShapeOf` is
// web-claim.js's declaredSlotShape with its closed classes already bound,
// and `cellOf` is the engine's cube. This file carries neither.

import { declareVoid, spaceFrom, voidsOf, yearSpansIn, fill } from "./void-shape.js";

// A sentence states the ANCHOR'S OWN extent when it is about the anchor and
// about holding an office — never when it is about a person's life. The
// exclusion is load-bearing and is the same trap void-shape.test.mjs pins:
// a lifespan clipped to the office's extent covers all of it and would
// report a real hole closed.
// WHAT A SENTENCE HAS TO BE ABOUT for its year span to be this slot's extent.
//
// This was a hardcoded political vocabulary — `president|presidency|term|
// served|office|administration` — and it is exactly the disease this repo
// already caught in succession.js ("'box subjects' is a wikipedia specific,
// office of, all of this is designed to solve this one problem when what we
// need is a universal system for answering any question"). Measured
// 2026-08-27 on deliberately net-new questions: "the lead singer of Van
// Halen", "chief executive of Apple", "who played James Bond" ALL read no
// extent at all, while the one shape it was written against read fine. It
// was not a general reader; it was the Lincoln question wearing a regex.
//
// The general form of the same question is already in hand and costs
// nothing: the slot's OWN HEAD PHRASE, out of the question the person
// asked. "vice president", "lead singer", "chief executive" — a sentence
// that bears on the slot's extent is one that mentions the slot. That is
// the question's own words, per READING-POLICY's "retrieval is a function
// of the question's own words", not a domain vocabulary this file guesses.
//
// The LIFE exclusion stays, and stays a small received list, because it is
// a genuine confound rather than a topic gate: a lifespan clipped to the
// slot's extent covers all of it and would report a real hole closed —
// the trap void-shape.test.mjs already pins. It EXCLUDES, never admits, so
// its narrowness can only ever cost recall, never manufacture an extent.
const LIFE = /(born|died|\bb\.\s|\bd\.\s|birth|death)/i;

// Content words of the head phrase, as a matcher over a sentence. Any one
// is enough — "lead singer" should match a sentence saying only "singer",
// the same OR-shaped generosity P31's own number-company rule already uses,
// and for the same reason: widening what counts as relevant can only ever
// admit more sentences to the vote, never invent a span that is not written.
const HEAD_MIN = 3;
const headMatcher = (headPhrase) => {
  const words = String(headPhrase ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= HEAD_MIN);
  if (!words.length) return null;
  return new RegExp(`\\b(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "i");
};

/**
 * The extent the slot is bounded by, measured from the material rather than
 * declared by a caller: among sentences that speak of the anchor holding an
 * office, the year span stated most often.
 *
 * Returns the span AND its margin, because "1861-1865 stated 11 times
 * against a runner-up stated 3" and "two spans tied at 1" are different
 * facts and a caller must be able to tell them apart. This is a frequency
 * vote and is disclosed as one — it has NOT been measured against a null,
 * which this repo's own rule asks for before a number is trusted, so the
 * margin is reported for a reader to judge rather than silently relied on.
 */
/**
 * `minMargin` — HOW MUCH THE WINNING SPAN HAS TO WIN BY.
 *
 * This function has always computed `margin` and its own docstring has
 * always said why ("'1861-1865 stated 11 times against a runner-up stated
 * 3' and 'two spans tied at 1' are different facts and a caller must be able
 * to tell them apart"). No caller ever told them apart. `briefFor` took
 * `found.extent` whatever the margin, so a single mention beating nothing
 * became an extent.
 *
 * Measured live 2026-08-27 on a deliberate CONTROL — "What is the capital of
 * Brazil?", a question with one clean answer that should produce no hole at
 * all. The void declared its extent as **1572-1578**, an arbitrary six-year
 * window out of Brazilian colonial history, on ONE mention against FIVE
 * competing readings, and then reported a hole across it. The narration said
 * the evidence was worthless in the same breath as relying on it: "One
 * statements put it there, against five competing readings." A false hole on
 * a question that has none is worse than reading no extent at all — it is
 * the apparatus manufacturing the very thing it exists to detect.
 *
 * The floor is 1 and it is STRUCTURAL, not tuned: a vote whose winner is not
 * stated strictly more often than its runner-up has not chosen. Nothing here
 * is fitted to a specimen — the same rule independently kills the Van Halen
 * false hole (its winning span also tied), and keeps every true positive
 * measured across four unrelated domains.
 *
 * A refused extent is REPORTED, never silent: `extent` is null and
 * `refused` names the tie, so the reader is told the material offered
 * several spans and none dominated — a different fact from the material
 * offering none.
 */
export function extentFor(anchor, texts, { minMentions = 1, minMargin = 1, headPhrase = null } = {}) {
  const anchorRe = anchor ? new RegExp(String(anchor).split(/\s+/).filter(Boolean).join("|"), "i") : null;
  // A caller that states no head phrase gets the anchor gate alone rather
  // than a topic gate this file invented — the honest degradation, and the
  // shape every existing caller already had before the head phrase existed.
  const headRe = headMatcher(headPhrase);
  const tally = new Map();
  for (const t of texts ?? []) {
    const text = String(t ?? "");
    // THE ANCHOR SCOPES THE DOCUMENT; THE HEAD PHRASE MATCHES THE SENTENCE.
    //
    // Both gates used to run per sentence, and that is wrong in a way only a
    // net-new question showed (2026-08-27). A page retrieved for "the lead
    // singer of Van Halen" says "Van Halen" in its title and first line and
    // then says "the band" for the rest of the article — so the sentence
    // that actually states the extent almost never repeats the anchor, and
    // requiring it there threw the extent away on material that plainly
    // carried it. Anchoring the DOCUMENT and matching the SENTENCE keeps
    // what the anchor gate was for (this passage is about this entity, not
    // some other one sharing the page) without demanding the prose repeat a
    // name English pronominalises the moment it can.
    //
    // A text that never names the anchor at all is still read: the anchor
    // may be unresolvable (no anchor was declared) or the passage may be a
    // retrieved fragment whose own page-level context is gone, and refusing
    // it outright would lose real spans for a reason that is about
    // formatting rather than aboutness. The head-phrase gate still carries
    // it in that case, which is the narrower of the two anyway.
    const anchored = !anchorRe || anchorRe.test(text);
    for (const sent of text.match(/[^.!?]+[.!?]?/g) ?? []) {
      if (!anchored && anchorRe && !anchorRe.test(sent)) continue;
      if (headRe && !headRe.test(sent)) continue;
      if (!headRe && anchorRe && !anchorRe.test(sent)) continue;
      if (LIFE.test(sent)) continue;
      for (const s of yearSpansIn(sent)) {
        const k = `${s.from}|${s.to}`;
        tally.set(k, (tally.get(k) ?? 0) + 1);
      }
    }
  }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < minMentions)
    return { extent: null, mentions: 0, margin: 0, considered: ranked.length, refused: null };
  const [key, mentions] = ranked[0];
  const [from, to] = key.split("|").map(Number);
  const margin = mentions - (ranked[1]?.[1] ?? 0);
  if (margin < minMargin) {
    return {
      extent: null,
      mentions,
      margin,
      considered: ranked.length,
      refused: {
        type: "no_dominant_span",
        detail: `${ranked.length} spans were stated and the most frequent (${from}-${to}, ${mentions}×) does not lead the next by ${minMargin}`,
        candidates: ranked.slice(0, 4).map(([k, n]) => ({ from: Number(k.split("|")[0]), to: Number(k.split("|")[1]), mentions: n })),
      },
    };
  }
  return { extent: { from, to }, mentions, margin, considered: ranked.length, refused: null };
}

// The possessor named immediately before a possessive marker, in the
// question's OWN casing.
//
// WHY THIS EXISTS, found by running the declaration on the live specimen
// (2026-08-27). `briefFor` used `shape.marker` as the anchor when no anchor
// was handed in, and for "Who was Abraham Lincoln's vice president?" that
// marker is the possessive TOKEN — `lincoln's`. So SIG declared its anchor
// as `lincoln's`, the slot read `vice president of lincoln's`, and
// `extentFor` built `/lincoln's/i` and looked for it in the material. Real
// prose about a presidency says "Lincoln was", "President Abraham Lincoln",
// "during Lincoln's first term" — the possessive form is the rare one, so
// the extent read found nothing on material that plainly states it, and the
// space came back `unbounded` however good the material was. A wrong anchor
// does not merely mis-label the panel; it silently disables the measurement
// the panel reports.
//
// THE SIGNAL IS THE POSSESSIVE, NOT THE CAPITALISATION (L2, this repo's
// standing rule: capitalisation is a differentiator, never the primary
// signal). `'s` is a received grammatical marker and is what decides that a
// possessor is present at all; capitalisation only decides how far LEFT the
// possessor's own name runs, which is the same division of labour
// `cite.js::namesIn` already holds — find by case, decide by something else.
// A question with no capitalised run before its possessive gets `null` and
// the caller falls back exactly as before, rather than a lowercase guess.
export function possessorIn(question) {
  const m = String(question ?? "").match(/(\p{Lu}[\p{L}\p{N}.'’-]*(?:\s+\p{Lu}[\p{L}\p{N}.'’-]*)*)\s*['’]s\b/u);
  return m ? m[1].trim() : null;
}

// The named thing an "of" phrase hangs the slot on — "the lead singer OF VAN
// HALEN", "the capital OF BRAZIL".
//
// FOUND LIVE, 2026-08-27, driving a deliberately net-new question after the
// whole apparatus had only ever been tested on "Who was Abraham Lincoln's
// vice president?". English has two ordinary ways to bind a slot to its
// anchor and only one of them is possessive. On "Who was the lead singer of
// Van Halen?" `possessorIn` correctly found nothing, and the fallback took
// `shape.marker` — which is the DEFINITE DETERMINER `declaredSlotShape`
// scanned back to. So the void declared its anchor as **"the"** and its slot
// as **"lead singer of the"**, and every downstream reader — the extent
// read, the filler matcher, the reasoning a person actually sees — worked
// off that. The possessive case had been right for the same reason it was
// tested: it was the only case anyone had run.
//
// The signal is the preposition (a received closed-class word, the same
// standing `'s` has in `possessorIn`); capitalisation only decides how far
// RIGHT the name runs, never whether one is there. A lowercase "of the
// band" yields nothing rather than a guess.
export function ofObjectIn(question) {
  const m = String(question ?? "").match(/\bof\s+(?:the\s+)?(\p{Lu}[\p{L}\p{N}.'’-]*(?:\s+\p{Lu}[\p{L}\p{N}.'’-]*)*)/u);
  return m ? m[1].trim() : null;
}

// A DETERMINER IS NEVER AN ANCHOR. `shape.marker` is whatever
// `declaredSlotShape` scanned back to, which for a definite phrase is the
// article itself — and "the" names nothing. Keeping it as the last fallback
// produced `anchor = "the"` live; having NO anchor is strictly better, since
// the slot then reads "lead singer" (true, if unbound) instead of "lead
// singer of the" (meaningless, and poison to every reader downstream).
const namesSomething = (marker) =>
  !!marker &&
  !/^['’]?s?$/.test(marker) &&
  /\p{L}/u.test(marker) &&
  !/^(the|a|an|this|that|these|those)$/i.test(marker) &&
  // A POSSESSIVE TOKEN IS NOT A NAME. "lincoln's" is the marker that says a
  // possessor is present; the possessor is what comes before the suffix.
  // Found live 2026-08-27 on a lowercase question ("what was lincoln's
  // VP?"): `possessorIn` requires a capitalised run, so it returned null,
  // this fallback accepted the raw marker, and SIG declared its anchor as
  // "lincoln's" — the exact defect `possessorIn`'s own header records having
  // fixed, resurfacing wherever the possessor happens to be lowercase. The
  // damage is never cosmetic: `extentFor` then built /lincoln's/i, matched a
  // sentence that had nothing to do with the office, and declared a
  // fabricated 1900-1920 extent with a false hole in it.
  !/['’]s$/.test(marker);

/**
 * The possessor named by a shape's own possessive marker, in the question's
 * own casing.
 *
 * ONE ORGAN DECIDES WHAT A POSSESSIVE IS. `declaredSlotShape` already
 * settles it — case-insensitively, and with the contraction guard that
 * keeps "that's"/"it's"/"who's" from reading as genitives — so this reads
 * ITS answer rather than running a second, differently-capable regex over
 * the same question. Two organs answering one question is how the
 * capitalised case came to work while the lowercase case silently did not.
 *
 * Casing is recovered from the question's own bytes (the marker itself is
 * lowercased by tokenisation), so "Lincoln's" anchors on "Lincoln" and
 * "lincoln's" anchors on "lincoln" — each as the person wrote it.
 */
function possessorOfShape(question, shape) {
  const marker = shape?.marker;
  if (!marker || !/['’]s$/.test(marker)) return null;
  const base = marker.replace(/['’]s$/, "");
  if (!base) return null;
  const m = String(question ?? "").match(new RegExp(`(^|[^\\p{L}\\p{N}])(${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})['’]s\\b`, "iu"));
  return m ? m[2] : base;
}

const CONTENT_MIN = 3;
const contentWords = (s) =>
  new Set(
    String(s ?? "")
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= CONTENT_MIN),
  );

/**
 * THE FILLERS THE MATERIAL ITSELF BOUND TO THIS SLOT, read off the relation
 * tier's own cardinality finding rather than hunted for again.
 *
 * `hypergraph.js::clusterFillers` already computes exactly this — a slot
 * (subject+verb) the material binds to MORE THAN ONE distinct object — and
 * rides it on every claim as `claim.fillers`. holon.js's completeness gate
 * has read it since 2026-08-19. The void was the one consumer that never
 * asked, which is why a question with two real answers could be declared,
 * measured, and reported on without the void ever noticing there were two.
 *
 * WHY NOT A FRESH HUNT. Measured twice on the real pages a live turn fetched
 * (2026-08-27): asking `queryReferents` for the open subject of "was … vice
 * president" at page scale returns "Though he", "Congress", "as", "After"
 * and "During" — and filtering on the `resolution: "referent"` disclosure
 * does NOT clean it, because "Although he", "After" and "Congress" all
 * resolve as referents too. `clusterFillers` is not a better hunt, it is a
 * better-posed QUESTION: it asks what the material binds to a slot the
 * answer actually used, not who might be a vice president somewhere on a
 * page.
 *
 * WHICH SLOT. A turn can carry several multi-filler slots and pooling them
 * would attribute one question's competing answers to another's. Each
 * candidate slot is scored by the content words it shares with this void's
 * own slot phrase and anchor; a slot sharing nothing is not this void's
 * business and is dropped. A tie is REFUSED rather than guessed — two
 * equally-matching slots means the reading cannot tell which one the
 * question opened, and picking either would be a coin flip presented as a
 * finding.
 */
export function observedFillers(slotPhrase, anchor, claims) {
  const want = contentWords(`${slotPhrase ?? ""} ${anchor ?? ""}`);
  if (!want.size) return [];
  const bySlot = new Map();
  for (const c of claims ?? []) {
    if (!(c?.fillers?.length > 1)) continue;
    const key = `${c.subject}|${c.verb}`;
    if (bySlot.has(key)) continue; // clusterFillers reports one list per slot
    let score = 0;
    for (const w of contentWords(`${c.subject} ${c.verb}`)) if (want.has(w)) score++;
    bySlot.set(key, { score, claim: c });
  }
  const ranked = [...bySlot.values()].filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  if (!ranked.length) return [];
  if (ranked.length > 1 && ranked[0].score === ranked[1].score) return []; // refused, never guessed
  const { claim } = ranked[0];
  const seen = new Set();
  const out = [];
  for (const f of claim.fillers) {
    const face = String(f?.object ?? "").trim();
    const key = face.toLowerCase();
    if (!face || seen.has(key)) continue;
    seen.add(key);
    // No span: the relation tier reads WHO, never for how long. A filler
    // with no extent is a real witness whose reach is unknown — `fill()`'s
    // own contract keeps it as disclosed absence rather than counting it as
    // covering everything (which would close the void by ignorance) or
    // nothing (which would overstate the hole).
    out.push({ filler: face, span: null, source: `the material binds "${claim.subject} — ${claim.verb} →" to ${claim.fillers.length} distinct things` });
  }
  return out;
}

/**
 * Declare the void for a live turn. `slotShapeOf(question)` supplies the
 * head phrase and the declared cardinality; the material supplies the
 * extent. Operators this cannot answer from what it was given stay
 * undeclared — a brief that guessed them would defeat the disclosure the
 * declaration exists for.
 *
 * `observed` is the material's own multi-filler finding (see
 * `observedFillers`). More than one filler for a slot the question did not
 * declare plural is a REC: the declaration is REVISED — cardinality becomes
 * `enumerated` and REC's own cell (`reopensOn`, unanswered until now on
 * every turn this has ever run) is finally declared with what forced it.
 *
 * `fillersFor(anchor, texts)` is an OPTIONAL injected organ — a genre-
 * specific structural reader (succession.js::successionFillers is the
 * first) that names real {filler, span, source} witnesses for THIS
 * anchor's slot. Omitted, this function's own header-stated design holds
 * unchanged: nothing is filled, `standing` reads `unbounded` whenever no
 * extent was found and the full constraint uncovered otherwise — the
 * exact behavior before this parameter existed. Supplied, each returned
 * filler is `fill()`-ed into the space before `voidsOf` runs, so a
 * question with a genuinely closed answer can read `covered` instead of
 * reporting an empty space forever. This is deliberately NOT a second
 * discovery pass: `successionFillers` re-shapes the SAME confirmed set
 * `holon.js`'s own completeness gate already computes — one finding, two
 * readers, never two independently-scored guesses about who held what.
 */
export function briefFor(question, texts, { slotShapeOf, cellOf, anchor = null, fillersFor = null, observed = [] } = {}) {
  if (typeof cellOf !== "function") throw new TypeError("briefFor: cellOf is injected from the engine's cube");
  if (typeof slotShapeOf !== "function") throw new TypeError("briefFor: slotShapeOf is injected (web-claim.js::declaredSlotShape, classes already bound)");
  const shape = slotShapeOf(question);
  if (!shape?.headPhrase) return null; // no slot in this question — nothing to zero
  // A caller's own anchor wins; then the question's two ordinary written
  // ways of naming one — a possessive ("Lincoln's vice president") in its
  // own casing, or `declaredSlotShape`'s own `anchorHint` (the object of
  // ANY adposition — "of", "in", "for", … — recovered mechanically via the
  // received POS prior, case-insensitive throughout); `ofObjectIn` stays as
  // the narrower, capitalisation-requiring fallback for a caller that
  // built `shape` without an `isAdposition` predicate (so `anchorHint` is
  // always null in that case) — never dropped, since it costs nothing to
  // keep and a caller may not always have the predicate to inject; then the
  // marker, but ONLY when it names something. See `possessorIn` and
  // `ofObjectIn` above for what each fallback was measured to cost.
  // FOUND LIVE, 2026-08-27: for "who was in Van Halen?" with no
  // `isAdposition` reaching an anchor, the chain fell all the way to
  // `shape.marker` — which for an interrogative-pronoun-led shape (Path 2,
  // web-claim.js) is the pronoun ITSELF ("who"). `namesSomething("who")`
  // passes every check the/a/an/… was ever meant to catch (it is not
  // empty, not possessive-suffixed, has letters, is not an article) — the
  // exclusion list predates Path 2 and never anticipated a NEW class of
  // non-name marker. Rather than grow a second word list here,
  // `grammaticalNumber` already distinguishes the two paths without it:
  // Path 1 always sets it to "plural"/"singular"; Path 2 always sets it to
  // `undefined` explicitly (web-claim.js's own Path 2 return). A marker
  // from Path 2 is BY CONSTRUCTION the trigger pronoun, never a candidate
  // anchor name, so it never reaches this fallback at all.
  const markerCouldBeAName = shape.grammaticalNumber !== undefined;
  const subject =
    anchor ??
    // `possessorIn` FIRST, because it captures the whole capitalised run
    // ("Abraham Lincoln"), where the shape's marker is a single token and
    // would downgrade that to "Lincoln" — a worse anchor, measured.
    possessorIn(question) ??
    // Then the shape's own possessive reading, which is what catches a
    // LOWERCASE possessor ("what was lincoln's VP?") that `possessorIn`'s
    // capitalisation requirement misses entirely. Disclosed residue: this
    // recovers the single token before the marker, so a lowercase
    // MULTI-WORD possessor ("what was abraham lincoln's vp?") anchors on
    // "lincoln" rather than "abraham lincoln" — narrower than ideal, but a
    // real anchor rather than the possessive token itself, which is what
    // shipped before and fabricated an extent off it.
    possessorOfShape(question, shape) ??
    shape.anchorHint ??
    ofObjectIn(question) ??
    (markerCouldBeAName && namesSomething(shape.marker) ? shape.marker : null);
  const found = extentFor(subject, texts, { headPhrase: shape.headPhrase });
  // The slot's own connective reads the REAL relation `declaredSlotShape`
  // found ("person IN Van Halen"), never a hardcoded "of" — found live:
  // every slot label read "X of Y" regardless of what the question actually
  // said, so "who was in Van Halen" displayed as "person of Van Halen", the
  // wrong paraphrase of a relation the shape had already read correctly.
  // "of" survives only as the honest default for the possessive/`ofObjectIn`
  // paths, where it is in fact the correct paraphrase ("Lincoln's vice
  // president" -> "vice president OF Lincoln").
  const connective = shape.anchorHint === subject && shape.anchorPreposition ? shape.anchorPreposition : "of";
  const slot = subject ? `${shape.headPhrase} ${connective} ${subject}` : shape.headPhrase;

  // Both readers of the same slot, pooled by name — the structural one
  // (succession boxes, spans included) and the relation tier's own
  // cardinality finding (who, never for how long). A being named by both is
  // one filler, and the one carrying a span wins, since a filler with an
  // extent can actually cover part of the space and one without cannot.
  const structural = fillersFor ? (fillersFor(subject, texts) ?? []) : [];
  const byName = new Map();
  for (const f of [...structural, ...(observed ?? [])]) {
    if (!f?.filler) continue;
    const key = String(f.filler).trim().toLowerCase();
    const prior = byName.get(key);
    if (!prior || (!prior.span && f.span)) byName.set(key, f);
  }
  const fillers = [...byName.values()];

  // THE REC. The question did not declare its slot plural, and the material
  // bound more than one thing to it. That is precisely what REC's own cell
  // asks about — "what forces this declaration to be revised" — and it has
  // been UNDECLARED on every turn this has ever run, because nothing was
  // ever watching for the thing that would answer it. Now something is: the
  // cardinality is revised to `enumerated` and `reopensOn` carries what
  // forced it, so the revision is on the declaration itself and not only in
  // a sentence about it.
  const reopened = fillers.length > 1 && shape.declared !== "enumerated";
  const declaration = declareVoid(
    {
      slot,
      anchor: subject,
      // INS/CON/SYN/EVA are NOT declared here. They are real questions this
      // brief has no organ to answer yet, and leaving them open is what
      // makes `undeclaredOf` a true report rather than a decorated one.
      extent: found.extent,
      dimension: found.extent ? "years" : null,
      cardinality: reopened ? "enumerated" : shape.declared,
      reopensOn: reopened
        ? `the material bound ${fillers.length} distinct fillers to this slot, against a question that did not ask for more than one`
        : null,
    },
    { cellOf },
  );
  let space = spaceFrom(declaration);
  for (const f of fillers) space = fill(space, f);
  return {
    schema: "EOVoidBrief@1",
    declaration,
    space,
    standing: voidsOf(space),
    evidence: found,
    fillers,
    // The concession, and what it was conceded FROM — a reader (and the
    // narration) must be able to say what the declaration used to be, not
    // just what it now is.
    reopened,
    declaredBefore: shape.declared,
    grammaticalNumber: shape.grammaticalNumber ?? null,
    // The two pieces `slot` was CONCATENATED from, kept separate rather
    // than making a reader re-split the string. FOUND LIVE, 2026-08-27: the
    // narration's own opening paragraph tried to recover `headPhrase` by
    // string-matching `slot.endsWith(" of " + anchor)` — the exact same
    // hardcoded-"of" mistake this file's own `connective` field was just
    // built to fix, in a second place. On "person in Van Halen" the match
    // failed (it does not end in " of Van Halen"), so the paragraph fell
    // back to the WHOLE slot as the head and then appended " of {anchor}"
    // unconditionally anyway — "the person in Van Halen … the person in Van
    // Halen OF Van Halen", the anchor stated twice with two different
    // connectives. Splitting a string a caller already has both halves of
    // is not a computation to get wrong twice.
    headPhrase: shape.headPhrase,
    connective,
  };
}
