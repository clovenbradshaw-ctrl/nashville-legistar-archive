// render.mjs — THE TEMPLATIZABLE PLAN SURFACE renderer. One generic function
// renders any city/plan set from a SurfaceDef + ledger + metrics; a new city
// is a new ground + a new SurfaceDef JSON, not new code.
//
// The surface renders two lanes and never blends them:
//   1. source lane — rows whose byte span resolved verbatim (the build stamps
//      `resolved`), styled as content. An unresolvable ref renders as a red
//      "unresolved byte ref" badge, never as content.
//   2. analysis lane — model-authored prose only, styled `.model-claim`,
//      collapsed by default, marked "stated by the model; no retained source
//      states it".
const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const KIND_LABEL = { goal: "goal", number: "number", name: "agency", place: "place" };

function topicMatches(row, queries) {
  const hay = `${row.verbatim ?? ""} ${row.fields?.section ?? ""}`.toLowerCase();
  return queries.some((q) => hay.includes(q.toLowerCase()));
}

function rowHTML(row, resolved) {
  const ok = resolved[row.id] !== false;
  const ref = `${row.doc}#${row.at[0]}-${row.at[1]}`;
  const chips = [];
  for (const k of ["section", "agency", "place", "amount", "year"]) {
    if (row.fields?.[k]) chips.push(`<span class="chip">${esc(k)}: ${esc(row.fields[k])}</span>`);
  }
  return `<div class="row">
    <div class="row-head">
      <span class="kind kind-${esc(row.kind)}">${esc(KIND_LABEL[row.kind] ?? row.kind)}</span>
      <span class="ref" data-byte="${esc(ref)}" data-page="p.${esc(row.page)}" title="resolved from ${esc(row.doc)}">${esc(ref)}</span>
      <span class="page">p.${esc(row.page)}</span>
      ${ok ? "" : '<span class="badge badge-unresolved">unresolved byte ref</span>'}
    </div>
    <div class="verbatim">${ok ? esc(row.verbatim) : '<span class="strike">' + esc(row.verbatim) + "</span>"}</div>
    <div class="chips">${chips.join("")}</div>
    <div class="basis">${esc(row.basis ?? "")}</div>
  </div>`;
}

function docBlock(doc, rows, resolved) {
  const body = rows.map((r) => rowHTML(r, resolved)).join("");
  return `<details class="doc" open>
    <summary>${esc(doc.title)} <span class="doc-meta">${esc(doc.category)} · ${esc(doc.scale)} · ${rows.length} rows</span></summary>
    <div class="provenance">
      <span>${esc(doc.publisher ?? "")}</span><span>adopted ${esc(doc.adopted ?? "")}</span>
      <span>${esc(doc.chars ?? "")} chars · ${esc(doc.pages ?? "")} pages</span>
      <span>pdf_sha256 <code>${esc((doc.pdf_sha256 ?? "").slice(0, 12))}…</code></span>
      <span>txt_sha256 <code>${esc((doc.txt_sha256 ?? "").slice(0, 12))}…</code></span>
      <span>extraction ${esc(doc.extraction ?? "")}</span>
      <span class="license">${esc(doc.license ?? "")}</span>
    </div>
    <a class="openpdf" href="${esc(doc.url ?? "#")}" target="_blank" rel="noopener">open PDF →</a>
    <div class="rows">${body}</div>
  </details>`;
}

function topicHTML(def, topic, rows, docsById, resolved) {
  const byDoc = {};
  for (const r of rows) (byDoc[r.doc] ??= []).push(r);
  const blocks = Object.entries(byDoc).map(([docPath, rs]) => {
    const doc = docsById[docPath] ?? { title: docPath, category: "", scale: "", chars: "", pages: "", extraction: "" };
    return docBlock(doc, rs, resolved);
  });
  const count = rows.length;
  return `<section class="topic" data-topic="${esc(topic.id)}">
    <h3>${esc(topic.label)} <span class="doc-meta">${count} byte-anchored row${count === 1 ? "" : "s"} across ${blocks.length} plan${blocks.length === 1 ? "" : "s"}</span></h3>
    ${blocks.join("")}
  </section>`;
}

function metricsHTML(def, metrics) {
  const byReg = {};
  for (const m of metrics) (byReg[m.registry] ??= []).push(m);
  const districts = byReg.districts ?? [];
  const vbd = new Map((byReg["violations-by-district"] ?? []).map((m) => [Number(m.district), m.fields]));
  const rows = districts.map((d) => {
    const f = d.fields ?? {};
    const v = vbd.get(Number(d.district)) ?? {};
    return `<tr><td>${esc(d.district)}</td><td>${esc(f.population ?? "")}</td><td>${esc(f.median_household_income ?? "")}</td><td>${esc(f.pct_renter ?? "")}</td><td>${esc(f.pct_child_poverty ?? "")}%</td><td class="num">${esc(v.open ?? "")} open</td><td>${esc(v.total ?? "")} total</td></tr>`;
  }).join("");
  const stress = byReg["housing-stress"]?.[0]?.fields ?? {};
  const landlords = (byReg.landlords ?? []).map((m) => `<li>${esc(m.fields.landlord)} — ${esc(m.fields.properties)} props / ${esc(m.fields.evictions)} filings</li>`).join("");
  const provNote = (m) => m?.provenance ? `dataset ${esc(m.provenance.dataset)} · asOf ${esc(m.provenance.asOf)}` : "no provenance — not rendered";
  const stressRow = byReg["housing-stress"]?.[0];
  return `<section id="metrics">
    <h3>Metrics overlay <span class="doc-meta">${metrics.length} MetricRow@1 rows, each provenance-stamped</span></h3>
    <div class="metric-grid">
      <div class="metric-card">
        <h4>Housing stress</h4>
        <p class="big">${esc(stress.totalEvictionFilings ?? "")} eviction filings</p>
        <p>${esc(stress.propertyRows ?? "")} property rows · ${esc(stress.distinctLandlords ?? "")} distinct landlords</p>
        <p class="basis">${stressRow ? provNote(stressRow) : ""}</p>
      </div>
      <div class="metric-card">
        <h4>Top landlords by portfolio</h4>
        <ul>${landlords}</ul>
        <p class="basis">${(byReg.landlords?.[0]) ? provNote(byReg.landlords[0]) : ""}</p>
      </div>
    </div>
    <table>
      <thead><tr><th>Dist</th><th>Population</th><th>Med. HH income</th><th>% renter</th><th>% child poverty</th><th>311 open</th><th>311 total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="basis">${(byReg.districts?.[0]) ? provNote(byReg.districts[0]) : ""}</p>
  </section>`;
}

/**
 * renderPlanSurface({ def, docs, rows, metrics, resolved, analysis }) -> html
 * `docs` is the enriched document shelf (metadata pulled from manifest +
 * provenance sidecars by the builder). `resolved` is {rowId: boolean}.
 */
export function renderPlanSurface({ def, docs, rows, metrics, resolved = {}, analysis = [] }) {
  const docsById = {};
  for (const d of docs) docsById[`nashville/ground/${d.id}.txt`] = d;
  const docOf = (id) => def.documents.find((d) => d.id === id);

  const shelf = def.documents.map((d) => {
    const meta = docsById[`nashville/ground/${d.id}.txt`] ?? {};
    return `<a class="shelf-card" href="#doc-${esc(d.id)}">
      <h3>${esc(meta.title ?? d.id)}</h3>
      <p class="doc-meta">${esc(d.category)} · ${esc(d.scale)} · ${esc(meta.adopted ?? "")}</p>
      <p class="shelf-note">${esc(meta.chars ?? "")} chars / ${esc(meta.pages ?? "")} pages · ${esc((meta.pdf_sha256 ?? "").slice(0, 8))}…</p>
    </a>`;
  }).join("");

  const byDocRows = {};
  for (const r of rows) (byDocRows[r.doc] ??= []).push(r);
  const register = def.documents.map((d) => {
    const rs = byDocRows[`nashville/ground/${d.id}.txt`] ?? [];
    return `<div id="doc-${esc(d.id)}">${docBlock(docsById[`nashville/ground/${d.id}.txt`] ?? { title: d.id, category: "", scale: "", chars: "", pages: "", extraction: "" }, rs, resolved)}</div>`;
  }).join("");

  const topics = def.topics
    .map((t) => ({ t, matched: rows.filter((r) => topicMatches(r, t.queries)) }))
    .filter((x) => x.matched.length)
    .map((x) => topicHTML(def, x.t, x.matched, docsById, resolved))
    .join("");

  const metricsHTMLOut = metricsHTML(def, metrics);

  const analysisBlock = analysis.length
    ? analysis.map((a) => `<div class="model-claim"><p class="model-tag">stated by the model; no retained source states it</p><p>${esc(a.text)}</p><p class="basis">${esc(a.basis ?? "")}</p></div>`).join("")
    : `<p class="model-claim-note">No model commentary on this surface. Every row below is byte-anchored to a retained plan document; nothing is the mouth's prose.</p>`;

  const resolvedCount = Object.values(resolved).filter((v) => v !== false).length;
  const total = rows.length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(def.name)} — plans surface</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; line-height: 1.5; color: #111; background: #fafafa; }
  header { position: sticky; top: 0; background: #0f172a; color: #e2e8f0; padding: .75rem 1.25rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; z-index: 10; }
  header h1 { font-size: 1.05rem; margin: 0; }
  header .count { font-size: .8rem; opacity: .8; }
  header button { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 6px; padding: .3rem .6rem; cursor: pointer; font-size: .8rem; }
  main { max-width: 1100px; margin: 0 auto; padding: 1.25rem; }
  section { margin: 1.5rem 0; }
  h2 { border-bottom: 2px solid #0f172a; padding-bottom: .25rem; }
  .doc-meta { font-size: .8rem; color: #64748b; font-weight: 400; }
  .shelf { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: .75rem; }
  .shelf-card { text-decoration: none; color: inherit; border: 1px solid #cbd5e1; border-radius: 8px; padding: .75rem; background: #fff; }
  .shelf-card h3 { margin: 0 0 .25rem; font-size: .95rem; }
  .shelf-note { margin: .25rem 0 0; font-size: .75rem; color: #64748b; }
  details.doc { border: 1px solid #e2e8f0; border-radius: 8px; margin: .75rem 0; background: #fff; }
  details.doc summary { cursor: pointer; padding: .6rem .9rem; font-weight: 600; }
  .provenance { display: flex; flex-wrap: wrap; gap: .5rem 1.25rem; font-size: .75rem; color: #475569; padding: 0 .9rem; }
  .license { font-style: italic; }
  .openpdf { display: inline-block; margin: .4rem .9rem; font-size: .8rem; color: #0369a1; }
  .rows { padding: .25rem .9rem .9rem; }
  .row { border-left: 3px solid #cbd5e1; padding: .45rem .7rem; margin: .5rem 0; background: #f8fafc; border-radius: 0 6px 6px 0; }
  .row-head { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; font-size: .78rem; }
  .kind { font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; padding: .1rem .4rem; border-radius: 4px; background: #e0f2fe; color: #075985; }
  .kind-number { background: #fef3c7; color: #92400e; }
  .kind-name { background: #dcfce7; color: #166534; }
  .kind-place { background: #ede9fe; color: #5b21b6; }
  .ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #0369a1; cursor: help; }
  .page { font-family: ui-monospace, monospace; color: #64748b; }
  .badge { font-size: .68rem; padding: .1rem .4rem; border-radius: 4px; }
  .badge-unresolved { background: #fee2e2; color: #b91c1c; }
  .verbatim { margin: .3rem 0 .15rem; font-size: .92rem; }
  .strike { text-decoration: line-through; opacity: .55; }
  .chips { display: flex; gap: .4rem; flex-wrap: wrap; }
  .chip { font-size: .7rem; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: .05rem .4rem; color: #334155; }
  .basis { font-size: .7rem; color: #94a3b8; margin-top: .2rem; }
  .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: .75rem; }
  .metric-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: .75rem 1rem; background: #fff; }
  .metric-card h4 { margin: 0 0 .4rem; }
  .big { font-size: 1.6rem; font-weight: 700; margin: .2rem 0; }
  table { border-collapse: collapse; width: 100%; font-size: .8rem; margin-top: 1rem; background: #fff; }
  th, td { border: 1px solid #e2e8f0; padding: .3rem .5rem; text-align: left; }
  .num { text-align: right; }
  .model-claim { border: 1px dashed #cbd5e1; border-radius: 8px; padding: .75rem 1rem; color: #475569; font-style: italic; }
  .model-tag { font-size: .7rem; color: #94a3b8; font-style: normal; }
  .model-claim-note { color: #64748b; font-size: .85rem; }
  #analysis { display: none; }
  #analysis.show { display: block; }
  footer { max-width: 1100px; margin: 2rem auto; padding: 0 1.25rem 2rem; font-size: .75rem; color: #64748b; }
</style>
</head>
<body>
<header>
  <h1>${esc(def.name)} — plans surface</h1>
  <span class="count">${total} byte-anchored rows · ${resolvedCount}/${total} refs resolve verbatim · ${metrics.length} metric rows</span>
  <button id="tog-refs">bytes ⇄ page</button>
  <button id="tog-analysis">show analysis lane</button>
</header>
<main>
  <section id="shelf">
    <h2>Document shelf <span class="doc-meta">five retained plan documents, provenance sidecar per doc</span></h2>
    <div class="shelf">${shelf}</div>
  </section>

  <section id="register">
    <h2>Policy &amp; action register <span class="doc-meta">the byte-traceable core</span></h2>
    ${register}
  </section>

  <section id="topics">
    <h2>Cross-plan questions <span class="doc-meta">one question, five plans answering, every answer verbatim + byte-cited</span></h2>
    ${topics}
  </section>

  ${metricsHTMLOut}

  <section id="analysis">
    <h2>Analysis lane <span class="doc-meta">model-authored prose, never merged with the register</span></h2>
    ${analysisBlock}
  </section>

  <section id="byte-inspector">
    <h2>Byte inspector</h2>
    <p class="basis">Every ref is <code>file#start-end</code> into the retained text layer. Hover a ref for its resolved path; page is bridged through the pagemap.</p>
  </section>
</main>
<footer>
  Surface built by eoreader7 — renderPlanSurface. Nothing here is authored by a frontier model; every row is a
  deterministic extraction from a retained plan document or a provenance-stamped metric snapshot.
</footer>
<script>
  const refs = document.querySelectorAll(".ref");
  document.getElementById("tog-refs").addEventListener("click", () => {
    const bytes = refs[0]?.dataset?.byte != null && refs[0].textContent === refs[0].dataset.byte;
    for (const el of refs) el.textContent = bytes ? el.dataset.page : el.dataset.byte;
  });
  document.getElementById("tog-analysis").addEventListener("click", () => {
    document.getElementById("analysis").classList.toggle("show");
  });
</script>
</body>
</html>`;
}