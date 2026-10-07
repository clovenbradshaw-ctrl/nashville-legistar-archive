// aliases.js — WHAT ELSE THIS MATERIAL CALLS THE SAME THING, IN ITS OWN WORDS.
//
// `surfaces.js::namesCorefer` already folds one very common kind of alias:
// a name shortened by DROPPING WORDS. Measured live on real prose, this
// hole was found: a name shortened by INITIALS is not folded at all.
//
//   namesCorefer("Regional Transit Authority", "Transit Authority") -> true
//   namesCorefer("RTA", "Regional Transit Authority")               -> false
//
// So the alias layer has a hole exactly where a name is shortened by
// INITIALS rather than by omission. The tempting fix is a rule that builds
// an initialism and compares it. This module deliberately does not do that,
// for the reason the whole project keeps re-earning: a rule that derives a
// name is a rule that can INVENT one, and "the same referent" has never
// been safe to decide from the shape of a string (L2's capitalisation veto;
// the cube refused as a content classifier; P79's kind standing).
//
// The material almost always says it itself. Prose that introduces an
// abbreviation glosses it, once, at a byte address:
//
//   "the Regional Transit Authority (RTA)"
//   "the Central Zoning Board (CZB)"
//
// That is a DECLARATION, not an inference, and reading it is the same act
// as reading any other claim: nominate structurally, wall against the
// bytes, keep the address. An initialism is then one SUBTYPE of alias that
// falls out for free, along with every other short form a text bothers to
// introduce — a nickname, a stock ticker, a d/b/a, a case caption. Nothing
// here knows what an acronym is.
//
// WHERE THE SHAPES COME FROM. Not from here. `live_priors` measures which
// declaration shapes English prose actually uses, over its own corpus, and
// ships the result as `AliasDeclarationPrior@1` — each shape carrying how
// often it fired and how often the form it introduced was then really used.
// Measured over 900 files / 20.8MB: the parenthetical fires 23,375 times at
// a 0.478 confirm rate; "also known as", "abbreviated", "d/b/a" and the
// rest fire in the single digits or never. This module receives that prior,
// applies the caller's declared floors to it, and holds no declaration
// vocabulary of its own.
//
// THE WALL. A gloss is admitted only when the material goes on to USE it:
// the alias must occur at least `minUses` times in the whole text, the
// declaration itself counting as one. The giver for that floor is the same
// structural minimum this project uses wherever recurrence has to mean
// anything (binding's arrivals floor, WITNESS_FLOOR, FORM_MIN_ARRIVALS —
// all 2, all because one arrival has nothing to be compared with). A gloss
// the text never uses again is an aside, and is returned as a typed
// refusal rather than dropped, so a caller can see what was turned away.
//
// Every admitted alias carries the sentence that declared it and that
// sentence's own byte span, re-read from the text before it is returned
// (P5.2) — an alias is evidence like anything else, and it is citable.

const foldSpaces = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const ALIAS_REFUSALS = Object.freeze({
  NO_SHAPE: "no-shape-cleared-the-floor", // the prior offered nothing the caller's floors admit
  USED_ONCE: "used-once",          // glossed and never used again — an aside, not a name
  NOT_A_NAME: "not-a-name",        // the gloss is prose, a date, a figure — not a form a text uses as a name
  SAME_AS_FULL: "same-as-full",    // the gloss restates the name it glosses
  ADDRESS_UNVERIFIED: "address-unverified", // the sentence did not read back at its own offsets
});

/**
 * shapesFrom(prior, { minConfirmRate, minFires }) — the declaration shapes a
 * received AliasDeclarationPrior@1 offers that clear the caller's own
 * floors, each still carrying the evidence that earned it. A shape the
 * corpus never confirmed is not silently dropped: it is simply not
 * returned, and the caller can read the prior to see why.
 */
export function shapesFrom(prior, { minConfirmRate, minFires } = {}) {
  if (!prior || prior.schema !== "AliasDeclarationPrior@1")
    throw new TypeError("shapesFrom: an AliasDeclarationPrior@1 is received, with its giver — this module holds no declaration vocabulary of its own");
  if (!Number.isFinite(minConfirmRate) || !Number.isFinite(minFires))
    throw new TypeError("shapesFrom: minConfirmRate and minFires are declared by the caller (P9) — which measured shapes are good enough is never decided here");
  const out = [];
  for (const [id, sh] of Object.entries(prior.shapes ?? {})) {
    if (!Number.isFinite(sh?.confirm_rate) || sh.confirm_rate < minConfirmRate) continue;
    if ((sh.fires ?? 0) < minFires) continue;
    out.push({
      id,
      connective: sh.connective,
      re: new RegExp(sh.source, "g"),
      full: sh.full_group,
      alias: sh.alias_group,
      evidence: { fires: sh.fires, confirmed: sh.confirmed, confirm_rate: sh.confirm_rate },
    });
  }
  return out;
}

/**
 * declaredAliases(text, { splitSentences, minUses, shapes }) — the aliases
 * THIS material declares, each with the sentence that declared it and that
 * sentence's byte span.
 *
 *   splitSentences  injected; this module holds no sentence rule of its own.
 *   minUses         declared by the caller (P9): how many times the alias
 *                   must occur in the whole text, the declaration included,
 *                   before a gloss counts as a name the material uses.
 *   shapes          from `shapesFrom(prior, floors)` — received, with a
 *                   giver and with the corpus evidence that earned each.
 *
 * Returns { aliases, refused } — never a throw on ordinary material.
 */
export function declaredAliases(text, { splitSentences, minUses, shapes } = {}) {
  if (typeof splitSentences !== "function")
    throw new TypeError("declaredAliases: splitSentences is injected — this module holds no sentence rule of its own");
  if (!Number.isInteger(minUses) || minUses < 1)
    throw new TypeError("declaredAliases: minUses is declared — how often a gloss must recur before it is a name is never a constant chosen here");
  if (!Array.isArray(shapes))
    throw new TypeError("declaredAliases: shapes are received from an AliasDeclarationPrior@1 — this module holds no declaration vocabulary of its own");
  if (!shapes.length) return { aliases: [], refused: [{ why: ALIAS_REFUSALS.NO_SHAPE }] };

  const src = String(text ?? "");
  const aliases = [];
  const refused = [];
  if (!src.trim()) return { aliases, refused };

  // Case-insensitively: a text that writes "The Partnership" in one
  // sentence and "the Partnership" in the next has used the same name
  // twice, and counting them apart would refuse a name on typography.
  const usesOf = (form) => {
    const m = src.match(new RegExp(`(?<![\\w'’-])${escapeRe(form)}(?![\\w'’-])`, "gi"));
    return m ? m.length : 0;
  };

  for (const s of splitSentences(src)) {
    const sentence = String(s?.text ?? "");
    const start = s?.start ?? -1;
    const end = start >= 0 ? start + sentence.length : -1;
    for (const shape of shapes) {
    shape.re.lastIndex = 0;
    for (const m of sentence.matchAll(shape.re)) {
      const full = foldSpaces(m[shape.full]);
      const alias = foldSpaces(m[shape.alias]);
      if (!full || !alias) continue;
      const note = { full, alias, sentence, start, end, shape: shape.id };
      // A name a text uses is a short run of word characters — not prose, not
      // a date, not a figure. This is a shape test on the GLOSS ONLY; it says
      // nothing about whether the two names mean the same thing, which is
      // what the material's own declaration and the use-wall are for.
      if (!/^[\w'’.&-]+(?:\s+[\w'’.&-]+){0,3}$/.test(alias) || /^\d+$/.test(alias)) { refused.push({ ...note, why: ALIAS_REFUSALS.NOT_A_NAME }); continue; }
      if (foldSpaces(alias).toLowerCase() === full.toLowerCase()) { refused.push({ ...note, why: ALIAS_REFUSALS.SAME_AS_FULL }); continue; }
      if (usesOf(alias) < minUses) { refused.push({ ...note, why: ALIAS_REFUSALS.USED_ONCE, uses: usesOf(alias) }); continue; }
      // P5.2 — the address is re-read from the text before it is shipped.
      if (start < 0 || src.slice(start, end) !== sentence) { refused.push({ ...note, why: ALIAS_REFUSALS.ADDRESS_UNVERIFIED }); continue; }
      aliases.push({ ...note, uses: usesOf(alias) });
    }
    }
  }
  return { aliases, refused };
}

/**
 * aliasIndex(declarations) — every form the material offers for one thing,
 * folded to a map from an alias to the full name that declared it. A later
 * declaration of the same alias does not overwrite an earlier one; both
 * fulls are kept, because a text that glosses one abbreviation two ways has
 * said something a reader should see rather than have resolved for them.
 */
export function aliasIndex(aliases) {
  const byAlias = new Map();
  for (const a of aliases ?? []) {
    const k = a.alias.toLowerCase();
    if (!byAlias.has(k)) byAlias.set(k, { alias: a.alias, fulls: [], witnesses: [] });
    const e = byAlias.get(k);
    if (!e.fulls.includes(a.full)) e.fulls.push(a.full);
    e.witnesses.push({ start: a.start, end: a.end, sentence: a.sentence });
  }
  return byAlias;
}

// ── THERE IS NO REAL NAME; THE REFERENT IS ITS CLASS OF ALIASES ─────────────
// Handle: Frege — the Morning Star and the Evening Star are one object and two
// names; the name is never the thing. This module already refuses to decide
// "the same referent" from the shape of a string; the same discipline forbids
// privileging ONE form as the name. The text declared that two forms are one
// thing — the "full" form ("Regional Transit Authority") is the gloss's LEFT
// side, not a truth; the initialism is the gloss's RIGHT side, not a nickname.
// Both are ALIASES. The referent is the EQUIVALENCE CLASS, and its identity is
// a byte key over the whole class — never a spelling. Two texts that gloss the
// same pair reach the same key without either agreeing on a name.
//
// A representative form is carried for DISPLAY only, chosen as the byte-least
// form so it is deterministic and explicitly arbitrary — it names nothing.
export function aliasClasses(aliases) {
  const parent = new Map();
  const repr = new Map(); // root-lower form -> a display form (byte-least)
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const add = (x) => { if (!parent.has(x)) parent.set(x, x); return x; };
  const witnesses = new Map();
  for (const a of aliases ?? []) {
    const full = foldSpaces(a.full).toLowerCase(), alias = foldSpaces(a.alias).toLowerCase();
    if (!full || !alias) continue;
    add(full); add(alias);
    parent.set(find(full), find(alias)); // the declared sameness — the whole of the evidence
    if (!witnesses.has(alias)) witnesses.set(alias, []);
    witnesses.get(alias).push({ start: a.start, end: a.end, sentence: a.sentence, shape: a.shape ?? null });
    if (!witnesses.has(full)) witnesses.set(full, []);
  }
  const byRoot = new Map();
  for (const x of parent.keys()) { const r = find(x); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r).push(x); }
  const classes = [];
  for (const [, forms] of byRoot) {
    const uniq = [...new Set(forms)].sort();
    if (uniq.length < 2) continue; // a lone form declared nothing
    classes.push({
      forms: uniq,
      display: uniq[0], // arbitrary (byte-least), for display only — it is not a name
      key: classKey(uniq),
      witnesses: uniq.flatMap((f) => witnesses.get(f) ?? []),
    });
  }
  return classes;
}

// A byte key over the WHOLE class, order-independent — so no single form can be
// the key, and the two directions of a gloss reach the same identity.
function classKey(forms) {
  const s = forms.join("\u0000");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** aliasClassMap(classes) — a form → class-key index, so a surface layer can
 *  resolve any alias to the referent's identity (surfaces.js::referentIdentity). */
export function aliasClassMap(classes) {
  const m = new Map();
  for (const c of classes ?? []) for (const f of c.forms ?? []) m.set(f, c.key);
  return m;
}
