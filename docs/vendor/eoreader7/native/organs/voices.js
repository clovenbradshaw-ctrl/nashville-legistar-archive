/* Ibn Khaldun speaks:
 * “وكثيرا ما وقع للمؤرّخين والمفسّرين وأئمّة النّقل من المغالط في الحكايات والوقائع لاعتمادهم فيها على مجرّد النّقل غثّا أو سمينا ولم يعرضوها على أصولها ولا قاسوها بأشباهها ولا سبروها بمعيار الحكمة والوقوف على طبائع الكائنات وتحكيم النّظر والبصيرة في الأخبار فضلّوا عن الحق وتاهوا في بيداء الوهم والغلط”
 *
 * This file explores the inherent challenges of historical interpretation, as exemplified by Ibn Khaldun's critique of those who blindly repeat previous chronicles.  While his work provides a framework for understanding the complexities of history, the file's focus on the voices of the past demands a critical and discerning approach to historical claims.
 *
 * — the engineering record below, kept whole —
 */
// voices.js — how many INDEPENDENT voices a note's witnesses amount to.
// Handle: Ibn Khaldun — after the Muqaddimah's critique of historians who repeat an earlier chronicle and are counted as further evidence for it. Amendment XVII.
//
// THE COUNT THIS CORRECTS. `standingOf` (kernel/notes.js) counts DISTINCT
// REFS and calls two of them "corroborated". A ref is a page or a file, and
// nothing anywhere asks how that page came to say what it says. So a
// navigation template transcluded onto three pages, a wire report carried by
// four outlets, and an article quoting another verbatim all read as N
// independent witnesses when they are one voice repeated. Measured on real
// material: three real Wikipedia pages shared a 7,794-character run nobody
// marked, and every note carried by it stood on "three sources".
//
// WHAT MAKES THIS TRACTABLE is that it needs no statistic. The fact is
// `kernel/reproduction.js`'s: the same units appear in both bodies, with
// both addresses, re-read and verified. No threshold on shape, no null, no
// surprise — an observation, not an inference. (A shape-based furniture
// detector was measured first and refused: real prose scored z = 2.55
// against a navbox's 5.29 on the same statistic — a real signal that does
// not separate safely, the same class this repo already refused once as
// "sound statistic, wrong claim".)
//
// THE TERRAIN, because it decides the shape of everything below. A
// reproduction is a STRUCTURE·FIGURE fact — a Link between two bodies,
// `A repeats B`, landed as an ordinary arrangement on an ordinary ledger,
// corroboratable and concedable like any other. The RULE that a repeated
// witness is not a second voice is INTERPRETATION·FIGURE — a lens: declared,
// named with its giver, defeasible, never baked into the arithmetic. What
// the counts then become is INTERPRETATION·GROUND — the atmosphere the next
// claim is read against — which is why this file never overwrites
// `standingOf`'s own number: it reports beside it and names the lens in
// force. A lens whose repeated application demonstrably moved that ground
// would be a PARADIGM; nothing here measures that, and nothing here claims
// to.
//
// PER CLAIM, NEVER PER SOURCE PAIR — the sharpest rule in this file. Two
// pages sharing a navbox are one voice FOR THE NAVBOX'S CONTENT and remain
// two genuinely independent voices for everything else on them. Collapsing
// a source wholesale because it repeats another somewhere would destroy real
// corroboration, so a witness is demoted for a note only when THAT NOTE'S
// OWN SPAN falls inside the shared run. The control built to fail in
// `voices.test.mjs` is exactly this case.
//
// WHAT IT NEVER SAYS: that a repeater is dishonest, that an origin is right,
// that either claim is true, or which body came first. And it carries
// `contextChecked: false` on every collapse, because a verified reproduction
// says the units are shared and says NOTHING about whether the repeater's
// surrounding material uses them faithfully — the question that needs the
// origin read in its own context, which nothing here does.
//
// DISCLOSED RESIDUE, found by reading this file's own rule rather than by a
// failure. Two witnesses are grouped when they sit in one repetition
// COMPONENT and each is carried by a run at its own span. Component
// membership is coarser than "carrying the same run": if A repeats B via one
// template and C repeats D via a different one, and all four happen to be
// connected, A and C can be collapsed for a note they each carry through
// DIFFERENT reproduced material. The tighter rule is to group by the
// material of the covering run itself (overlap, not equality — the same
// template measured 7,794 units on one page and 7,806 on another). Not
// built; naming it rather than shipping it silently.
//
// Pure; the ledger algebra and the reproduction organ are injected.

/** The one label a reproduction lands under. Declared, never derived from content. */
export const REPEATS_LABEL = "repeats";

/**
 * The lens itself, as a declared object rather than behaviour hidden in a
 * function. A caller adopts it explicitly, can name it on the record, and
 * can defeat it. `minRun` is the caller's (P4/P9): how many units of shared
 * material stop being coincidence is a fact about the medium.
 */
export const repetitionLens = ({ minRun, giver }) => {
  if (!Number.isInteger(minRun) || minRun < 1)
    throw new TypeError("repetitionLens: minRun is declared — how much shared material stops being coincidence is never a constant this file picks");
  if (!giver) throw new TypeError("repetitionLens: a lens names its giver — an interpretive commitment with no author is not defeasible by anyone");
  return Object.freeze({
    name: "unclaimed-reproduction-is-one-voice",
    giver,
    minRun,
    rule: "a witness whose own span for this note falls inside material verbatim reproduced in another witness's body is not a second independent voice for it",
    contextChecked: false,
  });
};

/**
 * An address, resolved to its BODY's own coordinates.
 *
 * This instrument nests addresses: a span heard inside a chunk carries
 * `<page>#<chunkStart>-<chunkEnd>#<c0>-<c1>`, where the outer half is the
 * chunk's place in the page and the inner half is the span's place in the
 * chunk. A containment test against a page-absolute run has to compare like
 * with like, so a nested address resolves by adding the outer start — and a
 * plain one is returned unchanged. Found by running this against the real
 * ledger rather than against fixtures, where every address is one level.
 */
const parseAddress = (at) => {
  const m = /^(.*)#(\d+)-(\d+)$/.exec(String(at ?? ""));
  if (!m) return null;
  const inner = { ref: m[1], from: Number(m[2]), to: Number(m[3]) };
  const outer = /^(.*)#(\d+)-(\d+)$/.exec(inner.ref);
  if (!outer) return inner;
  const base = Number(outer[2]);
  return { ref: outer[1], from: base + inner.from, to: base + inner.to };
};

/** A source id from a witness or an address ref, using the ledger's own rule. */
const sourceOf = (s, sourceOfWitness) => sourceOfWitness(String(s ?? ""));

/**
 * findRepetitions(bodies, { reproduction, minRun }) — every unclaimed
 * reproduction between every ordered pair of bodies. `bodies` are
 * `{ id, material }`; the organ is `kernel/reproduction.js`'s, already
 * carrying this medium's fold.
 *
 * Ordered pairs, both directions, deliberately: the organ cannot say which
 * body came first, so it reports the fact from each side and lets a caller
 * that HAS an order (a retrieval date, a publication date) use it. Nothing
 * here infers precedence from position.
 */
export function findRepetitions(bodies, { reproduction, minRun } = {}) {
  if (!reproduction?.sharedRuns) throw new TypeError("findRepetitions: the reproduction organ is injected — this file holds no fold of its own");
  const out = [];
  for (const source of bodies ?? []) {
    const others = (bodies ?? []).filter((b) => b !== source && b.id !== source.id);
    if (!others.length) continue;
    for (const run of reproduction.sharedRuns(source, others, { minRun })) {
      out.push({
        from: source.id,
        to: run.alsoIn.body,
        units: run.units,
        fromAddress: run.inSource.address,
        toAddress: run.alsoIn.address,
        raw: run.inSource.raw,
        contextChecked: false,
      });
    }
  }
  return out;
}

/**
 * landRepetitions(log, notes, repetitions, { witness }) — each reproduction
 * heard onto a ledger as the ordinary arrangement it is:
 * `<from> repeats <to>`, spans carrying BOTH addresses so either side reads
 * back. Same shape, same operators, same concession path as any other note —
 * "the same set of operations, just at another level".
 */
export function landRepetitions(log, notes, repetitions, { witness } = {}) {
  let next = log;
  const heard = [];
  for (const r of repetitions ?? []) {
    if (!r?.from || !r?.to || !r.fromAddress || !r.toAddress) continue;
    next = notes.hear(next, {
      end1: r.from,
      label: REPEATS_LABEL,
      end2: r.to,
      spans: [{ at: r.fromAddress, ref: r.from }, { at: r.toAddress, ref: r.to }],
      witness,
      because: `${r.units} units reproduced with nothing claiming it`,
    });
    heard.push({ from: r.from, to: r.to, units: r.units });
  }
  return { log: next, heard };
}

/**
 * independentVoices(note, { repetitions, lens, sourceOfWitness }) — the
 * count, BESIDE the old one, never replacing it.
 *
 * A witness is demoted only when this note's OWN span in that witness's body
 * sits inside a run reproduced in another of this note's witnesses' bodies.
 * The surviving voice is the other side of the run: of two witnesses that
 * share a run, one voice remains, not zero — a repetition means they are one
 * voice, never that neither said anything.
 */
export function independentVoices(note, { repetitions, lens, sourceOfWitness } = {}) {
  if (!lens) throw new TypeError("independentVoices: the lens is declared — a count that quietly changed its own rule is not a count anyone can argue with");
  if (typeof sourceOfWitness !== "function") throw new TypeError("independentVoices: sourceOfWitness is the ledger's own rule, injected — never a second reading of what a source is");

  const witnesses = note?.witnesses ?? [];
  const sources = [...new Set(witnesses.map((w) => sourceOf(w, sourceOfWitness)))];
  const spansBySource = new Map();
  for (const sp of note?.spans ?? []) {
    const a = parseAddress(sp?.at);
    if (!a) continue;
    const src = sourceOf(a.ref, sourceOfWitness);
    if (!spansBySource.has(src)) spansBySource.set(src, []);
    spansBySource.get(src).push(a);
  }

  const inside = (span, addr) => {
    const r = parseAddress(addr);
    return r && r.ref === span.ref && span.from >= r.from && span.to <= r.to;
  };

  // ONE VOICE PER GROUP, NEVER ZERO. Repetitions are reported in BOTH
  // directions (this organ cannot say which body came first), so demoting
  // every `from` that appears in one collapsed two witnesses into nothing —
  // measured, on the first run of this file's own test. Sources that carry
  // the same reproduced material form a group, and a group speaks once.
  //
  // TRANSITIVE, THROUGH BODIES THAT NEVER WITNESSED THIS NOTE. Measured on
  // real pages: a note witnessed by Gettysburg and Lincoln alone survived as
  // "two voices" because the runs covering it ran Gettysburg->CivilWar and
  // CivilWar->Lincoln — the linking body was not itself a witness, so a
  // graph built only from this note's own witnesses never joined them. Both
  // pages were nonetheless carrying one transcluded template. So the
  // repetition graph is built over ALL bodies, and a witness joins a group
  // when its OWN span for this note sits inside a run it originates — the
  // per-claim gate is unchanged, only the reachability is honest.
  const parent = new Map();
  const find = (x) => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) x = parent.get(x); return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  for (const rep of repetitions ?? []) union(rep.from, rep.to);

  // Which of THIS note's sources are carried by reproduced material, judged
  // at this note's own span (never at the source's reputation).
  const carried = new Map();
  for (const rep of repetitions ?? []) {
    if (!sources.includes(rep.from)) continue;
    const spans = spansBySource.get(rep.from) ?? [];
    if (!spans.some((sp) => inside(sp, rep.fromAddress))) continue;
    if (!carried.has(rep.from)) carried.set(rep.from, rep);
  }

  const groups = new Map();
  for (const s2 of sources) {
    // A source whose span here is its own words stands alone, whatever it
    // reproduces elsewhere on the page.
    const key = carried.has(s2) ? `repeated:${find(s2)}` : `own:${s2}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s2);
  }

  const collapsed = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    // The representative is the first in the note's own witness order —
    // deterministic, and explicitly NOT a claim that it came first.
    const [speaks, ...rest] = members;
    for (const m of rest) {
      const via = carried.get(m);
      collapsed.push({ demoted: m, into: speaks, units: via?.units ?? null, at: via?.fromAddress ?? null, contextChecked: false });
    }
  }

  return {
    sources: sources.length,
    independentVoices: groups.size,
    collapsed,
    lens: { name: lens.name, giver: lens.giver, minRun: lens.minRun },
    // Said on the result, not buried: shared units are shared units.
    contextChecked: false,
  };
}
