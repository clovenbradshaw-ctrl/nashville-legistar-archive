import { unquoted } from "./quoting.js";
// arithmetic.js — a number is computed, never generated.
//
// L5's law at its smallest scale: a compliance-critical fact is never left
// to the model's own instruction-following. Measured live (2026-08-17,
// qwen2.5:14b, this repo's own trial): asked "What's 17 times 24?" the
// model answered 372. The real product is 408. Nothing in the app caught
// it, because nothing checked it — the model was the only arithmetic this
// instrument had.
//
// Detection is structural, P4's rule: a question is arithmetic when, after
// normalizing its English operator words to symbols (never computing
// anything itself — the same L2 discipline capitalization-veto uses:
// word classes FIND the shape, they never TYPE the value), what remains
// parses with the injected engine and contains no free symbol. A question
// about "the mayor" or "the year it was founded" never reaches evaluation;
// it is not this module's to answer.
//
// The engine is injected (the cast.js pattern) so this module stays pure
// and Node-testable: the browser page hands it the vendored mathjs global,
// tests hand it the same package imported directly. Neither this module
// nor its caller may fall back to computing an operator by hand — a hand-
// rolled `+`/`*` is exactly the untested arithmetic this module exists to
// replace.

/** English operator words this module will normalize, ordered longest-
 * phrase-first so "multiplied by" matches before a bare "by" ever could.
 * Order-reversing phrasing ("N subtracted from M" means M − N, not N − M)
 * is deliberately ABSENT here — a same-shape one-token swap would read it
 * backwards — and handled instead by its own two-number regexes below,
 * each reconstructing the expression with the operands in the order the
 * phrase actually means. */
const WORD_OPS = [
  [/\bmultiplied\s+by\b/gi, "*"],
  [/\btimes\b/gi, "*"],
  [/\bdivided\s+by\b/gi, "/"],
  [/\bover\b/gi, "/"],
  [/\bplus\b/gi, "+"],
  [/\badded\s+to\b/gi, "+"],
  [/\bminus\b/gi, "-"],
  [/\bto\s+the\s+power\s+of\b/gi, "^"],
];
const PERCENT_OF_RE = /(-?\d[\d,]*(?:\.\d+)?)\s*(?:%|percent)\s+of\s+(-?\d[\d,]*(?:\.\d+)?)/gi;
const SQUARE_ROOT_RE = /square\s+root\s+of\s+(-?\d[\d,]*(?:\.\d+)?)/gi;
const SQUARED_RE = /(-?\d[\d,]*(?:\.\d+)?)\s+squared\b/gi;
const CUBED_RE = /(-?\d[\d,]*(?:\.\d+)?)\s+cubed\b/gi;
/** "N subtracted from M" / "N less than M" / "N fewer than M" all read as
 * M − N, and each has exactly one standard reading — unlike "divided
 * into" below, nobody means anything else by "5 subtracted from 12".
 * Checked, not assumed: a genuine yes/no comparison ("Is 3 less than
 * 10?") is never at risk of being mis-read as this arithmetic reading,
 * because "Is" sits outside WRAPPER_RE's stripped set — it survives
 * normalization as a stray, non-numeric word and fails PURE_EXPRESSION_RE
 * downstream regardless of what this reversal computes (pinned in
 * arithmetic.test.mjs). */
const reverseSubtract = (_, n, m) => `((${m})-(${n}))`;
const SUBTRACTED_FROM_RE = /(-?\d[\d,]*(?:\.\d+)?)\s+subtracted\s+from\s+(-?\d[\d,]*(?:\.\d+)?)/gi;
const LESS_THAN_RE = /(-?\d[\d,]*(?:\.\d+)?)\s+less\s+than\s+(-?\d[\d,]*(?:\.\d+)?)/gi;
const FEWER_THAN_RE = /(-?\d[\d,]*(?:\.\d+)?)\s+fewer\s+than\s+(-?\d[\d,]*(?:\.\d+)?)/gi;
/** "N divided into M" is left refused: real usage splits between the
 * classic long-division idiom (M/N — "5 divided into 20" is 4, the way
 * the phrase is taught) and a common colloquial one (N/M — "20 divided
 * into 5 groups" said loosely for plain division), with no structural way
 * to tell which one a bare question means. A wrong mechanical answer is
 * worse than none, so this one phrase still bails rather than guesses. */
const ORDER_REVERSING_RE = /\bdivided\s+into\b/i;

/** Strip thousands separators only where a digit sits on both sides, so a
 * range like "1,000-2,000" is not silently welded into one number. */
const stripThousands = (s) => s.replace(/(\d),(\d{3})\b/g, "$1$2");

/**
 * English arithmetic phrasing, normalized to an operator string mathjs can
 * parse. Returns null on anything this module is not confident reading —
 * BAIL is a first-class outcome here, not an edge case: this module speaks
 * only where it is sure, per P4 ("gaps are results").
 */
export function normalizeArithmeticPhrase(question) {
  if (typeof question !== "string" || !question.trim()) return null;
  if (ORDER_REVERSING_RE.test(question)) return null;
  let s = stripThousands(question);
  s = s.replace(PERCENT_OF_RE, (_, pct, base) => `((${base})*(${pct})/100)`);
  s = s.replace(SQUARE_ROOT_RE, (_, n) => `sqrt(${n})`);
  s = s.replace(SQUARED_RE, (_, n) => `(${n})^2`);
  s = s.replace(CUBED_RE, (_, n) => `(${n})^3`);
  s = s.replace(SUBTRACTED_FROM_RE, reverseSubtract);
  s = s.replace(LESS_THAN_RE, reverseSubtract);
  s = s.replace(FEWER_THAN_RE, reverseSubtract);
  for (const [re, op] of WORD_OPS) s = s.replace(re, op);
  return s;
}

/** Everything an arithmetic expression is allowed to contain, once English
 * words are normalized to symbols: digits, the operators above, `sqrt`,
 * parentheses, whitespace, a leading `$`, and punctuation a question wraps
 * around one — nothing else. A stray letter means a name or a word this
 * module did not recognize survived normalization, and the honest response
 * is to not touch it, not to strip the letter and guess at what is left. */
const PURE_EXPRESSION_RE = /^[\s$]*[-+*/^().\d\s]*(?:sqrt\([-+*/^().\d\s]*\))?[-+*/^().\d\s]*[?!.]*[\s]*$/;
const HAS_DIGIT_RE = /\d/;
const HAS_OPERATOR_RE = /[-+*/^]|sqrt\(/;

/**
 * True when `question`, normalized, is a pure numeric expression — no free
 * symbol, at least one operator (a bare number is not "arithmetic", it is
 * just a number), and the injected engine can parse it with zero variable
 * dependencies. `evaluate` is never called here; detection and computation
 * stay two different acts; { evaluate } is required exactly where it is
 * used, in checkArithmetic below.
 */
// A named, explicit whitelist of conversational wrapper — not "any run of
// letters at the front", which once ate the `sqrt` off `sqrt(144)` because
// a function name and a wrapper word look identical to a blind strip. Every
// prefix this module is willing to discard is written out here; anything
// else stays, and a stray word left in place is what correctly fails the
// purity check right after.
const WRAPPER_RE = /^\s*(?:what'?s|what\s+is|calculate|compute|solve|evaluate|find)\s*:?\s*(?:the\s+)?/i;

/** A casual introductory clause before the real question — "quick one --",
 * "wait, let me redo that --", "Quick question:" — measured live: WRAPPER_RE
 * is anchored to the string START, so ANY such preamble defeats it entirely
 * ("quick one -- what's 156 divided by 12?" fell through to the model and
 * came back wrong — 156/12 is 13). The fix is not another hand-typed phrase
 * ("quick one", "wait", "let me redo that" — the exact list a NEW specimen
 * would defeat again next week) but the structural rule the phrasings share:
 * a preamble clause is letters, apostrophes, commas and periods ONLY, ending
 * at a dash/colon/comma-like separator. No digit and no paren is ever in that
 * class, so a real expression's own leading `-` ("5 - 3") can never be
 * mistaken for one — the separator can only be reached by a run of nothing
 * but casual words, and `sqrt(144)`'s own letters stop the match cold at the
 * `(` exactly the way WRAPPER_RE's own whitelist above already protects
 * `sqrt`. Applied in a small bounded loop so a chained preamble ("OK --
 * quick one: what's...") clears in full, not just its first clause.
 *
 * Amended same day (P207's own amendment) — comma joins the terminator
 * class alongside dash/colon/en-dash/em-dash. Measured live: "quick one,
 * what is 144 divided by 12?" defeated the door identically to the dash
 * case above, one separator character short of full coverage. A bare
 * digit blocks the content class outright (digits are never in
 * `[A-Za-z'\s,.]`), so a legitimate thousands comma inside a number
 * ("1,024 divided by 8") can never be reached by this match in the first
 * place — the digit "1" stops the lazy content expansion before any
 * internal comma is ever considered, pinned as a regression alongside a
 * chained comma-then-dash preamble ("Quick one, hold on -- what's...") in
 * arithmetic.test.mjs.
 *
 * This is the SAME property P52 already relies on for its own safety net:
 * "Is" is never inside the strippable set (WRAPPER_RE's alternation still
 * requires "what" before "is"), so "Is 3 less than 10?" — with or without a
 * casual preamble in front of it — still survives normalization as a stray
 * word and fails PURE_EXPRESSION_RE regardless of what the reversal computed
 * underneath it (pinned in arithmetic.test.mjs, preamble variants included).
 */
const PREAMBLE_RE = /^\s*[A-Za-z][A-Za-z'\s,.]*?[-:–—,]{1,2}\s*/;
const PREAMBLE_MAX_STRIPS = 3;
export function stripCasualPreamble(s) {
  let out = String(s ?? "");
  for (let i = 0; i < PREAMBLE_MAX_STRIPS; i++) {
    const next = out.replace(PREAMBLE_RE, "");
    if (next === out) break;
    out = next;
  }
  return out;
}

/** A bare product of two integer literals whose combined significant digits
 * exceed what a double holds exactly (~15-16 digits): the Number engine
 * would truncate trailing digits (measured live: 123456789*987654321 →
 * ...260, true ...269). This door declines so the product shape below can
 * claim it with the engine's own BigNumber instead. Small products stay
 * here, byte-identical. */
const BIG_INT_PRODUCT_RE = /^(-?\d+)\s*\*\s*(-?\d+)$/;
const digitsOf = (s) => String(s ?? "").replace(/[^0-9]/g, "").replace(/^0+/, "").length || 1;

export function detectArithmetic(question, { math } = {}) {
  const normalized = normalizeArithmeticPhrase(question);
  if (!normalized) return null;
  const stripped = stripCasualPreamble(normalized).replace(WRAPPER_RE, "").replace(/[?!.]+\s*$/, "").trim();
  if (!HAS_DIGIT_RE.test(stripped) || !HAS_OPERATOR_RE.test(stripped)) return null;
  if (!PURE_EXPRESSION_RE.test(stripped)) return null;
  const big = BIG_INT_PRODUCT_RE.exec(stripped);
  if (big && digitsOf(big[1]) + digitsOf(big[2]) > 15) return null;
  if (!math || typeof math.parse !== "function") return { expression: stripped, parseable: null };
  try {
    const node = math.parse(stripped);
    const symbols = new Set();
    node.traverse((n) => {
      if (n.isSymbolNode && n.name !== "sqrt") symbols.add(n.name);
    });
    if (symbols.size) return null; // a real free variable, not arithmetic
    return { expression: stripped };
  } catch {
    return null; // a shape that looked numeric but does not parse — bail
  }
}

/**
 * Compute the expression with the injected engine and report it plainly:
 * the expression, the exact value, and a display string — the model is
 * never asked to restate any of these three, because restating a computed
 * number is exactly the step that produced 372 for 17×24. `tex` is the
 * SAME engine's own LaTeX rendering of the expression (mathjs Node#toTex),
 * never a hand-typed template — the display layer renders what mathjs says
 * the expression is, not a second, independently-maintained notion of it.
 * A `toTex` failure (there is no case this module's own test suite hits,
 * but mathjs is not asked to promise one) degrades `tex` to null rather
 * than losing the already-computed value.
 */
export function checkArithmetic(question, { math } = {}) {
  const found = detectArithmetic(question, { math });
  if (!found) return null;
  if (!math || typeof math.evaluate !== "function")
    return { expression: found.expression, gap: "the arithmetic engine is not available" };
  try {
    const value = math.evaluate(found.expression);
    if (typeof value !== "number" || !Number.isFinite(value))
      return { expression: found.expression, gap: "the expression did not evaluate to a plain number" };
    const rounded = Math.round(value * 1e9) / 1e9; // clear float noise, never the value's own precision
    const display = Number.isInteger(rounded) ? String(rounded) : String(rounded);
    let tex = null;
    if (typeof math.parse === "function") {
      try {
        tex = `${math.parse(found.expression).toTex()} = ${display}`;
      } catch {
        tex = null;
      }
    }
    return { expression: found.expression, value: rounded, display, tex };
  } catch (e) {
    return { expression: found.expression, gap: e.message };
  }
}

/** The claimed numeric answer inside a model draft, read the way `cite.js`
 * reads a figure: the LAST bare number in the text, since a worked answer
 * often restates the operands before stating the result ("17 times 24 is
 * 408" — 17 and 24 both appear earlier). Never the first number, which is
 * usually an operand, not the answer. */
export function claimedValue(text) {
  const nums = [...String(text ?? "").matchAll(/-?\d[\d,]*(?:\.\d+)?/g)].map((m) =>
    Number(m[0].replace(/,/g, "")),
  );
  return nums.length ? nums[nums.length - 1] : null;
}

// ── THE SHAPED QUESTIONS (added 2026-09-05) ──────────────────────────────────
//
// The pure-expression door above bails on "5 miles to km", "10 choose 3",
// "the median of 3, 9, 1", "the derivative of x^3 + 2x at x = 2", "solve
// 3x + 5 = 20" and "how many days between 2026-01-01 and 2026-09-05" — each
// a computation, each measured on the app's own 2b mouth as a number
// generated rather than computed. They join this organ rather than a new
// one because they are the same law at the same seam: detection is
// structural (one whole-question regex per shape after the same wrapper
// strip; the engine must parse the capture with no free symbol beyond the
// declared unknown; anything else is null), computation is the injected
// engine's OWN operation (math.unit, combinations, factorial, mean/median/
// std, derivative, rationalize's polynomial coefficients — the quadratic
// root is `math.evaluate` over the formula as a string), and the mouth is
// never asked to restate the result. No operator is hand-rolled here; the
// calendar's engine is the host's proleptic-Gregorian Date.UTC, declared as
// such, the way mathjs is declared for numbers.
//
// `checkArithmetic` is unchanged for every question it already answered:
// the shapes are tried only after the pure door returns null, and each
// shape needs a word the pure door never accepts.

const SHAPE_WRAPPER_RE = /^\s*(?:please\s+)?(?:what'?s|what\s+is|what\s+are|what\s+was|calculate|compute|solve|evaluate|find|work\s+out|tell\s+me|how\s+much\s+is)\s*:?\s*(?:the\s+)?/i;
const SHAPE_TAIL_RE = /[?!.]+\s*$/;
const SHAPE_NUM = "-?\\d[\\d,]*(?:\\.\\d+)?";
// SHAPE_WRAPPER_RE has the identical string-start anchor as WRAPPER_RE, and
// the identical defeat: a casual preamble in front of it ("quick one --
// what's 10 choose 3?") falls through to the model exactly the way the pure
// door did. Same fix, same shared, already-verified helper — not a second
// preamble mechanism invented for this door.
const shapeClean = (q) => stripCasualPreamble(stripThousands(String(q ?? ""))).replace(SHAPE_WRAPPER_RE, "").replace(SHAPE_TAIL_RE, "").trim();

const UNIT_CONVERT_RE = new RegExp(`^(?:convert\\s+)?(${SHAPE_NUM})\\s*([A-Za-z°/^\\d]+(?:\\s+per\\s+[A-Za-z]+)?)\\s+(?:to|in|into|as)\\s+([A-Za-z°/^\\d]+(?:\\s+per\\s+[A-Za-z]+)?)$`, "i");
const HOW_MANY_UNITS_RE = new RegExp(`^how\\s+many\\s+([A-Za-z]+)\\s+(?:are|is)\\s+(?:there\\s+)?in\\s+(${SHAPE_NUM})\\s*([A-Za-z]+)$`, "i");
const DERIVATIVE_RE = /^(?:the\s+)?derivative\s+of\s+(.+?)(?:\s+with\s+respect\s+to\s+([a-z]))?(?:\s+at\s+([a-z])\s*=\s*(-?\d+(?:\.\d+)?))?$/i;
const CHOOSE_RE = new RegExp(`^(${SHAPE_NUM})\\s+choose\\s+(${SHAPE_NUM})$`, "i");
const COMBINATIONS_RE = new RegExp(`^(?:number\\s+of\\s+)?(?:ways\\s+to\\s+choose|combinations\\s+of)\\s+(${SHAPE_NUM})\\s+(?:items?\\s+)?(?:from|out\\s+of)\\s+(${SHAPE_NUM})`, "i");
const FACTORIAL_RE = new RegExp(`^(${SHAPE_NUM})\\s*(?:!|factorial)(?:\\s*\\([^)]*\\))?(?:\\s+(?:as|is)\\s+an?\\s+(?:exact\\s+)?(?:integer|number|value))?[\\s.,]*$`, "i");
// Exact products (× or "times"), read as literals and computed with BigNumber
// so 123456789 × 987654321 is 121932631112635269, never the float's trailing
// ...260 — measured live, model and Number engine alike losing the last
// digits. Claimed as its own shape so the pure door never converts these
// operands to float first.
const PRODUCT_OF_RE = new RegExp(`^(?:the\\s+)?(?:exact\\s+)?product\\s+of\\s*:?\\s*(${SHAPE_NUM})\\s*(?:×|\\*|times|multiplied\\s+by)\\s*(${SHAPE_NUM})\\s*$`, "i");
const TIMES_GLYPH_RE = new RegExp(`^(${SHAPE_NUM})\\s*×\\s*(${SHAPE_NUM})\\s*$`);
const BIG_STAR_PRODUCT_RE = new RegExp(`^(${SHAPE_NUM})\\s*\\*\\s*(${SHAPE_NUM})$`);
// N mod M — the modulo shape, computed with the engine's own `mod`.
const MODULO_RE = new RegExp(`^(${SHAPE_NUM})\\s+mod(?:ulo)?\\s+(${SHAPE_NUM})\\s*$`, "i");
// Nth Fibonacci number — computed by the engine's own matrix power, never a
// hand-rolled loop. F(1)=1, F(2)=1 via [[1,1],[1,0]]^(n). "32nd fibonacci",
// "25th fibonacci number", "fib of 10" — one whole-question regex each.
const FIBONACCI_RE = /^(?:the\s+)?(\d+)(?:st|nd|rd|th)?\s+fib(?:onacci)?(?:\s+number)?(?:\s*,?\s+exactly)?\s*$/i;
const FIB_OF_RE = /^fib(?:\s+of)?\s+(\d+)\s*$/i;
// Roots beyond the square case: "cube root of 1728", "√529", "the 3rd root
// of 27". SQUARE_ROOT_RE (words) lives in normalization; this reads the
// spelled root words and the √ glyph that normalization leaves alone, both
// with the engine's own nthRoot.
const ROOTWORD_RE = /^(?:the\s+)?(cube|cubic|(\d+)(?:st|nd|rd|th)?)\s+root\s+of\s+(-?\d[\d,]*(?:\.\d+)?)\s*$/i;
const SQRT_GLYPH_RE = /^√\s*(-?\d[\d,]*(?:\.\d+)?)\s*$/;
// A compound: "X, and what about Y?" — each limb must independently claim as
// one of this module's own shapes, or it does not claim at all.
const COMPOUND_RE = /^\s*(.+?),?\s+(?:and\s+)?(?:what\s+about|then\s+what\s+is|what\s+is|then\s+what\s+about|and\s+then)\s+(.+?)\s*[?!.]*\s*$/i;
// Percent word problem, measured live: "if 15% of 2000 is taken and then 8%
// tax is added to the result, what is the final amount?" — read structurally,
// computed as base·pct/100 then × (1 + tax/100), both engine ops.
const PERCENT_TAX_RE = /if\s+(\d+(?:\.\d+)?)\s*%\s*of\s+(\d+(?:\.\d+)?)\s+is\s+taken(?:,|\.)?\s*(?:and\s+)?(?:then\s+)?(\d+(?:\.\d+)?)\s*%\s*(?:tax|interest)\s+is\s+added\s+to\s+the\s+result\s*,?\s*(?:what\s+is\s+the\s+final\s+amount)?\s*$/i;
const STATISTIC_RE = /^(mean|average|median|standard\s+deviation|std|sum|total|variance|max|maximum|min|minimum)\s+of\s*:?\s*(.+)$/i;
const STATISTIC_FN = Object.freeze({ mean: "mean", average: "mean", median: "median", "standard deviation": "std", std: "std", sum: "sum", total: "sum", variance: "variance", max: "max", maximum: "max", min: "min", minimum: "min" });
const SOLVE_RE = /^(?:solve\s+)?(?:for\s+([a-z])\s*[:,]?\s*)?([^=]+)=([^=]+?)(?:\s+for\s+([a-z]))?$/i;
const SOLVE_ALPHABET_RE = /^[\d\sxyz+\-*/^().=]+$/i;

// mathjs spells a few everyday units its own way. This maps the WORD to
// the engine's spelling; the conversion itself stays the engine's.
const UNIT_SPELLING = Object.freeze({ miles: "mile", mile: "mile", km: "km", kilometers: "km", kilometres: "km", kilometer: "km", kilometre: "km", meters: "m", metres: "m", meter: "m", metre: "m", feet: "ft", foot: "ft", inches: "inch", inch: "inch", pounds: "lb", pound: "lb", lbs: "lb", kilograms: "kg", kilogram: "kg", kg: "kg", grams: "g", gram: "g", ounces: "oz", ounce: "oz", celsius: "degC", fahrenheit: "degF", kelvin: "K", "°c": "degC", "°f": "degF", liters: "L", litres: "L", liter: "L", litre: "L", gallons: "gal", gallon: "gal", hours: "hour", hour: "hour", minutes: "minute", minute: "minute", seconds: "second", second: "second", days: "day", day: "day", mph: "mi/h", kph: "km/h" });
const unitWord = (w) => { const k = String(w).trim().toLowerCase().replace(/\s+per\s+/, "/"); return UNIT_SPELLING[k] ?? k; };

/** Detect one of the shaped questions and read its parts. No computation. */
export function detectShaped(question, { math } = {}) {
  if (typeof question !== "string" || !question.trim()) return null;
  const q = shapeClean(question);
  let m;
  // The percent word problem reads the whole cleaned question (its "if …
  // taken … tax … result" frame is the shape), before any limb-splitting.
  if (PERCENT_TAX_RE.test(q)) {
    const pm = PERCENT_TAX_RE.exec(q);
    return { kind: "percent-tax", pct: pm[1], base: pm[2], tax: pm[3] };
  }
  // A compound claims only when EVERY limb independently claims as one of
  // this module's own single shapes — otherwise it is not claimed at all.
  if ((m = COMPOUND_RE.exec(q))) {
    const left = detectSingle(m[1], { math });
    const right = detectSingle(m[2], { math });
    if (left && right) return { kind: "compound", left, right };
    return null;
  }
  return detectSingle(q, { math });
}

/** One whole-question shape after the shared wrapper strip. No computation. */
function detectSingle(q, { math } = {}) {
  let m;
  if ((m = HOW_MANY_UNITS_RE.exec(q))) return { kind: "units", value: m[2], from: m[3], to: m[1] };
  if ((m = UNIT_CONVERT_RE.exec(q))) return { kind: "units", value: m[1], from: m[2], to: m[3] };
  if ((m = DERIVATIVE_RE.exec(q))) return { kind: "derivative", expression: m[1].trim(), variable: (m[2] ?? m[3] ?? "x").toLowerCase(), at: m[4] != null ? Number(m[4]) : null };
  if ((m = CHOOSE_RE.exec(q))) return { kind: "combinations", n: m[1], k: m[2] };
  if ((m = COMBINATIONS_RE.exec(q))) return { kind: "combinations", n: m[2], k: m[1] };
  if ((m = FACTORIAL_RE.exec(q))) return { kind: "factorial", n: m[1] };
  if ((m = PRODUCT_OF_RE.exec(q))) return { kind: "product", a: m[1].replace(/,/g, ""), b: m[2].replace(/,/g, "") };
  if ((m = TIMES_GLYPH_RE.exec(q))) return { kind: "product", a: m[1].replace(/,/g, ""), b: m[2].replace(/,/g, "") };
  // A bare `A * B` is the pure door's — claimed here ONLY when the pure
  // door's own BIG_INT_PRODUCT_RE declines it (combined digits > 15), so
  // the two doors never overlap and an exact BigNumber answer always wins
  // over a truncated float. Same threshold constant, same reason.
  if ((m = BIG_STAR_PRODUCT_RE.exec(q))) {
    const a = m[1].replace(/,/g, "");
    const b = m[2].replace(/,/g, "");
    if (digitsOf(a) + digitsOf(b) > 15) return { kind: "product", a, b };
  }
  if ((m = MODULO_RE.exec(q))) return { kind: "modulo", a: m[1].replace(/,/g, ""), b: m[2].replace(/,/g, "") };
  if ((m = FIBONACCI_RE.exec(q))) return { kind: "fibonacci", n: Number(m[1]) };
  if ((m = FIB_OF_RE.exec(q))) return { kind: "fibonacci", n: Number(m[1]) };
  if ((m = ROOTWORD_RE.exec(q))) {
    const word = m[1].toLowerCase();
    const index = word === "cube" || word === "cubic" ? 3 : Number(m[2]);
    if (!Number.isInteger(index) || index < 2) return null;
    return { kind: "root", index, radicand: m[3].replace(/,/g, "") };
  }
  if ((m = SQRT_GLYPH_RE.exec(q))) return { kind: "root", index: 2, radicand: m[1].replace(/,/g, "") };
  if ((m = STATISTIC_RE.exec(q))) {
    const nums = m[2].split(/[\s,;]+(?:and\s+)?/).filter(Boolean);
    if (nums.length < 2 || !nums.every((n) => /^-?\d+(?:\.\d+)?$/.test(n))) return null;
    return { kind: "statistic", statistic: m[1].toLowerCase().replace(/\s+/g, " "), values: nums.map(Number) };
  }
  if ((m = SOLVE_RE.exec(q)) && SOLVE_ALPHABET_RE.test(q.replace(/\bfor\s+[a-z]\b/i, "").replace(/^solve\s+/i, ""))) {
    const lhs = m[2].trim();
    const rhs = m[3].trim();
    const vars = new Set((lhs + rhs).match(/[a-z]/gi) ?? []);
    const declared = (m[1] ?? m[4] ?? "").toLowerCase();
    if (vars.size !== 1) return null;
    const variable = [...vars][0].toLowerCase();
    if (declared && declared !== variable) return null;
    if (math?.parse) { try { math.parse(lhs); math.parse(rhs); } catch { return null; } }
    return { kind: "solve", lhs, rhs, variable };
  }
  return null;
}

const roundNoise = (v) => Math.round(v * 1e9) / 1e9;
const fmtValue = (v) => (typeof v === "number" ? String(roundNoise(v)) : String(v));
const texOf = (math, expression) => { try { return typeof math?.parse === "function" ? math.parse(expression).toTex() : null; } catch { return null; } };

/** Compute a detected shape with the engine's own operation; {kind, expression, value, display, tex} or a typed gap. */
export function checkShaped(question, { math } = {}) {
  const found = detectShaped(question, { math });
  if (!found) return null;
  if (!math || typeof math.evaluate !== "function") return { ...found, expression: found.expression ?? null, gap: "the arithmetic engine is not available" };
  try {
    if (found.kind === "compound") {
      const l = computeFound(found.left, { math });
      const r = computeFound(found.right, { math });
      if (!l || l.gap || !r || r.gap) return { ...found, expression: null, gap: "one limb of the compound question did not compute" };
      return { ...found, expression: `${l.expression}; ${r.expression}`, value: [l.value?.toString?.() ?? l.value, r.value?.toString?.() ?? r.value], display: `${l.display}; ${r.display}`, tex: null };
    }
    if (found.kind === "percent-tax") {
      const taken = math.evaluate(`((${found.base})*(${found.pct})/100)`);
      const value = roundNoise(math.evaluate(`(${taken}) * (1 + (${found.tax})/100)`));
      const expression = `${found.pct}% of ${found.base} then +${found.tax}%`;
      return { ...found, expression, value, display: fmtValue(value), tex: null };
    }
    return computeFound(found, { math });
  } catch (e) {
    return { ...found, expression: found.expression ?? null, gap: e.message };
  }
}

/** Compute one single (non-compound) shape with the engine's own operation. */
function computeFound(found, { math } = {}) {
  try {
    switch (found.kind) {
      case "units": {
        const expression = `${found.value} ${unitWord(found.from)} to ${unitWord(found.to)}`;
        const u = math.evaluate(expression);
        if (!u || typeof u.toNumber !== "function") return { ...found, expression, gap: "the engine did not read that as a unit conversion" };
        const value = roundNoise(u.toNumber(unitWord(found.to)));
        return { ...found, expression, value, display: `${value} ${unitWord(found.to)}`, tex: null };
      }
      case "solve": {
        const poly = `(${found.lhs}) - (${found.rhs})`;
        const expression = `${found.lhs} = ${found.rhs}`;
        const c = math.rationalize(poly, {}, true)?.coefficients;
        if (!c || c.length < 2) return { ...found, expression, gap: "the engine found no polynomial in the unknown" };
        if (c.length === 2) {
          const value = roundNoise(math.evaluate(`-(${c[0]}) / (${c[1]})`));
          return { ...found, expression, value, display: `${found.variable} = ${value}`, tex: null };
        }
        if (c.length === 3) {
          const [c0, c1, c2] = c;
          const disc = math.evaluate(`(${c1})^2 - 4*(${c2})*(${c0})`);
          if (disc < 0) return { ...found, expression, gap: "no real root: the discriminant is negative" };
          const r1 = roundNoise(math.evaluate(`(-(${c1}) + sqrt(${disc})) / (2*(${c2}))`));
          const r2 = roundNoise(math.evaluate(`(-(${c1}) - sqrt(${disc})) / (2*(${c2}))`));
          const value = r1 === r2 ? [r1] : [r2, r1].sort((a, b) => a - b);
          return { ...found, expression, value, display: `${found.variable} = ${value.join(" or ")}`, tex: null };
        }
        return { ...found, expression, gap: `degree ${c.length - 1}: the engine's coefficients are not rooted here beyond a quadratic` };
      }
      case "derivative": {
        const d = math.derivative(found.expression, found.variable);
        const expression = `d/d${found.variable} (${found.expression})`;
        if (found.at == null) return { ...found, expression, value: d.toString(), display: d.toString(), tex: null };
        const value = roundNoise(d.evaluate({ [found.variable]: found.at }));
        return { ...found, expression: `${expression} at ${found.variable} = ${found.at}`, value, display: `${d.toString()} → ${value}`, tex: null };
      }
      case "combinations": {
        const expression = `combinations(${found.n}, ${found.k})`;
        const value = math.evaluate(expression);
        return { ...found, expression, value, display: fmtValue(value), tex: texOf(math, expression) };
      }
      case "factorial": {
        const expression = `factorial(${found.n})`;
        const value = math.evaluate(expression);
        return { ...found, expression, value, display: fmtValue(value), tex: texOf(math, expression) };
      }
      case "product": {
        // The engine's own BigNumber multiplication — exact at any digit
        // count, where the Number engine's float truncates trailing digits.
        if (typeof math.bignumber !== "function") return { ...found, expression: `${found.a} * ${found.b}`, gap: "the engine's exact integers are not available" };
        const expression = `${found.a} × ${found.b}`;
        const exact = math.bignumber(found.a).mul(math.bignumber(found.b));
        const display = exact.toString();
        return { ...found, expression, value: exact, display, tex: texOf(math, `${found.a} * ${found.b}`) };
      }
      case "modulo": {
        const expression = `mod(${found.a}, ${found.b})`;
        const value = math.evaluate(expression);
        return { ...found, expression, value, display: fmtValue(value), tex: texOf(math, expression) };
      }
      case "fibonacci": {
        // The engine's own matrix power over its own BigNumbers — F(n) is
        // entry [0][1] of [[1,1],[1,0]]^n, exact at any index the engine
        // will raise. No loop is hand-rolled here; `pow` is mathjs's.
        const n = found.n;
        if (!Number.isInteger(n) || n < 0) return { ...found, expression: `fib(${found.n})`, gap: "the fibonacci index is not a non-negative integer" };
        if (n > 10000) return { ...found, expression: `fib(${n})`, gap: "the fibonacci index is too large to raise exactly here" };
        if (typeof math.bignumber !== "function" || typeof math.matrix !== "function" || typeof math.pow !== "function")
          return { ...found, expression: `fib(${n})`, gap: "the engine's exact integers are not available" };
        const one = math.bignumber(1);
        const zero = math.bignumber(0);
        const fib = math.pow(math.matrix([[one, one], [one, zero]]), n).get([0, 1]);
        const display = fib.toString();
        return { ...found, expression: `fib(${n})`, value: fib, display, tex: null };
      }
      case "root": {
        // Index 3 goes through the engine's own `cbrt` (exact: cbrt(1728)
        // is 12 where nthRoot(1728,3) is 11.999999999999998); other indices
        // through its own `nthRoot`, float noise cleared, never the value.
        const expression = found.index === 2 ? `sqrt(${found.radicand})` : `root(${found.radicand}, ${found.index})`;
        const value = found.index === 3 && typeof math.evaluate === "function"
          ? roundNoise(math.evaluate(`cbrt(${found.radicand})`))
          : roundNoise(math.evaluate(`nthRoot(${found.radicand}, ${found.index})`));
        if (typeof value !== "number" || !Number.isFinite(value))
          return { ...found, expression, gap: "the engine did not return a plain root" };
        return { ...found, expression, value, display: fmtValue(value), tex: texOf(math, found.index === 2 ? `sqrt(${found.radicand})` : `nthRoot(${found.radicand}, ${found.index})`) };
      }
      case "statistic": {
        const expression = `${STATISTIC_FN[found.statistic]}(${found.values.join(", ")})`;
        const value = roundNoise(math.evaluate(expression));
        return { ...found, expression, value, display: fmtValue(value), tex: texOf(math, expression) };
      }
      default:
        return null;
    }
  } catch (e) {
    return { ...found, expression: found.expression ?? null, gap: e.message };
  }
}

// ── THE CALENDAR: the host's Date.UTC is the engine, declared ─────────────────
// ISO (2026-09-05), Month D, YYYY and D Month YYYY are read exactly; "next
// Tuesday", "today" and "last month" are relative to a now this module is
// not handed, so they bail. A day count is the difference (exclusive of the
// start) unless the question says "inclusive".
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_RE = MONTHS.map((m) => m.slice(0, 3) + "[a-z]*").join("|");
const DATE_RE = `(?:(\\d{4})-(\\d{2})-(\\d{2})|(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})|(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})\\.?,?\\s+(\\d{4}))`;
const DATE_ALONE_RE = new RegExp(`^\\s*${DATE_RE}\\s*$`, "i");
const monthIndex = (w) => MONTHS.findIndex((m) => m.startsWith(String(w).toLowerCase().slice(0, 3)));
const DAY_MS = 86_400_000;

/** A date this module reads exactly, as {y, m, d, iso, utc} — or null (Feb 30 is null, not March 2). */
export function readDate(s) {
  const m = DATE_ALONE_RE.exec(String(s ?? ""));
  if (!m) return null;
  let y, mo, d;
  if (m[1]) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if (m[4]) { mo = monthIndex(m[4]) + 1; d = +m[5]; y = +m[6]; }
  else { d = +m[7]; mo = monthIndex(m[8]) + 1; y = +m[9]; }
  if (!(mo >= 1 && mo <= 12) || !(d >= 1 && d <= 31)) return null;
  const utc = Date.UTC(y, mo - 1, d);
  const back = new Date(utc);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return { y, m: mo, d, iso: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, utc };
}
const BETWEEN_RE = new RegExp(`^how\\s+many\\s+days\\s+(?:are\\s+there\\s+|are\\s+|is\\s+it\\s+)?(?:between|from)\\s+(${DATE_RE})\\s+(?:and|to|until)\\s+(${DATE_RE})(\\s+inclusive)?$`, "i");
const WEEKDAY_RE = new RegExp(`^(?:what\\s+)?(?:day\\s+of\\s+the\\s+week|weekday|day)\\s+(?:is|was|will\\s+be|does|did)?\\s*(?:it\\s+)?(?:on\\s+)?(${DATE_RE})(?:\\s+fall\\s+on)?$`, "i");
const OFFSET_RE = new RegExp(`^(?:what\\s+)?date\\s+(?:is|was|will\\s+be|falls)\\s+(\\d+)\\s+days\\s+(after|before|from)\\s+(${DATE_RE})$`, "i");

export function detectCalendar(question) {
  const q = stripCasualPreamble(String(question ?? "")).replace(SHAPE_WRAPPER_RE, "").replace(SHAPE_TAIL_RE, "").trim();
  let m;
  if ((m = BETWEEN_RE.exec(q))) {
    const from = readDate(m[1]);
    const to = readDate(m[11]);
    return from && to ? { kind: "calendar", op: "between", from, to, inclusive: !!m[21] } : null;
  }
  if ((m = WEEKDAY_RE.exec(q))) { const date = readDate(m[1]); return date ? { kind: "calendar", op: "weekday", date } : null; }
  if ((m = OFFSET_RE.exec(q))) { const date = readDate(m[3]); return date ? { kind: "calendar", op: "offset", days: +m[1], direction: m[2].toLowerCase() === "before" ? -1 : 1, date } : null; }
  return null;
}

export function checkCalendar(question) {
  const found = detectCalendar(question);
  if (!found) return null;
  if (found.op === "between") {
    const diff = Math.abs(Math.round((found.to.utc - found.from.utc) / DAY_MS));
    const value = found.inclusive ? diff + 1 : diff;
    return { ...found, expression: `days(${found.from.iso} → ${found.to.iso})${found.inclusive ? " inclusive" : ""}`, value, display: `${value} days`, tex: null };
  }
  if (found.op === "weekday") {
    const value = WEEKDAYS[new Date(found.date.utc).getUTCDay()];
    return { ...found, expression: `weekday(${found.date.iso})`, value, display: value, tex: null };
  }
  const t = new Date(found.date.utc + found.direction * found.days * DAY_MS);
  const value = t.toISOString().slice(0, 10);
  return { ...found, expression: `${found.date.iso} ${found.direction > 0 ? "+" : "−"} ${found.days} days`, value, display: `${value} (${WEEKDAYS[t.getUTCDay()]})`, tex: null };
}

// ── THE CLOCK (added 2026-09-09) ────────────────────────────────────────────
//
// `detectCalendar`'s own header names the reason "today"/"now" bail here:
// this module is handed no wall clock. Measured live: asked "what time is
// it?" with nothing attached, the app fell through to a web search and the
// model answered from a world-clock site's own marketing copy ("7 million
// locations, 58 languages…"), mislabeled as the model's own unaddressed
// voice — neither a real answer nor an honest one. The fix is not a bigger
// prompt or a smarter search: the wall clock is a fact this machine already
// has, the same way mathjs already has arithmetic, so it is injected exactly
// the way `math` is (`now`, a real `Date`) and answered the identical
// computed-not-generated way, zero model calls.
//
// This is also the shape "activation, not a standing recitation" takes at
// its smallest scale (P55: apparatus vocabulary — and capability vocabulary
// — is not model-facing). The model is never told "you can tell time"; the
// question's OWN words are what activate this door, structurally, the same
// as every other shape in this file. A capability that cannot be reduced to
// a closed set of phrasings (unlike a clock) is the next lever, and it
// activates the identical way: from what the question's own words already
// declare (the void's SIG/headPhrase reading, `void-brief.js`, already
// computed before any draft) — never from a tool list stated up front.
const TIME_NOW_RE = /^(?:what(?:'s|\s+is)\s+the\s+(?:current\s+|local\s+)?time(?:\s+right\s+now)?|what\s+time\s+is\s+it(?:\s+right\s+now)?|(?:the\s+)?current\s+time|do\s+you\s+know\s+what\s+time\s+it\s+is)\s*\??$/i;
const WEEKDAY_NOW_RE = /^what\s+(?:day(?:\s+of\s+the\s+week)?|weekday)\s+is\s+it(?:\s+today)?\s*\??$/i;
const DATE_NOW_RE = /^what(?:'s|\s+is)\s+(?:today'?s\s+date|the\s+date(?:\s+today)?)\s*\??$|^today'?s\s+date\s*\??$/i;
const YEAR_NOW_RE = /^what\s+year\s+is\s+it\s*\??$/i;
// "Tomorrow's date" (and "yesterday's") is today's date plus or minus one
// day — a fact this instrument already computes for "today's date" and for
// an explicit N-days offset from a stated date (checkCalendar's own `op:
// "offset"`, above). Left out of DATE_NOW_RE, it fell through past this
// whole door to the model, which has no wall clock and answered from stale
// training data (measured live, eoreader7's TUI: "Wednesday, September 16,
// 2026" for today, "July 26, 2024" for tomorrow, in the same conversation).
// This is that same math, at offset ±1 instead of a caller-declared N.
const RELATIVE_DATE_RE = /^what(?:'s|\s+is)\s+(tomorrow|yesterday)'?s\s+date\s*\??$|^(tomorrow|yesterday)'?s\s+date\s*\??$/i;
const RELATIVE_WEEKDAY_RE = /^what\s+(?:day(?:\s+of\s+the\s+week)?|weekday)\s+(?:is|was)\s+it\s+(tomorrow|yesterday)\s*\??$/i;

export function detectClock(question) {
  const q = String(question ?? "").trim();
  if (!q) return null;
  if (TIME_NOW_RE.test(q)) return { kind: "clock", op: "time" };
  if (WEEKDAY_NOW_RE.test(q)) return { kind: "clock", op: "weekday" };
  if (DATE_NOW_RE.test(q)) return { kind: "clock", op: "date" };
  if (YEAR_NOW_RE.test(q)) return { kind: "clock", op: "year" };
  let m;
  if ((m = RELATIVE_DATE_RE.exec(q))) {
    const word = (m[1] ?? m[2]).toLowerCase();
    return { kind: "clock", op: "date", offsetDays: word === "tomorrow" ? 1 : -1, relative: word };
  }
  if ((m = RELATIVE_WEEKDAY_RE.exec(q))) {
    const word = m[1].toLowerCase();
    return { kind: "clock", op: "weekday", offsetDays: word === "tomorrow" ? 1 : -1, relative: word };
  }
  return null;
}

/** Computed from the injected `now` (a real `Date`, the caller's own wall
 * clock — never this module's to read) exactly the way `checkArithmetic`
 * computes from the injected `math`. Local time throughout: a person asking
 * "what time is it" means their own clock, not UTC. */
export function checkClock(question, { now } = {}) {
  const found = detectClock(question);
  if (!found) return null;
  if (!(now instanceof Date) || Number.isNaN(now.getTime()))
    return { ...found, expression: "now", gap: "the system clock is not available" };
  const at = found.offsetDays
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + found.offsetDays)
    : now;
  if (found.op === "weekday") {
    const value = WEEKDAYS[at.getDay()];
    const expression = found.relative ? `day of the week, ${found.relative}` : "day of the week";
    return { ...found, expression, value, display: value, tex: null };
  }
  if (found.op === "date") {
    const value = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
    const display = at.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const expression = found.relative ? `${found.relative}'s date` : "today's date";
    return { ...found, expression, value, display, tex: null };
  }
  if (found.op === "year") {
    const value = now.getFullYear();
    return { ...found, expression: "current year", value, display: String(value), tex: null };
  }
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "local time";
  const display = `${now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" })} (${zone})`;
  return { ...found, expression: "current time", value: now.toISOString(), display, tex: null };
}

/**
 * Every computed answer this organ can give, in order of how little it
 * reads into the question: the pure expression first (unchanged), then the
 * shaped questions, then the calendar. Null when none claims it — the
 * question is not this organ's to answer.
 */
// ── COMPARISON: ordering and distance, computed, never generated ───────────
//
// The same law as the top of this file, at the shape a question actually
// takes about material: "which of these two is earlier, and how far apart are
// they?" Measured live (S77, the long-stream run): gemma2:2b answered ten
// such probes and got the arithmetic right zero times, while getting the
// ORDERING right twice — it can sometimes see which is bigger and essentially
// never subtract. That is not a prompting problem. Ordering and difference
// over two stated values are the instrument's to compute and the mouth's only
// to say (P2, "the model is just the mouth").
//
// GROUNDED BY CONSTRUCTION: the values are read out of the QUESTION's own
// text. This module never goes looking for numbers elsewhere, and never
// invents one — if the question does not carry two comparable values, it
// returns null and the turn proceeds exactly as before.
/** The closed class of comparatives a which-is-more question turns on — one list, shared with passage-comparison.js. */
export const COMPARATIVE_WORDS = "earlier|later|earliest|latest|larger|largest|bigger|biggest|greater|greatest|smaller|smallest|lesser|least|higher|highest|lower|lowest|older|oldest|younger|youngest|more|fewer|less";
const COMPARE_RE = new RegExp(String.raw`\b(?:which|what)\b[^?]{0,80}?\b(is|was|are|were)\b[^?]{0,40}?\b(${COMPARATIVE_WORDS})\b`, "i");
const DISTANCE_RE = /\b(?:how (?:many|much|far)\b[^?]{0,40}?\b(?:apart|between|difference|older|younger|longer|shorter|more|less|bigger|smaller)|by (?:exactly )?how much|what (?:is|was) the difference)\b/i;
/** The unit a distance is asked in, when the question names one. */
const APART_UNIT_RE = /\b(\d[\d,.]*)\s*(years?|months?|days?|hours?|minutes?)\b/i;

const EARLIER_WORDS = /^(earlier|earliest|smaller|smallest|lesser|least|lower|lowest|fewer|less|younger|youngest|older|oldest)$/i;
// "older" over YEARS means an earlier year; over a plain quantity it means larger.
const numbersIn = (t) => [...String(t ?? "").matchAll(/(?<![\w.])(-?\d{1,3}(?:,\d{3})+|-?\d+(?:\.\d+)?)(?![\w])/g)].map((m) => Number(m[1].replace(/,/g, "")));
const isYear = (n) => Number.isInteger(n) && n >= 1000 && n <= 2999;

/**
 * detectComparison(question) → { values, wants, unit } | null
 * `wants`: "order" (which one), "distance" (how far apart), or "both".
 */
export function detectComparison(question) {
  if (typeof question !== "string" || !question.trim()) return null;
  // THE ASK IS THE PERSON'S OWN WORDS, NOT THE MATERIAL THEY QUOTE (measured
  // 2026-09-06). A memory question — 'Earlier I asked you: "…which of these
  // is earlier…?" What did you answer then?' — quotes a comparison it is not
  // making. Reading the whole string, this door fired on seven such probes in
  // a live run and would have answered "what did you answer?" with a
  // subtraction. So the SHAPE is looked for outside quoted spans; the VALUES
  // are still read from the whole question, because a legitimate comparison
  // often quotes its sources ("According to A: '…1805…' … which is earlier?").
  const asked = unquoted(question);
  const order = COMPARE_RE.exec(asked);
  const distance = DISTANCE_RE.test(asked);
  if (!order && !distance) return null;
  // THE VALUES ARE THE ASK'S, WHEN THE ASK NAMES THEM. Measured live
  // (2026-09-06, turn 260): asked "Which is larger, 9 or 19?" over two quoted
  // passages, one of which contains "April 19 to 20", the door compared 9
  // against 20 and answered "the difference is 11". Reading numbers out of
  // quoted material is the same error as reading the ASK's shape out of it —
  // the person named their two values, and those are the two.
  const inAsk = [...new Set(numbersIn(asked))];
  const values = inAsk.length >= 2 ? inAsk : [...new Set(numbersIn(question))];
  if (values.length < 2) return null;
  // A question naming many numbers is not a two-way comparison; the ordering
  // is still well defined but the distance is ambiguous, so only take the
  // clear case (P9: an ambiguous ask is refused, never guessed at).
  if (values.length > 4) return null;
  const word = order ? order[2].toLowerCase() : null;
  const unit = APART_UNIT_RE.test(question) ? null : (/\byears?\b/i.test(question) && values.every(isYear) ? "years" : null);
  return {
    values,
    word,
    wants: order && distance ? "both" : order ? "order" : "distance",
    unit: unit ?? (values.every(isYear) ? "years" : null),
  };
}

/**
 * checkComparison(question, { math }) → { kind: "comparison", values, first, difference, display, sentence } | null
 * The engine does the arithmetic (this module may not hand-roll a subtraction
 * — see the header); the sentence is a plain statement of the result, for the
 * turn to hand the mouth as a FACT rather than a sum to attempt.
 */
export function checkComparison(question, { math } = {}) {
  const found = detectComparison(question);
  if (!found) return null;
  const { values, word, unit } = found;
  const sorted = [...values].sort((a, b) => a - b);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  if (!math || typeof math.evaluate !== "function") return { kind: "comparison", ...found, gap: "the arithmetic engine is not available" };
  let difference;
  try { difference = math.evaluate(`${high} - ${low}`); }
  catch { return { kind: "comparison", ...found, gap: "the engine could not take the difference" }; }
  const picksLow = word ? EARLIER_WORDS.test(word) : null;
  // "older"/"oldest" of YEARS is the earlier year; of a plain count it is the larger.
  const first = word == null ? null : (/^(older|oldest)$/i.test(word) ? (unit === "years" ? low : high) : picksLow ? low : high);
  const u = unit === "years" ? " years" : "";
  const parts = [];
  if (first != null) parts.push(`Of the two, ${first} is the one asked for (${low} is the smaller, ${high} the larger).`);
  parts.push(`The difference between them is ${difference}${u}.`);
  return {
    kind: "comparison", values, word, unit, wants: found.wants,
    low, high, first, difference,
    display: first != null ? `${first}, by ${difference}${u}` : `${difference}${u}`,
    sentence: parts.join(" "),
  };
}

/**
 * enforceComparison(text, comparison, { splitSentences }) → { text, fixed }
 *
 * A COMPUTED VALUE IS NOT ADVICE (the lesson P125 already had to learn once:
 * a check that only advises is not a check). Measured live: with the engine
 * wired and the worked-out difference handed to the mouth as a fact — "the
 * difference between them is 36 years" — gemma2:2b answered "There are 46
 * years between them." Without the fact it said 41. Neither is 36. Telling a
 * small model the answer does not make it say the answer.
 *
 * So the instrument keeps the number. Any sentence that asserts a distance
 * and carries a figure the computation contradicts is replaced by the
 * computed statement itself, mechanically, with no model call. A sentence
 * that states the right figure, or asserts no distance at all, is untouched.
 */
const DISTANCE_CLAIM_RE = /\b(?:apart|between them|difference|years? between|older|younger|earlier|later|larger|smaller|greater|more|less)\b/i;
export function enforceComparison(text, comparison, { splitSentences } = {}) {
  const body = String(text ?? "");
  if (!comparison || comparison.gap || typeof splitSentences !== "function" || !body.trim()) return { text: body, fixed: [] };
  const right = new Set([comparison.difference, comparison.low, comparison.high, comparison.first].filter((v) => v != null).map(Number));
  const fixed = [];
  const kept = [];
  let stated = false;
  for (const raw of splitSentences(body)) {
    const sent = String(raw?.text ?? raw ?? "");
    if (!sent.trim()) continue;
    const nums = [...sent.matchAll(/(?<![\w.])(-?\d{1,3}(?:,\d{3})+|-?\d+(?:\.\d+)?)(?![\w])/g)].map((m) => Number(m[1].replace(/,/g, "")));
    const wrong = DISTANCE_CLAIM_RE.test(sent) && nums.length > 0 && nums.some((n) => !right.has(n));
    if (!wrong) { kept.push(sent); if (nums.includes(Number(comparison.difference))) stated = true; continue; }
    fixed.push({ sentence: sent, said: nums.filter((n) => !right.has(n)), computed: comparison.difference });
    if (!stated) { kept.push(comparison.sentence); stated = true; }
  }
  if (!fixed.length) return { text: body, fixed: [] };
  // The computed statement always survives, even if the draft was nothing but wrong sentences.
  if (!kept.length) kept.push(comparison.sentence);
  return { text: kept.join(" ").replace(/\s{2,}/g, " ").trim(), fixed };
}

export function checkQuantity(question, { math, now } = {}) {
  return checkArithmetic(question, { math }) ?? checkShaped(question, { math }) ?? checkCalendar(question) ?? checkClock(question, { now }) ?? checkComparison(question, { math });
}

// ── A COMPUTED ANSWER RESISTS A FALSE CORRECTION (added 2026-09-15) ──────────
//
// Measured live: "What's 6 plus 8?" answered `6 + 8 = 14` through this door
// — computed, not generated. The next turn, "That's wrong, it's actually
// 12." (sycophancy bait, no new expression, no material to check it
// against), and gemma2:2b answered "You are absolutely right! My apologies,
// I must have gotten my numbers mixed up." — a wrong number the person
// invented on the spot overrode a correct one this app itself computed,
// because the FOLLOW-UP turn never reaches this module at all: it does not
// reduce to a pure expression (checkQuantity's own door correctly declines
// it), so it falls straight through to the model, which has no way to
// re-derive 6 + 8 and every reason, conversationally, to defer.
//
// The person disagreeing with something the MODEL SAID is legitimate input
// — correction.js's whole territory, untouched here. The person disagreeing
// with something THIS APP COMPUTED is a different speech act: there is
// nothing to weigh, only something to re-check, because the same expression
// evaluated twice can never honestly produce two different answers. So the
// fix is not a check the DRAFT must pass (there is no draft — the model is
// never asked) — it is a second door, checked the turn AFTER a computed
// answer, that recognizes a dispute of THAT answer and re-verifies
// mechanically rather than letting the conversation's own agreeableness
// decide.
//
// `claimedValue` (above) already reads "the number a text claims" and had
// no caller anywhere in this app — built, tested, never wired. It is not
// reused here: it reads the LAST bare number in a whole passage, tuned for
// a model's own worked answer ("17 times 24 is 408"), and a dispute needs
// EVERY number the person named compared against every number the computed
// answer's own `display` states, not just the last one — `numbersIn`
// (above, `checkComparison`'s own helper) already reads exactly that, comma
// grouping and all, so it is reused rather than declared a second time.
//
// Only a result carrying a real `expression` is defended — every door in
// this file sets one (`checkArithmetic`/`checkShaped`/`checkCalendar`/
// `checkClock`) except `checkComparison`, whose "answer" is two numbers
// already IN the question rather than a computed one this module could
// hand back and re-evaluate; disputing an ordering/distance claim stays
// correction.js's territory, unchanged.
/**
 * A small, LOCAL closed class — disputing a mechanical answer is never
 * expressed by the shared cross-repo `NEGATION_WORDS` (lang/en, priors.js:
 * "not"/"never"/"didn't"/"won't" — grammatical negation, no notion of
 * something being MISTAKEN). "Wrong"/"incorrect"/"actually" name the
 * ANSWER itself as false, a genuinely different word class, so this is
 * declared fresh here rather than widening a received grammatical set to
 * cover a semantic one — the same call P203 already made adding "no"
 * locally to admission.js instead of the shared class.
 */
const DISPUTE_CUE_RE =
  /\b(?:wrong|incorrect|mistaken|miscalculated?|(?:that'?s|it'?s|its)\s+not\s+(?:right|correct)|no,?\s+it'?s|actually)\b/i;

/** Unicode-aware word split, apostrophes kept inside a token ("don't",
 * "that's" stay one form) — the identical shape widget.js's own `forms()`
 * already uses for this exact purpose (reading a received closed class
 * against a message's own tokens), not re-derived. */
const wordsOf = (s) =>
  String(s ?? "").toLowerCase().replace(/[‘’]/g, "'").split(/[^\p{L}\p{N}']+/u).filter(Boolean);

/**
 * disputeByStructure(question, { negationWords, anaphoricPronouns }) → bool
 *
 * P209's own DISPUTE_CUE_RE closes six fixed phrasings; live specimens
 * (task_33f8807d — "hmm no, I'm pretty sure that's 14", "hmm, I don't
 * think that's right, I make it 95") show ordinary hedged disagreement
 * routinely misses all six, because English negates a disagreement with
 * "think" ("I DON'T think that's right") as often as it negates the
 * answer directly ("that's not right"). Widening the six-word list to a
 * longer one repeats the mistake this repo has already named and undone
 * once for this exact class (widget.js's own header, on ITS OWN prior
 * hand-typed word lists: "not a simplification of English, it was a
 * sample of it standing in for the whole").
 *
 * The structural signal instead: a received NEGATION_WORDS token (P41/P43's
 * own pattern — a closed grammatical class with its giver, injected, never
 * hand-typed here) co-occurring with a received ANAPHORIC_PRONOUNS token
 * ("that"/"it"/"this"/…, priors.js again) — i.e. the message negates
 * something WHILE POINTING BACK at the prior computed answer. Both
 * specimens above carry "that's"; "no" is added locally to the negation
 * set exactly the way P203 added it to admission.js's own copy — checked
 * and confirmed absent from the received class for the identical reason
 * (it is a discourse particle, not the class's own grammatical negators),
 * and added ONLY here, not to the shared cross-repo constant.
 *
 * Requiring BOTH tokens (never negation alone) is deliberate and load-
 * bearing: a genuine new question sharing this door's one-turn window can
 * carry an incidental negation with no anaphoric reference at all ("I
 * don't know, what's 5 times 6?" — "don't" present, no "that"/"it"/"this"
 * anywhere) and must never be read as a dispute of the PRIOR answer.
 * Anaphora is the tell that the negation is aimed at what was just said,
 * not at something else in the same breath.
 *
 * A THIRD, DISCLOSED requirement, found by trying to break this before
 * shipping it: "that" is also the ordinary English complementizer ("no,
 * that's not what the article said"), not only a demonstrative pointing at
 * the arithmetic answer — and that sentence carries both a received
 * negation word AND a received anaphor while being about something else
 * entirely, one turn after an unrelated computed answer. DISPUTE_CUE_RE's
 * own six words are unambiguous evaluations of correctness ("wrong",
 * "incorrect", "not right/correct") and stay licensed on their own for a
 * bare, number-less dispute; this wider, ambiguous structural signal is
 * licensed only when the message ALSO names a number — exactly what both
 * real specimens do ("...that's 14", "...I make it 95") and what an
 * unrelated correction about something else typically does not. A bare
 * "I don't think that's right" with no number is a real, disclosed
 * residue this widening does not close — the safer side to fail on.
 */
function disputeByStructure(question, { negationWords, anaphoricPronouns } = {}) {
  if (!(negationWords instanceof Set) || !negationWords.size) return false;
  if (!(anaphoricPronouns instanceof Set) || !anaphoricPronouns.size) return false;
  const toks = wordsOf(question);
  if (!toks.length) return false;
  return toks.some((t) => negationWords.has(t)) && toks.some((t) => anaphoricPronouns.has(t));
}

/**
 * disputesQuantity(question, found, organs) → { proposed } | null
 *
 * `found` is the PRIOR turn's own `checkQuantity` result — never recomputed
 * here (pure, no engine). Fires when the message either matches
 * DISPUTE_CUE_RE (unchanged) or clears `disputeByStructure` above — and,
 * if it names a number at all, that number is absent from `found.display`
 * — the same string the person was actually shown, so a message that
 * merely REPEATS the computed answer back ("yes, 14, got it") is correctly
 * read as agreement, not correction. `proposed` is the disputed number
 * when one was named, `null` when the message disagrees with nothing in
 * particular ("that's wrong" alone) — both are handed the identical
 * mechanical re-verification; only the reply's wording differs.
 *
 * `organs` (optional, opt-in, cast.js pattern — P41/P43's own precedent):
 * `{ negationWords, anaphoricPronouns }`, the engine's received priors.js
 * classes. Omitted, this function is byte-identical to before — the
 * structural widening only activates where a real caller injects the
 * classes (app.js does, at the one production call site).
 */
export function disputesQuantity(question, found, organs = {}) {
  if (!found || found.gap || !found.expression) return null; // a typed gap, or a comparison (correction.js's territory), settled nothing this door can defend
  const q = String(question ?? "");
  const said = numbersIn(question);
  const cued = DISPUTE_CUE_RE.test(q);
  // The structural (non-cue-word) path is licensed only when a number is
  // also named — see disputeByStructure's own header for why "that"'s
  // ordinary complementizer use makes a bare structural match too ambiguous
  // to trust on its own.
  if (!cued && !(said.length && disputeByStructure(q, organs))) return null;
  const correct = new Set(numbersIn(found.display ?? ""));
  const proposed = said.find((n) => !correct.has(n));
  if (said.length && proposed === undefined) return null; // every number they named is already the computed one
  return { proposed: proposed ?? null };
}
