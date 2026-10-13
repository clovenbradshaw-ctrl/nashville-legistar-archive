// holodeck-ask.js — The Fold, inside Holodeck. A conversation over this workspace's own sources, answered by a
// model in this tab (WebLLM on WebGPU, Gemma 2 2B by default; Ollama on localhost if it is running) and held to
// The Fold's rules: retrieval is mechanical, the model is never shown an address or asked to cite, every sentence
// is attributed afterwards by what it shares with a passage, figures and names are checked against the bytes, and
// each turn folds to a one-line paraphrase (System 1) and an addressed record (System 2). What is sent on turn
// 400 is the summary, the records, and the last exchanges — never the transcript. Whatever the model is, it only
// ever rides in as the mouth of this full pipeline — it never runs outside it.
import * as FOLD from './vendor/the-fold/fold.js';
import { mechanicalRefresh } from './holodeck-carry.js';
import { chunkSource, retrieve, buildSourceBlock, openQuestions, readRange, tokenize, foldDiacritics } from './vendor/eoreader7/native/organs/source.js';
import { meetingBoundaries } from './vendor/eoreader7/native/organs/speaker.js';
import { buildFactBlock, dedupeSourceText } from './vendor/eoreader7/native/organs/fact-block.js';
import { makeEngineRelationReader, readCorpus, blankMarkup } from './holodeck-reader.js';
import * as HH from './holodeck-chat-lane.js';
import { answerFromFold } from './holodeck-inquiry.js';
import { mathInstance, aboutArithmetic } from './holodeck-math.js';
import { activationRetrieval } from './holodeck-activation.js';
let _reader = null; const reader = () => _reader || (_reader = makeEngineRelationReader());
import { ladder, conclusionOf, select } from './holodeck-summary.js';
// Gary, the prompt archon: he owns what the mouth is handed, in what order, and
// what never enters. The subject fold is INPUT, so it goes through his door.
//
// MEASURED, THEN FALSIFIED AND RESTATED. The first experiment reported
// "fold-at-identity carries the turn 3/3" against a raw baseline of 1/3. That
// was MISPABELED: its identity was set to the OPPOSITE of the document's
// dominant stance, so the fold surfaced the document's MAJORITY-stance claims
// by construction, and the "carried" metric (answer stance != identity stance)
// simply rewarded echoing them. It measured MAJORITY-ECHO, not a turn. A turn
// is a minority inversion, and the construction could not surface one (0/4
// minority picks against 2/4 when folding at a HELD identity).
//
// The honest result, the tautology removed (falsify-turn2.mjs, one specimen,
// the turn's own tokens): folding at a HELD identity (a reader who holds the
// document's majority, so the MINORITY audit finding is what overturns it)
// carries 3/5; the raw baseline 2/5; the empty fold 0/5; an unrelated null
// 0/5. A weaker but real effect on one specimen, and the null is clean. The
// mechanism — fold at an identity, and the turn is what inverts it — is sound;
// the headline number was not. Two things remain closed from the first run:
// the fold must be at an IDENTITY or it does not see a turn (empty 0/5), and
// markup must be blanked (a CSS document folded as "CSS styles" until
// blankMarkup). Gary's door keeps the fold a FACT and the question last.
import { makeGary } from './vendor/eoreader7/native/organs/gary.js';
let _gary = null; const gary = () => _gary || (_gary = makeGary());
import { coverage, stripSelfCitations } from './vendor/eoreader7/native/organs/cite.js';
import { checkGrounding, unsupportedClaims } from './vendor/eoreader7/native/organs/grounding.js';
export { FOLD, retrieve };

export const WEBLLM_MODELS = [
  { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Gemma 2 2B · in this tab', size: '1.4 GB' },
  { id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC', label: 'SmolLM2 1.7B · in this tab', size: '1.0 GB' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 1.5B · in this tab', size: '1.1 GB' },
  // DeepSeek is NOT offered in-tab: every DeepSeek build WebLLM prebuilds is an R1-Distill reasoning model
  // (it thinks first, then answers), and the fold wants the answer only, with the pipeline doing the reasoning.
  // Over a full token budget an R1 model will burn the whole thing thinking at a trivial prompt and never reach
  // the answer. DeepSeek's non-reasoning option is the MoE (Coder-V2-Lite / V2-Lite, 16B total, 2.4B active) —
  // run it via Ollama, where it flows through this same full pipeline and is listed automatically.
];
// Reasoning/thinking models are kept out of the roster: the fold does the reasoning itself, and a reasoner
// over-thinks simple prompts — it loops and can spend the whole token budget before it ever answers. Neither
// lane exposes a capability flag, so this is name-based; it covers the models people actually pull (deepseek-r1,
// qwq, qwen3 which thinks by default, the *-reasoning/thinker family), and is applied to both lanes.
const THINKING_RE = /(^|[^a-z0-9])(deepseek[-_]?r1|qwq|qwen3(?![-_]?coder)|reasoning|openthinker|smallthinker|exaone[-_]?deep|magistral|marco[-_]?o1|skywork[-_]?o1)([^a-z0-9]|$)/i;
export function isThinkingModel(name) { return THINKING_RE.test(String(name || '')); }
export const DEFAULT_MODEL = 'webllm:gemma-2-2b-it-q4f16_1-MLC';
export function webgpu() { return typeof navigator !== 'undefined' && !!navigator.gpu; }
let _wl = null, _wlId = null, _wlP = null, _wlIv = null, _wlGen = 0;
const WL_STALL_MS = 60000; // the weights ship over the network; no init progress for a minute means the download stalled, not that the GPU is warming up
const WL_SOURCES = ['https://esm.run/@mlc-ai/web-llm', 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm'];
// The engine downloads the weights once (the browser caches them), then runs them on this machine's GPU. Nothing leaves the tab.
// A load that makes no progress is broken, not slow: a watchdog fails it so the next call really retries (a fresh
// engine, and a fallback CDN if the first runtime import did not answer). A late-finishing abandoned engine is unloaded.
export function loadWebLLM(id, onProgress) {
  if (_wl && _wlId === id) return Promise.resolve(_wl);
  if (_wlP && _wlId === id) return _wlP;
  if (_wl && _wlId !== id) { try { _wl.unload(); } catch (e) {} _wl = null; }
  _wlId = id;
  const gen = ++_wlGen;
  const settle = () => { if (_wlIv) { clearInterval(_wlIv); _wlIv = null; } };
  _wlP = new Promise((resolve, reject) => {
    let lastBeat = Date.now(), done = false;
    const beat = () => { lastBeat = Date.now(); };
    (async () => {
      let W = null, lastErr = null;
      for (const src of WL_SOURCES) { try { W = await import(src); break; } catch (e) { lastErr = e; } }
      if (!W) throw lastErr || new Error('Could not load the WebLLM runtime.');
      return W.CreateMLCEngine(id, { initProgressCallback: p => { beat(); onProgress && onProgress(p); } });
    })().then(e => {
      done = true; settle();
      if (gen !== _wlGen) { try { e.unload && e.unload(); } catch (x) {} return; }
      _wl = e; resolve(e);
    }, err => {
      done = true; settle();
      if (gen === _wlGen) { _wlP = null; _wlId = null; reject(err); }
    });
    _wlIv = setInterval(() => {
      if (done) { settle(); return; }
      if (Date.now() - lastBeat > WL_STALL_MS) {
        if (gen !== _wlGen) { settle(); return; }
        onProgress && onProgress({ text: 'The download has stalled — it will start again.', progress: 0 });
        done = true; settle(); _wlP = null; _wlId = null;
        reject(new Error('The model download stalled. It will be fetched again.'));
      }
    }, 3000);
  });
  return _wlP;
}
export function webllmLoaded(id) { return !!_wl && _wlId === id; }
async function chatWebLLM(id, messages, { onToken, format, maxTokens, signal } = {}) {
  const eng = await loadWebLLM(id);
  // Gemma's chat template has no system turn: the system block rides at the head of the first user message instead.
  let msgs = messages;
  if (/gemma/i.test(id)) { const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n'); msgs = messages.filter(m => m.role !== 'system').map(m => ({ ...m })); const u = msgs.find(m => m.role === 'user'); if (sys && u) u.content = sys + '\n\n' + u.content; }
  const req = { messages: msgs, temperature: 0.2, ...(maxTokens ? { max_tokens: maxTokens } : {}) };
  if (format) req.response_format = { type: 'json_object', schema: JSON.stringify(format) };
  const onAbort = () => { try { eng.interruptGenerate(); } catch (e) {} };
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    if (!onToken) { const r = await eng.chat.completions.create({ ...req, stream: false }); return { text: (r.choices[0] && r.choices[0].message.content) || '', stats: { eval_count: r.usage && r.usage.completion_tokens, prompt_eval_count: r.usage && r.usage.prompt_tokens } }; }
    const it = await eng.chat.completions.create({ ...req, stream: true, stream_options: { include_usage: true } }); let out = '', usage = null, t0 = performance.now();
    for await (const ch of it) { const d = ch.choices && ch.choices[0] && ch.choices[0].delta && ch.choices[0].delta.content; if (d) { out += d; onToken(out); } if (ch.usage) usage = ch.usage; }
    if (signal && signal.aborted) throw new Error('aborted');
    return { text: out, stats: { eval_count: usage && usage.completion_tokens, prompt_eval_count: usage && usage.prompt_tokens, total_duration: (performance.now() - t0) * 1e6 } };
  } finally { if (signal) signal.removeEventListener('abort', onAbort); }
}
export const OLLAMA = 'http://localhost:11434';
export const BASE_PROMPT = 'You are helping a reporter read the documents in their workspace: audits, meeting transcripts, reports, pages and records. Answer the question in plain prose. Where the passages below cover it, answer from them. Where they do not, say what is missing instead of filling it in.';
// Plain conversation — no material, or small talk that is not a research
// question at all. Never mentions reporters, documents, passages, or the
// workspace unless the person asked about them. A greeting gets a greeting,
// not a request for passages.
export const CHAT_PROMPT = 'You are a helpful conversational assistant. Reply directly, briefly, and naturally, the way a person would. Do not mention reporters, documents, passages, sources, or a workspace unless the person asked about them. If they just say hi or ask how you are, answer in kind and offer to help — never ask them to provide passages.';
const SMALLTALK_RE = /^(hi|hey|hello|yo|sup|good\s?(morning|afternoon|evening)|how are you|how's it going|how is it going|thanks|thank you|bye|goodbye|good night|see you)\b/i;
export function isSmallTalk(question) {
  const q = String(question ?? '').trim();
  return q.length > 0 && q.length < 60 && SMALLTALK_RE.test(q);
}

export async function probe(base = OLLAMA) {
  try {
    const r = await fetch(base + '/api/tags', { cache: 'no-store' });
    if (!r.ok) return { ok: false, why: 'Ollama answered ' + r.status };
    const j = await r.json(); const models = (j.models || []).map(m => ({ name: m.name, size: m.size, family: m.details && m.details.family, params: m.details && m.details.parameter_size }));
    return { ok: true, models };
  } catch (e) { return { ok: false, why: String(e && e.message || e) }; }
}

// Passages: every kept source, chunked by the engine's own boundaries (blank lines, tabular rows), addressed by byte range.
export function index(docs) {
  const t0 = Date.now(); const chunks = []; const texts = {}; const docOf = {}; const used = new Map();
  for (const d of docs) { const text = d.text || ''; if (text.length < 40) continue;
    let name = String(d.title || d.id).replace(/#/g, '').slice(0, 90); const k = used.get(name) || 0; used.set(name, k + 1); if (k) name += ' (' + (k + 1) + ')';
    texts[name] = text; docOf[name] = d.id;
    let boundaries;
    try { const turns = meetingBoundaries(text); if (turns.length >= 3) boundaries = turns.map((t, i) => ({ start: t.start, end: i + 1 < turns.length ? turns[i + 1].start : text.length, label: t.speaker || null })).filter(b => b.end > b.start); } catch (e) {}
    try { for (const c of chunkSource(name, text, boundaries ? { boundaries } : {})) chunks.push(c); } catch (e) { try { for (const c of chunkSource(name, text)) chunks.push(c); } catch (e2) {} } }
  return { chunks, texts, docOf, ms: Date.now() - t0 };
}

async function chat(base, model, messages, opts = {}) {
  if (String(model).startsWith('webllm:')) return chatWebLLM(String(model).slice(7), messages, opts);
  // A heimdall model rides the heimdall bridge (the fleet, linked hosts, and
  // the sealed outside providers). For a sealed model the lane sends
  // heimdall_privacy:"sealed-external" and the caller must have withheld
  // verbatim spans (turn()'s sealed guard) — the bridge refuses otherwise.
  if (String(model).startsWith('heimdall:')) return HH.chat(HH.HEIMDALL, String(model).slice(9), messages, { onToken: opts.onToken, format: opts.format, maxTokens: opts.maxTokens, signal: opts.signal, sealed: !!opts.sealed });
  const { onToken, format, maxTokens, signal } = opts;
  const body = { model, messages, stream: !!onToken, keep_alive: '3600s', options: { num_ctx: 4096, temperature: 0.2, ...(maxTokens ? { num_predict: maxTokens } : {}) } };
  if (format) body.format = format;
  const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!r.ok) throw new Error('Ollama ' + r.status + ': ' + (await r.text()).slice(0, 200));
  if (!onToken) { const j = await r.json(); return { text: (j.message && j.message.content) || '', stats: j }; }
  const rd = r.body.getReader(); const dec = new TextDecoder(); let buf = '', out = '', stats = null;
  for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
      let j; try { j = JSON.parse(line); } catch (e) { continue; }
      if (j.message && j.message.content) { out += j.message.content; onToken(out); }
      if (j.done) stats = j; } }
  return { text: out, stats };
}

// One turn. `conv` = { summary, history, turns }. `computed` is an optional block of values computed from the
// Records database (never asked of the model); it rides into the prompt as material and onto the record.
export async function turn(conv, IX, question, { base = OLLAMA, model = DEFAULT_MODEL, computed = null, reading = null, retrievalQ = null, resolved = null, ctx = 4096, onToken, onStage, signal, deferFold = false, onFold = null, docs = null, summarize = true, privacy = 'local-raw', rix = null, carry = 'model', declarations = null } = {}) {
  const t0 = Date.now(); const turnNo = (conv.summary.turnCount || 0) + 1;
  // THE SEALED BOUNDARY: an outside executor (heimdall frontier/remote model)
  // may only receive the projection the Fold builds. When the caller selects
  // sealed-external, the verbatim spans are withheld from build() below and
  // the heimdall lane carries heimdall_privacy:"sealed-external". Raw material
  // never leaves for a stronger model's convenience (spec §2.I).
  const sealed = privacy === 'sealed-external';
  const folded = conv.summary.records.flatMap(r => r.refs || []);
  onStage && onStage('retrieving');
  const qTerms = [...new Set(tokenize(retrievalQ || question))];
  // §7 MEANING ACTIVATION (holodeck-activation.js), composed, no second engine:
// retrieve by the referents the reading ADMITTED (rix.cast → the engine's own
// identity index via readingIndexFromLog), hop-0/structure over the mention
// book. When the question resolves to no referent the term retriever stands —
// the organ's own `basis` rule — and the method is disclosed either way on the
// turn and the inquiry record (§16.6).
  let activation = null;
  try { activation = activationRetrieval({ rix, IX, question: retrievalQ || question, transcript: conv.turns, seen: folded, limit: 8 }); } catch { activation = null; }
  const ranked0 = activation ? activation.passages : retrieve(IX.chunks, retrievalQ || question, 8, folded);
  const retrievalMeta = activation
    ? { basis: 'activation', source: 'meaning activation over the workspace cast', resolution: activation.meta.resolution, active: activation.meta.active.length, hop1: activation.meta.hop1.length, window: activation.meta.window, grain: activation.meta.grain, why: activation.meta.why, fallback: false }
    : { basis: 'surface', source: 'workspace chunk index (term)', chunks: IX.chunks.length, why: 'meaning activation resolved no referent', fallback: true };
  const ranked = ranked0.map(c => narrow(c, qTerms));
  const history = conv.history.slice(-2).map(m => ({ ...m, content: m.content.length > 1200 ? m.content.slice(0, 1200) + '…' : m.content }));
  // THE SURF AND FOLD (eoreader7 / the-fold holon.js): the passages are read by the engine's own relation reader,
  // and what the model receives is that reading as defeasible NOTES plus only the byte-addressed spans that bound
  // each note — never the retrieved chunks themselves. A passage no note came from is withheld, and if nothing
  // bound at all, the model is told so in plain words instead of being handed raw text to fill from memory.
  onStage && onStage('reading');
  let relations = null, factBlock = null;
  try { const R = await reader(); relations = R(ranked); factBlock = buildFactBlock(relations, ranked, question); } catch (e) { factBlock = null; }
  const spanBlock = factBlock && factBlock.spans && factBlock.spans.length ? factBlock.spans.map(sp => '"' + sp.text + '"').join('\n\n') : null;
  // Greetings and materialless small talk are never run under the reporter
  // prompt: with no passages in view that prompt's "say what is missing"
  // instruction makes the model answer "how are you" with a request for
  // passages. Plain conversation gets the plain prompt instead.
  // THE SUBJECT FOLD — ON, AND ADDITIVE. Its job is the VOID: when the material
  // yields too few readable claims about the subject, the fold says so
  // explicitly (DEF·Ground) instead of vanishing, and carries what the material
  // DOES state, grounded. A silent absence is what a model fills from memory, so
  // the void is never optional. The earlier harm — the fold DISPLACING the
  // verbatim source — is closed by construction: the material always rides
  // beside the fold now (see build() below), so the fold can add a reading and
  // a void without taking the source's own words away. (Earlier "fold worse
  // than raw" runs measured a pipeline that never sent material at all — a
  // contentless question took the no-material branch; the real, material-present
  // run showed the fold a wash at worst. An even earlier "3/3 turn" was a
  // tautology.) summarize:false remains available to omit it entirely.
  let synopsis = null; let garyCheck = null;
  if (summarize) {
    try {
      onStage && onStage('summarizing');
      synopsis = await subjectSummary(ranked, { question, reader: await reader() });
    } catch (e) { synopsis = null; }
  }
  let offered = ranked.slice();
  // A VOID fold is itself a fact in view — the workspace's silence — so it makes
  // the turn a MATERIAL turn (the reporter prompt), never small talk. Without
  // this, a question that retrieves nothing falls to CHAT_PROMPT and the model
  // answers a research question with a greeting (measured: "What did the audit
  // find about the missing contract funds?" → "I'm ready to help! What can I do
  // for you?"). The variable was named for the mirror and used as the door.
  const hasMaterial = offered.length > 0 || !!(synopsis && synopsis.text) || !!((computed && computed.text) || (reading && reading.text));
  const chatMode = isSmallTalk(question) || !hasMaterial;
  const activePrompt = chatMode ? CHAT_PROMPT : BASE_PROMPT;
  // THE FOLD AS INFORMATION, AND GARY'S CHECK.
  //
  // A NON-VOID fold is the material's own selected sentences about the subject —
  // a FACT in view, placed BESIDE the verbatim material (never in place of it:
  // measured, the fold alone carried less than the source's own words and
  // displaced them). It is stated as what it is, the person's own question stays
  // the final turn, and Gary reads the composed messages before they ship.
  //
  // A VOID fold (subjectSummary.void) is the summary's REAL job: when the
  // material yields too few readable claims to fold, the model is told the
  // emptiness EXPLICITLY — what the material does state, grounded, and that it
  // states nothing on the subject. A silent absence is what a model fills from
  // memory (the "William R. Hargis" incident); the mechanical reader is the one
  // faculty that can declare the void at the point of the subject, so it does.
  const foldAsFact = synopsis && synopsis.text
    ? (synopsis.void
      ? 'What the material states, and does not state, about this:\n' + synopsis.text
      : 'The material\u2019s own sentences about this, verbatim:\n' + synopsis.text)
    : null;
  const build = (off, facts, fold) => {
    // The verbatim material ALWAYS rides (the surf's spans when the surf bound,
    // else the deduped source) — EXCEPT under the sealed boundary, where an
    // outside executor may only see the reading, never the raw spans. The
    // withholding is declared in the prompt, so the absence is not silence.
    const raw = sealed ? null : (facts && !facts.empty ? spanBlock : buildSourceBlock(dedupeSourceText(off, relations)));
    const sealedNote = sealed ? 'The material\u2019s reading only — verbatim spans are withheld for this executor. Ask what the reading says; it cannot quote the source.' : null;
    let sb = [facts ? facts.text : null, fold, raw, sealedNote].filter(Boolean).join('\n\n');
    if (reading && reading.text) sb = (sb ? sb + '\n\n' : '') + 'What the reader established about the names asked about:\n' + reading.text;
    if (computed && computed.text) sb = (sb ? sb + '\n\n' : '') + 'Counted from the workspace records:\n' + computed.text;
    return FOLD.buildTurnMessages({ basePrompt: activePrompt, summary: conv.summary, history, question, sourceBlock: sb }); };
  let messages = build(offered, factBlock, foldAsFact);
  if (foldAsFact) {
    let read = null; try { read = gary().hand(messages, { model, options: { num_ctx: ctx, num_predict: 700 }, arm: 'full', material: offered.length + (computed && computed.text ? 1 : 0) }); } catch (e) { read = null; }
    if (read && read.refused && read.refused.length) messages = build(offered, factBlock, null); // a fold Gary refuses is withheld, not shipped
    garyCheck = read ? { findings: read.findings, gaps: read.gaps, struck: read.struck } : null;
  }
  while (offered.length > 1 && approxTokens(messages) > ctx - 760) { offered = offered.slice(0, -1); messages = build(offered, factBlock, foldAsFact); }
  if (approxTokens(messages) > ctx - 760 && factBlock && factBlock.lines) { const fb = { ...factBlock, text: factBlock.text.split('\n').slice(0, 14).join('\n') }; messages = build(offered.slice(0, 2).map(c => ({ ...c, text: c.text.slice(0, 500) })), fb, foldAsFact); }
  const notes = factBlock ? { lines: factBlock.lines || [], coverage: factBlock.coverage || 0, empty: !!factBlock.empty, omitted: factBlock.omitted || 0, spans: (factBlock.spans || []).length, sentences: factBlock.sentenceCount || 0 } : null;
  const sentChars = FOLD.charCount(messages);
  const transcriptChars = conv.history.reduce((n, m) => n + (m.content || '').length, 0) + question.length;
  onStage && onStage('answering');
  // THE FOLD ANSWERS FIRST (spec §9, "can the Fold answer?"): before any model
  // draw, the exact, addressed doors answer from local evidence alone. When one
  // fires, the model is not asked — a mechanical answer is never laundered
  // through a mouth. Otherwise the turn proceeds to the model exactly as
  // before. The attempt is recorded either way as a FoldInquiry@1
  // (holodeck-inquiry.js), and its disposition rides on the turn.
  // The computation door needs the math engine; it is loaded lazily, ONLY when
  // the question looks arithmetic (aboutArithmetic), so non-numeric turns never
  // pay the vendor load.
  let math = null;
  if (aboutArithmetic(question)) { try { math = await mathInstance(); } catch { math = null; } }
  const foldInquiry = answerFromFold({
    question,
    passages: offered,
    edges: (relations && relations.edges) || [],
    math,
    declarations,
    retrieval: retrievalMeta,
    transcript: conv.turns,
    chunksByRef: new Map(IX.chunks.map((c) => [c.ref, c])),
    cursor: turnNo,
    workspace: IX.workspace ?? null,
  });
  let res = null, answer = null;
  if (foldInquiry.answer) { answer = foldInquiry.answer.text; onStage && onStage('fold-answer'); }
  else { res = await chat(base, model, messages, { onToken, signal, maxTokens: 700, sealed }); answer = stripSelfCitations(res.text).text; }
  onStage && onStage('checking');
  const attr = offered.length ? coverage(answer, offered, IX.chunks) : [];
  const castSet = new Set(((reading && reading.surfaces) || []).map(x => foldDiacritics(String(x).toLowerCase())));
  const resolveName = castSet.size ? n => castSet.has(foldDiacritics(String(n).toLowerCase())) : null;
  const grounding = checkGrounding(answer, offered, { question, resolveName });
  const unsupported = unsupportedClaims(grounding);
  const used = [...new Set(attr.map(a => a.ref).filter(Boolean))];
  const open = openQuestions(question, offered, used);
  const channels = [synopsis && synopsis.text ? 'summary' : null, notes && !notes.empty ? 'notes' : null, offered.length ? 'material' : null, reading ? 'reading' : null, computed && computed.text ? 'records' : null, foldInquiry.answer ? 'fold' : null, foldInquiry.answer ? null : 'model'].filter(Boolean);
  const record = FOLD.buildWarrantRecord({ turn: turnNo, plane: 'world', gist: FOLD.mechanicalFoldLine(question, answer), channels, refs: used, unsupported, open });
  const withRecord = FOLD.addWarrantRecord(conv.summary, record);
  const foldLine = FOLD.mechanicalFoldLine(question, answer);
  // The turn is recorded the moment its answer and addressed record exist. The summary refresh (System 2's
  // discourse fold) is a SECOND model call, and it is never allowed to hold up the record or the next message:
  // when deferred it runs after this returns, and the caller folds its result back in when it lands.
  // CARRY = 'mechanical' (THE-HOLOGRAPH §6): the discourse fields are COMPUTED from the history and the material's cast
  // (holodeck-carry.js) — no second model call, no drift. Default stays 'model' until the mechanical carry has been measured
  // against it; when the cast is empty the mechanical path says why and the model refresh below runs as before.
  const refreshSummary = async (from, sig) => {
    if (carry === 'mechanical' && rix) {
      try {
        const m = mechanicalRefresh({ FOLD, from, foldLine, rix, history: conv.history, question, answer, used });
        if (m.refresh.ok) return m;
      } catch (e) { /* fall through to the model refresh */ }
    }
    try {
      const up = FOLD.buildSummaryUpdatePrompt(from, [...(from.folds || []), foldLine]);
      const r2 = await chat(base, model, [{ role: 'system', content: FOLD.FOLD_SYSTEM_PROMPT }, { role: 'user', content: up }], { format: FOLD.FOLD_SCHEMA, maxTokens: 300, signal: sig, sealed });
      const next = FOLD.updateSummaryWithFold(from, foldLine, r2.text);
      const w = FOLD.extractSummaryFindings(from.entities, next.entities, { records: FOLD.projectRecords(next), folds: next.folds });
      if (w.ok) return { summary: next, refresh: { ok: true } };
      return { summary: FOLD.advanceSummaryFold(from, foldLine), refresh: { ok: false, why: w.findings.map(f => f.detail).join('; ') } };
    } catch (e) { return { summary: FOLD.advanceSummaryFold(from, foldLine), refresh: { ok: false, why: sig && sig.aborted ? '' : String(e.message || e) }, aborted: !!(sig && sig.aborted) }; }
  };
  // Advance immediately so the turn number and the fold list are right for the next turn whether or not the
  // refresh ever lands; the refresh only refines the discourse fields on top of this same base.
  let summary = FOLD.advanceSummaryFold(withRecord, foldLine);
  let refresh = { ok: false, why: '', pending: !!deferFold };
  let fold = null;
  if (foldInquiry.answer) {
    // The Fold answered exactly. No second model call is spent folding a turn
    // that needed no mouth (spec §9: an exact answer is not laundered).
    refresh = { ok: false, why: 'answered from the Fold — no model fold spent' };
  } else if (deferFold) {
    const foldAc = new AbortController();
    const onOuterAbort = () => { try { foldAc.abort(); } catch (e) {} };
    if (signal) signal.addEventListener('abort', onOuterAbort, { once: true });
    fold = { abort: () => { try { foldAc.abort(); } catch (e) {} }, promise: refreshSummary(withRecord, foldAc.signal).then(f => { if (signal) signal.removeEventListener('abort', onOuterAbort); if (onFold && !f.aborted) { try { onFold(f.summary, f.refresh); } catch (e) {} } return f; }) };
  } else {
    onStage && onStage('folding');
    const f = await refreshSummary(withRecord, signal); summary = f.summary; refresh = f.refresh;
  }
  const t = { n: turnNo, question, answer, used: used.map(ref => ({ ref, text: String(readRange(IX.texts, ref) || '').trim().slice(0, 700) })), offered: offered.map(c => ({ ref: c.ref, source: c.source, start: c.start, end: c.end, label: c.label, text: c.text.slice(0, 700) })),
    attr: attr.map(a => ({ text: a.text, ref: a.ref || null, via: a.via || null })), findings: (grounding.findings || []).map(f => ({ text: f.text, kind: f.atomKind, start: f.start, end: f.end, echoesQuestion: !!f.echoesQuestion })),
    examined: !!grounding.examined, record, foldLine, refresh, computed, synopsis, gary: garyCheck, reading: reading ? { lines: reading.lines } : null, notes, resolved: resolved && resolved.length ? resolved : null, sentChars, transcriptChars, messages, model, ms: Date.now() - t0, foldInquiry, noModel: !!foldInquiry.answer, disposition: foldInquiry.disposition, retrieval: retrievalMeta,
    tokens: res && res.stats ? { out: res.stats.eval_count, in: res.stats.prompt_eval_count, secs: res.stats.total_duration ? res.stats.total_duration / 1e9 : null } : null,
    sealed, rawWithheld: sealed ? (factBlock && factBlock.spans && factBlock.spans.length ? factBlock.spans.length : (offered.length || 0)) : 0 };
  return { conv: { summary, history: [...conv.history, { role: 'user', content: question }, { role: 'assistant', content: answer }], turns: [...conv.turns, t] }, turn: t, fold };
}

// A passage too long for a small model's window is narrowed to the stretch where the question's own words are
// densest. The window is a real byte range of the same source, so it keeps an address that reads back.
const WIN = 1400;
function narrow(c, qTerms) {
  if (c.text.length <= WIN) return c;
  const low = c.text.toLowerCase(); const hits = [];
  for (const t of qTerms) { let i = -1; while ((i = low.indexOf(t, i + 1)) >= 0 && hits.length < 400) hits.push(i); }
  hits.sort((a, b) => a - b); let best = 0, bestN = -1;
  for (let i = 0, j = 0; i < hits.length; i++) { while (hits[i] - hits[j] > WIN) j++; if (i - j > bestN) { bestN = i - j; best = hits[j]; } }
  let a = Math.max(0, best - 200); const nl = c.text.lastIndexOf('. ', a); if (nl > a - 300 && nl >= 0) a = nl + 2;
  const b = Math.min(c.text.length, a + WIN); const off = c.text.indexOf(c.text.slice(0, 40)); const baseStart = c.start + (off > 0 ? off : 0);
  const text = c.text.slice(a, b); const start = baseStart + a, end = start + text.length;
  return { ...c, start, end, text, ref: c.source + '#' + start + '-' + end, terms: new Set(tokenize(text)), narrowed: true };
}
const approxTokens = msgs => Math.ceil(msgs.reduce((n, m) => n + (m.content || '').length, 0) / 3.2);

// What eoreader7's own reading of the corpus says about the names a question uses: the referent, how it is
// written, its standing, and who it is held together with. Read off the ground reading's index, never a model.
export function readingBlock(rix, question) {
  if (!rix || !Array.isArray(rix.cast)) return null;
  const q = ' ' + foldDiacritics(String(question).toLowerCase()).replace(/[^a-z0-9\s]/g, ' ') + ' ';
  const norm = x => foldDiacritics(String(x).toLowerCase()).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const hits = [];
  for (const c of rix.cast) { const surf = (c.surfaces || [c.id]).filter(Boolean); let hit = null;
    for (const x of surf) { const k = norm(x); if (k.length >= 4 && q.includes(' ' + k + ' ')) { hit = { c, m: x, k }; break; } }
    if (hit) hits.push(hit); }
  hits.sort((a, b) => b.k.length - a.k.length || (b.c.mentions || 0) - (a.c.mentions || 0));
  const seen = new Set(); const refs = []; const taken = [];
  for (const h of hits) {
    if (seen.has(h.c.id)) continue;
    if (taken.some(t => t.includes(h.k) || h.k.includes(t))) continue; // an overlapping fragment of an already-accepted match (compared on the same normalized form used to find it) -- same underlying phrase, not a distinct entity
    seen.add(h.c.id); taken.push(h.k); refs.push(h.c); if (refs.length >= 3) break;
  }
  if (!refs.length) return null;
  const lines = refs.map(c => { const surf = (c.surfaces || []).slice(0, 5); const nm = surf[0] || c.id;
    const bonds = (rix.bonds || []).filter(b => b.a === nm || b.b === nm).sort((a, b) => b.n - a.n).slice(0, 5).map(b => (b.a === nm ? b.b : b.a) + ' (' + b.n + ')');
    return { name: nm, text: nm + (surf.length > 1 ? ', also written ' + surf.slice(1).join(', ') : '') + '. Mentioned ' + (c.mentions || 0) + ' times across ' + (c.srcN || Object.keys(c.src || {}).length) + ' sources' + (c.standing ? '; standing: ' + c.standing : '') + '.' + (bonds.length ? ' Held together most often with ' + bonds.join(', ') + '.' : ''), surfaces: surf }; });
  return { lines, text: lines.map(l => l.text).join('\n'), surfaces: refs.flatMap(c => c.surfaces || []) };
}

// THE GROUNDED SUMMARY (holodeck-summary.js): the SUBJECT folded at a point —
// not the whole of every source, but the part of the workspace that bears on
// what is being discussed. A conversation moves from subject to subject; the
// summary should ride the subject, drawing its sentences from WHEREVER in the
// workspace they live. So the fold is at the reader's identity (the prior the
// material holds about the question's own names), and what is curated is the
// claims about that subject — one sentence, five, three paragraphs — every line
// a verbatim span of a real source, zero model.
//
// The material is the turn's OWN retrieval: the passages the question's words
// pull from the corpus, read through the engine's relation reader. One ladder
// over the subject, not one per document, because the subject does not stop at a
// document boundary.
// A ladder is monotone only with at least four claims (the 1-sentence pick must
// be one of the 5, and the 5 are the 3 paragraphs); below that there is nothing
// to select between. Named, not a bare literal.
const MIN_CLAIMS_FOR_LADDER = 4;
// A question's named subject, read by the engine's own rule — a run of name-
// LETTERS in ANY cased script (\p{Lu}, Unicode; the same rule identity uses),
// never an English `[A-Z]`. A script with no case (Chinese, Arabic) offers no
// name here, and that is disclosed by the absence, never guessed.
const QNAME_RE = /(?:^|[\s(“"''])(\p{Lu}[\p{L}\p{M}'’.-]*(?:\s+\p{Lu}[\p{L}\p{M}'’.-]*)*)/gu;
function questionNames(question) {
  const out = []; for (const m of String(question || '').matchAll(QNAME_RE)) if (m[1]) out.push(m[1]);
  return [...new Set(out)];
}
// Identity fold: a name matches by the engine's own diacritic fold and a
// case-fold that is a NAMING CONVENTION, not identity (declared: this matches
// how the surface spells a name, not what the name means).
const nameFold = (x) => String(x == null ? '' : x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** subjectSummary(passages, { question, size }) -> the subject's ladder.
 *  `passages` are byte-addressed retrieved passages ({ source, start, end, text })
 *  from the turn's own retrieval — the part of the workspace bearing on the
 *  question, wherever it lives. Read through the engine, folded at the identity
 *  the question's names build, one ladder over the subject. */
export async function subjectSummary(passages, { question = '', size = 5, reader: R = null } = {}) {
  const list = (passages || []).filter(p => p && typeof p.text === 'string' && p.text.trim().length > 40);
  // THE VOID AT THE RETRIEVAL BOUNDARY. No passage shares a word with the
  // question — the workspace states nothing it could find on this. That is the
  // void in its strongest form, and it must be SAID, not returned as null (which
  // makes the turn fall to small talk, the model answering a research question
  // with "how can I help?"). This is a fact about the material, never a
  // prohibition, so Gary passes it.
  if (!list.length) {
    return {
      void: true, at: 'retrieval', n: 0, forWhom: false, one: '', five: [], three: [], spans: [], monotone: true, closest: [],
      text: 'No passage in the workspace shares a word with this question, so nothing here states anything about it. There is no grounded material to answer from — say plainly that the workspace is silent on this rather than answering from general knowledge.',
    };
  }
  const rr = R || (await reader());
  // one synthetic analysis over the retrieved passages, addressed by their own
  // source + span so every claim grounds back into the real document
  const A = { docs: [], docById: {}, sts: [], byId: {}, stsByDoc: {} };
  const seen = new Set();
  for (const p of list) {
    // blank markup IN PLACE (length-preserving) so CSS/HTML is never folded as
    // prose — the offsets are unchanged, content-anchoring still lands.
    const clean = blankMarkup(p.text);
    let report = null, read = null;
    try { report = rr([{ ref: p.ref || (p.source + '#' + p.start + '-' + p.end), text: clean }]); } catch (e) { continue; }
    try { read = report.read(clean); } catch (e) { continue; }
    for (const c of (read.claims || [])) {
      const sp = (c.spans || [])[0]; if (!sp || !sp.text) continue;
      const at = clean.indexOf(sp.text); if (at < 0) continue;
      const s = (p.start || 0) + at, e = s + sp.text.length;
      const key = p.source + ':' + s + '-' + e; if (seen.has(key)) continue; seen.add(key);
      A.sts.push({ id: key, doc: p.source, s, e, text: cleanText(sp.text), readText: sp.text,
        names: [c.end1, c.end2].filter(Boolean), figs: [], ref: false, claimy: !!c.end1 && !!c.end2,
        frame: c.verdict === 'unheard' ? 'attributed' : c.polarity === '-' ? 'uncertain' : 'fact',
        polarity: c.polarity || '+', rel: cleanText(c.label || ''), verdict: c.verdict, year: null });
    }
  }
  // the subject's identity: the claims that name what the question names
  let forWhom = null;
  const qNames = questionNames(question).map(nameFold);
  if (qNames.length) {
    const about = A.sts.filter(st => (st.names || []).some(n => { const nn = nameFold(n); return qNames.some(q => nn.includes(q) || q.includes(nn)); }));
    if (about.length) forWhom = { conclusion: conclusionOf(about, A) };
  }
  const DOC = '__subject__';
  const one = { docs: [{ id: DOC, title: 'the subject', year: null }], docById: { [DOC]: { id: DOC, title: 'the subject', year: null } }, sts: A.sts.map(s => ({ ...s, doc: DOC })), byId: {}, stsByDoc: {} };
  for (const s of one.sts) one.byId[s.id] = s; one.stsByDoc[DOC] = one.sts;
  // THE VOID (DEF·Ground, Clearing). When the material yields too few claims to
  // fold — the subject is absent, or the material is opinion the reader cannot
  // reduce to relations — the summary must NOT vanish. A silent absence is
  // exactly what a model fills from memory (the "William R. Hargis" incident,
  // fact-block.js's own header). So this returns EVERYTHING it did find, with a
  // typed emptiness and the closest grounded spans, never `null`. The void is
  // the mechanical summary's real job: it is the one reader that can say, at the
  // point of the subject, WHAT the material does and does not state.
  if (A.sts.length < MIN_CLAIMS_FOR_LADDER) {
    const closest = A.sts.slice(0, 6).map(st => ({ text: cleanText(st.text), span: { doc: st.doc, s: st.s, e: st.e } }));
    const empty = A.sts.length === 0;
    return {
      void: true, n: A.sts.length, forWhom: !!forWhom, one: '', five: [], three: [], spans: [], monotone: true,
      closest,
      // Every clause here is a FACT about the material the reader can stand on,
      // never a prohibition aimed at the mouth (Gary's information-not-
      // prohibition rule): it states what is present and what is not.
      text: (empty
        ? `The material yields no readable claim about ${qNames.length ? 'the subject asked about' : 'this'} at all — it is present but the reader could reduce none of it to a relation. There is therefore no grounded summary to give.`
        : `The material yields only ${A.sts.length} readable claim${A.sts.length === 1 ? '' : 's'} about this — too few to select a summary from. The closest it does state, verbatim:\n` +
          A.sts.slice(0, 6).map(st => '· ' + cleanText(st.text)).join('\n')),
    };
  }
  let L; try { L = ladder(one, DOC, forWhom ? { forWhom } : {}); }
  catch (e) {
    return { void: true, n: A.sts.length, forWhom: !!forWhom, one: '', five: [], three: [], spans: [], monotone: true, closest: A.sts.slice(0, 6).map(st => ({ text: cleanText(st.text), span: { doc: st.doc, s: st.s, e: st.e } })), text: `The summary could not be built from ${A.sts.length} readable claim(s): ${String(e && e.message || e)}` };
  }
  return { void: false, text: 'One sentence: ' + L.one.lines[0] + (size >= 5 ? '\n' + L.five.lines.map(l => '· ' + l).join('\n') : ''), one: L.one.lines[0], five: L.five.lines, three: L.three.lines, spans: L.five.spans, monotone: L.monotone, n: one.sts.length, forWhom: !!forWhom };
}
const cleanText = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

export function emptyConv() { return { summary: FOLD.emptySummary(), history: [], turns: [] }; }

// DataChat's plan → execute path, with the plan proposed by the local model. The plan's SHAPE is decoding grammar
// (a JSON schema handed to Ollama); DataChat's executor then validates every table and field against the live
// schema, so the model can only ever propose a read. Mirrors bare-metal's planWithLLM, pointed at Ollama.
const PLAN_SCHEMA = { type: 'object', properties: {
  intent: { type: 'string', enum: ['query', 'aggregate', 'profile', 'search'] }, type: { type: 'string' }, record: { type: 'string' },
  filters: { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, op: { type: 'string', enum: ['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'empty', 'notempty'] }, value: { type: 'string' } }, required: ['field', 'op', 'value'] } },
  agg: { type: 'object', properties: { fn: { type: 'string', enum: ['count', 'sum', 'avg', 'min', 'max'] }, field: { type: 'string' }, groupBy: { type: 'string' } } },
  sort: { type: 'object', properties: { field: { type: 'string' }, dir: { type: 'string', enum: ['asc', 'desc'] } } }, limit: { type: 'integer' } },
  required: ['intent', 'type', 'filters'] };
const PLAN_SYSTEM = 'You translate a question about a database into a query plan. Pick table and field names only from the schema given.';
export async function planQuery(DC, state, q, model = DEFAULT_MODEL, base = OLLAMA) {
  const user = DC.schemaPrompt(state, q) + '\n\nQuestion: ' + q;
  const r = await chat(base, model, [{ role: 'system', content: PLAN_SYSTEM }, { role: 'user', content: user }], { format: PLAN_SCHEMA, maxTokens: 220 });
  const plan = DC.parsePlanJSON(r.text); if (!plan) return null;
  if (plan.agg && plan.agg.fn && !plan.agg.agg) plan.agg.agg = plan.agg.fn;
  if (plan.type) plan.type = DC.matchType(state, ' ' + plan.type + ' ') || (DC.knownTypes(state).includes(plan.type) ? plan.type : null);
  return plan;
}
export function reopen(IX, ref) { return readRange(IX.texts, ref); }

// ---------- The notebook, folded in ----------
// A turn run in the Notebook is kept two ways at once, from the same conversation object: as a REAL .ipynb
// (nbformat 4.5 — each turn is a code cell whose output is the answer, with the whole fold record in the cell
// metadata) and as a plain log, which Holodeck adds to the workspace as a source, so the notebook's own
// activity can be read and asked about like any other document. Nothing here re-asks a model or invents an
// address: it only re-presents what turn() already computed.
const oneLine = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const nbLines = s => { const a = String(s == null ? '' : s).split('\n'); return a.map((x, i) => i < a.length - 1 ? x + '\n' : x); };
const nbOrd = (n, a, b) => n + ' ' + (n === 1 ? a : (b || a + 's'));

function foldMarkdown(t) {
  const rec = t.record || {};
  const bits = [nbOrd((rec.refs || []).length, 'address', 'addresses') + ' checked', (rec.unsupported || []).length ? (rec.unsupported || []).length + ' not in the material' : 'nothing unsupported', ...(rec.open || [])];
  const out = [String(t.answer || '').trim()];
  const srcs = (t.used || []).filter(u => u && u.ref);
  if (srcs.length) out.push('', '**Addressed sources**', ...srcs.map(u => '- `' + u.ref + '` — ' + oneLine(u.text).slice(0, 280)));
  out.push('', '---', '*On record · turn ' + t.n + ' · ' + bits.join(' · ') + '*');
  if (t.foldLine) out.push('', '*Folded to: ' + t.foldLine + '*');
  out.push('', '*Sent ' + (t.sentChars || 0).toLocaleString() + ' characters in place of a ' + (t.transcriptChars || 0).toLocaleString() + '-character transcript · ' + (t.model || '') + '*');
  return out.join('\n');
}

// The log, as plain text Holodeck can chunk and address like any other source. Blank lines are the chunk
// boundaries the Fold's own chunker uses, so each cell's question and answer land as their own statements.
export function notebookLog(conv, meta = {}) {
  const turns = (conv && conv.turns) || [];
  const title = meta.title || 'Notebook';
  const L = [];
  L.push(title + ' — the log of the notebook');
  L.push('This is the record of a notebook run inside The Fold: each cell is a question put to the workspace, its output is the answer, and every sentence of every answer was checked afterwards against the workspace\'s own passages. Passages are named by their own address.');
  if (meta.generated) L.push('Last run ' + meta.generated + '.');
  turns.forEach(t => {
    L.push('');
    L.push('In [' + t.n + '] ' + oneLine(t.question));
    L.push('');
    if (String(t.answer || '').trim()) L.push(String(t.answer).trim());
    const refs = (t.used || []).filter(u => u && u.ref).map(u => u.ref);
    if (refs.length) { L.push(''); L.push('Addresses checked: ' + refs.join(', ')); }
    const rec = t.record || {};
    L.push('');
    L.push('On record · turn ' + t.n + ' · ' + (rec.refs || refs).length + ' addresses checked · ' + ((rec.unsupported || []).length ? (rec.unsupported || []).length + ' not in the material' : 'nothing unsupported'));
    if (t.foldLine) L.push('Folded to: ' + t.foldLine);
    if (t.model) L.push('Answered by ' + t.model + '.');
  });
  return L.join('\n');
}

// Each turn as a Jupyter cell: the question is the source, the answer rides below it as the cell's output,
// and metadata.the_fold carries the record, the addresses and what the reader contributed.
export function notebookCells(conv) {
  return ((conv && conv.turns) || []).map(t => {
    const refs = (t.used || []).filter(u => u && u.ref).map(u => ({ ref: u.ref, text: oneLine(u.text).slice(0, 400) }));
    const offered = (t.offered || []).map(c => ({ ref: c.ref, source: c.source, start: c.start, end: c.end }));
    const findings = (t.findings || []).map(f => ({ text: f.text, kind: f.kind, echoesQuestion: !!f.echoesQuestion }));
    const rec = t.record || {};
    return {
      cell_type: 'code',
      execution_count: Number(t.n) || null,
      metadata: { the_fold: {
        kind: 'ask', turn: t.n, question: t.question,
        channels: rec.channels || [], refs: rec.refs || refs.map(r => r.ref),
        unsupported: rec.unsupported || [], open: rec.open || [],
        fold: t.foldLine || '', addresses: refs, offered, findings,
        notes: t.notes || null, reading: t.reading ? t.reading.lines : null,
        computed: t.computed ? { head: t.computed.head, lines: t.computed.lines, said: t.computed.said } : null,
        resolved: t.resolved || null,
        sentChars: t.sentChars || 0, transcriptChars: t.transcriptChars || 0, model: t.model || ''
      } },
      source: nbLines(t.question),
      outputs: [{ output_type: 'display_data', data: { 'text/markdown': nbLines(foldMarkdown(t)) }, metadata: {} }]
    };
  });
}

export function toIpynb(conv, meta = {}) {
  const cells = [];
  const head = ['# ' + (meta.title || 'Notebook'), '', 'A notebook run inside The Fold. Every cell is a question put to the workspace; its output is the answer, and below the answer is the address of every passage it was checked against. The cell metadata carries the full fold record. This is not Python in a Python kernel — it is the notebook\'s own log, made openable.'];
  if (meta.generated) head.push('', 'Run ' + meta.generated + '.');
  cells.push({ cell_type: 'markdown', metadata: {}, source: nbLines(head.join('\n')) });
  const body = notebookCells(conv); cells.push(...body);
  return {
    cells,
    metadata: {
      kernelspec: { display_name: 'The Fold', language: 'the-fold', name: 'the-fold' },
      language_info: { name: 'the-fold', mimetype: 'text/markdown', file_extension: '.fold.md' },
      the_fold: { tool: 'holodeck', workspace: meta.workspace || null, generated: meta.generated || null, turns: body.length, version: 1 }
    },
    nbformat: 4, nbformat_minor: 5
  };
}
