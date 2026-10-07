// Handle: Linnaeus — Carl Linnaeus, who sorted living things by what kind of
// thing each is and let a kind's traits pass down to everything under it.
//
// kind-read.js — reasoning out what a kind of thing carries, from a source
// that describes it, with no model. When a request names a platform and no
// details ("make a reddit but only for dolphin content"), what each post
// shows is not the mouth's to guess: a description of the platform says it,
// and the engine can read it. The reading is in word order, over the
// English parser's word classes and lemmas (a long encyclopedic sentence is
// where the parser's tree goes wrong — "such as" hung off the verb, a
// relative clause hung off the list's last item), and it is four rules and
// one inference:
//
//   kind-of      "X such as A, B and C"        each item's head noun is a
//                                             kind of X ("text posts" -> a
//                                             post is a kind of content)
//   done-to      ", which are … voted … by M"  a relative clause after a list
//                                             is done to X (its items get it
//                                             by inheritance);
//                "Ps are verbed … by M"       a passive with its agent named
//                                             is done to P by M
//   holds        "Ps are organized into Bs    a container: B holds P (and a
//                 called Cs"                  name it is called by, C)
//   has          "N with (more) M"            N carries M
//
//   inheritance  what is done to a kind is done to every kind of it
//                (content is voted on -> a post, a kind of content, is too)
//
// A thing people DO to a thing, by an agent the source names, is on it: done
// by many ("voted up or down by other members") it is COUNTED — the detail is
// "<verb> count" (vote count); done by one ("approved by a moderator") it is a
// STATE the thing is in (approved). Every derived detail carries the sentences
// it rests on. What the source does not say is not derived — no source, no
// detail. No regular expressions.

export const KIND_READ_SCHEMA = "KindRead@1";
// words that turn a clause into its denial
const NEGATION = new Set(["not", "never", "no", "n't", "cannot"]);

const lower = (t) => String(t?.form ?? "").toLowerCase();
const lemma = (t) => String(t?.lemma ?? t?.form ?? "").toLowerCase();
const isNoun = (t) => !!t && (t.upos === "NOUN" || t.upos === "PROPN");
const isBoundary = (t) => !t || [".", ";", ":", "(", ")"].includes(lower(t));
// the head noun of the noun run that starts at i: "text posts" -> post,
// "user-created boards" -> board; returns { head, end } or null
function nounRunAt(toks, i) {
  let j = i, head = null;
  while (j < toks.length && (isNoun(toks[j]) || toks[j].upos === "ADJ" || (toks[j].upos === "ADP" && isNoun(toks[j + 1]) && lower(toks[j]) !== "of" && lower(toks[j]) !== "by" && lower(toks[j]) !== "into" && lower(toks[j]) !== "with" && lower(toks[j]) !== "to"))) {
    if (isNoun(toks[j])) head = toks[j];
    j++;
  }
  return head ? { head: lemma(head), end: j, many: lower(head) !== lemma(head) } : null;
}
// the nearest noun to the left that is not inside a prepositional phrase:
// in "submit content to the site such as links", "such as" is about the
// content, not "the site" (a noun led by "to the" is the phrase's, not the
// clause's)
function nounBefore(toks, i) {
  for (let j = i - 1; j >= 0; j--) {
    if (isBoundary(toks[j])) return null;
    if (!isNoun(toks[j])) { if (toks[j].upos === "VERB") return null; continue; }
    let m = j - 1;
    while (m >= 0 && (isNoun(toks[m]) || toks[m].upos === "ADJ" || toks[m].upos === "DET")) m--;
    if (m >= 0 && toks[m].upos === "ADP") { j = m; continue; }
    return lemma(toks[j]);
  }
  return null;
}

/**
 * readKinds(text, { parse, sentences }) -> { schema, facts }
 *   facts: [{ rel: "kind-of"|"done-to"|"holds"|"has"|"called", a, b, agent?, sentence }]
 */
export function readKinds(text, { parse, sentences }) {
  const facts = [];
  for (const s of sentences(String(text ?? ""))) {
    const toks = parse(s.text);
    const say = (f) => facts.push({ ...f, sentence: s.text });
    for (let i = 0; i < toks.length; i++) {
      const w = lower(toks[i]);
      // kind-of: "X such as A, B, and C" (+ a relative clause done to all)
      if (w === "such" && lower(toks[i + 1]) === "as") {
        const x = nounBefore(toks, i);
        if (!x) continue;
        const items = [];
        let j = i + 2;
        while (j < toks.length && !isBoundary(toks[j])) {
          const run = nounRunAt(toks, j);
          if (run) { items.push(run.head); j = run.end; continue; }
          const v = lower(toks[j]);
          if (v === "," || v === "and" || v === "or") { if (v === "," && (lower(toks[j + 1]) === "which" || lower(toks[j + 1]) === "that")) break; j++; continue; }
          break;
        }
        for (const it of items) if (it !== x) say({ rel: "kind-of", a: it, b: x });
        // ", which are then voted up or down by other members"
        if (lower(toks[j]) === "," && (lower(toks[j + 1]) === "which" || lower(toks[j + 1]) === "that")) {
          let k = j + 2, verb = null, negated = false;
          while (k < toks.length && !isBoundary(toks[k])) { if (NEGATION.has(lower(toks[k]))) negated = true; if (toks[k].upos === "VERB") { verb = toks[k]; break; } k++; }
          if (negated) verb = null;   // "which are never voted on" says it is NOT done
          const byAt = verb ? toks.findIndex((t, m) => m > k && lower(t) === "by") : -1;
          const agentRun = byAt > 0 ? nounRunAt(toks, byAt + 1 + (toks[byAt + 1]?.upos === "DET" ? 1 : 0) + (toks[byAt + 1]?.upos === "ADJ" ? 1 : 0)) : null;
          // the clause is about the list's kind (the content); its items get
          // it by inheritance, not by being named here
          if (verb) say({ rel: "done-to", a: x, b: lemma(verb), agent: agentRun?.head ?? null, many: !!agentRun?.many, form: lower(verb) });
        }
        i = j;
        continue;
      }
      // passive: "Ps are VERBed ... (into Bs (called Cs)) (by M)"
      if ((w === "are" || w === "is" || w === "were" || w === "was" || w === "be") && toks[i + 1]?.upos === "VERB" && i > 0) {
        // "a posted message might need to be approved": the patient is the
        // clause's subject, left of its modal and "to"
        const p = nounBefore(toks, w === "be" ? toks.findLastIndex((t, m) => m < i && (t.upos === "AUX" || lower(t) === "need" || lower(t) === "to") && !(toks[m - 1] && (toks[m - 1].upos === "AUX" || lower(toks[m - 1]) === "need" || lower(toks[m - 1]) === "to"))) : i);
        if (!p) continue;
        const verb = toks[i + 1];
        // "posts are not voted on by members" says it is not done
        if (toks.slice(Math.max(0, i - 3), i + 1).some((t) => NEGATION.has(lower(t)))) continue;
        let k = i + 2, agent = null, many = false;
        while (k < toks.length && !isBoundary(toks[k])) {
          const v = lower(toks[k]);
          if (v === "into" || v === "in") {
            const run = nounRunAt(toks, k + 1 + (toks[k + 1]?.upos === "DET" ? 1 : 0));
            if (run) {
              say({ rel: "holds", a: run.head, b: p });
              if (lower(toks[run.end]) === "called" || lower(toks[run.end]) === "named") {
                const alias = nounRunAt(toks, run.end + 1 + (toks[run.end + 1] && !isNoun(toks[run.end + 1]) ? 1 : 0));
                if (alias) say({ rel: "called", a: run.head, b: alias.head });
              }
              k = run.end; continue;
            }
          }
          if (v === "by" && lower(toks[k + 1]) !== "subject") { const run = nounRunAt(toks, k + 1 + (toks[k + 1]?.upos === "DET" || toks[k + 1]?.upos === "ADJ" ? 1 : 0)); if (run) { agent = run.head; many = run.many; } }
          k++;
        }
        if (agent) say({ rel: "done-to", a: p, b: lemma(verb), agent, many, form: lower(verb) });
        continue;
      }
      // has: "N with (more) M"
      if (w === "with" && i > 0) {
        const n = nounBefore(toks, i);
        const run = nounRunAt(toks, i + 1 + (toks[i + 1]?.upos === "ADJ" || toks[i + 1]?.upos === "DET" ? 1 : 0));
        if (n && run) say({ rel: "has", a: n, b: run.head });
      }
    }
  }
  return { schema: KIND_READ_SCHEMA, facts };
}

/** Every kind a kind is a kind of, itself included (the kind-of closure). */
export function kindsAbove(facts, kind) {
  const out = [kind];
  for (let i = 0; i < out.length; i++) for (const f of facts) if (f.rel === "kind-of" && f.a === out[i] && !out.includes(f.b)) out.push(f.b);
  return out;
}

/** What a kind carries, reasoned out: counts of what is done to it (and to
 *  every kind above it) by a named agent, and what it is said to have. Each
 *  with the facts it rests on. -> [{ detail, because: [sentence] }] */
export function detailsFor(facts, kind) {
  const above = kindsAbove(facts, kind);
  const out = new Map();
  const add = (detail, f) => { if (!out.has(detail)) out.set(detail, new Set()); out.get(detail).add(f.sentence); };
  for (const f of facts) {
    if (!above.includes(f.a)) continue;
    // done by many ("by other members") is counted; done by one ("by a
    // moderator") is a state the thing is in ("approved")
    if (f.rel === "done-to" && f.agent) add(f.many ? `${f.b} count` : f.form, f);
    if (f.rel === "has") add(f.b, f);
  }
  return [...out.entries()].map(([detail, because]) => ({ detail, because: [...because], inherited: !facts.some((f) => f.a === kind && (f.rel === "done-to" || f.rel === "has")) }));
}

/** What holds a kind (a container the source names, and what it is called). */
export function holdersOf(facts, kind) {
  const above = kindsAbove(facts, kind);
  return facts.filter((f) => f.rel === "holds" && above.includes(f.b)).map((f) => ({ holder: f.a, called: facts.filter((g) => g.rel === "called" && g.a === f.a).map((g) => g.b), because: f.sentence }));
}
