// NEW_TASKS: three structural tasks (rle_encode dropped: same semantics as strings.js compress_runs) in the lang-competency TASKS shape.
export const NEW_TASKS = [
  {
    id: "top_counts", snake: "top_counts",
    spec: "Write a function top_counts that takes a list of lowercase words and an integer n (zero or more) and returns a list of [word, count] pairs, one per distinct word, where count is how many times the word occurs. The pairs are sorted by count from highest to lowest, and words with the same count are ordered alphabetically from a to z. Only the first n pairs are returned; if n is larger than the number of distinct words all of them are returned, and n of 0 or an empty word list gives an empty list.",
    cases: [
      { args: [["b", "a", "b", "c", "b", "a"], 2], expect: [["b", 3], ["a", 2]] },
      { args: [["x", "y", "x"], 5], expect: [["x", 2], ["y", 1]] },
      { args: [[], 3], expect: [] },
      { args: [["pear", "fig", "apple", "fig", "pear", "kiwi"], 3], expect: [["fig", 2], ["pear", 2], ["apple", 1]] },
      { args: [["a", "b"], 0], expect: [] },
      { args: [["d", "c", "b", "a"], 4], expect: [["a", 1], ["b", 1], ["c", 1], ["d", 1]] },
    ],
    ref: {
      javascript: "const __F__ = (words, n) => { const m = new Map(); for (const w of words) m.set(w, (m.get(w) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).slice(0, n); };",
      typescript: "const __F__ = (words: string[], n: number): [string, number][] => { const m = new Map<string, number>(); for (const w of words) m.set(w, (m.get(w) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).slice(0, n); };",
      python: "def __F__(words, n):\n    counts = {}\n    for w in words:\n        counts[w] = counts.get(w, 0) + 1\n    return [[w, c] for w, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))][:n]",
      ruby: "def __F__(words, n)\n  words.group_by { |w| w }.map { |w, g| [w, g.size] }.sort_by { |w, c| [-c, w] }.first(n).map { |w, c| [w, c] }\nend",
    },
  },
  {
    id: "max_depth", snake: "max_depth",
    spec: "Write a function max_depth that takes a string and returns, as a number, the deepest nesting level of its brackets, where the brackets are (), [] and {}. Every other character is ignored, and a string with no brackets has depth 0. If the brackets are not balanced, meaning a closer has no opener, a closer does not match the most recent unclosed opener, or an opener is never closed, it returns -1.",
    cases: [
      { args: ["a(b[c]d)e"], expect: 2 }, { args: ["(]"], expect: -1 },
      { args: [""], expect: 0 }, { args: ["([{}])()"], expect: 3 },
      { args: [")("], expect: -1 }, { args: ["((x)"], expect: -1 },
      { args: ["no brackets here"], expect: 0 }, { args: ["([)]"], expect: -1 },
    ],
    ref: {
      javascript: "const __F__ = (s) => { const pair = { ')': '(', ']': '[', '}': '{' }; const st = []; let best = 0; for (const ch of s) { if (ch === '(' || ch === '[' || ch === '{') { st.push(ch); if (st.length > best) best = st.length; } else if (ch in pair) { if (st.length === 0 || st[st.length - 1] !== pair[ch]) return -1; st.pop(); } } return st.length === 0 ? best : -1; };",
      typescript: "const __F__ = (s: string): number => { const pair: Record<string, string> = { ')': '(', ']': '[', '}': '{' }; const st: string[] = []; let best: number = 0; for (const ch of s) { if (ch === '(' || ch === '[' || ch === '{') { st.push(ch); if (st.length > best) best = st.length; } else if (ch in pair) { if (st.length === 0 || st[st.length - 1] !== pair[ch]) return -1; st.pop(); } } return st.length === 0 ? best : -1; };",
      python: "def __F__(s):\n    pair = {')': '(', ']': '[', '}': '{'}\n    st = []\n    best = 0\n    for ch in s:\n        if ch in '([{':\n            st.append(ch)\n            best = max(best, len(st))\n        elif ch in pair:\n            if not st or st[-1] != pair[ch]:\n                return -1\n            st.pop()\n    return best if not st else -1",
      ruby: "def __F__(s)\n  pair = { ')' => '(', ']' => '[', '}' => '{' }\n  st = []\n  best = 0\n  s.each_char do |ch|\n    if '([{'.include?(ch)\n      st.push(ch)\n      best = st.size if st.size > best\n    elsif pair.key?(ch)\n      return -1 if st.empty? || st.last != pair[ch]\n      st.pop\n    end\n  end\n  st.empty? ? best : -1\nend",
    },
  },
  {
    id: "ragged_column_sums", snake: "ragged_column_sums",
    spec: "Write a function ragged_column_sums that takes a list of rows, where each row is a list of integers and rows may have different lengths, and returns a list of column sums. Column j is the sum of the j-th item (counting from 0) of every row that has one, so shorter rows simply contribute nothing to the later columns. The result has as many entries as the longest row, and an empty list of rows, or rows that are all empty, gives an empty list.",
    cases: [
      { args: [[[1, 2, 3], [4, 5, 6]]], expect: [5, 7, 9] }, { args: [[[1], [2, 3, 4], [5, 6]]], expect: [8, 9, 4] },
      { args: [[]], expect: [] }, { args: [[[], []]], expect: [] },
      { args: [[[], [7, -2]]], expect: [7, -2] }, { args: [[[-1, -1], [1]]], expect: [0, -1] },
    ],
    ref: {
      javascript: "const __F__ = (rows) => { const w = Math.max(0, ...rows.map((r) => r.length)); const out = []; for (let j = 0; j < w; j++) out.push(rows.reduce((a, r) => a + (j < r.length ? r[j] : 0), 0)); return out; };",
      typescript: "const __F__ = (rows: number[][]): number[] => { const w: number = Math.max(0, ...rows.map((r) => r.length)); const out: number[] = []; for (let j = 0; j < w; j++) out.push(rows.reduce((a, r) => a + (j < r.length ? r[j] : 0), 0)); return out; };",
      python: "def __F__(rows):\n    w = max((len(r) for r in rows), default=0)\n    return [sum(r[j] for r in rows if j < len(r)) for j in range(w)]",
      ruby: "def __F__(rows)\n  w = rows.map(&:size).max || 0\n  (0...w).map { |j| rows.sum { |r| r[j] || 0 } }\nend",
    },
  },
];
