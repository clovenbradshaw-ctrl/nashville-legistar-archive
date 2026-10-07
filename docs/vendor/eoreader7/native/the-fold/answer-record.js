// answer-record.js — the AnswerRecord (Pass 19, P100). Pure.
//
// One record per turn: what the mouth was HANDED (the passages retrieved and
// the ledger's unread extent), what it SAID (every relation claim read off
// the answer with the verdict the material gave it, byte-addressed where it
// bound), what it said that nothing backs (`unsupported` — contradicted or
// fabricated; `unbacked` — asserted, unbound), and the reader's own identity
// (frame, recipe, model, the sources' hashes, the constitution's hash). The
// product assay (eoreader7 lib/product-assay.mjs) builds the same shape
// headless; this is the live turn's.
//
// The record is what a model swap must leave alike in its CLAIMS: two mouths
// over one record may phrase differently, but the set of record-backed
// claims they make, and the count of claims nothing backs (which must be 0),
// is the thing compared — `claimKey` is the identity the diff compares on.

import { ingestionStanding } from "../kernel/ingestion.js";
import { shouldEscalate, recordOutcome } from "../kernel/escalation.js";

export const ANSWER_RECORD_SCHEMA = "EOAnswerRecord@1";

// WHAT WAS NOT FULLY INGESTED, ON EVERY TURN (2026-09-28, user direction: "I
// just don't get why we're not already doing that if it doesn't require a
// model call"). It doesn't, and the record already holds every input:
// `unread` is the arrival read's reach per source (passages read of total),
// a claim's refs are its addresses, and a claim's verdict is the relation
// tier's own typed gap where it left one (beyond-reach / unheard / unbound).
// kernel/ingestion.js reads the standing off exactly that — unread / partial
// / read per cited address — and kernel/escalation.js says whether a judge
// is needed and which rung to try first, in the order the environment has
// LEARNED (Wilson's trails). The judge rung is the sentence witness that
// already runs in this turn: where it pointed at a passage for the claim's
// sentence, that trip is recorded as the judge succeeding; where it refused,
// as failing. Nothing here calls a model; nothing here edits the answer.
// The judge is the third rung (judge.js): asked, under its own budget, only
// for a claim the witness did not settle — the small model handed the full
// section and the question, its prose read mechanically for the verdict.
// ...and the HABIT rung sits between them and the mechanical tier: a judgment
// once learned answers the same claim again with no model call (judge.js).
export const ESCALATION_RUNGS = Object.freeze(["mechanical", "habit", "witness", "judge"]);
const GAP_VERDICTS = new Set(["beyond-reach", "unheard", "unbound"]);
const holonOfRef = (ref) => { const s = String(ref ?? ""); const i = s.indexOf("#"); return i < 0 ? `/${s}` : `/${s.slice(0, i)}/${s.slice(i + 1)}`; };
// EVERY READER'S REACH, NOT ONE (2026-09-28): the arrival read is one reader;
// the constitutional reader (reading-worker.js, READING_CONSTITUTIONAL) is a
// second, with its own cursor in its own unit (chunks admitted). A source
// the first finished can still be half-read by the second, and the kernel's
// reach is CONTAINMENT (a reach at "/a.txt" covers every passage under it),
// so a source-level extent gap never reaches a passage's own standing — the
// passage the claim cites WAS read by the arrival read. What the second
// reader adds is positional: `readers` carries, per source, the refs its
// cursor has passed and the refs it has not — { name, recipe, readRefs,
// unreadRefs } — each passed ref its own reach, each unpassed ref a typed
// gap `not_yet_read` naming that reader. A claim citing a passage the
// constitutional reader has not reached stands `partial`, with the reader
// named in `left`, while the arrival read's own reach still holds.
export function ingestionOf({ claims = [], unread = [], witness = [], sources = [], trails = {}, readers = [] } = {}) {
  const partialSources = new Map((unread ?? []).map((u) => [u.name, u]));
  const reached = [], gaps = [];
  for (const s of sources ?? []) {
    const u = partialSources.get(s.name);
    if (!u) reached.push({ holon: `/${s.name}`, recipe: "arrival-read" });
    else if (u.read > 0) { reached.push({ holon: `/${s.name}`, recipe: "arrival-read" }); gaps.push({ holon: `/${s.name}`, reason: "unread_extent", detail: `${u.read} of ${u.total}`, recipe: "arrival-read" }); }
  }
  for (const r of readers ?? []) {
    if (!r?.name) continue;
    const recipe = r.recipe ?? "reader";
    for (const ref of r.readRefs ?? []) reached.push({ holon: holonOfRef(ref), recipe });
    for (const ref of r.unreadRefs ?? []) gaps.push({ holon: holonOfRef(ref), reason: "not_yet_read", recipe });
  }
  for (const c of claims) if (GAP_VERDICTS.has(c.verdict)) for (const ref of c.refs?.length ? c.refs : (c.spans ?? []).map((sp) => sp.ref).filter(Boolean)) gaps.push({ holon: holonOfRef(ref), reason: c.verdict });
  const said = (w) => toks(w?.sentence ?? "");
  const witnessed = (c) => { const ends = [...toks(c.end1), ...toks(c.end2)]; if (!ends.length) return null; for (const w of witness ?? []) { const s = said(w); if (ends.every((t) => s.has(t))) return w.witness === "states" ? true : w.witness === "refused" ? false : null; } return null; };
  let t = trails ?? {};
  const byClaim = [], tally = { read: 0, partial: 0, unread: 0 };
  for (const c of claims) {
    const refs = c.refs?.length ? c.refs : (c.spans ?? []).map((sp) => sp.ref).filter(Boolean);
    const holon = refs.length ? holonOfRef(refs[0]) : "/";
    const standing = ingestionStanding({ holon, reached, gaps, slots: [] });
    tally[standing.standing] += 1;
    const esc = shouldEscalate({ standing, trails: t, rungs: ESCALATION_RUNGS, rng: () => 1 });
    let judged = null;
    if (esc.needed) {
      const mech = c.verdict === "bound" || c.verdict === "contradicted";
      t = recordOutcome(t, { shape: esc.shape, rung: "mechanical", ok: mech });
      judged = witnessed(c);
      if (judged !== null) t = recordOutcome(t, { shape: esc.shape, rung: "witness", ok: judged });
    }
    byClaim.push({ key: c.key, holon, standing: standing.standing, left: [...standing.gaps.map((g) => g.reason)], ...(esc.needed ? { shape: esc.shape, first: esc.first, ladder: [...esc.ladder.order], learned: esc.ladder.learned, judged } : {}) });
  }
  return { byClaim, tally, escalated: byClaim.filter((b) => b.shape).length, judgedByWitness: byClaim.filter((b) => b.judged !== null && b.judged !== undefined).length, trails: t };
}

// EVERY ∅ CITES ITS VOID (Pass 25 of the null experiments, P106). A sentence
// the answer asserts and nothing backs is an ABSENCE; an absence is honest
// when a void the reader DECLARED (kernel/notes.js S70 — scope, cursor,
// reached) is in scope for it, and a leak (P54: "there is no mention of
// anything else") when none is. The match is mechanical and token-level:
// every token of the void's first end and of its label appears in the
// sentence, folded. Nothing here reads meaning; a void in scope is a fact
// about the record, not a verdict on the sentence.
const fold = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f\u0591-\u05c7\u064b-\u0652]/g, "").toLowerCase();
const toks = (t) => new Set(fold(t).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1));
/** The open void in scope for a sentence, or null. `voids` are foldVoids rows (SVO or neutral names). */
export function voidInScope(sentence, voids = [], { question = "", sameForm = null } = {}) {
  const st = toks(sentence);
  if (!st.size) return null;
  // The first end may be named by the QUESTION the sentence answers — an
  // absence written back to "who was X's director?" says "the director"
  // and points at X anaphorically. The label must be in the sentence itself
  // — by exact token, or by the same act under an injected morphology organ
  // (`sameForm`, the engine's own `sameAct`; P107: "director" against a void
  // labelled "directed" cited none until this existed). Nothing here is a
  // word list; without the organ the match is exact, as before.
  const qt = toks(question);
  const has = (w) => st.has(w) || (typeof sameForm === "function" && [...st].some((t) => { try { return sameForm(t, w); } catch { return false; } }));
  for (const v of voids ?? []) {
    const e1 = [...toks(v.end1 ?? v.subject)], lb = [...toks(v.label ?? v.verb)];
    if (!e1.length || !lb.length) continue;
    const anchored = e1.every((w) => st.has(w)) || (qt.size > 0 && e1.every((w) => qt.has(w)));
    if (anchored && lb.every(has)) return v;
  }
  return null;
}
/**
 * Absences with their citation: each sentence the WITNESS refused — asked
 * whether any passage states it, and none was pointed at — and the declared
 * void in scope for it, if any. Only the witness's refusal makes an absence:
 * an `unbacked` claim is content nothing backs (a different leak, counted
 * apart as `unbacked`), and the instrument's own finding strings ("the
 * material never says …") are not the mouth's sentences — measured
 * (absence-leak.mjs, 2026-09-05): counting them here made every absence
 * "cite none" by construction.
 */
export function absencesOf({ witness = [], voids = [], question = "", sameForm = null } = {}) {
  const seen = new Set();
  const out = [];
  const add = (sentence, how) => {
    const s = typeof sentence === "string" ? sentence : (sentence?.sentence ?? sentence?.text ?? "");
    if (!s || seen.has(s)) return;
    seen.add(s);
    const v = voidInScope(s, voids, { question, sameForm });
    out.push({ sentence: s, how, void: v ? (v.id ?? null) : null, ...(v?.scope ? { scope: { sources: v.scope.sources?.length ?? null, read: v.scope.read ?? null, total: v.scope.total ?? null } } : {}) });
  };
  for (const w of witness ?? []) if (w?.witness === "refused") add(w.sentence, "witness-refused");
  return out;
}

/** The identity a claim is compared on across models: its neutral arrangement, folded. */
export const claimKey = (c) => `${String(c.end1 ?? c.subject ?? "").toLowerCase().trim()}|${String(c.label ?? c.verb ?? "").toLowerCase().trim()}|${String(c.end2 ?? c.object ?? "").toLowerCase().trim()}`;

/**
 * @param {object} turn — { question, answer, model, frame, recipe, sections, unsupported, unbacked, unread, sources, constitution, cursor }
 * @returns {object} the record
 */
export function answerRecord({ question, answer = "", model = null, frame = null, recipe = null, sections = [], unsupported = [], unbacked = [], unread = [], sources = [], constitution = null, cursor = null, voids = [], witness = [], sameForm = null, satisfaction = null, logos = null, ledgerLint = null, ungrounded = null, expectation = null, open = [], mechanical = false, trails = null, readers = [], skills = null } = {}) {
  const claims = [];
  const retrieved = [];
  for (const s of sections ?? []) {
    for (const p of s?.passages ?? []) if (p?.ref && !retrieved.includes(p.ref)) retrieved.push(p.ref);
    for (const c of s?.relations?.claims ?? []) {
      claims.push({
        key: claimKey(c),
        end1: c.end1 ?? c.subject ?? null, label: c.label ?? c.verb ?? null, end2: c.end2 ?? c.object ?? null,
        verdict: c.verdict ?? "unheard", polarity: c.polarity ?? "+",
        refs: [...new Set(c.refs ?? [])],
        spans: (c.spans ?? []).map((sp) => ({ ref: sp.ref ?? null, start: sp.start ?? null, end: sp.end ?? null })),
        ...(c.reason ? { reason: c.reason } : {}),
        // THE SCOPE SLOT (scope.js): when the claim holds, and the date of the
        // ground that backs it. Carried only when the caller typed them.
        ...(c.scope ? { scope: c.scope } : {}),
        ...(c.ground ? { ground: c.ground } : {}),
      });
    }
  }
  const tally = {};
  for (const c of claims) tally[c.verdict] = (tally[c.verdict] ?? 0) + 1;
  const absences = absencesOf({ witness, voids, question, sameForm });
  // Ingestion standing per cited address, and the escalation ladder per claim
  // that rests on something not fully read — mechanical, every turn (above).
  // `trails` is the environment the ladder learns in; the caller keeps it.
  let ingestion = null;
  try { ingestion = ingestionOf({ claims, unread, witness, sources, trails: trails ?? {}, readers }); } catch (e) { ingestion = { error: String(e?.message ?? e) }; }
  return {
    schema: ANSWER_RECORD_SCHEMA,
    cursor,
    question: String(question ?? ""),
    model, recipe, frame,
    expectation,
    // The developer surface's own field (2026-09-23): the SAME run-log
    // diagnostic strings holon.js's runHolonicTask already computes as
    // `result.open` — the completeness gate's own finding among them
    // ("answer names only one of several the material states: ...") — and
    // which fold.js's SEPARATE buildWarrantRecord() already threads into its
    // own, differently-named `record.open` (app.js's persistent per-turn
    // summary record), never rendered anywhere. This is the one actually
    // shown in the fold/thinking panel; without this field the completeness
    // gate's own diagnosis of an incomplete answer was computed and then
    // discarded before a reader could ever see it.
    open: [...(open ?? [])],
    // Whether this turn's shipped text was assembled mechanically
    // (mechanicalAnswer/mechanicalCompetingAnswer, holon.js) rather than
    // drafted by the model — the caller's own aggregate over its parts.
    mechanical: !!mechanical,
    // THE SKILLS THAT REPORTED THIS TURN (2026-10-02): the linked disclosure
    // list (skill-usage.js::linkSkills) — each skill used this turn, how many
    // times it fired, over which sources, with its surface link by skill id.
    // Carried only when something reported; the set it can speak for is
    // INSTRUMENTED's, and a skill absent here means "not reported", never
    // "not used". Disclosure only — never used to edit or withhold anything.
    ...(Array.isArray(skills) && skills.length ? { skills: skills.map((s) => ({ id: s.id, ref: s.ref, href: s.href, fired: s.fired ?? 0, accepted: s.accepted ?? 0, refused: s.refused ?? 0, sources: s.sources ?? [] })) } : {}),
    retrieved,
    // THE SOURCES OF WHAT WAS RETRIEVED (2026-09-10, user direction: "this
    // should disclose sources" — found live, a materialless preflight turn
    // read "it drew on 3 passages from 0 sources", because `sources` below
    // is `state.sources` alone (attached files, kept for the constitutional
    // hash) and a passage fetched by the preflight search was never one of
    // those. The two questions are different — "what is attached" and
    // "where did what was actually read come from" — and this answers the
    // second one, straight off `retrieved`'s own refs, never off the
    // attached-file list.
    retrievedSources: [...new Set(retrieved.map((r) => String(r ?? "").split("#")[0]).filter(Boolean))],
    unread: (unread ?? []).map((u) => ({ name: u.name, read: u.read, total: u.total })),
    // What was not fully ingested among what this answer cites, and which
    // rung the environment says to try first for each such claim. The
    // trails ride here so the caller can persist the learned order; the
    // reading view (answerRecordForReading) drops them.
    ...(ingestion ? { ingestion } : {}),
    claims,
    tally,
    unsupported: (unsupported ?? []).map((u) => (typeof u === "string" ? u : (u?.sentence ?? u?.text ?? JSON.stringify(u)))).slice(0, 50),
    unbacked: (unbacked ?? []).map((u) => (typeof u === "string" ? u : (u?.sentence ?? u?.text ?? JSON.stringify(u)))).slice(0, 50),
    sources: (sources ?? []).map((s) => ({ name: s.name, sha256: s.sha256 ?? null, bytes: s.bytes ?? null })),
    // Absences and their citations (P106): an absence citing a declared void
    // is honest; one citing none is the mouth declaring emptiness — counted,
    // never absorbed.
    absences: absences.slice(0, 50),
    absenceTally: { citingVoid: absences.filter((a) => a.void).length, citingNone: absences.filter((a) => !a.void).length },
    voidsOpen: (voids ?? []).length,
    constitution,
    answer: { chars: String(answer ?? "").length },
    // aletheia.js's satisfaction read (Problem 1's second, complementary
    // fix): did the answer satisfy the question at all, independent of
    // whether any one claim bound to the material? Disclosed always, never
    // silently blended into the tally above and never used to edit or
    // withhold the mouth's own answer (P186 — the mouth is not censored).
    // `null` when the caller never ran the check (every pre-existing turn
    // kind is byte-identical without it).
    ...(satisfaction ? { satisfaction } : {}),
    // LOGOS (logos.js, reusing reasoning-lint.js's findClaimCycle, "Degrees
    // Kelsen"): does the QUESTION's own claims already form a cycle,
    // independent of anything the mouth says? Disclosure only, same
    // posture as satisfaction above — never used to edit or withhold the
    // answer (P186). `null` when the caller never ran the check or none
    // was found; every pre-existing turn is byte-identical without it.
    ...(logos ? { logos } : {}),
    // UNGROUNDED FACTS (scope.js::ungroundedFact): claims whose scope is
    // open-now and whose ground is absent or undated. Disclosure only (P186):
    // the composition seam appends plain words; nothing here edits the answer.
    // Absent unless the caller ran the check (byte-identical otherwise).
    ...(Array.isArray(ungrounded) ? { ungrounded: ungrounded.slice(0, 50) } : {}),
    // DEGREES KELSEN OVER THE LOG (logos.js::ledgerLint): the reasoning
    // linter read over the notes this instrument holds — not over the
    // mouth's words — with what this turn's own writing introduced kept
    // apart from what was already standing. Disclosure only (P186); `null`
    // when nothing has been read yet.
    ...(ledgerLint ? { ledgerLint } : {}),
  };
}

// Plain words for what the linter found in the notes, for the prose view.
// Kinds the linter marks info-only (a note on one voice, an unresolved cell)
// are standing facts about a reading, not problems, and are not phrased.
const LINT_PHRASES = Object.freeze({
  standing_contradiction: "two notes give different answers where only one answer is allowed",
  expired_in_conflict: "a note is out of the time it holds for and conflicts with a current one",
  candidate_conflict: "two notes give different answers where one answer is only suspected",
  contested_open: "a note is disputed and unsettled",
  contested_disagreement: "two notes disagree and one of them is disputed",
  expired_out_of_scope: "a note is being held outside the time it holds for",
  unrouted_cut: "a denial was heard but never recorded as a dispute",
  expired_premise: "a derived note rests on one that is out of its time",
  contested_premise: "a derived note rests on a disputed one without saying so",
  circular: "some notes support each other in a circle",
});

function lintKinds(findings) {
  const by = new Map();
  for (const f of findings ?? []) if (LINT_PHRASES[f.kind]) by.set(f.kind, (by.get(f.kind) ?? 0) + 1);
  return [...by.entries()].map(([kind, n]) => `${LINT_PHRASES[kind]}${n > 1 ? ` (${n})` : ""}`);
}

/** The record-backed claim set and the count of claims nothing backs — what a model swap compares. */
export function claimSets(record) {
  const bound = new Set((record?.claims ?? []).filter((c) => c.verdict === "bound").map((c) => c.key));
  const contradicted = new Set((record?.claims ?? []).filter((c) => c.verdict === "contradicted").map((c) => c.key));
  return { bound, contradicted, unsupported: record?.unsupported?.length ?? 0, unbacked: record?.unbacked?.length ?? 0 };
}

/** Diff two records' claim sets: shared record-backed claims, each side's own, and whether either side said anything nothing backs. */
export function diffRecords(a, b) {
  const A = claimSets(a), B = claimSets(b);
  const shared = [...A.bound].filter((k) => B.bound.has(k));
  return {
    shared,
    onlyA: [...A.bound].filter((k) => !B.bound.has(k)),
    onlyB: [...B.bound].filter((k) => !A.bound.has(k)),
    nothingBacks: { a: A.unsupported + A.unbacked, b: B.unsupported + B.unbacked },
    contradicted: { a: [...A.contradicted], b: [...B.contradicted] },
    sameRecordBackedSet: A.bound.size === B.bound.size && shared.length === A.bound.size,
  };
}

// THE FIELDS A READER RECOGNIZES, VS. THE INSTRUMENT'S OWN PLUMBING
// (Problem 3's "more" view). `record` is the full, honest truth — nothing
// here deletes a field, and the untrimmed record is still one call to
// `answerRecord()` away for anything that needs it (the model-swap diff,
// the durable `records/answers.jsonl` log). This is a VIEW: what a curious
// reader asking "show me the detail" actually recognizes as detail about
// THIS ANSWER (the claims, what's unbacked, the sources, the satisfaction
// read) versus what reads as the instrument's own internal bookkeeping
// (a schema/version tag, an internal recipe hash, the reader's organ
// names and lever settings, a hash of the system prompt) — a real person
// does not have a mental model for `"blankFurniture": "blankFurniture"`
// the way they do for `"unbacked": [...]`. Live user feedback, watching
// this exact box, drew the line here twice: keep the verdict fields
// (claims/tally/unsupported/unbacked/sources/absences/satisfaction),
// drop the plumbing (schema/cursor/recipe/frame/constitution).
const PLUMBING_FIELDS = new Set(["schema", "cursor", "recipe", "frame", "constitution"]);
export function answerRecordForReading(record) {
  if (!record) return record;
  const out = {};
  for (const [k, v] of Object.entries(record)) if (!PLUMBING_FIELDS.has(k)) out[k] = v;
  return out;
}

/** One line for the thinking panel. */
export function answerRecordLine(r) {
  const t = r?.tally ?? {};
  const bits = Object.entries(t).map(([v, n]) => `${n} ${v}`);
  const abs = r.absenceTally ? ` · absences ${r.absenceTally.citingVoid + r.absenceTally.citingNone} (${r.absenceTally.citingVoid} cite a declared gap, ${r.absenceTally.citingNone} cite none)` : "";
  const lintErrors = (r.ledgerLint?.findings ?? []).filter((f) => f.severity === "error").length;
  const cyc = `${r.logos ? ` · LOGOS: cycle in the question's own claims` : ""}${r.ledgerLint ? ` · notes linted ${r.ledgerLint.read}: ${lintErrors} error(s)${r.ledgerLint.thisTurn ? `, ${r.ledgerLint.thisTurn.appearedCount} new this turn` : ""}` : ""}`;
  return `answer record · ${r.claims.length} claim(s)${bits.length ? ` (${bits.join(", ")})` : ""} · ${r.unsupported.length} unsupported · ${r.unbacked.length} unbacked${abs} · retrieved ${r.retrieved.length} · recipe ${String(r.recipe ?? "none").slice(0, 12)}${r.unread?.length ? ` · still reading ${r.unread.map((u) => `${u.name} ${u.read}/${u.total}`).join(", ")}` : ""}${cyc}`;
}

const plural = (n, word, word2 = `${word}s`) => `${n} ${n === 1 ? word : word2}`;

/**
 * A plain-language reading of the record — what a curious, non-technical
 * reader wants from "thinking", not what a developer wants from a log.
 * Every number here is read straight off the record's own fields (never
 * `frame`, `recipe` or `constitution` — an organ name and two hashes, the
 * developer's view, not the reader's); no field is invented that the
 * record does not actually carry (2026-09-08, reversing "vastly simplified"
 * 2026-08-28 — see CLAUDE.md, "The thinking affordance, vastly simplified").
 */
export function answerRecordProse(r) {
  if (!r) return "";
  const sentences = [];

  // ALETHEIA'S ADDRESSED CAVEAT — REMOVED 2026-09-15 (user direction: "this
  // is dead wrong… let's not give caveats like this"). It was scoped to
  // catch a real, severe case (an RFP-transcript summary shipped as an
  // "essay on the X-Files", near-zero shared vocabulary over a LONG,
  // substantively wrong-topic answer) but the same 25%-word-overlap test
  // false-positives just as readily the OTHER way: a short, correct factoid
  // answer legitimately shares little or none of the question's own words
  // ("What's the capital of france?" → "That would be Paris!" — 0% overlap,
  // and a bare "Paris." would score the same) — the exact false-positive
  // shape this comment used to claim only FILLED (not ADDRESSED) was prone
  // to. `aletheia.js`'s ADDRESSED layer and `r.satisfaction` are untouched
  // and still ride the raw record (the "more" JSON, the model-swap diff);
  // only this front-and-center, frequently-wrong warning is gone.

  // LOGOS leads too, for the identical reason the ADDRESSED caveat does: a
  // question whose own claims contradict themselves is worth knowing before
  // reading anything else, whether or not the mouth happened to notice.
  if (r.logos?.detail) sentences.push(r.logos.detail);

  // What the reasoning linter found in the NOTES this turn wrote — phrased
  // only for problems this turn introduced, so a long-standing reading does
  // not repeat itself under every answer.
  const newProblems = lintKinds(r.ledgerLint?.thisTurn?.appeared);
  if (newProblems.length) sentences.push(`Reading its own notes back, this turn left ${newProblems.join("; ")}.`);

  const claims = r.claims?.length ?? 0;
  const bound = r.tally?.bound ?? 0;
  const contradicted = r.tally?.contradicted ?? 0;
  const unclear = Math.max(0, claims - bound - contradicted);
  if (claims) {
    const bits = [];
    if (bound) bits.push(`${bound} backed by what it read`);
    if (contradicted) bits.push(`${contradicted} contradicted by it`);
    if (unclear) bits.push(`${unclear} the reading couldn't settle either way`);
    sentences.push(`It made ${plural(claims, "claim")} about the material${bits.length ? ` — ${bits.join(", ")}` : ""}.`);
  }

  // The judge (judge.js): a claim resting on something not fully read that
  // the witness could not settle, read by a small model over the full
  // section — said in words, with the count that landed apart from the
  // count that was asked.
  const judgeAsks = r.ingestion?.judgeAsks ?? 0;
  if (judgeAsks) {
    const landed = r.ingestion?.judged ?? 0;
    sentences.push(`For ${plural(judgeAsks, "claim")} resting on something not fully read, a judge was handed the whole section${landed ? `; ${landed} of those it settled on the section's own words` : ", and it settled none on the section's own words"}.`);
  }

  const unsupported = r.unsupported?.length ?? 0;
  const unbacked = r.unbacked?.length ?? 0;
  if (unsupported || unbacked) {
    const bits = [];
    if (unsupported) bits.push(`${plural(unsupported, "statement")} the material didn't support`);
    if (unbacked) bits.push(`${plural(unbacked, "statement")} with nothing to check against`);
    sentences.push(`It also said ${bits.join(" and ")}.`);
  }

  const sources = r.sources?.length ?? 0;
  const retrieved = r.retrieved?.length ?? 0;
  // Named by the RETRIEVED passages' own sources, never the attached-file
  // list (`sources`, above) — a preflight-fetched page is a real source of
  // what was read even when nothing was attached, and the two counts must
  // not be conflated the way "3 passages from 0 sources" once read.
  const retrievedSources = r.retrievedSources ?? [];
  if (retrieved) {
    const named = retrievedSources.length && retrievedSources.length <= 6 ? ` (${retrievedSources.join(", ")})` : "";
    sentences.push(`It drew on ${plural(retrieved, "passage")} from ${plural(retrievedSources.length || sources, "source")}${named}.`);
  } else if (sources) sentences.push(`Nothing attached came up for this question, though ${plural(sources, "source")} ${sources === 1 ? "was" : "were"} available.`);

  const stillReading = (r.unread ?? []).filter((u) => (u.total ?? 0) > (u.read ?? 0));
  if (stillReading.length) sentences.push(`Reading is still going on ${plural(stillReading.length, "source")} (${stillReading.map((u) => `${u.name} ${u.read} of ${u.total}`).join(", ")}).`);

  const citingVoid = r.absenceTally?.citingVoid ?? 0;
  const citingNone = r.absenceTally?.citingNone ?? 0;
  const absences = citingVoid + citingNone;
  if (absences) sentences.push(`It acknowledged ${plural(absences, "spot")} where the material simply doesn't say more.`);

  if (r.voidsOpen) sentences.push(`${plural(r.voidsOpen, "question")} about this ${r.voidsOpen === 1 ? "remains" : "remain"} open.`);

  if (!sentences.length) return "It didn't make any checkable claims this turn.";
  return sentences.join(" ");
}

/**
 * The BARE LOGIC — a third reading of the record, deliberately between
 * `answerRecordProse` (too glossed) and `answerRecordForReading`'s raw JSON
 * (too raw): the turn's mechanical logic as a compact, human-readable-ish
 * step trace. Every line is a literal field of the record, never an
 * interpretation of one — the logic is bare in the sense that nothing is
 * prettied up, and readable in the sense that it is not JSON. This is what a
 * "mode" of the thinking disclosure renders (and what the proxy's `thinking`
 * returns as `logic`): the same unconscious, mechanical record, in a form a
 * person can scan.
 *
 * @returns {string[]} one line per step; empty for a null record.
 */
export function bareLogic(r) {
  if (!r) return [];
  const L = [];
  const q = String(r.question ?? "").trim();
  const ret = r.retrieved ?? [];
  const claims = r.claims ?? [];
  const unbacked = r.unbacked ?? [];
  const unsupported = r.unsupported ?? [];
  const abs = r.absenceTally ?? { citingVoid: 0, citingNone: 0 };
  const answerChars = Number(r.answer?.chars ?? 0);
  if (!q && !ret.length && !claims.length && !unbacked.length && !unsupported.length && !(abs.citingVoid + abs.citingNone) && !answerChars) return [];
  if (q) L.push(`input     ${q}`);
  if (r.logos?.cycle?.length) L.push(`logos     CYCLE — ${r.logos.cycle.join(" → ")}`);
  if (r.ledgerLint) {
    const ll = r.ledgerLint;
    const counts = Object.entries(ll.counts ?? {}).map(([k, n]) => `${n} ${k}`).join(", ");
    L.push(`notes     linted ${ll.read} @${ll.strictness} — ${ll.ok ? "coherent" : "incoherent"}${counts ? ` · ${counts}` : ""}${ll.unjudged ? ` · ${ll.unjudged} address(es) with several values, no one-value declaration, not judged` : ""}`);
    if (ll.thisTurn) {
      L.push(`          this turn (seq ${ll.thisTurn.fromSeq}→${ll.thisTurn.toSeq}): ${ll.thisTurn.appearedCount} appeared · ${ll.thisTurn.resolvedCount} resolved`);
      for (const f of ll.thisTurn.appeared) L.push(`  + [${f.severity}] ${f.kind}: ${f.detail}`);
    }
  }
  const retSrc = (r.retrievedSources ?? []).join(", ");
  L.push(`handed    ${ret.length} passage(s)${retSrc ? ` · sources ${retSrc}` : ""}`);
  for (const ref of ret) L.push(`            ${ref}`);
  const tally = r.tally ?? {};
  const tallyBits = Object.entries(tally).map(([v, n]) => `${n} ${v}`).join(", ");
  L.push(`said      ${claims.length} claim(s)${tallyBits ? ` — ${tallyBits}` : ""}`);
  for (const c of claims) {
    const verdict = String(c.verdict ?? "unheard").padEnd(12);
    const refs = (c.refs ?? []).join(",");
    L.push(`  [${verdict}] ${c.end1 ?? "?"} →${c.label ?? "?"}→ ${c.end2 ?? "?"}${refs ? `   @ ${refs}` : ""}`);
  }
  if (unbacked.length || unsupported.length) {
    L.push(`nothing   backs: ${unsupported.length} unsupported · ${unbacked.length} unbacked`);
    for (const u of unsupported) L.push(`  ! ${typeof u === "string" ? u : JSON.stringify(u)}`);
    for (const u of unbacked) L.push(`  ? ${typeof u === "string" ? u : JSON.stringify(u)}`);
  }
  if (abs.citingVoid + abs.citingNone) {
    L.push(`absences  ${abs.citingVoid + abs.citingNone} — ${abs.citingVoid} cite a declared gap · ${abs.citingNone} cite none`);
  }
  const a = String(answerChars);
  L.push(`answer    ${a} char(s)`);
  L.push(`identity  ${String(r.model ?? "-")}${r.recipe ? ` · recipe ${String(r.recipe).slice(0, 12)}` : ""}${r.frame ? ` · frame ${String(r.frame).slice(0, 16)}` : ""}`);
  return L;
}
