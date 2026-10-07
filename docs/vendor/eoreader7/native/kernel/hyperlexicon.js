/* Xushen speaks:
 * “The aim of Hsii-shén was to impede any ulterior altera- 
tion of the characters, by setting their authentical form before the eyes of all 

scholars.”
 *
 * This file, `eoreader7/native/kernel/hyperlexicon.js`, embodies Xushen's contribution to the construction of a dictionary grounded in attested usage rather than decree.  The challenge lies in navigating the potential for a lexicon to become a tool for imposing a particular understanding of language, rather than a tool for understanding how language is actually used.
 *
 * — the engineering record below, kept whole —
 */
// Canonical EOReader 7 Hyperlexicon.
// Handle: Xushen — after the Shuowen Jiezi, the first dictionary built from attested character usage rather than decree. Amendment XVII.
//
// HL is not a vocabulary or synonym table. It is an explicit ledger of
// relation-composition affordances. Experience may nominate candidates; only
// a GIVEN affordance with a named giver licenses composition.
//
// THE WHEEL (native/docs/THE-WHEEL.md): HL is the FIELD — the accumulated
// ground the reading stands on, the void's own content (register name TBD).

const freeze = (value) => Object.freeze(value);
const stable = (value) => typeof value === "string" ? value : JSON.stringify(value);
export const pairKey = (left, right) => `${stable(left)}\u0000${stable(right)}`;

export const HL_SCHEMA = "EOHyperlexicon@1";
export const HL = "Hyperlexicon";

const provenanceFor = (entry = {}) => freeze({
  giver: entry.giver ?? entry.provenance?.giver ?? null,
  basis: entry.provenance?.basis ?? (entry.standing === "given"
    ? "explicitly given relation-composition affordance"
    : entry.standing === "candidate"
      ? "observed relation adjacency nominated for consideration"
      : "no composition affordance has been given"),
});

const normalizeAffordance = (entry = {}) => freeze({
  left: entry.left,
  right: entry.right,
  standing: entry.standing ?? "unknown",
  giver: entry.giver ?? entry.provenance?.giver ?? null,
  // THE BINDING (ethos-in-the-core law, 2026-09-16): the real charter content
  // hash a GIVEN license row was extracted from. Carried on the row so the
  // reaction substrate can verify that a license's giver is not a reputation
  // string but a bound, verifiable ground. Chemistry rows (transitivity,
  // closure) carry no binding — they are structural reasoning, not licenses,
  // and are kept apart from the moral license tier.
  binding: entry.binding ?? null,
  witnesses: freeze([...(entry.witnesses ?? [])]),
  provenance: provenanceFor(entry),
  meta: freeze({ ...(entry.meta ?? {}) }),
});

export function createHyperlexicon({ composition = [], meta = {} } = {}) {
  const table = Object.create(null);
  const entries = Array.isArray(composition)
    ? composition
    : Object.entries(composition).map(([key, value]) => ({
        ...(typeof value === "string" ? { standing: value } : value),
        _key: key,
      }));

  for (const raw of entries) {
    const entry = normalizeAffordance(raw);
    const key = raw._key ?? pairKey(entry.left, entry.right);
    table[key] = entry;
  }

  return freeze({
    schema: HL_SCHEMA,
    composition: freeze(table),
    meta: freeze({ ...meta }),
  });
}

export function normalizeHyperlexicon(input = null) {
  if (!input) return createHyperlexicon();
  if (input.schema === HL_SCHEMA && input.composition) return input;
  if (Array.isArray(input)) return createHyperlexicon({ composition: input });
  if (input.composition) return createHyperlexicon({ composition: input.composition, meta: input.meta });
  return createHyperlexicon({ composition: input });
}

export function compositionAffordance(hyperlexicon, left, right, { leftGrain = null, rightGrain = null } = {}) {
  const hl = normalizeHyperlexicon(hyperlexicon);
  // EXACT label-pair first (the text-specific chemistry — "approached"∘
  // "began").
  const exact = hl.composition[pairKey(left, right)];
  if (exact?.standing === "given") return exact;
  // STRUCTURAL fallback (2026-09-13 — omnilingual/omnimodal chemistry). An
  // affordance keyed on the GRAIN (the cube's medium-blind Figure/Pattern
  // axis) licenses composition for ANY label pair of that grain — the same
  // chain shape in English, French, Russian, audio, video. This is the
  // "AN ARRANGEMENT HAS ENDS, NOT PARTS OF SPEECH" law applied to
  // chemistry: the positions compose through a shared referent, and the
  // grain is the invariant that crosses texts and modalities. VERB/AUX
  // are English lenses; the grain is not. A structural affordance is
  // declared by the giver with left/right as `grain:<GRAIN>` wildcards;
  // the caller supplies the relations' actual grains. It never shadows an
  // exact given affordance.
  if (leftGrain) {
    const structural = hl.composition[pairKey(`grain:${leftGrain}`, rightGrain ? `grain:${rightGrain}` : "*")]
      ?? hl.composition[pairKey(`grain:${leftGrain}`, "*")];
    if (structural?.standing === "given") return structural;
  }
  if (rightGrain) {
    const structural = hl.composition[pairKey("*", `grain:${rightGrain}`)];
    if (structural?.standing === "given") return structural;
  }
  const any = hl.composition[pairKey("*", "*")];
  if (any?.standing === "given") return any;
  return exact ?? normalizeAffordance({ left, right, standing: "unknown" });
}

export function admitHyperlexiconCandidates(hyperlexicon, candidates = []) {
  const hl = normalizeHyperlexicon(hyperlexicon);
  const composition = { ...hl.composition };

  for (const raw of candidates) {
    const candidate = normalizeAffordance({ ...raw, standing: "candidate" });
    const key = pairKey(candidate.left, candidate.right);
    const current = composition[key];
    if (current?.standing === "given") continue;

    const witnessByKey = new Map();
    for (const witness of [...(current?.witnesses ?? []), ...(candidate.witnesses ?? [])]) witnessByKey.set(stable(witness), witness);

    composition[key] = normalizeAffordance({
      left: candidate.left,
      right: candidate.right,
      standing: "candidate",
      giver: current?.giver ?? candidate.giver ?? null,
      witnesses: [...witnessByKey.values()],
      provenance: {
        giver: current?.provenance?.giver ?? candidate.provenance?.giver ?? null,
        basis: "observed relation adjacency nominated for consideration; nomination is not reasoning permission",
      },
      meta: { ...(current?.meta ?? {}), ...(candidate.meta ?? {}), observed: true },
    });
  }

  return createHyperlexicon({ composition, meta: hl.meta });
}

export function giveHyperlexiconAffordance(hyperlexicon, { left, right, giver, binding = null, witnesses = [], meta = {} } = {}) {
  if (left === undefined || right === undefined) throw new TypeError("giveHyperlexiconAffordance: left and right are required");
  if (!giver) throw new TypeError("giveHyperlexiconAffordance: giver is required");
  const hl = normalizeHyperlexicon(hyperlexicon);
  return createHyperlexicon({
    meta: hl.meta,
    composition: {
      ...hl.composition,
      [pairKey(left, right)]: {
        left,
        right,
        standing: "given",
        giver,
        binding,
        witnesses,
        provenance: { giver, basis: binding
          ? `explicitly given relation-composition affordance, bound to charter content ${String(binding).slice(0, 16)}…`
          : meta?.chemistry
            ? "explicitly given relation-composition affordance — structural chemistry, stamped by the reading's own chemistry path (a derivation rule), not a charter license"
            : "explicitly given relation-composition affordance" },
        meta,
      },
    },
  });
}

// THE ETHOS-IN-THE-CORE LAW, stated as a pure check: is this given affordance
// a LICENSE (bound to a real charter's content) or structural CHEMISTRY (a
// derivation rule produced by the reading's own chemistry path — transitivity
// and closure rows carry `meta.yields`)? A substrate standing on a real
// charter licenses only the former; the latter is reasoning, not permission,
// and is kept apart from the moral tier.
//
// The binding is the project's short-digest content hash (sha256hex's first
// 32 hex chars — the same convention charter.sha256 uses, and the convention
// the constitution's own charter carries). It is a fingerprint of the REAL
// governing text, never a name: a caller minting a license under a fake
// charter cannot reproduce the ground's binding without reproducing the real
// bytes. Accept 32-char short digests (the project convention) and full
// 64-char digests alike, because the law is BINDING, not length.
//
// A given affordance that is NEITHER charter-bound NOR a derivation rule is
// UNGROUNDED: a giver with no ground and no chemistry is a reputation label,
// and it licenses nothing — "no generation from no-where."
export function licenseStanding(affordance, charter = null) {
  if (affordance?.standing !== "given") return { licensed: false, standing: affordance?.standing ?? "unknown", why: "not a given affordance — nothing to license" };
  const hasBinding = typeof affordance.binding === "string" && /^[0-9a-f]{32,64}$/i.test(affordance.binding);
  if (hasBinding) {
    const groundHash = charter?.sha256 ?? null;
    if (!groundHash) {
      return { licensed: false, standing: "given", tier: "license", why: "a charter-bound license row was offered, but the substrate has no charter to verify it against — no ground, no license. This is exactly Aristotle's pre-existing good character: refused as a technical means of persuasion" };
    }
    if (affordance.binding !== groundHash) {
      return { licensed: false, standing: "given", tier: "license", why: `the license's binding (${affordance.binding.slice(0, 16)}…) does not match this substrate's charter (${String(groundHash).slice(0, 16)}…) — the giver is not THIS ground, so it licenses nothing here` };
    }
    return { licensed: true, standing: "given", tier: "license", why: "charter-bound license — the giver's ground is this substrate's charter, verified against real content" };
  }
  // Not bound. Is it structural chemistry — a derivation rule stamped by the
  // reading's own chemistry path (closureAffordances/affordancesFromDeclarations
  // mark their rows `meta.chemistry: true`)? A bare unmarked given row is a
  // reputation label from no-where and does not license.
  const isChemistry = affordance.meta?.chemistry === true || affordance.meta?.yields != null;
  if (isChemistry) {
    return { licensed: true, standing: "given", tier: "chemistry", why: "structural chemistry — a derivation rule (chemistry-stamped) from the reading's own chemistry path; reasoning, not permission, kept apart from the moral license tier" };
  }
  // A given row with no charter binding and no yields is a reputation label
  // from no-where. It does not license. This is the wall the adversarial pass
  // spent a night discovering (permit+torture minted under a bare giver
  // string): the giver is not bound and the row is not chemistry — refused.
  return { licensed: false, standing: "given", tier: "ungrounded", why: "a given affordance that is neither charter-bound nor a derivation rule — a giver with no ground and no chemistry. It licenses nothing; generation from no-where is refused" };
}
