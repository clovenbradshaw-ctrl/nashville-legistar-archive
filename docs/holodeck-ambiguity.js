// holodeck-ambiguity.js — disclose contested readings, don't collapse them.
//
// A meaningful assertion is read by several INDEPENDENT ants, each with its own
// method and its own evidence (a byte span in the source). When the ants agree,
// there is one answer. When they disagree, the ambiguity is not hidden: every
// reading is carried with its evidence, so a person can look at the bytes and
// vote. The vote is the interpretation; the dissent stays on the record.
//
// The contract total value was learned by sending ants across the whole corpus
// (409 Metro contracts, 8,833 currency figures) and clustering the shapes that
// mark the TOTAL — not rent, rates, interest or term limits. The shapes that
// actually carry the total, strongest first:
//
//   "the total value of this contract is $X"      total value / total contract value
//   "this Contract has an estimated value of $X"   estimated (contract) value
//   "the contract price of $X"                     contract price
//   "the original contract amount was $X"          contract amount
//   "Contract Value to increase by $X"             contract value (amendments)
//   "in a total amount not to exceed $X"           not to exceed   (weaker)
//   "$X (one million ...)"                         the figure spelled out after it
//
// and the shapes that DECOY (excluded): rent/rate tables ("$17.50 per month"),
// durations ("not to exceed ninety (90) days"), interest, per-hour rates,
// maximum-card limits. A figure followed by a unit word is not the total.
//
//   amountReadings(text) -> {
//     readings: [{ ant, why, conf, raw, val, s, e }],
//     values, consensus, contested, figures
//   }

const CURRENCY = /\$\s?\d[\d,\s]*(?:\.\d{1,2})?\s*(?:million|billion|thousand|[MBK]\b|MM\b)?/gi;
const UNIT_AFTER = /^\s*(?:%|percent|per\b|\/|a\s+month|a\s+year|an?\s+hour|days?\b|day\b|months?\b|month\b|years?\b|year\b|hours?\b|hour\b|miles?\b|mile\b|interest\b|sq\b|square\b|units?\b|each\b)/i;

const num = raw => {
  const s = String(raw).toLowerCase();
  const n = Number(s.replace(/[^0-9.]/g, '')); if (!isFinite(n)) return NaN;
  if (/million/.test(s) || /m\s*$/.test(s)) return n * 1e6;
  if (/billion/.test(s) || /b\s*$/.test(s)) return n * 1e9;
  if (/thousand/.test(s) || /k\s*$/.test(s)) return n * 1e3;
  return n;
};
// A figure that names a THRESHOLD or a rate, not a value: "$1,000,000 or more",
// "$X each", "$X per ...". The clause that uses it is not the total.
const DECOY_AFTER = /^\s*\)?\s*(?:or\s+(?:more|less|greater|fewer|higher|lower)|each\b|per\b|an?\s+(?:hour|month|year))/i;

function figures(text) {
  const out = []; let m; CURRENCY.lastIndex = 0;
  while ((m = CURRENCY.exec(text))) {
    const raw = m[0].trim(); const val = num(raw);
    if (!isFinite(val) || val <= 0) continue;
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 16);
    const money = !UNIT_AFTER.test(after);
    out.push({ raw, val, s: m.index, e: m.index + m[0].length, money });
  }
  return out;
}

// The learned shapes that mark the total, strongest first. `after` picks the
// figure just after the phrase; `conf` is how strongly the shape marks a total.
const SHAPES = [
  ['total-value', /\btotal\s+(?:contract\s+)?value\b/i, 'high', 'the figure beside “total value / total contract value”'],
  ['total-amount', /\btotal\s+(?:contract\s+)?amount\b/i, 'high', 'the figure beside “total (contract) amount”'],
  ['estimated-value', /\bestimated\s+(?:contract\s+)?value\b/i, 'high', 'the figure beside “estimated (contract) value”'],
  ['contract-price', /\bcontract\s+price\b/i, 'high', 'the figure beside “contract price”'],
  ['contract-amount', /\bcontract\s+amount\b/i, 'high', 'the figure beside “(original) contract amount”'],
  ['contract-value', /\bcontract\s+value\b/i, 'high', 'the figure beside “contract value” (incl. amendments)'],
  ['value-of', /\b(?:value|amount|sum)\s+of\b/i, 'med', 'the figure beside “value / amount / sum of”'],
  ['not-to-exceed', /\bnot\s+to\s+exceed\b/i, 'med', 'the figure beside “not to exceed” (weaker: can be a term limit)'],
];

function nearestAfter(figs, m) {
  let best = null, bd = Infinity;
  for (const f of figs) { const d = f.s - m.index; if (d >= 0 && d < bd) { bd = d; best = f; } }
  if (!best) { // fall back to nearest either side
    let bd2 = Infinity; for (const f of figs) { const d = Math.abs(f.s - m.index); if (d < bd2) { bd2 = d; best = f; } }
  }
  return best && best.s - m.index <= 90 ? best : null;
}

export function amountReadings(text) {
  const t = String(text || '');
  const figs = figures(t);
  const money = figs.filter(f => f.money);
  const readings = [];
  for (const [ant, re, conf, why] of SHAPES) {
    const m = re.exec(t); if (!m) continue;
    const f = nearestAfter(money, m); if (!f) continue;
    readings.push({ ant, why, conf, raw: f.raw, val: f.val, s: f.s, e: f.e });
  }
  const big = money.slice().sort((a, b) => b.val - a.val)[0];
  if (big) readings.push({ ant: 'largest', why: 'the largest money figure in the document', conf: 'low', raw: big.raw, val: big.val, s: big.s, e: big.e });
  if (money[0]) readings.push({ ant: 'first', why: 'the first money figure in the document', conf: 'low', raw: money[0].raw, val: money[0].val, s: money[0].s, e: money[0].e });

  const rank = { high: 0, med: 1, low: 2 };
  const best = readings.filter(r => r.conf === 'high');
  const mid = readings.filter(r => r.conf === 'med');
  const pool = best.length ? best : mid.length ? mid : readings;
  const vals = [...new Set(pool.map(r => r.val))];
  const consensus = vals.length === 1 ? vals[0] : null;

  const byVal = new Map();
  for (const r of readings) { if (!byVal.has(r.val)) byVal.set(r.val, []); byVal.get(r.val).push(r); }
  return { readings, values: [...byVal.keys()].sort((a, b) => b - a), consensus, contested: vals.length > 1, figures: figs.length, confident: best.length ? 'high' : mid.length ? 'med' : 'low' };
}

// A short window of the bytes around an evidence span, for the modal.
export function evidenceWindow(text, s, e, pad = 60) {
  const t = String(text || '');
  const a = Math.max(0, s - pad), b = Math.min(t.length, e + pad);
  return (a > 0 ? '…' : '') + t.slice(a, b).replace(/\s+/g, ' ').trim() + (b < t.length ? '…' : '');
}

export const fmtUSD = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
