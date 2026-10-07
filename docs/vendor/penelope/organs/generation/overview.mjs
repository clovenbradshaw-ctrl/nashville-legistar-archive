// Portable Penelope overview materializer. One canonical reading contract in eoreader7.
// UTF-8 text bundles only; original PDF/audio/image address mapping remains a named gap.
import { composeOverview, verifyOverview, reopen, blocksAt, canonical, digest } from '../../../eoreader7/native/organs/overview.js';
export { composeOverview, verifyOverview, reopen, blocksAt };
export const esc = s => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const linkId = id => 'block-' + id;
const sourceId = id => 'source-' + id;
export const STYLE = `body{font:17px/1.55 system-ui,sans-serif;background:#fcfaf6;color:#292823;margin:0}main{max-width:1000px;margin:auto;padding:24px}h1,h2,h3{line-height:1.2}article,section{border:1px solid #bcb8ad;border-radius:10px;padding:18px;margin:18px 0;overflow-wrap:anywhere}article[data-kind="negative-space"]{border:2px solid #9b611e;background:#fff8e9}blockquote,pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:12px 0;font:inherit}small{display:block;color:#56534c}a,button{color:#6643a3}mark{background:#ffe3a0}summary{cursor:pointer;font-weight:600}label{display:block}button,input,textarea,select{font:inherit;max-width:100%;box-sizing:border-box}button{padding:8px 12px;cursor:pointer}nav{display:flex;gap:12px;flex-wrap:wrap}.meta{font-size:13px}#selection-uses{position:sticky;bottom:0;background:#fff8e9;padding:12px;border:1px solid #9b611e}@media(max-width:600px){main{padding:12px}article,section{padding:12px}}`;
export async function renderOverview(o) {
  const check = await verifyOverview(o);
  if (!check.ok) throw new Error('overview refused: ' + check.gap);
  const body = [];
  body.push(`<header><h1>${esc(o.frame.question)}</h1><p>View: ${esc(o.frame.viewpoint)} · Chosen by: ${esc(o.frame.owner)}</p><p>For: ${esc(o.frame.experiencer)}</p><p>${esc(o.frame.selection)}</p><small>Exact literal query: ${esc(JSON.stringify(o.frame.query))} · Record: ${esc(o.revision)}</small><p>${esc(o.frame.limits)}</p><p>Open the evidence, compare accounts, and pursue the gaps. Processing and opening a passage do not establish understanding.</p></header>`);
  body.push('<nav><a href="#negative-spaces">Open questions and negative spaces</a><a href="#originals">Read the source text</a><a href="#record">Inspect the complete construction record</a></nav>');
  const ordered = [...o.blocks.filter(b => ['negative-space', 'inquiry'].includes(b.type)), ...o.blocks.filter(b => !['frame', 'negative-space', 'inquiry'].includes(b.type))];
  body.push('<div id="negative-spaces"></div>');
  for (const b of ordered) {
    body.push(`<article id="${esc(linkId(b.id))}" data-kind="${esc(b.type)}"><h2>${esc(b.type === 'negative-space' ? b.expected : b.type)}</h2><p>${esc(b.text)}</p>`);
    if (b.owner) body.push(`<small>Owned by: ${esc(b.owner)} · ${esc(b.standing || 'owned inquiry')}</small>`);
    if (b.type === 'witness') body.push(`<small>Source giver: ${esc(b.giver || 'Not declared; speaker not inferred')}</small>`);
    if (b.type === 'negative-space') {
      body.push(`<p>Why look: ${esc(b.basis)}</p><p>Search: ${esc(JSON.stringify(b.query))} · ${esc(b.status)}</p>`);
      if (b.stakes) body.push(`<p>Proposed stakes (${esc(b.stakes.owner)}; hypothesis): ${esc(b.stakes.text)}</p>`);
    }
    for (const r of b.refs || []) {
      const read = await reopen(r, o.recipe.sources);
      if (!read.ok) throw new Error(read.gap);
      body.push(`<details><summary>Read adjacent text lines · ${esc(read.source.title)} · UTF-8 bytes ${r.start}–${r.end}</summary><small>${esc(r.space)} · source hash ${esc(r.version)}</small><blockquote>${esc(read.before.slice(read.before.lastIndexOf('\n', Math.max(0, read.before.length - 2)) + 1))}<mark>${esc(read.quote)}</mark>${esc(read.after.slice(0, read.after.indexOf('\n', 1) < 0 ? read.after.length : read.after.indexOf('\n', 1)))}</blockquote><a href="#${encodeURIComponent(sourceId(r.source))}">Read whole source and see its uses</a></details>`);
    }
    if (b.premises?.length) body.push(`<p>Depends on: ${b.premises.map(id => `<a href="#${encodeURIComponent(linkId(id))}">${esc(id)}</a>`).join(' · ')}</p>`);
    body.push(`<small>Construction: ${esc(b.transformation)}<br>Limits: ${esc(b.limits)}</small></article>`);
  }
  body.push('<section id="originals"><h2>Versioned source text</h2><p>Select text to see the overview blocks that use it. Extracted text is distinct from original media.</p>');
  for (const s of o.recipe.sources) {
    const m = o.frame.manifest.find(x => x.id === s.id);
    const uses = blocksAt(o, s.id, 0, m.bytes);
    body.push(`<section id="${esc(sourceId(s.id))}"><h3>${esc(s.title)}</h3><small>${esc(s.space)} · ${esc(s.coverage)} coverage · ${m.bytes} UTF-8 bytes<br>${esc(m.version)}<br>${esc(s.limitations)}</small><p>Used by: ${uses.map(id => `<a href="#${encodeURIComponent(linkId(id))}">${esc(id)}</a>`).join(' · ') || 'No selected passages'}</p><pre data-overview-source="${esc(s.id)}">${esc(s.text)}</pre></section>`);
  }
  body.push('</section><div id="selection-uses" hidden aria-live="polite"></div>');
  body.push(`<details id="record"><summary>Complete recipe, addresses, transformations, scope, and gaps</summary><pre>${esc(JSON.stringify(o, null, 2))}</pre></details>`);
  const payload = JSON.stringify(o).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${esc(o.frame.question)}</title><style>${STYLE}</style></head><body><main>${body.join('')}</main><script type="application/json" id="overview-data">${payload}</script><script>
const o=JSON.parse(document.getElementById('overview-data').textContent);
// HTML parsing normalizes line endings and NULs. Restore the exact received
// text from the embedded record before selection offsets can be measured.
for(const p of document.querySelectorAll('[data-overview-source]')){
 const s=o.recipe.sources.find(s=>s.id===p.dataset.overviewSource);if(s)p.textContent=s.text;
}
document.addEventListener('selectionchange',()=>{
 const s=getSelection(),out=document.getElementById('selection-uses');
 if(!s.rangeCount||s.isCollapsed){out.hidden=true;return;}
 const r=s.getRangeAt(0),n=r.startContainer.nodeType===1?r.startContainer:r.startContainer.parentElement,p=n.closest('[data-overview-source]');
 if(!p||!p.contains(r.endContainer)){out.hidden=true;return;}
 const pre=r.cloneRange();pre.selectNodeContents(p);pre.setEnd(r.startContainer,r.startOffset);
 const a=new TextEncoder().encode(pre.toString()).length,b=a+new TextEncoder().encode(r.toString()).length;
 const ids=new Set((o.reverse[p.dataset.overviewSource]||[]).filter(x=>x.start<b&&x.end>a).map(x=>x.block));
 let changed;do{changed=false;for(const x of o.blocks)if(!ids.has(x.id)&&(x.premises||[]).some(k=>ids.has(k))){ids.add(x.id);changed=true;}}while(changed);
 out.replaceChildren();out.hidden=false;out.append(document.createTextNode('Selected bytes '+a+'–'+b+': '));
 if(!ids.size)out.append(document.createTextNode('No blocks use this selection.'));
 for(const id of ids){const l=document.createElement('a');l.href='#block-'+encodeURIComponent(id);l.textContent=id+' ';out.append(l);}
});
</script></body></html>`;
}
export async function materializeOverview(recipe) {
  const overview = await composeOverview(recipe);
  const html = await renderOverview(overview);
  return { schema: 'OverviewMaterialization@1', overview, html, htmlHash: await digest(html), noModel: true };
}
export async function verifyMaterialization(product, currentSources = product.overview.recipe.sources) {
  const checked = await verifyOverview(product.overview, currentSources);
  if (!checked.ok) return checked;
  const expected = await renderOverview(product.overview);
  const ok = product.html === expected && product.htmlHash === await digest(expected);
  return { ok, gap: ok ? null : 'altered-materialization' };
}
