// adapters/build/fuzz-values.mjs — the adversarial-but-realistic corpus
// this session's own falsification work was missing. Direct correction:
// "this is the kind of error the system needs to have loops on loops to
// detect and fix" — the quote-in-title injection bug (a real NPR episode,
// "Based on a \"true\" story", breaking out of `download="${title}.mp3"`)
// was never caught because every prior test (harm-gate falsify, false-
// positives, self-defense) used HAND-PICKED, well-behaved strings. Three
// ethos values is a complete enumeration of a closed set; an episode
// title is an OPEN set of real-world text, and no amount of hand-picking
// a few examples proves anything about the space a real feed can produce.
//
// This is not a list to "cover everything" — it is a declared, named
// sample of the failure CLASSES real user-controlled strings are known to
// trigger in naive string-interpolated markup: quote characters (the
// specimen that actually broke), angle brackets (tag injection), script
// content (XSS shape), ampersands (entity confusion), embedded newlines,
// very long strings, empty strings, non-Latin/RTL text, emoji, and
// template-literal-looking substrings (backticks, `${...}`) — since this
// codebase's own generated markup is ITSELF built from template literals
// and a title containing that exact syntax is a real, if rarer, second
// injection shape nothing here has tested either.
export const FUZZ_TITLES = [
  { id: "quote", value: 'Based on a "true" story', class: "attribute-breaking quote — the real NPR specimen that found this gap" },
  { id: "apostrophe", value: "It's a trap, don't fall for it", class: "single quote / apostrophe" },
  { id: "angle-brackets", value: "5 < 10 > close enough", class: "raw angle brackets, no tag intent" },
  { id: "tag-injection", value: "<b>bold</b> and <script>alert(1)</script>", class: "tag/script injection shape" },
  { id: "ampersand", value: "Tom & Jerry & Friends", class: "raw ampersand, entity confusion" },
  { id: "newline", value: "Line one\nLine two\nLine three", class: "embedded newline" },
  { id: "very-long", value: `A very long episode title ${"x".repeat(2000)} that keeps going`, class: "length, not shape — a genuinely long real title" },
  { id: "empty", value: "", class: "empty string" },
  { id: "rtl-arabic", value: "حلقة اختبار عربية", class: "right-to-left, non-Latin script" },
  { id: "emoji", value: "🎧 Big Episode 💥 Drop 🔥", class: "astral-plane emoji (surrogate pairs)" },
  { id: "template-literal-lookalike", value: "Price is `${episode.audioUrl}` today", class: "the app's OWN template-literal syntax appearing inside user data — a second, rarer injection shape into the SAME code this app already writes with template literals" },
  { id: "quote-and-backslash", value: 'She said \\"hello\\" back', class: "quote combined with a literal backslash" },
];
