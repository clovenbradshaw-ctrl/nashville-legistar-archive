// Evidence overview surface: Penelope owns materialization; eoreader7 owns byte contracts.
import { materializeOverview, verifyMaterialization, esc } from './vendor/penelope/organs/generation/overview.mjs';
export function overviewSources(docs) {
  return docs.map(d => {
    const received = typeof d.overviewReceivedText === 'string';
    return { id: String(d.id), title: d.title || 'Untitled', text: received ? d.overviewReceivedText : typeof d.text === 'string' ? d.text : '',
      space: received ? 'received-utf8-text' : 'holodeck-extracted-text', coverage: received ? 'complete' : !d.text || d.aboutOnly || d.lazy ? 'unread' : 'partial',
      giver: d.authors?.length ? d.authors.join(', ') + ' (document metadata; passage speaker not inferred)' : d.publisher || null,
      limitations: received ? 'Received text preserved before Holodeck rendering. Complete means literal search covers this received text; acquisition completeness and truth are not asserted.' : 'Holodeck text extraction, not original file bytes. Extraction completeness and original-media address mapping are unverified.' };
  });
}
export function mountOverview(root, { docs, workspace, onRead }) {
  let current = overviewSources(docs), selected = new Set(current.map(s => s.id)), product = null, stale = false, revision = 0;
  let draft = {};
  const key = 'hd:overview:' + workspace;
  try { draft = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
  if (Array.isArray(draft.sources)) selected = new Set(draft.sources);
  root.innerHTML = `<style>#evidence-overview label{display:block;margin:12px 0}#evidence-overview input[type=text],#evidence-overview textarea{display:block;width:100%;padding:8px;font:inherit;box-sizing:border-box;border:1px solid var(--line2);background:var(--s1);color:var(--ink);border-radius:6px}#evidence-overview button{font:inherit;padding:8px 12px;cursor:pointer;color:var(--ink);background:var(--s1);border:1px solid var(--line2);border-radius:6px}#evidence-overview fieldset{border:1px solid var(--line2);border-radius:8px;margin:16px 0}#evidence-overview iframe{width:100%;height:75vh;border:1px solid var(--line2);background:white}#evidence-overview small{display:block;color:var(--mut)}</style>
  <section id="evidence-overview"><h2>Build an evidence overview</h2><p>Choose a standpoint and source scope. Read the evidence and keep the unanswered questions visible.</p>
  <small>Defaults below are disclosed choices you can change. Retrieval is literal, not semantic. No model is used.</small>
  <form>
  <label>Question<input name="question" type="text" required value="${esc(draft.question || 'What supports this account, and what remains unknown?')}"></label>
  <label>Viewpoint<input name="viewpoint" type="text" required value="${esc(draft.viewpoint || 'Source coverage and unanswered consequences')}"></label>
  <label>Who owns this framing?<input name="owner" type="text" required value="${esc(draft.owner || 'Workspace reader (disclosed default)')}"></label>
  <label>Who is this reading for?<input name="experiencer" type="text" required value="${esc(draft.experiencer || 'Workspace reader (disclosed default)')}"></label>
  <label>Exact text to select (leave empty for all nonempty lines)<input name="query" type="text" value="${esc(draft.query || '')}"></label>
  <fieldset><legend>Selected sources · received text or explicitly bounded extraction</legend><div data-sources></div></fieldset>
  <fieldset><legend>Declare a negative space to investigate (optional)</legend>
  <small>This is your question about representation. A lexical match cannot establish that a perspective is represented equitably.</small>
  <label>Expected perspective or evidence<input name="expected" type="text" value="${esc(draft.expected || '')}"></label>
  <label>Why should we look for it?<textarea name="basis">${esc(draft.basis || '')}</textarea></label>
  <label>Exact wording to search across selected text<input name="gapQuery" type="text" value="${esc(draft.gapQuery || '')}"></label>
  <label>Possible stakes (your hypothesis)<textarea name="stakes">${esc(draft.stakes || '')}</textarea></label>
  <label>What evidence or action could address this gap?<textarea name="next">${esc(draft.next || '')}</textarea></label>
  </fieldset><button type="submit">Build from this evidence</button>
  </form><p data-status role="status" aria-live="polite"></p>
  <div data-actions hidden><button type="button" data-export>Export portable evidence HTML</button><button type="button" data-json>Export construction record</button><small>Includes the selected source text, frame, addresses, gaps, and reverse links. Review the scope before sharing.</small><small>Browser checks replay byte provenance. Native ethos, logos, and pathos run when this recipe is submitted through Penelope’s overview API; no native clearance is claimed here.</small><div data-read></div></div>
  <iframe title="Evidence overview and versioned source reader" sandbox="allow-scripts" hidden></iframe></section>`;
  const form = root.querySelector('form'), status = root.querySelector('[data-status]'), frame = root.querySelector('iframe'), actions = root.querySelector('[data-actions]');
  const val = name => form.elements.namedItem(name).value.trim();
  const scope = () => current.filter(s => selected.has(s.id));
  const setStatus = t => { status.textContent = t; };
  function sourceList() {
    const list = root.querySelector('[data-sources]'); list.replaceChildren();
    for (const s of current) {
      const label = document.createElement('label'), box = document.createElement('input'); box.type = 'checkbox'; box.checked = selected.has(s.id);
      box.addEventListener('change', () => { if (box.checked) selected.add(s.id); else selected.delete(s.id); invalidate('Source scope changed. Rebuild to use this selection.'); });
      label.append(box, document.createTextNode(' ' + s.title + ' · ' + s.coverage)); list.append(label);
    }
  }
  function invalidate(message) { revision++; if (!product) return; stale = true; frame.hidden = true; actions.hidden = true; setStatus(message); }
  form.addEventListener('input', e => { if (e.target.type !== 'checkbox') invalidate('Frame or inquiry changed. Rebuild before using this overview.'); });
  sourceList();
  form.addEventListener('submit', async e => {
    e.preventDefault(); invalidate('Rebuilding from the current frame and sources…'); const startedAt = revision; const button = form.querySelector('[type=submit]'); button.disabled = true; setStatus('Checking source versions and constructing the evidence record…');
    try {
      const fields = Object.fromEntries(['question', 'viewpoint', 'owner', 'experiencer', 'query', 'expected', 'basis', 'gapQuery', 'stakes', 'next'].map(k => [k, ['query', 'gapQuery'].includes(k) ? form.elements.namedItem(k).value : val(k)]));
      const expects = fields.expected || fields.basis || fields.gapQuery || fields.stakes || fields.next;
      const recipe = { sources: scope(), frame: { question: fields.question, viewpoint: fields.viewpoint, owner: fields.owner, experiencer: fields.experiencer,
        query: form.elements.namedItem('query').value, selection: 'Exact case-sensitive text selection over selected source extractions; all nonempty lines if query is empty.' },
        expectations: expects ? [{ expected: fields.expected, basis: fields.basis, owner: fields.owner, standing: 'owned', query: fields.gapQuery, stakes: fields.stakes, next: fields.next }] : [] };
      const signature = JSON.stringify(scope());
      const frameSignature = JSON.stringify([...form.querySelectorAll('input[type=text],textarea')].map(el => el.value));
      const p = await materializeOverview(recipe);
      if (startedAt !== revision || signature !== JSON.stringify(scope()) || frameSignature !== JSON.stringify([...form.querySelectorAll('input[type=text],textarea')].map(el => el.value))) throw new Error('Sources or framing changed during construction; rebuild.');
      product = p; stale = false; frame.srcdoc = p.html; frame.hidden = false; actions.hidden = false;
      let saved = true;
      try { localStorage.setItem(key, JSON.stringify({ ...fields, sources: [...selected] })); } catch { saved = false; }
      setStatus('Byte provenance replay passed. ' + p.overview.blocks.filter(b => b.type === 'witness').length + ' passages selected. Coverage is declared for each source; original-media mapping remains a limitation for extractions.' + (saved ? '' : ' Could not save your framing in this browser.'));
      const links = root.querySelector('[data-read]'); links.replaceChildren();
      for (const s of recipe.sources) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Read in workspace: ' + s.title;
        b.addEventListener('click', async () => { const verified = await checkedProduct(); if (verified && verified === product && !stale) onRead(s.id); }); links.append(b);
      }
    } catch (err) { product = null; actions.hidden = true; frame.hidden = true; setStatus('Cannot build: ' + err.message); }
    finally { button.disabled = false; }
  });
  async function checkedProduct() {
    if (!product || stale) return null;
    const captured = product, capturedRevision = revision;
    const v = await verifyMaterialization(captured, scope());
    if (!v.ok || stale || revision !== capturedRevision || product !== captured) {
      // A new build may have replaced the artifact while replay was pending.
      // Refuse the old action without hiding that newer build.
      if (product === captured) invalidate('Evidence or framing changed during verification. Rebuild before opening or exporting.');
      return null;
    }
    return captured;
  }
  async function download(kind) {
    const verified = await checkedProduct();
    if (!verified || verified !== product || stale) return;
    const bytes = kind === 'html' ? verified.html : JSON.stringify(verified.overview, null, 2);
    const url = URL.createObjectURL(new Blob([bytes], { type: kind === 'html' ? 'text/html;charset=utf-8' : 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'evidence-overview.' + kind; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  root.querySelector('[data-export]').addEventListener('click', () => download('html').catch(e => setStatus(e.message)));
  root.querySelector('[data-json]').addEventListener('click', () => download('json').catch(e => setStatus(e.message)));
  return { update({ docs: next }) { const n = overviewSources(next); if (JSON.stringify(n) !== JSON.stringify(current)) { current = n; sourceList(); invalidate('Source bytes or metadata changed. This overview is stale; rebuild.'); } } };
}
