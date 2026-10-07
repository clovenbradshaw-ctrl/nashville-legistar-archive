// void-shape.js — zero the space, then see what still depends on nothing.
//
// User direction, 2026-08-26: "we need to zero the space. define the VOID,
// the shape that needs to be filled." Corrected later the same project,
// 2026-09-16: "void" here is not absence in the nihilist sense — a bare
// hole where content should be — it is void in Nagarjuna's sense
// (sunyata): nothing admitted to this space gets to stand on its own,
// independent, self-sufficient, closing the question by itself. A filler
// stands only for what it is actually, dependently shown to cover. What
// LOOKS like a leftover hole after a filler is admitted is not an absence
// this file failed to fill — it is the honest record that the filler
// admitted so far never claimed, and was never granted, more than its own
// dependent extent.
//
// THE PROBLEM THIS EXISTS FOR, measured live and repeatedly this day.
// "Who was Lincoln's vice president?" was answered "Hannibal Hamlin" on one
// draw and "Andrew Johnson" on the next. Each is a true sentence. Neither is
// THE answer, because each is being read as if it stood on its own —
// complete, unconditioned, the whole of what "Lincoln's VP" refers to —
// when each in fact only holds for its own conditioned span of the term.
// Every mechanism tried first read the answer's completeness off the
// ANSWER — grammatical number (a singular noun read as license to treat
// one filler as inherently sufficient, closed in web-claim.js), or
// filler-counting over extracted prose (which at page scale returns
// "Though he", "Congress", "22nd Amendment" — real edges, useless
// subjects). Both mistakes are the same mistake: granting a filler a
// standing (completeness) it never earned and was never shown to hold.
//
// The move here is to stop asking the answer whether it is complete and ask
// the SPACE instead. A slot is not a bag of fillers each claiming the whole
// of it; it is an extent with dimensions, and a filler covers only the part
// of that extent it is actually, dependently shown to cover. Lincoln's
// presidency runs 1861-1865. Johnson covers 1865. What is left — 1861 to
// 1865 — is not a gap this file failed to notice; it is what remains
// undependent-on-anything once Hamlin's own real, partial standing is
// taken for exactly what it is and no more. THAT is what makes a second
// filler NECESSARY rather than hoped-for, and finding it needs no prose
// extraction at all: only the constraint, the fillers' own honestly-scoped
// extents, and arithmetic — arithmetic being the one place a claim of
// coverage can be checked without taking anyone's word for it.
//
// WHAT THIS FILE IS NOT. It does not read dates out of text, does not
// resolve referents, and does not decide what a filler is. Those are the
// caller's, and keeping them out is deliberate: the one thing here that
// must be trustworthy is the arithmetic, and arithmetic over declared
// intervals can be tested exhaustively while a date parser cannot. The one
// text-facing convenience at the bottom (`yearSpansIn`) is disclosed as a
// convenience, is never required, and names its own scope.
//
// P4: every number is the caller's. There is no default extent, no default
// tolerance, no assumed calendar.

/** A closed interval [from, to] over any ordered numeric dimension. */
const isSpan = (s) =>
  !!s && Number.isFinite(s.from) && Number.isFinite(s.to) && s.from <= s.to;

// ── DEFINING THE VOID: all nine operators, one pass ────────────────────
//
// User direction, 2026-08-26: "we need the first step to define what the
// VOID is, using all 9 operators."
//
// Zeroing a space is not one declaration, it is nine. Each operator in the
// closed algebra asks a different question about a space BEFORE anything
// stands in it, and a space missing any of them is under-specified in a way
// that shows up later as a wrong answer rather than as an error. The
// previous version of this file declared two of the nine — the slot (NUL)
// and the extent (SEG) — and called that a zeroed space. It was not; it was
// a space with seven silent assumptions.
//
// The nine, with what each contributes and what its absence cost on the
// live specimen ("who was lincoln's vp?"):
//
//   EXISTENCE — is there a space here at all?
//   NUL  Differentiate/Void      what space, marked off from all it is not
//                                → the slot itself
//   SIG  Relate/Entity           what must resolve for the space to exist
//                                → Abraham Lincoln. Undeclared, "lincoln"
//                                  matched Lincoln Motor Company and the
//                                  reading answered from car brochures.
//   INS  Generate/Kind           what KIND of thing may stand here
//                                → a person. Undeclared, the slot query
//                                  returned "Congress", "22nd Amendment",
//                                  "Though he" as candidate vice presidents.
//
//   STRUCTURE — what shape does it have?
//   SEG  Differentiate/Field     the extent and its units
//                                → 1861-1865, years. This is the dimension
//                                  the hole is measured along.
//   CON  Relate/Link             the relation binding filler to anchor
//                                → "was vice president of"
//   SYN  Generate/Network        how fillers compose across the extent
//                                → successive terms partition it; they do
//                                  not overlap and do not repeat.
//
//   INTERPRETATION — how is it judged filled?
//   DEF  Differentiate/Lens      the declared cardinality
//                                → unknown. Read off grammar it said
//                                  "single", and one true filler closed a
//                                  two-filler space — grammar had granted
//                                  Hamlin a completeness the material never
//                                  gave him.
//   EVA  Relate/Paradigm-Figure  what a candidate must be shown to depend
//                                on before any of it counts as covered —
//                                never granted on the strength of the
//                                candidate's own say-so
//                                → its span is shown, not assumed, to lie
//                                  within the extent
//   REC  Generate/Paradigm       what forces the declaration to be revised
//                                — nothing declared here is exempt from
//                                  this, including a space once read as
//                                  fully covered
//                                → an uncovered stretch: something else
//                                  must be depended on to hold it.
//
// EVERY FIELD IS OPTIONAL AND EVERY OMISSION IS TYPED. A caller that cannot
// state one gets a declared gap for that operator, never a default — and
// `undeclaredOf` returns exactly those gaps, so the void's OWN definition
// can be inspected for holes by the same move the space itself gets. That
// recursion is the point rather than a flourish: an under-specified void
// is the thing that produced every confident wrong answer today, and it
// should be as visible as the missing filler is.
//
// `cellOf` is INJECTED, never imported (the cast.js discipline this repo
// holds for every production module): the algebra belongs to the engine,
// and this file must not carry a second copy of it.

const VOID_OPERATORS = Object.freeze([
  ["NUL", "Ground", "slot", "what space this is, marked off from all it is not"],
  ["SIG", "Figure", "anchor", "what must resolve for this space to exist at all"],
  ["INS", "Pattern", "admits", "what kind of thing may stand here"],
  ["SEG", "Ground", "extent", "the extent to be covered, and its units"],
  ["CON", "Figure", "relation", "what binds a filler to the anchor"],
  ["SYN", "Pattern", "composition", "how fillers compose across the extent"],
  ["DEF", "Figure", "cardinality", "how many fillers the space is declared to hold"],
  ["EVA", "Figure", "admission", "what a candidate must be shown to depend on before it counts as covering any of this — never granted on its own say-so"],
  ["REC", "Pattern", "reopensOn", "what forces this declaration to be revised"],
]);

/**
 * Declare a void across all nine operators. Returns the specification plus
 * the fields `zeroSpace` needs, so a caller declares once and the
 * arithmetic below reads from the same declaration rather than a second,
 * drifting copy of the extent.
 */
export function declareVoid(fields = {}, { cellOf = null } = {}) {
  if (typeof cellOf !== "function")
    throw new TypeError("declareVoid: cellOf is injected from the engine's own cube — this file never carries a second copy of the algebra");
  const cells = [];
  const undeclared = [];
  for (const [op, grain, field, asks] of VOID_OPERATORS) {
    const cell = cellOf(op, grain);
    if (cell?.gap) throw new TypeError(`declareVoid: the injected cube rejected ${op}/${grain} — ${cell.reason ?? "unknown"}`);
    const declared = fields[field];
    const present = declared !== undefined && declared !== null && declared !== "";
    if (!present) undeclared.push({ op, field, asks, terrain: cell.terrain });
    cells.push(Object.freeze({
      op, field, asks,
      grain: cell.grain, mode: cell.mode, domain: cell.domain,
      terrain: cell.terrain, stance: cell.stance,
      declared: present ? declared : null,
      standing: present ? "declared" : "undeclared",
    }));
  }
  return Object.freeze({
    schema: "EOVoidDeclaration@1",
    cells: Object.freeze(cells),
    undeclared: Object.freeze(undeclared),
    // The void's own completeness, by the same rule it applies to fillers.
    standing: undeclared.length ? "under-specified" : "specified",
    slot: fields.slot ?? null,
    extent: fields.extent ?? null,
    dimension: fields.dimension ?? null,
  });
}

/**
 * The holes in the void's OWN definition — which operators were never
 * answered, as a line a reader (or a model) can act on.
 */
export function undeclaredOf(declaration) {
  if (declaration?.schema !== "EOVoidDeclaration@1") throw new TypeError("undeclaredOf: not an EOVoidDeclaration@1");
  if (!declaration.undeclared.length)
    return `all nine operators are declared for "${declaration.slot ?? "this space"}" — the space is fully specified`;
  return (
    `"${declaration.slot ?? "this space"}" is under-specified: ` +
    declaration.undeclared.map((u) => `${u.op} (${u.terrain}) — ${u.asks}`).join("; ")
  );
}

/** Hand a nine-operator declaration straight to the arithmetic below. */
export function spaceFrom(declaration) {
  if (declaration?.schema !== "EOVoidDeclaration@1") throw new TypeError("spaceFrom: not an EOVoidDeclaration@1");
  return zeroSpace({
    slot: declaration.slot,
    constraint: declaration.extent ?? null,
    dimension: declaration.dimension ?? null,
  });
}

/**
 * Zero the space. `constraint` is the extent the slot must cover — the
 * dimension along which the question is asked. Nothing is assumed about it:
 * a caller that cannot state the extent gets a space that can never report
 * a void, which is the honest outcome (you cannot see a hole in a shape you
 * never declared).
 *
 * `dimension` is a free label naming what the extent measures ("years",
 * "pages", "frames") — carried through to every finding so a reader is
 * never left guessing what 1861 counts.
 */
export function zeroSpace({ slot, constraint = null, dimension = null } = {}) {
  if (typeof slot !== "string" || !slot.trim())
    throw new TypeError("zeroSpace: a slot names what is being filled — it is never blank");
  if (constraint !== null && !isSpan(constraint))
    throw new TypeError("zeroSpace: a constraint is a closed interval {from, to} with from <= to, or null when the extent is genuinely unknown");
  return Object.freeze({
    schema: "EOVoidShape@1",
    slot: slot.trim(),
    constraint: constraint ? Object.freeze({ ...constraint }) : null,
    dimension,
    fillers: Object.freeze([]),
  });
}

/**
 * Admit a filler for exactly the extent it is shown to cover — never more.
 * Append-only: a new space is returned, the old one stays valid, and a
 * filler is never overwritten by a later one that happens to share its
 * name — two witnesses to the same being covering different extents is
 * exactly the Lincoln case, and collapsing them would grant one of them a
 * completeness neither ever earned, erasing the very structure this file
 * exists to find.
 */
export function fill(space, { filler, span = null, source = null } = {}) {
  if (space?.schema !== "EOVoidShape@1") throw new TypeError("fill: not an EOVoidShape@1");
  if (typeof filler !== "string" || !filler.trim())
    throw new TypeError("fill: a filler is named, never blank");
  if (span !== null && !isSpan(span))
    throw new TypeError("fill: a span is a closed interval {from, to} with from <= to, or null when this filler's extent is unknown");
  return Object.freeze({
    ...space,
    fillers: Object.freeze([
      ...space.fillers,
      Object.freeze({ filler: filler.trim(), span: span ? Object.freeze({ ...span }) : null, source }),
    ]),
  });
}

/** Merge overlapping/adjacent spans into the fewest covering intervals. */
const merge = (spans) => {
  const sorted = [...spans].sort((a, b) => a.from - b.from || a.to - b.to);
  const out = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    // `s.from <= last.to` only — NOT `<= last.to + 1`. Adjacency is a claim
    // about the dimension's own granularity (are 1864 and 1865 touching, or
    // is there a year between them?) and this file does not know the
    // caller's granularity. Treating them as separate can only ever report
    // a void that is real-but-tiny; treating them as joined could hide one.
    if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
    else out.push({ from: s.from, to: s.to });
  }
  return out;
};

/**
 * THE VOID: every stretch of the declared constraint that no filler covers.
 *
 * Returns typed findings rather than a bare boolean, because "the space is
 * incomplete" and "the space is complete" and "the space was never given an
 * extent to be complete WITHIN" are three different facts and a caller must
 * be able to tell them apart — the same distinction grounding.js already
 * holds between `clean` and `examined`.
 */
export function voidsOf(space) {
  if (space?.schema !== "EOVoidShape@1") throw new TypeError("voidsOf: not an EOVoidShape@1");
  if (!space.constraint) {
    return Object.freeze({
      standing: "unbounded",
      reason: `the extent of "${space.slot}" was never declared — with no shape to fill, no hole in it can be seen`,
      voids: Object.freeze([]),
      covered: Object.freeze([]),
      unplaced: Object.freeze(space.fillers.filter((f) => !f.span).map((f) => f.filler)),
    });
  }
  const { from, to } = space.constraint;
  // A filler with no span cannot cover anything: it is a real witness whose
  // extent is unknown, disclosed separately rather than silently counted as
  // covering everything (which would close the void by ignorance) or as
  // covering nothing (which would overstate the hole).
  const placed = space.fillers.filter((f) => f.span);
  const clipped = placed
    .map((f) => ({ from: Math.max(f.span.from, from), to: Math.min(f.span.to, to) }))
    .filter((s) => s.from <= s.to);
  const covered = merge(clipped);

  const voids = [];
  let cursor = from;
  for (const c of covered) {
    if (c.from > cursor) voids.push({ from: cursor, to: c.from });
    cursor = Math.max(cursor, c.to);
  }
  if (cursor < to) voids.push({ from: cursor, to });

  const unplaced = space.fillers.filter((f) => !f.span).map((f) => f.filler);
  return Object.freeze({
    standing: voids.length ? "incomplete" : "covered",
    reason: voids.length
      ? `"${space.slot}" spans ${from}-${to}${space.dimension ? ` (${space.dimension})` : ""}, and ` +
        `${voids.map((v) => `${v.from}-${v.to}`).join(", ")} ${voids.length > 1 ? "are" : "is"} filled by nothing named so far — ` +
        `something holds that extent, and this reading has not found it`
      : `"${space.slot}" spans ${from}-${to}${space.dimension ? ` (${space.dimension})` : ""} and every part of it is covered by a named filler`,
    voids: Object.freeze(voids.map((v) => Object.freeze(v))),
    covered: Object.freeze(covered.map((c) => Object.freeze(c))),
    unplaced: Object.freeze(unplaced),
  });
}

/**
 * The line a model is given in place of a guess — the user's own rule
 * ("either give it the answer, or an explicit void in place of the
 * answer"), rendered from the arithmetic rather than written by hand.
 */
export function voidLine(space) {
  const v = voidsOf(space);
  const named = space.fillers.map((f) => (f.span ? `${f.filler} (${f.span.from}-${f.span.to})` : f.filler));
  const head = named.length ? `${space.slot}: ${named.join("; ")}` : `${space.slot}: nothing named yet`;
  if (v.standing === "unbounded") return `${head}. ${v.reason}.`;
  if (v.standing === "covered") return `${head}. ${v.reason} — this set is complete; do not add to it.`;
  return `${head}. ${v.reason}. Do not fill this gap from memory — say it is open.`;
}

/**
 * CONVENIENCE, and disclosed as one: four-digit year spans written as
 * "1861-1865", "1861 to 1865", "1861–1865". Digits are matched by Unicode
 * category, so any script's decimal digits are read, but the four-digit
 * Gregorian YEAR shape itself is a declared scope limit — other calendars,
 * two-digit years, and month/day precision are NOT read here and a caller
 * needing them must supply spans directly. Nothing in this file requires
 * this function; it exists so the common case does not force every caller
 * to hand-roll the same scan.
 */
export function yearSpansIn(text) {
  const s = String(text ?? "");
  const YEAR_SPAN = /(\p{Nd}{4})\s*(?:-|–|—|to|until|through)\s*(\p{Nd}{4})/giu;
  const out = [];
  for (const m of s.matchAll(YEAR_SPAN)) {
    const from = Number(m[1]);
    const to = Number(m[2]);
    if (Number.isFinite(from) && Number.isFinite(to) && from <= to) out.push({ from, to });
  }
  return out;
}
