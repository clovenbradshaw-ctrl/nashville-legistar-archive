// organs/void-outline.js — THE RECURSIVE VOID: a trajectory derived from the
// record, never a template. The plan is not a list of sections; it is a
// sequence of PHASES with TYPED TRANSITIONS between them — the phaseposts are
// the essay's spine (2026-09-13, user direction: "the transition is what is
// most important").
//
// Handle: Friston / Warburg — the future shape drawn from the past priors
// (the generative model predicts the essay's own next phase), arranged by
// affinity into boards. Vonnegut shapes the arc; Whitehead ends it at the
// satisfaction; the template is a fallback for an empty record, never the
// source.
//
// THE OUTLINE IS A PREDICTION, NOT A FORM: phases come from the record's
// CENTRAL beings (ranked by recurrence + proper-name signal), ordered along
// the record's own seams, each carrying ONLY the propositions that share its
// referents (so no phase restates another — the whole-essay novelty rule,
// made structural). The arc is Vonnegut's fortune curve: phases are ordered
// and merged so cumulative claim-coverage CLIMBS toward the satisfaction.
//
// RECURSION: the void re-DEFs itself when the record grows. `reopensOn`
// names the conditions (a new being, a new seam, a phase whose claims are
// exhausted); `update` supersedes spent phases and appends new ones — a
// correction is a superseding entry, never an edit (the ledger's own law).
//
// PURE. The record is handed in (referents, propositions, seams, voids);
// this organ holds no fold of its own.

const STALE = "stale";      // the register changes — a new altitude on old ground
const COLLAPSE = "collapse"; // the ground was most wrong here — re-scope at the seam
const CONTESTED = "contested"; // the knot — resolve what the record disputes

const keyOf = (p) => `${p.end1 ?? ""}|${p.label ?? ""}|${p.end2 ?? ""}`;

/**
 * outlineFromRecord({ topic, referents, propositions, seams, voids, maxPhases })
 * → { phases, arc, reopensOn, basis }
 * `referents` are ALREADY ranked beings ({name, mentions} — the caller ranks
 * by being-quality). `propositions` are the record's claims
 * ({end1,label,end2}). `seams` are the record's own boundaries (indices into
 * its stream). `voids` are the reading's open questions.
 */
export function outlineFromRecord({ topic, referents = [], propositions = [], seams = [], voids = [], maxPhases = 7 } = {}) {
  const t = String(topic ?? "").trim() || "this subject";
  const phases = [];
  const covered = new Set();

  // ── PHASE 0: the subject itself, marked off — the base every essay needs.
  const base = {
    id: "base", cell: "NUL·Ground", focus: t,
    claims: [], transition: null,
    question: `What is ${t}, marked off from everything adjacent to it — what space is this essay, and what is it NOT?`,
  };
  phases.push(base);

  // ── PHASES 1..N: the record's central beings — the real sections. Each
  // carries ONLY the propositions sharing its referents (resolved through a
  // case/affinity match on the names), so a phase cannot restate another.
  const focusOf = (r) => {
    const n = String(r.name ?? r).toLowerCase();
    const words = n.split(/\s+/);
    return (p) => {
      const s = String(p.end1 ?? "").toLowerCase();
      const o = String(p.end2 ?? "").toLowerCase();
      return s.includes(n) || o.includes(n) || words.some((w) => w.length > 3 && (s.includes(w) || o.includes(w)));
    };
  };
  for (const r of referents.slice(0, Math.max(1, maxPhases - 1))) {
    const name = String(r.name ?? r);
    const claims = propositions.filter(focusOf(r));
    const fresh = claims.filter((p) => !covered.has(keyOf(p)));
    // A phase whose claims are ALL already covered would flatline the arc —
    // merged, not emitted (Vonnegut: a section that adds nothing argues nothing).
    if (phases.length > 1 && !fresh.length) continue;
    for (const p of fresh) covered.add(keyOf(p));
    phases.push({
      id: `ref:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      cell: "SIG·Figure", focus: name, claims: fresh.slice(0, 12),
      transition: null,
      question: `What is ${name}, and how does it relate to ${t}?`,
    });
  }

  // ── TRANSITIONS: the phaseposts — the load-bearing part. Each adjacent
  // pair gets a typed re-ground, derived from the record, never invented.
  //   collapse  → the record's own seam falls between the two phases' claim
  //               regions: the ground was most wrong HERE — re-scope.
  //   contested → the record disputes claims in both phases — resolve the knot.
  //   stale     → the register simply changes (the default new altitude).
  // `seams` are the record's surprise-segment boundaries; we approximate the
  // claim-region of a phase by the position of its claims' earliest mention
  // when the caller supplies ordered propositions with a `seq`.
  const seqOf = (p) => (p.seq ?? Infinity);
  const regionOf = (phase) => {
    if (!phase.claims.length) return null;
    const ats = phase.claims.map(seqOf).filter((n) => Number.isFinite(n));
    return ats.length ? { lo: Math.min(...ats), hi: Math.max(...ats) } : null;
  };
  const seamBetween = (a, b) => {
    const ra = regionOf(a), rb = regionOf(b);
    if (!ra || !rb) return false;
    return seams.some((s) => s > ra.hi && s < rb.lo);
  };
  for (let i = 1; i < phases.length; i++) {
    const prev = phases[i - 1], cur = phases[i];
    if (seamBetween(prev, cur)) {
      cur.transition = { kind: COLLAPSE, basis: `the record's own seam falls between "${prev.focus}" and "${cur.focus}" — the ground was most wrong here; re-scope to the boundary` };
    } else if (propositions.some((p) => /dispute|contradict|contested|disagre/i.test(String(p.label ?? "")))) {
      cur.transition = { kind: CONTESTED, basis: `the record disputes claims touching "${cur.focus}" — resolve the knot, never silently pick a winner` };
    } else {
      cur.transition = { kind: STALE, basis: `the register moves from "${prev.focus}" to "${cur.focus}" — a new altitude on the established ground` };
    }
  }

  // ── THE ARC (Vonnegut): the predicted fortune curve — cumulative fresh
  // claims per phase. The satisfaction shape: monotonic climb to the peak.
  const arc = [];
  let cum = 0;
  for (const ph of phases) { cum += ph.claims.length; arc.push({ phase: ph.focus, freshClaims: ph.claims.length, cumulative: cum }); }
  const flatlines = phases.filter((p, i) => i > 0 && arc[i].freshClaims === 0).map((p) => p.focus);

  // ── RECURSION: the conditions under which the void re-DEFs itself.
  const reopensOn = [
    { when: "new_being", detail: "a referent the outline never named clears its recurrence floor — it is a phase the void must grow to include" },
    { when: "new_seam", detail: "a new surprisal boundary lands between two phases — the transition must be re-scoped there" },
  ];
  if (flatlines.length) reopensOn.push({ when: "phase_exhausted", detail: `no fresh claims: ${flatlines.join(", ")} — merge or supersede, never restate` });

  return {
    schema: "EOVoidOutline@1",
    topic: t,
    phases,
    transitions: phases.slice(1).map((p) => ({ from: p.transition.basis.includes("previous") ? phases[0].focus : phases[Math.max(0, phases.indexOf(p) - 1)].focus, to: p.focus, ...p.transition })),
    arc,
    targetArc: "rising",
    reopensOn,
    basis: `derived from the record: ${referents.length} ranked being(s), ${propositions.length} propositions, ${seams.length} seam(s); ${phases.length} phase(s) ordered toward a rising fortune curve`,
  };
}

/**
 * updateOutline(outline, { referents, propositions, seams, voids, coveredKeys })
 * → { superseded, appended, outline } — the recursive re-DEF. Spent phases
 * (all claims covered) are superseded; new beings become appended phases with
 * a typed transition from the current tip. A correction is a superseding
 * entry, never an edit.
 */
export function updateOutline(outline, { referents = [], propositions = [], seams = [], coveredKeys = new Set() } = {}) {
  if (!outline?.phases) throw new TypeError("updateOutline requires an EOVoidOutline@1");
  const topic = outline.topic;
  const kept = outline.phases.filter((p) => {
    if (p.id === "base") return true;
    const fresh = p.claims.filter((c) => !coveredKeys.has(keyOf(c)));
    return fresh.length > 0;
  });
  const superseded = outline.phases.filter((p) => !kept.includes(p));
  const existing = new Set(kept.map((p) => p.focus.toLowerCase()));
  const newRefs = referents.filter((r) => !existing.has(String(r.name ?? r).toLowerCase())).slice(0, 3);
  const appended = newRefs.map((r) => {
    const name = String(r.name ?? r);
    const claims = propositions.filter((p) => String(p.end1 ?? "").toLowerCase().includes(name.toLowerCase()) || String(p.end2 ?? "").toLowerCase().includes(name.toLowerCase())).filter((p) => !coveredKeys.has(keyOf(p))).slice(0, 12);
    const tip = kept[kept.length - 1];
    return {
      id: `ref:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, cell: "SIG·Figure", focus: name, claims,
      transition: { kind: STALE, basis: `the reading grew and established "${name}" — a new phase past "${tip?.focus ?? topic}"` },
      question: `What is ${name}, and how does it relate to ${topic}?`,
    };
  });
  const next = { ...outline, phases: [...kept, ...appended] };
  return { superseded, appended, outline: next };
}