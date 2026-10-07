// model-server.js — the ONE address of the local model daemon, and the ONE
// port every server on this box reaches it through (2026-09-21).
//
// The daemon (ollama serve) listens on a PRIVATE loopback port that only
// Heimdall speaks to. Every other process — the fold's servers, the evals,
// the bridge, a stray script — addresses the model at Ollama's conventional
// port, which Heimdall's CHANNEL holds: admission, per-server rotation, one
// window per model, then a forward to the daemon. Nothing on the box needs
// to change to land on the channel; it is where the daemon used to be.
//
// Why one module: four files carried `localhost:11434` as their own default,
// and `localhost` resolves to ::1 on this box while `127.0.0.1` does not —
// two daemons on one port, each half the callers, was the reload storm of
// 2026-09-21. One derivation, imported everywhere, ends that class.

export const MODEL_SERVER_URL = String(process.env.ER7_OLLAMA_URL ?? "http://127.0.0.1:11435").replace(/\/+$/, "");
export const CHANNEL_PORT = Number(process.env.ER7_CHANNEL_PORT ?? 11434);

/** host:port the daemon must bind, derived from its URL — never restated. */
export function modelServerHost() {
  const u = new URL(MODEL_SERVER_URL);
  return `${u.hostname}:${u.port || "11434"}`;
}
export function modelServerPort() {
  return Number(new URL(MODEL_SERVER_URL).port || "11434");
}
