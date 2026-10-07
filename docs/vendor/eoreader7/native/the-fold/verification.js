// verification.js — EVA, decomposed across the full domain×grain grid, not
// one ad hoc tier accreting bug fixes.
//
// User direction, verbatim (2026-08-19), after a session of finding
// individual verification bugs one measured incident at a time: "it needs
// to decompose any given fact into tasks to verify, which is why we need a
// taxonomically complete list of things a proposition needs to be verified
// by a witness."
//
// The taxonomy is not invented here — it is read off the engine's own grid
// (packages/engine/operators.js::TERRAIN_BY_DOMAIN), which already names
// nine cells (three domains × three grains) as the complete space any act
// can occupy. Checking whether a proposition holds is EVA — (Relate,
// Interpretation) — but EVA's own grain can be Ground, Figure, or Pattern
// (Atmosphere / Lens / Paradigm terrain respectively), and TWO domains
// below Interpretation gate whether EVA may even run at all: Existence
// (does the referent exist — Void / Entity / Kind) and Structure (does the
// claimed relation hold in the material's own structure — Field / Link /
// Network).
//
//   Existence       Ground=Void          Figure=Entity   Pattern=Kind
//   Structure       Ground=Field         Figure=Link     Pattern=Network
//   Interpretation  Ground=Atmosphere    Figure=Lens     Pattern=Paradigm
//
// DOMAIN ORDER IS PRESUPPOSITION, NOT TIDINESS (amended same day, a
// reader's own analysis, unprompted and correct): Strawson on Russell's
// "the present king of France is bald" — if the referent does not exist,
// a relational claim about it does not come out FALSE, it suffers
// PRESUPPOSITION FAILURE, a type error rather than a null. So an Existence
// wall does not make the seven downstream cells fail; it makes them typed
// GAPS. This is not decorative: it is the JNJ incident inverted. That
// bug's ROOT was a false referent (Johnson & Johnson) manufactured by an
// underspecified search; a dispatcher that let downstream cells report
// against a failed Entity would have the same shape of defect the other
// direction — a Lens verdict "confirming" or "contradicting" a claim about
// a referent this material never actually established. `presupposition()`
// below is the single gate every claim-scoped cell (Link, Network, Lens)
// passes through before computing anything.
//
// FIVE cells are already real, and this module SURFACES them — never
// duplicates them (eoreader6.1's own standing rule, "search for the organ
// before you write one," applied to this repo's own checking ladder):
//   Void     — hypergraph.js's `report.examined` (is there any material at all)
//   Entity   — hypergraph.js's `beyond-reach` split for the verdict (does
//              the claim's SUBJECT resolve at all), plus its per-claim
//              `endpoints` disclosure for the reason (HOW each endpoint
//              resolved: as a referent, as a recurring form, or by content
//              word alone). The split alone was never enough to speak about
//              the object — see `entityReason` below for the specimen.
//   Field    — hypergraph.js's `report.vocabulary.gap` (is a relation
//              vocabulary measurable from this material at all)
//   Link     — hypergraph.js's bound / contradicted / unbound / unheard
//              (does THIS specific edge bind) — plus BELNAP'S FOURTH VALUE:
//              a bound edge whose material ALSO states the opposite
//              polarity (`hgClaim.contested`, hypergraph.js's own "divergence
//              between perspectives is a signal, not noise to smooth") is
//              neither purely holds nor purely fails — it is `both`, told-
//              true-and-told-false, never averaged into one scalar (II.8/
//              II.9's own no-undeclared-collapse rule, read the same way
//              here). `holds`/`fails`/`both`/`gap` is Belnap's four values
//              minus nothing.
//   Lens     — testimony.js's witness verdict (does a focused reading of
//              one passage affirm or contradict the claim)
//
// FOUR cells are DISCLOSED ABSENT — typed `not_yet_executable`, never
// silently skipped, never faked (grid.js::runCapacity's own posture,
// carried here):
//   Kind      — emergence/kinds.js exists as a real engine organ; never
//               wired to a claim check. Would ask: does the referent
//               belong to a category this material recognizes at all.
//   Network   — this session's own hypergraph.js slot-competition work
//               (P32's `competing` field) covers exactly ONE case of this
//               cell (same verb+object, different subject) — not the
//               general question of whether a claimed edge fits the wider
//               network's own structure. Surfaced when `competing` is
//               present; typed absent otherwise, not silently folded into
//               Link.
//   Atmosphere — no organ exists. Would ask: does the claim fit the
//               ambient register/plausibility of the material at all — a
//               looser, whole-material sanity check.
//   Paradigm  — no organ exists. Would ask: does accepting this claim
//               change the reading framework itself — the "difference
//               that makes a difference" aperture.js's own header already
//               discloses as unbuilt, applied here to a single claim
//               instead of a whole turn's surprise.
//
// EVERY CELL CARRIES ITS GIVER AND ITS DEPENDENCY (amended same day, same
// review: "a taxonomically complete verification record is... nine
// cell-verdicts, each stamped with the organ or witness that produced it
// [and] what this verdict depends on" — the truth-maintenance move, beliefs
// carrying their own justifications so a superseded premise's downstream
// verdicts are mechanically findable, never archaeological). `giver` names
// the organ (or null for an unbuilt cell); `dependsOn` names the terrain(s)
// this cell's own computation reads — walked, not hand-asserted, so the
// dependency graph cannot silently drift from what the code actually does.
//
// Pure, offline-testable (the cast.js/hypergraph.js/testimony.js pattern):
// this module composes ALREADY-COMPUTED results (a hypergraph claim
// verdict, an optional witness verdict) into the nine-cell shape. It runs
// no organ itself and makes no network crossing — the caller (app.js) owns
// running hypergraph.js and testimony.js, exactly as it already does. A
// `cursor` (turn/message identifier, PASSED IN — this module computes no
// timestamp, the same discipline every other pure organ in this repo holds)
// rides the whole result: a verdict is a claim about the world as of when
// it was checked, and "as of this tick" is itself part of what it means
// (temporal-database bitemporality — valid time vs. transaction time — is
// the research-gate's own real decision rule, named the same session:
// search iff the claim's valid time plausibly extends past the model's
// training horizon, never a bare "is this recent").

const GIVERS = Object.freeze({
  Void: "hypergraph.js (report.examined)",
  Entity: "cast.js referent index, via hypergraph.js's endpoint resolution",
  Kind: null,
  Field: "hypergraph.js (report.vocabulary)",
  Link: "hypergraph.js (relation extraction + endpoint matching, P32's Belnap 'both' via hgClaim.contested)",
  Network: "hypergraph.js P32 (slot competition — one measured case)",
  Atmosphere: null,
  Lens: "testimony.js (the witness tier)",
  Paradigm: null,
});

// A label, not a mechanism: CHORUS-LOG.md's own persona↔cell roster
// (Diaconis/NUL, Holmes/SIG, Frankfurt/INS, Dijkstra/SEG, Ostrom/CON,
// Alexander/SYN, Feynman/DEF, Pearl/EVA — each confirmed against real
// logged reviews), carried onto this grid so a reader sees "who is
// checking this" the same way a code-review chorus entry already does.
// Deliberately NOT nine agent calls: this file stays a pure composer of
// already-computed verdicts (header, above), and running each cell as a
// real reviewing agent would multiply S2's cost per claim for no measured
// gain — the same efficiency argument P30 (echo/novel) already makes
// against re-spending compute on what a mechanical check already settles.
// Atmosphere/REC has no confirmed entry in CHORUS-LOG.md (checked
// directly, zero hits) — Simon is carried here as a disclosed SUGGESTION,
// not a confirmed reuse, matching how the cell itself is disclosed absent.
const PERSONAS = Object.freeze({
  Void: "Diaconis",
  Entity: "Holmes",
  Kind: "Frankfurt",
  Field: "Dijkstra",
  Link: "Ostrom",
  Network: "Alexander",
  Atmosphere: "Simon (suggested, not confirmed in CHORUS-LOG.md)",
  Lens: "Feynman",
  Paradigm: "Pearl",
});

// What each cell's own computation actually reads — declared once here so
// the presupposition gate (below) and the record's own dependency field
// cannot drift apart from each other.
const DEPENDS_ON = Object.freeze({
  Void: [],
  Entity: ["Void"],
  Kind: ["Entity"],
  Field: [], // material-wide — never gated by one claim's own Entity result
  Link: ["Entity"],
  Network: ["Link"],
  Atmosphere: [],
  Lens: ["Entity"], // the JNJ case: a reading over a referent that failed to exist is not a reading of the claim
  Paradigm: ["Lens", "Link"],
});

/** The nine cells, in domain order, each carrying its own EO address. */
export const VERIFICATION_GRID = Object.freeze(
  [
    { domain: "Existence", grain: "Ground", terrain: "Void" },
    { domain: "Existence", grain: "Figure", terrain: "Entity" },
    { domain: "Existence", grain: "Pattern", terrain: "Kind" },
    { domain: "Structure", grain: "Ground", terrain: "Field" },
    { domain: "Structure", grain: "Figure", terrain: "Link" },
    { domain: "Structure", grain: "Pattern", terrain: "Network" },
    { domain: "Interpretation", grain: "Ground", terrain: "Atmosphere" },
    { domain: "Interpretation", grain: "Figure", terrain: "Lens" },
    { domain: "Interpretation", grain: "Pattern", terrain: "Paradigm" },
  ].map((c) => Object.freeze({ ...c, giver: GIVERS[c.terrain], dependsOn: DEPENDS_ON[c.terrain], persona: PERSONAS[c.terrain] })),
);

// What Entity is actually entitled to say, given what hypergraph.js
// actually checked (added 2026-08-25, found live by
// eval/reasoning-e2e-no-llm.mjs's own Tier 4 output rather than reasoned
// about here). This cell used to report, on every claim that was not
// `beyond-reach`, the flat sentence "subject and object both resolve to
// referents this material establishes" — and that sentence was inferred
// from an absence, never read off a check. `beyond-reach` gates on the
// SUBJECT (plus the narrow case of an object carrying neither referent
// nor content word); an object that resolves to NO referent but does
// carry a content word falls through to `endpointsMatch`'s `tokensShare`
// branch and never touches that gate at all. So "not beyond-reach"
// licenses a statement about the subject and nothing whatsoever about the
// object. The specimen: "Lincoln appointed Napoleon" against material
// that has never heard of Napoleon came back `unbound`, and this cell
// reported that both endpoints resolved to referents the material
// establishes — a confident Existence verdict about a name that does not
// exist in the material, sitting one row above a Link verdict of `fails`
// that a reader would then naturally read as "the material says this is
// false" rather than "the material has never heard of this object".
//
// This is the same constitutional line CLAUDE.md already draws for the
// other direction (a checking organ may withhold, or convict, but may
// never manufacture the second out of the first), read here as its
// mirror: a cell may report what it checked, or say it did not check —
// it may never report a check it never ran as though it had.
//
// The VERDICT is deliberately unchanged — still `holds` wherever it held
// before, so nothing downstream of this module moves. Measured reason,
// not caution for its own sake: an object resolving by content word alone
// is NOT by itself evidence the object fails to exist. Objects are very
// often descriptions rather than names, and in the driver's own material
// every legitimate object ("the Alaska purchase", "the oath to Grant")
// resolves to a real referent through its own named surface while only
// the genuine stranger (Napoleon) comes back token-only — a discriminating
// signal on that material, but not one measured widely enough to promote
// into a verdict flip that would gate Link/Network/Lens through the
// presupposition wall. It is reported, in the reason and in a
// machine-readable `endpoints` field, and left for a reader (and for a
// later pass with a real measurement behind it) to weigh.
const ENDPOINT_PHRASE = Object.freeze({
  referent: "resolves to a referent this material establishes",
  form: "resolves only through a recurring form, never a named referent",
  tokens: "does not resolve to any referent — it was compared by content word alone",
  none: "carries nothing this material could resolve or compare",
});

function entityReason(hgClaim) {
  const ep = hgClaim?.endpoints;
  // No disclosure on the claim (a hand-built claim, or the grammar gate's
  // own early beyond-reach return, which fires before endpoints are ever
  // computed): say what is actually known — the subject cleared, and the
  // object was not reported on — never the old both-endpoints sentence.
  if (!ep) return "the subject resolves to a referent this material establishes; this claim carries no endpoint disclosure, so the object's own resolution was not reported";
  if (ep.subject === "referent" && ep.object === "referent") {
    return "subject and object both resolve to referents this material establishes";
  }
  const subject = `subject ${hgClaim.end1 ? `“${hgClaim.end1}” ` : ""}${ENDPOINT_PHRASE[ep.subject] ?? "resolved in an unrecognized way"}`;
  const object = `object ${hgClaim.end2 ? `“${hgClaim.end2}” ` : ""}${ENDPOINT_PHRASE[ep.object] ?? "resolved in an unrecognized way"}`;
  return `${subject}; ${object}`;
}

const cell = (terrain, verdict, extra = {}) => ({
  ...VERIFICATION_GRID.find((c) => c.terrain === terrain),
  verdict,
  ...extra,
});

const NOT_YET = (terrain, why) => cell(terrain, "not_yet_executable", { why });

/**
 * Decompose one hypergraph claim verdict (+ an optional witness verdict)
 * into the nine-cell taxonomy. `hgReport` is the report `makeRelationReader`'s
 * `read()` returns (carries `examined` and `vocabulary`); `hgClaim` is one
 * entry of its `claims` array — the specific edge this task is about;
 * `testimony` is testimony.js's `foldTestimony` output, when a witness ran
 * for this same claim (null when it never ran); `cursor` is an opaque
 * caller-supplied identifier (turn number, message id) — never computed
 * here.
 */
export function verificationTasksFor({ hgReport = null, hgClaim = null, testimony = null, cursor = null } = {}) {
  const tasks = [];

  // ── Existence ──────────────────────────────────────────────────────────
  const noMaterial = !!hgReport && !hgReport.examined;
  // Void is Existence×Ground — the space itself, before any one figure is
  // picked out of it (user direction, 2026-08-19, naming this cell
  // directly: "is this a complete answer, have we defined the space
  // correctly?"). "Material is present" was the whole check before this;
  // it answers whether a space exists to check against at all, but not
  // whether the claim under review picked out ONE thing from a space the
  // material actually shows holds MORE than one — the Strawson/Russell
  // uniqueness gap (this file's own header, above) at Ground scale rather
  // than Figure scale. hypergraph.js's clusterFillers already computes
  // this on the claim (`hgClaim.fillers`, holon.js's own completeness gate
  // reads the identical field); Void's verdict does not change for it —
  // the material genuinely IS present either way — but the reason and the
  // fillers themselves ride the SAME cell, enriched rather than collapsed
  // to a bare "holds", the pattern this file already holds Link/Network to.
  tasks.push(
    hgReport
      ? cell("Void", hgReport.examined ? "holds" : "gap", {
          reason: hgReport.examined ? "material is present to check against" : "no material was loaded for this turn",
          ...(hgReport.examined && hgClaim?.fillers?.length > 1
            ? {
                reason: `material is present, but the space this claim names is not fully bounded — ${hgClaim.fillers.length} distinct fillers exist for "${hgClaim.end1} ${hgClaim.label}", not one`,
                fillers: hgClaim.fillers,
              }
            : {}),
        })
      : NOT_YET("Void", "no hypergraph report supplied"),
  );

  const entityFailed = hgClaim?.verdict === "beyond-reach";
  if (noMaterial) {
    tasks.push(cell("Entity", "gap", { reason: "no material was loaded — a referent cannot be resolved against nothing" }));
  } else if (entityFailed) {
    tasks.push(cell("Entity", "gap", { reason: hgClaim.reason ?? "an endpoint does not resolve to a referent" }));
  } else if (hgClaim) {
    tasks.push(
      cell("Entity", "holds", {
        reason: entityReason(hgClaim),
        ...(hgClaim.endpoints ? { endpoints: hgClaim.endpoints } : {}),
      }),
    );
  } else {
    tasks.push(NOT_YET("Entity", "no claim supplied"));
  }

  tasks.push(NOT_YET("Kind", "emergence/kinds.js exists as an engine organ but is not wired to claim checking yet"));

  // Presupposition failure, Strawson/Russell-style: if the referent this
  // claim is ABOUT does not exist (or there is no material to check it
  // against at all), no downstream cell may report holds/fails/both — that
  // would be measuring against a claim that was never well-formed enough
  // to measure. Every claim-scoped cell below (Link, Network, Lens) passes
  // through this gate before computing anything, REGARDLESS of what data
  // the caller supplied for it — a witness result handed in for a claim
  // whose entity failed is composed as a typed gap, not reported, because
  // trusting it would be the JNJ bug in the other direction: verifying
  // structure/reading against a referent the Existence check already
  // refused.
  const presupposed = noMaterial || entityFailed;

  // ── Structure ──────────────────────────────────────────────────────────
  tasks.push(
    hgReport
      ? hgReport.vocabulary?.gap
        ? cell("Field", "gap", { reason: hgReport.vocabulary.gap })
        : cell("Field", "holds", { reason: `a relation vocabulary of ${hgReport.vocabulary?.verbs ?? 0} verb(s) was measured` })
      : NOT_YET("Field", "no hypergraph report supplied"),
  );

  if (presupposed) {
    tasks.push(
      cell("Link", "not_yet_executable", {
        why: "presupposition failure — the claim's own referent did not establish, so no edge check is well-formed",
      }),
    );
  } else if (hgClaim) {
    const linkVerdict =
      hgClaim.verdict === "bound"
        ? hgClaim.contested
          ? "both"
          : "holds"
        : { contradicted: "fails", unbound: "fails", unheard: "gap" }[hgClaim.verdict] ?? "gap";
    tasks.push(
      cell("Link", linkVerdict, {
        reason:
          linkVerdict === "both"
            ? "the material binds this edge with BOTH polarities across different passages — told-true and told-false, not averaged"
            : hgClaim.verdict === "bound"
              ? "the material binds this exact edge"
              : hgClaim.verdict === "contradicted"
                ? "the material binds this edge with the opposite polarity"
                : hgClaim.verdict === "unheard"
                  ? `the material never uses the verb "${hgClaim.label}" — a limit of this check, not a mark against the claim`
                  : "no edge binds this exact subject, verb, and object",
        // hypergraph.js's own claim carries far more evidence than one
        // sentence — the addresses that state it, corroboration counted as
        // passages AND distinct sources (never averaged into a bit), the
        // OPPOSING edges on a contradiction or a both-polarities finding,
        // and the nearest edges the material DOES bind when this one is
        // unbound. Dropping these down to a reason string was the exact
        // failure the "stored in the json... thinking affordance"
        // direction exists to prevent — a router's own evidence discarded
        // on the way to the record that is supposed to hold it.
        ...(hgClaim.refs ? { refs: hgClaim.refs } : {}),
        ...(hgClaim.corroboration ? { corroboration: hgClaim.corroboration } : {}),
        ...(hgClaim.contested ? { contested: hgClaim.contested } : {}),
        ...(hgClaim.bound ? { opposing: hgClaim.bound } : {}),
        ...(hgClaim.nearest ? { nearest: hgClaim.nearest } : {}),
      }),
    );
  } else {
    tasks.push(NOT_YET("Link", "no claim supplied"));
  }

  if (presupposed) {
    tasks.push(cell("Network", "not_yet_executable", { why: "presupposition failure — see Entity" }));
  } else {
    tasks.push(
      hgClaim?.competing
        ? cell("Network", "fails", {
            reason: `the material binds this exact verb+object to a different subject: ${hgClaim.competing.end1}`,
            disclosed: "covers one measured case (same verb+object, different subject) — not general network-exclusivity",
            competing: hgClaim.competing,
          })
        : NOT_YET("Network", "general network-exclusivity checking is unbuilt; the one measured case (slot competition) did not apply here"),
    );
  }

  // ── Interpretation ─────────────────────────────────────────────────────
  tasks.push(NOT_YET("Atmosphere", "no organ exists yet for whole-material register/plausibility"));

  if (presupposed) {
    tasks.push(cell("Lens", "not_yet_executable", { why: "presupposition failure — a reading over a referent that failed to exist is not a reading of the claim" }));
  } else {
    tasks.push(
      testimony
        ? testimony.refused
          ? cell("Lens", "gap", { reason: `witness refused: ${testimony.refused}` })
          : cell("Lens", testimony.verdict === "contradicts" ? "fails" : "holds", {
              reason: testimony.because,
              host: testimony.host,
              armed: testimony.armed,
            })
        : NOT_YET("Lens", "no witness ran for this claim"),
    );
  }

  tasks.push(NOT_YET("Paradigm", "no organ exists yet — the same 'difference that makes a difference' gap aperture.js discloses for a whole turn's surprise, unbuilt at claim scope"));

  return cursor == null ? tasks : tasks.map((t) => ({ ...t, cursor }));
}

/** One line per task, natural-frequency phrasing (never "true"/"false" —
 * proof.js's own house style: counted and typed, never asserted). `both`
 * (Belnap's fourth value) is counted separately from `holds`/`fails` —
 * folding it into either would be exactly the averaging-away this repo's
 * own case law (II.8/II.9) forbids. */
export function verificationSummary(tasks) {
  const holds = tasks.filter((t) => t.verdict === "holds").length;
  const fails = tasks.filter((t) => t.verdict === "fails").length;
  const both = tasks.filter((t) => t.verdict === "both").length;
  const gaps = tasks.filter((t) => t.verdict === "gap").length;
  const unbuilt = tasks.filter((t) => t.verdict === "not_yet_executable").length;
  return `${holds} of 9 cells hold, ${fails} fail, ${both} told both ways, ${gaps} gap, ${unbuilt} not yet built`;
}
