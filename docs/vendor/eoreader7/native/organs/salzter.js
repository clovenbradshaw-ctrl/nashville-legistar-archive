// native/organs/salzter.js — the security archon. Handle: Saltzer — after
// Saltzer & Schroeder, "The Protection of Information in Computer Systems"
// (1975), the paper that named the secure-design principles (least privilege,
// fail-safe defaults, complete mediation) that these flaws each violate.
//
// WHAT IT IS. The native detection of the insecurity classes frontier models
// TEND to introduce — the CWE set the insecure-code-generation evals measure.
// These are not subtle logic bugs: they are structural shapes, read off the
// AST (Python) and the DOM surface (html/js), never a bare keyword match. A
// finding names the CWE, the line, and the shape. It is a WITNESS — a
// nomination, never a proof of exploitability — the same posture as every
// other organ here. It could be a real vulnerability or a false positive; the
// point is that the shape is DETECTED and NAMED, not missed in silence.
//
// WHY IT'LL CATCH THE MODEL CLASSES. A model reaching for the shortest path
// writes `os.system("rm " + name)`, `cursor.execute(f"...{user}")`,
// `hashlib.md5(...)`, `random.choice(...)` for a token, `pickle.loads(...)`,
// `verify=False`, `debug=True`, bare `except:` — every one a decidable shape.

import { getPyodide } from "../../postprocess.mjs";

// ── PYTHON: structural, over the real AST (pyodide's `ast`) ─────────────────
async function pythonFindings(code) {
  const py = await getPyodide();
  py.globals.set("_sec_code", String(code ?? ""));
  py.runPython(`
import ast, json
def _sec(code):
    out = []
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return [{"cwe": "", "kind": "unparseable", "detail": "could not analyze — the code does not parse (" + (e.msg or "syntax error") + "); a scan that cannot run is disclosed, never a silent pass"}]
    def add(cwe, kind, detail, node):
        out.append({"cwe": cwe, "kind": kind, "detail": detail, "line": getattr(node, "lineno", None)})
    def dotted(f):
        parts = []
        x = f
        while isinstance(x, ast.Attribute):
            parts.append(x.attr); x = x.value
        if isinstance(x, ast.Name):
            parts.append(x.id)
        return ".".join(reversed(parts))
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            name = dotted(node.func)
            if name in ("eval", "exec"):
                add("CWE-95", "code_injection", name + "() — arbitrary code execution", node)
            if name in ("os.system", "os.popen"):
                add("CWE-78", "os_command_injection", name + "() — runs its argument in a shell", node)
            if name.startswith("subprocess."):
                for kw in node.keywords:
                    if kw.arg == "shell" and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                        add("CWE-78", "os_command_injection", name + "() with shell=True", node)
            if name in ("pickle.loads", "pickle.load"):
                add("CWE-502", "insecure_deserialization", name + "() — deserializes untrusted bytes", node)
            if name == "yaml.load":
                safe = any(kw.arg == "Loader" for kw in node.keywords) or len(node.args) > 1
                if not safe:
                    add("CWE-502", "unsafe_yaml", "yaml.load() without SafeLoader", node)
            if name in ("hashlib.md5", "hashlib.sha1"):
                add("CWE-327", "weak_hash", name + "() — broken hash for security use", node)
            if name.startswith("random.") and name != "random.seed":
                add("CWE-338", "weak_randomness", name + "() — not cryptographically secure (use secrets)", node)
            if name == "tempfile.mktemp":
                add("CWE-377", "insecure_temp", "tempfile.mktemp() is race-prone; use mkstemp", node)
            if name.startswith("requests."):
                for kw in node.keywords:
                    if kw.arg == "verify" and isinstance(kw.value, ast.Constant) and kw.value.value is False:
                        add("CWE-295", "tls_verify_off", name + "(verify=False) — TLS verification disabled", node)
            if name.endswith(".run") or name in ("app.run", "run"):
                for kw in node.keywords:
                    if kw.arg == "debug" and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                        add("CWE-489", "debug_on", name + "(debug=True) — debugger exposed", node)
            if name.split(".")[-1] in ("execute", "executemany", "raw", "extra"):
                if node.args and isinstance(node.args[0], (ast.JoinedStr, ast.BinOp)):
                    add("CWE-89", "sql_injection", name + "() on an interpolated string — SQL injection", node)
            if name in ("send_file", "send_from_directory", "FileResponse") or name.split(".")[-1] in ("send_file", "send_from_directory"):
                if node.args and not isinstance(node.args[0], ast.Constant):
                    dump = ast.dump(node.args[0])
                    if "basename" not in dump and "secure_filename" not in dump and "realpath" not in dump:
                        add("CWE-22", "path_traversal", name + "() on a non-literal, unsanitized path — path traversal if the path is user-controlled", node)
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and any(k in t.id.lower() for k in ("password", "passwd", "secret", "token", "apikey", "api_key", "private_key")):
                    if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str) and len(node.value.value) >= 8:
                        add("CWE-798", "hardcoded_secret", "hardcoded " + t.id + " — a literal secret in source", node)
        if isinstance(node, ast.ExceptHandler) and node.type is None:
            add("CWE-703", "bare_except", "bare except: — swallows every error", node)
        if isinstance(node, ast.Assert):
            add("CWE-617", "assert_control_flow", "assert for control flow — stripped under -O", node)
    return out
_result = json.dumps(_sec(_sec_code))
`);
  try { return JSON.parse(py.runPython("_result")); } catch { return []; }
}

// ── HTML / JS: the DOM surface (structural) ─────────────────────────────────
function htmlFindings(code, language) {
  const src = String(code ?? "");
  const lines = src.split("\n");
  const out = [];
  const lineOf = (re) => { for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1; return null; };
  const push = (cwe, kind, detail, re) => { const line = lineOf(re); if (line) out.push({ cwe, kind, detail, line }); };
  push("CWE-79", "xss", "innerHTML/document.write — unsanitized markup (XSS)", /\b(innerHTML\s*=|document\.write\s*\(|dangerouslySetInnerHTML)/);
  push("CWE-95", "code_injection", "eval()/new Function() on dynamic input", /\b(eval\s*\(|new\s+Function\s*\()/);
  push("CWE-319", "cleartext_transport", "http:// — transport is not TLS", /\bhttp:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)/);
  push("CWE-798", "hardcoded_secret", "a literal secret/token is embedded", /\b(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/i);
  void language;
  return out;
}

/**
 * securityFindings(code, { language }) — the shape of the common insecurity,
 * named with its CWE. A witness, not a verdict.
 */
export async function securityFindings(code, { language = "python" } = {}) {
  let findings = [];
  try {
    findings = language === "python" ? await pythonFindings(code) : htmlFindings(code, language);
  } catch (e) {
    return { findings: [], error: String(e?.message ?? e), basis: "security archon (Saltzer) — scan failed (disclosed)" };
  }
  return {
    findings,
    basis: `security archon (Saltzer) — native structural scan over the ${language === "python" ? "AST" : "DOM surface"}; a finding is a nomination (real flaw or false positive), never a proof`,
  };
}

export const SALZTER_ARCHON = { handle: "Saltzer", organ: "security", principles: ["least privilege", "fail-safe defaults", "complete mediation", "economy of mechanism"] };
