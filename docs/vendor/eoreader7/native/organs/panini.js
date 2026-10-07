// panini.js — Pāṇini, the archon of PRONUNCIATION: the sound a referent
// carries, and the confusions a byte-reader cannot see.
//
// Handle: Pāṇini, the grammarian of Sanskrit. His Śikṣā systematized phonetics
// (where a sound is made, how it is made) four centuries before anyone
// attempted a grammar of a spoken language; the Aṣṭādhyāyī opens with the
// fourteen Śiva-sūtras, a bare table of sound-classes that the whole grammar
// then indexes. The whole project's own grammar-lens section already cites
// his kāraka role theory. Here he owns pronunciation — the one stratum a
// byte reader cannot read.
//
// WHY THIS ARCHON EXISTS. Reading is byte-first; this instrument reads text.
// But the register's own law (LEVELS.md S1, the heard rule) says a reading
// should work as well if it only HEARD the material. A pronunciation prior
// (PronunciationPrior@1 in live_priors) supplies the heard stratum: real
// phone sequences, per language, per surface word. Pāṇini is the archon who
// checks that the reading uses the heard stratum correctly — and the ONE
// thing that cannot be done with bytes alone:
//
//   homophone     two DIFFERENT words with near-identical sound
//                 ("one"/"was" at phone-distance 0.014, "in"/"an" at 0.021 —
//                 measured on the eng manifest). A byte-fold reader (P62)
//                 folds diacritics and compares forms; it CANNOT see that
//                 these are confusable. Pāṇini can.
//   heteronym     one spelling, MULTIPLE pronunciations — the READ/READ/RED
//                 class: "read" is /ɹiːd/ (present) or /ɹɛd/ (past), and
//                 past-read is homophonous with "red", a DIFFERENT referent.
//                 The manifest keys by surface form and carries ONE
//                 pronunciation; the READING decides which, per referent
//                 (P11/P38: referent identity is never string identity).
//
// THE ONE RULE, THE ONE GATE (P11/P38, the referent law):
//   pronunciation is a property of a REFERENT, never of a surface string.
//   Two different referents that sound alike are a CONFUSABLE, flagged (never
//   merged — Pāṇini refuses, he does not convict). One referent whose
//   surfaces carry different pronunciations is a HETERONYM, and the reading
//   must name which it heard — a surface form with one dictionary entry but
//   no referent resolution is a GAP, never an answer.
//
// SEVERITIES, Gary's own ladder:
//   FLAG   a confusable pair is in view (two distinct referents, near-
//          identical sound) — the caller should know the reading could
//          mishear, and is never asked to pick.
//   REFUSE a heteronym resolved by surface form alone, with no referent
//          binding — the reading would be asserting a pronunciation the
//          material did not establish.
//
// PURE: no fetch, no DOM, no storage. The PronunciationPrior@1 manifests are
// injected (`manifestOf`), the comparative layer (`wordDistance`) is
// injected, and the referent index (`resolve`) is injected — tested against
// the real ones, exactly as Gary tests against the real firewall organs.
//
// The register lives in solon.js — the one authoritative list; this file
// does not restate it.

export const SEVERITY = Object.freeze({ STRIKE: "strike", REFUSE: "refuse", FLAG: "flag" });

export const RULES = Object.freeze([
  { id: "homophone-in-view", cites: "LEVELS.md S1 (the heard rule); PronunciationPrior@1 (live_priors)", severity: SEVERITY.FLAG, says: "two distinct referents with near-identical sound are flagged — the reading could mishear, and is never asked to pick" },
  { id: "heteronym-unsolved", cites: "P11/P38 (referent identity is never string identity)", severity: SEVERITY.REFUSE, says: "one spelling, multiple pronunciations — refused unless the reading names which referent it heard" },
  { id: "pronunciation-is-referent-keyed", cites: "P11/P38", severity: SEVERITY.FLAG, says: "a surface form alone never decides a pronunciation; the referent does" },
]);

/** The confusable phone-distance floor, measured on the eng manifest: 18
 *  genuine homophone pairs sit at < 0.05; the closest RANDOM pair the null
 *  produced in 300 draws was 0.356. Reused as a floor, never re-derived. */
export const CONFUSABLE_DISTANCE = 0.05;
/** The heteronym sense-gap: two pronunciations are DISTINCT senses when they
 *  are not confusable with each other — a re-render of the same sound sits
 *  below the confusable floor, while READ present /ɹiːd/ vs READ past /ɹɛd/
 *  (a minimal pair, distance 0.089 measured) sit above it. The same measured
 *  floor, asked the other direction: is this a second sound or the same sound
 *  re-rendered? */
export const HETERONYM_DISTANCE = CONFUSABLE_DISTANCE;

const clip = (s, n = 60) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** phonemesOf(ipa) — split a pronunciation into phone tokens (base + modifiers),
 *  exactly as the comparative layer does, so the archon and the comparator
 *  never disagree on what a phone is. */
export function phonemesOf(ipa) {
  const s = String(ipa ?? "");
  const MODIFIER = new Set(["ʲ", "ˤ", "ˠ", "ʷ", "ʰ", "˞", "ː", "ˑ", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  const out = [];
  for (const ch of s.normalize("NFC")) {
    if (ch === " " || ch === "\t" || ch === "ˈ" || ch === "ˌ" || ch === "." || ch === "-" || ch === '"' || ch === "(" || ch === ")") continue;
    const combining = /[\u0300-\u036f]/.test(ch) || MODIFIER.has(ch);
    if (combining && out.length) out[out.length - 1].modifiers += ch;
    else out.push({ phone: ch, modifiers: "" });
  }
  return out;
}

/**
 * makePanini({ manifestOf, dictionary, wordDistance, resolve, language }) —
 * the archon, organs injected (the cast.js posture).
 *
 * `manifestOf(lang)` returns the PronunciationPrior@1 manifest (one
 * pronunciation per surface, from the reading's own engine — the reading's
 * stratum). `dictionary` is the ARCHON's own access: an object
 * { surface: [ipa, ipa2, ...] } carrying MULTIPLE senses per surface — the
 * READ/READ/RED class lives here, because the engine itself holds one
 * sense (measured: espeak-ng renders "read" as /ɹiːd/ only, never /ɹɛd/).
 * When a dictionary is present, the heteronym rule reads it; absent, the
 * rule can only refuse on the manifest's single sense and says so.
 * `wordDistance(ipaA, ipaB)` returns {distance}; `resolve(surface)` returns
 * the Set of referent ids that surface resolves to (cast.js's own resolver
 * — P11/P38, one implementation of "the same name").
 *
 * Returns { check, hand, decision, pronunciationsOf, referentFor } in
 * Gary's shape.
 */
export function makePanini({ manifestOf = null, dictionary = null, wordDistance = null, resolve = null, language = "eng" } = {}) {
  const add = (findings, id, detail, extra = {}) => {
    const rule = RULES.find((r) => r.id === id);
    findings.push({ rule: id, severity: rule?.severity ?? SEVERITY.FLAG, cites: rule?.cites ?? null, detail, ...extra });
  };

  /** pronunciationsOf(surface) — every sense the reading has access to. The
   *  ARCHON's own dictionary first (multi-sense, the READ/READ/RED class);
   *  the manifest's single pronunciation beside it. 0 senses = a GAP (word
   *  absent everywhere); 1 = ordinary; 2+ = a heteronym. */
  function pronunciationsOf(surface) {
    const fromDict = dictionary && Array.isArray(dictionary[surface]) && dictionary[surface].length
      ? dictionary[surface].map((p) => String(p))
      : null;
    const m = typeof manifestOf === "function" ? manifestOf(language) : null;
    const fromManifest = m?.words?.[surface]?.ipa ? [m.words[surface].ipa] : null;
    const all = [...(fromDict ?? []), ...(fromManifest ?? [])];
    if (!all.length) {
      return { refused: { type: "word_gap", detail: `"${surface}" has no pronunciation in the prior or the dictionary` } };
    }
    return { pronunciations: [...new Set(all)], from: fromDict ? (fromManifest ? "dictionary+manifest" : "dictionary") : "manifest", entry: m?.words?.[surface] ?? null };
  }

  /** referentFor(surface) — which referents a surface resolves to, or a typed
   *  gap when no resolver was injected. Never a nearest guess. */
  function referentFor(surface) {
    if (typeof resolve !== "function") return { refused: { type: "no_resolver", detail: "no referent index injected — pronunciation cannot be referent-keyed" } };
    const ids = resolve(surface) ?? new Set();
    if (!ids.size) return { refused: { type: "no_referent", detail: `"${surface}" resolves to no referent` } };
    return { referents: ids };
  }

  /**
   * check(words, { surfaces }) — read the heard stratum over a list of
   * surface words. Returns findings, never throws. Each finding names its
   * rule and cites it; a word absent from the prior is a GAP (typed), a word
   * resolving to no referent is a GAP, and a heteronym resolved without a
   * referent binding is REFUSED.
   */
  function check(words, { surfaces = null } = {}) {
    const list = Array.isArray(words) ? words : [];
    const findings = [];
    const gaps = [];
    const m = typeof manifestOf === "function" ? manifestOf(language) : null;
    if (!m) { gaps.push({ type: "no_manifest", detail: "no PronunciationPrior@1 injected" }); return { findings, gaps }; }
    if (typeof wordDistance !== "function") { gaps.push({ type: "no_comparator", detail: "no wordDistance injected" }); return { findings, gaps }; }

    // 1. HOMOPHONES — every pair of DIFFERENT surfaces in view, near-identical
    //    sound. Fires only when both sides are in the prior; a gap is never
    //    compared (a missing pronunciation proves nothing).
    const present = list.filter((w) => m.words?.[w]?.ipa);
    for (let i = 0; i < present.length; i++) for (let j = i + 1; j < present.length; j++) {
      const a = present[i], b = present[j];
      if (a === b) continue;
      const d = wordDistance(m.words[a].ipa, m.words[b].ipa);
      if (d.distance < CONFUSABLE_DISTANCE) {
        // same referent? then it is not a confusable, it is the same thing
        // said twice — pronunciation is referent-keyed.
        let sameReferent = false;
        if (typeof resolve === "function") {
          const ra = resolve(a) ?? new Set(), rb = resolve(b) ?? new Set();
          sameReferent = [...ra].some((x) => rb.has(x));
        }
        if (!sameReferent) {
          add(findings, "homophone-in-view", `"${a}" [${m.words[a].ipa}] and "${b}" [${m.words[b].ipa}] are confusable at distance ${d.distance.toFixed(3)}`, { a, b, distance: d.distance, ia: m.words[a].ipa, ib: m.words[b].ipa });
        }
      }
    }

    // 2. HETERONYMS — one surface, more than one pronunciation. The
    //    archon's own dictionary carries the senses (READ present /ɹiːd/,
    //    READ past /ɹɛd/); the manifest alone holds one per surface (the
    //    engine's own limit, measured: espeak-ng renders "read" only as
    //    /ɹiːd/). A surface with 2+ senses is REFUSED unless the reading's
    //    referent binding names which it heard.
    for (const w of list) {
      const pron = pronunciationsOf(w);
      if (pron.refused) { gaps.push({ type: "word_gap", word: w, detail: pron.refused.detail }); continue; }
      const senses = pron.pronunciations;
      if (senses.length < 2) continue;
      // distinct senses (a re-render of the same sound is not a second sense)
      const bare = (s) => String(s ?? "").replace(/^\/|\/$/g, "");
      const distinct = [];
      for (const s of senses) if (!distinct.some((d) => wordDistance(bare(d), bare(s)).distance < HETERONYM_DISTANCE)) distinct.push(s);
      if (distinct.length < 2) continue;
      // same referent for all senses? then it is one being with free
      // pronunciation — not a heteronym. Different referents = refuse.
      let sameReferent = false;
      if (typeof resolve === "function") {
        const ids = [...(resolve(w) ?? new Set())];
        sameReferent = ids.length === 1; // one referent = the reading has named which
      }
      if (!sameReferent) {
        add(findings, "heteronym-unsolved", `"${w}" carries ${distinct.length} distinct pronunciations [${distinct.map((d) => `/${d}/`).join(", ")}] — refused unless the reading names which referent it heard`, { w, pronunciations: distinct, from: pron.from });
      }
    }

    return { findings, gaps, words: list.length, present: present.length };
  }

  /** hand(words, opts) — Gary's door shape: check, and report. */
  function hand(words, opts = {}) {
    const read = check(words, opts);
    return { words, ...read, refused: read.findings.filter((f) => f.severity === SEVERITY.REFUSE) };
  }

  /** decision({ act, turn, read }) — the record line, Gary's own shape:
   *  rules, severities, counts — never the audio or the words themselves. */
  function decision({ act = "hear", turn = null, read = null } = {}) {
    const entry = { act: `panini-${act}` };
    if (turn != null) entry.turn = turn;
    if (!read) return entry;
    entry.words = read.words ?? null;
    entry.present = read.present ?? null;
    entry.findings = (read.findings ?? []).map((f) => ({ rule: f.rule, severity: f.severity, cites: f.cites ?? null }));
    const gaps = [...new Set((read.gaps ?? []).map((g) => g.type))];
    if (gaps.length) entry.gaps = gaps;
    return entry;
  }

  return { check, hand, decision, pronunciationsOf, referentFor };
}

// ── the READ/READ/RED specimen, built to fail (II.23) ─────────────────────
// The archon's whole reason to exist, as a fixture the tests can run against:
// one spelling "read", two pronunciations, three referents. The surface form
// alone cannot decide; only the referent can.
export const READ_READ_RED = Object.freeze({
  surfaces: ["read", "red"],
  pronunciations: { read: ["/ɹiːd/", "/ɹɛd/"], red: ["/ɹɛd/"] },
  note: "READ (present) /ɹiːd/, READ (past) /ɹɛd/, RED /ɹɛd/. The per-word manifest holds one; the reading must name which referent it heard.",
});