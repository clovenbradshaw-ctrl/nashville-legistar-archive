// prosify.js — THE PROSIFIED PASS: flesh on the EOT draft, recursively.
//
// Stage five of the generation pipeline:
//
//   prompt → register → void → ground → EOT draft → PROSIFIED PASS → fold …
//
// The draft already says what the piece claims, part by part, with the bytes
// each claim stands on. This pass only has to SAY it. That changes what the
// mouth is asked for: not "answer this question about the subject" — which
// every section used to re-answer from scratch — but "carry these facts, in
// this order, from where the piece has got to."
//
// THE RECURSION, and the law in it. Each part is drawn WHOLE first: the mouth
// gets every fact of the part and writes the passage. That coarse draw sets
// what is PROBABLE for the part. What it failed to carry is found by
// measurement — a fact is carried only when the admitted prose keeps its
// ANCHORS, its numbers and its distinctive names (see anchorsFor) — and only
// those facts are drawn again,
// ONE AT A TIME, at the finer grain. The finer level is the possibility the
// coarse one rests on. A fact the mouth still cannot carry falls to its
// FLOOR: the source sentence itself, verbatim, which is true by construction.
// So the pass never ends with a part that lost a fact the draft held, and it
// spends a finer draw only where the coarse one measurably fell short.
//
// Every sentence the mouth writes goes through the same admission the rest of
// the engine uses (native/the-fold/admission.js): repetition refused, invented
// names refused, talk about the task refused, and the road each sentence took
// recorded. Every draw, every refusal and every floor is returned as a record,
// so a run killed at any point leaves the parts it finished readable.
//
// The mouth is spoken to in plain prose with no prohibitions in it — a small
// model told what not to say tends to say it (standing rule). The guardrails
// are the admission and the floor, never the prompt.

import { admit, deposit, measureVariance, measureBondNull, matterWords, segmentSentences, claimCore, stripMouthQuoting } from "./admission.js";
import { inventedNameRuns, isMetaSentence } from "./referent-verify.js";
import { draftWords, namesOf, drawnParts } from "./eot-draft.js";
import { isCommonWord } from "./pos-prior.js";

export const PROSIFY_SCHEMA = "EOProsify@1";

const lastSentence = (text) => {
  const s = segmentSentences(String(text ?? ""));
  return s.length ? s[s.length - 1] : String(text ?? "").trim();
};

/**
 * THE ANCHORS OF A FACT (2026-09-21, falsified on the first live run).
 *
 * "Carried" first meant "a surviving sentence shares a word only this fact
 * has". The live run passed three real errors under that test:
 *   - the 1927 flood was given the 2010 crest and the two-billion-dollar cost,
 *     because the crest's words survived and its year did not;
 *   - "These groups utilized the river" carried the Native American fact
 *     without naming the Cherokee, Chickasaw or Shawnee;
 *   - a finer draw judged against its one fact alone counted "river" as
 *     carrying "French traders had earlier called it the Shawnee River".
 *
 * A fact is carried only when the prose keeps its ANCHORS: every number it
 * states — its extent, the dates and quantities that make it true of one span
 * and false of another — and, for every distinctive name it carries, that
 * name's rarest word in the material. Names every part of the material
 * carries are the piece's subject and are not demanded of each fact; the prose
 * may say "the river". A fact with no numbers and no distinctive names falls
 * back to its own words, measured against the WHOLE draft, never against
 * itself alone.
 */
const numbersOf = (text) => [...new Set((String(text).match(/\d[\d,.]*\d|\d/g) ?? []).map((n) => n.replace(/,/g, "").replace(/\.$/, "")))];

export function anchorsFor(draft) {
  // THE REFERENT ANCHOR (2026-09-21, user: "our assertions of what a word is
  // … point to a referent"). With a resolver on the draft, a fact's names are
  // the BEINGS it names, not strings: "Donelson" carries "John Donelson",
  // "Walker" carries "Dr. Thomas Walker", "Donelson's" carries Donelson. The
  // subject's beings are never demanded of a single fact.
  if (draft?.referents) {
    const R = draft.referents;
    const subject = draft.subjectRefs ?? new Set();
    const points = drawnParts(draft).flatMap((p) => p.children);
    const df = new Map();
    for (const pt of points) for (const w of new Set(draftWords(pt.text))) df.set(w, (df.get(w) ?? 0) + 1);
    const out = new Map();
    for (const pt of points) {
      const refs = [...R.resolveText(pt.text)].filter((id) => !subject.has(id));
      const own = [...new Set(draftWords(pt.text))].filter((w) => df.get(w) === 1);
      out.set(pt.id, { numbers: numbersOf(pt.text), names: [], refs, own: own.length ? own : [...new Set(draftWords(pt.text))], R });
    }
    return out;
  }
  const parts = drawnParts(draft);
  const points = parts.flatMap((p) => p.children);
  const groundText = parts.map((p) => p.text).join("\n");
  // A CAPITAL AT A SENTENCE START IS NOT A NAME if the material also writes
  // that word in lowercase: "Cotton, tobacco, iron…" opens a sentence, and
  // "cotton and tobacco markets" says it is a common noun. Measured on the
  // material, no list.
  const writtenLower = (w) => new RegExp(`(^|[^A-Za-z])${w.toLowerCase()}([^A-Za-z]|$)`).test(groundText);
  // A CAPITAL RIGHT BEFORE A NUMBER IS PART OF A DATE ("May 2010", "June
  // 14"): extent, which the number already anchors, never a figure. Measured:
  // "May" was demanded as a name and forced a floor that said the 2010 crest
  // twice.
  const beforeNumber = (text, n) => new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+\\d`, "i").test(text);
  const nameList = (text) => namesOf(text).filter((n) => !(n.split(" ").length === 1 && (writtenLower(n) || beforeNumber(text, n))));
  // SUBJECT-NESS IS MEASURED ON NAME WORDS, NOT NAME STRINGS: "Cumberland
  // River" and "Cumberland" are one subject, and a word held in the names of
  // more parts than not is what the whole piece is about. It is never
  // demanded of a single fact; the prose may say "the river".
  const partDf = new Map();
  for (const p of parts) for (const w of new Set(nameList(p.text).flatMap((n) => draftWords(n)))) partDf.set(w, (partDf.get(w) ?? 0) + 1);
  const subjectWords = new Set([...partDf.entries()].filter(([, d]) => d * 2 > parts.length).map(([w]) => w));
  const df = new Map();
  for (const pt of points) for (const w of new Set(draftWords(pt.text))) df.set(w, (df.get(w) ?? 0) + 1);
  const out = new Map();
  for (const pt of points) {
    // Each name is demanded as a set of alternatives: ANY of its words that
    // is not the subject keeps it ("Robertson" keeps "James Robertson").
    const names = nameList(pt.text)
      .map((n) => [...new Set(draftWords(n))].filter((w) => !subjectWords.has(w)))
      .filter((alts) => alts.length);
    const own = [...new Set(draftWords(pt.text))].filter((w) => df.get(w) === 1);
    out.set(pt.id, { numbers: numbersOf(pt.text), names, own: own.length ? own : [...new Set(draftWords(pt.text))] });
  }
  return out;
}

export function carries(anchor, sentences) {
  const text = sentences.join(" ");
  const said = new Set(draftWords(text));
  const nums = new Set(numbersOf(text));
  const missingNumbers = anchor.numbers.filter((n) => !nums.has(n));
  let missingNames = anchor.names.filter((alts) => !alts.some((w) => said.has(w))).map((alts) => alts.join("/"));
  if (anchor.refs && anchor.R) {
    const saidRefs = new Set();
    for (const s of sentences) for (const id of anchor.R.resolveText(s)) saidRefs.add(id);
    missingNames = anchor.refs.filter((id) => !saidRefs.has(id)).map((id) => anchor.R.represent(id) ?? id);
  }
  const hasOwn = anchor.own.some((w) => said.has(w));
  const anchored = anchor.numbers.length > 0 || anchor.names.length > 0 || (anchor.refs?.length ?? 0) > 0;
  const ok = missingNumbers.length === 0 && missingNames.length === 0 && (anchored || hasOwn);
  return { ok, missingNumbers, missingNames };
}

/** How much of a fact's anchors and own words a sentence already holds — the
 *  measure that finds a dropped fact's PARTIAL CARRIER. */
function overlap(anchor, sentence) {
  const said = new Set(draftWords(sentence));
  const nums = new Set(numbersOf(sentence));
  let sc = 0;
  for (const n of anchor.numbers) if (nums.has(n)) sc += 2;
  for (const alts of anchor.names) if (alts.some((w) => said.has(w))) sc += 2;
  for (const w of anchor.own) if (said.has(w)) sc += 1;
  return sc;
}

/** Where a statement's sentence belongs among the part's pieces: before the
 *  first piece that carries only statements that come after it. */
function insertAt(pieces, order, id) {
  const at = order.get(id) ?? Infinity;
  for (let i = 0; i < pieces.length; i++) {
    const idx = pieces[i].carries.map((c) => order.get(c) ?? Infinity);
    if (idx.length && Math.min(...idx) > at) return i;
  }
  return pieces.length;
}

/** Which statements does EACH admitted sentence carry on its own? This is the
 *  link from the flesh back into the EOT: every sentence of prose points at
 *  the statements it says, and a sentence that says two at once has joined
 *  them — a relation the source never stated, made by the prose. */
function perSentence(part, sentences, anchors) {
  return sentences.map((x) => ({ sentence: x, carries: part.children.filter((pt) => carries(anchors.get(pt.id), [x]).ok).map((pt) => pt.id) }));
}

function coverage(part, sentences, anchors) {
  const carried = [];
  const missing = [];
  const why = {};
  for (const pt of part.children) {
    const c = carries(anchors.get(pt.id), sentences);
    if (c.ok) carried.push(pt.id);
    else { missing.push(pt); why[pt.id] = [...c.missingNumbers.map((n) => `number ${n}`), ...c.missingNames.map((n) => `name ${n}`)].join(", ") || "none of its own words"; }
  }
  return { carried, missing, why };
}

/**
 * prosify(draft, { draw, voice, ground, task }) → { parts, records, landing }
 *
 * `draw(messages, maxTokens)` is the caller's model call, returning text — the
 * caller routes it through the engine's gated wire. `voice` is the register's
 * own { opening, body } for this kind of piece.
 */
/** The admission unit: a sentence of prose, or — when the void's shape is
 *  in lines (shape.js, a form the sources agree is counted in lines) — a
 *  LINE. Measured live 2026-09-22: asked for a sonnet, the mouth wrote
 *  fourteen lines and the pipeline read them as four sentences, floored
 *  source prose into the poem and joined it all with spaces. A line is
 *  admitted by the same tests as a sentence and kept as a line. */
const unitsOf = (text, unit) => (unit === "line"
  ? String(text ?? "").split(/\n/).map((l) => stripMouthQuoting(l.replace(/^[-•*]\s+/, "").trim())).filter((l) => l.length > 3)
  : segmentSentences(text).map(stripMouthQuoting).filter((x) => x.length > 20));

export async function prosify(draft, { draw, voice = null, ground = "", task = "", maxTokens = 450, unit = "sentence", onRecord = null, onPart = null } = {}) {
  const variance = measureVariance(ground);
  const bondNull = measureBondNull(ground, undefined, variance);
  const registry = new Set();
  const anchors = anchorsFor(draft);
  // EVERY DRAW LANDS AS IT HAPPENS (2026-09-21): the pass used to return its
  // records only when it finished, so a slow or killed run showed nothing past
  // the floor. Each record and each finished part is handed to the caller the
  // moment it exists.
  const records = [];
  const record = (r) => { records.push(r); if (onRecord) { try { onRecord(r); } catch {} } };
  const parts = [];
  let landing = "";

  const admitAll = (text, { priorLanding, node, without = null }) => {
    const survivors = [];
    const roads = [];
    const refusals = [];
    let reg = registry;
    if (without) {
      reg = new Set(registry);
      reg.delete(claimCore(without, variance));
      for (const w of matterWords(without, ground, variance)) reg.delete(`w:${w}`);
    }
    for (const cand of unitsOf(text, unit)) {
      if (isMetaSentence(cand)) { refusals.push({ kind: "meta", sentence: cand }); continue; }
      const v = admit(cand, {
        ground, priorLanding, instruction: task, registry: reg, variance, bondNull, verse: unit === "line",
        isGrounded: (x) => matterWords(x, ground, variance).length > 0,
        invented: (x) => inventedNameRuns(x, ground, { isCommonWord }),
        continues: draft.referents
          ? (a, b) => { const sub = draft.subjectRefs ?? new Set(); const B = draft.referents.resolveText(b); for (const id of draft.referents.resolveText(a)) if (B.has(id) && !sub.has(id)) return true; return false; }
          : (a, b) => { const A = namesOf(a); const B = new Set(namesOf(b)); return A.some((n) => B.has(n)); },
      });
      if (!v.admit) { refusals.push({ kind: v.refused?.[0]?.kind ?? "refused", sentence: cand, basis: v.refused?.[0]?.basis ?? null }); continue; }
      deposit(registry, v);
      if (reg !== registry) deposit(reg, v);
      survivors.push(cand);
      roads.push(v.road);
    }
    return { survivors, roads, refusals, node };
  };

  for (let pi = 0; pi < drawnParts(draft).length; pi++) {
    const part = drawnParts(draft)[pi];
    const isFirst = pi === 0;
    const facts = part.children.map((pt, i) => `${i + 1}. ${pt.text}`).join("\n");
    const joinCue = !landing ? "" : part.bridge?.name
      ? `Pick up from ${part.bridge.name} and carry on.`
      : "Open this part with a sentence that carries the reader from there into what comes next.";
    const system = isFirst ? (voice?.opening ?? "") : (voice?.body ?? "");
    const user = [
      landing ? `The piece so far ends: "${landing}"` : "",
      joinCue,
      `Here is what this part says, from the source:\n${facts}`,
      unit === "line" ? `Write this part of the piece now, in lines, carrying each of these facts.` : `Write this part of the piece now, in your own words, carrying each of these facts.`,
    ].filter(Boolean).join("\n\n");

    // ── THE COARSE DRAW: the whole part.
    let raw = "";
    let error = null;
    try { raw = String(await draw([...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }], maxTokens) ?? ""); }
    catch (e) { error = String(e?.message ?? e).slice(0, 200); }
    const coarse = admitAll(raw, { priorLanding: landing, node: part.id });
    const cov = coverage(part, coarse.survivors, anchors);
    record({ level: "part", node: part.id, prompt: user, raw, error, ...coarse, carried: cov.carried, missing: cov.missing.map((m) => m.id), why: cov.why, perSentence: perSentence(part, coarse.survivors, anchors) });

    // ── THE FINER DRAWS: only the facts the coarse draw measurably dropped.
    //
    // THE RECURSION ALTERS, IT DOES NOT PILE UP (2026-09-21, measured on the
    // second live run: a floor appended beside a sentence that already carried
    // most of its fact said "688 miles" twice and the 2010 crest twice, and
    // floors landed at the end of their part, after prose that leaned on
    // them). A dropped fact usually has a PARTIAL CARRIER — an admitted
    // sentence holding some of its anchors or words. The finer draw rewrites
    // THAT sentence to carry the rest, and the rewrite takes its place. When
    // the rewrite fails, the floor takes its place instead — unless the partial
    // carries another fact of its own, in which case the floor goes beside it.
    // With no partial, the floor is placed at its own statement's position.
    // On the ledger nothing is edited: each replacement supersedes.
    const pieces = coarse.survivors.map((x) => ({ text: x, carries: part.children.filter((pt) => carries(anchors.get(pt.id), [x]).ok).map((pt) => pt.id) }));
    const order = new Map(part.children.map((pt, i) => [pt.id, i]));
    const floored = [];
    for (const pt of cov.missing) {
      const a = anchors.get(pt.id);
      let best = -1; let bestScore = 0;
      pieces.forEach((pc, i) => { const sc = overlap(a, pc.text); if (sc > bestScore) { bestScore = sc; best = i; } });
      const partial = best >= 0 ? pieces[best] : null;
      const before = pieces.slice(0, best >= 0 ? best : pieces.length).map((pc) => pc.text);
      const prior = before.length ? before[before.length - 1] : landing;
      const u = partial
        // Material first, the claim after it, the ask last (Gary, P199/P55).
        ? [`A fact from the source:\n"${pt.text}"`, `The piece says: "${partial.text}"`, `Rewrite that ${unit === "line" ? "line" : "sentence"} so it also carries the fact.`].join("\n\n")
        : [prior ? `The piece so far ends: "${prior}"` : "", `Here is the next fact, from the source:\n"${pt.text}"`, `Write one or two ${unit === "line" ? "lines" : "sentences"} of the piece that carry this fact, going on from where it ends.`].filter(Boolean).join("\n\n");
      let r = ""; let err = null;
      try { r = String(await draw([...(voice?.body ? [{ role: "system", content: voice.body }] : []), { role: "user", content: u }], 200) ?? ""); }
      catch (e) { err = String(e?.message ?? e).slice(0, 200); }
      // A rewrite repeats its partial's matter by design, so it is admitted
      // against the registry WITHOUT the partial's own deposit.
      const fine = admitAll(r, { priorLanding: prior, node: pt.id, without: partial?.text ?? null });
      const fineCov = coverage({ children: [pt] }, fine.survivors, anchors);
      const replaceable = partial && !partial.carries.length;
      if (fine.survivors.length && fineCov.carried.length) {
        // What the rewrite carries is RE-CHECKED, never inherited: run 11's
        // rewrite for p5.3 replaced the sentence carrying p5.2 (the 1927
        // flood), was labelled as carrying both, and dropped 1927. A statement
        // the replaced sentence carried and the rewrite does not is floored
        // at its own position — the rewrite may not cost a fact.
        const text = fine.survivors.join(" ");
        const kept = (partial?.carries ?? []).filter((id) => carries(anchors.get(id), [text]).ok);
        const lost = (partial?.carries ?? []).filter((id) => !kept.includes(id));
        const revised = { text, carries: [pt.id, ...kept] };
        if (partial) pieces.splice(best, 1, revised); else pieces.splice(insertAt(pieces, order, pt.id), 0, revised);
        for (const id of lost) {
          const src = part.children.find((c) => c.id === id);
          if (src) { pieces.splice(insertAt(pieces, order, id), 0, { text: src.text, carries: [id] }); floored.push(id); }
        }
        record({ level: "point", node: pt.id, prompt: u, raw: r, error: err, ...fine, carried: [pt.id], missing: [], replaces: partial?.text ?? null, perSentence: [{ sentence: revised.text, carries: revised.carries }] });
      } else {
        // ── THE FLOOR: the source sentence itself. True by construction.
        const floorPiece = { text: pt.text, carries: [pt.id] };
        if (replaceable) pieces.splice(best, 1, floorPiece);
        else if (partial) pieces.splice(best + 1, 0, floorPiece);
        else pieces.splice(insertAt(pieces, order, pt.id), 0, floorPiece);
        floored.push(pt.id);
        record({ level: "point", node: pt.id, prompt: u, raw: r, error: err, ...fine, carried: [], missing: [pt.id], why: fineCov.why, floor: pt.text, replaces: replaceable ? partial.text : null });
      }
    }
    let partLanding = pieces.length ? pieces[pieces.length - 1].text : landing;
    const prose = pieces.map((pc) => pc.text).join(" ");
    const done = {
      id: part.id, prose,
      // The part's sentences with the statements each carries: what fold,
      // tighten and arrive work on. A connective sentence carries none.
      pieces: pieces.map((pc) => ({ text: pc.text, carries: [...pc.carries] })),
      status: !cov.missing.length ? "carried whole" : floored.length === cov.missing.length && !coarse.survivors.length ? "floor" : "recursed",
      carriedWhole: cov.carried.length, recursed: cov.missing.length - floored.length, floored: floored.length, of: part.children.length,
    };
    parts.push(done);
    if (onPart) { try { onPart(done); } catch {} }
    if (prose.trim()) landing = lastSentence(prose);
  }
  return { schema: PROSIFY_SCHEMA, parts, records, landing };
}
