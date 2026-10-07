// NEW_TASKS: four sequence/simple-logic tasks in the lang-competency TASKS shape.
export const NEW_TASKS = [
  {
    id: "longest_run", snake: "longest_run",
    spec: "Write a function longest_run that takes a list of integers and returns the length of the longest stretch of consecutive items that are all equal to each other. A list with no repeated neighbours gives 1, and an empty list gives 0.",
    cases: [
      { args: [[1, 2, 2, 2, 3, 3]], expect: 3 }, { args: [[4, 5, 6]], expect: 1 },
      { args: [[]], expect: 0 }, { args: [[9]], expect: 1 },
      { args: [[7, 7, 7, 7]], expect: 4 }, { args: [[-1, -1, 2, -1, -1, -1]], expect: 3 },
      { args: [[1, 1, 2, 1, 1]], expect: 2 },
    ],
    ref: {
      javascript: "const __F__ = (xs) => { let best = 0, cur = 0; for (let i = 0; i < xs.length; i++) { cur = i > 0 && xs[i] === xs[i - 1] ? cur + 1 : 1; if (cur > best) best = cur; } return best; };",
      typescript: "const __F__ = (xs: number[]): number => { let best: number = 0, cur: number = 0; for (let i = 0; i < xs.length; i++) { cur = i > 0 && xs[i] === xs[i - 1] ? cur + 1 : 1; if (cur > best) best = cur; } return best; };",
      python: "def __F__(xs):\n    best = 0\n    cur = 0\n    for i, x in enumerate(xs):\n        cur = cur + 1 if i > 0 and x == xs[i - 1] else 1\n        best = max(best, cur)\n    return best",
      ruby: "def __F__(xs)\n  best = 0\n  cur = 0\n  xs.each_with_index do |x, i|\n    cur = i > 0 && x == xs[i - 1] ? cur + 1 : 1\n    best = cur if cur > best\n  end\n  best\nend",
    },
  },
  {
    id: "count_pairs", snake: "count_pairs",
    spec: "Write a function count_pairs that takes a list of integers and an integer target and returns how many pairs of items, taken from two different positions in the list, add up to target. Each pair of positions is counted once, so equal values at different positions form separate pairs, while an item is never paired with itself. A list with fewer than two items gives 0.",
    cases: [
      { args: [[1, 2, 3, 4], 5], expect: 2 }, { args: [[2, 2, 5], 7], expect: 2 },
      { args: [[], 4], expect: 0 }, { args: [[5], 10], expect: 0 },
      { args: [[3, 3, 3], 6], expect: 3 }, { args: [[-2, 2, 0, 0], 0], expect: 2 },
      { args: [[1, 3, 3, 1], 4], expect: 4 }, { args: [[-1, -2, 3], 1], expect: 1 },
    ],
    ref: {
      javascript: "const __F__ = (xs, target) => { let n = 0; for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (xs[i] + xs[j] === target) n++; return n; };",
      typescript: "const __F__ = (xs: number[], target: number): number => { let n: number = 0; for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) if (xs[i] + xs[j] === target) n++; return n; };",
      python: "def __F__(xs, target):\n    n = 0\n    for i in range(len(xs)):\n        for j in range(i + 1, len(xs)):\n            if xs[i] + xs[j] == target:\n                n += 1\n    return n",
      ruby: "def __F__(xs, target)\n  xs.combination(2).count { |a, b| a + b == target }\nend",
    },
  },
  {
    id: "second_largest", snake: "second_largest",
    spec: "Write a function second_largest that takes a list of integers and returns the second largest distinct value in it, so a value that appears several times counts once. If the list has fewer than two distinct values, including when it is empty, it returns -1.",
    cases: [
      { args: [[3, 9, 5]], expect: 5 }, { args: [[4, 4, 1]], expect: 1 },
      { args: [[]], expect: -1 }, { args: [[8]], expect: -1 },
      { args: [[6, 6, 6]], expect: -1 }, { args: [[-5, -2, -9]], expect: -5 },
      { args: [[9, 9, 7, 7, 2]], expect: 7 }, { args: [[0, -3]], expect: -3 },
    ],
    ref: {
      javascript: "const __F__ = (xs) => { const u = [...new Set(xs)].sort((a, b) => b - a); return u.length < 2 ? -1 : u[1]; };",
      typescript: "const __F__ = (xs: number[]): number => { const u: number[] = [...new Set(xs)].sort((a: number, b: number) => b - a); return u.length < 2 ? -1 : u[1]; };",
      python: "def __F__(xs):\n    u = sorted(set(xs), reverse=True)\n    return u[1] if len(u) >= 2 else -1",
      ruby: "def __F__(xs)\n  u = xs.uniq.sort.reverse\n  u.length < 2 ? -1 : u[1]\nend",
    },
  },
  {
    id: "rotate_left", snake: "rotate_left",
    spec: "Write a function rotate_left that takes a list of integers and an integer k (zero or more) and returns a new list in which every item has moved k places toward the front, with the first k items wrapping around to the end. If k is larger than the length of the list it keeps wrapping around, so k equal to the length gives the list unchanged, and an empty list gives an empty list.",
    cases: [
      { args: [[1, 2, 3, 4, 5], 2], expect: [3, 4, 5, 1, 2] }, { args: [[1, 2, 3], 0], expect: [1, 2, 3] },
      { args: [[], 4], expect: [] }, { args: [[7], 5], expect: [7] },
      { args: [[1, 2, 3], 3], expect: [1, 2, 3] }, { args: [[1, 2, 3], 4], expect: [2, 3, 1] },
      { args: [[-1, 0, 5, 5], 7], expect: [5, -1, 0, 5] },
    ],
    ref: {
      javascript: "const __F__ = (xs, k) => { if (xs.length === 0) return []; const m = k % xs.length; return [...xs.slice(m), ...xs.slice(0, m)]; };",
      typescript: "const __F__ = (xs: number[], k: number): number[] => { if (xs.length === 0) return []; const m: number = k % xs.length; return [...xs.slice(m), ...xs.slice(0, m)]; };",
      python: "def __F__(xs, k):\n    if not xs:\n        return []\n    m = k % len(xs)\n    return xs[m:] + xs[:m]",
      ruby: "def __F__(xs, k)\n  return [] if xs.empty?\n  xs.rotate(k)\nend",
    },
  },
];
