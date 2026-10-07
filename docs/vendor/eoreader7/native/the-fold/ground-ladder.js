// ground-ladder.js — where a sentence stands, read off the whole cube,
// unconsciously (P115). Pure.
//
// User direction (2026-09-05): "it's not well cited … if the model is
// saying it itself, cite the model name", then "have it fully leverage the
// cube unconsciously". A sentence's ground is not one bit (material /
// model): it is the highest rung a ladder of terrains can place it on, and
// every rung is something the instrument already computes. The ladder,
// top down, each rung its cell (the canon stays backstage — the reader
// sees plain words and addresses, never a cell):
//
//   bound      CON·Figure  (Link)     the relation tier bound a claim on it → the edge's own byte address
//   witnessed  EVA·Figure  (Lens)     the sentence witness pointed at a passage that states it → that passage
//   recorded   SYN·Figure  (Link/Network) its claim is a note on the ledger → the note's witnesses, by source
//   derived    SYN·Pattern (Paradigm) it states a fact derived on the record → the premises' ids
//   contested  CON·Figure·CONTESTED   its claim is under a live dispute → both sides, named
//   named      SIG·Ground  (Entity)   its names resolve to referents the material establishes, the claim does not → where they are established
//   self       the mouth              nothing read places it: it is the model's own testimony, cited by name (P39: self:model is a witness with a name)
//
// A rung is a finding only when its organ REACHED the sentence (THE-NULL-
// STATES law 3): a witness that was never asked is not a refusal, and the
// ladder says which rungs were skipped.
//
// THE STANDING RULE BETWEEN ANY TWO RUNGS (user direction, 2026-09-09):
// the LOW sets the POSSIBILITY for the HIGH; the HIGH sets the PROBABILITY
// for the LOW. A weaker rung's own mechanism is a floor a stronger rung's
// verdict may never contradict — tier 4 ("derived") answers "is this
// referent even the one the sentence names" by asking tier 6's own
// resolveName before crediting a match, so a stronger claim can never
// override what a weaker rung has already established as impossible (two
// distinct, named referents are not quietly folded into one because their
// surnames share a token). This is a CONSISTENCY constraint, checked here,
// not a comparison of confidence — it costs nothing to enforce and is
// applied every time a higher rung reads through a lower one's organ.
// The reverse — a stronger rung CALIBRATING how much weight the weaker
// rung's own signal deserves, e.g. how often "named" turns out correct
// measured against cases where "bound" was also reachable for the same
// claim — is a real, disclosed, UNMEASURED question. Nothing in this file
// assigns a numeric probability to any rung; inventing one without a
// measurement (this repo's own standing rule, generality-gate discipline,
// applied here) would be worse than leaving it named and open. A rung
// added later inherits both halves: it must respect every rung already
// below it as a possibility floor, and its own reliability against the
// rungs above it is something to measure, never assume.
const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const toks = (t) => fold(t).replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter((w) => w.length > 2);
const sourceOf = (w) => String(w ?? "").split("~")[0];
const claimKey = (c) => `${fold(c.end1 ?? c.subject)}|${fold(c.label ?? c.verb)}|${fold(c.end2 ?? c.object)}`;

/**
 * suppliedForms(boundClaims, forms) — THE FORM-TIER: what the READING
 * supplied, vs what the BYTES certified (2026-09-16, the critique). A bound
 * claim's spans point at the passage's bytes — the certified ends. A form
 * (output-claims.js: the derived hypothetical, or the sequence register)
 * whose own byte-span overlaps a bound span in the SAME passage is the rule
 * the reading supplied there — the cause, the then, the if — invoked by the
 * material's OWN image. The bytes certify the image; they never contain the
 * form. Where no form overlaps, `supplied` is absent — the reading supplied
 * no rule beyond the ends themselves, and the ladder says nothing rather
 * than inventing a rule.
 */
function suppliedForms(boundClaims, forms) {
  if (!forms?.length || !boundClaims?.length) return [];
  const out = [];
  const seen = new Set();
  for (const c of boundClaims) {
    for (const sp of c.spans ?? []) {
      if (sp.ref == null) continue;
      for (const f of forms) {
        const key = `${sp.ref}|${f.form}|${f.sentence ?? ""}|${f.image ?? ""}`;
        if (seen.has(key)) continue;
        if (f.ref !== sp.ref) continue;
        if (f.span && Number.isFinite(sp.start) && Number.isFinite(sp.end)) {
          if (f.span.end < sp.start || f.span.start > sp.end) continue;
        }
        seen.add(key);
        out.push({ form: f.form, ...(f.side ? { side: f.side } : {}), ...(f.position ? { position: f.position } : {}), image: f.image ?? null, language: f.language ?? "en", ref: f.ref ?? null });
      }
    }
  }
  return out;
}

export const TIERS = Object.freeze(["bound", "witnessed", "recorded", "derived", "contested", "named", "self"]);
export const CELL_OF = Object.freeze({ bound: "CON·Figure", witnessed: "EVA·Figure", recorded: "SYN·Figure", derived: "SYN·Pattern", contested: "CON·Figure·CONTESTED", named: "SIG·Ground", self: "self:model" });

/** Capitalised runs in a sentence — the names it uses (never a referent by itself; resolution is the index's). */
export function namesIn(sentence) {
  const out = [];
  const text = String(sentence ?? "");
  for (const m of text.matchAll(/(?:^|[^\p{L}])((?:\p{Lu}[\p{L}\p{N}'’.-]*)(?:\s+(?:of|the|de|von|van|and|&)?\s*\p{Lu}[\p{L}\p{N}'’.-]*)*)/gu)) {
    // a sentence-initial function word is not part of the name it precedes
    // A possessive marker is stripped BEFORE the function-word test — measured 2026-09-07: "She's" passed as a name (the test saw "She's", not "She") and a reader asked what happens to She's.
    const n = m[1].trim().replace(/[.,;:]+$/, "").replace(/['’]s$/u, "").replace(/^(?:The|This|That|These|Those|It|In|On|At|By|For|From|With|As|A|An|And|But|Or|So|If|When|While|Their|Its|His|Her|They|He|She|We|You|I)\s+/, "");
    if (!(n.length > 2) || /^(The|This|That|These|Those|It|In|On|At|By|For|From|With|As|A|An|And|But|Or|So|If|When|While|Their|Its|His|Her|They|He|She|We|You|I)$/.test(n)) continue;
    // ONE capitalised word at the start of a sentence, or inside a quoted
    // title, is capitalisation — not evidence of a name (L2: capitalisation
    // is a differentiator, never the primary signal). Measured 2026-09-05:
    // "Some", "Trust", "Want", "Believe" reached the footnotes as names.
    // A single-token name counts only mid-sentence and outside quotes.
    if (!/\s/.test(n)) {
      const at = m.index + m[0].indexOf(n);
      const before = text.slice(0, at);
      const sentenceInitial = /(^|[.!?]\s*["“”']*\s*)$/.test(before);
      // inside quotes when an odd number of quote marks precede it
      const quotedTitle = ((before.match(/["“”]/g) ?? []).length % 2) === 1;
      if (sentenceInitial || quotedTitle) continue;
    }
    out.push(n);
  }
  return [...new Set(out)];
}

/**
 * The passage (by ref) whose folded text contains `needle`, or null.
 * PREFERS A REAL, REOPENABLE PAGE OVER THE SEARCH-RESULTS DIGEST (found
 * live, 2026-09-10, user direction: "source it please" — the "See
 * original source" button on a real "named" citation opened, and said
 * "That material is no longer loaded — the address outlived it."). The
 * needle matched inside BOTH the ephemeral combined-snippet digest
 * (`web:search-results#…`, gatherPreflightMaterial's own turn-scoped join
 * of every result's title+snippet, never written to state.citedMaterial —
 * see app.js's own comment on the identical preference already applied to
 * a FINISHED address list) and the real per-page fetch that was ALSO
 * retrieved for this turn, and this function returned whichever came
 * first in `passages` — the digest chunk, since it is built and inserted
 * ahead of the per-page chunks. That is the wrong side of app.js's own
 * already-established rule to apply it AFTER, so it is applied HERE,
 * where the address is actually chosen from every match rather than only
 * the first.
 */
function passageHolding(needle, passages) {
  const f = fold(needle);
  if (!f) return null;
  const matches = (passages ?? []).filter((p) => fold(p.text ?? "").includes(f));
  if (!matches.length) return null;
  const real = matches.find((p) => !String(p.ref ?? "").startsWith("web:search-results"));
  return (real ?? matches[0]).ref ?? null;
}

/**
 * groundOf(sentence, ctx) → { tier, cell, addresses, phrase, detail, reached }
 * ctx: { claims, witness, notes, derived, disputes, passages, resolveName, model }
 */
export function groundOf(sentence, ctx = {}) {
  const { claims = [], witness = null, notes = [], derived = [], disputes = null, passages = [], resolveName = null, model = null, forms = [] } = ctx;
  const mine = claims.filter((c) => c.sentence === sentence);
  const reached = { relation: mine.length > 0, witness: Boolean(witness && witness.witness !== "skipped"), ledger: notes.length > 0, index: typeof resolveName === "function" };
  // 1. bound
  const bound = mine.filter((c) => c.verdict === "bound");
  if (bound.length) {
    const addresses = [...new Set(bound.flatMap((c) => (c.spans?.length ? c.spans.map((sp) => sp.ref ? `${sp.ref}` : null) : c.refs ?? [])).filter(Boolean))];
    const contested = disputes && bound.some((c) => disputes.has(claimKey(c)));
    const supplied = suppliedForms(bound, forms);
    if (contested) return { tier: "contested", cell: CELL_OF.contested, addresses, phrase: "stated, and disputed", detail: `bound to ${addresses.join(", ")}; under a live dispute on the record`, supplied, reached };
    return { tier: "bound", cell: CELL_OF.bound, addresses, phrase: "stated at", detail: `the relation tier bound ${bound.length} claim(s) to the source's bytes`, supplied, reached };
  }
  // 2. witnessed
  if (witness?.witness === "states") {
    // `witness.span.ref` is witness-sentences.js's own internal placeholder
    // — it joins every passage into ONE text so the witness can be pointed
    // at any of them ("const source = { ref: 'passages', text }", that
    // file's own `witnessSentences`), so a "states" verdict's span always
    // carries the literal string "passages" as its ref, never a real
    // address. Read raw, that made the label itself say "a passage states
    // this passages" and the address line say the bare word "passages"
    // (found live, 2026-09-10, user direction: "this needs to show the
    // source and the verbatim claim it came from"). The real source is
    // recovered the way `passageHolding` already exists to do it: which of
    // the ORIGINAL, individually-addressed passages actually contains the
    // witness's own quoted decider text — that text is always verbatim
    // (this module's own "precision guard": "every attest is the passage's
    // verbatim sentence, never the model's words").
    const ref = passageHolding(witness.decider, passages);
    return { tier: "witnessed", cell: CELL_OF.witnessed, addresses: ref ? [ref] : [], phrase: "a passage states this", detail: witness.decider ? `the witness pointed at: “${String(witness.decider).slice(0, 120)}”` : "the witness pointed at a passage", reached };
  }
  // 3. recorded / 5. contested — the sentence's claims (any verdict) matched to notes on the ledger
  // A CLAIM THE READER ITSELF CONTRADICTED IS NOT ON THE RECORD (P137). The
  // match was over claims of ANY verdict, so a sentence the relation tier had
  // judged `contradicted` could still find a same-key note and be published at
  // tier `recorded` — cited, grounded, and exported as though the material
  // supported it. A contradicted claim is contested at best, never support.
  const contradicted = mine.filter((c) => c.verdict === "contradicted");
  const supportable = mine.filter((c) => c.verdict !== "contradicted");
  const keys = new Set(supportable.map(claimKey));
  const onRecord = notes.filter((n) => keys.has(claimKey(n)));
  if (!onRecord.length && contradicted.length) {
    const notes2 = notes.filter((n) => new Set(contradicted.map(claimKey)).has(claimKey(n)));
    if (notes2.length) {
      const w = [...new Set(notes2.flatMap((n) => (n.witnesses ?? []).map(sourceOf)))];
      return { tier: "contested", cell: CELL_OF.contested, addresses: w, phrase: "on the record, and this reading contradicts it", detail: `the reader returned ${contradicted.length} claim(s) here as contradicted`, reached: true };
    }
  }
  if (onRecord.length) {
    const witnesses = [...new Set(onRecord.flatMap((n) => (n.witnesses ?? []).map(sourceOf)))];
    const disputed = onRecord.filter((n) => (n.disputedBy?.length ?? 0) > 0);
    if (disputed.length) return { tier: "contested", cell: CELL_OF.contested, addresses: witnesses, phrase: "on the record, and disputed", detail: `disputed by ${[...new Set(disputed.flatMap((n) => n.disputedBy))].join(", ")}`, reached };
    const sources = new Set(witnesses.map((w) => w.split("#")[0]));
    return { tier: "recorded", cell: CELL_OF.recorded, addresses: witnesses, phrase: sources.size >= 2 ? `on the record from ${sources.size} sources` : "on the record from one source", detail: `${onRecord.length} note(s), ${witnesses.length} witness address(es)`, reached };
  }
  // 4. derived
  const st = new Set(toks(sentence));
  // A derived fact was composed from OTHER sentences, in THEIR wording —
  // bare token containment only catches a fact restated near-verbatim, and
  // it is blind to identity: two different people sharing a surname (e.g.
  // two Bezukhovs) share tokens without being the same referent, so a
  // bag-of-words check alone can credit a sentence with a derived fact
  // about someone else entirely. Where the referent index (tier 6's own
  // `resolveName`) is available and both sides resolve to a NAMED
  // referent, compare identities the same way tier 6 already does — the
  // holograph comparison, not a string one. When either side has no
  // resolvable name (a pronoun, a bare description, or the index absent),
  // this falls through to the token check exactly as before: refusing to
  // manufacture a mismatch from an absence is the same discipline this
  // ladder already holds for withholding vs. convicting.
  const sideMatches = (text) => {
    if (typeof resolveName === "function") {
      const idsHere = new Set();
      for (const nm of namesIn(text)) { let ids; try { ids = resolveName(nm); } catch { ids = null; } for (const id of ids ?? []) idsHere.add(id); }
      if (idsHere.size) {
        const idsSentence = new Set();
        for (const nm of namesIn(sentence)) { let ids; try { ids = resolveName(nm); } catch { ids = null; } for (const id of ids ?? []) idsSentence.add(id); }
        if (idsSentence.size) return [...idsHere].some((id) => idsSentence.has(id));
      }
    }
    // P251's own confirmed exploit: a bare pronoun/short subject or object
    // (any text that folds to ZERO tokens ≥3 characters — "He", "it", "we")
    // is invisible to namesIn (L2's own function-word exclusion, by design)
    // and so never reaches the identity-comparison branch above. That left
    // `toks(text).every(...)` running over an EMPTY array — vacuously true
    // by JS's own semantics, for ANY candidate sentence, correct referent or
    // not. A falsification workflow (2026-09-22) confirmed this promoted a
    // derived fact about one real, indexed referent onto a control sentence
    // about a wholly different real, indexed referent, unconditionally: no
    // control specimen, however constructed, could make it refuse.
    //
    // The fix is the boundary itself, not a threshold: an empty requirement
    // set is NOTHING TO CONFIRM, not something vacuously confirmed — the
    // same "don't manufacture from an absence" discipline this comment
    // already states above, applied to the opposite direction (a false
    // MATCH, not a false mismatch). A structural corroboration floor
    // (`d.premises.length >= 2`, this repo's own reused ≥2 convention —
    // WITNESS_FLOOR, FORM_MIN_ARRIVALS, EVIDENCE_FLOOR) was tried here as a
    // conditional bypass and MEASURED, against the real falsification
    // specimen (identical byte-for-byte copy of this file's own the-fold
    // sibling, over real prose and the real cast.js/surfaces.js/spans.js
    // organs), to be insufficient: a genuinely composed "derived" fact
    // structurally rests on ≥2 parent premises by construction (composition
    // always chains a left AND a right edge), so the adversarial control in
    // that specimen already clears premises.length >= 2 — the same as the
    // true specimen, since both checks read the identical `d`. A predicate
    // that only reads `d` (never the candidate `text`/`sentence` pair) can
    // never discriminate which referent a bare pronoun actually names; only
    // real coreference resolution could, and none is wired into this ctx
    // (namesIn deliberately excludes bare pronouns from resolution, L2).
    // Rather than invent a floor that measurably does not close the hole
    // (P4's own rule: an undischargeable threshold is worse than none),
    // this refuses outright whenever there is nothing to confirm — always,
    // never conditionally reopened on corroboration count alone.
    const t = toks(text);
    return t.length > 0 && t.every((w) => st.has(w));
  };
  const dv = derived.filter((d) => sideMatches(d.subject ?? d.end1) && sideMatches(d.object ?? d.end2) && toks(d.verb ?? d.label).some((w) => st.has(w)));
  if (dv.length) return { tier: "derived", cell: CELL_OF.derived, addresses: dv.flatMap((d) => d.premises ?? []), phrase: "derived on the record", detail: `follows from ${dv[0].premises?.length ?? "?"} earlier claim(s), stated by no source`, reached };
  // 6. named — skipped when the witness already ran a stronger, more
  // specific check on THIS sentence and came back empty. "A name here
  // resolves to a referent the material establishes" is real but weak —
  // it is true of nearly any sentence that mentions someone real, whether
  // or not the sentence claims anything about them. "The witness read
  // every retrieved passage looking for this exact sentence and found
  // none" is the ladder's own purpose-built check for precisely this
  // question, already run, already conclusive. Found live 2026-09-09: a
  // pure absence sentence ("those details are not readily available")
  // read "named, not placed" — Armstrong's own name resolving — while the
  // witness's actual, decisive finding (nothing states this) sat one
  // click deeper and never shaped what the reader saw first, so the two
  // looked contradictory rather than like the same answer said twice.
  // Same rule this ladder's own header already states between rungs (a
  // stronger rung's verdict stands over a weaker rung's mechanism),
  // pointed at DISPLAY priority between two checks of the same sentence
  // rather than between two different rungs.
  if (witness?.witness !== "refused" && typeof resolveName === "function") {
    const names = namesIn(sentence);
    const established = [];
    for (const nm of names) { let ids; try { ids = resolveName(nm); } catch { ids = null; } if (ids && (ids.size ?? ids.length ?? 0) > 0) { const ref = passageHolding(nm, passages); established.push({ name: nm, ref }); } }
    if (established.length) {
      const addresses = [...new Set(established.map((e) => e.ref).filter(Boolean))];
      // `phrase` is a fragment meant to read naturally once groundLine()
      // appends an address after it (measured 2026-09-09: the chip read
      // "names established, claim not web:search-results#0-2645" — a raw
      // address glued onto a dangling "not" with no connecting word). "at"
      // only completes the fragment when an address actually follows; with
      // none, "claim not placed" stands alone rather than trailing on a
      // bare preposition.
      return { tier: "named", cell: CELL_OF.named, addresses, phrase: addresses.length ? "names established, claim not placed at" : "names established, claim not placed", detail: `${established.map((e) => e.name).join(", ")} resolve to referents the material establishes; the claim itself was not placed`, names: established.map((e) => e.name), reached };
    }
  }
  // 7. self
  const refused = witness?.witness === "refused";
  // FED, NOT BOUND (2026-09-10, user direction: "this should disclose
  // sources... even if it just says 'it was fed content from X site,
  // here's the related passage'"). Every rung above this one already
  // failed to place the sentence — none of them may say the fed material
  // SUPPORTS it. What this discloses is narrower and still real: whether
  // the mouth had ANYTHING in front of it when it wrote this, and where
  // that material actually is, so "the model's own voice" never reads as
  // "nothing was given" when something plainly was. `fedRefs` carries one
  // real ref per distinct source so a reader can still open the bytes,
  // even though no rung is claiming they back this particular sentence.
  const fedSources = passages.length ? [...new Set(passages.map((p) => String(p.ref ?? "").split("#")[0]).filter(Boolean))] : [];
  // Ranked the same way `passageHolding` now is (found live, same
  // afternoon: `fedRefs[0]` picked the search-results digest purely
  // because it sits first in `passages`, ahead of a real fetched page
  // that was ALSO given this turn — "See original source" then always
  // opened the one ref type that can never be reopened). A real per-page
  // ref outranks the digest whenever both were fed; the digest still
  // shows when it is genuinely the only thing that was.
  const fedRefs = passages.length
    ? [...new Map(passages.map((p) => [String(p.ref ?? "").split("#")[0], p.ref]).filter(([s]) => s)).values()]
      .sort((a, b) => Number(String(a).startsWith("web:search-results")) - Number(String(b).startsWith("web:search-results")))
    : [];
  // Trailing periods matter here: app.js's mark detail appends its own
  // sentence directly after this one with a bare space (found live,
  // 2026-09-09: "...this is the model's own testimony There is nothing to
  // cite here..." ran two sentences together with no punctuation between).
  return {
    tier: "self", cell: CELL_OF.self, addresses: [], fedSources, fedRefs,
    phrase: model ? `${model}` : "the model",
    detail: `${refused ? "the witness was asked and no passage states it; this is the model's own testimony." : reached.witness ? "no rung placed it; the model's own testimony." : "no rung placed it and the witness was not asked (budget); the model's own testimony, unexamined."}${fedSources.length ? ` ${fedSources.length} page${fedSources.length === 1 ? "" : "s"} ${fedSources.length === 1 ? "was" : "were"} given to the model this turn (${fedSources.join(", ")}) — none was confirmed to state this, but here it is.` : ""}`,
    refused, reached,
  };
}

/** The reader's line for a ground, plain words and addresses. */
export function groundLine(g) {
  if (!g) return "";
  if (g.tier === "self") return `${g.phrase}${g.refused ? " — no source states this" : ""}`;
  return `${g.phrase}${g.addresses?.length ? ` ${g.addresses.slice(0, 3).join(", ")}${g.addresses.length > 3 ? ` (+${g.addresses.length - 3})` : ""}` : ""}`;
}

// A tier NAME (bound/witnessed/recorded/derived/contested/named/self) is
// this file's own internal vocabulary — the same rung the CSS classes and
// the code above key off — and it leaked, unglossed, into two reader-facing
// spots (the bottom marks strip, the mark detail modal's own title): found
// live, 2026-09-09, a reader saw a chip that just said "bound" and had no
// way to know what that meant. `tierWord` is the one place a tier gets a
// plain phrase for those two spots; `groundLine` above stays the fuller,
// address-carrying line and is untouched.
const TIER_WORD = Object.freeze({
  bound: "confirmed",
  witnessed: "confirmed by a passage",
  recorded: "on the record",
  derived: "derived from other claims",
  contested: "disputed",
  named: "named, not placed",
  self: "the model's own voice",
});

/** A tier's plain-English word — never the bare tier name. */
export function tierWord(tier) {
  return TIER_WORD[tier] ?? tier ?? "";
}
