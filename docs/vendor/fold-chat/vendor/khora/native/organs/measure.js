// measure.js — a figure is a placement, or it is refused.
// Handle: Fisher — after Ronald Fisher's permutation test: a figure is a placement against a null built by shuffling, or it is refused. Amendment XVII.
// See also: the reading-competency audit applies exactly this method (a
// scrambled-word-order null + a one-sided Fisher exact test) to reading
// pipelines themselves — github.com/clovenbradshaw-ctrl/reading-training
//
// The fold could already draw a table and a bar chart from a loaded file's own
// bytes (tables.js, artifact.js::chartFrom). What it could not do is say
// whether anything in those bytes is more than the file's own arithmetic — so
// the moment a reader wanted that, the analysis got hand-rolled somewhere else.
// The dfr-causal-analysis repo is what that looks like at scale: four Node
// scripts importing the legacy engine by an absolute path on one laptop, three Python
// scripts hand-rolling their own permutation nulls with `random.shuffle`, and
// two more (coverage_equity.py, instrument_feasibility.py) reporting weighted
// averages and medians with no null in them at all — in a repo whose own
// plain-language writeup says "never report a number."
//
// So this is the door. Everything statistical here is the legacy engine's, imported and
// never copied: `nul/index.js` builds the nothing and places the observation,
// `emergence/binding.js` tests co-arrival per pair. What this module adds is
// the part the engine deliberately leaves to its callers, and the part a person
// most needs taken out of their hands:
//
//   THE GATE. nul says so about its own licensing table in as many words —
//   "NOT enforced inside `ground` ... An organ that wants the guarantee asks
//   for it." This organ asks for it. A statistic paired with a perturbation
//   nobody has established is refused here, by name, with the material each
//   established pair WAS earned on, so the refusal teaches instead of just
//   blocking.
//
// Five things cannot get through this door, and each one is a way a real
// analysis has gone wrong in this project's own history:
//
//   1. a figure with no nothing behind it  → `no_ground`
//      (coverage_equity.py: 157 lines, zero nulls, publishable-looking numbers)
//   2. an unestablished statistic/perturbation pair → `unlicensed_pair`
//      (nul's Amendment I: a licence earned on one statistic carries no ground
//       for another — recorded as prose there, refused as code here)
//   3. a rank phrased finer than the draws can carry → capped, always
//      (the paper's own §6: "several call sites use 12 resamples. A 95th
//       percentile cannot be meaningfully estimated from 12 draws")
//   4. several observations placed against a one-arrival ground → `best_of_n`
//      (nul::extremeGround's measured table: at n=200 a one-arrival ground
//       ranks pure noise at 0.010 and calls a quarter of trials surfeit)
//   5. a number left to a default → `undeclared`, naming which one
//
// And one thing is NOT refused, deliberately: a censored placement. Outside the
// support the magnitude is real and the ground simply cannot supply a place —
// that is a finding about the material, phrased as one, never an error and
// never upgraded into a result.
//
// Pure, organs injected: `nul` and the binding organs arrive as arguments,
// because this module is imported by both the page (which loads them from
// /engine and /nul) and the node tests (which load them by relative path). The
// cast.js pattern, for the same reason cast.js has it.

/**
 * The declaration grammar. Every one of these is a word the reader types, and
 * every number among them is required — P9's "numbers are earned" at the one
 * place a person, rather than a module, is choosing them.
 *
 * `broken` is the plain-language name for what nul calls a perturbation: the
 * handbook's own framing is "break it on purpose", and the UI carries no EO
 * jargon. `as` names the statistic. Both stay nul's registry keys underneath —
 * there is no second vocabulary here to drift out of step with the engine's.
 */
export const SERIES_KEYS = Object.freeze(["series", "across", "as", "broken", "draws", "window", "seed", "trying", "direction"]);
export const PAIRS_KEYS = Object.freeze(["pairs", "at", "draws", "window", "seed"]);

/** The three numbers, in nul's own order of appearance. */
const NUMBERS = Object.freeze(["draws", "window"]);

const KEYED = /(\w+)\s*[:=]\s*("[^"]*"|'[^']*'|\S+)/g;

const unquote = (v) => v.replace(/^["']|["']$/g, "");

/**
 * Read a `/measure` line into a declaration, or say what is missing.
 *
 * Order-free `key:value` pairs, because the reader is declaring a spec rather
 * than following a sentence, and a positional grammar would make the FOURTH
 * number they type silently mean something else. The file is whatever bare
 * token is left over — the same way chartOf finds its source by name (P11).
 *
 * Returns null when the text is not a measure command at all, so the caller's
 * door can fall through to the next one.
 */
export function parseMeasure(text) {
  const raw = String(text ?? "");
  const m = raw.match(/^\/measure\b\s*([\s\S]*)$/);
  if (!m) return null;
  const rest = m[1].trim();
  if (!rest) return { usage: true };

  const keys = new Map();
  let bare = rest;
  for (const hit of rest.matchAll(KEYED)) {
    keys.set(hit[1].toLowerCase(), unquote(hit[2]));
    bare = bare.replace(hit[0], " ");
  }
  const file = bare.trim().split(/\s+/).filter(Boolean)[0] ?? null;

  const kind = keys.has("pairs")
    ? "pairs"
    : keys.has("series") || keys.has("across") || keys.has("as") || keys.has("broken") || keys.has("channel")
      ? "series"
      : null;
  // A bare file name is a PROBE: describe what is measurable in this material
  // and teach the declaration, mechanically. This is the door's own answer to
  // "it should be extremely easy" — the first thing a reader types is the file,
  // and the door replies with the file's own measurable surface plus example
  // lines they can paste back.
  if (!kind && keys.size === 0 && file) return { decl: { kind: "probe", file } };
  if (!kind)
    return {
      refused: {
        type: "no_measurement_named",
        detail: "say either `series:<column>` (place one column against a nothing), `across:all` (every numeric column against one nothing), or `pairs:<column>` (test which of a column's values arrive together). Or just `/measure <file>` to see what is measurable in it.",
      },
    };

  const num = (k) => {
    const v = keys.get(k);
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isInteger(n) ? n : NaN;
  };

  const decl = {
    kind,
    file,
    draws: num("draws"),
    window: num("window"),
    // Seed is the one number with a defensible default, and the default is 0
    // rather than a clock: a run nobody can repeat is not a measurement. It is
    // still recorded on the result, so "seed 0" is a declaration that was made,
    // not a number that went unmentioned.
    seed: keys.has("seed") ? num("seed") : 0,
  };
  if (kind === "series") {
    decl.column = keys.get("series") ?? null;
    // For material that is not a table — a WAV, any binary — the series is a
    // CHANNEL over declared frames rather than a named column. The channel
    // vocabulary is the engine's own (perceiver/audio/reduce.js: rms, flux),
    // and both numbers are the reader's: `frame:` is the grain of hearing,
    // and leaving it to a default would make two measurements of the same
    // file silently incomparable.
    decl.channel = keys.get("channel") ?? null;
    decl.frame = num("frame");
    // `across:` is how a reader asks the best-of-n question through the typed
    // door. It exists because of a gap the real-data eval found and the unit
    // tests could not: `measureAcross` refuses a missing `direction:`, but the
    // only route to it USED to be supplying a direction — so the wall was
    // real, sound, and unreachable by anyone typing at the app. A refusal no
    // declaration can trigger is not a wall, it is a comment.
    decl.across = keys.has("across");
    decl.statistic = keys.get("as") ?? keys.get("trying") ?? null;
    decl.perturbation = keys.get("broken") ?? null;
    // `trying:` is nul's own escape hatch made explicit at this door. nul
    // accepts a FUNCTION as its statistic precisely so a candidate can run
    // through the real pipeline before it earns a name — "checked, not
    // assumed", Amendment I's own demand. A candidate run is allowed here for
    // the same reason, and typed as a trial end to end so its output can never
    // be read as testimony.
    decl.candidate = keys.has("trying") && !keys.has("as");
    decl.direction = keys.get("direction") ?? null;
  } else {
    decl.key = keys.get("pairs") ?? null;
    decl.at = keys.get("at") ?? null;
  }
  return { decl };
}

/**
 * The gate. Returns a refusal, or null when the declaration may proceed.
 *
 * Checked BEFORE any draw is spent, and before the file is even read: a
 * declaration that cannot yield a sayable number should cost nothing to
 * refuse, and the reader should hear which leg is missing rather than watch
 * two hundred draws produce a gap.
 */
export function admit(decl, nul) {
  if (!decl.file)
    return { type: "no_file", detail: "name a loaded file — a measurement is of some material, and this door never invents one." };
  // A probe reads the material's shape and spends no draws — the file is its
  // whole declaration.
  if (decl.kind === "probe") return null;

  // The smallest admissible window is the ORGAN'S OWN, not one floor for both.
  // `nul.ground` refuses a window below 2 (a windowed statistic over a single
  // value is the value), while `displacementNull` refuses one below 1 — for
  // co-arrival, window 1 is the legitimate "arrived at the same or an adjacent
  // position". Carrying nul's floor across to pairs refused a real declaration,
  // which is what the router test caught: neither number is chosen here, each
  // is the guard the organ states for itself.
  const minWindow = decl.kind === "pairs" ? 1 : 2;

  for (const k of NUMBERS) {
    if (decl[k] === undefined)
      return {
        type: "undeclared",
        what: k,
        detail:
          k === "draws"
            ? "`draws:<n>` — the resolution of the testimony. The finest thing sayable afterwards is 1 in draws, so this is never a default."
            : "`window:<n>` — the reach of the present. Derived from the material's own length it would mean two different things before and after more material arrives, which makes the two measurements silently incomparable.",
      };
    const floor = k === "window" ? minWindow : 2;
    if (!Number.isInteger(decl[k]) || decl[k] < floor)
      return { type: "undeclared", what: k, detail: `\`${k}\` must be a whole number of at least ${floor}; got ${JSON.stringify(String(decl[k]))}.` };
  }
  if (!Number.isInteger(decl.seed))
    return { type: "undeclared", what: "seed", detail: "`seed:<n>` must be a whole number — a run nobody can repeat is not a measurement." };

  if (decl.kind === "pairs") {
    if (!decl.key) return { type: "undeclared", what: "pairs", detail: "`pairs:<column>` — which column's values are the things that might arrive together." };
    if (!decl.at)
      return {
        type: "undeclared",
        what: "at",
        detail: "`at:<column>` — the column that orders the arrivals. Co-arrival is a fact about position, so the door will not guess which column carries it.",
      };
    return null;
  }

  // Three ways to name the series, one required: a column (tables), every
  // column (across), or a channel over frames (binary material).
  if (!decl.column && !decl.across && !decl.channel)
    return {
      type: "undeclared",
      what: "series",
      detail: "`series:<column>` — which column is the numbers. Or `across:all` for every numeric column, or `channel:<rms|flux>` + `frame:<n>` for binary material.",
    };
  if (!decl.statistic)
    return {
      type: "undeclared",
      what: "as",
      detail: `\`as:<statistic>\` — what is measured about the column. Established here: ${Object.keys(nul.STATISTICS).join(", ")}.`,
    };

  // Gate 1. The whole point of the door. A statistic without a perturbation is
  // a bare figure, and a bare figure is the failure every other rule in this
  // repo exists downstream of.
  if (!decl.perturbation)
    return {
      type: "no_ground",
      detail:
        "`broken:<how>` is missing, so there is nothing to compare the figure to. A statistic on its own is not a finding — it is a number whose size you have no way to judge. " +
        `Break the material on purpose and measure again: ${Object.keys(nul.PERTURBATIONS).join(", ")}.`,
    };

  if (!Object.hasOwn(nul.STATISTICS, decl.statistic))
    return { type: "unknown_spec", what: "as", detail: `no statistic named "${decl.statistic}". Established: ${Object.keys(nul.STATISTICS).join(", ")}.` };
  if (!Object.hasOwn(nul.PERTURBATIONS, decl.perturbation))
    return {
      type: "unknown_spec",
      what: "broken",
      detail: `no way of breaking the material named "${decl.perturbation}". Established: ${Object.keys(nul.PERTURBATIONS).join(", ")}.`,
    };

  // Gate 2. Amendment I, enforced rather than restated. Sensitivity is a
  // property of the PAIR: a statistic the shuffle moves may be untouched by
  // phase randomisation, in which case that null has zero width for it and
  // clears anything put in front of it. The refusal carries the established
  // pairs AND the material each was earned on, because a licence established
  // on one kind of material is evidence, not a general ground — a reader
  // choosing among them should see what they are choosing.
  if (!decl.candidate && !nul.licensed(decl.statistic, decl.perturbation))
    return {
      type: "unlicensed_pair",
      what: `${decl.statistic}/${decl.perturbation}`,
      established: licensedPairs(nul),
      detail:
        `nobody has established that "${decl.statistic}" is sensitive to being broken by "${decl.perturbation}". ` +
        "Until that is measured, this pairing's null may have no width at all — in which case it would clear anything. " +
        "Use an established pair below, or run it as a trial with `trying:` instead of `as:`, which returns a placement typed as a trial and never as testimony.",
    };

  if (decl.direction && !["above", "below"].includes(decl.direction))
    return { type: "unknown_spec", what: "direction", detail: '`direction:` is either "above" or "below" — both are measurements and neither is the informative one.' };

  return null;
}

/**
 * The one router: a declaration and a table become a measurement.
 *
 * There is exactly one implementation of "which measurement is this" because
 * there were briefly two — app.js's turn and the real-data eval each grew
 * their own three-way branch, and they disagreed within the hour (the eval's
 * copy routed on `direction` where the app's routed on `across`, so a best-of-n
 * declaration silently ran as a single-column one and refused a column named
 * "null"). Callers hand in the organs and get a result or a refusal; nobody
 * gets to re-derive the dispatch.
 */
export function runMeasurement(decl, material, { nul, bindLinks, reduce }) {
  const refusal = admit(decl, nul);
  if (refusal) return { refused: refusal };
  if (decl.kind === "probe") return probeMaterial(decl, material, nul);

  // Material dispatch: a table has a head; anything else is bytes. The byte
  // path frames the material with the engine's own reduce (injected) and
  // rejoins the table path at placeSeries — same gate, same nothing, same
  // phrasing floor, different way of becoming a series.
  if (!material.head) {
    if (decl.kind === "pairs")
      return { refused: { type: "no_measurement_named", detail: "pairs: needs columns, and this file is binary — measure it as a channel over frames instead (`channel:` + `frame:`)." } };
    const got = seriesFromMedia(material, decl, reduce);
    if (got.refused) return { refused: got.refused };
    return placeSeries(decl, got.series, got.label, nul);
  }

  if (decl.kind === "pairs") return measurePairs(decl, material, { bindLinks });
  if (decl.across) return measureAcross(decl, material, nul);
  if (!decl.column)
    return { refused: { type: "undeclared", what: "series", detail: "this file is delimited — name `series:<column>` (channel:/frame: are how BINARY material becomes a series)." } };
  return measureSeries(decl, material, nul);
}

/**
 * What container these bytes are, read off their own magic — or null when
 * they carry none this door knows.
 *
 * Closed list, deliberately: a container is named only when its magic is
 * unambiguous, and everything else stays honest "bytes". This exists because
 * a PDF's first kilobytes are ASCII ("%PDF-1.4 ... obj"), so a text-or-not
 * heuristic reads one as prose, chunks it as paragraphs, and the door then
 * says "no columns" — when the honest reading is: this is a binary container,
 * measure it as bytes. Magic is checked BEFORE any text heuristic, always.
 *
 * The name changes only what the probe SAYS and which decoder may run (wav →
 * the PCM walk); every non-wav container measures identically as frames of
 * bytes. Naming it is honesty about what was framed, not a promise to parse it.
 */
/** Containers the perceivers' own loaders decode to a medium's series
 * (native/adapters/{audio,image,video}/material.js, node side). */
export const DECODABLE = new Set(["png", "jpeg", "mp4", "mpeg-audio", "ogg", "webm"]);

export function sniffContainer(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 8) return null;
  const at = (off, str) => [...str].every((c, i) => b[off + i] === c.charCodeAt(0));
  if (at(0, "RIFF") && at(8, "WAVE")) return "wav";
  if (b[0] === 0x89 && at(1, "PNG")) return "png";
  if (at(0, "%PDF")) return "pdf";
  if (at(0, "PK\x03\x04") || at(0, "PK\x05\x06")) return "zip";
  if (b[0] === 0x7f && at(1, "ELF")) return "elf";
  if (b[0] === 0x1f && b[1] === 0x8b) return "gzip";
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "mpeg-audio";
  if (at(0, "OggS")) return "ogg";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (at(4, "ftyp")) return "mp4";
  if (at(0, "SQLite format 3")) return "sqlite";
  return null;
}

/**
 * PCM samples out of a WAV container, or a typed refusal.
 *
 * Genuinely new code, and here is the stated reason (the search-first rule
 * demands one): the engine's own audio `load` decodes with the system ffmpeg
 * through node:child_process, which does not exist in the page, and the page
 * fetches nothing remote (P1) so it cannot borrow a decoder either. A PCM WAV
 * is a walkable RIFF container — fmt chunk, data chunk, integer samples — and
 * walking it is addressing, not statistics: every statistic still comes from
 * the engine. Compressed formats (mp3, ogg, non-PCM wav) are refused by name,
 * never half-decoded.
 *
 * Handles PCM (format 1) and IEEE float (format 3), 8/16/32-bit, any channel
 * count (mixed to mono by mean — the reduce channels hear energy and motion,
 * and averaging channels is the standard mono fold). Returns
 * {samples, sampleRate, channels, seconds} or {refused}.
 */
export function wavSamples(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ascii = (off, len) => String.fromCharCode(...b.subarray(off, off + len));
  if (b.length < 44 || ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WAVE")
    return { refused: { type: "not_wav", detail: "this file does not start with a RIFF/WAVE header, so it is not a WAV. Any file can still be measured as raw bytes — declare `channel:` and `frame:` and the door frames the bytes themselves." } };
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);

  let fmt = null;
  let data = null;
  let off = 12;
  while (off + 8 <= b.length) {
    const id = ascii(off, 4);
    const size = dv.getUint32(off + 4, true);
    if (id === "fmt ") fmt = { off: off + 8, size };
    if (id === "data") data = { off: off + 8, size: Math.min(size, b.length - off - 8) };
    // Chunks are word-aligned: an odd-sized chunk carries a pad byte.
    off += 8 + size + (size & 1);
  }
  if (!fmt || !data)
    return { refused: { type: "not_wav", detail: "RIFF header found but no fmt/data chunks — a truncated or unusual WAV. Measure it as raw bytes if the content is still worth hearing." } };

  const format = dv.getUint16(fmt.off, true);
  const channels = dv.getUint16(fmt.off + 2, true);
  const sampleRate = dv.getUint32(fmt.off + 4, true);
  const bits = dv.getUint16(fmt.off + 14, true);
  if (format !== 1 && format !== 3)
    return {
      refused: {
        type: "unsupported_codec",
        detail: `this WAV holds compressed audio (format tag ${format}), and this door decodes only PCM — decoding a codec is not addressing, and half a decoder would hand the null something that is not the material. Convert to PCM WAV, or measure the raw bytes.`,
      },
    };
  const bytesPer = bits / 8;
  const frames = Math.floor(data.size / (bytesPer * channels));
  if (!frames)
    return { refused: { type: "empty_material", detail: "the WAV's data chunk holds no samples." } };

  const read =
    format === 3 && bits === 32
      ? (i) => dv.getFloat32(data.off + i * 4, true)
      : bits === 16
        ? (i) => dv.getInt16(data.off + i * 2, true)
        : bits === 32
          ? (i) => dv.getInt32(data.off + i * 4, true)
          : bits === 8
            ? (i) => b[data.off + i] - 128 // 8-bit WAV is unsigned, centred at 128
            : null;
  if (!read)
    return { refused: { type: "unsupported_codec", detail: `${bits}-bit PCM is not a width this door reads (8, 16, 32, or 32-float).` } };

  const samples = new Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += read(f * channels + c);
    samples[f] = sum / channels;
  }
  return { samples, sampleRate, channels, seconds: frames / sampleRate };
}

/**
 * Any binary as a series: the declared channel over declared frames.
 *
 * The reduction is the ENGINE'S — perceiver/audio/reduce.js, injected — run
 * over whatever integer series the material yields: a WAV's PCM samples, or
 * failing that the file's own bytes. That reuse is exact, not analogical:
 * rms and flux are statistics of a numeric frame, and reduce() never asks
 * what the numbers meant. What changes per material is only the label, which
 * says precisely what was framed so the phrase cannot overclaim.
 */
export function seriesFromMedia(media, decl, reduce) {
  if (!decl.channel)
    return {
      refused: {
        type: "undeclared",
        what: "channel",
        detail: "`channel:<rms|flux>` — what is heard in each frame. rms is energy (blind to arrangement inside the frame); flux is sample-to-sample motion (order-sensitive). This is binary material, so a column name cannot be the series.",
      },
    };
  // A decoded image or video is framed in scanlines / transitions, where one
  // is a real unit; PCM and bytes need at least two samples to hear anything.
  const frameFloor = media.kind === "image" || media.kind === "video" ? 1 : 2;
  if (!Number.isInteger(decl.frame) || decl.frame < frameFloor)
    return {
      refused: {
        type: "undeclared",
        what: "frame",
        detail: "`frame:<n>` — how many samples (or bytes) make one heard unit. The grain of hearing is the reader's declaration: left to a default, two measurements of the same file would be silently incomparable.",
      },
    };

  // Decoded media (2026-09-05): a caller that has already decoded the
  // container with the perceivers' own loaders (eoreader7 native/adapters/
  // {audio,image,video}/material.js — ffmpeg on the node side; the page has
  // no decoder yet and says so in the probe) hands the decoded material in,
  // and the series is that perceiver's own reduce: scanline luminance for
  // an image, motion energy per transition for a video, rms/flux over PCM
  // for compressed audio. `reduce` may then be an object {audio, image,
  // video}; a bare function is the audio reduce, exactly as before.
  const reducers = typeof reduce === "function" ? { audio: reduce } : (reduce ?? {});
  if (media.kind === "image" || media.kind === "video") {
    const want = media.kind === "image" ? "luminance" : "motion";
    if (decl.channel !== want)
      return { refused: { type: "unknown_spec", what: "channel", detail: `a decoded ${media.kind} has one channel, \`channel:${want}\` (${media.kind === "image" ? "mean luminance per scanline, top to bottom" : "mean |Δ| per frame transition"}) — rms/flux are heard, not seen.` } };
    const r = reducers[media.kind];
    if (typeof r !== "function") return { refused: { type: "unknown_spec", what: "channel", detail: `no ${media.kind} reduce was offered to this door` } };
    let raw;
    try { raw = media.kind === "image" ? r(media) : r(media.frames); } catch (e) { return { refused: { type: "unknown_spec", what: "channel", detail: e.message } }; }
    // `frame:<n>` is the grain: n scanlines (or n transitions) make one unit,
    // read as their mean — the same coarsening frameSamples is for PCM.
    const series = [];
    for (let i = 0; i + decl.frame <= raw.length; i += decl.frame) {
      let sum = 0;
      for (let j = i; j < i + decl.frame; j++) sum += raw[j];
      series.push(sum / decl.frame);
    }
    if (series.length < 2)
      return { refused: { type: "empty_material", detail: `frame ${decl.frame} leaves ${series.length} unit(s) — nothing to measure at this grain.` } };
    const label = media.kind === "image"
      ? `${want} per ${decl.frame}-scanline frame (${media.w}×${media.h} as read)`
      : `${want} per ${decl.frame}-transition frame (${media.frames.length} frames${media.fps ? `, ${media.fps} fps` : ""})`;
    return { series, label };
  }
  let source;
  let label;
  if (media.kind === "wav") {
    const got = wavSamples(media.bytes);
    if (got.refused) return got;
    source = got.samples;
    label = `${decl.channel} per ${decl.frame}-sample frame (${got.sampleRate} Hz, ${got.seconds.toFixed(1)}s)`;
  } else if (media.kind === "pcm") {
    source = media.samples;
    label = `${decl.channel} per ${decl.frame}-sample frame (${media.sampleRate} Hz, ${(media.samples.length / media.sampleRate).toFixed(1)}s, decoded${media.container ? ` from ${media.container}` : ""})`;
  } else {
    source = media.bytes;
    const kindNote = media.kind && media.kind !== "bytes" ? `, ${media.kind}` : "";
    label = `${decl.channel} per ${decl.frame}-byte frame (${media.bytes.length.toLocaleString()} bytes${kindNote})`;
  }
  reduce = reducers.audio;
  if (typeof reduce !== "function") return { refused: { type: "unknown_spec", what: "channel", detail: "no audio reduce was offered to this door" } };
  let series;
  try {
    series = reduce(source, { frameSamples: decl.frame, channel: decl.channel });
  } catch (e) {
    return { refused: { type: "unknown_spec", what: "channel", detail: e.message } };
  }
  if (series.length < 2)
    return { refused: { type: "empty_material", detail: `frame ${decl.frame} leaves ${series.length} frame(s) — nothing to measure at this grain.` } };
  return { series, label };
}

/**
 * The probe: what is measurable in this material, said mechanically.
 *
 * The door's own answer to "it should be extremely easy": the first thing a
 * reader types is the file, and this replies with the file's measurable
 * surface and example declarations they can paste straight back. No draws
 * spent, no model call, nothing guessed — columns are read off the header,
 * kinds off the bytes, and the example numbers are the repo's own standing
 * declarations (draws 200 is the null-arm number this app already uses;
 * window and frame are shown as the slots they are, for the reader to fill).
 */
export function probeMaterial(decl, material, nul) {
  const lines = [];
  if (material.head) {
    const numeric = material.head.filter((h) => {
      const got = seriesFrom(material, h);
      return !got.refused;
    });
    const other = material.head.filter((h) => !numeric.includes(h));
    lines.push(`${decl.file} · ${material.rows.length.toLocaleString()} rows · ${material.head.length} columns`);
    if (numeric.length) lines.push(`numeric (measurable as a series): ${numeric.join(", ")}`);
    if (other.length) lines.push(`text (usable as pairs:/at:): ${other.join(", ")}`);
    lines.push("");
    if (numeric.length)
      lines.push(`/measure ${decl.file} series:${numeric[0]} as:burstiness broken:shuffle draws:200 window:<how much of the material is one present>`);
    if (numeric.length >= 2)
      lines.push(`/measure ${decl.file} across:all as:burstiness broken:shuffle draws:200 window:<n> direction:above`);
    // The pairs suggestion names the text column whose values actually RECUR
    // — counted, not guessed: most rows per distinct value, among columns with
    // at least two distinct values (one value recurring is a population of
    // one, which the pairs door refuses). The e2e transcript that forced this
    // check suggested `pairs:time at:time` — the timestamp column, every value
    // unique, ordered by itself — which parses and then refuses; a suggestion
    // that cannot succeed teaches only distrust.
    const recurring = other
      .map((h) => {
        const i = material.head.indexOf(h);
        const distinct = new Set(material.rows.map((r) => r[i])).size;
        return { h, distinct, per: material.rows.length / Math.max(distinct, 1) };
      })
      .filter((c) => c.distinct >= 2 && c.per > 1)
      .sort((a, b) => b.per - a.per)[0];
    if (recurring) {
      const at = material.head.find((h) => h !== recurring.h);
      lines.push(`/measure ${decl.file} pairs:${recurring.h} at:${at} draws:200 window:2`);
    }
  } else {
    if (material.kind === "image" || material.kind === "video" || material.kind === "pcm") {
      // decoded by the perceivers' own loaders — the probe teaches that medium's one channel
      const what = material.kind === "image"
        ? `a decoded image, ${material.w}×${material.h} as read — frames are scanlines`
        : material.kind === "video"
          ? `a decoded video, ${material.frames.length} frames${material.fps ? ` at ${material.fps} fps` : ""} — frames are transitions`
          : `decoded PCM, ${material.sampleRate} Hz, ${(material.samples.length / material.sampleRate).toFixed(1)}s${material.container ? ` (from ${material.container})` : ""} — frames are samples`;
      lines.push(`${decl.file} · ${what}`);
      if (material.kind === "image") lines.push("channels: luminance (mean luminance per scanline, top to bottom)");
      else if (material.kind === "video") lines.push("channels: motion (mean |Δ| per frame transition — perceive only by difference)");
      else lines.push("channels: rms (energy per frame), flux (motion per frame)");
      lines.push("");
      const ch = material.kind === "image" ? "luminance frame:<scanlines per unit>" : material.kind === "video" ? "motion frame:<transitions per unit>" : "rms frame:<samples per heard unit>";
      lines.push(`/measure ${decl.file} channel:${ch} as:burstiness broken:shuffle draws:200 window:<n>`);
    } else {
    const kindLine =
      material.kind === "wav"
        ? "a PCM WAV — frames are samples"
        : material.kind && material.kind !== "bytes"
          ? `a ${material.kind.toUpperCase()} container — frames are bytes (the container is named, not parsed${DECODABLE.has(material.kind) ? "; a decoder that offers it as its own series exists on the node side, not in this page" : ""})`
          : "binary — frames are bytes";
    const wav = material.kind === "wav" ? wavSamples(material.bytes) : null;
    lines.push(
      `${decl.file} · ${material.bytes.length.toLocaleString()} bytes · ${kindLine}` +
        (wav && !wav.refused ? ` · ${wav.sampleRate} Hz, ${wav.seconds.toFixed(1)}s` : ""),
    );
    lines.push(`channels: rms (energy per frame), flux (motion per frame)`);
    lines.push("");
    lines.push(`/measure ${decl.file} channel:rms frame:<samples per heard unit> as:burstiness broken:shuffle draws:200 window:<n>`);
    }
  }
  lines.push("");
  lines.push("Established statistic/broken pairings:");
  for (const { pair } of licensedPairs(nul)) lines.push(`  ${pair.replace("/", "  broken:")}`);
  return { kind: "probe", file: decl.file, lines };
}

/** The established pairs, each with the material its licence was earned on. */
export function licensedPairs(nul) {
  return Object.entries(nul.LICENSED).map(([pair, meta]) => ({ pair, where: meta.where }));
}

/**
 * A named column's values as a real numeric series.
 *
 * A column is admitted only if EVERY one of its cells is a finite number.
 * Dropping the unparseable ones would quietly change what was measured — a
 * column that is 60% numbers is not a series with some gaps, it is a different
 * column than the reader thinks they named, and the count of what was dropped
 * is the finding rather than a footnote.
 */
export function seriesFrom(table, column) {
  const { head, rows } = table;
  const i = head.findIndex((h) => h.toLowerCase() === String(column).toLowerCase());
  if (i === -1) return { refused: { type: "no_such_column", what: column, detail: `no column named "${column}". This file's columns: ${head.join(", ")}.` } };
  const values = rows.map((r) => r[i]);
  const numeric = values.map(Number);
  const bad = numeric.filter((v) => !Number.isFinite(v)).length;
  if (bad)
    return {
      refused: {
        type: "not_numeric",
        what: column,
        detail: `${bad} of ${values.length} cells in "${column}" are not numbers, so this column is not a series. Nothing was dropped and nothing was measured — a partly-numeric column is a different column than the one you named.`,
      },
    };
  if (numeric.length < 2) return { refused: { type: "empty_material", what: column, detail: `"${column}" has ${numeric.length} row(s) — there is no series here.` } };
  return { series: numeric, column: head[i] };
}

/**
 * Two named columns as arrival positions per distinct value.
 *
 * `key` is the thing that might recur (a unit, a name, a case type); `at` is
 * what orders the recurrences. Positions are the RANK of each row in the
 * ordering column, not the column's raw value: the binding organ places
 * arrivals on integer unit indices, and handing it raw timestamps would make
 * its extent the span of the clock rather than the span of the data. Ties share
 * a rank, which is what makes "these two arrived together" true of things
 * recorded at the same moment.
 */
export function arrivalsFrom(table, key, at) {
  const { head, rows } = table;
  const ki = head.findIndex((h) => h.toLowerCase() === String(key).toLowerCase());
  if (ki === -1) return { refused: { type: "no_such_column", what: key, detail: `no column named "${key}". This file's columns: ${head.join(", ")}.` } };
  const ai = head.findIndex((h) => h.toLowerCase() === String(at).toLowerCase());
  if (ai === -1) return { refused: { type: "no_such_column", what: at, detail: `no column named "${at}". This file's columns: ${head.join(", ")}.` } };

  // Rank the ordering column's distinct values. Numbers sort as numbers and
  // everything else sorts as text — a column of ISO timestamps or of "2024-01"
  // month labels then orders correctly without this module pretending to parse
  // dates, which is a job for the reader's own column.
  const distinct = [...new Set(rows.map((r) => r[ai]))];
  const allNumeric = distinct.every((v) => v !== "" && Number.isFinite(Number(v)));
  distinct.sort(allNumeric ? (a, b) => Number(a) - Number(b) : (a, b) => String(a).localeCompare(String(b)));
  const rank = new Map(distinct.map((v, i) => [v, i]));

  const byKey = new Map();
  for (const r of rows) {
    const k = r[ki];
    if (k === undefined || k === "") continue;
    if (!byKey.has(k)) byKey.set(k, new Set());
    byKey.get(k).add(rank.get(r[ai]));
  }
  const entities = [...byKey.entries()]
    .map(([id, set]) => ({ id, arrivals: [...set].sort((a, b) => a - b) }))
    // Two arrivals is the binding organ's structural minimum, not a tuned
    // floor: a single-arrival value has no pattern of arrival to test, so the
    // null has nothing to displace. Anything admitted below this would be a
    // placement of noise dressed as a pair.
    .filter((e) => e.arrivals.length >= 2)
    .sort((a, b) => b.arrivals.length - a.arrivals.length);

  if (entities.length < 2)
    return {
      refused: {
        type: "empty_material",
        detail: `only ${entities.length} value(s) in "${key}" arrive more than once, so there is no pair to test. A value that appears once has no pattern of arrival for a null to break.`,
      },
    };
  return { entities, totalUnits: distinct.length, key: head[ki], at: head[ai], singletons: byKey.size - entities.length };
}

/**
 * Place one column against a nothing built by breaking it.
 *
 * Every exit from here carries `floor` — 1/draws, the finest rank this run can
 * carry — because the phrasing rule downstream is not allowed to be finer, and
 * a result that travelled without its own floor would let a later renderer be
 * more confident than the run was.
 */
export function measureSeries(decl, table, nul) {
  const got = seriesFrom(table, decl.column);
  if (got.refused) return { refused: got.refused };
  return placeSeries(decl, got.series, got.column, nul);
}

/**
 * The shared bottom half: one numeric series, wherever it came from, placed
 * against the declared nothing. A column, a WAV's frame channel, and a raw
 * binary's frame channel all end here, because from nul's point of view they
 * are the same thing — material — and the gate has already run.
 */
function placeSeries(decl, series, column, nul) {
  if (decl.window > series.length)
    return {
      refused: {
        type: "undeclared",
        what: "window",
        detail: `window ${decl.window} is wider than the ${series.length} value(s) in ${column} — there is no window of that width to measure.`,
      },
    };

  const g = nul.ground({
    material: series,
    draws: decl.draws,
    window: decl.window,
    perturbation: decl.perturbation,
    statistic: decl.statistic,
    seed: decl.seed,
    via: "the-fold/measure.js",
  });
  if (nul.isGap(g)) return { refused: fromEngineGap(g) };

  const observed = nul.STATISTICS[decl.statistic](series, { window: decl.window });
  const placed = nul.difference(observed, g);
  const floor = 1 / decl.draws;
  const common = {
    kind: "series",
    file: decl.file,
    column,
    spec: g.spec,
    extent: g.extent,
    support: g.samples.length ? [g.samples[0], g.samples[g.samples.length - 1]] : null,
    floor,
    candidate: Boolean(decl.candidate),
    rows: series.length,
  };

  if (nul.isGap(placed)) {
    // Censored is a finding, not a failure. Above the support is surfeit — the
    // ground was present and cannot say how much; below it is regularity, and
    // the two must never be pooled into one "significant".
    if (placed.gap === "exceeds_witness")
      return { ...common, censored: placed.direction, observed: placed.observed, support: placed.support ?? common.support };
    return { refused: fromEngineGap(placed) };
  }
  return { ...common, observed: placed.observed, rank: placed.rank, support: placed.support, volume: placed.volume };
}

/**
 * Which of a column's values arrive together more than their own arrival rates
 * force — the legacy engine's `bindLinks`, per pair, with its own displacement null.
 *
 * This is the organ the dfr repo's matter_grouping.py hand-rolled: positions
 * held, times permuted, a dominance count and a p-value computed by hand at
 * `matter_grouping.py:114`. The organ was already there, already per-pair, and
 * already carrying its own extent. Nothing about the shape of that analysis
 * needed writing; only the adapter above did.
 */
export function measurePairs(decl, table, { bindLinks }) {
  const got = arrivalsFrom(table, decl.key, decl.at);
  if (got.refused) return { refused: got.refused };
  const { entities, totalUnits, key, at, singletons } = got;

  const { pairs, nulls } = bindLinks(entities, {
    window: decl.window,
    draws: decl.draws,
    seed: decl.seed,
    extent: "combined-span",
  });

  const floor = 1 / decl.draws;
  const links = pairs
    .map((p) => {
      // bindLinks keys its null map with a NUL byte between the two ids --
      // written as an escape here rather than a literal, and matched rather
      // than re-derived, so a pair whose id contains a space still finds
      // its own null.
      const n = nulls.get(`${p.a.id}\u0000${p.b.id}`);
      return {
        a: p.a.id,
        b: p.b.id,
        observed: n?.observed ?? p.overlap,
        // Never finer than the draws can carry. A pair no null draw matched
        // reads as "1 in draws or rarer", never as zero — a p-value of 0 is a
        // claim about infinity from a finite number of shuffles.
        rank: Math.max(n?.pValue ?? 1, floor),
        censoredAtFloor: (n?.pValue ?? 1) < floor,
        draws: n?.draws ?? decl.draws,
      };
    })
    .sort((x, y) => x.rank - y.rank || y.observed - x.observed);

  return {
    kind: "pairs",
    file: decl.file,
    key,
    at,
    spec: { window: decl.window, draws: decl.draws, seed: decl.seed, extent: "combined-span", via: "the-fold/measure.js" },
    totalUnits,
    entities: entities.length,
    singletons,
    tested: pairs.length,
    floor,
    links,
  };
}

/**
 * Place several observations against ONE ground — the correction nul spent a
 * measured table documenting, made reachable at this door.
 *
 * A reader who measures every numeric column in a file and keeps the most
 * extreme has asked a best-of-n question, and a one-arrival ground answers a
 * different one: at n = 200 it ranks signal-free noise at 0.010 and calls a
 * quarter of trials surfeit. `direction` is required and never defaulted,
 * because the extreme of n maxima and the extreme of n minima are different
 * nothings.
 */
export function measureAcross(decl, table, nul) {
  if (!decl.direction)
    return {
      refused: {
        type: "best_of_n",
        detail:
          "measuring every column and keeping the most extreme is a best-of-n question, and it needs its own nothing — the largest of n null draws clears a one-column support most of the time, which turns 'measure more columns' into a way of manufacturing findings. " +
          'Declare `direction:above` or `direction:below`: they are different nothings and neither is the informative one.',
      },
    };

  const numericCols = table.head.filter((h) => {
    const got = seriesFrom(table, h);
    return !got.refused;
  });
  if (numericCols.length < 2)
    return { refused: { type: "empty_material", detail: `this file has ${numericCols.length} all-numeric column(s) — there is no best-of-n here.` } };

  const seriesByCol = numericCols.map((h) => ({ column: h, series: seriesFrom(table, h).series }));
  const usable = seriesByCol.filter((s) => s.series.length >= decl.window);
  if (usable.length < 2)
    return { refused: { type: "undeclared", what: "window", detail: `window ${decl.window} leaves fewer than two measurable columns.` } };

  // One ground, built over the FIRST column's material and asked the best-of-n
  // question at the counted n. n is counted, never chosen — a caller who picks
  // it has misunderstood the call.
  const n = usable.length;
  const g = nul.extremeGround({
    material: usable[0].series,
    draws: decl.draws,
    window: decl.window,
    perturbation: decl.perturbation,
    statistic: decl.statistic,
    seed: decl.seed,
    n,
    direction: decl.direction,
  });
  if (nul.isGap(g)) return { refused: fromEngineGap(g) };

  const stat = nul.STATISTICS[decl.statistic];
  const observations = usable.map((s) => ({ column: s.column, value: stat(s.series, { window: decl.window }) }));
  const pick = decl.direction === "above"
    ? observations.reduce((m, o) => (o.value > m.value ? o : m))
    : observations.reduce((m, o) => (o.value < m.value ? o : m));
  const placed = nul.difference(pick.value, g);
  const floor = 1 / decl.draws;
  const common = {
    kind: "across",
    file: decl.file,
    column: pick.column,
    n,
    direction: decl.direction,
    spec: g.spec,
    extent: g.extent,
    floor,
    candidate: Boolean(decl.candidate),
    columns: observations,
  };
  if (nul.isGap(placed)) {
    if (placed.gap === "exceeds_witness") return { ...common, censored: placed.direction, observed: placed.observed, support: placed.support };
    return { refused: fromEngineGap(placed) };
  }
  return { ...common, observed: placed.observed, rank: placed.rank, support: placed.support };
}

/**
 * An engine gap, carried through with its own type rather than flattened into
 * a message. The engine's vocabulary is the honest one and this door does not
 * get to rename its refusals.
 */
function fromEngineGap(g) {
  // nul's own gap shape: `{gap: <type>, ...detail}` — the type is on `.gap`
  // and the detail is spread flat, never nested. Read from the engine's
  // shape rather than a guess at it; the first version of this function
  // guessed `.type`/`.detail` and turned every engine refusal into
  // "refused (undefined)", which the suite caught immediately.
  const { gap: type, ...d } = g;
  const said = {
    degenerate_ground:
      "the nothing came out with zero width — every broken copy produced the same figure, so this null would clear anything put in front of it. That is a fact about the pairing, not about the material.",
    empty_material: "there is no material here to measure.",
    undeclared: `a number was left to a default: ${d.what ?? "unknown"}.`,
    unknown_spec: d.reason ?? "no such way of measuring or of breaking the material.",
    kept_ground: "that ground is being held as testimony and cannot be perceived through.",
    incommensurate_extent: "the nothing was built over a different amount of material than the thing it is the nothing for.",
  };
  return { type, detail: said[type] ?? `the engine refused this measurement: ${type}.`, engine: d };
}

/**
 * The sentence. Natural-frequency phrasing, never finer than the run's own
 * floor, and never the word "significant" — which names a threshold nobody
 * here declared.
 *
 * The phrasing rule is the one from Explore's kinds arm, carried: the renderer
 * may not phrase finer than the arm's finest rank. Here the floor rides on the
 * result itself, so a caller cannot lose it.
 */
export function phrase(result) {
  if (result.refused) return `refused (${result.refused.type}): ${result.refused.detail}`;
  if (result.kind === "probe") return result.lines.join("\n");
  const floorWords = (r) => `${Math.round(1 / r.floor)} broken copies, so the finest thing sayable is 1 in ${Math.round(1 / r.floor)}`;

  if (result.kind === "pairs") {
    const atFloor = result.links.filter((l) => l.censoredAtFloor).length;
    const head =
      `${result.file} · ${result.tested} pair(s) of "${result.key}" values tested for arriving together, ordered by "${result.at}" ` +
      `over ${result.totalUnits} position(s) · ${result.entities} value(s) arrived more than once` +
      (result.singletons ? `, ${result.singletons} arrived once and were not tested` : "");
    const tail = atFloor
      ? ` · ${atFloor} pair(s) were matched by no broken copy at all: 1 in ${Math.round(1 / result.floor)} or rarer, which is as fine as ${result.spec.draws} draws can say`
      : "";
    return `${head} · window ${result.spec.window}, ${floorWords(result)}${tail} · every rank is the pair's own displacement null, no threshold anywhere`;
  }

  const what = result.kind === "across"
    ? `the most extreme of ${result.n} numeric column(s) ("${result.column}", ${result.direction})`
    : `"${result.column}"`;
  const spec =
    `${result.spec.statistic} of ${what} in ${result.file}, against ${result.spec.perturbation} · ` +
    `window ${result.spec.window}, ${floorWords(result)}, seed ${result.spec.seed} · ${result.extent} value(s)`;
  const trial = result.candidate
    ? " · A TRIAL, NOT TESTIMONY: this statistic and this way of breaking the material are not an established pair, so the placement below says nothing yet about the material"
    : "";

  if (result.censored) {
    const side = result.censored === "above"
      ? `sits above every one of the ${result.spec.draws} broken copies — the ground was present and cannot say how far above. Surfeit: the honest silence of a witness who cannot place what it saw`
      : `sits below every one of the ${result.spec.draws} broken copies — regularity, which is the opposite finding and must not be read as the one above`;
    return `${spec}${trial} · observed ${fmt(result.observed)} ${side}.`;
  }
  const beat = Math.round(result.rank * result.spec.draws);
  return (
    `${spec}${trial} · observed ${fmt(result.observed)}; ${beat} of ${result.spec.draws} broken copies reached it or beat it ` +
    `(support ${fmt(result.support[0])} to ${fmt(result.support[1])}).`
  );
}

const fmt = (v) => (Number.isInteger(v) ? String(v) : Number(v).toPrecision(4));

/**
 * The result as rows, for the same table door a model's answer would take.
 * Figures the app computed, printed by the app — never retyped by a model.
 */
export function toTable(result) {
  if (result.kind === "pairs") {
    return {
      type: "table",
      head: [result.key, result.key, "arrived together", "1 in", "as fine as draws allow"],
      rows: result.links.map((l) => [
        String(l.a),
        String(l.b),
        String(l.observed),
        String(Math.round(1 / l.rank)),
        l.censoredAtFloor ? "at the floor" : "",
      ]),
    };
  }
  const rows = [
    ["file", String(result.file)],
    ["column", String(result.column)],
    ["measured", String(result.spec.statistic)],
    ["broken by", String(result.spec.perturbation)],
    ["window", String(result.spec.window)],
    ["draws", String(result.spec.draws)],
    ["seed", String(result.spec.seed)],
    ["values", String(result.extent)],
    ["observed", fmt(result.observed)],
  ];
  if (result.kind === "across") {
    rows.push(["placed as", `most extreme of ${result.n} columns, ${result.direction}`]);
    for (const o of result.columns) rows.push([`  ${o.column}`, fmt(o.value)]);
  }
  if (result.censored) {
    rows.push(["placement", `censored ${result.censored} — outside the support`]);
  } else {
    rows.push(["support", `${fmt(result.support[0])} to ${fmt(result.support[1])}`]);
    rows.push(["broken copies reaching it", `${Math.round(result.rank * result.spec.draws)} of ${result.spec.draws}`]);
    rows.push(["finest sayable", `1 in ${Math.round(1 / result.floor)}`]);
  }
  if (result.candidate) rows.push(["standing", "a trial — this pairing is not established"]);
  return { type: "table", head: ["", result.file], rows };
}

/** What the door says when it is walked with nothing, or with the wrong shape. */
export function usage(nul) {
  const pairs = licensedPairs(nul).map((p) => `    ${p.pair}`).join("\n");
  return [
    "/measure <file> series:<column> as:<statistic> broken:<how> draws:<n> window:<n> [seed:<n>] [direction:above|below]",
    "/measure <file> pairs:<column> at:<column> draws:<n> window:<n> [seed:<n>]",
    "",
    "Places a figure against a nothing built by breaking the file's own rows on purpose — never a figure on its own.",
    "",
    "  series:  the column of numbers.  across:all measures every numeric column against one nothing instead,",
    "           and then needs direction: — the largest of n broken copies clears a one-column support most of the time.",
    "  pairs:   the column whose values might arrive together; at: the column that orders them.",
    "  broken:  how the nothing is built.  draws: how many broken copies — the finest rank sayable is 1 in draws.",
    "  window:  the reach of the present, declared, never derived from how much material there happens to be.",
    "  trying:  in place of as:, runs an unestablished pairing as a trial whose result is never testimony.",
    "",
    "Established pairings (statistic / how it is broken):",
    pairs,
  ].join("\n");
}
