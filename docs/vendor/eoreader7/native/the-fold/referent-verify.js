// referent-verify.js — the mechanical admission gate for a mouth's sentence.
//
// THE LAW (from the constitution, §III: "nothing is held unattributed"): a
// sentence is admitted only when every capitalized name it carries is grounded
// — it is in the field, or it is the ordinary capitalization of a sentence
// opener. A name the field has never seen is an INVENTED REFERENT: the
// sentence is refused mechanically, never negotiated with the mouth. The mouth
// may not hold what the field does not remember.
//
// THE NAME INVENTORY (2026-09-21, the falsify pass's first failure): the
// ground's names are NOT read off the ground text as substrings — they are
// extracted from the ground BY THE SAME RUN GRAMMAR the sentence is tested
// with, into an inventory of maximal name-sequences. A sentence's name-run is
// admitted iff it EXACTLY EQUALS an inventory entry. This closes the hole the
// first pass opened: "Thomas named Duke" had its run broken by the lowercase
// verb, leaving "Thomas" and "Duke" as two single names — each a substring of
// the ground ("Dr. Thomas Walker", "Duke of Cumberland") — so both passed
// individually. Under the inventory, "Thomas" is NOT a name (only "Thomas
// Walker" is), "Duke" is NOT a name (only "Duke of Cumberland" is), and the
// fabricated sentence is refused. The field remembers whole names, never
// fragments of them.
//
// The rule is stated to the MACHINERY, never to the mouth (§IV: the absence of
// the wrong path is the guardrail). The mouth writes freely; the gate refuses
// after the fact. This is what killed the "Thomas Duke / Vanderbilt /
// Jefferson" hallucinations of the 2026-09-21 Cumberland run: the workspace
// named only Walker, the Duke of Cumberland, Robertson, Donelson — the model's
// invented names carried no field trace, so every sentence carrying them was
// cut.

const GATE_SKIP = new Set([
  "however", "thus", "still", "yet", "soon", "later", "here", "there",
  "over", "around", "beyond", "beneath", "then", "next", "finally",
  "eventually", "meanwhile", "notably", "importantly", "today", "once",
  "after", "before", "such", "more", "most", "these", "those", "many",
  "much", "some", "few", "other", "another", "our", "your", "my", "was",
  "are", "were", "been", "which", "while", "since", "through", "during",
  "between", "among", "within", "without", "upon", "because", "though",
  "although", "now", "one", "two", "first", "second", "third", "last",
  "including", "instead",
  // ordinary sentence openers (single-word prose capitalization, never names)
  "the", "this", "it", "its", "they", "their", "there", "a", "an", "and",
  "but", "for", "with", "from", "by", "at", "on", "in", "of", "as", "to",
  "so", "when", "what", "why", "how", "she", "he", "her", "him", "his",
  "we", "you", "your", "i", "my", "me",
]);
// Name-particle connectors: a capitalized run may pass THROUGH these words and
// stay one name ("Duke of Cumberland", "Port of Nashville"). Conjunctions
// ("and") never connect — "James Robertson and John Donelson" is two names.
const NAME_PARTICLES = new Set(["of", "the", "de", "del", "della", "di", "du", "van", "von", "la", "le", "da", "dos"]);

/**
 * nameRuns(text) → the maximal capitalized name-sequences in a text, using the
 * SAME grammar for the ground and the sentence (asymmetry here is how "Dr.
 * Thomas Walker," split in the ground but joined in a sentence — the grammar
 * must be position-invariant). A run joins consecutive capitalized words and
 * absorbs lowercase name-particles mid-run ("Duke of Cumberland",
 * "Port of Nashville") and honorific abbreviations ("Dr. Thomas Walker").
 * A COMMA breaks a run ONLY when it separates two names ("Cherokee,
 * Chickasaw") — never when it ends a clause before a lowercase word ("Thomas
 * Walker, who named..."). A trailing period never isolates a name.
 * Possessives are normalized ("Duke's" → "Dukes"). Each returned element is
 * the run's words.
 */
const NAME_TITLES = new Set(["dr", "mr", "mrs", "ms", "st", "mt", "gen", "gov", "sen", "rep", "prof", "sgt", "cpt", "lt", "col", "rev", "hon", "jr", "sr", "md", "phd", "no", "us", "united"]);
export function nameRuns(text) {
  const raw = String(text ?? "").replace(/\s+/g, " ").trim().split(" ");
  const tokens = [];
  for (let i = 0; i < raw.length; i++) {
    const tok = raw[i];
    const next = raw[i + 1] ?? "";
    const hasComma = /[,;]/.test(tok);
    // Possessives normalize to the bare name: "Nashville's" → "Nashville"
    // (the apostrophe-s is a possessive, NOT a plural — the ground says
    // "Nashville's founding" and the sentence says "Nashville"; they must be
    // the same name). "Duke's" → "Dukes" is NOT this case (no apostrophe).
    const word0 = tok.replace(/'s\b/gi, "").replace(/[^A-Za-z]/g, "");
    const clean = word0.length ? word0 : tok.replace(/[^A-Za-z]/g, "");
    // A comma breaks a run ONLY when the next token is itself capitalized —
    // a separator between two names, not a clause boundary before lowercase.
    const commaSeparates = hasComma && /^[A-Z]/.test(next);
    // A SENTENCE BOUNDARY (".!?") followed by a capitalized word ends the run
    // AND the sentence: the ground is a joined string of many sentences, and
    // without this a closing period + the next sentence's opener would glue
    // two unrelated names ("Cumberland." + "Nashville" → "duke of cumberland
    // nashville"). The next sentence starts a fresh run regardless.
    const sentenceEnds = /[.!?]/.test(tok);
    const nextStartsSentence = /^[A-Z]/.test(next) && (tok.endsWith(".") || tok.endsWith("!") || tok.endsWith("?"));
    tokens.push({ word: clean, breakAfter: commaSeparates || nextStartsSentence, title: NAME_TITLES.has(clean.toLowerCase()) });
  }
  const runs = [];
  let cur = [];
  const flush = () => {
    if (cur.length) { runs.push(cur); cur = []; }
  };
  for (const { word, breakAfter, title } of tokens) {
    if (!word) { flush(); continue; }
    const isCap = /^[A-Z][a-z]{1,}$/.test(word);
    if (isCap && word.length > 2) {
      cur.push(word);
      if (breakAfter) flush();
      continue;
    }
    if (title && cur.length) {
      cur.push(word);
      continue;
    }
    if (NAME_PARTICLES.has(String(word).toLowerCase())) {
      if (cur.length) cur.push(word);
      continue;
    }
    flush();
  }
  flush();
  return runs.filter((r) => r.length >= 1);
}

/**
 * buildNameInventory(ground) → the set of name-sequences the field remembers.
 * Extracted from the ground by the same run grammar the sentence is tested
 * with, so ground and sentence are judged by the SAME rule — a fragment of a
 * name is never a name by itself ("Thomas" from "Thomas Walker" is not in the
 * inventory; "Thomas Walker" is). A leading prose article is normalized away
 * ("the cumberland river" and "cumberland river" are the same name — the
 * ground says "The Cumberland River is..." but a sentence can say "the river"
 * or "Cumberland River" without inventing anything).
 */
// A LEADING CAPITAL THAT IS A COMMON WORD IS NOT PART OF THE NAME (2026-09-21,
// measured on the generation pipeline's fourth run: "This" alone was called an
// invented name, "While the Cumberland River" was one name the material never
// holds, and the material's own "Today the Port of Nashville" hid "Port of
// Nashville" from the inventory). A caller that can tell a common word from a
// proper noun passes `isCommonWord`; leading common words are then peeled off,
// on both sides, before the name is looked up. Without the predicate nothing
// changes, so every existing caller reads exactly as before.
const NAME_LEAD_PARTICLES = new Set(["the", "of", "a", "an"]);
function peelLeading(tokens, isCommonWord) {
  const out = [];
  let t = [...tokens];
  while (t.length > 0 && isCommonWord(t[0])) {
    t = t.slice(1);
    while (t.length && NAME_LEAD_PARTICLES.has(t[0])) t = t.slice(1);
    out.push(t.join(" "));
  }
  return out; // each successively peeled form; "" means nothing name-like was left
}

export function buildNameInventory(ground, { isCommonWord = null } = {}) {
  const set = new Set();
  for (const r of nameRuns(ground)) {
    const seq = r.join(" ").toLowerCase();
    set.add(seq);
    if (seq.startsWith("the ")) set.add(seq.slice(4));
    if (typeof isCommonWord === "function") for (const f of peelLeading(seq.split(" "), isCommonWord)) if (f) set.add(f);
  }
  return set;
}

/**
 * inventedNameRuns(sentence, ground) → the capitalized name-sequences the
 * sentence carries that are NOT in the field's inventory, each with its GIVEN
 * disclosed. Empty array = the sentence is admitted. A run is admitted iff it
 * EXACTLY EQUALS an inventory entry; a single-word run at the sentence's start
 * is additionally exempt when it is a common prose opener (never a bare proper
 * noun — "Thomas" at the start of a sentence is tested, not exempted, unless
 * it is itself a name).
 *
 * ALL CONTENT HAS A GIVEN (2026-09-21, the user's law): a refused run is not
 * deleted — it is attributed. It carries no given from the field (no ground
 * source), so its given IS the model: the mouth generated it, and that is the
 * honest source. The refusal is the disclosure of that given, never a
 * vanishing. The losing reading is kept, exactly as the constitution §V
 * requires ("the swarm must keep the losing readings").
 */
export function inventedNameRuns(sentence, ground, { isCommonWord = null } = {}) {
  const inventory = buildNameInventory(ground, { isCommonWord });
  const words = String(sentence)
    .replace(/[’']/g, "")
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  const runs = nameRuns(sentence);
  return runs
    .map((r) => {
      const atSentenceStart = words.indexOf(r[0]) === 0;
      const seq = r.join(" ").toLowerCase();
      // The bare form (leading prose article dropped) is tested too — the
      // ground holds "the cumberland river" but a sentence may write "The
      // Cumberland River" with the article as prose, or "Cumberland River"
      // without it; both are the same name.
      const bare = seq.startsWith("the ") ? seq.slice(4) : seq;
      // THE ELLIPTICAL REFERENCE (2026-09-21, the fold's F2/F6 lesson): "The
      // Cumberland drains roughly eighteen thousand square miles" names the
      // river by its elliptical "The Cumberland" — legitimate prose, not an
      // invented referent. A sentence-initial "The X" run is admitted when X
      // alone is a grounded name ("cumberland"), or X+river is ("cumberland
      // river") — the ellipse resolves to the ground's own name. This is a
      // SHAPE rule (sentence-initial article + a known referent), never a
      // license to invent: "The Bratwurst" still dies (no such ground).
      const ellipse = atSentenceStart && r.length === 2 && seq.startsWith("the ");
      if (ellipse && (inventory.has(bare) || inventory.has(`${bare} river`))) return null;
      if (inventory.has(seq) || inventory.has(bare)) return null; // grounded — admitted
      if (r.length === 1 && atSentenceStart && GATE_SKIP.has(seq)) return null; // prose opener
      if (typeof isCommonWord === "function") {
        for (const f of peelLeading(seq.split(" "), isCommonWord)) {
          if (!f) return null;                                              // only common words: no name here
          if (inventory.has(f) || inventory.has(`${f} river`)) return null; // the name behind the capital is grounded
        }
      }
      return { runs: r, name: seq, given: "model" }; // invented — its given is the model
    })
    .filter(Boolean);
}

/**
 * referentVerified(sentence, ground) → true when the sentence carries no
 * invented referent (admitted); false when it does (refused). The refused runs
 * are attributed — never vanished.
 */
export function referentVerified(sentence, ground) {
  return inventedNameRuns(sentence, ground).length === 0;
}

// THE META-SENTENCE FILTER (2026-09-21): the mouth must write the piece, never
// talk about writing it. "The user requested a piece on the Cumberland River"
// is meta — refused like any other ungrounded sentence. Mechanical, never a
// stated prohibition to the mouth. A Set-based walk (KleeneUp's doctrine): the
// meta-verbs and the discourse-subject words are closed vocabularies — a
// pattern that lists words is a table, stated as a Set.
const META_SENTENCE_RE =
  /the user|requested a|requested to|will explore|essay (?:will|is|should)|this essay|the essay(?:'s| is| will| should)|asked to write|subject is|called upon|to answer this|is to (?:be|write)|its significance is (?:undeniable|a subject)/i;
// THE ASSISTANT-VOICE FILTER (2026-09-24): a second, distinct discourse
// register from META_SENTENCE_RE above. That filter catches the mouth
// talking ABOUT the writing task ("the user requested…"); this one catches
// the mouth talking AS A CHAT ASSISTANT — turn-taking and offer-to-help
// phrasing that belongs in a chat reply, never in a finished document.
// Every pattern here is grounded in a verbatim sentence that actually leaked
// into a real piece on code-shaped ground (surf-wp-fwd-b, surf-wp-fixed-web-1,
// both 2026-09-24): "Here's a breakdown of the provided text…", "Let me know
// if you'd like me to expand on any of these points…", "Here's why this
// rewrite works:", "How to continue the piece:". A closed vocabulary, same
// discipline as META_SENTENCE_RE and DISCOURSE_SUBJECT_WORDS below.
// 2026-09-26: a third real leak, grounded in this session's own live
// 10-page demo (demo-tenpage-full) — "Here are a few options, depending on
// the tone you're aiming for:" and "Here are a few options, incorporating
// the historical context…" opened and closed the piece verbatim. The
// contracted "here's" form above never matches the plural "here are" the
// mouth used offering several alternatives instead of committing to one.
const ASSISTANT_VOICE_RE =
  /\blet me know\b|\bfeel free to\b|\bi hope this helps\b|\b(?:would you like|do you want) me to\b|\byou'?d like me to\b|\bany other questions\b|\bhere'?s (?:a |an )?(?:breakdown|summary|overview|explanation)\b|\bhere'?s why this\b|\bhow to continue\b|\bhere are (?:a few|some|several) options\b/i;
// THE TECHNIQUE-COMMENTARY FILTER (2026-09-26): a third, distinct discourse
// register from both filters above — neither task-talk nor chat-assistant
// voice, but the mouth annotating ITS OWN phrasing choice inline, in
// markdown sub-heading formatting, as if leaving itself a footnote. Grounded
// in a verbatim leak observed live this session (fiction-test-1, part a1,
// admitted as a "turn" so admission.js's own meta check never ran on it —
// this filter runs earlier, in prosify.js, unconditionally, so it closes the
// leak regardless of that separate turn-exemption question): "* **Embedded
// Information:** The fact about the river's length is woven into the
// sentence, making it more natural and informative." The structural tell —
// a bullet immediately followed by a bolded label and a colon — never
// belongs in this piece's own prose register, whatever words follow it.
// The leading bullet is OPTIONAL (2026-09-26, generalized from the same
// session's own live 10-page demo): "**Option 2 (More descriptive):**"
// closed a real piece with the identical bolded-structural-label tell as
// the original "* **Embedded Information:**" grounding, but with no bullet
// character at all — confirming the bullet was never the load-bearing part
// of the pattern; a bolded label opening a line is.
const TECHNIQUE_COMMENTARY_RE = /^\s*(?:[*\-]\s*)?\*\*[^*]{2,60}?:?\*\*:?/;
// The "is a subject of X" pattern — the mouth's discourse filler (a subject of
// discussion/interest/study/ongoing study/debate). The discourse words are a
// Set, matched by membership against the sentence's words.
const DISCOURSE_SUBJECT_WORDS = new Set(["discussion", "interest", "study", "debate", "inquiry", "examination", "exploration", "conversation", "writing", "report", "essay", "article", "focus", "convention", "concern"]);

export function isMetaSentence(sentence) {
  const s = String(sentence ?? "");
  if (META_SENTENCE_RE.test(s) || ASSISTANT_VOICE_RE.test(s) || TECHNIQUE_COMMENTARY_RE.test(s)) return true;
  // "a subject of X" / "the subject of X" where X is a discourse word — the
  // mouth talking about the piece being written, not writing it.
  const lower = s.toLowerCase();
  const words = lower.split(/[^a-z']+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i] === "subject" && words[i + 1] === "of" && DISCOURSE_SUBJECT_WORDS.has(words[i + 2])) return true;
  }
  return false;
}

/**
 * admitSentence(sentence, { ground, usedSentences, claimCoreOf }) → { admit,
 * refused: [...] } — the full mechanical admission of one mouth-sentence: the
 * claim-core is not already deposited (repetition), it is grounded, it carries
 * no invented referent, and it is not meta. Each refusal is named AND
 * attributed — every refused sentence records its given (the model, when the
 * field held no trace of it). The mouth is never told; the sentence just does
 * not survive — but its source does, in the record.
 */
export function admitSentence(sentence, { ground = "", usedSentences = null, claimCoreOf = null } = {}) {
  const refused = [];
  const s = String(sentence ?? "").trim();
  if (s.length <= 20) return { admit: false, refused: [{ kind: "too_short", given: "model" }] };
  const core = claimCoreOf ? claimCoreOf(s) : null;
  if (core && usedSentences) {
    if (usedSentences.has(core) || (s.includes(" ") && [...usedSentences].some((u) => u.includes(" ") && claimCoreOf(u) === core))) {
      refused.push({ kind: "repeated_claim", given: "model" });
    }
  }
  const invented = inventedNameRuns(s, ground);
  if (invented.length) {
    refused.push({ kind: "invented_referent", given: "model", names: invented.map((v) => v.name) });
  }
  if (isMetaSentence(s)) refused.push({ kind: "meta", given: "model" });
  return { admit: refused.length === 0, refused };
}