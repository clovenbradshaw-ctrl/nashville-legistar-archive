// flesh2.js — F2: FLESH LEVEL BY LEVEL (HORA). plans/generation-terrain-stance.md.
//
// F1 (prosify.js) draws each section whole and recurses finer where a draw
// fell short. F2 stages the same material at THREE measured levels, and every
// level is loop-checked against the one below and undone if it lost ground:
//
//   Level 1 — one sentence per section. That makes a complete abstract,
//   usable on its own: every section keeps its kind (stated once) and its
//   saturating spans. A section that admits nothing falls to its first span
//   verbatim, so no section is ever empty.
//   Level 2 — each abstract sentence grows to a paragraph carrying the
//   section's kind and its saturating spans. Missing spans are drawn finer,
//   then floored, so the level is a stable whole.
//   Level 3 — the remaining spans (everything the saturating spans did not
//   cover) are woven in, finer draw then floor.
//
// A level that carries fewer facts than the level below it, or drops a
// section, is undone — the last stable piece stands. The measures are the
// pipeline's own (facts carried, the ask's questions answered, findings
// licensing a revision, sentences, words, model calls).

import { admit, deposit, measureVariance, measureBondNull, matterWords, segmentSentences, claimCore, stripMouthQuoting } from "./admission.js";
import { inventedNameRuns, isMetaSentence } from "./referent-verify.js";
import { drawnParts } from "./eot-draft.js";
import { isCommonWord } from "./pos-prior.js";
import { anchorsFor, carries } from "./prosify.js";
import { statementKinds, saturatingSpans, kindSentence } from "./kinds.js";
import { floorPiece, measurePiece, judgeLoop } from "./loop-check.js";

export const FLESH2_SCHEMA = "EOFlesh2@1";

const lastSentence = (text) => {
  const s = segmentSentences(String(text ?? ""));
  return s.length ? s[s.length - 1] : String(text ?? "").trim();
};

export async function flesh2({ draft, draw, ground = "", task = "", voice = null, onRecord = null } = {}) {
  const variance = measureVariance(ground);
  const bondNull = measureBondNull(ground, undefined, variance);
  const registry = new Set();
  const anchors = anchorsFor(draft);
  const parts = drawnParts(draft);
  const K = statementKinds(draft);
  const kindOf = new Map();
  for (const k of K.kinds) for (const id of k.members) kindOf.set(id, k);

  const records = [];
  const calls = { n: 0 };
  const record = (r) => { records.push(r); if (onRecord) { try { onRecord(r); } catch {} } };

  const drawOnce = async (messages, maxTokens) => {
    calls.n++;
    let out = "";
    try { out = String(await draw(messages, maxTokens) ?? ""); } catch (e) { out = ""; }
    return out;
  };

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
    for (const cand of segmentSentences(text).map(stripMouthQuoting).filter((x) => x.length > 20)) {
      if (isMetaSentence(cand)) { refusals.push({ kind: "meta", sentence: cand }); continue; }
      const v = admit(cand, {
        ground, priorLanding, instruction: task, registry: reg, variance, bondNull,
        isGrounded: (x) => matterWords(x, ground, variance).length > 0,
        invented: (x) => inventedNameRuns(x, ground, { isCommonWord }),
        continues: draft.referents
          ? (a, b) => { const sub = draft.subjectRefs ?? new Set(); const B = draft.referents.resolveText(b); for (const id of draft.referents.resolveText(a)) if (B.has(id) && !sub.has(id)) return true; return false; }
          : (a, b) => { const A = a ? [a] : []; const B = b ? [b] : []; return A.some((n) => B.includes(n)); },
      });
      if (!v.admit) { refusals.push({ kind: v.refused?.[0]?.kind ?? "refused", sentence: cand, basis: v.refused?.[0]?.basis ?? null }); continue; }
      deposit(registry, v);
      if (reg !== registry) deposit(reg, v);
      survivors.push(cand);
      roads.push(v.road);
    }
    return { survivors, roads, refusals, node };
  };

  const carried = (text) => {
    const out = new Set();
    for (const p of parts) for (const pt of p.children) if (carries(anchors.get(pt.id), [text]).ok) out.add(pt.id);
    return [...out];
  };

  // Where a statement's sentence belongs among the part's pieces.
  const insertAt = (order, pieces, id) => {
    const at = order.get(id) ?? Infinity;
    for (let i = 0; i < pieces.length; i++) {
      const idx = pieces[i].carries.map((c) => order.get(c) ?? Infinity);
      if (idx.length && Math.min(...idx) > at) return i;
    }
    return pieces.length;
  };

  const pieceFor = (byPart) => parts.map((p) => ({ id: p.id, pieces: byPart.get(p.id) ?? [] }));

  // ── LEVEL 1: one sentence per section — the abstract.
  const l1 = new Map();
  for (const part of parts) {
    const spans = saturatingSpans(part.children.map((pt) => pt.id), draft);
    const kinds = [...new Set(part.children.map((pt) => kindOf.get(pt.id)).filter(Boolean))];
    const kindLine = kinds.map((k) => kindSentence(k)).filter(Boolean).join("; ");
    const spanText = spans.map((s) => `"${s.text}"`).join("\n");
    const content = [kindLine ? `This section is ${kindLine}.` : "", spanText].filter(Boolean).join("\n");
    const sys = voice?.opening ?? "";
    const user = [`Here is what this section says, from the source:\n${content}`, `Write ONE sentence for the abstract of this section. Say what the section says, carrying its ${kindLine ? "kind and" : ""} spans.`].filter(Boolean).join("\n\n");
    const raw = await drawOnce([...(sys ? [{ role: "system", content: sys }] : []), { role: "user", content: user }], 160);
    const a = admitAll(raw, { priorLanding: "", node: part.id });
    const fellToSpan = !a.survivors[0] && spans.length;
    const sentence = fellToSpan ? spans[0].text : a.survivors[0];
    const ids = sentence ? carried(sentence) : [];
    const pieces = sentence ? [{ text: sentence, carries: fellToSpan ? [spans[0].id] : ids }] : [];
    l1.set(part.id, pieces);
    record({ level: 1, node: part.id, prompt: user, raw, admitted: a.survivors, refused: a.refusals, sentence, carries: ids, fellToSpan, spanCount: spans.length });
  }
  const l1Piece = pieceFor(l1);
  const mFloor = measurePiece(floorPiece(draft), { draft, ground, task });
  const mL1 = measurePiece(l1Piece, { draft, ground, task });
  // The abstract's charge is compression: a section that carries nothing is a
  // loss (a dropped move); it may carry fewer facts than the floor by design.
  const dropped1 = [...l1].filter(([, pieces]) => !pieces.length).length;
  const keepL1 = dropped1 === 0;
  record({ level: "check", node: "L1", verdict: keepL1 ? "kept" : "undone", why: dropped1 ? `${dropped1} section(s) empty` : "every section keeps its span or kind", m: mL1 });

  // ── LEVEL 2: each abstract sentence grows to a paragraph (kind + spans).
  const l2 = new Map();
  for (const part of parts) {
    const spans = saturatingSpans(part.children.map((pt) => pt.id), draft);
    const kinds = [...new Set(part.children.map((pt) => kindOf.get(pt.id)).filter(Boolean))];
    const kindLine = kinds.map((k) => kindSentence(k)).filter(Boolean).join("; ");
    const spanText = spans.map((s) => `"${s.text}"`).join("\n");
    const abs = l1.get(part.id)?.map((pc) => pc.text).join(" ") ?? "";
    const user = [
      abs ? `The abstract so far: "${abs}"` : "",
      kindLine ? `This section is ${kindLine}.` : "",
      `Here is what this section says, from the source:\n${spanText}`,
      `Grow this section into a paragraph carrying its ${kindLine ? "kind and" : ""} spans, in order. Do not add anything the source does not say.`,
    ].filter(Boolean).join("\n\n");
    const raw = await drawOnce([...(voice?.body ? [{ role: "system", content: voice.body }] : []), { role: "user", content: user }], 400);
    const a = admitAll(raw, { priorLanding: abs, node: part.id });
    const order = new Map(part.children.map((pt, i) => [pt.id, i]));
    let pieces = a.survivors.map((text) => ({ text, carries: carried(text) }));
    const have = new Set(pieces.flatMap((pc) => pc.carries));
    const missing = part.children.filter((pt) => !have.has(pt.id));
    const floored = [];
    for (const pt of missing) {
      const prior = pieces.slice(0, insertAt(order, pieces, pt.id)).map((pc) => pc.text).at(-1) ?? abs;
      const u = [prior ? `The piece so far ends: "${prior}"` : "", `Here is the next span, from the source:\n"${pt.text}"`, `Write one or two sentences carrying this span, going on from where it ends.`].filter(Boolean).join("\n\n");
      const r = await drawOnce([...(voice?.body ? [{ role: "system", content: voice.body }] : []), { role: "user", content: u }], 200);
      const f = admitAll(r, { priorLanding: prior, node: pt.id });
      const ok = f.survivors.filter((s) => carries(anchors.get(pt.id), [s]).ok);
      if (ok.length) { pieces.splice(insertAt(order, pieces, pt.id), 0, { text: ok[0], carries: [pt.id] }); }
      else { pieces.splice(insertAt(order, pieces, pt.id), 0, { text: pt.text, carries: [pt.id] }); floored.push(pt.id); }
    }
    l2.set(part.id, pieces);
    record({ level: 2, node: part.id, prompt: user, raw, admitted: a.survivors, refused: a.refusals, carries: pieces.flatMap((pc) => pc.carries), floored, of: part.children.length });
  }
  let level = keepL1 ? l2 : l1;
  let mL2 = measurePiece(pieceFor(level), { draft, ground, task });
  const jL2 = judgeLoop(mL1, mL2);
  if (!jL2.keep) { level = l1; mL2 = mL1; }
  record({ level: "check", node: "L2", verdict: jL2.keep ? "kept" : "undone", why: jL2.why, m: mL2 });

  // ── LEVEL 3: the remaining spans are woven in (finer draw, then floor).
  const l3 = new Map();
  for (const [pid, pieces] of level) {
    const part = parts.find((p) => p.id === pid);
    const order = new Map(part.children.map((pt, i) => [pt.id, i]));
    const have = new Set(pieces.flatMap((pc) => pc.carries));
    const missing = part.children.filter((pt) => !have.has(pt.id));
    let out = [...pieces];
    const floored = [];
    for (const pt of missing) {
      const prior = out.slice(0, insertAt(order, out, pt.id)).map((pc) => pc.text).at(-1) ?? "";
      const u = [prior ? `The piece so far ends: "${prior}"` : "", `Here is the next fact, from the source:\n"${pt.text}"`, `Write one or two sentences carrying this fact, going on from where it ends.`].filter(Boolean).join("\n\n");
      const r = await drawOnce([...(voice?.body ? [{ role: "system", content: voice.body }] : []), { role: "user", content: u }], 200);
      const f = admitAll(r, { priorLanding: prior, node: pt.id });
      const ok = f.survivors.filter((s) => carries(anchors.get(pt.id), [s]).ok);
      if (ok.length) out.splice(insertAt(order, out, pt.id), 0, { text: ok[0], carries: [pt.id] });
      else { out.splice(insertAt(order, out, pt.id), 0, { text: pt.text, carries: [pt.id] }); floored.push(pt.id); }
    }
    l3.set(pid, out);
    record({ level: 3, node: pid, admitted: out.length, floored, of: part.children.length });
  }
  let finalLevel = l3;
  let mL3 = measurePiece(pieceFor(l3), { draft, ground, task });
  const jL3 = judgeLoop(mL2, mL3);
  if (!jL3.keep) { finalLevel = level; mL3 = mL2; }
  record({ level: "check", node: "L3", verdict: jL3.keep ? "kept" : "undone", why: jL3.why, m: mL3 });

  const partsOut = [];
  for (const [pid, pieces] of finalLevel) {
    const part = parts.find((p) => p.id === pid);
    const source = new Map(part.children.map((pt) => [pt.text, pt.id]));
    const floored = pieces.filter((pc) => source.has(pc.text)).length;
    const carriedNow = new Set(pieces.flatMap((pc) => pc.carries));
    const whole = carriedNow.size >= part.children.length && floored === 0;
    partsOut.push({ id: pid, prose: pieces.map((pc) => pc.text).join(" "), pieces, of: part.children.length, floored, status: whole ? "carried whole" : "leveled" });
  }
  const landing = partsOut.map((p) => lastSentence(p.prose)).filter(Boolean).at(-1) ?? "";
  return {
    schema: FLESH2_SCHEMA, parts: partsOut, records, landing, calls: calls.n,
    levels: { L1: mL1, L2: jL2.keep ? mL2 : mL1, L3: jL3.keep ? mL3 : mL2 }, floor: mFloor,
  };
}