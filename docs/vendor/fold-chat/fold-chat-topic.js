// fold-chat-topic.js — what a conversation becomes about, and the icon that
// looks most like it.
//
// Two jobs, both pure and node-testable:
//
//   titleOf(messages) — a short name for the chat, drawn from the salient terms
//     of the WHOLE exchange rather than the first thing said. The surface keeps
//     a provisional title from the opening turn and swaps in this one once the
//     conversation has found its subject (TURNS_TO_NAME turns in). A name is
//     what the chat became about, not what it opened with.
//
//   iconOf(messages) — a Phosphor icon name, chosen by cosine similarity between
//     the conversation's term vector and each icon's term vector over a shared
//     lexicon. The icon is not a keyword lookup with a first-match rule: every
//     icon competes, and the one whose vocabulary points most nearly the same
//     way as the conversation wins. Ties break on raw overlap, then lexicon
//     order, so the result is deterministic.
//
// No DOM, no IO. The Phosphor paths live in fold-chat-icons.js; this module
// names icons only, so it stays cheap to import and to test.
//
// SCOPE (declared, not smuggled): the stop-words, the word pattern, and the
// icon lexicon are ENGLISH. A conversation in another language tokenizes to
// nothing here, so it keeps its provisional name and the fallback icon rather
// than being given a wrong one. That is the intended failure — a disclosed
// scope, not a silent one.

/** The turn at which a provisional title is replaced by the topical one. */
export const TURNS_TO_NAME = 4;

/** The icon when nothing matches, and for a chat with nothing said yet — a
 *  conversation in progress. It is a real vendored Phosphor mark, so an empty
 *  chat wears an icon too. */
export const FALLBACK_ICON = "chat-circle-dots";

const STOP = new Set((
  "the a an and or but if then than that this these those there here " +
  "i me my we our you your he she it its his her him they them their " +
  "is are was were be been being am do does did doing done have has had having " +
  "will would shall should can could may might must " +
  "of to in on at by for with from into over under about as up out off again " +
  "what when where which who whom whose why how " +
  "not no nor so too very just also even still yet only own same such " +
  "all any both each every few more most other some many much " +
  "tell show give make made write wrote written please thanks thank hello hey " +
  "okay ok yeah yep nope well like want need know think thing things stuff " +
  "really actually maybe sure right good great new old one two first last next " +
  "long short big small high low get got going gone going " +
  "let lets us use used using based able want need"
).split(/\s+/).filter(Boolean));

const WORD_RE = /[a-z][a-z'-]{1,}/g;

/** Lowercased word tokens, stop-words and 1–2 letter fragments dropped. */
export function tokenize(text) {
  const out = [];
  const m = String(text ?? "").toLowerCase().match(WORD_RE);
  if (!m) return out;
  for (const w of m) {
    if (w.length < 3 || STOP.has(w)) continue;
    out.push(w);
  }
  return out;
}

/** Weighted term frequencies: unigrams and adjacent bigrams. The person's own
 *  turns weigh more than the reply — the subject is what they are driving at. */
function termVector(messages) {
  const tf = new Map();
  for (const msg of messages || []) {
    const text = String(msg?.content ?? "");
    if (!text.trim()) continue;
    const weight = msg.role === "user" ? 1.6 : 1;
    const words = tokenize(text);
    for (const w of words) tf.set(w, (tf.get(w) || 0) + weight);
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = words[i] + " " + words[i + 1];
      tf.set(bigram, (tf.get(bigram) || 0) + weight * 1.5);
    }
  }
  return tf;
}

/** Terms ranked by what the conversation is actually about: frequency, how many
 *  turns carry them (spread), and a light proper-noun lift. */
export function salientTerms(messages, limit = 8) {
  const tf = termVector(messages);
  if (!tf.size) return [];
  const spread = new Map();
  const firstAt = new Map();
  let seen = 0;
  for (const msg of messages || []) {
    const text = String(msg?.content ?? "");
    const words = new Set(tokenize(text));
    for (const w of words) spread.set(w, (spread.get(w) || 0) + 1);
    const bigrams = new Set();
    const arr = tokenize(text);
    for (let i = 0; i < arr.length - 1; i++) bigrams.add(arr[i] + " " + arr[i + 1]);
    for (const b of bigrams) spread.set(b, (spread.get(b) || 0) + 1);
    for (const w of [...words, ...bigrams]) if (!firstAt.has(w)) firstAt.set(w, seen++);
  }
  const proper = properNouns(messages);
  const scored = [];
  for (const [term, freq] of tf) {
    const s = Math.sqrt(freq) * (0.6 + (spread.get(term) || 1)) * (proper.has(term) ? 1.25 : 1);
    scored.push({ term, score: s, freq, spread: spread.get(term) || 1, at: firstAt.get(term) ?? 0 });
  }
  scored.sort((a, b) => b.score - a.score || a.at - b.at);
  return scored.slice(0, limit);
}

/** Capitalised words that are not sentence-openers — a rough proper-noun set,
 *  used only to lift names and places in the ranking. */
function properNouns(messages) {
  const out = new Set();
  for (const msg of messages || []) {
    const text = String(msg?.content ?? "");
    const re = /(^|[.!?]\s+|\n)\s*([A-Z][a-z][a-z'-]+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const word = m[2];
      if (!STOP.has(word.toLowerCase())) out.add(word.toLowerCase());
    }
  }
  return out;
}

/** A short name for the chat, drawn from what it became about. Takes the
 *  highest-ranked phrase (or word) as the core, then fills up to three distinct
 *  words, ordered by where they first appeared so the name reads in the order
 *  the subject arrived. Falls back to the opening of the first turn. */
export function titleOf(messages) {
  const terms = salientTerms(messages, 10);
  if (!terms.length) return provisionalTitle(messages);
  const words = [];
  const add = (w) => { if (!words.includes(w)) words.push(w); };
  for (const { term } of terms) {
    if (words.length >= 3) break;
    for (const w of term.split(" ")) {
      if (words.length >= 3) break;
      add(w);
    }
  }
  const at = new Map();
  let i = 0;
  for (const msg of messages || []) for (const w of tokenize(msg?.content)) if (!at.has(w)) at.set(w, i++);
  const ordered = words.slice().sort((a, b) => (at.get(a) ?? 1e9) - (at.get(b) ?? 1e9));
  let title = ordered.join(" ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
  return title.length > 46 ? title.slice(0, 45).trimEnd() + "…" : title;
}

/** The opening of the first substantive turn — the provisional name. */
export function provisionalTitle(messages) {
  const first = (messages || []).find((m) => String(m?.content || "").trim().length >= 3);
  const text = String(first?.content || "").trim().replace(/\s+/g, " ");
  if (!text) return "New chat";
  return text.length > 46 ? text.slice(0, 45).trimEnd() + "…" : text;
}

/** How many turns the person has taken. */
export function userTurns(messages) {
  return (messages || []).filter((m) => m?.role === "user").length;
}

// The lexicon: each Phosphor icon and the words that point at it. Terms may be
// phrases; matching is by cosine over the union of every icon's terms, so a
// broad icon is not favoured merely for having more synonyms.
export const ICON_TERMS = Object.freeze({
  "scales": ["law", "legal", "court", "justice", "lawsuit", "litigation", "statute", "ordinance", "code", "appeal", "judge", "ruling", "attorney", "lawyer", "counsel", "constitutional", "rights", "trial"],
  "gavel": ["court", "judge", "ruling", "hearing", "verdict", "trial", "sentencing", "bench", "justice", "legal", "prosecution", "defendant"],
  "book-open": ["book", "reading", "chapter", "novel", "literature", "author", "manuscript", "essay", "prose", "text", "read", "textbook", "fiction"],
  "books": ["library", "books", "archive", "collection", "shelf", "bibliography", "catalog", "reference"],
  "newspaper": ["news", "newspaper", "press", "journalism", "reporter", "headline", "media", "article", "editorial", "coverage"],
  "file-text": ["report", "document", "memo", "brief", "filing", "record", "form", "contract", "agreement", "policy", "minutes", "transcript", "draft", "summary"],
  "files": ["files", "records", "archive", "documents", "paperwork", "filing", "documentation"],
  "folder": ["project", "folder", "files", "directory", "workspace", "repository"],
  "receipt": ["receipt", "invoice", "billing", "expense", "payment", "purchase", "tax", "refund", "budget", "cost", "fee"],
  "currency-dollar": ["money", "dollar", "cost", "price", "budget", "funding", "finance", "salary", "wage", "revenue", "profit", "fee", "spending", "tax", "economic"],
  "money": ["money", "cash", "finance", "payment", "wealth", "fund", "dollars", "currency"],
  "credit-card": ["payment", "credit", "card", "billing", "transaction", "purchase", "checkout"],
  "chart-line": ["trend", "growth", "decline", "forecast", "projection", "metric", "increase", "decrease", "rate"],
  "chart-bar": ["statistics", "data", "survey", "count", "rate", "percentage", "comparison", "numbers", "measure"],
  "chart-pie": ["share", "allocation", "proportion", "distribution", "budget", "breakdown", "percent"],
  "database": ["database", "dataset", "table", "schema", "query", "records", "data", "storage"],
  "bank": ["bank", "finance", "government", "treasury", "loan", "institution", "mortgage", "credit"],
  "code": ["code", "programming", "function", "script", "software", "api", "javascript", "python", "typescript", "compile", "refactor", "repository", "string", "array", "syntax"],
  "terminal": ["terminal", "shell", "command", "cli", "console", "bash", "script", "commandline"],
  "bug": ["bug", "error", "defect", "crash", "issue", "debugging", "fix", "broken", "failure"],
  "cpu": ["hardware", "processor", "chip", "computer", "system", "machine", "server", "memory"],
  "robot": ["ai", "robot", "automation", "agent", "model", "machine learning", "algorithm", "artificial intelligence", "llm"],
  "brain": ["mind", "thinking", "cognition", "memory", "reasoning", "psychology", "consciousness", "intelligence", "learning"],
  "gear": ["settings", "engineering", "process", "configuration", "workflow", "system", "mechanics"],
  "wrench": ["repair", "fix", "maintenance", "engineering", "tool", "technical", "broken"],
  "hammer": ["construction", "build", "repair", "labor", "carpentry", "infrastructure"],
  "heart": ["heart", "love", "care", "compassion", "emotion", "relationship", "feeling", "romance"],
  "first-aid": ["emergency", "first aid", "injury", "accident", "ambulance", "cpr", "rescue", "wound"],
  "pill": ["medicine", "medication", "drug", "prescription", "dosage", "pharmacy", "treatment", "opioid"],
  "stethoscope": ["doctor", "medical", "health", "diagnosis", "patient", "clinic", "hospital", "physician", "care"],
  "pulse": ["health", "vital", "signs", "heartbeat", "monitor", "pulse", "wellness", "condition"],
  "flask": ["science", "chemistry", "experiment", "lab", "research", "hypothesis", "chemical", "study"],
  "atom": ["physics", "atom", "quantum", "energy", "particle", "nuclear", "matter"],
  "dna": ["biology", "genetics", "dna", "gene", "heredity", "evolution", "species", "cell"],
  "microscope": ["biology", "research", "lab", "specimen", "cells", "microbiology", "microscope", "organism"],
  "binoculars": ["research", "observe", "observation", "look", "watch", "survey", "examine", "investigate", "bird"],
  "planet": ["space", "astronomy", "planet", "cosmos", "stars", "orbit", "galaxy", "nasa"],
  "globe": ["world", "global", "international", "geography", "country", "nation", "foreign", "abroad"],
  "map-pin": ["location", "place", "address", "map", "city", "site", "where", "region", "county"],
  "buildings": ["city", "urban", "building", "downtown", "development", "zoning", "metropolitan", "municipal", "council"],
  "house": ["home", "housing", "residence", "property", "rent", "mortgage", "neighborhood", "eviction", "tenant", "landlord"],
  "car": ["car", "traffic", "vehicle", "driving", "road", "accident", "transport", "highway", "collision"],
  "train": ["train", "transit", "rail", "subway", "commute", "railway", "station"],
  "airplane": ["travel", "flight", "airport", "plane", "aviation", "airline", "aircraft"],
  "truck": ["truck", "shipping", "logistics", "freight", "delivery", "transport", "cargo"],
  "package": ["package", "shipping", "delivery", "logistics", "order", "parcel", "supply"],
  "factory": ["industry", "manufacturing", "factory", "production", "plant", "industrial", "emissions"],
  "storefront": ["business", "retail", "store", "shop", "commerce", "vendor", "merchant", "market"],
  "suitcase": ["travel", "trip", "vacation", "luggage", "journey", "tourism"],
  "rocket": ["startup", "launch", "growth", "innovation", "venture", "scale", "product"],
  "tree": ["environment", "nature", "forest", "climate", "conservation", "tree", "wildlife", "habitat"],
  "leaf": ["environment", "nature", "sustainability", "green", "ecology", "climate", "emissions", "carbon"],
  "drop": ["water", "rain", "drought", "flooding", "resource", "river", "quality", "utility"],
  "fire": ["fire", "emergency", "wildfire", "burn", "hazard", "blaze", "smoke", "disaster"],
  "lightning": ["energy", "power", "electricity", "fast", "electric", "grid", "voltage"],
  "plug": ["energy", "power", "electricity", "utility", "grid", "electric", "outage"],
  "users": ["people", "group", "community", "team", "public", "population", "residents", "citizens", "members"],
  "fingerprint": ["identity", "biometrics", "forensic", "person", "identification", "dna", "criminal"],
  "handshake": ["agreement", "deal", "partnership", "contract", "negotiation", "settlement", "consent"],
  "briefcase": ["business", "work", "job", "career", "company", "employment", "corporate", "professional"],
  "megaphone": ["announcement", "campaign", "advocacy", "protest", "politics", "outreach", "organize", "rally"],
  "flag": ["politics", "government", "nation", "campaign", "election", "patriotism", "state", "democracy"],
  "graduation-cap": ["education", "school", "university", "learning", "teaching", "student", "degree", "curriculum"],
  "student": ["education", "school", "learning", "student", "teaching", "pupil", "classroom", "tuition"],
  "shield-check": ["security", "safety", "protection", "verification", "compliance", "audit", "oversight", "accountability", "investigation"],
  "lock": ["privacy", "security", "encryption", "password", "secret", "locked", "access", "surveillance"],
  "chat-circle": ["conversation", "chat", "discussion", "talk", "message", "question", "advice"],
  "question": ["question", "query", "inquiry", "unknown", "ask", "clarify", "wonder", "doubt"],
  "lightbulb": ["idea", "insight", "suggestion", "inspiration", "concept", "brainstorm", "solution"],
  "sparkle": ["generate", "creative", "magic", "new", "imagine", "story", "invent", "design"],
  "pencil": ["write", "edit", "draft", "note", "revise", "rewrite", "compose"],
  "note-pencil": ["notes", "note", "memo", "draft", "write", "journal", "record"],
  "article": ["article", "essay", "blog", "post", "writing", "piece", "column", "op-ed"],
  "pen-nib": ["writing", "authorship", "signature", "prose", "letter", "author", "write"],
  "calendar": ["calendar", "schedule", "date", "deadline", "timeline", "meeting", "appointment", "when"],
  "clock": ["time", "history", "timeline", "duration", "schedule", "hour", "late", "delay"],
  "envelope": ["email", "mail", "letter", "correspondence", "message", "inbox", "send"],
  "music-notes": ["music", "song", "audio", "melody", "sound", "band", "album", "lyrics"],
  "film-strip": ["film", "movie", "video", "cinema", "documentary", "footage", "screen"],
  "camera": ["photo", "camera", "image", "picture", "photography", "snapshot", "visual"],
  "video-camera": ["video", "recording", "footage", "stream", "camera", "broadcast", "film"],
  "headphones": ["audio", "podcast", "music", "listening", "sound", "headphones", "radio"],
  "microphone": ["podcast", "audio", "recording", "interview", "voice", "microphone", "speech"],
  "paint-brush": ["art", "painting", "design", "creative", "craft", "drawing", "illustration"],
  "palette": ["art", "design", "color", "palette", "creative", "aesthetic", "style"],
  "game-controller": ["game", "gaming", "play", "videogame", "console", "player"],
  "soccer-ball": ["sports", "game", "soccer", "football", "athletic", "team", "match"],
  "fork-knife": ["food", "restaurant", "cooking", "meal", "recipe", "dining", "cuisine", "menu"],
  "magnifying-glass": ["search", "research", "find", "investigate", "look", "examine", "explore", "discover"],
  "detective": ["investigation", "detective", "mystery", "case", "evidence", "police", "inquiry", "forensic", "suspect"],
  "map-trifold": ["map", "maps", "atlas", "geography", "region", "territory", "route", "directions", "navigate", "navigation", "cartography", "neighborhoods", "history", "historic", "historical", "heritage", "nashville", "tennessee", "state capital"],
  "castle-turret": ["castle", "medieval", "fortress", "kingdom", "knight", "middle ages", "palace", "feudal", "landmark", "landmarks", "monument", "monuments", "tower", "eiffel", "memorial", "statue", "museum", "architecture"],
  "church": ["church", "religion", "religious", "faith", "worship", "cathedral", "bible", "christian", "prayer", "theology", "spiritual"],
  "bridge": ["bridge", "bridges", "span", "viaduct", "overpass"],
  "scroll": ["scroll", "papyrus", "parchment", "antiquity", "archaeology", "manuscripts", "classical", "greek", "roman", "rome", "ancient", "century", "founded", "civilization", "empire", "colonial", "civil war", "revolution"],
  "hourglass": ["hourglass", "patience", "waiting", "eventually", "lifespan", "aging"],
  "compass": ["compass", "direction", "explore", "exploration", "adventure", "bearing", "orienteering"],
  "globe-hemisphere-west": ["america", "american", "continent", "hemisphere", "atlantic", "usa", "united states", "north america"],
  "mountains": ["mountain", "mountains", "hiking", "hike", "trail", "summit", "peak", "climbing", "alps", "everest"],
  "lighthouse": ["lighthouse", "coast", "coastal", "shore", "maritime", "harbor", "beacon"],
  "feather": ["poem", "poems", "poetry", "poet", "verse", "stanza", "haiku", "sonnet", "rhyme", "limerick", "lyrical", "ode", "ballad"],
  "notebook": ["notebook", "journal", "diary", "jot", "study guide", "notes", "outline", "class notes"],
  "book-bookmark": ["bookmark", "reading list", "bestseller", "paperback", "library book", "storybook", "story", "stories", "fable", "tale"],
  "quotes": ["quote", "quotes", "quotation", "citation", "saying", "proverb", "excerpt", "epigraph"],
  "translate": ["translate", "translation", "language", "spanish", "french", "german", "japanese", "chinese", "grammar", "vocabulary", "linguistics", "bilingual"],
  "terminal-window": ["linux", "unix", "ssh", "zsh", "npm", "docker", "install", "shell script", "devops"],
  "brackets-curly": ["json", "yaml", "regex", "html", "css", "frontend", "web development", "react", "node"],
  "git-branch": ["git", "branch", "commit", "merge", "pull request", "github", "version control", "rebase"],
  "laptop": ["laptop", "computer", "windows", "macbook", "software", "app", "tech", "device", "install"],
  "function": ["functions", "variables", "recursion", "algorithm", "lambda", "parameter", "return", "callback", "closure"],
  "calculator": ["calculate", "calculation", "arithmetic", "sum", "multiply", "divide", "percent", "interest", "compute"],
  "math-operations": ["math", "mathematics", "algebra", "equation", "geometry", "calculus", "theorem", "proof", "trigonometry", "integral", "derivative", "probability"],
  "test-tube": ["chemistry", "reaction", "compound", "molecule", "acid", "titration", "solution", "periodic table", "element"],
  "heartbeat": ["cardio", "cardiac", "cardiology", "heart rate", "blood pressure", "cholesterol", "heart attack", "ecg"],
  "tooth": ["dentist", "dental", "teeth", "tooth", "cavity", "orthodontist", "braces", "gums"],
  "virus": ["virus", "viral", "infection", "flu", "covid", "pandemic", "vaccine", "pathogen", "bacteria", "disease", "immune"],
  "syringe": ["vaccine", "vaccination", "injection", "shot", "needle", "booster", "immunization", "blood test"],
  "barbell": ["gym", "workout", "fitness", "exercise", "lifting", "strength", "training", "muscle", "weights", "bodybuilding"],
  "piggy-bank": ["savings", "saving", "save", "retirement", "pension", "frugal", "emergency fund", "401k", "invest", "investing"],
  "wallet": ["wallet", "spending", "expenses", "debit", "personal finance", "allowance", "afford"],
  "coins": ["coins", "coin", "change", "currency", "penny", "numismatic", "crypto", "bitcoin", "token"],
  "trend-up": ["stocks", "stock", "market", "invest", "returns", "bull", "rally", "earnings", "shares", "portfolio", "dividend"],
  "guitar": ["guitar", "chords", "rock", "bass", "acoustic", "strumming", "fretboard", "blues", "country music"],
  "piano-keys": ["piano", "keyboard", "keys", "sheet music", "scales", "classical music", "composer", "sonata", "orchestra", "symphony", "jazz"],
  "vinyl-record": ["vinyl", "record", "records", "album", "albums", "discography", "turntable", "dj", "hip hop", "playlist"],
  "microphone-stage": ["singer", "concert", "karaoke", "performance", "stage", "live music", "sing", "singing", "rapper", "stand-up", "comedy"],
  "music-note": ["note", "melody", "tune", "chorus", "harmony", "rhythm", "songwriting", "lyrics"],
  "tent": ["camping", "camp", "campsite", "tent", "backpacking", "outdoors", "wilderness", "campfire"],
  "sailboat": ["sailing", "sail", "boat", "yacht", "cruise", "ocean", "sea", "marina", "kayak", "canoe"],
  "bicycle": ["bike", "bicycle", "cycling", "biking", "cyclist", "pedal", "tour de france", "bike lane"],
  "airplane-takeoff": ["itinerary", "layover", "boarding", "vacation", "getaway", "tickets", "visa", "passport", "destination", "tourist", "sightseeing"],
  "coffee": ["coffee", "espresso", "latte", "cafe", "caffeine", "tea", "barista", "brew", "breakfast"],
  "pizza": ["pizza", "pasta", "italian", "pepperoni", "slice", "dough", "takeout"],
  "hamburger": ["burger", "fast food", "fries", "sandwich", "grill", "barbecue", "bbq", "hot dog"],
  "carrot": ["vegetable", "vegetables", "vegan", "vegetarian", "garden", "gardening", "produce", "salad", "diet", "nutrition", "organic"],
  "cooking-pot": ["soup", "stew", "boil", "simmer", "ingredients", "bake", "baking", "roast", "saute", "sauce", "kitchen", "chef", "cookbook"],
  "cloud": ["cloud", "cloudy", "overcast", "cloud computing", "aws", "azure", "saas", "hosting", "cloud storage"],
  "sun": ["sun", "sunny", "sunshine", "solar", "summer", "sunrise", "sunset", "uv", "sunburn", "heat wave", "solstice"],
  "cloud-sun": ["weather", "forecast", "partly cloudy", "temperature", "meteorology", "outlook", "today's weather", "mild"],
  "cloud-rain": ["rain", "rainy", "storm", "drizzle", "showers", "thunderstorm", "monsoon", "precipitation", "downpour"],
  "snowflake": ["snow", "snowy", "winter", "blizzard", "ice", "frost", "freezing", "skiing", "snowfall", "cold"],
  "thermometer": ["temperature", "fever", "degrees", "celsius", "fahrenheit", "thermostat", "hot", "heat"],
  "umbrella": ["umbrella", "insurance", "coverage", "rainy day", "protection plan", "premium", "deductible"],
  "wind": ["wind", "windy", "breeze", "gust", "hurricane", "tornado", "turbine", "air quality"],
  "moon": ["moon", "lunar", "night", "sleep", "eclipse", "midnight", "bedtime", "insomnia", "dream", "dreams", "twilight"],
  "paw-print": ["pet", "pets", "animal", "animals", "veterinary", "vet", "puppy", "kitten", "adopt", "shelter", "zoo"],
  "cat": ["cat", "cats", "kitten", "feline", "meow", "litter"],
  "dog": ["dog", "dogs", "puppy", "canine", "leash", "breed", "barking", "walkies"],
  "fish": ["fish", "fishing", "aquarium", "salmon", "seafood", "angler", "trout", "tuna"],
  "butterfly": ["butterfly", "butterflies", "insect", "insects", "pollinator", "moth", "caterpillar", "metamorphosis"],
  "bird": ["bird", "birds", "birding", "owl", "eagle", "songbird", "migration", "robin", "sparrow", "ornithology"],
  "horse": ["horse", "horses", "equestrian", "riding", "stable", "pony", "derby", "cowboy", "ranch"],
  "flower": ["flower", "flowers", "bouquet", "blossom", "bloom", "garden", "petal", "rose", "tulip", "spring", "floral", "wedding"],
  "football": ["football", "nfl", "quarterback", "touchdown", "super bowl", "rugby", "college football"],
  "basketball": ["basketball", "nba", "dunk", "hoops", "court", "playoffs", "march madness"],
  "trophy": ["trophy", "champion", "championship", "winner", "tournament", "award", "medal", "olympics", "league", "competition"],
});

/** Every icon's terms as one vocabulary, for the cosine projection. */
const VOCAB = (() => {
  const set = new Set();
  for (const terms of Object.values(ICON_TERMS)) for (const t of terms) set.add(t);
  return set;
})();

function norm(vec) {
  let s = 0;
  for (const v of vec.values()) s += v * v;
  return Math.sqrt(s) || 1;
}

/** Cosine similarity between the conversation's term vector and an icon's
 *  term vector, both projected onto the shared vocabulary. */
function similarity(tf, terms) {
  const b = new Map();
  for (const t of terms) b.set(t, (b.get(t) || 0) + 1);
  let dot = 0;
  for (const [t, w] of b) dot += (tf.get(t) || 0) * w;
  return dot / (norm(tf) * norm(b));
}

/** The Phosphor icon that looks most like this conversation. */
export function iconOf(messages) {
  const tf = termVector(messages);
  if (!tf.size) return FALLBACK_ICON;
  const projected = new Map();
  for (const [t, v] of tf) if (VOCAB.has(t)) projected.set(t, v);
  if (!projected.size) return FALLBACK_ICON;
  let best = FALLBACK_ICON;
  let bestScore = 0;
  let bestOverlap = 0;
  for (const [name, terms] of Object.entries(ICON_TERMS)) {
    let overlap = 0;
    for (const t of terms) overlap += projected.get(t) || 0;
    if (!overlap) continue;
    const score = similarity(projected, terms);
    if (score > bestScore + 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && overlap > bestOverlap)) {
      best = name;
      bestScore = score;
      bestOverlap = overlap;
    }
  }
  return best;
}

/** Both at once — the name and the icon the chat has become. */
export function topicOf(messages) {
  return { title: titleOf(messages), icon: iconOf(messages) };
}
