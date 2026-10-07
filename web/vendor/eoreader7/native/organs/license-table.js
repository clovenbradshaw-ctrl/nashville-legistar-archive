// organs/license-table.js — the ONE license table every medium reads (the
// Ostrom panel: one witness grammar, one license table). A source's license
// is read here, by SPDX id or by the words a source uses for it, and judged
// here: whether a part may be taken under it, and whether its notice must
// travel with the part. No regular expressions.

/** The licenses a part may be taken under, set by hand 2026-09-27 from the
 *  OSI's permissive family plus the public-domain dedications (no copyleft:
 *  a part must not bind the artifact it lands in). */
export const PERMISSIVE = Object.freeze(new Set(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "CC0-1.0", "Unlicense", "CC-PDDC"]));
/** Licenses under which the notice must travel with every copy (the rest of
 *  PERMISSIVE ask for nothing), set by hand 2026-09-27 from their texts. */
export const NOTICE_REQUIRED = Object.freeze(new Set(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0"]));
/** The words sources use for a license, to its SPDX id — set by hand
 *  2026-09-27 from the sources read so far (Mutopia's LilyPond headers). */
export const LICENSE_WORDS = Object.freeze({
  "public domain": "CC-PDDC",
  "creative commons attribution-sharealike 3.0": "CC-BY-SA-3.0",
  "creative commons attribution-sharealike 4.0": "CC-BY-SA-4.0",
  "creative commons attribution 3.0": "CC-BY-3.0",
  "creative commons attribution 4.0": "CC-BY-4.0",
});

const canon = (id) => {
  const s = String(id ?? "").trim();
  const words = LICENSE_WORDS[s.toLowerCase()];
  if (words) return words;
  return [...PERMISSIVE].find((p) => p.toLowerCase() === s.toLowerCase()) ?? null;
};

/** The license a source states, read as SPDX: "MIT", { type: "MIT" },
 *  "(MIT OR Apache-2.0)" (one may be chosen), "MIT AND ISC" (all bind), or a
 *  source's own words ("Public Domain"). -> { ok, chosen, all } — ok when a
 *  permissive reading exists. */
export function readLicense(stated) {
  let s = typeof stated === "object" && stated ? String(stated.type ?? "") : String(stated ?? "");
  s = s.split("(").join(" ").split(")").join(" ").trim();
  if (!s) return { ok: false, chosen: null, all: [] };
  const ors = s.split(" OR ").flatMap((x) => x.split(" or "));
  for (const alt of ors) {
    const ands = alt.split(" AND ").flatMap((x) => x.split(" and ")).map((x) => x.trim()).filter(Boolean);
    const ids = ands.map(canon);
    if (ids.length && ids.every((id) => id && PERMISSIVE.has(id))) return { ok: true, chosen: ids.join(" AND "), all: ids };
  }
  return { ok: false, chosen: canon(s), all: [] };
}
