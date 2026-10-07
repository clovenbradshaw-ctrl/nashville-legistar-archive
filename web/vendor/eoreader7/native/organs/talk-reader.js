// Handle: Boswell — James Boswell, who sat with Johnson and turned talk into
// a record: he did not ask Johnson to speak in entries, he listened and wrote
// the entries himself.
//
// talk-reader.js — the ear for a build. The mouth only TALKS: plain sentences
// about the thing being built ("It has a post titled J-pod is back. That post
// has 301 upvotes."). It never writes an operator, an address, a field or a
// type. This organ reads the talk the way the engine reads any text — through
// the English dependency parser (adapters/text/english-parser.js, Chomsky) —
// into claims `end1 —label→ end2` about the THINGS the talk introduces:
//
//   a thing is introduced   "a post", "another post", "one community"  → new
//   a thing is referred to  "the post", "that post", "it", "its"        → existing
//   a thing is named        "called r/orca", "titled J-pod is back"     → named
//   a thing is counted      "has 301 upvotes" (a number on a noun)      → upvotes = 301
//   a thing has parts       "has a post", "a post in r/orca"            → has
//   a thing is described    "is quiet", "is a forum"                    → is / is a
//   anything else it does   "its rules ask members to …"                → the verb
//
// The claims go to the kernel's notes ledger (kernel/notes.js), which types
// each one itself — INS the first time it is heard, SYN when heard again —
// stamped `operator_basis: produced`: the reader typed it, never the talker.
// Nothing here is a regular expression: the parser's tree is walked.

export const TALK_READER_SCHEMA = "TalkReading@1";

// verbs that say what a thing is FOR ("is used to …", "is meant for …")
const PURPOSE = new Set(["use", "mean", "design", "intend", "let", "allow"]);
const INDEFINITE = new Set(["a", "an", "another", "one", "some", "each", "every", "new", "more", "other", "further", "extra"]);
const DEFINITE = new Set(["the", "that", "this", "these", "those", "its", "their", "his", "her"]);
const BACKWARD = new Set(["it", "its", "they", "them", "their", "this", "that", "he", "she", "him", "her"]);
const NAMING = new Set(["call", "name", "title", "label", "caption", "head", "entitle"]);
const HAVING = new Set(["have", "include", "contain", "feature", "show", "list", "hold", "offer", "display"]);
const INSIDE = new Set(["in", "on", "inside", "within", "under", "at", "of", "from"]);
const NUMBER_WORDS = new Map([["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10], ["eleven", 11], ["twelve", 12], ["twenty", 20], ["thirty", 30], ["hundred", 100]]);
const isDigit = (ch) => ch >= "0" && ch <= "9";
const isLetter = (ch) => ch.toLowerCase() !== ch.toUpperCase();
/** A token is punctuation only when none of its characters is a letter or a
 *  digit ("r/orca" is a name even when the tagger calls it PUNCT). */
const onlyPunct = (form) => !String(form ?? "").split("").some((c) => isLetter(c) || isDigit(c));

/** A number a token states: digits (commas allowed) or a number word. */
export function numberOf(form) {
  const f = String(form ?? "").toLowerCase().split(",").join("");
  if (f && f.split("").every((c) => isDigit(c) || c === ".")) return Number(f);
  return NUMBER_WORDS.get(f) ?? null;
}

/** makeTalkReader({ parse }) — parse(sentenceText) -> UD rows
 *  [{ id, form, lemma, upos, head, deprel }] (english-parser's `analyse`
 *  over its own tokenizer), and sentences(text) -> [{ text }]. The reader
 *  keeps the discourse (which things exist, which was last the subject)
 *  across calls, so talk from many small asks reads as one conversation. */
export function makeTalkReader({ parse, sentences }) {
  const things = [];            // { id, kind, modifier, name }
  let lastSubject = null;
  let count = 0;

  const newThing = (kind, modifier = null, name = null) => {
    const t = { id: `${kind || "thing"}#${++count}`, kind: kind || "thing", modifier, name };
    things.push(t);
    return t;
  };
  const latestOfKind = (kind, modifier) =>
    [...things].reverse().find((t) => t.kind === kind && (!modifier || !t.modifier || t.modifier === modifier)) ?? null;
  const byName = (name) => things.find((t) => t.name && t.name.toLowerCase() === String(name).toLowerCase()) ?? null;

  function read(text, { witness = null } = {}) {
    const claims = [];
    const seen = new Set();
    const say = (end1, label, end2, sentence) => {
      if (!end1 || !label || end2 == null || end2 === "") return;
      const key = `${end1}|${label}|${end2}`;
      if (seen.has(key)) return;
      seen.add(key);
      claims.push({ end1, label, end2: String(end2), sentence, witness });
    };

    for (const s of sentences(text)) {
      const rows = parse(s.text);
      if (!rows.length) continue;
      const kids = new Map(rows.map((r) => [r.id, []]));
      for (const r of rows) if (kids.has(r.head)) kids.get(r.head).push(r);
      const at = (id) => rows[id - 1];
      const childOf = (r, ...rels) => (kids.get(r.id) ?? []).filter((k) => rels.includes(k.deprel) || rels.includes(k.deprel.split(":")[0]));
      const subtree = (r) => { const out = [r]; for (const k of kids.get(r.id) ?? []) out.push(...subtree(k)); return out.sort((a, b) => a.id - b.id); };
      const words = (list) => list.filter((t) => !onlyPunct(t.form)).map((t) => t.form).join(" ");
      // The words a naming verb introduces, in order, to the end of its clause:
      // "is called r/orca" -> "r/orca"; "a post titled J-pod is back" -> "J-pod is back".
      // A name runs to the first punctuation; what follows it describes the
      // thing ("r/dolphin: a subreddit for …" -> name r/dolphin, is "a subreddit for …").
      const namedAfter = (verb) => {
        const span = subtree(verb); const last = span[span.length - 1].id;
        const after = rows.filter((t) => t.id > verb.id && t.id <= last);
        const cut = after.findIndex((t, i) => i > 0 && onlyPunct(t.form) && !["'", '"', "’", "‘", "“", "”"].includes(t.form));
        return cut < 0 ? { name: words(after), rest: "" } : { name: words(after.slice(0, cut)), rest: words(after.slice(cut + 1)) };
      };
      // What a clause says, without its subject: "ask members to post only dolphin photos".
      // The helpers of the verb (is, are, was, there) are not what it says.
      const predicate = (head, subj) => {
        const drop = new Set(subj ? subtree(subj).map((t) => t.id) : []);
        for (const k of childOf(head, "aux", "cop", "expl")) for (const t of subtree(k)) drop.add(t.id);
        return words(subtree(head).filter((t) => !drop.has(t.id)));
      };
      const lower = (t) => String(t?.form ?? "").toLowerCase();

      // The thing a noun (or pronoun, or name) refers to in this discourse.
      const refer = (r) => {
        if (!r) return null;
        if (r.upos === "PRON" && BACKWARD.has(lower(r))) return lastSubject;
        if (r.upos === "PROPN") {
          const name = words(subtree(r).filter((t) => ["flat", "compound", "PROPN"].includes(t.deprel) || t.id === r.id || t.upos === "PROPN"));
          return byName(name) ?? newThing("thing", null, name);
        }
        if (r.upos !== "NOUN") return null;
        const kind = String(r.lemma ?? r.form).toLowerCase();
        // words that introduce a thing ("one more", "another", "a new") are
        // not part of what kind of thing it is
        const mods = childOf(r, "amod", "compound").map((m) => lower(m)).filter((m) => !INDEFINITE.has(m)).join(" ") || null;
        const det = childOf(r, "det", "nmod:poss").map(lower)[0] ?? null;
        const introduced = childOf(r, "nummod", "amod", "det").some((m) => INDEFINITE.has(lower(m)));
        const poss = childOf(r, "nmod:poss")[0];
        if (poss && poss.upos === "PRON" && BACKWARD.has(lower(poss)) && lastSubject) {
          const owned = newThing(kind, mods);
          say(lastSubject.id, "has", owned.id, s.text);
          return owned;
        }
        if (introduced || (det && INDEFINITE.has(det))) return newThing(kind, mods);
        if (det && DEFINITE.has(det)) return latestOfKind(kind, mods) ?? newThing(kind, mods);
        return latestOfKind(kind, mods) ?? newThing(kind, mods);
      };
      // A count on a noun: "301 upvotes" -> { label: "upvotes", value: 301 }
      const countOn = (r) => {
        // a numeral that introduces the thing ("one more post") is not a count of it
        const introducing = childOf(r, "amod", "det").some((m) => INDEFINITE.has(lower(m)));
        const num = introducing ? null : childOf(r, "nummod").map((n) => numberOf(n.form)).find((v) => v != null);
        return num == null ? null : { label: lower(r), value: num };
      };
      // "a post in r/orca" -> r/orca has post
      const placeOf = (r, thing) => {
        for (const m of childOf(r, "nmod", "obl")) {
          const kase = childOf(m, "case").map(lower)[0];
          if (!kase || !INSIDE.has(kase)) continue;
          const container = refer(m);
          if (container && thing && container !== thing) say(container.id, "has", thing.id, s.text);
        }
      };

      const clause = (head, subjectThing) => {
        const lemma = String(head.lemma ?? head.form).toLowerCase();
        const objs = childOf(head, "obj", "xcomp", "attr").flatMap((o) => [o, ...childOf(o, "conj")]);
        // naming: "is called r/orca", "a post titled J-pod is back"
        if (NAMING.has(lemma)) {
          const { name, rest } = namedAfter(head);
          if (name && subjectThing) { subjectThing.name = name; say(subjectThing.id, "named", name, s.text); }
          if (rest && subjectThing) say(subjectThing.id, "is", rest, s.text);
          return;
        }
        // having: counts and parts
        if (HAVING.has(lemma)) {
          for (const o of objs) {
            const c = countOn(o);
            if (c && subjectThing) { say(subjectThing.id, c.label, c.value, s.text); continue; }
            const part = refer(o);
            if (part && subjectThing && part !== subjectThing) { say(subjectThing.id, "has", part.id, s.text); placeOf(o, part); describeNoun(o, part); }
          }
          return;
        }
        // what it is for: "the button is used to sort posts by votes" -> for "sort posts by votes"
        if (PURPOSE.has(lemma) && subjectThing) {
          const aim = childOf(head, "xcomp", "advcl", "obl")[0];
          if (aim) { const said = words(subtree(aim).filter((t) => !(t.id < aim.id && ["mark", "case"].includes(t.deprel) && childOf(aim, "mark", "case").includes(t)))); if (said) { say(subjectThing.id, "for", said, s.text); return; } }
        }
        // anything else it does, kept as the verb it is
        if (subjectThing) { const said = predicate(head, childOf(head, "nsubj", "nsubj:pass")[0]); if (said && said.toLowerCase() !== lemma) say(subjectThing.id, lemma, said, s.text); }
      };

      // A noun that carries its own clause ("a post titled J-pod is back").
      const describeNoun = (n, thing) => {
        for (const acl of childOf(n, "acl", "acl:relcl")) clause(acl, thing);
        const c = countOn(n);
        if (c && thing) say(thing.id, "count", c.value, s.text);
      };

      const root = rows.find((r) => r.deprel === "root");
      if (!root) continue;
      const subj = childOf(root, "nsubj", "nsubj:pass", "csubj")[0] ?? null;
      const subjectThing = refer(subj);
      if (subj && subjectThing) { placeOf(subj, subjectThing); describeNoun(subj, subjectThing); }
      const heads = [root, ...childOf(root, "conj").filter((c) => c.upos === "VERB" || c.upos === "NOUN" || c.upos === "ADJ")];
      for (const h of heads) {
        const hSubj = h === root ? subjectThing : (refer(childOf(h, "nsubj", "nsubj:pass")[0]) ?? subjectThing);
        const cop = childOf(h, "cop")[0];
        const c = countOn(h);
        if (c && hSubj && (h.upos === "NOUN")) {                     // "That post has 301 upvotes" parsed with the noun as root
          say(hSubj.id, c.label, c.value, s.text);
          for (const cj of childOf(h, "conj")) { const c2 = countOn(cj); if (c2) say(hSubj.id, c2.label, c2.value, s.text); }
          continue;
        }
        if (childOf(h, "expl").length && hSubj && subj) {                // "There is a search box": the thing is on the record
          say(hSubj.id, "exists", hSubj.kind, s.text);
          describeNoun(subj, hSubj);
          continue;
        }
        if (cop && hSubj) {                                           // "It is a forum" / "It is quiet"
          const det = childOf(h, "det").map(lower)[0];
          if (h.upos === "NOUN" && det && INDEFINITE.has(det)) say(hSubj.id, "is a", String(h.lemma ?? h.form).toLowerCase(), s.text);
          else say(hSubj.id, "is", words(subtree(h).filter((t) => t.deprel !== "nsubj" && t.deprel !== "cop" && !subtree(childOf(h, "nsubj")[0] ?? { id: -1 }).includes(t))), s.text);
          continue;
        }
        if (h.upos === "VERB" || h.upos === "AUX") clause(h, hSubj);
      }
      if (subjectThing) lastSubject = subjectThing;
    }
    return { schema: TALK_READER_SCHEMA, claims, things: things.map((t) => ({ ...t })) };
  }

  // The engine's own hand on the discourse: a thing it put on the record from
  // a question it asked (mint), and the thing the next pronoun means (focus).
  const mint = (kind, modifier = null, name = null) => { const t = newThing(kind, modifier, name); lastSubject = t; return { ...t }; };
  const focus = (id) => { const t = things.find((x) => x.id === id); if (t) lastSubject = t; };
  const rename = (id, name) => { const t = things.find((x) => x.id === id); if (t) t.name = name; };
  return { read, mint, focus, rename, things: () => things.map((t) => ({ ...t })) };
}
