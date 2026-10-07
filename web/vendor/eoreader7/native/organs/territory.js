// Lexical location over real documents. Scores locate bytes, never assert meaning.
export const termsOf = (text) => [...new Set(String(text ?? "").toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [])];

export function indexDocuments(documents) {
  const postings = new Map();
  documents.forEach((doc, n) => {
    for (const word of termsOf(doc.text)) {
      if (!postings.has(word)) postings.set(word, new Set());
      postings.get(word).add(n);
    }
  });
  return { n: documents.length, documents, postings };
}

export function ask(index, question, k = 8) {
  const terms = termsOf(question), scores = new Map(), absent = [];
  for (const term of terms) {
    const rows = index.postings.get(term);
    if (!rows) { absent.push(term); continue; }
    for (const n of rows) scores.set(n, (scores.get(n) ?? 0) + Math.log(1 + index.n / rows.size));
  }
  const hits = [...scores].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, k)
    .map(([n, score]) => ({ n, name: index.documents[n].name, score }));
  return { hits, matched: scores.size, absent, basis: "literal terms in indexed bytes" };
}
