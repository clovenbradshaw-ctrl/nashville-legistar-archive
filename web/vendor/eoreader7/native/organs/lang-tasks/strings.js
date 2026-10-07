// 4 new STRING tasks: 1 easy, 2 medium, 1 hard (two-step idea).
export const NEW_TASKS = [
  {
    id: "count_vowels", snake: "count_vowels",
    spec: "Write a function count_vowels that takes a string and returns how many of its characters are vowels, where the vowels are the letters a, e, i, o and u in either lower or upper case (y is not a vowel). An empty string gives 0.",
    cases: [{ args: ["banana"], expect: 3 }, { args: ["sky"], expect: 0 }, { args: ["AEIOU"], expect: 5 }, { args: [""], expect: 0 }, { args: ["Queueing Gym"], expect: 5 }],
    ref: {
      javascript: "const __F__ = (s) => [...s].filter((c) => 'aeiouAEIOU'.includes(c)).length;",
      typescript: "const __F__ = (s: string): number => [...s].filter((c: string) => 'aeiouAEIOU'.includes(c)).length;",
      python: "def __F__(s):\n    return sum(1 for c in s if c in 'aeiouAEIOU')",
      ruby: "def __F__(s)\n  s.count('aeiouAEIOU')\nend",
    },
  },
  {
    id: "caesar_shift", snake: "caesar_shift",
    spec: "Write a function caesar_shift that takes a string s and an integer k between 0 and 25 and returns s with every lowercase letter a-z moved forward k places in the alphabet, wrapping from z back to a. Uppercase letters, digits, spaces and all other characters are left unchanged, and an empty string gives an empty string.",
    cases: [{ args: ["abc", 1], expect: "bcd" }, { args: ["xyz", 3], expect: "abc" }, { args: ["Hello, World!", 5], expect: "Hjqqt, Wtwqi!" }, { args: ["", 7], expect: "" }, { args: ["abc", 0], expect: "abc" }, { args: ["az", 25], expect: "zy" }, { args: ["a b1", 2], expect: "c d1" }],
    ref: {
      javascript: "const __F__ = (s, k) => s.replace(/[a-z]/g, (c) => String.fromCharCode((c.charCodeAt(0) - 97 + k) % 26 + 97));",
      typescript: "const __F__ = (s: string, k: number): string => s.replace(/[a-z]/g, (c: string) => String.fromCharCode((c.charCodeAt(0) - 97 + k) % 26 + 97));",
      python: "def __F__(s, k):\n    return ''.join(chr((ord(c) - 97 + k) % 26 + 97) if 'a' <= c <= 'z' else c for c in s)",
      ruby: "def __F__(s, k)\n  s.gsub(/[a-z]/) { |c| ((c.ord - 97 + k) % 26 + 97).chr }\nend",
    },
  },
  {
    id: "compress_runs", snake: "compress_runs",
    spec: "Write a function compress_runs that takes a string and replaces each maximal run of identical consecutive characters with that character followed by the length of the run written as a decimal number, so a single character gets 1. Runs are only of adjacent characters, so the same character appearing again later starts a new run, and an empty string gives an empty string.",
    cases: [{ args: ["aaabcc"], expect: "a3b1c2" }, { args: ["zz"], expect: "z2" }, { args: [""], expect: "" }, { args: ["a"], expect: "a1" }, { args: ["abc"], expect: "a1b1c1" }, { args: ["aabbaa"], expect: "a2b2a2" }, { args: ["xxxxxxxxxxxx"], expect: "x12" }],
    ref: {
      javascript: "const __F__ = (s) => (s.match(/(.)\\1*/gs) || []).map((g) => g[0] + g.length).join('');",
      typescript: "const __F__ = (s: string): string => (s.match(/(.)\\1*/gs) || []).map((g: string) => g[0] + g.length).join('');",
      python: "def __F__(s):\n    out = []\n    i = 0\n    while i < len(s):\n        j = i\n        while j < len(s) and s[j] == s[i]:\n            j += 1\n        out.append(s[i] + str(j - i))\n        i = j\n    return ''.join(out)",
      ruby: "def __F__(s)\n  s.chars.chunk_while { |a, b| a == b }.map { |g| g[0] + g.length.to_s }.join\nend",
    },
  },
  {
    id: "shortest_palindrome", snake: "shortest_palindrome",
    spec: "Write a function shortest_palindrome that takes a string s and returns the shortest palindrome that can be made by adding characters only at the front of s (s itself stays as the ending of the result). If s is already a palindrome it is returned unchanged, and an empty string gives an empty string.",
    cases: [{ args: ["abcd"], expect: "dcbabcd" }, { args: ["aacecaaa"], expect: "aaacecaaa" }, { args: [""], expect: "" }, { args: ["racecar"], expect: "racecar" }, { args: ["ab"], expect: "bab" }, { args: ["aab"], expect: "baab" }, { args: ["a"], expect: "a" }],
    ref: {
      javascript: "const __F__ = (s) => {\n  for (let k = s.length; k >= 0; k--) {\n    const p = s.slice(0, k);\n    if (p === [...p].reverse().join('')) return [...s.slice(k)].reverse().join('') + s;\n  }\n  return s;\n};",
      typescript: "const __F__ = (s: string): string => {\n  for (let k = s.length; k >= 0; k--) {\n    const p: string = s.slice(0, k);\n    if (p === [...p].reverse().join('')) return [...s.slice(k)].reverse().join('') + s;\n  }\n  return s;\n};",
      python: "def __F__(s):\n    for k in range(len(s), -1, -1):\n        p = s[:k]\n        if p == p[::-1]:\n            return s[k:][::-1] + s\n    return s",
      ruby: "def __F__(s)\n  s.length.downto(0) do |k|\n    p = s[0, k]\n    return s[k..].reverse + s if p == p.reverse\n  end\n  s\nend",
    },
  },
  {
    // Added after the fact: solved via bok in a session but, until now, backed only by a ledger
    // row with no durable definition. References checked against a brute-force implementation.
    id: "longest_unique_substring", snake: "longest_unique_substring",
    spec: "Write a function longest_unique_substring that takes a string s and returns the length of the longest stretch of consecutive characters in s in which no character appears more than once. Upper and lower case letters count as different characters, and an empty string gives 0.",
    cases: [{ args: ["abcabcbb"], expect: 3 }, { args: ["bbbbb"], expect: 1 }, { args: [""], expect: 0 }, { args: ["pwwkew"], expect: 3 }, { args: ["abcdef"], expect: 6 }, { args: ["abba"], expect: 2 }, { args: ["aA"], expect: 2 }, { args: ["dvdf"], expect: 3 }, { args: ["tmmzuxt"], expect: 5 }],
    ref: {
      javascript: "const __F__ = (s) => {\n  const last = new Map();\n  let best = 0, start = 0;\n  for (let i = 0; i < s.length; i++) {\n    if (last.has(s[i]) && last.get(s[i]) >= start) start = last.get(s[i]) + 1;\n    last.set(s[i], i);\n    best = Math.max(best, i - start + 1);\n  }\n  return best;\n};",
      typescript: "const __F__ = (s: string): number => {\n  const last = new Map<string, number>();\n  let best: number = 0, start: number = 0;\n  for (let i = 0; i < s.length; i++) {\n    const p = last.get(s[i]);\n    if (p !== undefined && p >= start) start = p + 1;\n    last.set(s[i], i);\n    best = Math.max(best, i - start + 1);\n  }\n  return best;\n};",
      python: "def __F__(s):\n    last = {}\n    best = 0\n    start = 0\n    for i, c in enumerate(s):\n        if c in last and last[c] >= start:\n            start = last[c] + 1\n        last[c] = i\n        best = max(best, i - start + 1)\n    return best",
      ruby: "def __F__(s)\n  last = {}\n  best = 0\n  start = 0\n  s.each_char.with_index do |c, i|\n    start = last[c] + 1 if last.key?(c) && last[c] >= start\n    last[c] = i\n    best = [best, i - start + 1].max\n  end\n  best\nend",
    },
  },
];
