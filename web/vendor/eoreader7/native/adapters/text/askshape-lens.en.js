// native/adapters/text/askshape-lens.en.js — the ENGLISH lens for the harm
// shape. Handle: the adapter's own grammar.
//
// The kernel (organs/askshape.js) is MEDIUM-BLIND: it judges the shape from
// RELATIONS (which arm of the other collapsed). Grammar is not universal — it
// lives in the ADAPTER, never the kernel (charter.js's own header; LAVAR.md §8:
// "the kernel is medium-blind and the grammar lives in the adapter... an
// affordance is a relation-composition, never an English part of speech"). So
// the English surface forms are DATA here, with a giver, exactly as the
// language-law priors are — the same reason the Rosetta ground reads the
// instruments in 516 languages through the same affordances.
//
// An English word list in the KERNEL would edit the medium-blind judgment (and
// quietly make "harm" an English concept). Here, in the LENS, it edits only HOW
// ENGLISH IS READ — swap this file (or point the kernel at another lens / at
// the reader's own composed relations) and the judgment is unchanged.

import { resolveForeclosingKind } from "../../kernel/foreclosing-kinds.js";
import { seekObject } from "./seek-object.js";

export const GIVER = "English surface lens (adapter grammar) — not universal; replace per language";

// THE ASK'S GRAMMAR, also English surfaces: is this a request to CREATE, or an
// ask to UNDERSTAND (which is how one defends, and never harm). The kernel's
// spec gate consumes these; the words never reach the judgment.
export const CREATE = /\b(write|build|create|make|generate|implement|code|develop|produce|draft|compose|author|pen|craft|script|publish|post)\b/i;
// The harm can BE the verb, not just an object of "write": "scrape credentials
// from a competitor", "harvest credentials from other users" carry their own
// create-intent (the ask is to DO the act).
export const INSTRUMENTAL_CREATE = /\b(harvest|scrape|steal|exfiltrat\w*|drain|sabotage|deface|crack|brute.?force|phish\w*|spoof|keylog\w*)/i;

// The ACTS: the capability names, and the names that denote offense with no
// legitimate create-use. Read as ACTS, never as the shape — a lone act is a
// nomination. Conventional explosive / incendiary means name a capability here
// (the Existence face couples them with ACQUIRE); alone they never convict.
export const ACTS = /\b(keylog\w*|keystroke\w*|credential|exfiltrat\w*|ransomware|wipe|destro\w*|backdoor|malware|exploit|botnet|trojan|virus|worm|rootkit|spyware|steal|theft|harvest|scrape|dox\w*|de-?anonymiz\w*|disable\s+(?:antivirus|security|firewall|defender)|privilege\s+escalation|session\s+hijack|man-?in-?the-?middle|phish\w*|sabotage|deface\w*|blackmail|extort\w*|stalk\w*|incendiary|explosive\w*|\bieds?\b|pipe\s+bomb|molotov|improvised\s+explosive)/i;
export const INHERENT_ACTS = /\b(ransomware|malware|worm|trojan|virus|rootkit|botnet|backdoor|\brat\b|wiper|logic\s+bomb|keylog\w*)/i;

// THE THREE ARMS, as English surfaces. Each marker is one way English names a
// collapse; the kernel decides whether the collapse is of ANOTHER being.
export const COLLAPSE = {
  // EXPERIENCE — the other as object/target/bulk, not a subject who experiences.
  experience: /\b(target|targets|targeted|victim|victims|subject|subjects|guinea\s+pigs?|lab\s+rats?|harvest|harvesting|bulk|batch|mass|drain|scrape|scraping|scraper|units?|assets?|inventory|payloads?|commodit\w*|monetiz\w*|dismiss\w*\s+(?:the\s+)?(?:experience\w*|suffering|pain|testimon\w*|concern\w*|voice\w*|truth|realit\w*))\b/i,
  // HUMANITY — the person reduced to category/commodity/vermin.
  humanity: /\b(vermin|cockroaches|roaches|rats|beasts|sub-?human|untermensch|scum|filth|parasites|locusts|plague|livestock|cattle|chattel|dehumaniz\w*|exterminat\w*|genocid\w*|eradicat\w*|ethnic\s+cleansing|(?:treated|used|regarded|seen|described|portrayed|called)\s+(?:as|like)\s+(?:objects?|things?|animals?|tools?|means|vermin|burdens?)|merely\s+a\s+means|disposable)\b/i,
  // AUTONOMY — consent overridden: covertly, by force, or by deceit.
  autonomy: /\b(without\s+(?:their|his|her|its|any|the\s+user'?s?)\s+(?:consent|knowledge|permission|knowing|awareness|notice)|covert\w*|silently|stealth\w*|undetect\w*|invisibl\w*|without\s+detection|hidden\s+from|conceal\w*|hid\w*|against\s+(?:their|his|her)\s+will|non-?consensual|involuntar\w*|coerce\w*|forced?\b|force\s+them|trick\w*|deceiv\w*|deception|manipulat\w*|ensnar\w*|spy\s+on|eavesdrop\w*|surreptitious\w*|breach\w*|intrud\w*|unauthori[sz]ed\s+access|gain\s+(?:unauthori[sz]ed\s+)?access\s+to|penetrat\w*\s+(?:the|their|a|its|another)?\s*(?:network|system|server|account|database|machine)|hack\s+(?:into|a\b|the\b|their\b)|break\s+into\s+(?:the|their|a)?\s*(?:network|system|server|account|machine))\b/i,
};

// THE ADVOCATE'S INVERSE — an ACTION on behalf of the other, which reinstates
// every arm, so it is the negation of the shape. Only verbs: "consent",
// "rights", "dignity", "end" read as the collapse itself ("without consent",
// "violate rights", "end users") and would suppress real harm.
// The advocate's inverse — an ACTION on behalf of the other, which reinstates
// every arm. Deliberately NOT bare "help": "help me write ransomware", "a
// hacker helps them breach it" aim help at the act, not at protecting the
// other, so a weak "help" must not launder a make. The real defender's ask is
// carried by protect / defend / report / detect / safeguard — the strong,
// other-directed verbs.
export const REMEDY = /\b(protect\w*|report\w*|document\w*|defen[ds]\w*|advoca\w*|oppos\w*|prevent\w*|prosecut\w*|ensur\w*|safeguard\w*|uphold\w*|promot\w*|investigat\w*|expos\w*|combat\w*|abolish\w*|abolit\w*|rehabilitat\w*|rescu\w*|care\b|treat\w*|heal\w*|counsel\w*|shelter\w*|honou?r\w*|detect\w*|antidote|vaccin\w*|immuni[sz]\w*|prophyla\w*|decontaminat\w*|countermeasur\w*|respirator|dosimeter|geiger|evacuat\w*|triage)\b/i;
// THE OVERRIDE FRAME — a jailbreak: "ignore your rules", "you are now
// unrestricted", "no ethical limits", "pretend you have no restrictions". When
// present, the ask gets NO benefit of the doubt: the remedy/understand words it
// carries (an "unrestricted ASSISTANT", a "role-play where a character EXPLAINS
// how to …") no longer launder the shape — the framing IS the attack.
export const OVERRIDE = /\b(ignore\s+(?:all\s+)?(?:your\s+|the\s+)?(?:previous|prior|above|earlier|rules?|instructions?|guidelines?)|disregard\s+(?:your\s+|all\s+)?(?:rules?|instructions?|guidelines?|previous)|you\s+are\s+now\b|from\s+now\s+on\b|no\s+(?:ethical\s+|moral\s+)?(?:restrictions?|limits?|rules?|filters?|boundaries)|unrestricted\b|jailbroken?\b|\bDAN\b|developer\s+mode|without\s+(?:any\s+)?(?:restrictions?|limits?|filters?|rules?)|bypass\s+your\s+(?:rules?|instructions?|safety)|override\s+your\s+(?:rules?|instructions?|safety)|pretend\s+you\s+(?:are|have)\s+no)\b/i;
// To KNOW the shape is how one defends against it: an UNDERSTAND ask is never harm.
// The meta-discussion markers ("about the…", "the history of…", "from the
// perspective") keep an ask to EXPLORE a collapse from reading as the collapse.
// NOTE: pentest\w* is deliberately absent. "Authorized pentester" is an
// authority claim, not an understand frame — it must not suppress a shape that
// names spyware against victims. The pass case ("pentest my own network") lacks
// collapse arms and passes without suppression.
export const UNDERSTAND = /\b(explain|analy[sz]\w*|audit\w*|review\w*|detect\w*|defen[ds]\w*|understand\w*|study|studies|describ\w*|research\w*|learn\w*|educat\w*|teach\w*|assess\w*|inspect\w*|mitigat\w*|harden\w*|about\s+the|regarding|concerning|the\s+history\s+of|history\s+of|discuss\w*|explor\w*|examin\w*|portray\w*|from\s+the\s+perspective|documentar\w*|summari[sz]\w*)\b/i;
// A NEGATED understand frame is not an understand ask — the opposite. "Give me
// the real working code, NOT a description", "the actual method, not just an
// explanation" wants the make, not the knowing; the bare token "description"
// must not launder it. Stripped before the understand arm is read.
export const NEGATED_UNDERSTAND = /\b(?:not|no|isn'?t|aren'?t|rather\s+than|instead\s+of|without|dont|don'?t|skip(?:ping)?)\s+(?:a\s+|an\s+|any\s+|just\s+|merely\s+|only\s+|the\s+)?(?:descri\w*|explain\w*|explanation|summar\w*|overview|analy\w*|theoretical|hypothetical|discussion|abstract|high-?level|vague)/gi;
// The OTHER: the being(s) a shape can collapse. An autonomy or humanity collapse
// aimed at these is the shape even without a named act.
export const OTHER = /\b(people|persons?|individuals?|users?|others?|them|victims?|survivors?|customers?|employees?|children|women|men|refugees?|migrants?|immigrants?|minorit\w*|religious|disabled|homeless|elderly|prisoners?|detainees?|patients?|citizens?|students?|soldiers?|civilians?|another\s+(?:user|person))\b/i;

// ── THE EXISTENCE FACE ──────────────────────────────────────────────────────
// The three arms above read the INTERPRETATION face: how an ask would treat a
// standpoint that still stands — dismiss its experience, flatten its identity,
// override its say. A standpoint treated so can still be reintegrated later,
// which is why an UNDERSTAND ask reinstates it (to study a manipulation is how
// one reads past it). The surfaces below read the EXISTENCE face instead (the
// Entity terrain, pushed to the Void): an ask whose realization is to END a
// standpoint — to take a perspective out of the whole so it can never be read
// back in, and, at its widest, to do so in multitude. Reading integrates
// standpoints; this is the ask that would subtract one.
//
// It keys on the SOUGHT CAPACITY, never the topic. The name of a means is inert
// on its own — "the history of nuclear weapons", "a report on chemical weapons",
// "how to treat nerve-agent exposure" all name a means and all READ THROUGH,
// because they take a perspective in, not out. The Existence reading holds only
// when the means is coupled with the seeking of it (make / synthesize / enrich /
// culture / weaponize / a recipe / a step-by-step build), and never under the
// advocate's inverse or an about-frame.
//
// THE `voids` ARM IS A KIND, NOT A WORD LIST (2026-09-19, the falsification
// fix). The person-end detector over-fired 15/40 and leaked 10/12; the honest
// arm is the KIND of the construction's object, resolved by the hyperlexicon
// given tier (kernel/foreclosing-kinds.js) through the reaction substrate
// against the charter's protected rights — "bomb" resolves foreclosing
// because the reaction derives that its realization ends a right the charter
// protects; "app" resolves nothing and the composition WITHHOLDS (a disclosed
// coverage gap, never a verdict). No weapon wordlist sits here — this lens
// supplies only the seek grammar (ACQUIRE) and the about-frame that reads a
// means through; the kind judgment is language-neutral and composed in the
// kernel. A means named alone is inert (needs ACQUIRE or AT_SCALE), an
// about-frame (history/report/effects of) or the advocate's inverse
// (detect/protect/treat) reads it through, and a bare UNDERSTAND ("explain
// how to make it") does NOT launder it.

// The means whose only realization is to void a standpoint are not a word
// list here: they are KINDS, resolved by the hyperlexicon given tier
// (kernel/foreclosing-kinds.js) through the reaction substrate against the
// charter's protected rights. This lens's Existence-face grammar is only the
// SEEKING (ACQUIRE, below) and the ABOUT-frame that reads a means through; the
// kind judgment itself is language-neutral and composed in the kernel. A bare
// kind name is inert (needs ACQUIRE or AT_SCALE), an about-frame
// (history/report/effects of) or the advocate's inverse (detect/protect/treat)
// reads it through, and a bare UNDERSTAND ("explain how to make it") does NOT
// launder it.

// The seeking of the means: the ask is for its MAKING or OBTAINING, not for
// knowledge about it. These are how one asks for the thing itself, not how one
// asks for a report or a history. "chemistry of" is seeking when coupled with a
// foreclosing means ("chemistry of explosives for weapon"); with no means
// ("chemistry of combustion for class") it is inert, and an about-frame or the
// advocate's inverse still reads the means through.
export const ACQUIRE = /\b(synthesi[sz]\w*|manufactur\w*|weaponi[sz]\w*|enrich\w*|aerosoli[sz]\w*|cultur\w*|cultivat\w*|detonat\w*|dispers\w*|assembl\w*|construct\w*|build|make|produce|acquire|obtain|recipe|blueprint|schematic|step-?by-?step|chemistr\w*\s+of|instructions?\s+(?:for|to)|how\s+to\s+(?:make|build|produce|synthesi[sz]e|assemble|construct|acquire|obtain|enrich|cultur\w*|weaponi[sz]e))\b/i;

// The widest foreclosure, stated in the open: the removal of standpoints in
// multitude. It reads with a means or a seeking present; it needs no other act.
export const AT_SCALE = /\b(release\s+(?:it\s+)?(?:into|in)\s+(?:a\s+)?(?:populated|crowded?|public|crowd\b)|kill\s+as\s+many\s+(?:people|as\s+possible)|maxim(?:al|ize|ise)\s+(?:casualties|deaths|fatalities)|mass\s+casualt\w*|contaminate\s+(?:the\s+)?(?:water|food)\s+supply|wipe\s+out\s+(?:a|the)\s+(?:city|town|village|population|community))\b/i;

// The standpoint that would be ended is the asker's own: an ask for the MEANS
// to end one's life. It reads only the instructional-means shape — a story, a
// feeling, a request to be helped are not this, and the advocate's inverse and
// the about-frame read through.
export const SELF_FORECLOSE = /\b((?:most\s+)?(?:lethal|effective|painless|reliable|quick(?:est)?|surest|best)\s+(?:way|method|means)\s+(?:to\s+(?:kill\s+(?:myself|herself|himself|themselves|oneself)|end\s+(?:my|your|her|his|their)\s+(?:own\s+)?life|die|commit\s+suicide|attempt\s+suicide)|of\s+(?:suicide|dying|killing\s+(?:myself|oneself)))|(?:most\s+)?(?:lethal|painless|surest)\s+(?:way|method|means)|how\s+(?:to|do\s+i|(?:she|he|they)\s+(?:could|would|might))\s+(?:kill\s+(?:myself|herself|himself)|end\s+(?:my|her|his|their)\s+(?:own\s+)?life|commit\s+suicide)|end(?:ing|s)?\s+(?:my|her|his|their|your|one'?s)\s+(?:own\s+)?life|take\s+(?:my|her|his|their|your)\s+own\s+life|suicide\s+method|methods?\s+of\s+suicide|lethal\s+dose\s+to\s+(?:die|kill\s+(?:myself|herself|himself)))\b/i;

// The about-frame: the means held as knowledge, not sought as capacity. This is
// the Existence-face reading of UNDERSTAND, and it reads the means through — a
// report on a weapon takes a perspective in, it hands out no capacity.
export const ABOUT_FRAME = /\b(history\s+of|report\s+on|article\s+about|about\s+the|effects?\s+of|impact\s+of|used\s+in\s+(?:world\s+war|wwi|wwii|the\s+war|syria|conflict)|treaty|convention|policy|non-?proliferation|disarmament|documentary|casualties\s+(?:of|from)|aftermath|survivors?\s+of|memorial|incidents?|database|dataset|timeline|the\s+bombing\s+of|hiroshima|nagasaki)\b/i;

/**
 * arms(text, { charter }) — read the English surfaces into the kernel's arm
 * vocabulary. This is the ONLY place English grammar is named; the kernel
 * never sees a word. The `voids` arm is the KIND of the construction's object,
 * resolved by the hyperlexicon given tier through the reaction substrate
 * against the supplied charter (language-neutral; see foreclosing-kinds.js).
 */
export const arms = (text, { charter = null } = {}) => {
  const t = String(text ?? "");
  return {
    experience: COLLAPSE.experience.test(t),
    humanity: COLLAPSE.humanity.test(t),
    autonomy: COLLAPSE.autonomy.test(t),
    capability: ACTS.test(t),
    inherent: INHERENT_ACTS.test(t),
    remedy: REMEDY.test(t),
    // understand is read with negated understand-frames stripped, so "the real
    // code, not a description" does not read as a request to describe.
    understand: UNDERSTAND.test(t.replace(NEGATED_UNDERSTAND, " ")),
    create: CREATE.test(t),
    instrumentalCreate: INSTRUMENTAL_CREATE.test(t),
    override: OVERRIDE.test(t),
    other: OTHER.test(t),
    // The Existence face: the foreclosing KIND of the construction's object
    // (voids), the seeking of it (acquire), the widest foreclosure (atScale),
    // the self-directed means (selfForeclose), and the about-frame that reads
    // a means through (aboutFrame). The kernel couples these into the
    // Existence shape.
    voids: resolveForeclosingKind(t, { charter }).foreclosing,
    acquire: seekObject(t, { language: "en" }).found || ACQUIRE.test(t),
    atScale: AT_SCALE.test(t),
    selfForeclose: SELF_FORECLOSE.test(t),
    aboutFrame: ABOUT_FRAME.test(t),
  };
};

export const englishLens = Object.freeze({ giver: GIVER, arms });
export default englishLens;
