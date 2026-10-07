// native/the-fold/surface/block-profile.mjs — THE PROFILE BLOCK.
//
// Fold invariant: A PROFILE IS A READ OF THE ENTITY'S OWN RELATIONS, TYPED BY
// KIND INDUCTION — never a biography, never a schema. Any surface that already
// shows beings (the fold's Entity panel, the lattice's T3, the notebook's
// dataset, the holodeck's chat) can include this block and get the same
// profile: the entity's induced kind(s), and its key parameters — whatever the
// relations happen to be — each with the functional standing the kind earned
// (fixed · one-at-a-time · many-valued · time-unknown · unexposed).
//
// The block is surface-neutral: `buildProfiles` is the data, `renderProfile`
// and `renderProfileSection` are an HTML fragment, `profilePayload` is the
// JSON a live surface reads, and `profileLines` (from the kernel) is the plain
// text. No surface is privileged; none is required.
import {
  assertionsFromTriples,
  buildEntityProfiles,
  profileLines,
  ENTITY_PROFILE_SCHEMA,
} from "../../kernel/entity-profile.js";

export const PROFILE_BLOCK_SCHEMA = "EOProfileBlock@1";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** The fold's own rows carry a being in `fields.agency`/`fields.place` and a
 *  relation in `kind`; the lattice's hyperlexicon carries subject/verb/object
 *  directly. This reads either into the triple stream kind induction runs on.
 *  A row that names only one end asserts nothing between referents and is
 *  skipped — a profile is built from relations, never from mentions. */
export function triplesFromLinks(links = []) {
  const out = [];
  for (const l of links ?? []) {
    const subject = l.fields?.agency ?? l.subject;
    const verb = l.kind ?? l.verb;
    const object = l.fields?.place ?? l.object;
    if (subject && verb && object) out.push({ id: l.id, subject, verb, object, witnessed: l.witnessed ?? true, seq: l.seq });
  }
  return out;
}

/** buildProfiles({ triples, beings, ... }) -> EOEntityProfiles@1
 *  `beings` is the population (the cast). When omitted, only entities that
 *  asserted something are profiled. Kind-induction options pass straight
 *  through (exposureFloor, kindOptions, asOf, sameValue, witnessed, ...). */
export function buildProfiles({ triples = [], beings = null, identity = (x) => x, ...opts } = {}) {
  const referents = beings ? [...beings].map(String) : null;
  const by = assertionsFromTriples(triples, { referents, identity });
  return buildEntityProfiles(by, { referents, ...opts });
}

const STANDING_LABEL = Object.freeze({
  fixed: "fixed", "one-at-a-time": "one at a time", "many-valued": "many-valued",
  "time-unknown": "time unknown", unexposed: "unexposed", unknown: "no kind",
});

/** One entity's card. Every row is a parameter; its values and standing ride it
 *  so nothing is read as a bare fact. */
export function renderProfile(profile) {
  const kind = profile.kinds.map((k) => k.kindKey.replace(/^kind:[^:]+:/, "")).join(", ");
  const head = `<header class="ep-head"><span class="ep-name">${esc(profile.id)}</span>`
    + (profile.established
      ? `<span class="ep-kind" title="${esc(profile.kinds.map((k) => k.kindKey).join(" · "))}">${esc(kind)}</span>`
      : `<span class="ep-kind none">no kind established</span>`)
    + `<span class="ep-count">${profile.parameters.length} parameter${profile.parameters.length === 1 ? "" : "s"}</span></header>`;
  if (!profile.parameters.length) return `<div class="ep-card">${head}<p class="ep-empty">no relations asserted — nothing to profile</p></div>`;
  const rows = profile.parameters.map((p) => {
    const vals = p.values.slice(0, 8).map((v) => `<span class="ep-val">${esc(v.value)}${v.count > 1 ? `<i>×${v.count}</i>` : ""}</span>`).join("");
    const more = p.values.length > 8 ? `<span class="ep-more">+${p.values.length - 8}</span>` : "";
    return `<div class="ep-row"><span class="ep-rel" title="information weight ${p.informationWeight} · ${p.support}/${profile.basis.population} referents">${p.kindCharacteristic ? `<b class="ep-star">★</b>` : ""}${esc(p.rel)}</span>`
      + `<span class="ep-standing ep-s-${esc(p.standing.replace(/[^a-z]+/gi, "-"))}">${esc(STANDING_LABEL[p.standing] ?? p.standing)}</span>`
      + `<span class="ep-vals">${vals}${more}</span></div>`;
  }).join("");
  return `<div class="ep-card" data-entity="${esc(profile.id)}">${head}<div class="ep-params">${rows}</div></div>`;
}

function profilesOf(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (input.schema === PROFILE_BLOCK_SCHEMA && Array.isArray(input.profiles)) return input.profiles;
  if (input.byId instanceof Map) return [...input.byId.values()];
  if (Array.isArray(input.byId)) return input.byId;
  return [];
}

/** A whole section, self-contained (its own <style>), so any surface can drop
 *  it in without adopting this block's CSS. Entities are ordered by how many
 *  parameters they carry; `limit` caps the cards (the payload carries them
 *  all). When there are no profiles the section renders nothing at all, so a
 *  surface that has not built profiles is byte-identical to before. */
export function renderProfileSection(input, { title = "the profile", note = "key parameters, induced per kind — nothing here is a schema", limit = 24 } = {}) {
  const profiles = profilesOf(input);
  if (!profiles.length) return "";
  const ordered = [...profiles].sort((a, b) => b.parameters.length - a.parameters.length || a.id.localeCompare(b.id));
  const cards = ordered.slice(0, limit).map(renderProfile).join("");
  const more = ordered.length > limit ? `<p class="ep-more-note">… ${ordered.length - limit} more in the profile payload</p>` : "";
  return `<section class="ep-panel" aria-label="${esc(title)}"><style>${PROFILE_CSS}</style>`
    + `<h3 class="ep-title">${esc(title)} <span class="ep-note">${esc(note)}</span></h3>`
    + `<div class="ep-cards">${cards}</div>${more}</section>`;
}

/** The JSON a live surface reads (the notebook, the holodeck, the fold's own
 *  JS can index by entity id without re-reading the HTML). One per page. */
export function profilePayload(input) {
  const profiles = profilesOf(input);
  if (!profiles.length) return "";
  const body = { schema: PROFILE_BLOCK_SCHEMA, profiles: profiles.map((p) => ({ ...p, lines: profileLines(p) })) };
  return `<script type="application/json" id="er7-profiles">${JSON.stringify(body).replace(/</g, "\\u003c")}</script>`;
}

export const PROFILE_CSS = `
.ep-panel{margin:14px 0;font:13px/1.45 system-ui,sans-serif;color:var(--ink,#ece9fb)}
.ep-title{font-size:13px;font-weight:600;margin:0 0 8px;letter-spacing:.02em}
.ep-title .ep-note{font-weight:400;color:var(--muted,#8f88b3);font-size:12px;margin-left:6px}
.ep-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.ep-card{border:1px solid var(--line,#2b2450);border-radius:8px;padding:10px 12px;background:var(--bg2,#141126)}
.ep-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:6px}
.ep-name{font-weight:600}
.ep-kind{font-size:11px;color:var(--accent,#a78bfa);border:1px solid var(--line,#2b2450);border-radius:99px;padding:1px 7px}
.ep-kind.none{color:var(--muted,#8f88b3);border-style:dashed}
.ep-count{margin-left:auto;font-size:11px;color:var(--muted,#8f88b3)}
.ep-empty{color:var(--muted,#8f88b3);margin:4px 0 0;font-size:12px}
.ep-row{display:grid;grid-template-columns:minmax(90px,1.4fr) auto minmax(0,2fr);gap:6px;align-items:center;padding:2px 0;border-top:1px solid var(--line,#2b2450)}
.ep-row:first-child{border-top:0}
.ep-rel{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ep-star{color:var(--accent,#a78bfa);font-weight:700;margin-right:2px}
.ep-standing{font-size:10px;border-radius:99px;padding:1px 6px;border:1px solid var(--line,#2b2450);color:var(--muted,#8f88b3);white-space:nowrap}
.ep-s-fixed{color:#4ade80;border-color:#2f6b46}
.ep-s-one-at-a-time{color:#fbbf24;border-color:#6b5a2f}
.ep-s-many-valued{color:#f87171;border-color:#6b2f2f}
.ep-vals{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;min-width:0}
.ep-val{background:var(--bg3,#1b1735);border-radius:4px;padding:0 5px;font-size:11px;max-width:16ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ep-val i{color:var(--muted,#8f88b3);font-style:normal;font-size:10px;margin-left:2px}
.ep-more{color:var(--muted,#8f88b3);font-size:11px}
.ep-more-note{color:var(--muted,#8f88b3);font-size:11px;margin:6px 0 0}
`;

export { profileLines, ENTITY_PROFILE_SCHEMA };
