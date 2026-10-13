// earned-cast.js — the earned-cast design, wired into the er7 proxy's
// per-turn prompt assembly. Vendored from the-fold's practice module
// (earned-cast-practice.js) at the proxy's native/the-fold seam. PURE, no
// imports of the app: the proxy injects real conversation state and gets
// back only the cued facts for THIS turn.
//
// The mouth never knows it is playing a role: nothing here emits a persona
// name, a role instruction, an apparatus noun, or a covert vocabulary word
// into the model-facing string. The ban below is enforced at the seam.

export const CAST = Object.freeze([
  "kelsen",
  "ranke",
  "freinacht",
  "curtis",
  "barker",
  "oracle",
  "lavar",
  "terry-gross",
  "eastwood",
  "kubrick",
]);

// The firewall's apparatus nouns (P55), so a practice fact that leaks one
// fails the same test the real prompts already run.
export const APPARATUS_NOUNS = Object.freeze([
  "prompt",
  "passage",
  "passages",
  "material",
  "document",
  "documents",
  "source material",
  "search result",
  "search results",
  "retrieved",
  "retrieval",
  "extractable relation",
  "chunk",
  "chunks",
  "citation",
  "citations",
  "this turn",
  "the record",
  "mechanically confirmed",
]);

// The covert vocabulary: words that name the identification machinery a
// person must never be told is running. The instrument helps the person
// identify what a thing IS by its arc — never by saying that it is reading
// phaseposts or trajectories. Banning the words is what forces the plain
// narration.
export const COVERT_TERMS = Object.freeze([
  "phasepost",
  "phaseposts",
  "trajectory",
  "trajectories",
  "trajector",
  "phase",
  "cube",
  "operator",
  "grain",
  "cell",
  "canonical order",
  "helix",
  "act of transformation",
]);

// The canonical order the phaseposts walk — NUL SIG INS SEG CON SYN DEF EVA
// REC, the math-major chain (CUBE.md; the handbook's "only this one
// survives basic consistency checks"). A thing's arc is read off it.
export const PHASE_CHAIN = Object.freeze(["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"]);
const PHASE_RANK = new Map(PHASE_CHAIN.map((p, i) => [p, i]));

export const SPEECH_ACT = Object.freeze([
  "question",
  "assertion",
  "frame-ask",
  "map-ask",
  "escalation",
]);

export const STRAIN = Object.freeze(["report", "standard", "strict"]);
const STRAIN_RANK = new Map(STRAIN.map((s, i) => [s, i]));

// ── the trigger ladder: what the turn's own shape selects ────────────────

const HAS = (re) => (text) => re.test(String(text ?? "").toLowerCase());

const FRAME_ASK = /\b(so what|big picture|what does it all mean|what does this mean|paradigm|frame\b|worldview|narrative|story we)\b/;
const MAP_ASK = /\b(how (do|does) (these|this|they).*(fit|relate|connect)|framework|meta|bigger picture|hold.*together)\b/;
const ESCALATE = /\b(prove it|really\?|are you sure|that can't be|wait|check that|actually)\b/;
// ASSERT — a first-person declarative claim about the person or the world:
// the belief verbs ("I'm sure / I think / I believe / I know"), the
// predicated "X is Y" constructions, AND the personal predicates a theory of
// mind must capture ("I'm allergic to peanuts", "my favorite color is teal",
// "I have a dog named Scout", "I'm training for a half marathon"). A
// question ("am I allergic?", "do I like X?") never matches — the "?" fallback
// below catches it. This is the extraction the durable speaker-model's
// theory of mind stands on; a personal fact that is never classified as an
// assertion never reaches the durable model (measured: D1 of the rubric).
const ASSERT = /\b(i('m| am)? (pretty sure|sure|think|believe|know|convinced)|i assert|i maintain)\b|\b(i'?m|i am)\s+(?:allergic to|into|fond of|afraid of|trying to|planning to|training for|moving to|learning to|starting to)\b|\b(i (?:have|'ve got) a\s+(?:dog|cat|bird|pet|allergy)|i(?:'m| am)\s+training for)\b|\b(my\s+(?:\w+\s+)?(?:favorite|favourite|name|color|colour|dog|cat|hobby)\s+(?:is|are))\b|\b(is|are|was|were) (not |the |a |an )?\w+ and\b/i;

export function classifySpeech(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (HAS(ESCALATE)(t)) return "escalation";
  if (HAS(FRAME_ASK)(t)) return "frame-ask";
  if (HAS(MAP_ASK)(t)) return "map-ask";
  if (HAS(ASSERT)(t)) return "assertion";
  if (/\?\s*$/.test(t)) return "question";
  return "question";
}

// ── the trust ladder: which attentions are cleared to run solo ───────────

// In the real system this is the autonomy spiral (checked → sampled →
// cleared, clearance earned across two texts). Here it is a declared field
// on the state, so the tests can exercise the labeling. Layer B organs
// (kelsen, ranke) are built and wired, so they start cleared; the proposed
// ones (curtis, barker) and the built-but-unwired door (freinacht) start
// checked and must earn clearance.
const DEFAULT_TRUST = Object.freeze({
  kelsen: "cleared",
  ranke: "cleared",
  oracle: "cleared",
  freinacht: "checked",
  curtis: "checked",
  barker: "checked",
  lavar: "sampled",
  "terry-gross": "cleared",
  eastwood: "cleared",
  kubrick: "cleared",
  trajectory: "checked",
});

export function trustOf(state, name) {
  const t = state.trust?.[name] ?? DEFAULT_TRUST[name] ?? "checked";
  return t;
}

// ── the trigger ladder, second half: eligible attentions ─────────────────

export function eligibleAttentions({ act, state = {}, depth = 1 } = {}) {
  const set = new Set();
  const push = (n) => {
    set.add(trustOf(state, n) === "cleared" ? n : `${n}:checked`);
  };
  switch (act) {
    case "assertion":
      push("freinacht");
      push("kelsen");
      push("ranke");
      break;
    case "escalation":
      push("kelsen");
      push("ranke");
      push("freinacht");
      break;
    case "frame-ask":
      push("kelsen");
      if (state.settled) push("curtis");
      break;
    case "map-ask":
      push("barker");
      push("kelsen");
      if (state.settled) push("curtis");
      break;
    case "question":
    default:
      push("kelsen");
      push("ranke");
      break;
  }
  // THE ARCHON OF CONVERSATIONS — Terry Gross: the interviewer who draws the
  // guest out. Every conversation turn is hers to shape: the person is the
  // guest, the answer is theirs to arrive at, and the machine holds the space
  // rather than filling it. She cues on every conversational act — a question,
  // an assertion, an escalation, a frame/map ask — the moments where a reply
  // could either hand the thread back or take it over.
  if (["question", "assertion", "escalation", "frame-ask", "map-ask"].includes(act)) push("terry-gross");
  // THE DIRECTORS DUEL OVER THE SHOT — Eastwood and Kubrick shoot the same
  // scene two very different ways. Eastwood's take is economy: the shortest
  // true answer, no wasted frames, cut to the point and stop. Kubrick's take
  // is composition: the whole framed before the first sentence, every word
  // earning its place, precision over speed. The duel resolves by the scene:
  // a big-picture ask (frame/map) is Kubrick's — composition is his; a tight
  // exchange (escalation, a direct question) is Eastwood's — economy is his;
  // and an assertion holds the tension, both firing, because a position
  // deserves an answer that is BOTH lean and deliberate.
  if (["frame-ask", "map-ask"].includes(act)) push("kubrick");
  else if (["escalation"].includes(act)) push("eastwood");
  else if (act === "question") push("eastwood");
  else { push("eastwood"); push("kubrick"); }
  if (state.contradictions?.length && depth > 0) push("freinacht");
  if (state.settled && depth > 1) push("curtis");
  // The trajectory lens fires when the conversation is about a thing whose
  // arc is on the record — the person is trying to identify what it IS.
  // `thing` present (even with an empty history — "nothing has happened to
  // it yet" is itself the identification) and the person asking about it.
  if (state.thing && state.askArc) push("trajectory");
  // THE GROUND ATTENTION: fires only when the proxy has already run the
  // ground-selector (the-fold/ground-selector.js) against this turn's real
  // material, matched it to an archon-shaped criterion (organs/archon-
  // compendium.js::matchArchons), and had that pick survive Nagarjuna's
  // veto (kernel/refutation.js) — `state.groundFact` is the ONE surviving
  // sentence, computed entirely outside this file (this file stays PURE,
  // per its own header: no imports of the app). A pick that refused,
  // co-held, or was vetoed never sets `groundFact`, so this attention is
  // silent exactly as often as the selector itself is silent.
  if (state.groundFact) push("ground");
  return [...set];
}

// ── the strain ladder: the strictness the record has earned ──────────────

export function strainOf(state = {}) {
  const { contested = [], contradictions = [], cycles = 0, expired = [] } = state;
  if (cycles > 0 || state.unlicensed) return "strict";
  if (contested.length > 0 || contradictions.length > 0 || expired.length > 0) return "standard";
  return "report";
}

// ── the trajectory lens: what a thing IS, read off where it has been ─────

// The instrument helps the person identify what the thing under discussion
// IS by its arc — the ordered acts it has undergone. It never says it is
// reading phaseposts or trajectories; the facts are plain narration and the
// identification is a proposal the person can ratify or correct.

export function trajectoryOf(history = []) {
  return history.map((h) => ({ op: String(h.op ?? "").toUpperCase(), grain: h.grain ?? "Figure" }));
}

export function currentPhasepost(history = []) {
  const t = trajectoryOf(history).at(-1);
  return t?.op ? `${t.op}·${t.grain}` : null;
}

export function trajectoryShape(history = []) {
  const t = trajectoryOf(history);
  const ops = t.map((x) => x.op);
  if (!ops.length) return "unborn";
  const saw = new Set();
  for (const op of ops) {
    if (saw.has(op)) return "circling";
    saw.add(op);
  }
  // What the thing IS is read off where it is NOW, with the arc as context:
  // the last phasepost carries the identity.
  const last = ops.at(-1);
  if (last === "REC") return "rezeroed";
  if (last === "SYN") return "established";
  if (last === "CON") return "contested";
  if (last === "EVA") return "weighed";
  if (last === "INS") return "born";
  return "marked";
}

export function trajectoryFacts(history = []) {
  switch (trajectoryShape(history)) {
    case "unborn": return ["nothing has happened to it yet."];
    case "born": return ["this began as a single statement."];
    case "contested": return ["it began, was checked against an account, and is now disputed — not settled."];
    case "established": return ["it began, was checked, and is stated in more than one place."];
    case "rezeroed": return ["it began, then started over from a new ground."];
    case "circling": return ["it keeps returning to where it began."];
    case "weighed": return ["it began and was weighed; nothing has settled it."];
    default: return ["this began as a single statement."];
  }
}

const IDENTITY_BY_ARC = Object.freeze({
  unborn: "nothing, yet",
  born: "a fresh claim",
  contested: "an unsettled claim",
  established: "an established claim",
  rezeroed: "a claim started over",
  circling: "a claim that argues in a loop",
  weighed: "a claim under evaluation",
  marked: "a claim",
});

export function identifyByArc(history = []) {
  return IDENTITY_BY_ARC[trajectoryShape(history)] ?? "a claim";
}

// ── the truth ladder, made visible: object-level facts ───────────────────

// ── THE ARCHON OF CONVERSATIONS: Terry Gross, keeper of the flow rules ────
// Her domain is HOW THE FLOWS GO — the rules of the conversational journey,
// not any one answer. The rules below are the ones she REMEMBERS: a trigger
// summons them (she writes them up), and Marshall (the chorus's meta lens)
// integrates them into the law files (POLICIES.md / READING-SPEC) with
// citations and a Generality line. Each rule names the code that enforces it,
// so the write-up is a walk of the enforcement, never an invention.
export const CONVERSATION_FLOW_RULES = Object.freeze([
  {
    rule: "the oracle is not a teacher",
    meaning: "an answer that arrives effortlessly teaches helplessness; answers carry their standing and the machine refuses to do the thinking for the person.",
    enforced: ["NEUTRAL_CHARACTER", "earnedCue", "chatVoidCheck", "surfVoidInfo"],
  },
  {
    rule: "hyper-grounded by default, on every surface",
    meaning: "the chat turn, the proxy, and the composing doors are all linted the same way; Kelsen (the precedence order) and Ranke (the citation chase) are the primary modality.",
    enforced: ["kelsenGrade", "surf", "grounding", "surfVoidInfo"],
  },
  {
    rule: "a gap is a result",
    meaning: "I don't know, the material does not say, and I didn't look are three different answers and never render alike.",
    enforced: ["surfVoidInfo", "earnedCue", "chatVoidCheck"],
  },
  {
    rule: "every answer is a void defined and satisfied",
    meaning: "the shape of what the answer must satisfy is DEF'd first, and the answer fills it — a chat answer fills a small void in one draw; long-form is entered, never assumed.",
    enforced: ["voidCellsFor", "detectAnswerShape", "chatVoidCheck", "satisfaction"],
  },
  {
    rule: "the journey, covert",
    meaning: "personas respond without the person being told a persona is speaking; the conversation is a progression the person is drawn through, never a role the machine declares.",
    enforced: ["eligibleAttentions", "assembleFacts", "bannedHits"],
  },
  {
    rule: "theory of mind, held across sessions",
    meaning: "what the person has asserted and its standing is the machine's durable memory of them — type-level, fed back, never a stranger's.",
    enforced: ["speaker-model", "durableFacts", "updateSpeakerModel"],
  },
  {
    rule: "the refusal is warm",
    meaning: "the machine withholds in the right key — with the shape of the work on the far side of the withholding, never as another failure.",
    enforced: ["NEUTRAL_CHARACTER", "earnedCue"],
  },
  {
    rule: "long-form is a mode, not the identity",
    meaning: "the proxy is a normal conversation first; projection is an artifact entered on an explicit ask, and the void is filled at the grain the ask earned.",
    enforced: ["normalizeMode", "detectAnswerShape", "runProxyTurn"],
  },
]);

// The write-up the future trigger produces: the archon's remembered rules, in
// the shape Marshall integrates (each rule with its meaning and the code that
// enforces it).
export function archonRules() {
  return {
    archon: "terry-gross",
    title: "Archon of Conversations",
    domain: "how the conversational flows go",
    rules: CONVERSATION_FLOW_RULES.map((r) => ({ ...r })),
  };
}

const q = (s) => String(s ?? "");
const personOf = (s) => q(s.person ?? "you");

export function assembleFacts({ act, state = {}, eligible = [] }) {
  const facts = [];
  const has = (n) => eligible.some((e) => e === n || e.startsWith(`${n}:`));

  if (has("ranke")) {
    for (const i of state.indexOnly ?? []) {
      facts.push({ from: "ranke", text: `the only support for this is a page that points elsewhere rather than stating it itself.` });
    }
    if ((state.indexOnly?.length ?? 0) === 0 && (state.leads?.length ?? 0) > 0) {
      facts.push({ from: "ranke", text: `a page that comes closest is named and can be chased.` });
    }
  }

  if (has("kelsen")) {
    for (const c of state.contested ?? []) {
      facts.push({ from: "kelsen", text: `this is disputed — not settled.` });
    }
    for (const e of state.expired ?? []) {
      facts.push({ from: "kelsen", text: `this is no longer in force.` });
    }
    for (const s of state.singleWitness ?? []) {
      facts.push({ from: "kelsen", text: `stated once so far.` });
    }
    for (const c of state.contradictions ?? []) {
      facts.push({ from: "kelsen", text: `what you're asserting now is the opposite of that, on its face.` });
    }
    if ((state.gaps?.length ?? 0) > 0) {
      for (const g of state.gaps) {
        facts.push({ from: "kelsen", text: `what would settle this: ${g}.` });
      }
    }
  }

  if (has("freinacht")) {
    for (const p of state.personClaims ?? []) {
      facts.push({ from: "freinacht", text: `${personOf(state)} said this earlier: "${p}".` });
    }
    for (const s of state.notEstablished ?? []) {
      facts.push({ from: "freinacht", text: `nothing states this directly; it is not established by what ${personOf(state)} were given.` });
    }
  }

  if (has("curtis")) {
    for (const f of state.frameLines ?? []) {
      facts.push({ from: "curtis", text: `together these still do not say what you're asking; what they compose is: ${f}.` });
    }
  }

  if (has("barker")) {
    for (const m of state.mapLines ?? []) {
      facts.push({ from: "barker", text: `how the pieces fit together: ${m}.` });
    }
  }

  // THE GROUND ATTENTION's fact — already assembled, already firewall-
  // shaped prose (ground-attention.js's own GROUND_FACT table), passed
  // through state rather than recomputed here so this file never imports
  // the ground-selector, the compendium, or Nagarjuna directly.
  if (has("ground") && state.groundFact) {
    facts.push({ from: "ground", text: String(state.groundFact) });
  }

  if (has("trajectory") && state.thing) {
    const arc = trajectoryFacts(state.thing.history ?? []);
    for (const a of arc) facts.push({ from: "trajectory", text: a });
    facts.push({
      from: "trajectory",
      text: `that is the shape of ${identifyByArc(state.thing.history ?? [])} — say so if you see it that way, or correct me.`,
    });
  }

// THE ARCHON OF CONVERSATIONS — Terry Gross, the interviewer who draws the
  // guest out. Her facts are about the CONVERSATION's own standing: the
  // person is the guest, the thread is theirs, and the reply either hands it
  // back or takes it over. Object-level, covert (never "Terry Gross", never a
  // role line) — the mouth is never told a persona is speaking.
  if (has("terry-gross")) {
    // THE FELT SHAPE (Abhinavagupta, wired 2026-09-17): Terry Gross reads the
    // conversation's own rhythm and strain as measured by the pathos organ.
    // A flatline — no blink, no cut — means the exchange has gone flat, and
    // her job is to draw the guest back out; strain at strict means the
    // record is contested, and she holds the claim to its ground rather than
    // smoothing the disagreement away. Object-level and covert, exactly like
    // every other fact she emits.
    // TRAJECTORY BOREDOM ("boring is itself a surprise to avoid", user,
    // 2026-09-17): checked FIRST — it is a stronger, multi-turn signal than
    // pacing.js's single-text flatline below, measured by document-ledger's
    // own Fisher permutation test over the assistant's actual turns, not a
    // heuristic about one text's sentence rhythm. The fact stated is exactly
    // what was measured — a fact, never an instruction to "be creative".
    if (state.felt?.trajectoryBored) {
      facts.push({ from: "terry-gross", text: `${state.felt.trajectoryBasis}.` });
    } else if (state.felt?.flatline) {
      facts.push({ from: "terry-gross", text: `the exchange has gone flat — no turn has changed the conversation; draw the guest back out with a genuine question of your own rather than ending the thread.` });
    } else if (state.felt?.strain === "strict") {
      facts.push({ from: "terry-gross", text: `the record is contested — hold the claim to its ground and let the person carry it further; do not smooth the disagreement away.` });
    } else if (act === "question") {
      facts.push({ from: "terry-gross", text: `the person asked something — the answer is theirs to reach, so reply plainly and hand the thread back rather than taking it over.` });
    } else if (act === "escalation") {
      facts.push({ from: "terry-gross", text: `the person pushed back; this is where the conversation tightens — hold the claim to its ground, do not smooth the disagreement away.` });
    } else if (act === "assertion") {
      facts.push({ from: "terry-gross", text: `the person has taken a position; give it the standing it earned and let them carry it further rather than answering for them.` });
    } else {
      facts.push({ from: "terry-gross", text: `the conversation has a shape; the person is the one being drawn out, so leave room for their own next step.` });
    }
  }

  // THE DIRECTORS — Eastwood and Kubrick shoot the shot. Both covert, both
  // object-level facts about the DELIVERY, never a name or a role line.
  // Eastwood: economy — the fewest true words, no wasted frames.
  // Kubrick: composition — the whole framed before the first sentence.
  if (has("eastwood")) {
    if (act === "escalation") {
      facts.push({ from: "eastwood", text: `when challenged, answer in a few frames — name the ground the claim stands on, hold it, and stop. Do not relitigate.` });
    } else if (act === "question") {
      facts.push({ from: "eastwood", text: `answer in the fewest true words — cut to what is established and stop; no preamble, no padding.` });
    } else {
      facts.push({ from: "eastwood", text: `the reply should be as short as it can be and no shorter — every word earns its place.` });
    }
  }
  if (has("kubrick")) {
    if (["frame-ask", "map-ask"].includes(act)) {
      facts.push({ from: "kubrick", text: `the whole should be framed before the first sentence — lay it out exactly, each part in its place, nothing blurred.` });
    } else if (act === "question") {
      facts.push({ from: "kubrick", text: `answer deliberately — frame the whole before the first sentence; precision over speed.` });
    } else {
      facts.push({ from: "kubrick", text: `treat the reply as a scene to be composed — deliberate, structured, exact, every word considered.` });
    }
  }

  return facts;
}

// ── the disclosure ladder: the cue bundle for the mouth ──────────────────

export function cueBundle({ act, state = {}, depth = 1 } = {}) {
  const eligible = eligibleAttentions({ act, state, depth });
  const strain = strainOf(state);
  const facts = assembleFacts({ act, state, eligible });
  return {
    act,
    strain,
    eligible,
    facts,
    mouth: facts.map((f) => f.text).join(" "),
  };
}

// ── the identity ban: no cast name, no apparatus noun, reaches the mouth ─

export function bannedHits(text) {
  const s = String(text ?? "").toLowerCase();
  const hits = [];
  for (const c of CAST) {
    if (new RegExp(`\\b${c}\\b`).test(s)) hits.push(`cast:${c}`);
  }
  for (const n of APPARATUS_NOUNS) {
    if (new RegExp(`\\b${n}\\b`, "i").test(s)) hits.push(`apparatus:${n}`);
  }
  for (const c of COVERT_TERMS) {
    if (new RegExp(`\\b${c}\\b`, "i").test(s)) hits.push(`covert:${c}`);
  }
  return hits;
}

export const enforceBan = (bundle) => bannedHits(bundle.mouth);