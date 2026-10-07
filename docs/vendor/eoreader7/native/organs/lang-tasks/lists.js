export const NEW_TASKS = [
  {
    id: "sum_above", snake: "sum_above",
    spec: "Write a function sum_above that takes a list of integers and an integer t and returns the sum of the items that are strictly greater than t. An empty list gives 0, and items equal to t are not counted.",
    cases: [{ args: [[1, 5, 10], 4], expect: 15 }, { args: [[], 3], expect: 0 }, { args: [[5, 5], 5], expect: 0 }, { args: [[-3, -1, 2], -2], expect: 1 }, { args: [[7], 0], expect: 7 }],
    ref: {
      javascript: "const __F__ = (xs, t) => xs.filter((x) => x > t).reduce((a, b) => a + b, 0);",
      typescript: "const __F__ = (xs: number[], t: number): number => xs.filter((x) => x > t).reduce((a, b) => a + b, 0);",
      python: "def __F__(xs, t):\n    return sum(x for x in xs if x > t)",
      ruby: "def __F__(xs, t)\n  xs.select { |x| x > t }.sum\nend",
    },
  },
  {
    id: "running_totals", snake: "running_totals",
    spec: "Write a function running_totals that takes a list of integers and returns a list of the same length in which item i is the sum of the first i+1 items of the input. An empty list gives an empty list, and negative numbers are added like any other.",
    cases: [{ args: [[1, 2, 3]], expect: [1, 3, 6] }, { args: [[]], expect: [] }, { args: [[5]], expect: [5] }, { args: [[-1, 1, -1]], expect: [-1, 0, -1] }, { args: [[0, 0, 4]], expect: [0, 0, 4] }],
    ref: {
      javascript: "const __F__ = (xs) => { let s = 0; return xs.map((x) => (s += x)); };",
      typescript: "const __F__ = (xs: number[]): number[] => { let s = 0; return xs.map((x) => (s += x)); };",
      python: "def __F__(xs):\n    out = []\n    s = 0\n    for x in xs:\n        s += x\n        out.append(s)\n    return out",
      ruby: "def __F__(xs)\n  s = 0\n  xs.map { |x| s += x }\nend",
    },
  },
  {
    id: "window_sums", snake: "window_sums",
    spec: "Write a function window_sums that takes a list of integers and an integer k (at least 1) and returns a list with the sum of every run of k consecutive items, in order from the start of the list. If the list has fewer than k items, including when it is empty, it returns an empty list.",
    cases: [{ args: [[1, 2, 3, 4], 2], expect: [3, 5, 7] }, { args: [[], 3], expect: [] }, { args: [[5, 6], 3], expect: [] }, { args: [[4, -4, 9], 3], expect: [9] }, { args: [[2, 7, 1], 1], expect: [2, 7, 1] }],
    ref: {
      javascript: "const __F__ = (xs, k) => { const out = []; for (let i = 0; i + k <= xs.length; i++) out.push(xs.slice(i, i + k).reduce((a, b) => a + b, 0)); return out; };",
      typescript: "const __F__ = (xs: number[], k: number): number[] => { const out: number[] = []; for (let i = 0; i + k <= xs.length; i++) out.push(xs.slice(i, i + k).reduce((a, b) => a + b, 0)); return out; };",
      python: "def __F__(xs, k):\n    return [sum(xs[i:i + k]) for i in range(len(xs) - k + 1)]",
      ruby: "def __F__(xs, k)\n  xs.each_cons(k).map(&:sum)\nend",
    },
  },
  {
    id: "prime_factor_sum", snake: "prime_factor_sum",
    spec: "Write a function prime_factor_sum that takes a positive integer n and returns the sum of its distinct prime factors, counting each prime once no matter how many times it divides n. The number 1 has no prime factors, so it gives 0, and a prime number gives itself.",
    cases: [{ args: [12], expect: 5 }, { args: [1], expect: 0 }, { args: [7], expect: 7 }, { args: [30], expect: 10 }, { args: [49], expect: 7 }, { args: [64], expect: 2 }, { args: [97], expect: 97 }],
    ref: {
      javascript: "const __F__ = (n) => { let s = 0; for (let p = 2; p * p <= n; p++) { if (n % p === 0) { s += p; while (n % p === 0) n = n / p; } } return n > 1 ? s + n : s; };",
      typescript: "const __F__ = (n: number): number => { let s = 0; for (let p = 2; p * p <= n; p++) { if (n % p === 0) { s += p; while (n % p === 0) n = n / p; } } return n > 1 ? s + n : s; };",
      python: "def __F__(n):\n    s = 0\n    p = 2\n    while p * p <= n:\n        if n % p == 0:\n            s += p\n            while n % p == 0:\n                n //= p\n        p += 1\n    return s + n if n > 1 else s",
      ruby: "def __F__(n)\n  s = 0\n  p = 2\n  while p * p <= n\n    if n % p == 0\n      s += p\n      n /= p while n % p == 0\n    end\n    p += 1\n  end\n  n > 1 ? s + n : s\nend",
    },
  },
];
