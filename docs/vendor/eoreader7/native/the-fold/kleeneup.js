// kleeneUp.js — THE REGEX-REMOVAL PATROL (2026-09-21, the user's archon).
//
// THE DOCTRINE: a regex is the right tool when it describes a SHAPE (any
// number, any letter, any structure). It is the wrong tool when it ENUMERATES
// A CLOSED LIST — one/two/three..., dr/mr/mrs/ms..., the whole vocabulary of a
// hedge — because a closed list is not a shape, it is a TABLE, and a table is
// stated as a Set or a Map, plain logic the next reader can edit.
//
// KleeneUp's patrol is MECHANICAL, like every selector: it scans source for
// the fingerprints of table-regexes and reports each with its line and its
// honest replacement. It never edits — it names (the machine does what it can,
// names what it cannot; the human or the writer decides the cut).
//
// THE FINGERPRINTS (each is falsified in kleeneup-falsify.test.mjs):
//   alternation-list   — a /...|...|.../ where the branches are SHORT WORDS
//                        (the enumeration of a closed vocabulary): a Set.
//   abbreviation-guard — a (?<=[.!?]) lookbehind or (?!abbrev) guard that
//                        tokenizes sentence boundaries: a table of
//                        abbreviations + a token walk (see essay-fold's
//                        splitSentences).
//   number-alternation — a (?:one|two|three|...) style number-word list: a
//                        Set of number words + a map to a canonical token.
//   char-class-token   — a split(/[^... ]+/) that keeps spaces (so tokens are
//                        whole phrases, not words): split on the full class.
//   lookaround         — any (?<= or (?= or (?! — usually a table problem in
//                        disguise, reported so a human eyes it.
//
// Each finding: { kind, file, line, snippet, replacement } — the replacement
// is stated, never applied. The finding is the disclosure (the constitution
// §V: the losing pattern is kept, its replacement named).

const NUMBERS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety","hundred","thousand","million","billion"];
const NUMBER_SET = new Set(NUMBERS);
const ABBREV = new Set(["dr","mr","mrs","ms","st","mt","us","usa","etc","eg","ie","vs","no","gen","gov","sen","rep","prof","sr","jr","phd","md","corps","co","inc","ltd"]);

// ── the scanners ────────────────────────────────────────────────────────────

/** alternation-list: /...|...|.../ whose branches are mostly short words —
 * the enumeration of a closed vocabulary. Reports the branch count and a
 * suggested Set name. */
function scanAlternationLists(text) {
  const findings = [];
  const re = /\/[^/\n]*\b[a-z]{2,}\|[a-z|]{3,}[^/\n]*\//g;
  let m;
  while ((m = re.exec(text))) {
    const body = m[0].slice(1, -1);
    const branches = body.split("|").map((b) => b.trim()).filter(Boolean);
    const words = branches.filter((b) => /^[a-z]{2,}$/.test(b));
    if (words.length >= 3 && words.length / Math.max(1, branches.length) >= 0.6) {
      findings.push({
        kind: "alternation-list", snippet: m[0].slice(0, 90),
        branches: branches.length, words: words.length,
        replacement: `a Set (${words.slice(0, 4).map((w) => '"' + w + '"').join(", ")}…) — membership, not a pattern`,
      });
    }
  }
  return findings;
}

/** number-alternation: a word-number list in a regex — a Set + a map. */
function scanNumberAlternation(text) {
  const findings = [];
  const joined = NUMBERS.join("|");
  const re = new RegExp(`\\(\\?(?::|.)(?:${joined})`, "gi");
  let m;
  while ((m = re.exec(text))) {
    findings.push({
      kind: "number-alternation", snippet: m[0].slice(0, 60),
      replacement: "FOLD_NUMBER_WORDS Set + map to a canonical token (see essay-fold.js)",
    });
  }
  // Also a bare | list that is most-of-the-numbers:
  const re2 = /\/[^/\n]*(?:one|two|three|four|five|six|seven|eight|nine|ten)\|[^/\n]*\/(?![\s\S]*?number)/gi;
  while ((m = re2.exec(text))) {
    const branches = m[0].slice(1, -1).split("|");
    const hits = branches.filter((b) => NUMBER_SET.has(b.trim().toLowerCase()));
    if (hits.length >= 4) {
      findings.push({
        kind: "number-alternation", snippet: m[0].slice(0, 80),
        branches: branches.length, numberWords: hits.length,
        replacement: "a Set of number words — membership, not a pattern",
      });
    }
  }
  return findings;
}

/** abbreviation-guard: lookbehind/lookahead that guards abbreviation periods
 * when splitting sentences — a table + a token walk. Two shapes:
 *   - a lookbehind over sentence terminators, e.g. (?<=[.!?]) — it makes the
 *     splitter break after every period, which is exactly the abbreviation
 *     failure ("Dr." ends a sentence); and
 *   - a lookahead naming abbreviations, e.g. (?!dr|mr|mrs) — a closed list in
 *     the pattern. */
function scanAbbreviationGuards(text) {
  const findings = [];
  const re = /\(\?<=[^)]*[.!?][^)]*\)|\(\?!\s*(?:dr|mr|mrs|ms|st|mt|etc|us|usa)[^)]*\)/gi;
  let m;
  while ((m = re.exec(text))) {
    findings.push({
      kind: "abbreviation-guard", snippet: m[0].slice(0, 60),
      replacement: "an ABBREV Set + a token walk that ends a sentence only when the last word is not an abbreviation (see essay-fold.js splitSentences)",
    });
  }
  return findings;
}

/** char-class-token: split(/[^... ]+/) keeping spaces — tokens become whole
 * phrases, not words. The class must NOT include the space if the intent is
 * word-tokenization. Matches a character class that CONTAINS a space and ends
 * with +. GUARD (2026-09-21, the false-positive lesson from referent-verify):
 * the char-class is a tokenizer error ONLY when it is the ARGUMENT to .split()
 * — when it is the argument to .replace() (as in referent-verify's
 * sentence-start normalization), the space is the whole point (collapsing
 * "Bratwurst, University" to "Bratwurst University" for an indexOf check) and
 * the pattern describes a legitimate shape. */
function scanCharClassTokens(text) {
  const findings = [];
  const re = /\[\^([^\]\n]* [^\]\n]*)\]\+\//g;
  let m;
  while ((m = re.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    const feedsSplit = /\.split\(/.test(before);
    if (!feedsSplit) continue;
    findings.push({
      kind: "char-class-token", snippet: m[0].slice(0, 70),
      replacement: `split(/[^${m[1].replace(/ /g, "")}]+/) — drop the space so tokens are words, or this splits whole phrases`,
    });
  }
  return findings;
}

/** lookaround: any (?<= (?= (?! — a table problem in disguise, flagged for a
 * human eye. */
function scanLookarounds(text) {
  const findings = [];
  const re = /\(\?<=|\(\?!|\(\?=/g;
  let m;
  while ((m = re.exec(text))) {
    findings.push({ kind: "lookaround", snippet: m[0], replacement: "usually a table problem in disguise — a Set + explicit step states the logic plainly" });
  }
  return findings;
}

// ── the patrol ──────────────────────────────────────────────────────────────
/** patrol(code) → the regex-table findings in a body of source. Pure: same
 * code, same findings, always. */
export function patrol(code, { file = "" } = {}) {
  const text = String(code ?? "");
  const all = [
    ...scanAlternationLists(text),
    ...scanNumberAlternation(text),
    ...scanAbbreviationGuards(text),
    ...scanCharClassTokens(text),
    ...scanLookarounds(text),
  ];
  // de-duplicate by snippet + kind (the same pattern can trip two scanners)
  const seen = new Set();
  const out = [];
  for (const f of all) {
    const key = `${f.kind}:${f.snippet}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...f, file, line: lineOf(text, f.snippet) });
  }
  return out;
}

function lineOf(text, snippet) {
  const idx = text.indexOf(snippet);
  if (idx < 0) return null;
  return text.slice(0, idx).split("\n").length;
}

/** The honest-replacement suggestions — the DISSOLUTION of each kind, stated
 * so the human or the writer can apply it. */
export function dissolutionOf(kind) {
  const table = {
    "alternation-list": "state the closed list as a Set and test membership; a pattern that lists words is a table.",
    "number-alternation": "state the number words as a Set and map each to a canonical token (e.g. 'num'); membership, not a pattern.",
    "abbreviation-guard": "state the abbreviations as a Set and walk the tokens explicitly; a sentence ends only when the last word is not an abbreviation.",
    "char-class-token": "drop the space from the split class so tokens are words — or you are splitting whole phrases, not tokenizing.",
    "lookaround": "state the lookaround's condition as an explicit step in the walk; lookarounds are usually a table in disguise.",
  };
  return table[kind] ?? null;
}

export const KLEENEUP_SCHEMA = "EOKleeneUp@1";