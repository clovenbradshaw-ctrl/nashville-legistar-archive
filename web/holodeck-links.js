// holodeck-links.js — A REFERENT'S EXTERNAL GROUND, BOUND BY CONSEQUENCE.
//
// Pulls structured information about a profile's referents from Wikidata,
// Wikipedia and Wikimedia Commons — and refuses every pull the reading cannot
// bind. The identity law, as the record keeps it (SEED-SPEAKER.md;
// native/kernel/identity.js; identity-is-the-fold-at-a-point.md):
//
//   two figures are the same iff they make the same difference to the ground —
//   never by appearance, not even in principle. The universe folded at a point
//   for a particular, bounded by differences that make a difference.
//
// Consequence, not appearance: the referent's name only RAISES a candidate —
// the point where the fold is taken — and is never the evidence. The evidence
// is whether the candidate's own ground (its structured claims) makes the same
// difference the referent's ground (its profile parameters) does. A candidate
// that makes a different difference is a namesake: the identity reading is
// refused (the machine's identity_split / identity_reading_refused), and its
// Wikipedia or Commons material is never presented — because Wikipedia and
// Commons are reached only through a QID that survived the gate. Support never
// proves sameness: a bound is a live hypothesis with its corroboration named,
// and the person is the oracle.
//
// Pure and structural: the comparisons are token-set folds over the two
// grounds, with small DATA lexicons (descriptor words, kind-asserting and
// property-asserting relations, place words) that any caller may override.
// fetch is injected, so the gate is falsified deterministically in
// holodeck-links.test.mjs against captured Wikidata payloads and live in
// falsify.links.mjs.
//
// THE ARROW OF TIME (2026-10-02): two figures with the same life but one
// difference, living a hundred years apart, are not the same person. Identity
// is bounded by WHEN the referent was witnessed. The candidate's existence
// window (born/died) and its position terms must overlap the referent's
// witnessed period and its tenure years; a candidate out of that window fails
// the validity-window check FIRST — the khora's Kelsen precedence order
// (vendor/eoreader7/native/organs/regime.js: step 1, validity before force,
// before entrenchment, never a silent pick) — before any kind match is ever
// consulted.

import { inValidityWindow } from "./vendor/eoreader7/native/organs/regime.js";

export const LINKS_SCHEMA = "EOReferentLinks@1";

// ── canonization — the machine's own (native/kernel/identity.js:15) ────────
export const norm = (x) => String(x ?? "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const tokens = (x) => [...new Set(norm(x).split(/\s+/).filter((t) => t.length >= 2))];
const clean = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

// ── time — the arrow of time, read off Wikidata's declared time values ─────
// A Wikidata time is "+1975-03-18T00:00:00Z" or "+1975-00-00T00:00:00Z"
// (unknown month/day). Only the year is trusted — grain is declared, never a
// clock the engine owns (constitution III.2: a validity window is a declared
// tag on an entry, never a clock).
const TIME_RE = /^[+-](\d{4,})/;
export function wikidataTimeToMs(t) {
  if (!t) return null;
  const m = String(t).match(TIME_RE);
  if (!m) return null;
  const y = Number(m[1]);
  if (!Number.isFinite(y)) return null;
  return Date.UTC(y, 0, 1);
}
const yearOf = (ms) => (ms == null ? null : new Date(ms).getUTCFullYear());
/** Do two [from, until) validity windows overlap? An open side means a time
 *  exists inside both — same exclusivity regime.js's inValidityWindow uses. */
export function windowsOverlap(a, b) {
  if (a?.open || b?.open) return true;
  const aFrom = a?.from ?? -Infinity, aUntil = a?.until ?? Infinity;
  const bFrom = b?.from ?? -Infinity, bUntil = b?.until ?? Infinity;
  return aFrom < bUntil && bFrom < aUntil;
}

// ── DATA lexicons (a caller's classification, never a per-referent list) ────
// A word that marks a USE of a name rather than the entity itself. A referent
// whose own surface carries a descriptor token no candidate's label explains
// names a transaction/event ("Wayfair furniture purchase", "Skydio drone
// trial"), and no entity's ground can be folded onto it.
export const DESCRIPTOR_WORDS = new Set([
  "purchase", "payment", "payments", "rent", "lease", "contract", "meeting", "meetings",
  "score", "trial", "funding", "redirect", "withholding", "refusal", "expansion", "dispute",
  "anomaly", "compensation", "partnership", "allocation", "budget", "program", "initiative",
  "proposal", "report", "letter", "study", "review", "audit", "complaint", "proceeding",
  "hearing", "case", "project", "payout", "stipend", "grant", "bid", "procurement",
  "txn", "transaction", "lawsuit", "memo", "minutes", "placement", "renovation", "annex",
]);

// Relations whose values assert the referent is a SPECIFIC property — owned,
// appraised, priced, addressed, housed. A candidate that is a brand/chain/
// company cannot be the same thing as a specific property.
export const PROPERTY_RELS = new Set([
  "owner", "address", "appraised_value", "appraised_value_2026", "purchase_price",
  "purchase_price_2010", "occupancy_rent_line", "units_empty", "units", "building",
  "property", "developer", "landlord",
]);

// Relations whose values assert WHAT the referent is / does — the kind
// differences that bound it. Everything else a reading can witness (email,
// phone, pronouns, amounts, dates, statuses, named-in, appears-with, figure,
// year, about) asserts no kind and binds nothing. Rel names carry the reading's
// own suffixes ("role_2021", "role_2023-"), so `kind` and `property` are
// prefix-licensed: a caller's classified rel admits its prefixed kin.
export const KIND_RELS = new Set([
  "type", "role", "role_description", "full_name", "description", "note", "org",
  "director", "contact", "placement", "background", "event",
]);
const isKindRel = (rel) => KIND_RELS.has(rel) || /^(role|type|full_name|description|note|org|placement|background|event)/.test(rel);
const isPropertyRel = (rel) => PROPERTY_RELS.has(rel) || /^(owner|address|appraised|purchase|occupancy|units|landlord)/.test(rel);

// Function words that carry no difference; dropped before grounds are folded.
export const CONTENT_STOP = new Set([
  "the", "a", "an", "of", "for", "in", "on", "at", "and", "or", "with", "by", "to",
  "from", "it", "its", "is", "are", "was", "were", "be", "been", "as", "per", "over",
  "under", "this", "that", "these", "those", "not", "no", "own", "between", "into",
  // Spanish
  "de", "del", "la", "el", "los", "las", "y", "e", "en", "a", "que", "con", "por",
  "para", "un", "una", "unos", "unas", "al", "se", "su", "sus", "como", "más", "mas",
  // Russian
  "и", "в", "во", "на", "с", "со", "по", "за", "о", "об", "от", "из", "до", "не",
  "но", "как", "что", "это", "для", "при", "его", "её", "ее", "их", "так", "же",
  "у", "к", "ко", "бы", "был", "была", "были", "года", "году", "год",
]);

// Place words the reading itself can assert; a candidate whose P131/description
// places it elsewhere while the referent asserts a Nashville ground is attacked.
export const PLACE_WORDS = new Set([
  "nashville", "tennessee", "tn", "davidson", "metro", "wallace", "murfreesboro", "williamson",
]);

// Generic class words a candidate's ground can assert that CONTAIN the
// referent rather than contradicting it — "politician" contains "mayor", a
// "human" can be an attorney. A candidate attacking on these alone is a
// missing label (absent evidence), never a namesake. Plus region words a
// candidate may place itself in that plausibly contain the referent's place.
export const GENERIC_KIND_WORDS = new Set([
  "human", "person", "people", "politician", "american", "united", "states", "public",
  "national", "official", "political", "citizen",
]);
const REGION_WORDS = () => new Set([...PLACE_WORDS, "usa", "united", "states", "america", "us"]);

// Common organizational/service vocabulary — a shared token from this set is
// vocabulary, not a reproduced difference. "Park Center Community Services in
// Kansas" shares "services" with the Nashville nonprofit and is a different
// thing entirely; corroboration must be discriminating, or the fold reads
// bag-of-words (the essay's own warning: the tier that understood least spoke
// loudest). A candidate that reproduces only weak tokens reproduces nothing.
export const WEAK_KIND_WORDS = new Set([
  "services", "service", "center", "community", "organization", "organisation",
  "development", "office", "agency", "association", "foundation", "institute",
  "group", "company", "corporation", "limited", "incorporated", "health", "care",
  "nonprofit", "non", "profit", "department", "program", "programs", "public",
  "support", "provider", "providers", "member", "members", "group", "network",
  "initiative", "project", "program", "partnership", "coalition", "alliance",
  "capital", "city", "ciudad", "столица", "город", "municipal", "state",
]);

// A candidate whose STRUCTURED kind is an object ABOUT the referent — a list,
// a prize, a book, an exhibition — borrows the referent's kind in its prose
// ("bibliography of the Colombian writer") while its structure says "list".
// Bag-of-words would bind the list to the person; the structure must refuse it.
export const OBJECT_KIND_WORDS = new Set([
  "list", "anexo", "annex", "bibliography", "bibliografía", "exhibition", "exposición",
  "prize", "award", "premio", "book", "libro", "novel", "novela", "film", "película",
  "album", "álbum", "painting", "cuadro", "song", "canción", "website", "sitio",
  "web", "page", "página", "category", "categoría", "disambiguation", "desambiguación",
  "article", "artículo", "documentary", "documental", "competition", "concurso",
  "foundation", "fundación", "association", "society", "sociedad",
]);

// Words that assert the referent IS a person. When the referent's ground names
// a human role, an OBJECT-kind candidate is an object about that person.
export const HUMAN_ROLE_WORDS = new Set([
  "writer", "author", "novelist", "poet", "painter", "artist", "actress", "actor",
  "politician", "president", "mayor", "minister", "director", "executive", "attorney",
  "lawyer", "doctor", "researcher", "journalist", "composer", "singer", "athlete",
  "player", "engineer", "architect", "scientist", "philosopher", "king", "queen",
  "governor", "senator", "official",
  "escritor", "escritora", "autor", "poeta", "pintor", "pintora", "artista", "actriz",
  "actor", "político", "presidente", "presidenta", "alcalde", "alcaldesa", "ministro",
  "director", "directora", "ejecutivo", "abogado", "médico", "investigador",
  "periodista", "compositor", "cantante", "deportista", "futbolista", "tenista",
  "científico", "filósofo", "política",
  "писатель", "писательница", "поэт", "художник", "художница", "актёр", "актриса",
  "президент", "мэр", "министр", "директор", "юрист", "врач", "учёный", "исследователь",
  "журналист", "композитор", "певец", "певица", "спортсмен", "политик", "губернатор",
]);

// ── the referent's ground, folded from its profile ──────────────────────────
// `pointerSurfaces` finds the NAME RUNS a surface carries — a surface like
// "MNPD Skydio drone trial" names its pointer "Skydio", and "Wayfair furniture
// purchase" names "Wayfair". A capitalized run (title-case, or an all-caps
// acronym like OHS/MDHA) is where the fold may be taken; the surrounding words
// are the use.
export function pointerSurfaces(surface, DESCRIPTOR = DESCRIPTOR_WORDS) {
  const out = new Set();
  const s = clean(surface);
  if (!s) return [];
  const add = (x) => { const c = clean(x); if (c) out.add(c); };
  add(s);
  const orig = s.split(/\s+/).filter(Boolean);
  if (orig.length > 1) {
    // capitalized runs — on the CASE-PRESERVED surface: "Wayfair furniture
    // purchase" names "Wayfair"; "MNPD Skydio drone trial" names "Skydio"
    const runs = [];
    let run = [];
    for (const t of orig) {
      const namey = (/^[A-Z][A-Za-z0-9.'’-]*$/.test(t) && /[a-z]/.test(t)) || /^[A-Z]{2,}$/.test(t);
      if (namey) run.push(t);
      else { if (run.length) { runs.push(run); run = []; } }
    }
    if (run.length) runs.push(run);
    for (const r of runs) {
      const skipSingle = r.length === 1 && SINGLE_TITLE_SKIP.has(norm(r[0]));
      if (!skipSingle) add(r.join(" "));
      // a run headed by an all-caps acronym names its title-case tail alone
      if (/^[A-Z]{2,}$/.test(r[0]) && r.length > 1) add(r.slice(1).join(" "));
    }
    // descriptor-stripped form ("Wayfair furniture purchase" → "Wayfair")
    const nt = norm(s).split(/\s+/).filter((t) => t.length >= 2);
    const cut = nt.findIndex((t) => DESCRIPTOR.has(t));
    if (cut > 0) add(nt.slice(0, cut).join(" "));
  }
  return [...out];
}
// Common nouns that appear Title-cased inside a longer name but are not
// themselves a pointer ("Ciudad de México" → "Ciudad"; "City of London",
// "La Habana"). Data, overridable.
export const SINGLE_TITLE_SKIP = new Set([
  "ciudad", "city", "town", "village", "ville", "stadt", "the", "de", "del", "la",
  "el", "los", "las", "san", "santa", "santo", "saint", "st", "fort", "mount", "mt",
  "nuevo", "nueva", "puerto", "villa", "pueblo", "distrito", "capitol", "cape",
]);

export function profileGround(profile, { surfaces = null, fullName = null, kindParams = null, opts = {} } = {}) {
  const DESCRIPTOR = opts.descriptorWords ?? DESCRIPTOR_WORDS;
  const STOP = opts.contentStop ?? CONTENT_STOP;
  const PLACE = opts.placeWords ?? PLACE_WORDS;

  const params = profile?.parameters ?? [];
  const byRel = new Map();
  const relWeight = new Map();
  for (const p of params) {
    const recs = (p.values ?? []).filter((v) => clean(v.value));
    if (recs.length) { byRel.set(p.rel, recs); relWeight.set(p.rel, p.informationWeight ?? 0); }
  }
  const aliasVals = (byRel.get("also written") ?? []).map((v) => clean(v.value));
  const full = fullName ?? (byRel.get("full_name")?.[0] ? clean(byRel.get("full_name")[0].value) : null);

  const idSurf = String(profile?.id ?? "");
  // the id joins as a surface only when it IS a name: a namespaced id
  // ("corpus-es:Ciudad de México") or a long descriptive id is an identifier,
  // never a pointer, and searching it raises junk candidates (Moscow from
  // "Ciudad de México").
  const idIsName = idSurf && !idSurf.includes(":") && !idSurf.includes("/") && norm(idSurf).split(/\s+/).length <= 3;
  const shortSurfaces = [...(surfaces ?? []), ...aliasVals, ...(idIsName ? [idSurf] : [])].map(clean).filter(Boolean);
  const shortPointers = [...new Set(shortSurfaces.flatMap((s) => pointerSurfaces(s, DESCRIPTOR)))];
  const nameTokens = new Set(shortPointers.flatMap((s) => tokens(s)));
  const pointers = [...new Set([...shortPointers, ...(full ? [full] : [])])];
  const searchQueries = pointers;

  const kindTokens = new Set();
  const placeTokens = new Set();
  const propParams = [];
  const rolePeriods = [];
  const tokenWeight = new Map();
  let w0 = Infinity, w1 = -Infinity;
  for (const [rel, recs] of byRel) {
    for (const v of recs) {
      const text = clean(v.value);
      if (isKindRel(rel) || isPropertyRel(rel)) {
        if (isPropertyRel(rel)) propParams.push({ rel, value: text });
        for (const t of tokens(text)) {
          if (nameTokens.has(t) || STOP.has(t)) continue;
          if (PLACE.has(t)) { placeTokens.add(t); continue; }
          kindTokens.add(t);
          // how strongly this difference identifies its bearer: the profile's
          // own IDF weight (entity-profile.js), carried per token
          const w = relWeight.get(rel) ?? 0;
          if (w > (tokenWeight.get(t) ?? 0)) tokenWeight.set(t, w);
        }
      }
      // the reading's own witness positions (seq = Date.parse(ts), carried as
      // firstAt/lastAt on the profile's values) bound WHEN the referent lived.
      // Only calendar timestamps count: a line without a ts carries a reading
      // position (52, 53…), never a date, and would poison the window.
      if (typeof v.firstAt === "number" && v.firstAt > 1e11) { if (v.firstAt < w0) w0 = v.firstAt; if (v.firstAt > w1) w1 = v.firstAt; }
      if (typeof v.lastAt === "number" && v.lastAt > 1e11 && v.lastAt > w1) w1 = v.lastAt;
    }
    // tenure years the reading itself encoded in a role rel ("role_2021",
    // "role_2023-" — the dependency ORDER of the referent's offices)
    const m = rel.match(/^role[_-](\d{4})(-)?/);
    if (m) rolePeriods.push({ year: Number(m[1]), open: !!m[2], rel });
  }
  const witnessed = isFinite(w0)
    ? Object.freeze({ from: w0, until: w1 >= w0 ? w1 + 1 : w0 + 1, open: false })
    : null;

  const surfaceWords = shortPointers.join(" ").toLowerCase();
  const hasDescriptor = [...DESCRIPTOR].some((w) => surfaceWords.includes(w));

  return {
    id: profile?.id ?? null,
    pointers,
    searchQueries,
    nameTokens,
    kindTokens: [...kindTokens],
    tokenWeight: new Map(tokenWeight),
    placeTokens: [...placeTokens],
    propParams,
    rolePeriods,
    witnessed,
    hasProperty: propParams.length > 0,
    hasKind: kindTokens.size > 0,
    hasPlace: placeTokens.size > 0,
    hasDescriptor,
  };
}

export function stripDescriptors(s, DESCRIPTOR = DESCRIPTOR_WORDS) {
  const ts = norm(s).split(/\s+/).filter((t) => t.length >= 2);
  const cut = ts.findIndex((t) => DESCRIPTOR.has(t));
  return cut < 0 ? clean(s) : clean(ts.slice(0, cut).join(" "));
}

// ── the candidate's ground, folded from its structured data ────────────────
// The fold is taken on BOTH figures with the shared name pointer removed: the
// name is the point of the fold, never evidence. Whatever differences remain
// are what bind or refuse. The candidate's own full label is not subtracted —
// a full name ("Metropolitan Development and Housing Agency") is also what its
// description does, and that is a difference, not an appearance.
export function candidateGround(c, { nameTokens: refNameTokens = null, stopWords = CONTENT_STOP } = {}) {
  const label = clean(c.label);
  const desc = clean(c.description);
  const kindLabels = (c.kinds ?? []).map((k) => clean(k.label)).filter(Boolean);
  const placeLabels = (c.places ?? []).map((p) => clean(p.label)).filter(Boolean);
  const posLabels = (c.positions ?? []).map((p) => clean(p.label)).filter(Boolean);
  // ONLY the shared name pointer is removed — the referent's short name tokens.
  // The candidate's own full label is not subtracted: a full name
  // ("Metropolitan Development and Housing Agency") is also what its
  // description does, and that is a difference, not an appearance.
  const nameTokens = new Set(refNameTokens ?? []);
  const placeTokens = new Set(placeLabels.flatMap((p) => tokens(p)));
  const kindTokens = new Set();
  for (const x of [desc, ...kindLabels, ...posLabels]) for (const t of tokens(x)) {
    if (nameTokens.has(t) || placeTokens.has(t) || stopWords.has(t)) continue;
    kindTokens.add(t);
  }
  return { label, nameTokens, placeTokens: [...placeTokens], kindTokens: [...kindTokens] };
}

// ── the fold at a point: does the candidate make the same difference? ──────
// The comparison is between the two GROUNDS, never between the two names.
// `nameRaise` only decides whether the name points here at all; it contributes
// no evidence. Evidence is corroboration (the candidate reproduces a
// difference the referent's ground asserts) and attack (the candidate asserts
// a difference the referent's ground refutes — constitutive contradiction).
function matchScore(sTok, cTok) {
  const inter = [...sTok].filter((t) => cTok.has(t)).length;
  if (!inter) return null;
  const union = new Set([...sTok, ...cTok]).size;
  const jaccard = inter / union;
  const contain = [...sTok].every((t) => cTok.has(t)) || [...cTok].every((t) => sTok.has(t));
  if (jaccard >= 0.5 || contain) return { jaccard };
  return null;
}

export function nameRaise(ground, cand) {
  const labelTok = new Set(tokens(cand.label));
  const aliasTok = new Set(tokens((cand.aliases ?? []).join(" ")));
  let best = null;
  for (const s of ground.pointers) {
    const sTok = new Set(tokens(s));
    // PRIMARY: the score is the surface against the LABEL — aliases must not
    // dilute it. "Ciudad de México" with its ten aliases (Cd Méx, DF, D. F.…)
    // is a perfect label match, and its rich alias list must not rank it
    // below a bare-label disambiguation page.
    const l = matchScore(sTok, labelTok);
    if (l && (!best || l.jaccard > best.jaccard)) best = { surface: s, jaccard: l.jaccard };
    // FALLBACK: a candidate known only by an alias is still raised, at the
    // weaker alias match — the alias never outranks a label match.
    if (!best) {
      const a = matchScore(sTok, aliasTok);
      if (a) best = { surface: s, jaccard: a.jaccard };
    }
  }
  return best;
}

export function gate(ground, cand, { opts = {} } = {}) {
  const raised = nameRaise(ground, cand);
  const attacks = [];
  const support = [];

  // THE ARROW OF TIME — validity window FIRST (Kelsen's precedence step 1,
  // vendor/eoreader7/native/organs/regime.js): a candidate whose existence
  // window does not cover the referent's witnessed period, or whose office
  // terms never cover the referent's tenure years, fails here before any kind
  // match is consulted. Two people with the same life, one difference, living
  // a hundred years apart, are not the same person.
  if (opts.temporal !== false && ground.witnessed) {
    if (cand.died != null && !inValidityWindow({ from: cand.born ?? null, until: cand.died, open: false }, ground.witnessed.from)) {
      attacks.push({ kind: "identity_reading_refused", why: "the candidate died in " + yearOf(cand.died) + ", before the reading first witnessed the referent in " + yearOf(ground.witnessed.from) + " — the identity fails the validity-window check first (Kelsen: validity before force, never a silent pick)" });
    }
    if (cand.born != null && !inValidityWindow({ from: cand.born, until: null, open: false }, ground.witnessed.until)) {
      attacks.push({ kind: "identity_reading_refused", why: "the candidate was born in " + yearOf(cand.born) + ", after the reading last witnessed the referent in " + yearOf(ground.witnessed.until) + " — the arrow of time refuses the identity before any kind match is consulted" });
    }
    if (ground.rolePeriods.length) {
      for (const term of cand.positionTerms ?? []) {
        if (term.start == null || term.end == null) continue;
        const label = term.label ?? term.id ?? "office";
        const startYear = yearOf(term.start), endYear = term.end == null ? null : yearOf(term.end);
        const coversTenure = ground.rolePeriods.some((rp) =>
          rp.open ? endYear == null || rp.year < endYear : rp.year >= startYear && rp.year < endYear);
        if (!coversTenure) {
          attacks.push({ kind: "identity_reading_refused", why: "the candidate held " + label + " " + startYear + "–" + (endYear ?? "now") + ", entirely outside the referent's tenure years (" + ground.rolePeriods.map((r) => r.year + (r.open ? "+" : "")).join(", ") + ") — same office, different era, different person" });
        }
      }
    }
  }

  // OBJECT-KIND REFUSAL — the candidate is structurally an object ABOUT the
  // referent, not the referent: a bibliography, prize, book, exhibition whose
  // prose borrows the person's kind ("bibliography of the Colombian writer").
  // The person's own ground names a human role; the candidate's structure says
  // "list". The structure refuses what bag-of-words would bind.
  if (opts.objectKindRefusal !== false) {
    const OBJECT = opts.objectKindWords ?? OBJECT_KIND_WORDS;
    const HUMAN = opts.humanRoleWords ?? HUMAN_ROLE_WORDS;
    const cObj = (cand.kinds ?? []).some((k) => tokens(k.label).some((t) => OBJECT.has(t)));
    const refHuman = ground.kindTokens.some((t) => HUMAN.has(t));
    if (cObj && refHuman) {
      attacks.push({ kind: "identity_reading_refused", why: "the candidate's structure is an object about the referent (a list, prize, book, exhibition) — its prose borrows the referent's kind, but the structure refuses the identity" });
    }
  }

  if (ground.hasDescriptor) {
    // The referent's own surface names a use ("…purchase", "…trial"). Any
    // candidate that cannot explain the descriptor names the pointer, not the
    // referent — the reading is refused.
    const useSurface = ground.pointers.find((s) => stripDescriptors(s, opts.descriptorWords ?? DESCRIPTOR_WORDS) !== s);
    attacks.push({ kind: "identity_reading_refused", why: "the referent's surface names a use of the name, not the entity (" + useSurface + ")" });
  }

  const STOP = opts.contentStop ?? CONTENT_STOP;
  const GENERIC = opts.genericKindWords ?? GENERIC_KIND_WORDS;
  const REGION = opts.regionWords ?? REGION_WORDS();
  const cg = candidateGround(cand, { nameTokens: ground.nameTokens, stopWords: STOP });
  const cKind = cg.kindTokens;
  // the SPECIFIC kind a candidate asserts — generic class words ("human",
  // "politician", "American") contain the referent rather than contradicting
  // it; only a specific, foreign difference is a constitutive contradiction
  const specificKind = cKind.filter((t) => !GENERIC.has(t));
  const cPlace = cg.placeTokens;
  const cKinds = (cand.kinds ?? []).map((k) => clean(k.label).toLowerCase());
  const cDesc = clean(cand.description).toLowerCase();

  // property-vs-brand: the referent is a specific property; a brand/chain/
  // company cannot be the same thing.
  if (ground.hasProperty && (cKinds.some((k) => /chain|brand/.test(k)) || /chain|brand/.test(cDesc))) {
    attacks.push({ kind: "identity_reading_refused", why: "the referent's ground asserts a specific property; the candidate is a brand or chain" });
  }

  // geo contradiction: a candidate that places itself OUTSIDE the referent's
  // region (a foreign place, not a containing one) is attacked; a candidate
  // inside the region (Tennessee for a Nashville referent) corroborates.
  if (ground.hasPlace && cPlace.length && !cPlace.some((p) => REGION.has(p))) {
    attacks.push({ kind: "identity_reading_refused", why: "the referent is grounded in " + ground.placeTokens.join("/") + "; the candidate places itself in " + cPlace.join("/") });
  }

  // kind contradiction: both grounds assert kinds and the candidate's SPECIFIC
  // kind shares no difference with the referent's. Absent claims (a missing
  // label) assert nothing and cannot attack.
  if (ground.hasKind && specificKind.length && !cKind.some((t) => ground.kindTokens.includes(t))) {
    attacks.push({ kind: "identity_reading_refused", why: "the referent's ground asserts " + ground.kindTokens.slice(0, 4).join(", ") + "; the candidate's ground asserts " + cKind.slice(0, 4).join(", ") });
  }

  // corroboration — the candidate reproduces a difference the referent asserts.
  // It must be DISCRIMINATING, or the fold reads bag-of-words: a single shared
  // generic word ("services", "capital", "center") is vocabulary two unrelated
  // things share, not evidence that they are the same. Decisive corroboration is
  // at least two shared differences with one of them specific, or one shared
  // difference so identifying that it alone binds (the profile's own IDF weight,
  // and never a weak word).
  if (!attacks.length && ground.hasKind) {
    const WEAK = opts.weakKindWords ?? WEAK_KIND_WORDS;
    const shared = ground.kindTokens.filter((t) => cKind.includes(t));
    if (shared.length) {
      const specific = shared.filter((t) => !WEAK.has(t));
      const maxW = Math.max(...shared.map((t) => ground.tokenWeight?.get(t) ?? 0));
      const decisive = shared.length >= 2
        ? specific.length >= 1
        : shared.length === 1 && specific.length === 1 && maxW >= 4.0;
      if (decisive) support.push(...shared);
    }
  }

  return { raised, attacks, support };
}

// ── the sources, reached only through a bound QID ──────────────────────────
const WIKIDATA = "https://www.wikidata.org/w/api.php";
const WIKIPEDIA_REST = "https://en.wikipedia.org/api/rest_v1";
const COMMONS = "https://commons.wikimedia.org/w/api.php";

async function getJSON(url, { fetchImpl = fetch, ua = "TheFold/0.1 (referents research; local test harness)", tries = 3 } = {}) {
  for (let a = 0; a < tries; a++) {
    const r = await fetchImpl(url, { headers: { "User-Agent": ua } });
    if (r.status === 429) { await new Promise((s) => setTimeout(s, 1500 * (a + 1) + 1500)); continue; }
    if (r.status >= 400) return null;
    return await r.json().catch(() => null);
  }
  return null;
}

export async function searchWikidata(name, { fetchImpl = fetch, ua, language = "en", limit = 5 } = {}) {
  const url = `${WIKIDATA}?action=wbsearchentities&search=${encodeURIComponent(name)}&language=${language}&uselang=${language}&format=json&limit=${limit}&origin=*`;
  const j = await getJSON(url, { fetchImpl, ua });
  return (j?.search ?? []).map((e) => ({
    qid: e.id, label: e.label ?? null, description: e.description ?? null, aliases: e.aliases ?? [],
  }));
}

export async function fetchEntity(qid, { fetchImpl = fetch, ua, language = "en" } = {}) {
  const url = `${WIKIDATA}?action=wbgetentities&ids=${encodeURIComponent(qid)}&props=labels|descriptions|aliases|claims|sitelinks&format=json&languages=${language}&origin=*`;
  const j = await getJSON(url, { fetchImpl, ua });
  const e = j?.entities?.[qid];
  if (!e) return null;
  return entityFromRaw(e);
}

export function entityFromRaw(e) {
  const claims = {};
  for (const p of ["P31", "P131", "P39", "P18", "P373", "P856"]) {
    claims[p] = (e.claims?.[p] ?? []).map((c) => c.mainsnak?.datavalue?.value?.id ?? c.mainsnak?.datavalue?.value ?? null).filter((v) => v != null);
  }
  const timeOf = (c) => c?.mainsnak?.datavalue?.value?.time ?? null;
  const born = timeOf(e.claims?.P569?.[0]);
  const died = timeOf(e.claims?.P570?.[0]);
  const positionTerms = (e.claims?.P39 ?? []).map((c) => {
    const q = c?.qualifiers ?? {};
    const start = timeOf(q.P580?.[0]);
    const end = timeOf(q.P582?.[0]);
    return {
      id: c?.mainsnak?.datavalue?.value?.id ?? null,
      start: wikidataTimeToMs(start),
      end: wikidataTimeToMs(end),
      startRaw: start ?? null,
      endRaw: end ?? null,
    };
  }).filter((t) => t.id);
  return {
    qid: e.id,
    label: e.labels?.en?.value ?? null,
    description: e.descriptions?.en?.value ?? null,
    aliases: e.aliases?.en?.map((a) => a.value) ?? [],
    claims,
    enwiki: e.sitelinks?.enwiki?.title ?? null,
    born: born ? wikidataTimeToMs(born) : null,
    died: died ? wikidataTimeToMs(died) : null,
    bornRaw: born ?? null,
    diedRaw: died ?? null,
    positionTerms,
  };
}

// Resolve the labels of the claim ids a candidate carries (P31 kinds, P39
// positions, P131 places). `known` is a data map the caller may supply; ids it
// lacks are fetched in one batched call.
export async function resolveKindLabels(ids, { known = {}, fetchImpl = fetch, ua, language = "en" } = {}) {
  const missing = [...new Set(ids.filter((id) => id && !known[id]))];
  const out = { ...known };
  if (missing.length) {
    const url = `${WIKIDATA}?action=wbgetentities&ids=${encodeURIComponent(missing.join("|"))}&props=labels&format=json&languages=${language}&origin=*`;
    const j = await getJSON(url, { fetchImpl, ua });
    for (const [id, e] of Object.entries(j?.entities ?? {})) if (e?.labels?.[language]?.value) out[id] = e.labels[language].value;
  }
  return out;
}

export function annotateCandidate(c, labels) {
  const kind = (p) => (c.claims?.[p] ?? []).map((id) => ({ id, label: labels[id] ?? null })).filter((k) => k.label);
  const positions = kind("P39");
  const termLabel = (id) => positions.find((p) => p.id === id)?.label ?? null;
  return {
    ...c,
    kinds: kind("P31"),
    positions,
    places: kind("P131"),
    image: c.claims?.P18?.[0] ?? null,
    commonsCategory: c.claims?.P373?.[0] ?? null,
    positionTerms: (c.positionTerms ?? []).map((t) => ({ ...t, label: termLabel(t.id) })),
  };
}

export function wikipediaUrl(title) { return `https://en.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, "_"))}`; }

export async function wikipediaStructured(title, { fetchImpl = fetch, ua } = {}) {
  const j = await getJSON(`${WIKIPEDIA_REST}/page/summary/${encodeURIComponent(String(title).replace(/ /g, "_"))}`, { fetchImpl, ua });
  if (!j || j.type === "disambiguation" || j.title == null) return null;
  return {
    title: j.title ?? null,
    extract: j.extract ?? null,
    thumbnail: j.thumbnail?.source ?? null,
    url: j.content_urls?.desktop?.page ?? wikipediaUrl(j.title ?? title),
  };
}

export async function commonsImage(file, { fetchImpl = fetch, ua } = {}) {
  const name = String(file).replace(/^File:/, "");
  const j = await getJSON(`${COMMONS}?action=query&titles=${encodeURIComponent("File:" + name)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&format=json&origin=*`, { fetchImpl, ua });
  const pages = j?.query?.pages ?? {};
  const page = Object.values(pages)[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  return {
    file: name,
    url: ii.url ?? null,
    width: ii.width ?? null,
    height: ii.height ?? null,
    mime: ii.mime ?? null,
    credit: ii.extmetadata?.Credit?.value ? String(ii.extmetadata.Credit.value).replace(/<[^>]+>/g, "").slice(0, 200) : null,
  };
}

export async function commonsCategory(cat, { fetchImpl = fetch, ua } = {}) {
  const name = String(cat).replace(/^Category:/, "");
  const j = await getJSON(`${COMMONS}?action=query&titles=${encodeURIComponent("Category:" + name)}&prop=categoryinfo&format=json&origin=*`, { fetchImpl, ua });
  const pages = j?.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined) return null;
  return {
    category: name,
    pages: page.categoryinfo?.pages ?? null,
    files: page.categoryinfo?.files ?? null,
    subcats: page.categoryinfo?.subcats ?? null,
    url: `https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(name)}`,
  };
}

// ── the pull: resolve, raise, fold, and reach the sources only through a
//    QID that survived the gate ─────────────────────────────────────────────
export async function resolveReferent(profile, built, {
  searchImpl = searchWikidata, entityImpl = fetchEntity, entityBatchImpl = null,
  labelsImpl = resolveKindLabels, linkImpl = null, ua, knownLabels = {},
  maxCandidates = 12, opts = {}, language = "en",
} = {}) {
  const ground = profileGround(profile, { opts });
  const out = {
    schema: LINKS_SCHEMA,
    referent: ground.id,
    verdict: "not-found",
    identity: null,
    candidates: [],
    links: null,
    reason: null,
  };

  if (!ground.pointers.length) { out.reason = "no surface names to raise a candidate"; return out; }

  const byQid = new Map();
  for (const s of ground.searchQueries) {
    let res = [];
    try { res = await searchImpl(s, { ua, language }); } catch { res = []; }
    for (const c of res) byQid.set(c.qid, c);
  }
  const qids = [...byQid.keys()].slice(0, maxCandidates);
  if (!qids.length) { out.reason = "no Wikidata candidate was raised by any surface"; return out; }

  const labelIds = new Set(Object.keys(knownLabels));
  const entities = [];
  const fetched = new Map();
  if (entityBatchImpl) {
    try {
      const fulls = await entityBatchImpl(qids, { ua });
      for (const f of fulls) if (f) fetched.set(f.qid, f);
    } catch { /* fall through to per-qid */ }
  }
  for (const qid of qids) {
    let e = byQid.get(qid);
    let full = fetched.get(qid);
    if (!full && !entityBatchImpl) {
      try { full = await entityImpl(qid, { ua, language }); } catch { full = null; }
    }
    if (full) {
      // the entity fetch NEVER clobbers the search result with null/undefined:
      // a label the API did not return for this language is an absence, and
      // absence must not erase the pointer that raised the candidate
      e = { ...e };
      for (const k of Object.keys(full)) if (full[k] != null) e[k] = full[k];
      for (const p of ["P31", "P39", "P131"]) for (const id of (full.claims?.[p] ?? [])) labelIds.add(id);
    }
    entities.push(e);
  }
  let labels = knownLabels;
  try { labels = await labelsImpl([...labelIds], { known: knownLabels, ua, language }); } catch { labels = knownLabels; }

  const gated = entities.map((c) => {
    const cand = annotateCandidate(c, labels);
    const g = gate(ground, cand, { opts });
    return { cand, ...g };
  });
  out.candidates = gated.map((x) => ({
    qid: x.cand.qid,
    label: x.cand.label,
    description: x.cand.description,
    raised: !!x.raised,
    surface: x.raised?.surface ?? null,
    jaccard: x.raised?.jaccard ?? null,
    support: x.support,
    attacks: x.attacks,
  }));

  const raised = gated.filter((x) => x.raised);
  if (!raised.length) { out.reason = "no candidate was raised by the referent's surfaces"; return out; }

  // the strongest name candidate is where the reading's name points. If it is
  // attacked — a constitutive contradiction — the identity reading is refused
  // (identity_split / identity_reading_refused), even when weaker name-twins
  // survive without corroboration: their empty boundary licenses nothing.
  // BUT an exact-name survivor (same surface, same closeness) is not a namesake
  // — it is a live candidate the reading simply cannot corroborate; the honest
  // verdict is unverified/ambiguous, never a refusal it did not earn.
  const strongest = raised.slice().sort((a, b) => b.raised.jaccard - a.raised.jaccard)[0];
  const survivors = raised.filter((x) => !x.attacks.length);
  const exactNameSurvivors = survivors.filter((x) => x.raised.jaccard === strongest.raised.jaccard);
  if (!survivors.length || (strongest.attacks.length && !survivors.some((x) => x.support.length) && !exactNameSurvivors.length)) {
    const top = strongest.attacks.length ? strongest : raised[0];
    out.verdict = "namesake";
    out.identity = {
      standing: "identity_reading_refused",
      candidate: top.cand.qid,
      label: top.cand.label,
      attackRefs: top.attacks.map((a) => a.why),
    };
    out.reason = "the candidate the referent's name points at makes a different difference to the ground — the identity reading is refused; its material is never presented";
    return out;
  }

  const ranked = survivors.slice().sort((a, b) => b.support.length - a.support.length || b.raised.jaccard - a.raised.jaccard);
  const best = ranked[0];
  const runners = ranked.slice(1).filter((x) => x.support.length === best.support.length);
  if (runners.length) {
    out.verdict = "ambiguous";
    out.identity = {
      standing: "ambiguous",
      candidates: [best.cand.qid, ...runners.map((x) => x.cand.qid)],
      labels: [best.cand.label, ...runners.map((x) => x.cand.label)],
    };
    out.reason = "more than one candidate makes the same difference; no decider — all stay live, none is presented";
    return out;
  }

  if (!best.support.length) {
    out.verdict = "unverified";
    out.identity = {
      standing: "unverified",
      candidate: best.cand.qid,
      label: best.cand.label,
      attackRefs: [],
    };
    out.reason = "a single candidate is name-raised, but the referent's ground asserts no difference the candidate reproduces — the boundary is empty; nothing is presented";
    return out;
  }

  // bound — a live identity hypothesis standing on corroboration
  out.verdict = "bound";
  out.identity = {
    standing: "live_hypothesis",
    candidate: best.cand.qid,
    label: best.cand.label,
    supportRefs: best.support,
    attackRefs: [],
  };
  out.reason = "folding the candidate's ground onto the referent's ground makes the same difference (" + best.support.join(", ") + "); the identity is bound as a reading — the person is the oracle";

  const links = { qid: best.cand.qid, label: best.cand.label, description: best.cand.description };
  if (best.cand.enwiki) {
    const wp = linkImpl ? await linkImpl.wikipedia(best.cand.enwiki, { ua }) : await wikipediaStructured(best.cand.enwiki, { ua });
    links.wikipedia = wp ? { ...wp, tiedTo: { qid: best.cand.qid, via: "enwiki sitelink" } } : null;
  }
  if (best.cand.image) {
    const im = linkImpl ? await linkImpl.commonsImage(best.cand.image, { ua }) : await commonsImage(best.cand.image, { ua });
    links.commonsImage = im ? { ...im, tiedTo: { qid: best.cand.qid, via: "P18" } } : null;
  }
  if (best.cand.commonsCategory) {
    const cc = linkImpl ? await linkImpl.commonsCategory(best.cand.commonsCategory, { ua }) : await commonsCategory(best.cand.commonsCategory, { ua });
    links.commonsCategory = cc ? { ...cc, tiedTo: { qid: best.cand.qid, via: "P373" } } : null;
  }
  out.links = links;
  return out;
}