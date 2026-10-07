// proposition-holograph.js — THE HOLOGRAPH OF PROPOSITIONS (2026-09-21, the
// user's law, stated verbatim):
//
//   "we really need is to create a holograph of propositions that are
//    1) not pre-existing, so synthetic creations of the LLM
//    2) tied to what both inspired them and what grounds them
//    3) their holonic, Morphogenic placement as written
//    4) their language appropriate parsing
//   and once we have that, they can be recombined as atoms iteratively and
//   recursively"
//
// A PROPOSITION ATOM is one sentence's claim, captured with every tag that
// makes it re-combinable:
//   synthetic  — the model CREATED it (the essay's contribution, INS·Figure);
//                the opposite of a re-stated source sentence
//   inspiredBy — the void/ending that prompted it (provenance, the Notch)
//   groundsOn  — the referents it folds to (the material that anchors it)
//   inspiredBy — THE ACTIVATION SET the turn was handed — the addresses/atoms
//                that prompted it. MECHANICAL, derivable, never self-reported
//                (the dissent in THE-HOLOGRAPH.md: self-attributed provenance
//                is exactly what the record refuses to trust; "a written
//                address is a fabrication order"). The record knows precisely
//                which activation the mouth saw, so inspiration is declared by
//                the machinery and verified by the fold, never asked of the
//                model.
//   typing     — THE THREE-WAY TYPING, bound to the record's own derivation
//                spectrum (Reproduce/Derive/Invent — creativity-table.js),
//                NOT a local heuristic. The two-tier chase decides:
//                  entail  — Reproduce: carries a ground fact's ends verbatim,
//                            byte-addressed (MATERIAL)
//                  derive  — Derive: the shadow chase + record equate FOR WHOM
//                            (run-dmca.js chaseParaphrase) found the record's
//                            own claim row that resolves in this proposition —
//                            grounded-by-meaning, the middle term between
//                            material and self:model, NEVER a model verdict
//                  invent  — Invent: the chase was silent or un-equatable FOR
//                            this whom — the mouth's own, named and disclosed,
//                            never laundered
//   cell       — THE MORPHOGENIC PLACEMENT, DECIDED BY PROVENANCE, never by the
//                model: artifactCell(derivation) (creativity-table.js) reads
//                the 27-cell position off where the span came from. An atom
//                equated-by-meaning MOVES its cell from Invent toward Derive
//                (the same recompute chaseParaphrase already does).
//   inspiredBy — THE ACTIVATION SET the turn was handed — the addresses/atoms
//                that prompted it. MECHANICAL, derivable, never self-reported
//                (the dissent in THE-HOLOGRAPH.md: self-attributed provenance
//                is exactly what the record refuses to trust; "a written
//                address is a fabrication order"). The record knows precisely
//                which activation the mouth saw, so inspiration is declared by
//                the machinery and verified by the fold, never asked of the
//                model.
//
// THE BODY IS THE LOG (2026-09-21, the user's law): "the body of these atoms
// is an append only log and they get FOLDED in to their state — which is how
// they can change or occupy multiple states." An atom's standing is never a
// single field mutated in place — every state it has occupied (CANDIDATE,
// ACCEPTED here, REFUSED there, REVISED) is APPENDED to its history, and the
// atom is FOLDED into its state for a given context. The same proposition can
// be ACCEPTED in the essay's opening and REFUSED in its turn — both true, both
// in the log — because folding is per-context, never a single overwrite. This
// is reconsiderShape's history (append, never edit) applied to every atom.
//
// RECOMBINATION: the essay is ASSEMBLED from atoms, never generated linearly.
// recombineAtomsFor picks the atoms that a void needs — grounded on the void's
// referents, synthetic, not yet placed, matching the position's role — and
// orders them by their morphogenic placement. The holograph IS the memory; the
// essay is a projection of it (the flat documentLines is the serialization,
// exactly as the holon tree).
//
// PURE: no fetch, no DOM, no model call. The holograph is a value; atoms are
// appended, never edited (the EOT discipline — a revision supersedes).
const HOLOGRAPH_SCHEMA = "EOPropositionHolograph@1";
export const STANDINGS = Object.freeze({ CANDIDATE: "CANDIDATE", ACCEPTED: "ACCEPTED", REFUSED: "REFUSED", REVISED: "REVISED" });

export function createPropositionHolograph() {
  return { schema: HOLOGRAPH_SCHEMA, atoms: [], byCore: new Map(), sequence: 0 };
}

// THE FRAME-BEARING IDENTITY (2026-09-21, the read: "proposition identity = a
// byte key over the whole class {ends + frame}, never the bare ends"). The
// mechanical claim-identity strips variance so paraphrase variants reduce to
// the same claim — omnilingual, never a lexicon. BUT a proposition is NOT true
// everywhere: its identity MUST carry its frame (the for-whom jurisdiction:
// giver/question/priors/ground/universe/medium/knowing/recipe — S42/S43). Two
// propositions with the same ends in DIFFERENT frames are DIFFERENT
// propositions (S43: two readings of one book by two recipes are two
// instruments). This is the same move aliases.js made for referents, applied
// to proposition identity: never the bare ends.
const HOLO_STOP = new Set(["the","a","an","and","of","to","in","on","at","for","that","this","from","with","its","it","one","be","so","or","your","our","is","was","were","are","as","by","but","not","no","had","have","has","their","there","then","than","which","would","could","about"]);
const HOLO_VARIANTS = new Set(["played","served","significant","vital","crucial","critical","major","role","growth","port","city","artery","impact","influence","development","journey","course","waterway","river","cumberland","nashville"]);
export function propositionCore(text) {
  return String(text ?? "")
    .toLowerCase().replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim()
    .split(" ").filter((w) => w.length > 3 && !HOLO_STOP.has(w) && !HOLO_VARIANTS.has(w))
    .slice(0, 6).join(" ");
}
// THE BYTE KEY over the whole class: {ends + frame}. A proposition carried out
// of its frame is a DIFFERENT proposition until re-adjudicated FOR the
// destination frame. `frame` is the for-whom jurisdiction the atom was
// asserted under; a null frame is the bare-ends key (the frame-less form — for
// an atom not yet re-adjudicated into any frame).
export function propositionIdentity(text, { frame = null } = {}) {
  const core = propositionCore(text);
  if (!frame) return `bare:${core}`;
  const coords = ["giver","question","priors","ground","universe","medium","knowing","recipe"]
    .map((k) => frame[k] != null ? `${k}=${String(frame[k]).slice(0, 60)}` : null)
    .filter(Boolean).join("&");
  return `${core}@${coords}`;
}

// ── capture: fold one sentence into the holograph as a proposition atom ─────
// Every sentence the model produces is captured — grounded or not, new or
// repeated — because a repeated claim is still evidence about what the model
// defaults to. The TYPING is bound to the RECORD'S OWN DERIVATION SPECTRUM via
// the two-tier chase, never a local heuristic, never asked of the model:
//   entail  (Reproduce) — carries a ground fact's ends verbatim, byte-addressed
//   derive  (Derive)    — the chase (run-dmca.js chaseParaphrase FOR WHOM)
//                         equated it to the record's own claim row: the middle
//                         term, grounded-by-meaning
//   invent  (Invent)    — the chase was silent / un-equatable FOR this whom:
//                         the mouth's own, named and disclosed
// `activation` is the handed activation set (the derivation of inspiredBy —
// declared by the machinery, verified by the fold). `groundFacts` are the
// record's byte-addressed arrangements (verbatim entail). `chase` is the
// PROPOSITION-GRAIN chase result {derivation, equated, unEquatedSpans,
// cell, row, whom} — bound to the atom exactly as the read names it:
// "the equated row — or the named un-equatable — becomes the atom's binding."
// `cell` is the morphogenic placement — artifactCell(derivation), decided by
// provenance, never by the model.
export function captureProposition(holograph, sentence, {
  activation = "", groundFacts = [], chase = null, cell = null, parsing = null, register = null, giver = "the mouth", frame = null, placement = "whole",
} = {}) {
  if (!holograph || !sentence) return null;
  const id = `${holograph.sequence++}`;
  const core = propositionCore(sentence);
  // THE IDENTITY IS FRAME-BEARING (2026-09-21): the atom is keyed over
  // {ends + frame} — a proposition is NOT true everywhere. Two atoms with the
  // same claim in different for-whom frames are DIFFERENT propositions; the
  // byCore registry indexes the frame-bearing identity, never the bare ends.
  const identity = propositionIdentity(sentence, { frame });
  // THE THREE-WAY TYPING, THE CHASE OWNS THE PARAPHRASE (2026-09-21): entail is
  // only the VERBATIM tier — the sentence carries the ground fact's ends as a
  // real phrase (the fact's words appear, not just any shared content word —
  // "the skyline rose where the steamboats once crowded" shares "river" with
  // the flows-fact, but it is NOT that fact verbatim). The DERIVE typing comes
  // from the record's two-tier chase FOR WHOM (run-dmca.js chaseParaphrase) —
  // the shadow chase + record equate decide, never word-overlap, never a
  // model. So: a VERBATIM carry (the ground fact's ends phrase appears) →
  // entail; else the chase's verdict (derive when it equated/moved FOR WHOM,
  // invent when named un-equatable).
  const fold = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f\u0591-\u05c7\u064b-\u0652]/g, "").toLowerCase();
  const toks = (t) => [...new Set(fold(t).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2))];
  const content = toks(sentence);
  // VERBATIM ENTAIL: the ground fact's ends appear AS a phrase (2+ end words
  // together), not any shared content word. A paraphrase that only touches a
  // word is NOT entail — it is the chase's to classify.
  let entailRef = null, entailFact = null, entailHits = 0;
  for (const g of groundFacts ?? []) {
    const endWords = toks(`${g?.end1 ?? ""} ${g?.end2 ?? ""}`);
    const hits = endWords.filter((w) => content.includes(w)).length;
    if (hits > entailHits) { entailHits = hits; entailFact = g?.fact ?? null; entailRef = g?.ref ?? null; }
  }
  const entails = entailHits >= 2;
  // THE CHASE BINDING: the record's verdict on this proposition FOR WHOM —
  // owns the paraphrase tier. A chase-moved or equated span is derive.
  const chaseDerivation = chase?.derivation ?? null;
  const typing = entails ? "entail" : (chaseDerivation === "Derive" ? "derive" : "invent");
  // THE CELL — morphogenic placement DECIDED BY PROVENANCE (the creativity
  // table's 27 cells), never by the model. When the chase moved the atom from
  // Invent toward Derive, the cell follows the recompute — the same movement
  // chaseParaphrase already records.
  const atom = {
    schema: HOLOGRAPH_SCHEMA, id, core: core || sentence.toLowerCase().slice(0, 40),
    identity,
    frame: frame ?? null,
    text: sentence, synthetic: true,
    typing,
    derivation: entails ? "Reproduce" : (chaseDerivation === "Derive" ? "Derive" : "Invent"),
    // THE GRAIN (2026-09-21, the user's axis): every atom sits in the
    // creativity table's three grains — Ground (Void/Field/Atmosphere — the
    // setting), Figure (Being/Link — the named referent), Pattern
    // (Kind/Network — the recurring kind). The grain is READ OFF the cell the
    // provenance landed in (never a guess): the cell's grain IS the atom's.
    // An atom's morphogenic placement is therefore grain × phase × derivation
    // — the complete cell, exactly the register's grid.
    grain: cell?.grain ?? null,
    cell: cell ?? null,
    chase: chase ? { equated: chase.equated, unEquated: chase.unEquated, movedFromInvent: chase.movedFromInvent ?? 0, confirmedCompany: chase.confirmedCompany ?? 0, row: chase.row ?? null, whom: chase.whom ?? null } : null,
    // INSPIRED BY = THE ACTIVATION SET — mechanical, derivable, never
    // self-reported. The record knows exactly what the mouth was handed.
    inspiredBy: String(activation ?? "").slice(0, 400),
    // GROUNDS ON = the byte addresses: the entailed ground fact's ref, or the
    // chase's equated row, or nothing (invent — disclosed).
    groundsOn: entails ? (entailRef ? [entailRef] : []) : (chase?.row ? [chase.row] : []),
    entailRef, entailFact,
    placement: String(placement ?? "whole"),
    parsing: parsing ?? null,
    register: register ?? null,
    giver,
    at: new Date().toISOString(),
    // THE BODY IS THE LOG: the states this atom has occupied, appended never
    // edited. It is born CANDIDATE (one folded state, recorded).
    history: [{ state: STANDINGS.CANDIDATE, context: String(placement ?? "whole"), at: new Date().toISOString() }],
  };
  holograph.atoms.push(atom);
  // INDEXED BY THE FRAME-BEARING IDENTITY, never the bare ends — a proposition
  // carried out of its frame is a different proposition until re-adjudicated.
  if (!holograph.byCore.has(atom.identity)) holograph.byCore.set(atom.identity, []);
  holograph.byCore.get(atom.identity).push(atom);
  return atom;
}

// ── fold: the atom's current state FOR A CONTEXT is folded from its log ─────
// The atom occupies multiple states; the fold reads the log for the context
// in question. `context` is the placement/position being composed. A state
// recorded for that exact context wins; else the last state recorded anywhere
// (the fold never erases — it only reads). A REFUSED state is never folded
// away for the context that refused it: the absence of the wrong path holds.
export function foldAtom(atom, { context = "" } = {}) {
  if (!atom) return STANDINGS.CANDIDATE;
  const log = atom.history ?? [];
  if (!log.length) return STANDINGS.CANDIDATE;
  if (context) {
    const forCtx = [...log].reverse().find((e) => e.context === context || e.context === "any");
    if (forCtx) return forCtx.state;
  }
  return log[log.length - 1].state;
}

// ── settle: APPEND a state to the atom's log — never overwrite ──────────────
// Accepting marks the atoms that were recombined into the essay at a context
// (their claims are now IN the piece there). Refusing records that a context
// rejected them. The same atom can be accepted in one context and refused in
// another — both states sit in its append-only log, and the fold reads the
// right one. A REVISION is also appended (the EOT discipline: supersede, never
// edit — the prior text is the superseded history entry).
export function settleAtoms(holograph, { accept = [], refuse = [], revise = null, context = "any", specimen = "" } = {}) {
  if (!holograph) return { accepted: 0, refused: 0, revised: 0 };
  let accepted = 0, refused = 0, revised = 0;
  const idSet = new Set([...accept, ...refuse, ...(revise ? [revise.id] : [])].filter(Boolean));
  for (const atom of holograph.atoms) {
    if (!idSet.has(atom.id)) continue;
    let state = null;
    if (accept.includes(atom.id)) state = STANDINGS.ACCEPTED;
    else if (refuse.includes(atom.id)) state = STANDINGS.REFUSED;
    else if (revise && revise.id === atom.id) state = STANDINGS.REVISED;
    if (!state) continue;
    // APPEND, never edit — the EOT discipline. The atom's log keeps every
    // state it has occupied; folding reads the current one per context.
    atom.history.push({ state, context: String(context ?? "any"), specimen: String(specimen ?? "").slice(0, 120), at: new Date().toISOString() });
    if (revise && revise.id === atom.id && revise.text) {
      atom.previousText = atom.text;
      atom.text = revise.text;
      atom.revisedAt = new Date().toISOString();
    }
    if (state === STANDINGS.ACCEPTED) accepted++;
    else if (state === STANDINGS.REFUSED) refused++;
    else revised++;
  }
  return { accepted, refused, revised };
}

// ── recombine: pick the atoms a void needs, ordered by placement ────────────
// The void names what the position requires: the activation it was handed
// (`activation`), its role (opening/turn/resolution — the fate), and its
// placement. The recombination returns the atoms that are re-combinable at
// this context (not already accepted/refused here), ordered by typing (entail
// first — byte-grounded; then inspired — synthetic resting on the activation;
// invent last) and by morphogenic placement. This is the essay composed from
// atoms, iteratively and recursively: an inspired atom rests on the atoms it
// was seeded by — recombination can place it once those are in the piece.
export function recombineAtomsFor(holograph, { activation = [], placement = "whole", role = "turn", max = 6, excludeCores = new Set() } = {}) {
  if (!holograph) return [];
  const want = new Set(activation ?? []);
  const typingOrder = { entail: 0, inspired: 1, invent: 2 };
  const roleOrder = { opening: 0, turn: 1, resolution: 2 };
  const pool = [];
  for (const atom of holograph.atoms) {
    if (excludeCores.has(atom.core)) continue;
    // The atom's state AT THIS CONTEXT is folded from its log: if the essay
    // has already accepted it here, it is spent; if this context refused it,
    // it is absent (the wrong path is not there). A CANDIDATE/REVISED fold
    // leaves it re-combinable.
    const folded = foldAtom(atom, { context: placement });
    if (folded === STANDINGS.ACCEPTED || folded === STANDINGS.REFUSED) continue;
    // Anchored on the void's own activation (when the void names any): the
    // atom's CONTENT WORDS — the claim itself — must carry what the void
    // reached. The byte-ref groundsOn is how it is bound to the source; the
    // activation match is whether it is ABOUT the void. Both hold.
    if (want.size) {
      const atomWords = new Set(String(atom.text ?? "").toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 3));
      const touch = [...want].some((w) => atomWords.has(w.toLowerCase()));
      if (!touch) continue;
    }
    pool.push(atom);
  }
  pool.sort((a, b) => {
    const ta = typingOrder[a.typing] ?? 1;
    const tb = typingOrder[b.typing] ?? 1;
    if (ta !== tb) return ta - tb;
    const ra = roleOrder[a.placement.split(".").pop()] ?? 1;
    const rb = roleOrder[b.placement.split(".").pop()] ?? 1;
    if (ra !== rb) return ra - rb;
    return String(a.placement).localeCompare(String(b.placement));
  });
  return pool.slice(0, max);
}

// ── accept / refuse: a recombination's verdict is recorded on the atoms ─────
// Accepting marks the atoms that were recombined into the essay (their claims
// are now IN the piece — a later recombination must not re-place them).
// Refusing marks atoms that the recombination rejected (evidence about the
// model's defaults; kept for the record, never re-placed).
// ── the essay as a projection of the holograph ──────────────────────────────
// The flat documentLines is the accepted atoms in placement order — the
// serialization, never the shape (exactly the holon-tree law).
export function projectHolograph(holograph) {
  if (!holograph) return [];
  const roleOrder = { opening: 0, turn: 1, resolution: 2 };
  const rank = (p) => {
    const segs = String(p ?? "whole").split(".");
    return (segs[0] === "whole" ? 0 : 1) * 100 + (roleOrder[segs[1]] ?? 1) * 10 + (roleOrder[segs[2]] ?? 1);
  };
  return holograph.atoms
    .filter((a) => (a.history ?? []).some((e) => e.state === STANDINGS.ACCEPTED))
    .sort((a, b) => rank(a.placement) - rank(b.placement) || String(a.placement).localeCompare(String(b.placement)))
    .map((a) => a.text);
}