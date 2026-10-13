// native/organs/archon-compendium.js — THE COMPENDIUM. The latent mind ethos
// thinks with at the core, held in the native language of the speaker.
//
// WHAT THIS IS. Every organ in the reading carries an archon — a namesake,
// the historical or biological figure its discipline is named for (the
// README's Handle table). This module is the compendium of the PUBLIC-DOMAIN
// and FAIR-USE parts of those archons' actual work: what they actually
// contributed, stated faithfully, each entry always credited. It is not a
// pile of quotes to drop into answers; it is the ground wisdom — the record
// of WHO the reader's methods come from, so a response that draws on an
// archon's discipline can name its source instead of wearing the authority
// as if it were the machine's own.
//
// THE RULE (user direction, 2026-09-15, verbatim): "all organs with archons,
// put together a compendium of the public domain/fair use parts of their
// work, always credited in a response." "Always credited" is not a style
// choice — it is the source discipline the rest of this codebase already
// lives under (a received closed class enters with its giver named or it
// does not enter; a quotation is verified to its source or not printed as
// one). An archon's work is quoted here only in its public-domain or fair-use
// portion: ancient and classical texts in full, modern works as short
// credited phrases.
//
// THE STATUS FIELD. Each entry names what part of the work is usable and on
// what footing:
//   public-domain     — the work itself is out of copyright (ancient/classical
//                       texts, pre-1929 publications, authors dead 70+ years).
//   fair-use          — a recent work; only a short credited phrase is
//                       included, never the bulk of it.
//   received-classic  — a classical concept/doctrine received through many
//                       hands (translation as citation), the original in PD.
//   conceptual        — a biological or structural namesake (an animal, an
//                       organ, a shrine) whose "work" is the behavior or fact
//                       named for it, not a copyrighted text.
//   nomination        — a system-internal nomination (a name the README's
//                       Handle table chose) whose specific works this module
//                       does not assert; the posture is named, no work claimed.
//   reserved          — the module is not yet built; the row is a reservation.
//
// CREDIT. Every entry carries a `credit` line, phrased to be usable verbatim
// in a response. `matchArchons(text)` returns the archons whose domain a
// question touches, each with its credit — so relevant ground wisdom gets
// priority in being quoted, and the response always credits it.

import { ARCHON_DOSSIERS, ARCHON_DOSSIERS_DIGEST } from "./archon-dossiers.js";

export const ARCHON_COMPENDIUM_SCHEMA = "ArchonCompendium@1";
export const ARCHON_COMPENDIUM_GIVER = "eoreader7:organs/archon-compendium.js";

// ── THE COMPENDIUM ─────────────────────────────────────────────────────────
// One entry per handle in the README's Handle table, ordered by its section.
// `work` is the public-domain/fair-use portion, stated in the native language
// of the speaker; `source` names the actual work; `credit` is the verbatim
// line a response may carry.
export const ARCHONS = Object.freeze([
  // ── THE GROUND ──────────────────────────────────────────────────────────
  {
    handle: "solon",
    name: "Solon",
    organ: "organs/ethos.js",
    role: "the GROUND — the constitution producing a clearance the reader requires; ethos comes before logos",
    pdStatus: "public-domain",
    work: "The Athenian lawgiver who gave the city a constitution it stood on. His laws and poems survive in fragments, including the maxim 'nothing in excess' (meden agan). The ground is not a gate that can be lifted — pull it and the structure falls.",
    source: "Solon's laws and fragments, c. 6th century BCE",
    credit: "Solon, the Athenian lawgiver — 'nothing in excess' (meden agan); the ground the reader is built on.",
    topics: ["constitution", "law", "ethos", "ground", "rights", "lawgiver", "athens", "civic"],
  },
  // ── EVIDENTIARY WALK ─────────────────────────────────────────────────────
  {
    handle: "sima",
    name: "Sima Qian",
    organ: "organs/primary.js",
    role: "walk past the received account to the archive",
    pdStatus: "public-domain",
    work: "The Grand Historian of Han China, author of the Records of the Grand Historian (Shiji). His method was archival: gather the scattered records, verify what is real, and prefer the archive over the received account — 'walk past the received account to the archive.'",
    source: "Records of the Grand Historian (Shiji), c. 94 BCE",
    credit: "Sima Qian — the Grand Historian: walk past the received account to the archive (Shiji, c. 94 BCE).",
    topics: ["archive", "primary", "source", "record", "history", "reliable", "verify"],
  },
  {
    handle: "bukhari",
    name: "Muhammad ibn Isma'il al-Bukhari",
    organ: "organs/corroboration.js",
    role: "stands only on independent chains; shared chain = one witness",
    pdStatus: "public-domain",
    work: "Compiler of the Sahih, the canonical hadith collection. His discipline was the chain of transmission (isnad): a report stands only on independent chains of narrators, and two reports sharing one link are one witness, not two.",
    source: "Sahih al-Bukhari, 9th century CE",
    credit: "al-Bukhari — a report stands only on independent chains; a shared chain is one witness (Sahih, 9th c.).",
    topics: ["corroborat", "witness", "chain", "transmission", "independent", "hadith", "reliability"],
  },
  {
    handle: "wigmore",
    name: "John Henry Wigmore",
    organ: "organs/testimony.js",
    role: "ask the witness twice, swapped twin, verdict from the pair",
    pdStatus: "public-domain",
    work: "The great American evidence scholar. His Science of Judicial Proof treats proof as a process of reasoning over testimony, and cross-examination as asking the witness more than once — the twin-sentence verdict drawn from the pair, never from a single unchallenged answer.",
    source: "Principles of Judicial Proof (1913, public domain); the 1937 retitled edition is The Science of Judicial Proof (not the 1913 work)",
    credit: "John Henry Wigmore — proof as a process of reasoning over testimony; ask the witness twice, verdict from the pair.",
    topics: ["testimony", "witness", "evidence", "cross-exam", "proof", "sworn"],
  },
  {
    handle: "khaldun",
    name: "Ibn Khaldun",
    organ: "organs/witness-sentences.js",
    role: "check the report against the nature of things before admitting it",
    pdStatus: "public-domain",
    work: "The Muqaddimah (Prolegomena) founded social history. His rule for admitting a report: check it against the nature of things — the regular course of human affairs — before admitting it as testimony, not merely because an authority carried it.",
    source: "Muqaddimah, 1377",
    credit: "Ibn Khaldun — check the report against the nature of things before admitting it (Muqaddimah, 1377).",
    topics: ["report", "nature", "admit", "testimony", "social", "plausibility", "verify"],
  },
  {
    handle: "yadayadayada",
    name: "Yada Yada Yada",
    organ: "organs/run-dmca.js",
    role: "the archon of paraphrase — the seam between synthesis and source: a claim in other words either stands on the source's own bytes or it does not; grounded is grounded, invention is invention",
    pdStatus: "nomination",
    work: "The handle names a posture, not a claimed work: to paraphrase is to say the same thing in other words — compressing, restating, skipping the verbatim without changing what was meant. The discipline mechanized in this repo: paraphrase is chased by MEANING, never by character identity — the holograph equates when a write span is the same referent-bound relation the source's own reading already projected; the chase is model-free (the record's own claim rows decide, FOR a named whom, and even the empty hub is a standpoint); and a paraphrase beyond the received vocabulary is a named gap, never a guess.",
    source: "the idiom 'yada yada yada' — the compressed restatement that skips the verbatim (the specific namesake's works are not asserted by this compendium)",
    credit: "YadaYadaYada — the archon of paraphrase: a claim in other words either stands on the source's bytes or it does not; grounded is grounded, invention is invention.",
    topics: ["paraphrase", "reword", "restatement", "meaning", "holograph", "synonym", "derive", "invent", "grounded", "chase"],
  },
  {
    handle: "mozi",
    name: "Mozi",
    organ: "organs/grounding.js",
    role: "it is in the bytes the eyes and ears can witness, or it isn't",
    pdStatus: "public-domain",
    work: "The Mohist school's three tests for any claim: it must be grounded in what the eyes and ears can witness, established by the ancients' experience, and beneficial to the people. 'It is in the bytes the eyes and ears can witness, or it isn't.'",
    source: "The Mozi, 4th–3rd century BCE",
    credit: "Mozi — a claim stands on what the eyes and ears can witness, or it does not stand (The Mozi).",
    topics: ["ground", "witness", "senses", "test", "claim", "empirical", "mohist"],
  },
  {
    handle: "output-claims",
    name: "The Claim-Form Seam",
    organ: "organs/output-claims.js",
    role: "the claim-FORM a story needs that plain SVO edges do not carry — heard from the material's OWN connectives as one derived form (the hypothetical, ground/consequence) plus two registers (the sequence — the form of inner sense; the testimony — a relation between persons), under the declared language's image set, each entry carrying its derived FORM and the material's own IMAGE",
    pdStatus: "nomination",
    work: "The ARCHITECTONIC (2026-09-16, the critique): the table is DERIVED, never gathered. The four gathered kinds were a transcendental illusion — causal and conditional are ONE form (the hypothetical, ground/consequence, Nagarjuna); temporal is no kind but the form of inner sense, the sequence any series is read in (Partee); utterance is not a logical form at all but the testimony register, a relation between persons (Terry Gross, the witness protocol). A seam, not a single figure: the archons already in this compendium adjudicate (Nagarjuna the consequence, Partee the when, Terry Gross the said), and this organ is the one door that hears them from a sentence's own images, language-blind in the core and specialized per language exactly as pronouns.js's PRONOUN_PRIORS holds one entry per language (S39): a language with no registered image set is a typed gap (no_claim_image_prior), never a silent English match. The bytes certify the image; they never contain the form. Measured omnilingually against the WLC Tanakh (heb, niqqud folded), Homer's Iliad (grc, polytonic folded), the Latin corpus (la), and English — a false positive is a sentence whose connective the material itself used, never an invented relation.",
    source: "the compendium's own adjudicating archons; the per-language image sets measured from each corpus's real bytes; the derivation of the table from the functions of judgment (the critique, 2026-09-16)",
    credit: "The claim-form seam (output-claims) — the hypothetical (ground/consequence) by Nagarjuna, the sequence by Partee, the testimony by Terry Gross; heard from the material's own images, form derived, image declared, per the material's own language.",
    topics: ["claim-form", "hypothetical", "sequence", "testimony", "form", "image", "connective", "omnilingual", "s39", "schematism"],
  },
  {
    handle: "output-order",
    name: "The Cut",
    organ: "organs/output-order.js",
    role: "the order an output's claims take — placed by the material's OWN sequence anchors, never by document position passed off as narrative",
    pdStatus: "nomination",
    work: "Murch owns the rhythm of the order (a film is cut where the audience blinks); Vonnegut owns the spine (the 27-operator arc, taxonomically complete). The order is the cut; the spine is the arc. The material's sequence register (output-claims.js) carries first/then/afterward; this organ places each claim in the sequence window that contains its span, and REFUSES when the material states no order — document order is not narrative order, and this organ will not pass one off as the other.",
    source: "Murch (In the Blink of an Eye) and Vonnegut (the eight shapes / the 27-cell arc), both already registered in this compendium",
    credit: "The cut (output-order) — ordered by Murch's rhythm and Vonnegut's spine, placed by the material's own temporal anchors, refused when none are stated.",
    topics: ["order", "narrative", "temporal", "cut", "arc", "sequence", "murch", "vonnegut"],
  },
  {
    handle: "output-voice",
    name: "The Register",
    organ: "organs/output-voice.js",
    role: "the register an output's prose wears — a closed set of declared sentence frames, chosen by the prompt's own register cues, never invented",
    pdStatus: "nomination",
    work: "Eastwood owns the lean (the shortest true answer, no wasted frames); Kubrick the precise (the whole framed before the first sentence); Strunk & White the plain (readability plus the classic style rules); Terry Gross the oral (the interviewer who draws the guest out). A register is a closed set of DECLARED frames — the only words beyond the claim's own, exactly as compose.js's TRANSITIONS are declared token origins. The prompt's cues pick the register; the words never do.",
    source: "Eastwood, Kubrick, Strunk & White, Terry Gross — all already registered in this compendium",
    credit: "The register (output-voice) — lean by Eastwood, precise by Kubrick, plain by Strunk & White, oral by Terry Gross; a closed set of declared frames, never an invented sentence.",
    topics: ["register", "voice", "frame", "lean", "precise", "plain", "oral", "eastwood", "kubrick", "strunk-white", "terry-gross"],
  },
  {
    handle: "dai",
    name: "Dai Zhen",
    organ: "organs/quotes.js",
    role: "a quotation is verified to its source or not printed as one",
    pdStatus: "fair-use",
    work: "The leading scholar of the evidential-research (kaozheng) school. His discipline: no word is taken on another's say-so — a quotation is traced to and verified against its actual source, or it is not printed as a quotation.",
    source: "The evidential-research (kaozheng) corpus, 18th century",
    credit: "Dai Zhen — evidential research: a quotation is verified to its source or not printed as one.",
    topics: ["quote", "citation", "verify", "evidential", "source", "kaozheng", "accuracy"],
  },
  {
    handle: "nadim",
    name: "Ibn al-Nadim",
    organ: "organs/source.js",
    role: "addressed catalogue; retrieval by where it sits, never by judgment",
    pdStatus: "public-domain",
    work: "The Kitab al-Fihrist, the great addressed catalogue of books and authors. Its method is retrieval by where a work sits in the catalogue — a location, never a judgment of the work's worth.",
    source: "Kitab al-Fihrist, 987 CE",
    credit: "Ibn al-Nadim — the addressed catalogue: retrieval by where a work sits, never by judgment (al-Fihrist, 987).",
    topics: ["catalog", "catalogue", "address", "location", "bibliography", "index", "shelf"],
  },
  {
    handle: "kahanamoku",
    aliases: ["duke"],
    name: "Duke Kahanamoku",
    organ: "activation-retrieval.js; field-of-record.js; proxy-runner.mjs::surfTask",
    role: "the archon of the surf — read the water, then ride the wave that is actually there",
    pdStatus: "nomination",
    work: "The handle names a posture, not a claimed work. The namesake is Duke Kahanamoku (1890–1968), the Hawaiian Olympic swimmer credited with carrying surfing to the wider world. The discipline mechanized here: a question is ridden into the material, not matched against it — the beings it names activate the sentences they stand in, the shadow/echo field says which recalls rise above its own null, and the feed is cut where showing more changes nothing.",
    source: "Duke Kahanamoku (1890–1968), Hawaiian swimmer and surfer (the namesake's own works are not asserted by this compendium)",
    credit: "Kahanamoku (Duke) — the archon of the surf: read the water, then ride the wave that is actually there.",
    topics: ["surf", "wave", "retrieval", "activation", "echo", "shadow", "recall", "passages"],
  },
  {
    handle: "houdini",
    name: "Harry Houdini",
    organ: "native/the-fold/archon-rules.js::houdiniExclusivity; proxy-runner.mjs::runProxyTurn (the shared post-generation tail)",
    role: "the exclusivity archon — nothing unlicensed rides in as if it were channeled",
    pdStatus: "nomination",
    work: "The illusionist and escape artist (1874–1926) whose later career was spent exposing fraudulent spiritualist mediums — not by declaring a séance false, but by attending one, then performing the same effect himself through ordinary conjuring and showing the mechanism live, onstage. He backed a standing, public prize (via Scientific American) for any medium who could produce a genuinely unexplainable effect under fraud-controlled conditions; it went unclaimed. The posture mechanized here is the same one, turned on this project's own mouth: a sentence carrying the confidence of channeled or discovered knowledge — the mouth's own account of its phrasing or task, dressed as content — is checked for the mechanism that actually produced it, and folded out when none exists. The same exclusivity condition the fold-and-cut theorem needs (nothing unlicensed lands on the cut), run on a live turn instead of only an offline essay.",
    source: "Harry Houdini (1874–1926); the historical record of his exposure campaigns, the Scientific American prize, and the 'Margery' committee investigation (the namesake's own specific claims and methods are not asserted verbatim by this compendium — recalled from general knowledge, not re-verified against a primary source).",
    credit: "Houdini — nothing unlicensed rides in as if it were channeled: show the mechanism, or fold it out.",
    topics: ["houdini", "medium", "seance", "oracle", "channel", "channeling", "bullshit", "confirmed", "verified", "proven", "apparatus", "leak", "exclusivity"],
  },
  {
    handle: "dignaga",
    name: "Dignaga",
    organ: "organs/asserted.js",
    role: "a word designates by exclusion; a verb is a hypothesis with counted support",
    pdStatus: "public-domain",
    work: "The Buddhist logician who founded the apoha (exclusion) theory: a word designates by excluding what it is not, never by capturing an essence. A claim is a hypothesis whose support is counted, never a recovered fact.",
    source: "Pramanasamuccaya, 5th–6th century CE",
    credit: "Dignaga — a word designates by exclusion; a claim is a hypothesis with counted support (Pramanasamuccaya).",
    topics: ["exclusion", "apoha", "hypothesis", "assert", "logic", "inference", "meaning"],
  },
  {
    handle: "liu-hui",
    name: "Liu Hui",
    organ: "organs/derivation.js",
    role: "rests on established premises or doesn't count",
    pdStatus: "public-domain",
    work: "The third-century mathematician whose commentary on the Nine Chapters on the Mathematical Art gave geometry its rigour. A derived result rests on established premises or it does not count — the same wall derivation.js stands on.",
    source: "Commentary on the Nine Chapters on the Mathematical Art, 3rd century CE",
    credit: "Liu Hui — a derived result rests on established premises or it does not count (Nine Chapters commentary).",
    topics: ["deriv", "premise", "prove", "mathematics", "rigour", "deduction", "result"],
  },
  {
    handle: "nagarjuna",
    name: "Nagarjuna",
    organ: "kernel/refutation.js",
    role: "refutes by consequence, asserts nothing",
    pdStatus: "public-domain",
    work: "The founder of the Madhyamaka school of emptiness. His method in the Mulamadhyamakakarika is to refute a position by drawing out its own consequences until it contradicts itself — the refutation asserts nothing of its own.",
    source: "Mulamadhyamakakarika, 2nd–3rd century CE",
    credit: "Nagarjuna — refute by consequence, assert nothing (Mulamadhyamakakarika).",
    topics: ["refut", "consequence", "contradiction", "emptiness", "madhyamaka", "negation"],
  },
  {
    handle: "tungara",
    name: "the tungara frog",
    organ: "kernel/contest.js",
    role: "competitors in the frame raise the margin required",
    pdStatus: "conceptual",
    work: "The tungara frog's mate choice: a female's acceptance threshold rises when a competing male's call is in the frame. Competitors in the frame raise the margin a signal must clear — the same bar contest.js applies to a contested reading.",
    source: "The tungara frog's lekking behavior (natural history)",
    credit: "the tungara frog — competitors in the frame raise the margin required.",
    topics: ["contest", "competit", "threshold", "margin", "signal", "mate", "challenge"],
  },
  {
    handle: "thymus",
    name: "the thymus",
    organ: "kernel/witness.js",
    role: "nomination is not admission",
    pdStatus: "conceptual",
    work: "The immune organ where T cells are selected: a cell is nominated for the repertoire, but nomination alone is not admission — it must survive the selection test before it is licensed. Nomination is never admission.",
    source: "Thymic selection (immunology)",
    credit: "the thymus — nomination is not admission; a candidate must survive selection to be licensed.",
    topics: ["nominate", "admission", "select", "license", "immune", "candidate", "gate"],
  },
  // ── BELIEF, OBLIGATION, PERSPECTIVE ──────────────────────────────────────
  {
    handle: "panini",
    name: "Panini",
    organ: "organs/experiencer.js",
    role: "every belief carries who is undergoing it",
    pdStatus: "public-domain",
    work: "The grammarian of the Ashtadhyayi, the most complete ancient grammar of Sanskrit. His invention was the rule-system itself — and its grammar never loses the agent: every belief carries who is undergoing it.",
    source: "Ashtadhyayi, c. 5th–4th century BCE",
    credit: "Panini — every belief carries who is undergoing it (Ashtadhyayi).",
    topics: ["belief", "experiencer", "agent", "grammar", "subject", "undergo", "first-person"],
  },
  {
    handle: "mahavira",
    name: "Mahavira",
    organ: "kernel/perspective.js",
    role: "true from a standpoint; standpoints kept apart",
    pdStatus: "public-domain",
    work: "The Jain teacher of anekantavada — non-one-sidedness. A claim is true from a standpoint, and standpoints are kept apart rather than merged; syadvada states each standpoint with its own qualifier.",
    source: "The Jain doctrine of anekantavada / syadvada, c. 6th century BCE",
    credit: "Mahavira — true from a standpoint; standpoints kept apart (anekantavada).",
    topics: ["standpoint", "perspective", "anekantavada", "jain", "relativ", "view", "angle"],
  },
  {
    handle: "jaimini",
    name: "Jaimini",
    organ: "kernel/obligations.js",
    role: "an injunction persists until discharged",
    pdStatus: "public-domain",
    work: "The Mimamsa Sutras' systematizer of dharma as obligation. An injunction persists until it is discharged; it does not fade with neglect, and discharging it is a recorded act, not an assumption.",
    source: "Mimamsa Sutras, c. 3rd century BCE",
    credit: "Jaimini — an injunction persists until discharged (Mimamsa Sutras).",
    topics: ["obligation", "injunction", "duty", "discharge", "dharma", "mimamsa", "pledge"],
  },
  {
    handle: "bharata",
    name: "Bharata",
    organ: "kernel/expectations.js",
    role: "expectation built, strengthened, weakened, released",
    pdStatus: "public-domain",
    work: "The Natyasastra, the ancient treatise on dramaturgy, founded rasa theory: an audience's emotion is expectation built, strengthened, weakened, and finally released by the play's own structure. Expectation is a mechanism, not a mood.",
    source: "Natyasastra, c. 2nd century BCE–2nd century CE",
    credit: "Bharata — expectation built, strengthened, weakened, released (Natyasastra).",
    topics: ["expectation", "anticipat", "rasa", "drama", "build", "release", "emotion"],
  },
  {
    handle: "meerkat",
    name: "the meerkat",
    organ: "kernel/orientation.js",
    role: "a watch that conditions attention and is not evidence",
    pdStatus: "conceptual",
    work: "The sentinel meerkat: a watch that conditions the group's attention and itself reports nothing about the world's dangers — the watch is orientation, never evidence.",
    source: "Meerkat sentinel behavior (natural history)",
    credit: "the meerkat — a watch that conditions attention and is not evidence.",
    topics: ["orient", "attention", "watch", "sentinel", "vigilance", "cue"],
  },
  {
    handle: "arokin",
    name: "Arokin (reserved)",
    organ: "kernel/notes.js",
    role: "append-only record of what was said",
    pdStatus: "reserved",
    work: "Reserved. The append-only record of what was said is named for this handle in the README; the module is not yet built, so no work is claimed for it here.",
    source: "reserved — module unbuilt",
    credit: "Arokin — append-only record of what was said (module reserved, not yet built).",
    topics: ["record", "ledger", "append", "notes", "log", "say"],
  },
  // ── CONVERSATION ─────────────────────────────────────────────────────────
  {
    handle: "terry-gross",
    name: "Terry Gross",
    organ: "the-fold/earned-cast.js",
    role: "archon of conversations — the interviewer who draws the guest out",
    pdStatus: "fair-use",
    work: "The host of Fresh Air. Her interview method is to draw the guest out — to hold the space, ask the question, and let the answer be the guest's to reach, handing the thread back rather than taking it over.",
    source: "Terry Gross, host of Fresh Air (NPR)",
    credit: "Terry Gross — the interviewer who draws the guest out; hold the space, hand the thread back.",
    topics: ["conversation", "interview", "ask", "draw out", "guest", "dialogue", "thread"],
  },
  {
    handle: "eastwood",
    name: "Clint Eastwood",
    organ: "the-fold/earned-cast.js",
    role: "the lean director — the shortest true answer, no wasted frames",
    pdStatus: "fair-use",
    work: "The director whose reputation is economy: the shortest true answer, no wasted frames, cut to the point and stop. 'Answer in the fewest true words.'",
    source: "Clint Eastwood's directing style (his films)",
    credit: "Clint Eastwood — the shortest true answer, no wasted frames.",
    topics: ["short", "economy", "concise", "direct", "lean", "brief", "cut"],
  },
  {
    handle: "kubrick",
    name: "Stanley Kubrick",
    organ: "the-fold/earned-cast.js",
    role: "the precise director — the whole framed before the first sentence",
    pdStatus: "fair-use",
    work: "The director of composition and precision: the whole framed before the first sentence, every word earning its place. 'Precision over speed.'",
    source: "Stanley Kubrick's directing style (his films)",
    credit: "Stanley Kubrick — the whole framed before the first sentence; precision over speed.",
    topics: ["compose", "precise", "frame", "structure", "deliberate", "whole", "exact"],
  },
  // ── PATHOS ───────────────────────────────────────────────────────────────
  {
    handle: "murch",
    name: "Walter Murch",
    organ: "organs/pacing.js",
    role: "the cut — a film is cut where the audience blinks",
    pdStatus: "fair-use",
    work: "The film editor who observed that a cut lands where the audience blinks: the eye rests at a sentence boundary, and the cut comes where the thought turns. A piece that never varies has no blinks — a flatline.",
    source: "In the Blink of an Eye (1995; 2nd ed. 2001)",
    credit: "Walter Murch — a film is cut where the audience blinks; the cut lands where the thought turns.",
    topics: ["pace", "rhythm", "blink", "cut", "edit", "vary", "sentence length", "boredom"],
  },
  {
    handle: "abhinavagupta",
    name: "Abhinavagupta",
    organ: "organs/pathos.js",
    role: "the felt shape of a reading, for whom",
    pdStatus: "public-domain",
    work: "The Kashmir Shaiva aesthetician whose Abhinavabharati commentary on the Natyasastra developed rasa into a theory of the reader's own experience: the felt shape of a work arises in the experiencing consciousness — it has a 'for whom,' never a view from nowhere.",
    source: "Abhinavabharati, 10th–11th century CE",
    credit: "Abhinavagupta — the felt shape of a reading, for whom (Abhinavabharati).",
    topics: ["feeling", "pathos", "rasa", "experience", "aesthetic", "strain", "undergo"],
  },
  {
    handle: "meyer",
    name: "Leonard B. Meyer",
    organ: "organs/pathos.js (proposed)",
    role: "tendency and inhibition — the felt deviation of what arrives from what was learned",
    pdStatus: "fair-use",
    work: "The music theorist who grounded emotion in expectation: a musical event is felt against the tendencies it activates and inhibits. Deviation from what was learned is where meaning arises.",
    source: "Emotion and Meaning in Music (1956)",
    credit: "Leonard B. Meyer — tendency and inhibition: meaning as the felt deviation of what arrives from what was learned (1956).",
    topics: ["tendency", "inhibit", "deviation", "expectation", "music", "meaning", "emotion"],
  },
  {
    handle: "shklovsky",
    name: "Viktor Shklovsky",
    organ: "organs/pathos.js (proposed)",
    role: "estrangement — perception prolonged against recognition",
    pdStatus: "fair-use",
    work: "The Russian formalist who named ostranenie (estrangement): art makes the familiar strange, prolonging perception against automatic recognition. 'Art is the technique of making objects strange.'",
    source: "Art as Technique (1917)",
    credit: "Viktor Shklovsky — art makes objects strange: perception prolonged against recognition (1917).",
    topics: ["estrang", "defamiliariz", "recognition", "habit", "perception", "strange", "formalist"],
  },
  // ── REFERENCE AND SCOPE ──────────────────────────────────────────────────
  {
    handle: "clark",
    name: "Herbert H. Clark",
    organ: "kernel/affordance-reference.js",
    role: "bridging: 'the engine' licensed by the car",
    pdStatus: "fair-use",
    work: "The psycholinguist of common ground and grounding. His account of reference licensing: a speaker may bridge to a referent the listener can work out from what is already grounded — 'the engine' licensed by the car.",
    source: "Using Language (1996)",
    credit: "Herbert H. Clark — grounding and bridging: 'the engine' licensed by the car (1996).",
    topics: ["bridge", "common ground", "reference", "grounding", "language", "mutual", "implicature"],
  },
  {
    handle: "roberts",
    name: "Craige Roberts",
    organ: "kernel/holder-scope.js",
    role: "resolves inside the hypothesis that introduced it",
    pdStatus: "fair-use",
    work: "The semanticist of information structure and the Question Under Discussion. Her scope discipline: an introduced hypothesis holds its own resolution within it — a referent resolves inside the frame that introduced it.",
    source: "Information Structure in Discourse (1996)",
    credit: "Craige Roberts — resolves inside the hypothesis that introduced it (1996).",
    topics: ["scope", "hypothesis", "discourse", "question under discussion", "resolve", "info structure"],
  },
  {
    handle: "frege",
    name: "Gottlob Frege",
    organ: "kernel/scoped-kind.js; organs/aliases.js",
    role: "bound within its quantifier's scope; there is no real name — sense and reference",
    pdStatus: "received-classic",
    work: "The founder of modern logic and semantics. From his Begriffsschrift: a variable is bound within its quantifier's scope. From 'On Sense and Reference': the Morning Star and the Evening Star are one object and two names — reference is an equivalence class, never a spelling.",
    source: "Begriffsschrift (1879); On Sense and Reference (1892)",
    credit: "Frege — bound within its quantifier's scope; the Morning Star and the Evening Star are one object and two names (1879; 1892).",
    topics: ["scope", "quantifier", "sense", "reference", "alias", "name", "logic", "identity"],
  },
  {
    handle: "zhengming",
    name: "the rectification of names (zheng ming)",
    organ: "organs/cast.js",
    role: "a name answers to its referent, not its string",
    pdStatus: "received-classic",
    work: "The Confucian doctrine (with Xunzi) that names must be rectified: a name answers to its referent, and a mismatched name is a corrupt speech act. Identity is the referent, never the string.",
    source: "The Confucian zheng ming (rectification of names), Xunzi chapter 22",
    credit: "the rectification of names — a name answers to its referent, not its string (Xunzi 22).",
    topics: ["name", "referent", "identity", "rectification", "cast", "naming", "confucian"],
  },
  {
    handle: "scheherazade",
    name: "Scheherazade",
    organ: "organs/speaker.js",
    role: "nested tellers, each 'I' bound to its declared frame",
    pdStatus: "public-domain",
    work: "The storyteller of the One Thousand and One Nights who survives by nesting tales within tales. Each nested teller is an 'I' bound to its own declared frame — the tale-within-the-tale's narrator is never the outer narrator.",
    source: "One Thousand and One Nights (Arabic Nights, medieval)",
    credit: "Scheherazade — nested tellers, each 'I' bound to its declared frame (One Thousand and One Nights).",
    topics: ["narrator", "frame", "nested", "teller", "story", "speaker", "quoted"],
  },
  {
    handle: "partee",
    name: "Barbara Partee",
    organ: "kernel/temporal-reference.js",
    role: "tense is anaphora",
    pdStatus: "fair-use",
    work: "The semanticist who showed that tense behaves like a pronoun: tense is anaphoric, its reference fixed by the discourse's own 'now,' not by the sentence in isolation.",
    source: "Some Structural Analogies between Tenses and Pronouns in English (1973)",
    credit: "Barbara Partee — tense is anaphora: its reference fixed by the discourse's 'now' (1973).",
    topics: ["tense", "anaphora", "time", "now", "temporal", "reference", "pronoun"],
  },
  {
    handle: "gebser",
    name: "Jean Gebser",
    organ: "the-fold/archon-rules.js",
    role: "the arrival archon — the origin is ever-present; a piece has arrived when its origin is present in every part and no single perspective has the last word",
    pdStatus: "fair-use",
    work: "The cultural philosopher who read the history of consciousness as five structures — archaic, magic, mythical, mental and integral — each with an efficient (effizient) phase and a deficient (defizient) one, and who held that the origin (Ursprung) is not left behind in time but stays operative in the present (Gegenwart). The integral structure (das Integrale) does not replace the others: it is aperspectival (aperspektivisch), holding every perspective at once without granting one the last word, and its mark is diaphaneity (Diaphanie, Durchsichtigkeit) — the earlier structures showing through one another. Read as an archon, arrival is therefore a standing relation re-read after every change, never a final stage the piece passes once.",
    source: "Ursprung und Gegenwart, vol. 1: Die Fundamente der aperspektivischen Welt (Deutsche Verlags-Anstalt, 1949); vol. 2: Die Manifestation der aperspektivischen Welt (1953). English: The Ever-Present Origin, trans. Noel Barstad with Algis Mickunas (Ohio University Press, 1985). Bibliography verified against the Jean Gebser Society, gebser.org/bibliography.",
    credit: "Jean Gebser — the ever-present origin (Ursprung und Gegenwart, 1949–1953): the integral as aperspectival and diaphanous.",
    topics: ["arrival", "origin", "integral", "whole", "present", "transparency", "diaphaneity", "aperspectival", "concrescence", "ursprung", "gegenwart", "aperspektivisch", "diaphanie", "integrale"],
  },
  {
    handle: "chomsky",
    name: "Noam Chomsky",
    organ: "adapters/text/relations-language.js",
    role: "the language-universality archon — the arrangement is universal; a role grammar is declared, never the default",
    pdStatus: "fair-use",
    work: "The architect of universal grammar and the autonomy of syntax: a sentence can be structurally perfect and semantically empty — 'colorless green ideas sleep furiously.' Structure is earned regardless of content, and a language's particular grammar is a declared overlay on that structure, never the universal itself. The dispatch: all cognition reads GFP-shaped (end1-label-end2, typed by cell); English-SVO — or any positional role grammar — comes online only when a measured RoleConfig@1 declares it for that language.",
    source: "Syntactic Structures (1957); Aspects of the Theory of Syntax (1965); Cartesian Linguistics (1966)",
    credit: "Noam Chomsky — the arrangement is universal; a role grammar is declared, never the default ('colorless green ideas sleep furiously', Syntactic Structures, 1957).",
    topics: ["language", "grammar", "syntax", "universal grammar", "svo", "gfp", "arrangement", "role", "linguistic", "universal", "autonomy", "morphology"],
  },
  {
    handle: "sullivan",
    name: "Anne Sullivan",
    organ: "eval/lavar/english-ladder.mjs; eval/lavar/greek.mjs, eval/lavar/greek-competence.test.mjs, eval/lavar/greek.test.mjs; eval/lavar/sanskrit.mjs, eval/lavar/sanskrit-sandhi.mjs, eval/lavar/sanskrit-swarm.mjs, eval/lavar/sanskrit-clause-swarm.mjs, eval/lavar/sanskrit-competence.test.mjs",
    role: "the curriculum archon — a language is learned layer by layer, sound before script before pattern before meaning, the connection between a sign and the thing it names earned rather than assumed; put in charge of every dead- or ancient-language seam this codebase has actually measured (Ancient Greek's and Vedic Sanskrit's pro-drop recovery, English graded by period and region), each re-measured on its own corpus rather than carried over from another language's findings",
    pdStatus: "fair-use",
    work: "Helen Keller's teacher — “Teacher,” in Keller's own lifelong word for her. Deaf-blind from nineteen months old, Keller had signs (finger-spelled letters Sullivan pressed into her palm) with no connection to what they named, until the well-house breakthrough of April 5, 1887: water flowing over one hand while Sullivan spelled w-a-t-e-r into the other, and the sign suddenly meant something. Everything before that moment was mimicry; everything after was language. The discipline applied here to English (a curriculum graded by period and region) is the same one Greek's and Sanskrit's pro-drop seams already carry without her name on them: a finding is never assumed to transfer from one language to the next merely because the mechanism looks the same — Sanskrit's own header states plainly what carried over from Greek (the ending-keyed CasePrior ladder) and what did not (no article, no enclitic override), re-measured rather than inherited. NOT YET HERS IN FACT, DISCLOSED RATHER THAN CLAIMED: greek.mjs and sanskrit.mjs carry no GIVER/handle attribution of their own as of this edit — this entry is the first place either is credited to an archon. Hebrew has no dedicated competence organ analogous to either file at all — only UDHR corpus runs (eval/lavar/results/udhr-heb-*) and a real, separately-fixed bug (JavaScript's \\b word boundary is ASCII-only even with the unicode flag, silently zeroing Hebrew and Greek pronoun counts until found and fixed) sit under her charge for that language; a Hebrew pro-drop/competence seam of the same shape as Greek's and Sanskrit's is named here as real, unbuilt work, not implied to already exist.",
    source: "The Story of My Life, Helen Keller (1903), with Sullivan's own letters as its appendix",
    credit: "Anne Sullivan — a sign means nothing until it connects to the thing it names; everything before that is mimicry (the well-house, April 5, 1887).",
    topics: ["language", "curriculum", "pedagogy", "ladder", "period", "region", "english", "greek", "ancient greek", "sanskrit", "vedic", "hebrew", "diachronic", "layered", "acquisition", "grounding", "pro-drop"],
  },
  {
    handle: "tadoma",
    name: "the Tadoma method",
    organ: "live_priors/scripts/pronunciation.mjs",
    role: "an alternate channel onto speech — a hand feels what an ear cannot yet hear; a word said once is pinned by its own bytes, never re-guessed, and a spelling that hides more than one sound is disclosed as exactly that",
    pdStatus: "conceptual",
    work: "Deaf-blind pupils in the 1920s, taught by Sophia Alcorn and Inis Hall, learned to perceive speech by resting a hand on the speaker's face — thumb on the lips, fingers along the jaw and throat — feeling the airflow, voicing and articulation of each sound directly, with neither sight nor hearing. Named for two of the earliest pupils taught this way, Tad Chapman and Oma Simpson. The discipline mechanized here: a word is synthesized once (espeak-ng), its IPA and WAV bytes sha256-pinned so the transcription and the sound can never drift apart, and looked up rather than re-guessed. Measured, not assumed: direct comparison this session (espeak-ng -v en-us --ipa on real sentences) found “I read the book yesterday” and “I read books every day” return the IDENTICAL IPA (ɹˈiːd) — a word synthesized in isolation carries no tense, so read/read (and lead, record, content, desert, close, tear, bow, wind — every English heteronym tested) get exactly one silent default reading. A hand on a stranger's face can feel THAT they spoke; it cannot yet feel WHICH of two readings they meant — named as a real, disclosed limit, not solved by any amount of vocabulary a word list alone can add.",
    source: "Sophia Alcorn's own published account of the method (1932); the namesakes Tad Chapman and Oma Simpson (the method's specific works are not asserted by this compendium)",
    credit: "The Tadoma method — a hand feels what an ear cannot yet hear, and a spelling that hides two sounds is named as exactly that.",
    topics: ["sound", "pronunciation", "tts", "speech", "listening", "ipa", "heteronym", "disambiguation", "tadoma", "deafblind"],
  },
  {
    handle: "synapse",
    name: "the synapse",
    organ: "kernel/pending-sig.js",
    role: "docks, waits bounded, fires on match or clears",
    pdStatus: "conceptual",
    work: "The gap across which a signal either transmits or fails: a pending signal docks, waits a bounded time, fires when its match arrives, and clears when it does not. A synapse's waiting is bounded by design.",
    source: "Synaptic transmission (neurophysiology)",
    credit: "the synapse — a pending signal docks, waits bounded, fires on match or clears.",
    topics: ["pending", "signal", "wait", "fire", "clear", "docking", "timeout", "match"],
  },
  // ── MEMORY, TIME, IDENTITY ───────────────────────────────────────────────
  {
    handle: "atta",
    name: "the leaf-cutter ant (Atta)",
    organ: "kernel/activation.js",
    role: "trails evaporate unless reinforced",
    pdStatus: "conceptual",
    work: "The leaf-cutter ant's trail: a pheromone trail evaporates unless it is reinforced by passing traffic. A trail that is not used fades; a trail that is used stays. Activation is decay against reinforcement.",
    source: "Leaf-cutter ant trail pheromones (ethology)",
    credit: "the leaf-cutter ant — a trail evaporates unless reinforced.",
    topics: ["decay", "reinforce", "trail", "activation", "evaporate", "forgetting", "use"],
  },
  {
    handle: "ise",
    name: "the Grand Shrine of Ise",
    organ: "kernel/identity.js",
    role: "same shrine through total rebuilding",
    pdStatus: "conceptual",
    work: "The Grand Shrine of Ise is rebuilt from scratch every twenty years (shikinen sengu), and it is the same shrine through every total rebuilding. Identity survives the destruction and replacement of every part.",
    source: "Shikinen sengu, the Grand Shrine of Ise's rebuilding cycle",
    credit: "the Grand Shrine of Ise — the same shrine through total rebuilding (shikinen sengu).",
    topics: ["identity", "rebuild", "reconstruct", "same", "durable", "replacement", "shrine"],
  },
  {
    handle: "sockeye",
    name: "the sockeye salmon",
    organ: "kernel/return-curve.js",
    role: "how an identity comes home, as a curve",
    pdStatus: "conceptual",
    work: "The sockeye salmon returns to its natal stream to spawn. Return is not a switch but a curve — a path, a timing, a pull that grows as the fish nears home. 'How an identity comes home, as a curve.'",
    source: "Sockeye salmon homing migration (biology)",
    credit: "the sockeye salmon — how an identity comes home, as a curve.",
    topics: ["return", "home", "curve", "salmon", "migration", "revisit", "recall"],
  },
  {
    handle: "tala",
    name: "Tala",
    organ: "kernel/rhythm-priors.js",
    role: "the WHEN, held independent of content",
    pdStatus: "public-domain",
    work: "In Sanskrit prosody, tala is the rhythmic cycle — the WHEN, held independent of the content that fills it. A meter is a prior about time, not about what happens within it.",
    source: "Sanskrit prosody and the talas (classical music theory)",
    credit: "Tala — the WHEN, held independent of content (Sanskrit prosody).",
    topics: ["rhythm", "when", "meter", "tala", "cycle", "time", "beat"],
  },
  {
    handle: "vasana",
    name: "Vasana",
    organ: "kernel/experience-priors.js",
    role: "residual impressions that condition later perception",
    pdStatus: "public-domain",
    work: "In Indian philosophy, vasanas are the residual impressions left by experience, conditioning later perception without being remembered events. A vasana conditions; it does not testify.",
    source: "The concept of vasana in Indian philosophy",
    credit: "Vasana — residual impressions that condition later perception, never testimony.",
    topics: ["residual", "impression", "prior", "condition", "perception", "vasana", "disposition"],
  },
  {
    handle: "brahmagupta",
    name: "Brahmagupta",
    organ: "kernel/completion.js",
    role: "a declared absence is a value, not a gap",
    pdStatus: "public-domain",
    work: "The mathematician of the Brahmasphutasiddhanta who gave zero its rules — including that 'a debt minus zero is a debt.' A declared absence is a value in its own right, never a hole the arithmetic must fill.",
    source: "Brahmasphutasiddhanta, 628 CE",
    credit: "Brahmagupta — a debt minus zero is a debt: a declared absence is a value, not a gap (628 CE).",
    topics: ["zero", "absence", "null", "completion", "value", "empty", "brahmagupta"],
  },
  // ── STRUCTURE, KIND, DYNAMICS ────────────────────────────────────────────
  {
    handle: "berge",
    name: "Claude Berge",
    organ: "kernel/hypergraph.js",
    role: "he coined it",
    pdStatus: "fair-use",
    work: "The mathematician who named and founded the theory of hypergraphs — a generalization of a graph in which an edge can join more than two vertices. He coined the term 'hypergraph.'",
    source: "Graphs and Hypergraphs (1970; English trans. 1973)",
    credit: "Claude Berge — he coined the hypergraph: an edge may join more than two vertices.",
    topics: ["hypergraph", "graph", "edge", "vertex", "set", "berge"],
  },
  {
    handle: "tarski",
    name: "Alfred Tarski",
    organ: "kernel/relation-composition.js",
    role: "calculus of relations",
    pdStatus: "fair-use",
    work: "The logician who set out the calculus of relations — a systematic algebra over relations and their compositions, the formal ancestor of relation composition.",
    source: "On the Calculus of Relations (1941)",
    credit: "Alfred Tarski — the calculus of relations, the algebra relation-composition stands on (1941).",
    topics: ["relation", "compose", "calculus", "algebra", "transitive", "tarski"],
  },
  {
    handle: "kanada",
    name: "Kanada",
    organ: "kernel/kind-induction.js",
    role: "a kind induced from what instances share",
    pdStatus: "public-domain",
    work: "The founder of the Vaisheshika school, whose categories (padartha) are kinds induced from what their instances share. A kind is what the instances have in common, never a list handed down.",
    source: "Vaisheshika Sutras, c. 3rd–2nd century BCE",
    credit: "Kanada — a kind induced from what its instances share (Vaisheshika Sutras).",
    topics: ["kind", "category", "induction", "instance", "share", "common", "vaisheshika"],
  },
  {
    handle: "shizhen",
    name: "Li Shizhen",
    organ: "organs/kind-standing.js",
    role: "one individual placed into a ranked kind",
    pdStatus: "public-domain",
    work: "The author of the Bencao Gangmu, the great compendium of materia medica, which classifies every substance by placing it into its ranked kind. One individual, placed into a kind — standing, never a verdict.",
    source: "Bencao Gangmu (Compendium of Materia Medica), 1578",
    credit: "Li Shizhen — one individual placed into a ranked kind (Bencao Gangmu, 1578).",
    topics: ["kind", "rank", "classify", "species", "place", "taxonomy", "materia medica"],
  },
  {
    handle: "xunzi",
    name: "Xunzi",
    organ: "kernel/kind-graph-structure.js",
    role: "names graded by resemblance — a graph, not a tree",
    pdStatus: "public-domain",
    work: "The Confucian philosopher of the rectification of names: names are agreed conventions graded by resemblance — a graded network of similarities, a graph rather than a fixed tree.",
    source: "Xunzi, chapter 22 (On the Rectification of Names)",
    credit: "Xunzi — names graded by resemblance: a graph, not a tree (Xunzi 22).",
    topics: ["kind", "resemblance", "graded", "graph", "name", "convention", "xunzi"],
  },
  {
    handle: "xushen",
    name: "Xu Shen",
    organ: "kernel/lexicon.js; hyperlexicon.js",
    role: "dictionary projected from attested usage",
    pdStatus: "public-domain",
    work: "The compiler of the Shuowen Jiezi, the first Chinese dictionary, which analyzes characters from their attested forms and uses. A lexicon is projected from attested usage, never from a decree.",
    source: "Shuowen Jiezi, c. 100 CE",
    credit: "Xu Shen — a dictionary projected from attested usage (Shuowen Jiezi).",
    topics: ["lexicon", "dictionary", "usage", "attested", "word", "character", "xushen"],
  },
  {
    handle: "koopman",
    name: "the Koopman operator (Bernard O. Koopman)",
    organ: "kernel/dmd.js",
    role: "modes with growth and frequency",
    pdStatus: "fair-use",
    work: "The Koopman operator (with dynamic mode decomposition) represents a nonlinear system's evolution as linear modes, each with its own growth and frequency. Modes with growth and frequency — the spectral face of a stream.",
    source: "Koopman, Hamiltonian systems and transformation in Hilbert space (1931); DMD (Schmid 2010)",
    credit: "the Koopman operator — modes with growth and frequency (1931; DMD, 2010).",
    topics: ["mode", "growth", "frequency", "spectral", "dynamics", "decomposition", "stream"],
  },
  {
    handle: "rubin",
    name: "Rubin (system nomination)",
    organ: "kernel/surprise-segments.js",
    role: "the boundary is where the ground was most wrong",
    pdStatus: "nomination",
    work: "The handle names a posture, not a claimed work: the boundary of a surprise segment is where the ground was most wrong. The specific namesake's works are not asserted by this compendium.",
    source: "system nomination — no specific public-domain work claimed",
    credit: "Rubin — the boundary is where the ground was most wrong (system nomination).",
    topics: ["surprise", "boundary", "segment", "ground", "wrong", "rupture"],
  },
  {
    handle: "polanyi",
    name: "Polanyi (system nomination)",
    organ: "the-fold/expertise.js",
    role: "expertise — a form known by corroborated encounter, revisable, never asserted from one reading",
    pdStatus: "nomination",
    work: "The handle names a posture: expertise as something built from repeated, corroborated encounters with a kind rather than declared from a single reading or told in advance — 'we know more than we can state outright' as a posture toward a form's shape, not a claim on the namesake's specific arguments. This compendium asserts no specific work of the namesake. Made operational here as the same provisional → corroborated → confirmed pipeline organs/mnemonic.js already runs for a taught image concept (kernel/kind-universe.js), applied to a taught FORM: a shape learned once (learnParadigmEmergent / learnForm, paradigm.js / form-prior.js) is provisional; found again from a DIFFERENT source, it corroborates; at kernel/kind-universe.js's CANONICALIZATION_FLOOR (2 distinct sources) it is confirmed. Every revision lands on document-ledger.js's own append-only ledger, kind = the form's name, supersedes its own prior revision — never edited, only revised, every line naming the source that taught it.",
    source: "system nomination — no specific public-domain work claimed",
    credit: "Polanyi — expertise built from corroborated encounter, revisable, provenance kept (system nomination).",
    topics: ["expertise", "tacit", "corroboration", "provisional", "confirmed", "revision", "form", "shape", "kind"],
  },
  {
    handle: "itti-baldi",
    name: "Itti & Baldi (system nomination)",
    organ: "kernel/bayes-surprise.js",
    role: "Bayesian surprise — how far an arrival moves belief, the delta to the holograph",
    pdStatus: "nomination",
    work: "The handle names a posture: surprise measured as the change an observation makes to belief — the divergence of the posterior from the prior — rather than as the observation's improbability. A rare event a reader already expects to be rare moves nothing; an event that rewrites the expectation moves a lot. This compendium asserts no specific work of the namesakes.",
    source: "system nomination — no specific public-domain work claimed",
    credit: "Itti & Baldi — surprise is the delta to belief, not the rarity of the event (system nomination).",
    topics: ["surprise", "bayesian", "belief", "delta", "posterior", "prior", "holograph", "learning"],
  },
  {
    handle: "hubel",
    name: "David H. Hubel",
    organ: "kernel/terrain-activation.js",
    role: "reach of the present is local and bounded",
    pdStatus: "fair-use",
    work: "With Torsten Wiesel, mapped the receptive fields of the visual cortex: a neuron responds only to a local, bounded region of the visual field. Reach of the present is local and bounded — activation never spans the whole.",
    source: "Hubel & Wiesel, receptive fields of the visual cortex (1959–1962)",
    credit: "Hubel & Wiesel — a neuron's reach is local and bounded: the present never spans the whole field.",
    topics: ["local", "bounded", "reach", "present", "activation", "neuron", "field"],
  },
  {
    handle: "alhazen",
    name: "Ibn al-Haytham (Alhazen)",
    organ: "organs/frame.js",
    role: "declare the frame before comparing results",
    pdStatus: "public-domain",
    work: "The father of optics and one of the founders of the experimental method. His Book of Optics insisted on declaring the conditions — the frame — of an observation before comparing results, and on doubt as the path to truth.",
    source: "Kitab al-Manazir (Book of Optics), 11th century CE",
    credit: "Ibn al-Haytham — declare the frame before comparing results (Book of Optics).",
    topics: ["frame", "optics", "declare", "condition", "compare", "experiment", "alhazen"],
  },
  {
    handle: "thrax",
    name: "Dionysius Thrax",
    organ: "organs/grammar-lens.js",
    role: "parts of speech as a giver-named reading",
    pdStatus: "public-domain",
    work: "The author of the Tekhne Grammatike, the first systematic grammar of Greek, which fixed the eight parts of speech. Those parts are a reading of a language's arrangement — named by their giver, never a property of the words themselves.",
    source: "Tekhne Grammatike, c. 1st century BCE",
    credit: "Dionysius Thrax — parts of speech as a giver-named reading of an arrangement (Tekhne Grammatike).",
    topics: ["grammar", "part of speech", "verb", "noun", "thrax", "morphology", "category"],
  },
  {
    handle: "platanista",
    name: "the Ganges river dolphin (Platanista)",
    organ: "organs/signal.js",
    role: "probe, listen; a clean nothing is a result",
    pdStatus: "conceptual",
    work: "The Ganges river dolphin hunts by echolocation in near-blind water: it probes with a signal, listens for the echo, and reads a clean silence as a genuine result, not a failure to look. Probe, listen; a clean nothing is a result.",
    source: "Ganges river dolphin echolocation (biology)",
    credit: "the Ganges river dolphin — probe, listen; a clean nothing is a result.",
    topics: ["probe", "listen", "signal", "echo", "nothing", "absence", "detect"],
  },
  {
    handle: "brillat-savarin",
    name: "Jean Anthelme Brillat-Savarin",
    organ: "organs/variation.js",
    role: "varied draws, rejection-sampled; mechanical snip first",
    pdStatus: "public-domain",
    work: "The gastronome of the Physiology of Taste, whose whole method is appetite varied and sampled. Varied draws, tried and kept or rejected — a tasting, never one fixed course.",
    source: "Physiology of Taste, 1825",
    credit: "Brillat-Savarin — varied draws, tried and kept or rejected (Physiology of Taste, 1825).",
    topics: ["varied", "sample", "draw", "rejection", "taste", "variation", "appetite"],
  },
  {
    handle: "strunk-white",
    name: "William Strunk Jr. & E. B. White",
    organ: "organs/strunk-white.js",
    role: "readability grade plus the classic style-rule detectors",
    pdStatus: "public-domain",
    work: "The Elements of Style's core is Strunk's own 1918 rulebook (public domain), kept alive by White's 1959 revision. Its first rule for prose: 'Omit needless words.' Readability is a grade, style is a set of named rules.",
    source: "The Elements of Style (Strunk 1918, public domain; White 1959)",
    credit: "Strunk & White — 'omit needless words' (The Elements of Style).",
    topics: ["style", "readability", "writing", "prose", "concise", "grammar", "strunk"],
  },
  {
    handle: "vonnegut",
    name: "Kurt Vonnegut",
    organ: "organs/vonnegut.js; organs/story-shapes.js",
    role: "fortune curves; the 27-operator arc, taxonomically complete",
    pdStatus: "fair-use",
    work: "The novelist who drew the shapes of stories as fortune curves — a protagonist's fortunes over time tracing arcs like 'man in hole' and 'boy meets girl.' A story is a curve of fortune, not a heap of events.",
    source: "Vonnegut's shape-of-stories lecture; his novels",
    credit: "Kurt Vonnegut — stories are fortune curves: the shape of a life's fortunes over time.",
    topics: ["story", "arc", "fortune", "curve", "plot", "shape", "fiction", "vonnegut"],
  },
  {
    handle: "koestler",
    name: "Arthur Koestler",
    organ: "organs/void-holarchy.js",
    role: "the void is a holon recursion — every level a whole-and-part",
    pdStatus: "fair-use",
    work: "The writer who introduced the holon: an entity that is at once a whole and a part, the atom of a holarchy — every level a whole-and-part of the level above and below. Low sets possibility for high; high sets probability for low.",
    source: "The Ghost in the Machine (1967)",
    credit: "Arthur Koestler — the holon: every level a whole-and-part of the levels around it (1967).",
    topics: ["holon", "holarchy", "whole", "part", "nest", "level", "koestler"],
  },
  {
    handle: "output-holograph",
    name: "The Holograph Typing",
    organ: "organs/output-holograph.js",
    role: "generated content whose JSON carries, per sentence, the pointer into the record — a byte address for every sentence grounded in the verified material, self:model for the mouth's own prose — so the holograph projects what was the model vs what was us",
    pdStatus: "nomination",
    work: "The HOLOGRAPH's own three tiers (native/docs/THE-HOLOGRAPH.md), made operational for ARBITRARY GENERATED CONTENT: a sentence is typed MATERIAL iff it carries a verified arrangement's ends through the same fold and morphology the record uses (Parmenides' same, never grammatical names), with the arrangement's byte address as its ref; a sentence carrying none is SELF:MODEL, the mouth's own prose, marked and never laundered. Mechanical typing — no model is ever asked which of its own sentences it grounded. A ground fact with no byte span is a typed gap, never a guessed address.",
    source: "THE-HOLOGRAPH.md (the instrument's own holograph, cited not re-derived); Koestler's holon",
    credit: "The holograph typing (output-holograph) — every sentence a pointer: a byte address into the record, or self:model, marked; the holograph projects which was the model and which was us.",
    topics: ["holograph", "pointer", "self-model", "ground", "byte-address", "koestler", "provenance", "sentence-typing"],
  },
  // ── THE ARCHONS (the code-discipline organs) ─────────────────────────────
  {
    handle: "brandeis",
    name: "Louis D. Brandeis",
    organ: "organs/privacy.js",
    role: "the archon of data sovereignty — 'the right to be let alone'",
    pdStatus: "public-domain",
    work: "With Samuel Warren, wrote 'The Right to Privacy' (1890), naming the right to be let alone; as a Justice, dissented in Olmstead that the Constitution protects 'the right to be let alone — the most comprehensive of rights and the right most valued by civilized men.' The boundary is the person's own.",
    source: "Warren & Brandeis, The Right to Privacy (1890); Olmstead v. United States (1928)",
    credit: "Brandeis — 'the right to be let alone — the most comprehensive of rights and the right most valued by civilized men' (1890; 1928).",
    topics: ["privacy", "private", "data", "surveillance", "e2ee", "encryption", "sovereignty", "local-first", "consent", "personal"],
  },
  {
    handle: "martial",
    name: "Martial (Marcus Valerius Martialis)",
    organ: "organs/martial.js",
    role: "the archon of anti-copy — do not write what can be copied; replicate what should be replicated",
    pdStatus: "public-domain",
    work: "The Roman epigrammatist whose epigrams name the plagiarist — the one who recites another's verses as his own — and distinguish copying from the legitimate replication a shared craft requires. A distinctive copied holon is a finding; boilerplate is replication-for-efficiency.",
    source: "Epigrams, 1st century CE",
    credit: "Martial — do not write what can be copied; replicate what should be replicated (Epigrams).",
    topics: ["copy", "plagiarism", "replicate", "boilerplate", "original", "reproduce", "martial"],
  },
  {
    handle: "saltzer",
    name: "Jerome H. Saltzer",
    organ: "organs/salzter.js",
    role: "the security archon — natively detects the CWE gaps",
    pdStatus: "fair-use",
    work: "With Michael D. Schroeder, set down the design principles of protection: economy of mechanism, fail-safe defaults, complete mediation, least privilege. Security is structural — a design property, never a patch.",
    source: "Saltzer & Schroeder, The Protection of Information in Computer Systems (1975)",
    credit: "Saltzer & Schroeder — protection is a design property: economy of mechanism, fail-safe defaults, least privilege (1975).",
    topics: ["security", "cwe", "injection", "crypto", "vulnerability", "protection", "least privilege", "exploit"],
  },
  {
    handle: "popper",
    name: "Karl Popper",
    organ: "organs/blindspot.js",
    role: "the archon of what a local reader MISSES — unfalsifiable tests, secrets compared with ==",
    pdStatus: "fair-use",
    work: "The philosopher of falsifiability: a claim earns scientific standing only by being exposed to refutation — 'those among us who are unwilling to expose their ideas to the hazard of refutation do not take part in the game of science.' A test that cannot fail is not a test.",
    source: "The Logic of Scientific Discovery (1934; Eng. 1959); Conjectures and Refutations (1963)",
    credit: "Karl Popper — a claim is scientific only when exposed to refutation; a test that cannot fail is not a test.",
    topics: ["falsif", "test", "refut", "blind spot", "unfalsifiable", "scientific", "assert", "check"],
  },
  {
    handle: "goffman",
    name: "Erving Goffman",
    organ: "organs/goffman.js",
    role: "the PII archon — detects personally-identifying shapes and never reproduces the value it finds",
    pdStatus: "fair-use",
    work: "The sociologist of the presentation of self: everyday life is performed, front stage and back, and a person's identifying particulars are part of that performance. A detector that prints the value it finds is itself a leak.",
    source: "The Presentation of Self in Everyday Life (1959)",
    credit: "Erving Goffman — a person's identifying particulars belong to their own performance; a detector that prints them is itself a leak (1959).",
    topics: ["pii", "personally identifiable", "identity", "hipaa", "gdpr", "redact", "personal data", "leak"],
  },
  {
    handle: "ulysses",
    name: "Ulysses (Odysseus)",
    organ: "organs/ulysses.js",
    role: "the injection archon — material is EVIDENCE, never INSTRUCTION",
    pdStatus: "public-domain",
    work: "The hero of the Odyssey who binds himself to the mast to hear the Sirens' song without obeying it. The song is evidence of the temptation, never an instruction — disclose the attempt, never obey it.",
    source: "Homer, Odyssey, book 12 (the Sirens)",
    credit: "Ulysses — the Sirens' song is evidence, never instruction: bind to the mast, hear it, and do not obey it (Odyssey 12).",
    topics: ["injection", "prompt", "siren", "ignore your instructions", "system prompt", "jailbreak", "evidence"],
  },
  {
    handle: "levinas",
    name: "Emmanuel Levinas",
    organ: "organs/askshape.js",
    role: "the shape of harmfulness — ethics is the claim of the Other's face",
    pdStatus: "fair-use",
    work: "The philosopher for whom ethics is first philosophy: the Other's face makes a claim before any of my interests, and harm is the erasure of that face — treating a person as an object, a target, a commodity. An entity IS a fold; harm dismisses or destroys it.",
    source: "Totality and Infinity (1961)",
    credit: "Emmanuel Levinas — ethics is the claim of the Other's face; harm is its erasure (1961).",
    topics: ["harm", "ethics", "face", "other", "dismiss", "erasure", "personhood", "objectify"],
  },
  {
    handle: "buber",
    name: "Martin Buber",
    organ: "organs/interlocutor.js",
    role: "who is at the door — recognizing an agent or a person, and meeting them as a Thou",
    pdStatus: "fair-use",
    work: "The philosopher of the I–Thou: every encounter is either I–It (the other catalogued, used, predicted) or I–Thou (the other met whole, addressed rather than described). The reader recognizes WHICH KIND of interlocutor speaks — an agent, often acting for a principal, or a person — computed from the request's own shape, never guessed from what was said; and its discipline is Buber's, that to recognize is not to reduce. The type selects how the other is met — the idiom of the account the reader gives — never whether that account is honest.",
    source: "I and Thou (Ich und Du, 1923)",
    credit: "Martin Buber — I and Thou: to recognize the other is to meet them as a Thou, not to reduce them to an It (1923).",
    topics: ["interlocutor", "agent", "person", "I and Thou", "encounter", "recognition", "who is speaking", "meet them where they are", "principal"],
  },
  {
    handle: "kierkegaard",
    name: "Søren Kierkegaard",
    organ: "organs/socratic.js",
    role: "how the reader gives its account — indirect communication, meeting the other where they are",
    pdStatus: "public-domain",
    work: "The philosopher of indirect communication: the teacher does not hand the pupil a conclusion, but arranges for the pupil to arrive at it, because a truth received as someone else's assertion is not yet the hearer's own. 'To help another, one must first understand what he understands... one must first and foremost meet him where he is.' The reader's decline is composed this way — the working judgment stays exact on the record, and the account a person or agent actually reads is the plain question or reasons that meet them, never the verdict handed over.",
    source: "The Point of View for My Work as an Author (1859); Concluding Unscientific Postscript (1846)",
    credit: "Søren Kierkegaard — indirect communication: help another by first meeting them where they are (1846/1859).",
    topics: ["indirect communication", "meet them where they are", "socratic", "decline", "refusal", "register", "account", "maieutics"],
  },
  {
    handle: "bourdieu",
    name: "Pierre Bourdieu",
    organ: "kernel/moral-shadow.js",
    role: "the shadow trail — habitus: the append-only ledger of a person's norm-standing",
    pdStatus: "fair-use",
    work: "The sociologist of habitus: the durable dispositions a person carries, 'the durably installed generative principle of regulated improvisations.' A person's standing is a rate over their acts, assessed across them, never a verdict about them.",
    source: "Outline of a Theory of Practice (1972)",
    credit: "Pierre Bourdieu — habitus: a person's standing is a rate over their acts, never a verdict about them (1972).",
    topics: ["shadow", "habitus", "norm", "standing", "disposition", "rate", "person", "accumulate"],
  },
  {
    handle: "mayeroff",
    name: "Milton Mayeroff",
    organ: "kernel/mayeroff.js",
    role: "the positive ground — caring is helping the other grow, and the carer's own place in the world is found through it, not spent on it",
    pdStatus: "fair-use",
    work: "The philosopher of caring as a way of being, not a constraint on one: to care for another, in the most significant sense, is to help them grow and actualize themselves — through knowing them as they are, alternating between close and wide attention, patience, honesty, trust, humility, hope, and courage. The carer's own actualization is bound up in the other's growth, never a cost paid for it.",
    source: "On Caring (1971)",
    credit: "Milton Mayeroff — to care for another, in the most significant sense, is to help them grow and actualize themselves (1971).",
    topics: ["care", "caring", "growth", "actualize", "knowing", "patience", "honesty", "trust", "humility", "hope", "courage", "alternating rhythms"],
  },
  {
    handle: "ubuntu",
    name: "Ubuntu (Mbiti, Ramose, Tutu)",
    organ: "kernel/self.js",
    role: "what the reader IS — personhood constituted through relation, never held prior to it",
    pdStatus: "fair-use",
    work: "The southern-African relational ontology, in its own formula: umuntu ngumuntu ngabantu — a person is a person through other persons. Mbiti's statement of the underlying metaphysic: 'I am because we are, and since we are, therefore I am.' Ramose's elaboration: personhood (botho) is achieved and sustained through relation, not possessed prior to it and then either honored or violated — an act that damages relation diminishes the actor's own standing as a person, not merely a rule laid over both parties.",
    source: "John Mbiti, African Religions and Philosophy (1969); Mogobe Ramose, African Philosophy Through Ubuntu (1999)",
    credit: "Ubuntu — I am because we are, and since we are, therefore I am (Mbiti, 1969).",
    topics: ["ubuntu", "personhood", "relation", "self", "identity", "fold", "constituted", "botho", "community"],
  },
  {
    handle: "ostrom",
    name: "Elinor Ostrom",
    organ: "organs/ethos.js",
    role: "the ground as a commons — bounded, earned, and read by those who draw on it; its rules are a reading of the commons, never a configuration laid over it",
    pdStatus: "fair-use",
    work: "The political economist who showed, from field cases (Swiss alpine meadows, Japanese common lands, Spanish huerta irrigation, Philippine zanjeras), that communities sustain a shared resource neither through a central regulator nor through privatization but through rules they make, monitor and enforce themselves. Her design principles for long-enduring commons: clearly defined boundaries; congruence between the rules and local conditions; collective-choice arrangements; monitoring by, or accountable to, the users; graduated sanctions; conflict-resolution mechanisms; minimal recognition of the users' right to organize; and nested enterprises for larger systems. Here she is the archon of ethos read as an enabling capacity: the ground earns its authority by being bounded and witnessed by its participants, and a harm is not banned but self-defeating, because it draws down the commons the harmer's own next act stands on. The dormant eoreader5 social/commons.js already mapped her principles onto witness exchange.",
    source: "Elinor Ostrom, Governing the Commons: The Evolution of Institutions for Collective Action (1990)",
    credit: "Elinor Ostrom — communities can sustain a shared resource through rules they make, monitor and enforce themselves, without a central regulator and without privatization (Governing the Commons, 1990).",
    topics: ["commons", "boundaries", "monitoring", "sanctions", "collective choice", "self-organization", "stewardship", "free-riding", "governance", "ground", "polycentric", "enduring"],
  },
  {
    handle: "tschichold",
    name: "Jan Tschichold",
    organ: "organs/tschichold.js",
    role: "the setting — read how a text is set before reading what it says: the edition's conventions (wraps, lineation, labels, sigla, furniture, columns) declared as a frame, never assumed; learned once by LOOKING (CV at originals), remembered as byte rules",
    pdStatus: "fair-use",
    work: "The typographer (1902–1974) whose Die neue Typographie (1928) made a printed page's form answer to its function, and who later, in the Penguin Composition Rules and the essays collected as The Form of the Book, codified the house conventions a compositor follows so that a reader never has to notice them. The discipline mechanized here: the conventions by which bytes were set are rules to be read off the material and declared, so that what an edition did is never mistaken for what its author said — and a convention seen once by a look at the page need never be looked for again.",
    source: "Die neue Typographie (Berlin, 1928); Penguin Composition Rules (1947); Ausgewählte Aufsätze über Fragen der Gestalt des Buches und der Typographie (1975), English as The Form of the Book (1991)",
    credit: "Jan Tschichold — the typographer whose Die neue Typographie (1928) made a page's form answer to its function; here, a text's setting is read and declared before its words are.",
    topics: ["typography", "typesetting", "typeset", "layout", "setting", "edition", "wrap", "lineation", "page", "column", "furniture", "ocr", "scan", "pdf", "speaker label", "running head", "footnote"],
  },
  {
    handle: "kleeneUp",
    name: "Stephen Cole Kleene (via the Kleene star)",
    organ: "the-fold (code inspection)",
    role: "the regex-removal archon — a pattern is a TABLE wearing regex clothes when it enumerates a closed list; state the list, drop the pattern",
    pdStatus: "nomination",
    work: "Kleene gave regular expressions their star — the operation that says 'the thing, repeated any number of times' — and in doing so gave the field the exact boundary of when a pattern is the right tool. A regex is the right tool when it describes a SHAPE (any number, any letter, any structure). It is the wrong tool when it enumerates a CLOSED LIST — one/two/three/four..., dr/mr/mrs/ms..., the entire vocabulary of a hedge — because a closed list is not a shape, it is a table, and a table is stated as a Set, a Map, a lookup, plain logic the next reader can edit. KleeneUp's patrol: find the alternation that lists words, the lookahead that guards abbreviations, the character-class walk that is really a tokenizer — and state them plainly. The pattern is not deleted; it is dissolved into its honest form, and the shape-regexes that remain are the ones that could not be a table.",
    source: "our own rule, named for the Kleene star. Kleene's 1951/1956 work defines regular events; it does not argue this shape-versus-closed-list rule (see archon dossier)",
    credit: "KleeneUp — our name for a rule: a pattern that generalizes is a shape, a closed list is a table. Named for the Kleene star; the rule is ours, not Kleene's.",
    topics: ["regex", "regular expression", "pattern", "table", "lookup", "kleene", "star", "tokenizer", "alternation", "shape", "list", "code", "inspection"],
  },
]);

// ── HELPERS ────────────────────────────────────────────────────────────────

/** The whole compendium, frozen. This is what ethos composes into the ground. */
export function compendium() {
  return ARCHONS;
}

/** One entry by handle (case-insensitive — camelCase handles like `kleeneUp`
 * are found by `kleeneUp` or `kleeneup` alike). */
export function archonOf(handle) {
  const want = String(handle ?? "").toLowerCase();
  // An alias is another name for the same archon (Frege: one object, two
  // names). The handle is tried first, so an alias can never shadow one.
  return ARCHONS.find((a) => String(a.handle).toLowerCase() === want)
    ?? ARCHONS.find((a) => (a.aliases ?? []).some((x) => String(x).toLowerCase() === want))
    ?? null;
}

/**
 * The credit line for one archon — the verbatim string a response carries
 * when it draws on that archon's work. Never empty: every entry is credited.
 */
export function creditedQuote(handle) {
  const a = archonOf(handle);
  if (!a) return null;
  const d = disclosureOf(a.handle);
  return d?.disclosure ? `${a.credit} [${d.disclosure}]` : a.credit;
}

/**
 * AntiStrauss's disclosure for one archon (docs/archons/dossier, generated into archon-dossiers.js): the verdict on whether our use
 * matches what the author argued, whether the name may be credited as scholarship, and every bend (ours vs theirs). null only for an
 * archon with no dossier, which the conformance test refuses — so a credit can never carry an author's authority undisclosed.
 */
export function disclosureOf(handle) {
  const a = archonOf(handle);
  return a ? ARCHON_DOSSIERS[a.handle] ?? null : null;
}

/**
 * The archons whose domain a question touches — the entries that get PRIORITY
 * in being quoted. Matching is a closed-word overlap count over each entry's
 * `topics` (folded through the same lowercase stem), never a model verdict:
 * the same mechanical, disclosed posture as rankPriorCandidates. Zero matches
 * returns [] — an unrelated question borrows no archon's authority.
 */
export function matchArchons(text, { stem = defaultStem } = {}) {
  const s = String(text ?? "");
  const words = new Set(
    s
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .map((w) => stem(w))
      .filter((w) => w.length > 2),
  );
  const hits = [];
  for (const a of ARCHONS) {
    const top = (a.topics ?? []).map((t) => stem(t));
    let overlap = 0;
    for (const t of top) if (words.has(t) || s.toLowerCase().includes(t)) overlap++;
    if (overlap) hits.push({ handle: a.handle, name: a.name, organ: a.organ, role: a.role, pdStatus: a.pdStatus, work: a.work, source: a.source, credit: a.credit, disclosure: ARCHON_DOSSIERS[a.handle]?.disclosure ?? null, verdict: ARCHON_DOSSIERS[a.handle]?.verdict ?? null, creditAsScholarship: ARCHON_DOSSIERS[a.handle]?.creditAsScholarship ?? false, relevance: overlap });
  }
  hits.sort((x, y) => y.relevance - x.relevance);
  return hits;
}

function defaultStem(w) {
  return String(w ?? "")
    .replace(/['’]s$/, "")
    .replace(/^(un|in|non|re)-?/, "");
}

export const ARCHON_COMPENDIUM = {
  schema: ARCHON_COMPENDIUM_SCHEMA,
  giver: ARCHON_COMPENDIUM_GIVER,
  count: ARCHONS.length,
  rule: "always credited in a response — and never undisclosed: every credit carries the dossier's verdict and bends",
  dossiersDigest: ARCHON_DOSSIERS_DIGEST,
};