// block-surface-lattice.mjs — THE LATTICE SURFACE renderer.
//
// One template, every instance. This is the canonical fold surface that
// plans-surface.html is evolving into: a lattice of nine surfaces (Void,
// Kind, Entity, Link, Field, Network, Atmosphere, Lens, Paradigm), a shared
// projection-state header (each surface togglable), a network SVG, entity
// beads with honest splits, worldviews over a paradigm-independent gate, and
// the byte-honesty rule that holds the whole thing up.
//
// THE ONE RULE, from which everything else follows:
//   EVERYTHING ON THE SURFACE IS SOURCEABLE TO THE BYTE. A link row carries
//   file#start-end into a retained, hashed text layer. A network edge carries
//   the byte refs of the assertions it stands on. A prose sentence in the
//   atmosphere is typed material — with its byte ref — or self:model — the
//   mouth, marked, never laundered. A gap is a typed gap. A metric carries
//   dataset/source/asOf. Nothing is cited that does not resolve verbatim,
//   and the gate refuses a surface whose refs do not.
//
// The renderer itself adds no content: it projects an instance (ground,
// links, cast, assertions, typed prose, metrics, gate) that a driver has
// already built and gated. Same layer in, same lattice out.
export const LATTICE_SCHEMA = "EOSurfaceLattice@1";

// THE PROFILE BLOCK — a being's induced kind(s) and key parameters, whatever
// the relations are. Optional and surface-neutral: `t3.profiles` is an
// EOEntityProfiles@1 (or an array of profiles); when absent the lattice is
// byte-identical to before.
import { renderProfileSection, profilePayload } from "./block-profile.mjs";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const KIND_LABEL = { goal: "goal", number: "number", name: "agency", place: "place", claim: "claim", assertion: "svo" };

const rowHtml = (r) => {
  const chips = (r.chips ?? []).map((c) => `<span class="chip">${esc(c)}</span>`).join("");
  return `<div class="row" data-kind="${esc(r.kind)}" data-ref="${esc(r.ref)}">
    <div class="row-head"><span class="kind kind-${esc(r.kind)}">${esc(KIND_LABEL[r.kind] ?? r.kind)}</span>
      <span class="ref" data-byte="${esc(r.ref)}" data-page="${esc(r.page ?? "")}">${esc(r.ref)}</span>
      ${r.page ? `<span class="page">${esc(r.page)}</span>` : ""}</div>
    <div class="verbatim">${esc(r.verbatim)}</div>
    ${chips ? `<div class="chips">${chips}</div>` : ""}
    ${r.basis ? `<div class="basis prov">${esc(r.basis)}</div>` : ""}</div>`;
};

const bucket = (terrain, title, meta, inner, open, id) =>
  `<details class="surf" id="${id ?? ""}"${open ? " open" : ""}><summary><span class="terrain">${terrain}</span> ${title}${meta ? `<span class="meta">${meta}</span>` : ""}</summary><div class="bucket">${inner}</div></details>`;

const SURFACE_NAMES = { 1: "Void", 2: "Kind", 3: "Entity", 4: "Link", 5: "Field", 6: "Network", 7: "Atmosphere", 8: "Lens", 9: "Paradigm" };

export function renderLatticeSurface(inst) {
  const { def, t1, t2, t3, t4, t5, t6, t7, t8, t9, status } = inst;

  // T1 · VOID — the retained, hashed corpus
  const t1Inner = `<div class="cards">${(t1.docs ?? []).map((d) => `
    <div class="card"><h3>${esc(d.title)}</h3><p>${esc(d.meta)}</p>
    <p>${esc(d.meta2)}</p>
    <p class="basis prov">${esc(d.basis)}</p></div>`).join("")}</div>`;

  // T2 · KIND — what a being is; the pills filter every surface
  const t2Inner = `<p class="empty">row kinds — toggle a pill and every surface filters</p><div class="pills" id="kind-toggle">${(t2.kinds ?? []).map((k) => `<span class="pill on" data-kind="${esc(k.kind)}"><span class="kind kind-${esc(k.kind)}">${esc(k.label)}</span> ${k.count}</span>`).join("")}</div><p class="empty">document categories</p><div class="pills">${(t2.categories ?? []).map((c) => `<span class="pill">${esc(c)}</span>`).join("")}</div>`;

  // T3 · ENTITY — beads, with honest splits
  const beads = (t3.beads ?? []).map((b) => `<div class="bead${b.split ? " split" : ""}"><span class="orb"></span><span class="bead-name">${esc(b.name)}</span><span class="bead-count">${b.count}</span></div>`).join("");
  const splits = (t3.splits ?? []).map((s) => `<div class="split-pair"><div class="bead split"><span class="orb"></span><span class="bead-name">${esc(s.left)}</span><span class="bead-count">${s.leftCount ?? ""}</span></div><span class="split-edge">✗ ${esc(s.note)}</span><div class="bead split"><span class="orb"></span><span class="bead-name">${esc(s.right)}</span><span class="bead-count">${s.rightCount ?? ""}</span></div></div>`).join("");
  const t3Inner = `${beads ? `<div class="beads">${beads}</div>` : ""}${splits}${renderProfileSection(t3.profiles ?? null)}<p class="empty">${esc(t3.note)}</p>`;

  // T4 · LINK — the asserted connections, byte-addressed, by document
  const t4Inner = (t4.docs ?? []).map((d) => bucket("T4", esc(d.title), `${d.rows.length} rows`, d.rows.map(rowHtml).join(""))).join("");

  // T5 · FIELD — the source setting, provenance-stamped
  const t5Inner = (t5.blocks ?? []).map((b) => bucket("T5", esc(b.title), b.meta, b.html)).join("");

  // T6 · NETWORK — lenses, then the graph; edges carry assertion byte refs
  const lensDocs = (n) => (n.docs ?? []).map((d) => bucket("T6", esc(d.doc), `${d.rows} rows`, d.rows.map(rowHtml).join("") + (d.more ? `<p class="empty">… ${d.more} more in the register</p>` : ""))).join("");
  const t6Lenses = (t6.lenses ?? []).map((n) => bucket("T6", esc(n.label), n.meta, lensDocs(n))).join("");
  const svgNodes = (t6.svg?.nodes ?? []).map((n) => `<g><circle class="node" cx="${n.x}" cy="${n.y}" r="14"/><text x="${n.x}" y="${n.y + 28}" text-anchor="middle" class="node-label">${esc(n.label)}</text></g>`).join("");
  const svgEdges = (t6.svg?.edges ?? []).map((e) => `<line class="edge" x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}"/><text x="${e.mx}" y="${e.my}" text-anchor="middle" class="edge-label">${esc(e.label)}</text>`).join("");
  const t6Inner = `${t6Lenses}<div class="f-network"><p class="empty">${esc(t6.svg?.note ?? "nodes are the beings, edges are the assertions — every edge carries its byte refs")}</p><svg viewBox="0 0 540 260" preserveAspectRatio="xMidYMid meet">${svgEdges}${svgNodes}</svg></div>`;

  // T7 · ATMOSPHERE — the typed prose; material carries its byte, the mouth is marked
  const proseHtml = (t7.prose ?? []).map((s) => {
    const openRef = s.ref ? ` data-open-ref="${esc(s.ref)}"` : "";
    return `<div class="sentence ${s.ground}"${openRef}>
      <span class="tag ${s.ground}">${esc(s.tag)}</span>
      <span class="stext">${esc(s.text)}</span>
      ${s.ref ? `<span class="sref">${esc(s.ref)}</span>` : `<span class="sref mouth-tag">${esc(s.gapNote ?? "self:model — no byte address")}</span>`}</div>`;
  }).join("");
  const t7Inner = `<p class="empty">${esc(t7.note)}</p>${proseHtml}`;

  // T8 · LENS — lenses, byte inspector, lighting
  const t8Inner = `<div class="panel"><div class="strip"><p class="empty">lenses — a paradigm bundles lenses</p><div class="pills">${(t8.lensPills ?? []).map((l) => `<span class="pill">${esc(l)}</span>`).join("")}</div></div><div class="frame"><p class="empty">byte inspector — every ref is <code>file#start-end</code> into the retained layer; hover a ref, or toggle bytes ⇄ page</p></div></div>
  ${(t8.lighting ?? []).map((l) => bucket("T8", esc(l.label), l.badge, l.rows.map(rowHtml).join(""))).join("")}`;

  // T9 · PARADIGM — worldviews over the gate; the seal only passes when the refs resolve
  const t9Inner = `<div class="worldviews">${(t9.worldviews ?? []).map((w) => `<span class="wv${w.on ? " on" : ""}${w.compare ? " compare" : ""}">${esc(w.label)}</span>`).join("")}</div>
    <p class="empty">${esc(t9.note)}</p>
    <div class="f-judgment"><div class="strata">${(t9.strata ?? []).map((r) => `<div class="rev${r.current ? " current" : ""}"><span class="dot"></span><div class="rev-line">${esc(r.line)}</div>${r.basis ? `<div class="rev-basis">${esc(r.basis)}</div>` : ""}</div>`).join("")}</div><div class="seal ${t9.seal.pass ? "seal-pass" : "seal-refuse"}"><span class="seal-inner">${esc(t9.seal.text)}</span></div></div>
    <ul>${(t9.checks ?? []).map((c) => `<li class="${c.ok ? "ok" : "bad"}">${c.ok ? "●" : "✗"} ${esc(c.text)}</li>`).join("")}</ul>
    ${t9.prov ? `<div class="empty prov">${esc(t9.prov)}</div>` : ""}`;

  const chips = def.chips ?? [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const surfaceNames = { ...SURFACE_NAMES, ...(def.surfaceNames ?? {}) };

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The Fold — ${esc(def.title)}</title>
<style>
  :root { --bg:#0d0b16; --bg2:#141126; --bg3:#1b1735; --line:#2b2450; --line2:#3a3170; --ink:#ece9fb; --muted:#8f88b3; --dim:#6b6492; --violet:#a78bfa; --violet2:#8b5cf6; --violet3:#7c3aed; --ok:#4ade80; --bad:#f87171; --amber:#fbbf24; --header-bg: rgba(13, 11, 22, .92); }
  html[data-theme="light"] { --bg:#f8f6ff; --bg2:#ffffff; --bg3:#efeafb; --line:#e2ddf3; --line2:#c8bfe8; --ink:#241e3f; --muted:#5b5480; --dim:#8b84ab; --violet:#6d4bd8; --violet2:#7c3aed; --violet3:#6d28d9; --ok:#15803d; --bad:#b91c1c; --amber:#b45309; --header-bg: rgba(248, 246, 255, .92); }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font-family: Georgia, serif; line-height: 1.65; transition: background .25s, color .25s; }
  header { position: sticky; top: 0; z-index: 20; background: var(--header-bg); backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); padding: .65rem 1.4rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .mark { display: flex; align-items: center; gap: .55rem; font-family: ui-monospace, Menlo, monospace; font-size: .85rem; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .mark .dot { width: 12px; height: 12px; border-radius: 3px; background: linear-gradient(135deg, var(--violet), var(--violet3)); box-shadow: 0 0 12px rgba(139, 92, 246, .55); }
  .mark b { color: var(--ink); }
  .spacer { flex: 1; }
  .status { font-family: ui-monospace, Menlo, monospace; font-size: .72rem; color: var(--dim); }
  .status .ok { color: var(--ok); }
  button { font-family: ui-monospace, Menlo, monospace; font-size: .74rem; color: var(--muted); background: var(--bg2); border: 1px solid var(--line2); border-radius: 6px; padding: .32rem .7rem; cursor: pointer; }
  button:hover { color: var(--ink); border-color: var(--violet2); }
  main { max-width: 64rem; margin: 0 auto; padding: 1.4rem 1.4rem 3rem; }
  .hero { padding: 1.2rem 0 1.4rem; border-bottom: 1px solid var(--line); margin-bottom: 1.4rem; }
  .hero h1 { margin: 0 0 .3rem; font-size: 1.9rem; font-weight: 600; }
  .hero p { margin: 0; font-family: ui-monospace, Menlo, monospace; font-size: .78rem; color: var(--muted); }
  .verbs { display: flex; gap: .5rem 1.2rem; flex-wrap: wrap; margin-top: .9rem; font-family: ui-monospace, Menlo, monospace; font-size: .68rem; color: var(--dim); }
  .verbs .verb b { color: var(--violet); font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  .proj { display: flex; gap: .4rem .9rem; flex-wrap: wrap; align-items: center; margin-top: .8rem; font-family: ui-monospace, Menlo, monospace; font-size: .66rem; }
  .proj-label { color: var(--dim); }
  .chip-state { color: var(--muted); border: 1px solid var(--line2); border-radius: 999px; padding: .12rem .55rem; cursor: pointer; }
  .chip-state.on { color: var(--violet); border-color: var(--violet2); }
  .chip-state.off { color: var(--dim); border-style: dashed; opacity: .6; }
  .chip-state.lock { color: var(--ok); border-color: var(--ok); opacity: .85; cursor: default; }
  details { border: 1px solid var(--line); border-radius: 10px; background: var(--bg2); margin: .7rem 0; }
  details details { border-color: var(--line); background: var(--bg3); margin: .4rem 0 .4rem .4rem; }
  details details details { background: rgba(27, 23, 53, .4); }
  html[data-theme="light"] details details details { background: rgba(239, 234, 251, .6); }
  details.hidden-surface { display: none; }
  summary { cursor: pointer; list-style: none; padding: .55rem .9rem; font-family: ui-monospace, Menlo, monospace; font-size: .82rem; letter-spacing: .02em; color: var(--ink); user-select: none; }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: "▸ "; color: var(--violet2); }
  details[open] > summary::before { content: "▾ "; }
  summary:hover { color: var(--violet); }
  summary .meta { color: var(--dim); font-size: .72rem; margin-left: .6rem; }
  .terrain { color: var(--violet2); font-size: .7rem; }
  .bucket { padding: .1rem .9rem .9rem; }
  .empty { font-family: ui-monospace, Menlo, monospace; font-size: .72rem; color: var(--dim); padding: .2rem .8rem; }
  .badge { font-size: .66rem; padding: .08rem .45rem; border-radius: 999px; margin-left: .6rem; }
  .badge.v { background: rgba(139, 92, 246, .16); color: var(--violet); border: 1px solid rgba(139, 92, 246, .35); }
  .badge.g { background: rgba(74, 222, 128, .1); color: var(--ok); border: 1px solid rgba(74, 222, 128, .3); }
  .badge.r { background: rgba(248, 113, 113, .1); color: var(--bad); border: 1px solid rgba(248, 113, 113, .35); }
  .badge.a { background: rgba(251, 191, 36, .1); color: var(--amber); border: 1px solid rgba(251, 191, 36, .3); }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: .6rem; }
  .card { border: 1px solid var(--line); border-radius: 8px; padding: .6rem .8rem; background: var(--bg3); }
  .card h3 { margin: 0 0 .2rem; font-size: .95rem; }
  .card p { margin: .15rem 0; font-family: ui-monospace, Menlo, monospace; font-size: .72rem; color: var(--muted); }
  .pills { display: flex; gap: .4rem; flex-wrap: wrap; font-family: ui-monospace, Menlo, monospace; }
  .pill { font-size: .76rem; padding: .2rem .7rem; border-radius: 999px; border: 1px solid var(--line2); color: var(--muted); display: inline-flex; align-items: center; gap: .4rem; cursor: pointer; }
  .pill.on { color: var(--violet); border-color: var(--violet2); }
  .pill.off { color: var(--dim); border-style: dashed; opacity: .55; }
  .beads { display: flex; gap: 1.3rem; flex-wrap: wrap; align-items: flex-start; padding: .3rem .8rem .6rem; }
  .bead { display: flex; flex-direction: column; align-items: center; gap: .35rem; }
  .bead .orb { width: 42px; height: 42px; border-radius: 50%; border: 2px solid var(--violet2); box-shadow: 0 0 14px rgba(139, 92, 246, .35); background: rgba(139, 92, 246, .08); }
  .bead.split .orb { border-color: var(--bad); box-shadow: none; background: transparent; }
  .bead-name { font-family: ui-monospace, Menlo, monospace; font-size: .7rem; color: var(--muted); }
  .bead-count { font-family: ui-monospace, Menlo, monospace; font-size: .68rem; color: var(--dim); }
  .split-pair { display: flex; align-items: center; gap: 1rem; padding: .4rem .8rem 0; flex-wrap: wrap; }
  .split-edge { font-family: ui-monospace, Menlo, monospace; font-size: .66rem; color: var(--bad); border-top: 2px dashed var(--bad); padding-top: .3rem; }
  .row { border-left: 2px solid var(--line2); padding: .3rem .8rem; margin: .5rem 0 .5rem .4rem; border-radius: 0 6px 6px 0; }
  .row-head { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; font-family: ui-monospace, Menlo, monospace; font-size: .72rem; color: var(--dim); }
  .kind { font-size: .62rem; text-transform: uppercase; letter-spacing: .06em; padding: .1rem .45rem; border-radius: 3px; background: rgba(139, 92, 246, .14); color: var(--violet); }
  .kind-number { background: rgba(251, 191, 36, .12); color: var(--amber); }
  .kind-name { background: rgba(74, 222, 128, .12); color: var(--ok); }
  .kind-place { background: rgba(251, 191, 36, .1); color: #f0abfc; }
  .ref { color: var(--violet); cursor: help; }
  .page { color: var(--dim); }
  .verbatim { margin: .2rem 0 .05rem; font-size: .98rem; color: var(--ink); }
  .chips { display: flex; gap: .4rem; flex-wrap: wrap; font-family: ui-monospace, Menlo, monospace; }
  .chip { font-size: .66rem; background: rgba(143, 136, 179, .1); border: 1px solid var(--line); border-radius: 4px; padding: .04rem .45rem; color: var(--muted); }
  .basis { font-size: .68rem; color: var(--dim); font-family: ui-monospace, Menlo, monospace; }
  table { border-collapse: collapse; width: 100%; font-family: ui-monospace, Menlo, monospace; font-size: .76rem; margin: .4rem 0 .8rem; }
  th, td { border: 1px solid var(--line); padding: .28rem .5rem; text-align: left; }
  th { color: var(--violet); background: var(--bg3); font-weight: 600; }
  td { color: var(--muted); }
  .num { text-align: right; }
  ul { margin: .2rem 0 .8rem; padding-left: 1.3rem; color: var(--muted); font-family: ui-monospace, Menlo, monospace; font-size: .76rem; }
  .ok { color: var(--ok); }
  .bad { color: var(--bad); }
  .f-network svg { width: 100%; height: auto; background: var(--bg2); border: 1px solid var(--line); border-radius: 8px; margin: .4rem 0; }
  .f-network .node { fill: none; stroke: var(--violet2); stroke-width: 1.5; }
  .f-network .edge { stroke: var(--line2); stroke-width: 1.2; stroke-dasharray: 3 5; }
  .f-network .node-label { font-family: ui-monospace, monospace; font-size: 9px; fill: var(--muted); }
  .f-network .edge-label { font-family: ui-monospace, monospace; font-size: 8px; fill: var(--dim); }
  .model-claim { font-style: italic; color: var(--muted); border-left: 2px solid var(--line2); padding: .3rem .8rem; margin: .5rem 0 .5rem .4rem; }
  .model-tag { font-family: ui-monospace, Menlo, monospace; font-size: .66rem; color: var(--dim); font-style: normal; letter-spacing: .04em; }
  .panel { display: grid; grid-template-columns: 1fr 1fr; gap: .7rem; padding: .3rem .8rem; }
  .frame { border: 1px dashed var(--line2); border-radius: 8px; padding: .5rem; }
  .worldviews { display: flex; gap: .4rem; flex-wrap: wrap; margin-bottom: .6rem; font-family: ui-monospace, Menlo, monospace; font-size: .68rem; }
  .wv { color: var(--muted); border: 1px solid var(--line2); border-radius: 999px; padding: .14rem .6rem; }
  .wv.on { color: var(--violet); border-color: var(--violet2); }
  .wv.compare { color: var(--amber); border-style: dashed; }
  .f-judgment { display: grid; grid-template-columns: 1fr auto; gap: 1.4rem; align-items: center; }
  .f-judgment .strata { border-left: 2px dashed var(--line2); padding-left: 1.1rem; display: grid; gap: .8rem; }
  .f-judgment .rev { position: relative; }
  .f-judgment .rev .dot { position: absolute; left: -1.32rem; top: .35rem; width: 9px; height: 9px; border-radius: 50%; border: 1.5px dashed var(--line2); background: var(--bg2); }
  .f-judgment .rev.current .dot { border-color: var(--ok); border-style: solid; }
  .f-judgment .rev-line { font-family: ui-monospace, Menlo, monospace; font-size: .76rem; color: var(--muted); }
  .f-judgment .rev-line b { color: var(--amber); }
  .f-judgment .rev-basis { font-family: ui-monospace, Menlo, monospace; font-size: .68rem; color: var(--dim); }
  .f-judgment .seal { width: 118px; height: 118px; border-radius: 50%; display: flex; align-items: center; justify-content: center; text-align: center; border: 3px dashed var(--line2); font-family: ui-monospace, Menlo, monospace; font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; }
  .f-judgment .seal-pass { border-color: var(--ok); color: var(--ok); box-shadow: 0 0 18px rgba(74, 222, 128, .25); }
  .f-judgment .seal-refuse { border-color: var(--bad); color: var(--bad); }
  .sentence { display: flex; gap: .6rem; align-items: baseline; padding: .28rem .2rem; border-left: 2px solid transparent; cursor: pointer; }
  .sentence:hover { border-left-color: var(--line2); }
  .sentence .tag { font-family: ui-monospace, Menlo, monospace; font-size: .68rem; color: var(--violet); flex-shrink: 0; }
  .sentence .tag.mouth { color: var(--muted); }
  .sentence .sref { font-family: ui-monospace, Menlo, monospace; font-size: .66rem; color: var(--dim); margin-left: auto; }
  .sentence .sref.mouth-tag { color: var(--amber); }
  .row.flash { animation: flashrow 2.2s ease; }
  @keyframes flashrow { 0%, 100% { background: transparent; } 15%, 45% { background: var(--bg3); border-left-color: var(--violet2); } }
  .no-prov .prov { display: none; }
  footer { max-width: 64rem; margin: 0 auto; padding: 1rem 1.4rem 2.5rem; border-top: 1px solid var(--line); font-family: ui-monospace, Menlo, monospace; font-size: .68rem; color: var(--dim); }
  footer code { color: var(--muted); }
</style>
</head>
<body>
<header>
  <span class="mark"><span class="dot"></span>the&nbsp;fold · <b>${esc(def.mark)}</b></span>
  <span class="spacer"></span>
  <span class="status" id="status"></span>
  <button id="tog-theme">light ⇄ dark</button>
  <button id="tog-refs">bytes ⇄ page</button>
  <button id="tog-prov">provenance</button>
</header>
<main>
  <div class="hero">
    <h1>${esc(def.title)}</h1>
    <p>${esc(def.sub)}</p>
    <div class="verbs">
      ${(def.verbs ?? []).map((v) => `<span class="verb"><b>${esc(v.word)}</b> ${esc(v.text)}</span>`).join("")}
    </div>
    <div class="proj">
      <span class="proj-label">${esc(def.projLabel ?? "projection state — one constraint set, read by all nine surfaces:")}</span>
      <span class="chip-state lock">gate — not a toggle</span>
      ${chips.map((t) => `<span class="chip-state on" data-surface="${t}">T${t} ${esc(surfaceNames[t] ?? "")}</span>`).join("")}
    </div>
  </div>
  ${bucket("T1", "Void", "the retained, hashed corpus", t1Inner, true, "s1")}
  ${bucket("T2", "Kind", "what a being is", t2Inner, false, "s2")}
  ${bucket("T3", "Entity", "identity typed, never guessed", t3Inner, true, "s3")}
  ${bucket("T4", "Link", "the asserted connections, byte-addressed", t4Inner, false, "s4")}
  ${bucket("T5", "Field", "the source setting, provenance-stamped", t5Inner, false, "s5")}
  ${bucket("T6", "Network", "the web the links make", t6Inner, true, "s6")}
  ${bucket("T7", "Atmosphere", "the typed prose — material carries its byte, the mouth is marked", t7Inner, false, "s7")}
  ${bucket("T8", "Lens", "the ways of seeing", t8Inner, false, "s8")}
  ${bucket("T9", "Paradigm", `<span class="badge ${t9.seal.pass ? "g" : "r"}">● ${t9.seal.pass ? "pass" : "refuse"}</span>`, t9Inner, true, "s9")}
</main>
<footer>
  A lattice of the fold — one embedded artifact, folded into nine forms. Every ref is <code>file#start-end</code>
  into a retained, hashed text layer; every assertion, claim, sentence and edge is sourceable to the byte, and what is
  not (the mouth, the gap) is marked, never laundered. Nothing here is authored by a frontier model.
</footer>
${profilePayload(t3.profiles ?? null)}
<script>
  const root = document.documentElement;
  const saved = localStorage.getItem('fold-theme');
  const prefers = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  root.dataset.theme = saved || prefers;
  document.getElementById('tog-theme').addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('fold-theme', root.dataset.theme);
  });
  let bytes = true;
  const refs = document.querySelectorAll('.ref');
  document.getElementById('tog-refs').addEventListener('click', () => {
    bytes = !bytes;
    for (const el of refs) el.textContent = bytes ? el.dataset.byte : el.dataset.page;
  });
  document.getElementById('tog-prov').addEventListener('click', () => {
    document.body.classList.toggle('no-prov');
  });
  for (const chip of document.querySelectorAll('.chip-state[data-surface]')) {
    chip.addEventListener('click', () => {
      const s = document.getElementById('s' + chip.dataset.surface);
      s.classList.toggle('hidden-surface');
      chip.classList.toggle('on', !s.classList.contains('hidden-surface'));
    });
  }
  for (const pill of document.querySelectorAll('#kind-toggle .pill')) {
    pill.addEventListener('click', () => {
      pill.classList.toggle('on');
      const k = pill.dataset.kind;
      const on = pill.classList.contains('on');
      for (const r of document.querySelectorAll('.row[data-kind="' + k + '"]')) r.style.display = on ? '' : 'none';
    });
  }
  // the open verb — a byte ref opens its row, anywhere on the lattice: click a
  // typed prose sentence or an assertion edge and the register row it points
  // at is revealed and flashed. Everything resolves to the byte.
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-ref]');
    if (!t) return;
    e.preventDefault();
    const ref = t.getAttribute('data-open-ref');
    // a sentence/assertion points at the byte where its fact starts; the
    // register row it opens carries the full range file#start-end
    const row = document.querySelector('.row[data-ref="' + CSS.escape(ref) + '"]')
      || document.querySelector('.row[data-ref^="' + CSS.escape(ref) + '-"]');
    if (!row) return;
    let details = row.closest('details');
    while (details) { if (!details.open) details.open = true; details = details.parentElement.closest('details'); }
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
  });
  document.getElementById('status').innerHTML = '${status.left} · <span class="ok">${status.ok}</span>';
</script>
</body>
</html>`;
}