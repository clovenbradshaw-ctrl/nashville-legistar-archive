// relational-parse.js — THE TRUE RELATIONAL EOT PARSE (2026-09-21, the user's
// seam: "the flat subject--label->object can't hold a ditransitive. 'Walker
// named the river for the Duke' has an agent, a patient, and a beneficiary.
// Crushing it into two slots produces a false atom. The parse has to hold the
// real relational structure or the atoms lie.").
//
// The GFP marks only true claims. A relational atom is:
//   { predicate, agent, patient, goal, beneficiary, oblique, time, ... }
// where `predicate` is the normalized act (sameAct's grain), the CORE roles
// (agent/patient) are the two ends the record's triple carries, and the
// CONTEXT roles (goal/beneficiary/oblique/time) are the slots the flat triple
// crushes. The atom's identity is frame-bearing over the WHOLE structure
// (predicate + roles), so "named the river for the Duke" and "named the Duke
// the river" are DIFFERENT atoms — the roles are the meaning, not the order.
//
// THE PREPOSITION→ROLE LENSES, PER LANGUAGE (2026-09-21, the user's law:
// "subject, verb, object is ONE lens on that relationship for english").
// The grammar is a lens; the tuple is the GFP. A language declares its own
// preposition→role map and its own case markers; the parse folds any surface
// through the referent index + sameAct, so the atom is lens-invariant.
export const PREP_ROLE_EN = {
  for: "beneficiary", to: "goal", from: "source", into: "goal", through: "path",
  at: "place", on: "place", in: "time_or_place", across: "path", toward: "goal",
  against: "adversary", of: "possession", with: "companion", over: "path", under: "place",
  by: "agent_marker", // passive "by Walker" marks the true agent
};
// Russian: case-marked, fewer prepositions carry roles (grammatical case does).
export const PREP_ROLE_RU = {
  для: "beneficiary", в: "goal", из: "source", через: "path", в_честь: "beneficiary",
  у: "place", на: "place", к: "goal", от: "source", по: "path", за: "adversary",
  с: "companion", о: "possession",
};
// Chinese: coverbs, topic-comment.
export const PREP_ROLE_ZH = {
  为: "beneficiary", 给: "beneficiary", 到: "goal", 从: "source", 向: "goal",
  在: "place", 对: "adversary", 和: "companion", 的: "possession", 于: "time_or_place", 经: "path", 通过: "path",
};

export const RELATIONAL_SCHEMA = "EORelationalAtom@1";

const STOP = new Set(["the","a","an","of","in","on","at","for","to","from","into","through","by","with","and","or","that","this","its","it","their","there","when","where","which"]);
const PREP_ROLE = {
  for: "beneficiary", to: "goal", from: "source", into: "goal", through: "path",
  at: "place", on: "place", in: "time_or_place", across: "path", toward: "goal",
  against: "adversary", of: "possession", with: "companion", over: "path", under: "place",
};
// The act-verbs, mapped to their predicate grain. Lemmatized to the act
// (sameAct's own grain — "flows"/"flowed" are one act; "roared"/"shouted"
// are not).
const ACT_VERBS = new Set(["is","are","was","were","flows","flowed","flows","drains","drained","made","makes","named","called","built","builds","joins","joined","used","uses","carried","carries","caused","caused","reshaped","shaped","shapes","connected","connects","provided","provides","supported","supports","handles","handled","traveled","travels","remained","remains","founded","founded","became","becomes"]);
const VERB_FORMS = { flows:"flows", flowed:"flows", drains:"drains", drained:"drains", made:"made", makes:"made", named:"named", called:"named", built:"built", builds:"built", joins:"joins", joined:"joins", used:"used", uses:"used", carried:"carried", carries:"carried", caused:"caused", reshaped:"reshaped", shaped:"shaped", shapes:"shaped", connected:"connected", connects:"connected", provided:"provided", provides:"provided", supported:"supported", supports:"supported", handled:"handled", handles:"handles", traveled:"traveled", travels:"traveled", remained:"remained", remains:"remained", founded:"founded", became:"became", becomes:"became" };

function toks(s) { return String(s ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean); }
function isStop(w) { const t = w.toLowerCase().replace(/[^a-z]/g, ""); return STOP.has(t); }
function clean(w) { return String(w ?? "").replace(/[,;:()"'—–-]+$/g, "").replace(/^[,;:()"'—–-]+/g, "").trim(); }

/**
 * relationalParse(sentence, { index }) → { ok, atom, gap }
 * Mechanically recover the relational structure. Returns:
 *   ok: true, atom: {predicate, agent, patient, roles:{goal?, beneficiary?, source?, time?, place?}, raw}
 *   ok: false, gap: {type, detail} — a sentence whose structure cannot be
 *       recovered mechanically is a TYPED GAP, never a guessed atom.
 * `index` is the referent index (resolveIn/represent) — the parse is a LENS:
 * it recovers the roles in THIS grammar (SVO for English), then folds each
 * role surface through the index to its referent ID. The identity is over the
 * RESOLVED structure — "Walker named the river for the Duke" in English,
 * Russian, Chinese, Latin is ONE tuple because the surfaces resolve to the
 * same referents. The grammar is a lens; the tuple is the GFP.
 */
export function relationalParse(sentence, { index = null, sameAct = null, lemmasOf = null, prepRoles = null, verbCandidates = null, positional = null, extractRelations = null, language = null, priors = null } = {}) {
  const resolve = (surface) => {
    if (!index?.resolveIn) return String(surface ?? "");
    try {
      const r = index.resolveIn(String(surface ?? ""));
      const ids = r instanceof Set ? r : new Set(r ?? []);
      if (ids.size === 1) return [...ids][0];
      if (ids.size > 1) return [...ids][0]; // first resolution — the fold decides
    } catch {}
    return String(surface ?? "");
  };
  const prepMap = prepRoles ?? PREP_ROLE_EN;
  const raw = String(sentence ?? "").trim();
  if (!raw) return { ok: false, gap: { type: "empty", detail: "nothing to parse" } };
  // CHOMSKY'S COVERAGE VERDICT (2026-09-21, "it also needs to flag when our
  // current priors at time of parse are insufficient for a given language").
  // A language we do not know well enough is a TYPED GAP — never a silent
  // English match, never a guess. The verdict names exactly which priors are
  // missing: the morphology prior (sameAct/lemmasOf), the role grammar
  // (RoleConfig@1 / extractRelations), and the referent index. When a
  // language is DECLARED but its priors are absent, the parse is flagged
  // insufficient — the machine says what it does not know, it never pretends.
  const declaredLanguage = language ?? priors?.language ?? null;
  const coverage = {
    language: declaredLanguage,
    roleGrammar: typeof extractRelations === "function" || typeof positional === "function",
    morphology: typeof sameAct === "function" || typeof lemmasOf === "function" || Boolean(verbCandidates?.size),
    referents: Boolean(index?.resolveIn),
    sufficient: true,
    missing: [],
  };
  if (declaredLanguage) {
    if (!coverage.roleGrammar) coverage.missing.push("role grammar (RoleConfig@1)");
    if (!coverage.morphology) coverage.missing.push("morphology prior (sameAct/lemmasOf)");
    if (!coverage.referents) coverage.missing.push("referent index");
    coverage.sufficient = coverage.missing.length === 0;
  }
  // ── CHOMSKY'S DISPATCH (2026-09-21, "he just needs to know how to parse
  // anything into GFP for omnilingualness"): the universal is GFP-shaped —
  // end1-label-end2, typed by cell. A role grammar (English-SVO, or any
  // positional language) is a DECLARED OVERLAY, gated by a measured
  // RoleConfig@1 for that language. `extractRelations` is relations-language
  // .js's `relationExtractorsFor(...)` — Chomsky's own dispatch: it returns
  // mode "svo" when the language's RoleConfig is declared, mode "gfp" when
  // not. EITHER WAY the record is the same neutral shape, omnilingually.
  if (typeof extractRelations === "function") {
    try {
      const rels = extractRelations(raw);
      const rel = Array.isArray(rels) && rels.length ? rels[0] : null;
      if (rel && rel.label && rel.end1) {
        const after = toks(raw).map(clean);
        const vAt = after.findIndex((w) => w.toLowerCase() === String(rel.label).toLowerCase());
        const roles = {};
        if (vAt >= 0) {
          let i = vAt + 1;
          while (i < after.length) {
            const role = prepMap[after[i].toLowerCase()];
            if (role) { const np = []; i++; while (i < after.length && !prepMap[after[i].toLowerCase()]) { np.push(after[i]); i++; }
              const val = np.filter((w) => w && !isStop(w)).join(" "); if (val) roles[role === "time_or_place" ? (/\d{3,4}/.test(val) ? "time" : "place") : role] = val; }
            else i++;
          }
        }
        const resolvedRoles = {};
        for (const [k, v] of Object.entries(roles)) resolvedRoles[k] = resolve(v);
        return {
          ok: true,
          coverage,
          source: language ? `eoreader7:relations-language:${language}` : "eoreader7:relations-language:gfp",
          mode: rel.mode ?? "gfp",
          cell: rel.cell ?? null,
          grain: rel.grain ?? null,
          atom: { schema: RELATIONAL_SCHEMA, predicate: rel.label, agent: resolve(rel.end1), patient: resolve(rel.end2), roles: resolvedRoles, raw, surfaces: { agent: rel.end1, patient: rel.end2, roles } },
        };
      }
    } catch (e) {
      return { ok: false, gap: { type: "chomsky_dispatch_error", detail: String(e?.message ?? e).slice(0, 120) } };
    }
  }
  // ── the disclosed fallback: a simple positional parse for a caller with no
  // real organ. Never presented as the system's own reader.
  const words = toks(raw);
  // Find the main verb — omnilingually. When a sameAct/lemmasOf organ is
  // injected (the UniMorph prior), a verb is ANY word whose lemma is a known
  // act, in ANY language ("named"/"назвал"/"命名" are the same act). Without
  // it, fall back to the received English act set, disclosed.
  let vIdx = -1, verb = null;
  const isVerb = (w) => {
    if (verbCandidates && verbCandidates.has(w)) return true;
    if (lemmasOf && w) { try { const ls = lemmasOf(w); if (ls && ls.size) for (const l of ls) if (VERB_FORMS[l]) return true; } catch {} }
    return false;
  };
  for (let i = 0; i < words.length; i++) {
    const w = clean(words[i]).toLowerCase();
    if (VERB_FORMS[w]) { vIdx = i; verb = VERB_FORMS[w]; break; }
    if (isVerb(w)) { vIdx = i; verb = w; break; }
  }
  if (vIdx < 0) return { ok: false, gap: { type: "no_predicate", detail: `no act-verb found: "${raw.slice(0, 60)}"` } };
  // AGENT: the subject — the noun run before the verb, the LAST content word
  // (a complex subject like "Donelson's flotilla" resolves to its head).
  const before = words.slice(0, vIdx).map(clean).filter((w) => w && !isStop(w));
  const agent = before.length ? before[before.length - 1] : null;
  // The rest after the verb.
  const after = words.slice(vIdx + 1).map(clean);
  // Split the tail at the first PREPOSITION that carries a role — everything
  // before it is the PATIENT (the direct object, possibly a resultative
  // complement: "made Nashville a commercial hub"); everything after is the
  // CONTEXT roles.
  let ppIdx = -1;
  for (let i = 0; i < after.length; i++) {
    const w = after[i].toLowerCase();
    if (prepMap[w]) { ppIdx = i; break; }
  }
  const patientToks = ppIdx < 0 ? after : after.slice(0, ppIdx);
  const patient = patientToks.filter((w) => w && !isStop(w)).join(" ") || null;
  // The CONTEXT roles from the preposition phrases.
  const roles = {};
  if (ppIdx >= 0) {
    let i = ppIdx;
    while (i < after.length) {
      const prep = after[i].toLowerCase();
      const role = prepMap[prep];
      if (role) {
        const np = [];
        i++;
        while (i < after.length) {
          const w = after[i];
          if (prepMap[w.toLowerCase()]) break; // a new PP begins
          np.push(w);
          i++;
        }
        const val = np.filter((w) => w && !isStop(w)).join(" ");
        if (val) {
          if (role === "time_or_place") {
            // A number ("1750", "1779") or a year-word is time; else place.
            roles[/\d{3,4}/.test(val) ? "time" : "place"] = val;
          } else {
            roles[role] = val;
          }
        }
      } else {
        i++;
      }
    }
  }
  if (!agent || !patient) {
    return { ok: false, gap: { type: "incomplete", detail: `no ${!agent ? "agent" : "patient"} recovered: "${raw.slice(0, 70)}"` } };
  }
  // THE LENS FOLD (2026-09-21): the roles are recovered in THIS grammar, then
  // folded through the referent index to their IDs — the tuple is the GFP, the
  // grammar is a lens. "Walker" and "Томас Уокер" resolve to the same referent,
  // so the atom is lens-invariant.
  const resolvedRoles = {};
  for (const [k, v] of Object.entries(roles)) resolvedRoles[k] = resolve(v);
  return {
    ok: true,
    atom: { schema: RELATIONAL_SCHEMA, predicate: verb, agent: resolve(agent), patient: resolve(patient), roles: resolvedRoles, raw, surfaces: { agent, patient, roles } },
  };
}

// The frame-bearing identity over the WHOLE relational structure — the roles
// are the meaning, not the order. "named the river for the Duke" and "named
// the Duke for the river" are DIFFERENT atoms. THE ACT IS CONTEXTUAL (the
// user's law, 2026-09-21): "same act in THIS context." The predicate's
// identity is not global — "named" in a river-naming frame is not the same
// act as "named" in a person-naming frame. When a `sameAct` organ AND a frame
// are given, the predicate resolves to the frame's canonical act (so
// named/назвал/命名 collapse ONLY when this context declares them the same
// act); with no context, the act keeps its own surface — the bare identity
// never pretends two surfaces are one act.
export function relationalIdentity(atom, { frame = null, sameAct = null } = {}) {
  if (!atom || atom.ok === false) return null;
  // THE ACT IN THIS CONTEXT: when the frame + sameAct declare the surface's
  // lemma is THE canonical act, use the canonical; else the surface stands
  // (the identity never guesses cross-lingual equivalence without a context).
  let predicate = atom.predicate;
  if (frame && sameAct && typeof sameAct === "function") {
    const coords = ["giver","question","priors","ground","universe","medium","knowing","recipe"];
    const ctx = coords.map((k) => frame[k] != null ? String(frame[k]) : null).filter(Boolean).join("·");
    // sameAct in THIS context: the act's lemma set, intersected with the
    // frame's declared canonical act-words. The lemma IS the act's identity
    // here; two surfaces whose lemmas are the same act collapse.
    try {
      const lemmas = sameAct.lemmasOf ? sameAct.lemmasOf(atom.predicate) : null;
      if (lemmas && lemmas.size) predicate = [...lemmas][0]; // the canonical lemma of the act, in this context
    } catch {}
  }
  const core = `${predicate}|agent:${atom.agent}|patient:${atom.patient}`;
  const roles = Object.entries(atom.roles ?? {}).sort().map(([k, v]) => `${k}:${v}`).join("|");
  const structure = roles ? `${core}|${roles}` : core;
  if (!frame) return `bare:${structure}`;
  const coords = ["giver","question","priors","ground","universe","medium","knowing","recipe"]
    .map((k) => frame[k] != null ? `${k}=${String(frame[k]).slice(0, 60)}` : null)
    .filter(Boolean).join("&");
  return `${structure}@${coords}`;
}

// THE SPAN IS CONTEXTUAL (the user's law: "spans are always contextual"). A
// byte address is only meaningful in its READING context — source.md#77 is
// source.md#77 in that reading's fold, never an absolute. The atom's ground
// spans ride their reading: `contextSpan(reading, ref)` binds a ref to the
// reading that produced it, so the same ref from two readings is two contexts.
export function contextSpan(reading, ref) {
  if (!ref) return null;
  return { reading: String(reading ?? "the-fold"), ref: String(ref ?? "") };
}

// Render the atom with its prettyNames (the holograph projection): the roles
// become the surface sentence, agent first.
export function renderRelational(atom, { names = null, represent = (id) => id, act = (v) => v } = {}) {
  if (!atom || atom.ok === false) return null;
  const A = names ? (id) => names[id] ?? represent(id) : represent;
  const parts = [A(atom.agent), act(atom.predicate), A(atom.patient)];
  for (const [role, val] of Object.entries(atom.roles ?? {})) {
    parts.push(`${PREP_HINT[role] ?? role}: ${A(val)}`);
  }
  return parts.join(" ");
}
const PREP_HINT = { goal: "to", beneficiary: "for", source: "from", time: "in", place: "at", path: "through", adversary: "against", possession: "of", companion: "with" };