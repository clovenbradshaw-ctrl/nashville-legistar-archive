// crown.js — BUILD-4 of the Per-Source Testimony spec: the crown render.
// Turns a `MergeVerdict` (capacity-runner.js::mergeTestimony's own output —
// `{case, verdict, standing, holds, refused, undetermined}`) into the one
// short, plain sentence a reader sees as "the answer," without ever letting
// a model freely assert something no testimony backs. Born from a real,
// live-observed failure: a small model, asked to fact-check "Hannibal
// Hamlin was vice president," confidently "corrected" itself to "William H.
// Seward" (wrong — he was Secretary of State) with no mechanical check
// stopping the wrong claim from shipping as the visible answer. This file
// is the thing that refuses to let that happen.
//
// THE ONE DESIGN DECISION EVERYTHING ELSE FOLLOWS FROM: this is a
// TEMPLATE-based renderer, not a model-generated-then-checked one. A
// rendered sentence is assembled ENTIRELY from (a) the claim's own
// subject/verb/object words, read off a `perSourceReadings` record's own
// `edges` field — never re-typed, never paraphrased — (b) source names
// (`who`, verbatim), and (c) a small, closed, declared connective
// vocabulary (`KNOWN_CONNECTIVES`, below). No model call anywhere in this
// file. Fabrication is structurally impossible by construction — there is
// no free-text generation step for a wrong word to come FROM — rather than
// something generated and then caught after the fact.
//
// A SEPARATE, REAL, CALLABLE WALL STILL EXISTS ON TOP OF THAT CONSTRUCTION
// (`checkTraceCoverage`, `verifyOrFallback`) — not decorative, and not
// redundant with the template discipline above. It is the same "belt and
// suspenders" posture this repo already holds elsewhere (grounding.js
// checks bytes even though cite.js already tries to attach real addresses;
// squarePolarity re-checks a verdict even though the extractor already
// tried to get polarity right): the template path cannot violate the wall
// TODAY, but the wall is what keeps a future template edit (a new case, a
// new phrase, someone hand-editing a connective) from silently reopening
// the fabrication path this file exists to close. Every token of a
// rendered sentence must trace to EXACTLY ONE origin — a claim field, a
// named witness, or one declared connective. Zero traces for a token is
// fabrication; more than one is ambiguous and refused exactly as hard.
//
// ONE GENUINELY REUSABLE IDEA, borrowed from a FROZEN LEGACY reference
// (`eochat/vendor/eoreader5/docs/row-stance-templates.md`, read for
// inspiration only — Constitution I.2: nothing is ported, only re-earned;
// most of that file's own machinery — PropositionGroup/RelationSlot/
// stanceLegality — is a shape chooser for a cube-grain system this repo has
// no equivalent of and doesn't need, since `mergeTestimony` already plays
// that role here): exactly-1 token-trace coverage as the fabrication
// firewall. Adapted fresh against THIS repo's real five merge cases, not
// copied — the legacy closed connective list (`is`/`is-not`/`disagree`/
// `not-established`/`because`/`first`/`then`) answered a different
// question (stance chooser output) than the one built below.
//
// SELF-WITNESS DISCLOSURE (direct user instruction, addressed here and in
// capacity-runner.js::mergeTestimony's own AMENDED note): a model's bare,
// unwitnessed assertion is not "ungrounded" in some special exceptional
// sense — it is grounded in itself, and travels through this SAME crown
// render as any other witness's testimony, under the declared name
// `capacity-runner.js::SELF_WITNESS` ("self:model"). This file does not
// special-case that name anywhere — every render function below prints
// whatever `who` string a reading actually carries, verbatim, un-prettied.
// That is deliberate: "self:model" sitting next to "wikipedia.txt" in a
// DISAGREE render's witness list is ALREADY the disclosure a reader needs
// (a witness whose name literally says "the model itself" cannot be
// mistaken for an independent source), so no second mechanism is built to
// flag it. What IS built here: `mergeTestimony` was amended (not this
// file) so a self-witness never co-signs AGREE's corroboration count — see
// that function's own header for the full account. This file only
// consumes whatever `mergeTestimony` decided; it never re-derives standing.

import { SELF_WITNESS } from "../organs/index.js";
import { questionFor, gateCrown } from "../organs/elenchus.js";

// ── tokenize — the ONE word/punctuation splitter every render, every
// witness name, and the trace-coverage veto all use. Never a second one:
// the legacy file's own §8 names the exact trap this avoids ("a future
// renderer and this firewall's veto must agree on, or trace coverage would
// be an artifact of two tokenizers disagreeing"). A token is a maximal run
// of word characters (letters, digits, internal apostrophes/hyphens/colons,
// and internal periods — see below — so "Bezukhov's", "17th",
// "self:model", and "lincoln.txt" all stay ONE token) or exactly one
// punctuation mark from the small set this file's own templates actually
// produce.
//
// COLON IS DELIBERATELY IN BOTH the word-continuation class AND the
// standalone-punctuation alternative — found live, this file's own first
// test run: `witnessWords("self:model")` split it into THREE tokens
// ("self", ":", "model"), and re-joining them put a stray space after the
// colon ("self: model") because plain punctuation rules glue a colon only
// to what precedes it. A witness/source name is an atomic identifier, not
// English prose — "self:model" (this repo's own self: namespace, reused
// per BUILD-4's user instruction) needed to survive as one token whole.
// Safe to widen only because no template anywhere in this file glues a
// bare colon directly onto a CLAIM or WITNESS word the way the trailing
// "period" connective glues onto one (see joinTypographically's own
// comment) — colon appears standalone only inside self-contained
// connective phrases ("Holding:", "Refusing:"), where merging it into one
// token changes nothing: `connectiveWords` re-tokenizes that SAME declared
// string with this SAME function, so construction and the independent
// verification re-scan can never disagree about where the token boundary
// falls.
//
// PERIOD IS ALSO IN BOTH NOW (2026-08-20) — widened for the identical
// reason, but not the identical way; see below. This section used to end
// by DISCLOSING the gap rather than closing it: "a witness/source name
// containing a period... would still fragment the same way 'self:model'
// just did... not hit by any real specimen this pass exercised." It has
// since been hit. `eval/material-dialogue-stress.mjs` drove renderCrown
// against a source literally named "titanic-a.txt" — an ordinary filename,
// not a contrived one — and `witnessWords("titanic-a.txt")` split into
// THREE tokens ("titanic-a", ".", "txt"), rendering "According to
// titanic-a. txt, ...". Reproduced again here with this file's own
// "lincoln.txt" (already a real ground name throughout
// capacity-runner.test.mjs, just never previously pushed through THIS
// file's own render — see mergeTestimony's own doc comment for that
// history): "According to lincoln. txt, Lincoln appointed Hamlin." — both
// pinned as regressions in crown.test.mjs, the SINGLE shape and the
// harder DISAGREE shape described next.
//
// A bare widening of the continuation class — adding "." exactly the way
// colon was added, with no further condition — is UNSAFE here in a way it
// was never unsafe for colon. `KNOWN_CONNECTIVES.period` (".") is used, in
// EVERY render function in this file, as a standalone token deliberately
// glued flush against whatever claim or witness word ends a sentence —
// that flush gluing is joinTypographically's whole job (NO_SPACE_BEFORE,
// below): it is how "Lincoln appointed Hamlin." renders instead of
// "Lincoln appointed Hamlin .". Colon's connective usage never does this —
// see the paragraph above, colon only ever appears inside a self-contained
// phrase token like "Holding:", never flush against a foreign preceding
// word. A bare widening would make the continuation class greedily eat
// that trailing connective period straight into whatever word precedes it
// ("Hamlin." as ONE token) on every rendered sentence, and
// checkTraceCoverage's independent re-tokenization of the flat text would
// then find one token where construction's own trace recorded TWO separate
// entries (a claim/witness token and a connective token) — every existing
// render would start failing its own wall, not just the new case this fix
// targets.
//
// The fix is a lookahead: a period counts as a word-continuation character
// only when the VERY NEXT character continues a word
// (`\.(?=[A-Za-z0-9])`). "titanic-a.txt" — the period is followed by "t",
// an alnum, so it glues into the word. "Hamlin." at a sentence's end — the
// period is followed by a space, the end of the string, or another
// connective's own leading character, never an alnum — so it stays its own
// standalone token, exactly as it always has. This also correctly resolves
// the harder adjacency this fix was specifically checked against: a
// witness name ending in a period-joined suffix sitting DIRECTLY before
// the connective period with no comma in between (DISAGREE's own
// witness-list-then-period shape, when a side has exactly one witness) —
// "lincoln.txt" followed immediately by the sentence's own closing "."
// renders "lincoln.txt." and still re-tokenizes as TWO tokens
// ("lincoln.txt", "."), never swallowed into one, because that SECOND
// period (the real sentence-final one) is followed by a space or the end
// of the string, never by "t".
//
// Disclosed scope boundary, not a general-purpose identifier tokenizer: a
// witness/source name containing "@" or another character outside this
// class would still fragment, the same way "self:model" and
// "titanic-a.txt" once did — real, narrower than ideal, not hit by any
// real specimen this pass exercised (every real ground name in this
// repo's own fixtures is plain alnum, hyphen, underscore, or period, e.g.
// "lincoln", "lincoln2", "lincolnNeg", "lincoln.txt", "titanic-a.txt").
const TOKEN_RE = /[A-Za-z0-9](?:[A-Za-z0-9':-]|\.(?=[A-Za-z0-9]))*|[.,:;—]/g;
export function tokenize(text) {
  return String(text ?? "").match(TOKEN_RE) ?? [];
}

// ── KNOWN_CONNECTIVES — the closed, declared, non-claim vocabulary a
// rendered sentence may use to glue claim words and witness names
// together. Small and explicit by design (the legacy file's own
// KNOWN_CONNECTIVE_IDS is the model followed) — every entry below exists
// for exactly one of this repo's real five merge cases, commented with
// which. Frozen so a caller cannot silently grow this list at runtime; the
// list is meant to be grown by editing this file and its tests, in the
// open, the same way the legacy file's own closed list was meant to be
// extended only by a person reading and editing it.
export const KNOWN_CONNECTIVES = Object.freeze({
  // SINGLE, and CONTRADICTED's single-witness form: names the witness(es)
  // inline instead of rendering identically to the corroborated form —
  // "a one-witness claim is a different epistemic object than a
  // three-witness one; the surface carries the difference" (the spec's own
  // principle, quoted in this task's own brief).
  "according-to": "According to",
  // RETIRED FROM THE SENTENCE, kept in the vocabulary (2026-08-20, user
  // direction: "THIS SHOULD FEEL LIKE CHATTING WITH CLAUDE"): the standing
  // tag said in instrument-speak what "According to <witness>," already
  // says in plain English — a named-witness sentence IS the single-standing
  // form, and the exact standing rides on `apparatus.standing` for any
  // reader who opens the disclosure. The entry stays declared because this
  // table is the closed set of everything this file can EVER print, and
  // deleting a phrase is a different act than no longer choosing it —
  // renderAssertion simply stopped choosing it.
  "single-standing-tag": "— unconfirmed by independent corroboration.",
  // DISAGREE: never resolves a side, always names every witness on both.
  "sources-disagree-whether": "Sources disagree on whether",
  "holding-colon": "Backing it:",
  "refusing-colon": "Denying it:",
  // CONTRADICTED: a confident negative. "It is not the case that" sidesteps
  // verb conjugation entirely on purpose — never "did not " + bare-stem
  // surgery, which would need real morphology (irregular verbs, tense) this
  // template renderer has no business attempting.
  "it-is-not-the-case-that": "it is not the case that",
  // UNDETERMINED: names nothing, asserts nothing — a typed refusal, not
  // silence. Reworded 2026-08-20 (was the task brief's "Nothing here
  // determines this yet.") for the chat surface's plain voice; the meaning
  // is identical — the material was consulted and does not settle the claim.
  "nothing-determines-this-yet": "The material doesn't settle this.",
  // Pure punctuation/list-joining, reused across several cases above.
  // Never glued onto a claim or witness word directly — every content
  // token stays byte-identical to its own source so checkTraceCoverage's
  // content check has an exact string to compare against, not a decorated
  // one.
  comma: ",",
  period: ".",
  // The trace-coverage wall's own fallback sentence (verifyOrFallback,
  // below) — declared here, in the same closed, frozen table as everything
  // else this file can ever print, including the one sentence that ships
  // when the wall itself fires. Deliberately zero claim words: a render
  // that failed its own check must not repeat whatever token the check
  // couldn't verify.
  "unverifiable-fallback": "This claim's render could not be verified word for word and has been withheld.",
});

function connectiveWords(id) {
  if (!Object.hasOwn(KNOWN_CONNECTIVES, id)) {
    // A programming error inside this file, never a reachable runtime
    // state from real merge data — thrown loudly rather than silently
    // rendering nothing, the same discipline experiencer.js's
    // requireExperiencer already holds for a missing required field.
    throw new RangeError(`crown.js: "${id}" is not a declared connective — the vocabulary is closed`);
  }
  return tokenize(KNOWN_CONNECTIVES[id]).map((token) => ({ token, source: { kind: "connective", id } }));
}

function claimWords(text, field) {
  return tokenize(text).map((token) => ({ token, source: { kind: "claim", field } }));
}

function witnessWords(who) {
  return tokenize(who).map((token) => ({ token, source: { kind: "witness", who } }));
}

function witnessListWords(whos) {
  const parts = [];
  whos.forEach((who, i) => {
    if (i > 0) parts.push(connectiveWords("comma"));
    parts.push(witnessWords(who));
  });
  return parts.flat();
}

// English typographic joining: a token that is pure leading punctuation
// glues to the token before it with no space; every other token gets one
// preceding space (none before the first). Formatting only — it never
// changes which trace entry owns which token, and `tokenize` (the SAME
// function) is what re-derives tokens from the joined text on the other
// side of `checkTraceCoverage`, so the two can never drift apart.
const NO_SPACE_BEFORE = new Set([".", ",", ":", ";"]);
function joinTypographically(tokens) {
  let text = "";
  tokens.forEach((token, i) => {
    if (i > 0 && !NO_SPACE_BEFORE.has(token)) text += " ";
    text += token;
  });
  return text;
}

/**
 * Flatten a list of word-entry arrays into one `{text, trace}` pair.
 * `trace[i].index === i` by construction — the bijection checkTraceCoverage
 * verifies independently, never assumed just because this function built
 * it that way.
 */
function assemble(...parts) {
  const entries = parts.flat();
  const text = joinTypographically(entries.map((e) => e.token));
  const trace = entries.map((e, index) => ({ index, token: e.token, source: e.source }));
  return { text, trace };
}

/**
 * The trace-coverage veto (adapted from the legacy file's §8 idea, built
 * fresh): independently re-tokenizes `rendered.text` (never trusts
 * `rendered.trace`'s own idea of what the tokens were) and checks a real
 * bijection — every token covered by EXACTLY ONE trace entry — plus that
 * every entry's claimed origin is REAL: a connective id actually in
 * `KNOWN_CONNECTIVES` whose own surface contains that exact token, a claim
 * field actually equal (word-for-word) to `claimFields[field]`, or a
 * witness name actually present in `claimFields.witnesses` and containing
 * that exact token. This is the check that would catch a token traced to a
 * word that isn't really there — not just a token missing a label.
 *
 * Never throws. Returns `{ok, violations}` — `violations` is always a real,
 * typed list (empty when ok), never a boolean collapse of what went wrong,
 * matching this repo's own "a gap is a result" discipline (POLICIES P4).
 *
 * `claimFields`: `{subject, verb, object, witnesses: string[]}`. Any of
 * `subject`/`verb`/`object` may be omitted for a render that never uses
 * them (UNDETERMINED); `witnesses` defaults to `[]`.
 */
export function checkTraceCoverage(rendered, claimFields = {}) {
  const { text, trace } = rendered ?? {};
  const tokens = tokenize(text);
  const witnesses = claimFields.witnesses ?? [];
  const violations = [];

  if (!Array.isArray(trace)) {
    return { ok: false, violations: [{ type: "no-trace", detail: "rendered.trace must be an array" }] };
  }
  if (tokens.length !== trace.length) {
    violations.push({ type: "length-mismatch", tokensLength: tokens.length, traceLength: trace.length });
  }

  const seen = new Map();
  for (const entry of trace) {
    const idx = entry?.index;
    if (typeof idx !== "number" || idx < 0 || idx >= tokens.length) {
      violations.push({ type: "index-out-of-range", entry });
      continue;
    }
    seen.set(idx, (seen.get(idx) ?? 0) + 1);
    if (seen.get(idx) > 1) {
      violations.push({ type: "duplicate-coverage", index: idx, token: entry.token });
    }
    if (tokens[idx] !== entry.token) {
      violations.push({ type: "token-mismatch", index: idx, expected: tokens[idx], got: entry.token });
      continue;
    }
    if (!sourceCovers(entry.source, entry.token, { ...claimFields, witnesses })) {
      violations.push({ type: "unsupported-source", index: idx, token: entry.token, source: entry.source });
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    if (!seen.has(i)) violations.push({ type: "zero-coverage", index: i, token: tokens[i] });
  }
  return { ok: violations.length === 0, violations };
}

function sourceCovers(source, token, claimFields) {
  if (!source || typeof source !== "object") return false;
  if (source.kind === "connective") {
    return Object.hasOwn(KNOWN_CONNECTIVES, source.id) && tokenize(KNOWN_CONNECTIVES[source.id]).includes(token);
  }
  if (source.kind === "claim") {
    const field = claimFields[source.field];
    return typeof field === "string" && tokenize(field).includes(token);
  }
  if (source.kind === "witness") {
    return (claimFields.witnesses ?? []).includes(source.who) && typeof source.who === "string" && tokenize(source.who).includes(token);
  }
  return false;
}

// A render that fails its own wall never ships — it falls back to a fixed,
// entirely-connective, always-verifiable refusal instead. Exported
// separately from `renderCrown` so the fallback behavior itself is
// directly testable without needing to first force a real template to
// misbehave (see crown.test.mjs's adversarial cases, which corrupt a REAL
// rendered pair the way a future bug plausibly would, then confirm this
// function is what catches it).
export function verifyOrFallback(rendered, claimFields) {
  const check = checkTraceCoverage(rendered, claimFields);
  if (check.ok) return { ...rendered, verified: true, violations: [] };
  const fallback = assemble(connectiveWords("unverifiable-fallback"));
  return { ...fallback, verified: false, violations: check.violations };
}

/**
 * Pick which reading supplies the claim's own subject/verb/object words.
 * Prefers a non-self-witness reading (a real source's own echo of the
 * claim text is trusted over the model's own possibly-paraphrased one) and
 * falls back to whatever is available. Every reading testifying about the
 * SAME claim_id evaluated the SAME claim text, so in the real pipeline
 * these words are identical across readings regardless of which one is
 * picked — this preference is defense in depth, not a correctness
 * requirement.
 */
function pickClaimFields(readings) {
  const real = readings.find((r) => r.edges?.length && r.who !== SELF_WITNESS);
  const any = real ?? readings.find((r) => r.edges?.length);
  if (!any) return null;
  const { subject, verb, object } = any.edges[0];
  return { subject, verb, object };
}

/**
 * The shared assertion template underlying AGREE, SINGLE, and both of
 * CONTRADICTED's standing forms — one confident (or negated) sentence,
 * optionally naming an uncorroborated witness list inline. `witnesses`
 * is `null`/`[]` for the corroborated/demoted-apparatus form (AGREE,
 * CONTRADICTED-corroborated); a non-empty array names every witness
 * inline for the single-standing form (SINGLE, CONTRADICTED-single) — see
 * this file's own header on why CONTRADICTED renders as AGREE's and
 * SINGLE's own templates, negated, rather than as a third shape.
 */
function renderAssertion(fields, { negate, witnesses }) {
  const named = witnesses && witnesses.length ? witnesses : null;
  const parts = [
    named ? connectiveWords("according-to") : [],
    named ? witnessListWords(named) : [],
    named ? connectiveWords("comma") : [],
    negate ? connectiveWords("it-is-not-the-case-that") : [],
    claimWords(fields.subject, "subject"),
    claimWords(fields.verb, "verb"),
    claimWords(fields.object, "object"),
    // Both forms end with a plain period now — "According to <witness>,"
    // already carries single-standing in ordinary English, and the exact
    // standing rides on `apparatus` (see single-standing-tag's own RETIRED
    // note in KNOWN_CONNECTIVES above).
    connectiveWords("period"),
  ];
  return assemble(...parts.flat());
}

function renderUndetermined() {
  return assemble(connectiveWords("nothing-determines-this-yet"));
}

function renderDisagree(merged) {
  const fields = pickClaimFields(merged.holds ?? []) ?? pickClaimFields(merged.refused ?? []);
  if (!fields) return null; // see renderCrown's own defensive floor, below
  const parts = [
    connectiveWords("sources-disagree-whether"),
    claimWords(fields.subject, "subject"),
    claimWords(fields.verb, "verb"),
    claimWords(fields.object, "object"),
    connectiveWords("period"),
    connectiveWords("holding-colon"),
    witnessListWords(merged.holds.map((r) => r.who)),
    connectiveWords("period"),
    connectiveWords("refusing-colon"),
    witnessListWords(merged.refused.map((r) => r.who)),
    connectiveWords("period"),
  ];
  return { rendered: assemble(...parts.flat()), fields, witnesses: [...merged.holds, ...merged.refused].map((r) => r.who) };
}

/**
 * `renderCrown(merged, { socrates, cycle } = {})` — the one public entry point.
 * `merged` is `mergeTestimony`'s own return value. Returns
 * `{text, trace, verified, violations, apparatus, socrates, socratesText,
 * socratesRefused}` — `apparatus` is always
 * present and always carries `{case, standing, sources}`, the demoted
 * detail every case discloses even when the sentence itself doesn't name
 * sources inline (AGREE, CONTRADICTED's corroborated form). `sources` is
 * the real `who` list backing this render's case — self-witnesses
 * included, verbatim, never filtered out of the disclosure even where
 * `mergeTestimony` excluded them from a COUNT.
 *
 * SOCRATES (P244) rides every render and changes the sentence never: the
 * crown sentence (`text`, under the trace-coverage wall exactly as before)
 * is untouched by it; `socrates` is elenchus.js's own closed-bank question
 * for this standing (null on AGREE — corroborated testimony needs no
 * question back), `socratesText` its filled text ("" when null), and
 * `socratesRefused` the gate's typed refusal when the carried question is
 * missing or off-bank (null when the gate passes). Omitted, `socrates`
 * defaults to the bank question for this standing — auto-attached, so no
 * code path ships a non-AGREE render without one; pass `null` explicitly
 * to carry none (the gate then refuses, honestly), or a question object to
 * carry that one (a turn-level questionCycle result arrives as `cycle`).
 * Callers that must not ship a refused render call `assertCrownShippable`.
 *
 * Every case is covered; an unrecognized `merged.case` (a defensive floor,
 * never reachable from a real `mergeTestimony` call) renders exactly like
 * UNDETERMINED — nothing asserted is always the safe default direction to
 * fail in, matching this render's own whole reason for existing.
 */
export function renderCrown(merged, { socrates = undefined, cycle = null } = {}) {
  const m = merged ?? {};
  let rendered = null;
  let fields = null;
  let witnesses = [];
  let sources = [];

  if (m.case === "AGREE") {
    fields = pickClaimFields(m.holds ?? []);
    witnesses = (m.holds ?? []).map((r) => r.who);
    sources = witnesses;
    if (fields) rendered = renderAssertion(fields, { negate: false, witnesses: null });
  } else if (m.case === "SINGLE") {
    fields = pickClaimFields(m.holds ?? []);
    witnesses = (m.holds ?? []).map((r) => r.who);
    sources = witnesses;
    if (fields) rendered = renderAssertion(fields, { negate: false, witnesses });
  } else if (m.case === "CONTRADICTED") {
    fields = pickClaimFields(m.refused ?? []);
    const corroborated = m.standing === "corroborated";
    witnesses = corroborated ? null : (m.refused ?? []).map((r) => r.who);
    sources = (m.refused ?? []).map((r) => r.who);
    if (fields) rendered = renderAssertion(fields, { negate: true, witnesses });
  } else if (m.case === "DISAGREE") {
    const built = renderDisagree(m);
    sources = [...(m.holds ?? []), ...(m.refused ?? [])].map((r) => r.who);
    if (built) {
      rendered = built.rendered;
      fields = built.fields;
      witnesses = built.witnesses;
    }
  }
  // UNDETERMINED, an unrecognized `merged.case`, AND the defensive floor for
  // every case above that couldn't find usable claim fields (a malformed
  // merge object — holds/refused entries carrying no `edges` — is not
  // expected from a real `mergeTestimony` call, but "a gap is a result,
  // never a throw" (POLICIES P4) applies here exactly as it does everywhere
  // else in this repo: rendering nothing asserted is always the safe
  // direction to fail in, matching this render's own reason for existing).
  if (!rendered) {
    rendered = renderUndetermined();
    fields = null;
    witnesses = [];
  }

  const claimFields = { ...(fields ?? {}), witnesses: witnesses ?? [] };
  const verified = verifyOrFallback(rendered, claimFields);
  // P244: the standing question, beside the sentence, never inside its
  // trace wall. The question text is NOT part of `text` — `text` stays
  // exactly what the trace wall verified, word for word — it ships
  // alongside as `socratesText`, whose own wall is exact bank membership
  // (gateCrown recomputes the fill rather than trusting the caller).
  const carried = socrates === undefined ? questionFor(m, { cycle }) : socrates;
  const gate = gateCrown(m, carried, { cycle });
  return {
    ...verified,
    apparatus: { case: m.case ?? "UNDETERMINED", standing: m.standing ?? null, sources },
    socrates: carried ?? null,
    socratesText: carried?.text ?? "",
    socratesRefused: gate.ok ? null : gate.refused,
  };
}

/**
 * `assertCrownShippable(crowned)` — the build-time gate (P244). Throws with
 * the refusal named when a non-AGREE render carries no Socrates question
 * (or a reworded one), or when the sentence failed its own trace wall.
 * A caller that must never ship a confident-sounding SINGLE/DISAGREE/
 * UNDETERMINED/CONTRADICTED answer without the question attached calls
 * this before shipping; a caller that only discloses reads
 * `socratesRefused` directly instead. Returns true when shippable.
 */
export function assertCrownShippable(crowned) {
  const bad = [];
  if (crowned?.socratesRefused) bad.push(`socrates-required — ${crowned.socratesRefused.detail}`);
  if (crowned && !crowned.verified) bad.push(`trace-coverage — ${(crowned.violations ?? []).map((v) => v.type).join(", ") || "unverified render"}`);
  if (bad.length) throw new Error(`crown render refused:\n  ${bad.join("\n  ")}`);
  return true;
}
