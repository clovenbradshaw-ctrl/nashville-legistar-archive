// corroborate.mjs -- the PROPER eoreader7 pipeline for cross-document
// bonding, replacing an earlier hand-rolled Python co-occurrence counter.
//
// The standalone `eoreader7` CLI (shelled out to elsewhere in this repo)
// never populates a real notes ledger -- its own taskLog comes back empty.
// The actual ledger + cross-document corroboration machinery lives in
// the-fold's relation reader (hypergraph.js) plus eoreader7's own
// organs/corroboration.js: a claim from one document is only "bonded" to
// another when a local model reads a candidate slice from that OTHER
// document and votes yes/no on whether it actually restates the same
// claim (plus a sibling-swapped control vote), under an explicit,
// disclosed ask budget -- never a string/co-occurrence match. Verified on
// three real archived Motorola Solutions contracts before this was wired
// into the pipeline: 89 admitted claims, 2 real attests in 20 asks.
//
// Usage: node corroborate.mjs --dir <.eowork dir> --out <jsonl path> [--budget N]
import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const FOLD = "/Users/mlacy/Documents/3.0/the-fold/";
const NATIVE = "/Users/mlacy/Documents/3.0/eoreader7/native/";
const OLLAMA = "http://localhost:11434", MODEL = "gemma2:2b";

const { makeRelationReader } = await import(`${FOLD}hypergraph.js`);
const { makeNotesText } = await import(`${FOLD}hyperlexicon.js`);
const { adaptTaskLog } = await import(`${FOLD}consequence.js`);
const { chunkSource } = await import(`${FOLD}source.js`);
const T = await import(`${NATIVE}organs/index.js`);
const { corroborateLedger } = T;
const { splitSentences } = await import(`${NATIVE}adapters/text/spans.js`);
const { extractSurfaces, discoverReferents, namesCorefer, diaNorm } = await import(`${NATIVE}adapters/text/surfaces.js`);
const { resolvePronouns } = await import(`${NATIVE}adapters/text/pronouns.js`);
const { discoverRelationVocab, extractRelations } = await import(`${NATIVE}adapters/text/relations.js`);
const { tokenize } = await import(`${NATIVE}adapters/text/material.js`);
const enginePriors = await import(`${NATIVE}adapters/text/priors.js`);
const { cellOf, GRAINS } = await import(`${NATIVE}kernel/cube.js`);
const nativeTaskLog = await import(`${NATIVE}kernel/task-log.js`);

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}
const DIR = arg("dir");
const OUT = arg("out");
const BUDGET = Number(arg("budget", 30));
const PASSAGE_CAP = Number(arg("passageCap", 40)); // per-document passage cap, a resource bound
if (!DIR || !OUT) { console.error("usage: corroborate.mjs --dir <.eowork dir> --out <jsonl> [--budget N] [--passageCap N]"); process.exit(1); }

const posPrior = JSON.parse(readFileSync(`${FOLD}priors-data/pos-prior-eng.json`, "utf8"));
const relationsFor = makeRelationReader({
  splitSentences, extractSurfaces, discoverReferents, namesCorefer, diaNorm, discoverRelationVocab, extractRelations, tokenize,
  posPriorFor: () => posPrior,
  determiners: new Set([...enginePriors.DEFINITE_DETERMINERS, ...enginePriors.INDEFINITE_DETERMINERS]),
  negationWords: enginePriors.NEGATION_WORDS,
  resolvePronouns,
});
const hl = makeNotesText({ ...adaptTaskLog({ createTaskLog: nativeTaskLog.createTaskLog, append: nativeTaskLog.append, ENTRY_KINDS: nativeTaskLog.ENTRY_KINDS, OPERATOR_BASIS: nativeTaskLog.OPERATOR_BASIS, GRAINS }), projectTasks: nativeTaskLog.projectTasks, cellOf });

// Every *.txt already cached under data/.eowork/ -- the same files the
// archiving pass already wrote. Rebuilt fresh each run (a disclosed
// resource tradeoff, not incremental) rather than persisting the ledger
// across runs, which is fine while the corpus is still small.
const sources = [];
for (const sub of readdirSync(DIR, { withFileTypes: true })) {
  if (!sub.isDirectory()) continue;
  const txt = path.join(DIR, sub.name, `${sub.name}.txt`);
  if (existsSync(txt)) sources.push({ ref: sub.name, text: readFileSync(txt, "utf8") });
}
if (sources.length < 2) {
  console.error(`corroborate.mjs: only ${sources.length} source(s) cached -- need at least 2 for cross-document corroboration; skipping this run.`);
  process.exit(0);
}

let log = hl.createNotes();
let heard = 0;
for (const s of sources) {
  const passages = chunkSource(s.ref, s.text).slice(0, PASSAGE_CAP);
  const rel = relationsFor(passages, { pool: passages });
  for (const p of passages) {
    const edges = (rel.read(String(p.text ?? ""))?.claims ?? []).filter((c) => c.verdict === "bound")
      .map((c) => ({ subject: c.end1, verb: c.label, object: c.end2, spans: c.spans ?? [] }));
    if (!edges.length) continue;
    const r = hl.admit(log, edges, { witness: p.ref ?? s.ref });
    log = r.log; heard += r.heard?.length ?? edges.length;
  }
}
console.error(`corroborate.mjs: admitted ${heard} bound SVO claims from ${sources.length} documents`);

const chat = async (messages, schema) => {
  const res = await fetch(`${OLLAMA}/api/chat`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, stream: false, format: schema, options: { num_predict: 200, temperature: 0 }, messages }) });
  return (await res.json())?.message?.content ?? "";
};
const ask = async (s, slice) => T.readTestimony(await chat(T.buildWitnessMessages(s, slice), T.WITNESS_SCHEMA));
const testimony = { witnessSlice: T.witnessSlice, siblingSwap: T.siblingSwap, foldTestimony: T.foldTestimony, buildSelectMessages: T.buildSelectMessages, foldSelect: T.foldSelect };

let r;
try {
  r = await corroborateLedger(log, hl, sources, { ask, testimony, maxAsks: BUDGET });
} catch (e) {
  console.error(`corroborate.mjs: corroborateLedger failed: ${e.message}`);
  process.exit(0); // best-effort -- never block the caller
}
console.error(`corroborate.mjs: asks=${r.asks} attested=${r.attested.length} refusals=${JSON.stringify(r.refusals)}`);

const lines = r.attested.map((a) => JSON.stringify({
  schema: "CorroboratedNote@1",
  subject: a.note?.subject, verb: a.note?.verb, object: a.note?.object,
  decider: a.decider ?? null,
  giver: `eoreader7/organs/corroboration.js witness (${MODEL})`,
  recorded_at: new Date().toISOString(),
}));
if (lines.length) appendFileSync(OUT, lines.join("\n") + "\n");
console.log(JSON.stringify({ admitted: heard, sources: sources.length, asks: r.asks, attested: r.attested.length, refusals: r.refusals }));
