// parmenides-forms.js — the CLDR-backed FORM RESOLVER for dates and numbers, the
// `values` organ Parmenides injects. Omnilanguage by construction: a surface is
// resolved by testing it against the RECEIVED month-name maps that Intl
// generates for every locale (Unicode CLDR, giver-named) — the language is
// never guessed or detected; whichever locale's generated forms the surface
// participates in resolves it. Structural forms are covered; word-numbered
// days are the disclosed lexical residue (a typed gap, never a guess).

const MONTH_DAY = (m, d) => new Date(Date.UTC(1812, m - 1, d));
const FOLD = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLowerCase().trim();

// The locales whose generated month maps the resolver consults. A surfaced
// language needs no registration beyond a locale here — the map is CLDR's.
const LOCALES = ["en", "ru", "de", "fr", "es", "it", "pt", "nl", "pl", "tr", "uk", "ar", "he", "ja", "zh", "ko"];

let monthMaps = null;
function monthMap(locale) {
  const fmt = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });
  const map = {};
  for (let m = 1; m <= 12; m++) map[FOLD(fmt.format(MONTH_DAY(m, 15)))] = m;
  return map;
}
function allMaps() {
  if (monthMaps) return monthMaps;
  monthMaps = LOCALES.map((l) => ({ locale: l, map: monthMap(l) }));
  return monthMaps;
}

/**
 * resolve(surface, ctx) — a surface to a canonical value, or a typed gap.
 * A month name from ANY locale's generated map + a numeric day (+ optional
 * year) resolves; the year falls back to ctx.year when absent. Returns
 * {value: "YYYY-MM-DD"} on success, or {gap: <type>} — never a guess.
 */
export function resolveDate(surface, { year = null, day = null } = {}) {
  const s = FOLD(surface);
  if (!s) return { gap: "no_surface" };
  let month = null;
  let loc = null;
  for (const { locale, map } of allMaps()) {
    for (const [name, m] of Object.entries(map)) {
      if (s.includes(name)) { month = m; loc = locale; break; }
    }
    if (month) break;
  }
  if (!month) return { gap: "no_month_in_any_generated_map", surface };
  const dayMatch = s.match(/(?:^|\D)(\d{1,2})(?:st|nd|rd|th)?(?:\D|$)/);
  let d = day ?? (dayMatch ? Number(dayMatch[1]) : null);
  if (d == null || d < 1 || d > 31) return { gap: "day_not_numeric_or_out_of_range", surface, month };
  const yearMatch = s.match(/(?:^|\D)(18|19|20)\d{2}(?:\D|$)/);
  const y = yearMatch ? Number(yearMatch[0].trim()) : year;
  if (!y) return { gap: "no_year", surface, month, day: d };
  return { value: `${y}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`, via: `clrd:${loc}` };
}

/** surfacesOf(value) — every generated surface of a canonical date, so the
 *  equivalence test can go the other way: a material surface is the form
 *  iff it is one of these. */
export function surfacesOfDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const out = [];
  for (const locale of LOCALES) {
    try {
      const fmt = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
      out.push({ locale, text: fmt.format(dt) });
    } catch { /* skip */ }
  }
  return out;
}

/** A single `values` bundle Parmenides can inject: resolve + surfaces. */
export function makeParmenidesForms() {
  return {
    resolve: (s) => resolveDate(s),
    surfaces: (value) => surfacesOfDate(value),
  };
}