// Handle: Peirce — Charles Sanders Peirce, who held that reasoning is a
// mechanical operation on signs laid out where they can be seen, and that a
// conclusion is only as good as the premises it can be traced back to.
//
// talk-reason.js — reasoning over a build's record. Once the mouth's talk has
// been read into the notes ledger (organs/talk-build.js, Terkel), the record
// is no longer prose: it is claims, and claims can be reasoned over with no
// model at all. This organ reads the fold and returns three kinds of act,
// each traceable to the claims it rests on:
//
//   derive   conclusions nobody said, computed from what was said:
//              total    a parent's sum of a number its parts carry
//                       ("r/orca: total upvotes 412" from its six posts)
//              shown    how many parts of a kind a thing holds
//              top      a parent's part with the highest value of the first
//                       number the request asked its parts to show
//   correct  a heard value the record itself contradicts: the value the
//            record supports is DERIVED beside it ("comment count" 1 said, 2
//            shown) — the heard value stays on the record as what was said,
//            and the correction is withdrawn like any conclusion when the
//            parts it rests on change
//   retract  a heard part that repeats a sibling word for word — it is one
//            part heard twice, not two parts; retracting it reopens the gap,
//            so the conversation asks for another (the recursive edit)
//   drop     a heard value that only repeats a label ("moderators:
//            moderators") — no value was said; dropping it reopens the detail
//
// Pure: fold + belief in, acts out. The caller (talk-build.js) applies them to
// the ledger — derived claims carry the witness kind `derived:<rule>` and the
// premises in `because`; a correction or retraction is a REC (notes.concede)
// with its reason — and runs this again after every edit, so a conclusion
// follows its premises when they change. No regular expressions.

import { numberOf } from "./talk-reader.js";

export const TALK_REASON_SCHEMA = "TalkReason@1";

const DERIVED = "derived:";
export const isDerived = (note) => (note?.witnesses ?? []).length > 0 && note.witnesses.every((w) => String(w).startsWith(DERIVED));
const valueOf = (v) => { const s = String(v ?? "").split(",").join("").trim(); const n = numberOf(s); return n == null || Number.isNaN(n) ? null : n; };
const plural = (k) => (k.endsWith("s") ? k : k.endsWith("y") && !"aeiou".includes(k.at(-2)) ? `${k.slice(0, -1)}ies` : `${k}s`);
// what a part says, as words only: case, punctuation and spacing are not
// what makes two parts different ("Orca Watch." is "orca  watch")
const wordsOnly = (v) => String(v ?? "").toLowerCase().split("").map((c) => (c.toLowerCase() !== c.toUpperCase() || (c >= "0" && c <= "9") ? c : " ")).join("").split(" ").filter(Boolean).join(" ");
const said = (t) => wordsOnly(t.props.find((p) => p.label === "says")?.value);
const nameOf = (t) => t.name ?? [t.modifier, t.kind].filter(Boolean).join(" ");

/**
 * reason({ fold, belief, spec }) -> { schema, derive, correct, retract }
 *   fold    the ledger's fold (notes with end1/label/end2/witnesses)
 *   belief  talk-build.js beliefOf(fold, things): { id, kind, name, props, children, parent }
 *   spec    talk-build.js specOf: the counted parts and the details asked of them
 */
export function reason({ fold, belief, spec }) {
  const byId = new Map(belief.map((t) => [t.id, t]));
  const heardOnly = (t) => t.props.filter((p) => !p.derived);
  const derive = [];
  const correct = [];
  const retract = [];

  // retract: a part that repeats an earlier sibling word for word
  for (const p of belief) {
    const seen = new Map();
    for (const c of p.children.map((id) => byId.get(id)).filter(Boolean)) {
      const words = said(c) || wordsOnly(c.name);
      if (!words) continue;
      const key = `${c.kind}|${words}`;
      if (seen.has(key)) retract.push({ thing: c.id, trigger: `repeats ${seen.get(key)} word for word: one part heard twice, not two parts`, of: seen.get(key) });
      else seen.set(key, c.id);
    }
  }
  const gone = new Set(retract.map((r) => r.thing));

  for (const p of belief) {
    if (gone.has(p.id)) continue;
    const kids = p.children.map((id) => byId.get(id)).filter((c) => c && !gone.has(c.id));
    const kinds = [...new Set(kids.map((c) => c.kind))];
    for (const kind of kinds) {
      const group = kids.filter((c) => c.kind === kind);
      // shown: how many parts of this kind the thing holds
      if (group.length >= 2) derive.push({ end1: p.id, label: `${plural(kind)} shown`, end2: String(group.length), rule: "shown", because: `${group.length} ${plural(kind)} under ${nameOf(p)} on the record`, premises: group.map((c) => c.id) });
      // total: every number at least two parts carry
      const labels = [...new Set(group.flatMap((c) => heardOnly(c).filter((q) => valueOf(q.value) != null).map((q) => q.label)))];
      for (const label of labels) {
        const carrying = group.filter((c) => heardOnly(c).some((q) => q.label === label && valueOf(q.value) != null));
        if (carrying.length < 2) continue;
        const sum = carrying.reduce((a, c) => a + valueOf(heardOnly(c).find((q) => q.label === label).value), 0);
        derive.push({ end1: p.id, label: `total ${label}`, end2: String(sum), rule: "total", because: `the sum of ${label} over ${carrying.length} ${plural(kind)} under ${nameOf(p)}`, premises: carrying.map((c) => heardOnly(c).find((q) => q.label === label).note).filter(Boolean) });
      }
      // top: by the first number the request asked this kind of part to show
      const asked = (spec?.counted ?? []).find((c) => c.kind === kind)?.details ?? [];
      const first = asked.find((d) => labels.includes(d));
      if (first) {
        const ranked = group.map((c) => ({ c, v: valueOf(heardOnly(c).find((q) => q.label === first)?.value) })).filter((x) => x.v != null).sort((a, b) => b.v - a.v);
        if (ranked.length >= 2 && ranked[0].v > ranked[1].v) derive.push({ end1: p.id, label: `top ${kind} by ${first}`, end2: nameOf(ranked[0].c), rule: "top", because: `${nameOf(ranked[0].c)} has the most ${first} (${ranked[0].v}) of ${ranked.length} ${plural(kind)} under ${nameOf(p)}`, premises: ranked.map((x) => heardOnly(x.c).find((q) => q.label === first)?.note).filter(Boolean) });
      }
    }
    // correct: a count the thing's own parts contradict ("comment count 1",
    // two comments shown). The count's label names the kind it counts.
    for (const q of heardOnly(p)) {
      const v = valueOf(q.value);
      if (v == null) continue;
      const counted = kinds.find((k) => q.label.split(" ").some((w) => w === k || w === plural(k)));
      if (!counted) continue;
      const shown = kids.filter((c) => c.kind === counted).length;
      if (v < shown) {
        const why = `${q.label} ${q.value} is fewer than the ${shown} ${plural(counted)} ${nameOf(p)} shows`;
        correct.push({ end1: p.id, label: q.label, from: String(q.value), to: String(shown), trigger: why });
        // the corrected value is a conclusion like any other: derived from the
        // parts shown, withdrawn when they change
        derive.push({ end1: p.id, label: q.label, end2: String(shown), rule: "correct", because: why, premises: [q.note, ...kids.filter((c) => c.kind === counted).map((c) => c.id)].filter(Boolean) });
      }
    }
  }
  // drop: a value that only repeats a label ("moderators: moderators",
  // "description: name") says nothing — it is withdrawn, so the detail is
  // open again and asked again
  const drop = [];
  for (const t of belief) {
    if (gone.has(t.id)) continue;
    const labels = new Set(t.props.map((q) => q.label.toLowerCase()));
    for (const q of heardOnly(t)) {
      const v = String(q.value ?? "").trim().toLowerCase();
      if (v && (labels.has(v) || v === "name" || v === "title" || v === q.label.toLowerCase())) drop.push({ end1: t.id, label: q.label, end2: q.value, trigger: `"${q.value}" only repeats a label: no value was said` });
    }
  }
  return { schema: TALK_REASON_SCHEMA, derive, correct, retract, drop };
}
