// extract.mjs — THE DETERMINISTIC PLAN EXTRACTOR (no model in the loop).
//
// Reads a document's byte-addressable text layer and emits PlanLedgerObservation@1
// rows mechanically: line-segmented with real byte spans (into the extracted
// layer, page-bridged by pagemap.json), keeping lines that carry a goal/action
// verb, a quantity, a named agency, or a known place. Every row keeps its byte
// address; nothing here guesses. A model may later PROPOSE rows, but a proposal
// is never a surfaced row until its span resolves verbatim AND a reviewer flags
// it (kind proposal, reviewed: true) — this organ only ever surfaces what the
// text demonstrably holds.
//
// VOCABULARY IS INJECTABLE (the discovery driver's contract): the agencies,
// places, quantity and goal patterns below are the RECEIVED defaults. A caller
// that hands `vocab` — the limited schema a discovery dialogue produced — gets
// those patterns INSTEAD (never merged, never guessed): same layer in, same
// rows out for the same vocab, exactly the determinism the fold requires.
export const PLAN_LEDGER_SCHEMA = "PlanLedgerObservation@1";

const AGENCIES =
  /\b(?:MTA|RTA|WeGo|NDOT|TDOT|MDHA|Metro Planning|Housing Division|Barnes Fund|TDC|EPA|TVA|MPO|CTA)\b/i;
const PLACES =
  /\b(?:East Bank|North Nashville|South Nashville|Antioch|Madison|Bordeaux|Bellevue|Donelson|Germantown|Gulch|Edgehill|Cayce|Music City|Cumberland River|Mill Creek|Dickerson|Charlotte|Nolensville|Murfreesboro|Gallatin|Jefferson Street)\b/i;
const QUANTITY =
  /\$[\d,]+|\b\d[\d,.]*\s*(?:%|percent|units|households|dwelling|miles|acres|MW|gallons|degrees|trips|vehicles|parking spaces|jobs|employees|families|families served)\b/i;
const GOAL =
  /^\s*(?:Goal|Objective|Policy|Action|Strategy|Recommendation|Target|Priority|Key Action|Adopt|Establish|Create|Expand|Invest|Develop|Fund|Build|Complete|Implement|Preserve|Protect|Reduce|Increase|Achieve|Coordinate|Design|Plan for)\b/i;
// short all-title/heading lines without sentence punctuation become section context
const HEADING =
  /^\s*(?:[0-9]{1,2}(?:\.[0-9]+)*[.)]?\s+)?[A-Z][A-Za-z&',-]*(?:\s+[A-Z][A-Za-z&',-]*){1,5}:\s*$/;

const collapse = (s) => String(s).replace(/\s+/g, " ").trim();

// The canonical spelling of a captured match: the vocab's entry that the
// match came from, never the raw text case. "WEGO" in the layer resolves to
// the vocab's "WeGo", so a being is ONE being regardless of the prose's
// casing ("EAST BANK" and "East Bank" are the same profile, not two).
// Without a vocab the match stands as captured (the received patterns'
// own spellings are their canon).
const canonicalOf = (vocab, match) => {
  if (!vocab?.length || !match) return match;
  const lower = String(match).toLowerCase();
  return vocab.find((v) => String(v).toLowerCase() === lower) ?? match;
};

const orOf = (words) =>
  new RegExp(`\\b(?:${(words ?? []).map((w) => String(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");

/**
 * extractPlanRows({ text, doc, mode, vocab }) -> rows[]
 * `text` is the byte-addressable layer (the .txt), `doc` the doc id.
 * `vocab` (optional) is the discovered schema: { agencies: [], places: [],
 * quantities: [], goals: [] } — when present, its entries REPLACE the
 * received patterns above (the discovery dialogue's limited schema wins
 * over the generic defaults; never merged, never guessed).
 * Byte spans are measured on `text` itself; the caller bridges them to PDF
 * pages via the pagemap. Deterministic: same layer + same vocab in, same
 * rows out.
 */
export function extractPlanRows({ text, doc, mode = "layout", vocab = null } = {}) {
  const agencies = vocab?.agencies?.length ? orOf(vocab.agencies) : AGENCIES;
  const places = vocab?.places?.length ? orOf(vocab.places) : PLACES;
  const quantity = vocab?.quantities?.length ? orOf(vocab.quantities) : QUANTITY;
  const goal = vocab?.goals?.length
    ? new RegExp(`^\\s*(?:${(vocab.goals ?? []).map((w) => String(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i")
    : GOAL;
  const lines = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const nl = text.indexOf("\n", i);
    const segEnd = nl === -1 ? n : nl;
    let seg = text.slice(i, segEnd);
    let start = i;
    const lead = (seg.match(/^\f+/) ?? [""])[0].length; // page marker, not content
    start += lead;
    seg = seg.slice(lead);
    const trailing = seg.length - seg.trimEnd().length;
    const end = segEnd - trailing;
    const body = seg.slice(0, seg.length - trailing).trim();
    if (body) lines.push({ start, end, body });
    i = segEnd + 1;
  }

  const rows = [];
  let section = null;
  let seq = 0;
  for (const line of lines) {
    const c = collapse(line.body);
    const heading = c.length <= 80 && /^[A-Z0-9]/.test(c) && !/\.$/.test(c) && HEADING.test(c);
    if (heading) { section = c.replace(/:$/, "").slice(0, 80); continue; }
    const hasGo = goal.test(c);
    const hasQ = quantity.test(c);
    const hasA = agencies.test(c);
    const hasP = places.test(c);
    if (!(hasGo || hasQ || hasA || hasP)) continue;
    if (c.length < 20) continue;
    const fields = {};
    if (section) fields.section = section;
    const ag = c.match(agencies);
    if (ag) fields.agency = canonicalOf(vocab?.agencies, ag[0]);
    const pl = c.match(places);
    if (pl) fields.place = canonicalOf(vocab?.places, pl[0]);
    const am = c.match(quantity);
    if (am) fields.amount = am[0];
    const yr = c.match(/\b(20\d\d|19\d\d)\b/);
    if (yr) fields.year = yr[1];
    const kind = hasGo ? "goal" : hasQ ? "number" : hasA ? "name" : "place";
    rows.push({
      schema: PLAN_LEDGER_SCHEMA,
      id: `plans:nashville:${doc}:row:${String(++seq).padStart(4, "0")}`,
      doc: `nashville/ground/${doc}.txt`,
      at: [line.start, line.end],
      verbatim: c,
      kind,
      fields,
      basis: `deterministic extractor: ${mode} (goal/number/agency/place pattern)`,
      supersedes: null,
      giver: null,
    });
  }
  return rows;
}

/**
 * priority(rows) — deterministic ordering so a caller can cap the ledger to
 * the strongest rows: goals/actions first, then quantities, then named
 * agencies, then places; byte order within a tier.
 */
export function planRowPriority(r) {
  const k = r.kind;
  if (k === "goal") return 0;
  if (k === "number") return 1;
  if (k === "name") return 2;
  return 3;
}