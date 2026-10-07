// Optional draws enter Heimdall's gated channel, including embeddings and vision.
// The public :11436 API deliberately refuses raw /api/embed and /api/generate.
// Never bypass the channel by silently falling back to the private daemon.
import { CHANNEL_PORT } from "./model-server.js";
export const MOUTH_URL = (process.env.ER7_MOUTH_URL ?? `http://127.0.0.1:${CHANNEL_PORT}`).replace(/\/+$/, "");
export const MOUTH_IDENTITY = Object.freeze({
  "x-er7-surface": "khora",
  "x-er7-caller": "khora-organs",
});
