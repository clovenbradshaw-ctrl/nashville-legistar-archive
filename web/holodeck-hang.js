// holodeck-hang.js — which hanging reveals the most meaning here, measured.
//
// A repo, a book report, and a sonnet recording do not share affordances:
// the same bytes hung as narrative, as graph, or as timeline reveal different
// comparisons. This module decides the hang the way tschichold.js decides a
// setting: run every candidate against the content's own bytes, hold each to
// its evidence, keep losers as quiet, and record the decision with its frame
// so a later reading — or a later direction from you — can overturn it.
//
// No tuned numbers. Scores are measured fractions of the text's own lines;
// the winner must strictly beat its runner-up (comparative, never a cutoff);
// a hang with zero witness lines cannot hang anything (structural minimum);
// a tie is a typed gap (`undecided`), never a guess. Your input is ordinal —
// "prefer X over Y in scope S" — never a weight, and lives in an append-only
// directions ledger (localStorage `hd:hang-directions`, file override for
// tests): entries are superseded, never edited or deleted.
//
// Media kinds (Image, Audio, Video, Music, Math, Spreadsheet, Data, Slides,
// Book) are hung by holodeck-media.js's own sniff magic + decoders — measured
// upstream from bytes, not chosen here; this module records that basis. Only
// text-ish content (Text, Notes, Web page, Email, Log, File, upper-cased code
// extensions, PDF *with* a text layer) is hung here, among code / prose /
// grid. A scanned PDF (no text layer) hangs as `pages`.
//
// Pure except the directions store. UMD like holodeck-region.js: browser
// global HDHang, node module.exports for the falsification trials.
(function (root) {
  const HANG_SCHEMA = 'EOHang@1';
  const DIRECTIONS_KEY = 'hd:hang-directions';

  // Media hangs decided upstream by sniff magic + decoders (holodeck-media.js
  // sniffReport, readImage/readSound/readMidi/readTex/readXlsx): the bytes
  // were looked at, not the suffix. Recorded here as basis, never re-decided.
  const MEDIA_HANG = {
    Image: 'gallery', Audio: 'timeline', Video: 'timeline', Music: 'score',
    Math: 'proof', Spreadsheet: 'table', Data: 'table', Slides: 'deck', Book: 'sequence',
  };

  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  // Layout lines for counting. Structural: a file with no line breaks has no
  // layout, so fall back to sentences (split on terminal + space) for the
  // prose/grid primitives. Code primitives stay on raw lines — imports and
  // definitions are line-anchored; minified single-line code stays a typed
  // gap (untaught), never forced.
  function layoutLines(text) {
    const raw = String(text ?? '').split('\n').filter(l => l.trim());
    if (raw.length >= 3) return { lines: raw, segmented: false };
    const seg = String(text ?? '').split(/(?<=[.!?。！？।])\s+/).map(s => s.trim()).filter(Boolean);
    return { lines: seg.length ? seg : raw, segmented: raw.length < seg.length };
  }
  const nonEmpty = t => layoutLines(t).lines;

  // ── primitives: witness-line counts, structural signatures, falsifiable ──
  // Each returns { n, of, example }. No thresholds inside: counting only.
  // Learned lesson 2026-09-29 (Bitcoin panel encounter, kept with provenance
  // because it was measured, not assumed): comment prose outvotes code, so
  // comments are stripped before counting — // after code, /* */, and #
  // except the closed preprocessor table. URLs survive (their // follows a
  // colon); a // inside a string literal is disclosed collateral. This lesson
  // covers the C-family/shell/Python/JS comment shapes encountered; anything
  // else stays a gap for its own encounter, never pre-learned.
  const PREPROC = new Set(['include', 'define', 'pragma', 'if', 'endif', 'else', 'elif', 'error', 'warning', 'line', 'undef', 'ifdef', 'ifndef']);
  function stripComments(lines) {
    let stripped = 0; const out = []; let block = false;
    for (const l of lines) {
      let s = l;
      if (block) { const e = s.indexOf('*/'); if (e === -1) { stripped++; continue; } s = s.slice(e + 2); block = false; }
      const b = s.indexOf('/*');
      if (b !== -1) { const e = s.indexOf('*/', b + 2); if (e === -1) { s = s.slice(0, b); block = true; } else s = s.slice(0, b) + ' ' + s.slice(e + 2); }
      s = s.replace(/(^|[\s;{}()])\/\/.*$/, '$1');
      const hm = s.match(/^(\s*)#(.*)$/);
      if (hm && !PREPROC.has((hm[2].match(/^\s*(\w+)/) || [, ''])[1])) s = hm[1];
      if (s !== l) stripped++;
      out.push(s);
    }
    return { lines: out, stripped };
  }
  const PRIMITIVES = {
    // Edges count, whatever their target resolves to — resolution is
    // nobody's job here. (Narrowed 2026-09-29: the old internal-target test
    // was a JS-workspace assumption; #include <...> refuted it.)
    importEdges(lines) {
      const hit = lines.filter(l => /^\s*(import\b|export\b.*?from|require\s*\(|from\s+["']|#include\b|using\s+[\w:]+\s*;)/.test(l));
      return { n: hit.length, of: lines.length, example: (hit[0] || '').trim().slice(0, 80) };
    },
    // A symbol introduced for later use: function/class/def/fn, const-like
    // with up to three leading qualifier words, or — learned 2026-09-29 from
    // bitcoin .cpp, which otherwise hung prose on its own comments — a
    // C-family signature `type name(args)` closing on { ; const or end.
    // Control flow stays quiet: `if (` has no second word, `for (` carries
    // a semicolon the signature refuses.
    symDefs(lines) {
      const hit = lines.filter(l => /^\s*(?:[A-Za-z_]+\s+){0,3}(const|let|var)\s+\w+\s*=/.test(l)
        || /^\s*(function\s+\w|class\s+\w+|def\s+\w+|fn\s+\w+)/.test(l)
        || /^\s*[A-Za-z_][\w:<>*&~]*\s+[A-Za-z_~][\w:~]*\s*\([^;=\n]*\)\s*(\{|;|const\b|$)/.test(l));
      return { n: hit.length, of: lines.length, example: (hit[0] || '').trim().slice(0, 80) };
    },
    // sentence-like lines: ending on a sentence-terminal mark. `;` `{` `}` are
    // deliberately outside the class, so code stays quiet without any floor.
    sentenceLines(lines) {
      const hit = lines.filter(l => /[.!?。！？।]["'”’)\]]?\s*$/.test(l.trim()));
      return { n: hit.length, of: lines.length, example: (hit[0] || '').trim().slice(0, 80) };
    },
    // grid-like lines: a 3+-space run between text on both sides (the byte-grid
    // resolution unit — leading indentation does not count; prose sets single
    // spaces, pdftotext -layout gutters are wide) or 2+ tabs.
    gridLines(lines) {
      const hit = lines.filter(l => /\S {3,}\S/.test(l) || (l.match(/\t/g) || []).length >= 2);
      return { n: hit.length, of: lines.length, example: (hit[0] || '').trim().slice(0, 80) };
    },
  };

  // A hang is viable only with at least one witness line (structural minimum:
  // nothing to hang from). Score is the measured fraction; winner must
  // strictly exceed its runner-up — comparative, no cutoff.
  const HANGS = [
    { id: 'code', lens: 'graph', needs: ['importEdges', 'symDefs'] },
    { id: 'prose', lens: 'sequence', needs: ['sentenceLines'] },
    { id: 'grid', lens: 'table', needs: ['gridLines'] },
  ];

  function scoreNeeds(needs, prims) {
    let n = 0, of = 0;
    for (const k of needs) { n += prims[k].n; of = prims[k].of; }
    return { n, of, frac: of ? n / of : 0 };
  }

  function detectHangs(content) {
    const lay = layoutLines(content.text);
    const cleaned = stripComments(lay.lines);
    const prims = {};
    for (const [k, fn] of Object.entries(PRIMITIVES)) prims[k] = fn(cleaned.lines);
    const qualifying = `over ${cleaned.lines.length} lines${lay.segmented ? ' (sentence-segmented: no line layout)' : ''}${cleaned.stripped ? `, ${cleaned.stripped} comment-stripped` : ''}`;
    const T = HANGS.length, level = 1 / T;
    const scored = HANGS.map(h => ({ ...h, ...scoreNeeds(h.needs, prims), viable: scoreNeeds(h.needs, prims).n >= 1 }));
    const viable = scored.filter(s => s.viable).sort((a, b) => b.frac - a.frac);
    const fired = [], quiet = [];
    for (const s of scored) (s.viable ? fired : quiet).push({ id: s.id, lens: s.lens, frac: +s.frac.toFixed(4), witnesses: s.n, lines: s.of, evidence: s.needs.map(k => `${k}:${prims[k].n}`).join(' ') });
    return { prims, fired, quiet, T, level, viable: viable.map(v => v.id), qualifying };
  }

  // ── directions ledger: ordinal input, append-only, on the record ──────────
  // Entry: { id, at, giver, prefer, over, scope:{type?,titleIncludes?}, reason,
  //   supersedes?, supersededBy? }. Matching scope: empty matches all.
  function memStore() {
    let rows = [];
    return { load: () => rows.slice(), save: r => { rows = r.slice(); } };
  }
  function store() {
    try {
      if (typeof localStorage !== 'undefined') return {
        load: () => JSON.parse(localStorage.getItem(DIRECTIONS_KEY) || '[]'),
        save: r => localStorage.setItem(DIRECTIONS_KEY, JSON.stringify(r)),
      };
    } catch { /* fall through */ }
    try {
      const file = (typeof process !== 'undefined' && process.env && process.env.HD_HANG_DIRECTIONS_FILE) || (typeof globalThis !== 'undefined' && globalThis.__HDHANG_FILE__) || null;
      if (file) {
        const fs = typeof require !== 'undefined' ? require('node:fs') : null;
        if (fs) return {
          load: () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } },
          save: r => fs.writeFileSync(file, JSON.stringify(r, null, 1)),
        };
      }
    } catch { /* fall through */ }
    if (!root.__hdhangMem) root.__hdhangMem = memStore();
    return root.__hdhangMem;
  }
  function listDirections() { return store().load(); }
  function addDirection({ prefer, over, scope = {}, reason = '', giver = 'you', supersedes = null }) {
    const st = store(), rows = st.load();
    const entry = { id: 'hd' + hash(prefer + over + JSON.stringify(scope) + Date.now() + Math.random()).slice(0, 6), at: new Date().toISOString(), giver, prefer, over, scope, reason, supersedes };
    if (supersedes) { const old = rows.find(r => r.id === supersedes); if (old) old.supersededBy = entry.id; }
    rows.push(entry); st.save(rows);
    return entry;
  }
  const live = rows => rows.filter(r => !r.supersededBy);
  function inScope(dir, content) {
    const s = dir.scope || {};
    if (s.type && s.type !== content.type) return false;
    if (s.titleIncludes && !String(content.title || '').includes(s.titleIncludes)) return false;
    return true;
  }
  // Pairwise ordinal override, oldest live direction first; every application
  // is logged, so a flip is attributable, never silent. A direction is an
  // instruction, not a measurement: it applies whenever its `over` is ranked,
  // promoting `prefer` to the front even from non-viable (basis stays
  // `direction`, never `measured`). Out-of-scope or irrelevant directions
  // are skipped, never logged as applied.
  const KNOWN_HANGS = ['code', 'prose', 'grid', 'undecided'];
  function applyDirections(ranked, content, dirs) {
    const order = ranked.slice(), applied = [];
    for (const d of live(dirs)) {
      if (!inScope(d, content)) continue;
      if (!KNOWN_HANGS.includes(d.prefer)) continue;
      if (order.indexOf(d.over) === -1) continue;
      const iP = order.indexOf(d.prefer);
      if (iP !== -1) order.splice(iP, 1);
      order.splice(order.indexOf(d.over), 0, d.prefer);
      applied.push(d.id);
    }
    return { order, applied };
  }

  // ── the decision ──────────────────────────────────────────────────────────
  function readHanging(content, { directions = null } = {}) {
    const type = content.type || 'Text';
    const ledger = [];
    // Media kinds: hung upstream by sniff magic + decoders — record the basis.
    if (type === 'PDF' && !String(content.text || '').trim()) {
      ledger.push('no text layer: media hang `pages` (basis: pdf text-layer probe, measured)');
      return fin(content, 'pages', 'media-sniff', [], ledger, { scanners: 0 });
    }
    if (MEDIA_HANG[type] && type !== 'PDF') {
      ledger.push(`type ${type}: media hang \`${MEDIA_HANG[type]}\` (basis: holodeck-media sniff magic + decoder, measured upstream)`);
      return fin(content, MEDIA_HANG[type], 'media-sniff', [], ledger, {});
    }
    const text = type === 'PDF' ? String(content.text || '') : String(content.text || content.htmlText || '');
    const d = detectHangs({ text });
    const dirs = directions ?? listDirections();
    const measured = d.viable.slice();
    if (!measured.length) {
      ledger.push(`no witnesses among ${d.T} hangs ${d.qualifying}: typed gap \`undecided\`, never a guess`);
      return fin(content, 'undecided', 'gap', [], ledger, d);
    }
    // Strict comparative win required; an exact tie is a gap.
    const second = measured[1] ? d.fired.find(f => f.id === measured[1]).frac : -1;
    const firstFrac = d.fired.find(f => f.id === measured[0]).frac;
    if (firstFrac <= second) {
      ledger.push(`tie at ${firstFrac}: typed gap \`undecided\`, never a guess`);
      return fin(content, 'undecided', 'gap', [], ledger, d);
    }
    const { order, applied } = applyDirections(measured, { ...content, type }, dirs);
    const hang = order[0];
    const basis = applied.length ? 'direction' : 'measured';
    ledger.push(`measured ranking ${measured.map(m => `${m}:${d.fired.find(f => f.id === m).frac}`).join(' > ')} ${d.qualifying}`);
    for (const id of applied) { const dir = dirs.find(x => x.id === id); ledger.push(`direction ${id} (${dir.giver}: prefer ${dir.prefer} over ${dir.over}) applied`); }
    ledger.push(`hang \`${hang}\` (basis: ${basis})`);
    return fin(content, hang, basis, applied, ledger, d);
  }
  function fin(content, hang, basis, applied, ledger, d) {
    const id = 'hang-' + hash([content.type, content.title, hang, JSON.stringify((d.fired || []).map(f => [f.id, f.frac]))].join('|'));
    return {
      schema: HANG_SCHEMA, id, hang, basis, applied,
      type: content.type || 'Text', title: content.title || 'Untitled',
      scores: Object.fromEntries((d.fired || []).map(f => [f.id, f.frac])),
      viable: d.viable || [], level: d.level ?? null,
      evidence: (d.fired || []).map(f => `${f.id} ${f.evidence}`).concat((d.quiet || []).map(f => `${f.id} quiet (${f.evidence})`)),
      ledger,
    };
  }

  function workspaceHang(hangings) {
    const kinds = [...new Set(hangings.map(h => h.hang))];
    if (kinds.length <= 1) return { hangs: kinds, recommendation: 'single', evidence: `one hang (${kinds[0] || 'none'}): a single lens serves` };
    return { hangs: kinds, recommendation: 'small-multiples', evidence: `${kinds.length} hangs (${kinds.join(', ')}): incommensurable kinds share no lens — one panel per kind, cross-links only where earned` };
  }

  // Falsification, tschichold falsify() pattern: HELD iff every case hangs as
  // expected, REFUTED otherwise. Cases: [{ label, content, directions?, expect }].
  function falsify(cases = []) {
    const rows = cases.map(c => {
      const r = readHanging(c.content, { directions: c.directions ?? [] });
      const ok = r.hang === c.expect;
      return { label: c.label, expect: c.expect, hung: r.hang, basis: r.basis, verdict: ok ? 'as-expected' : 'counterexample', ledger: r.ledger };
    });
    return { standing: rows.every(r => r.verdict === 'as-expected') ? 'HELD' : 'REFUTED', rows };
  }

  const API = { HANG_SCHEMA, MEDIA_HANG, PRIMITIVES, HANGS, detectHangs, readHanging, workspaceHang, falsify, listDirections, addDirection };
  root.HDHang = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
