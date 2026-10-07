// Explicit authorship is a declaration, never the result of a failed search.
(function(root) {
  const modes = { thought: 'Thought', hypothesis: 'Hypothesis', claim: 'Source claim', analysis: 'My analysis', account: 'I witnessed this', position: 'My position', absence: 'Not found in my search' };
  function declaration(c) {
    const d = c.declaration;
    if (!d || d.text !== c.text || !['analysis', 'account', 'position', 'absence'].includes(d.mode) || (c.mode && c.mode !== d.mode) || typeof d.giver !== 'string' || !d.giver.trim()) return null;
    if (d.mode === 'absence' && (typeof d.note !== 'string' || !d.note.trim() || !d.position?.sources?.length || !d.position?.question?.trim())) return null;
    return d;
  }
  function declare(c, mode, giver, note, position, at = new Date().toISOString()) {
    return { mode, giver: String(giver || '').trim(), note: String(note || '').trim(), text: c.text, position: JSON.parse(JSON.stringify(position)), at };
  }
  function summary(d) {
    const p = d.position || {};
    return [modes[d.mode] + ' · ' + d.giver, d.note, 'Question: ' + (p.question || 'not declared'), 'Workspace: ' + (p.workspace || 'not declared'), 'Sources: ' + (p.sources || []).map(s => s.title || s.id).join('; '), 'Frame: ' + (p.frame || 'not declared'), 'Recorded: ' + d.at].filter(Boolean).join(' · ');
  }
  const api = { modes, declaration, declare, summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HDGround = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

