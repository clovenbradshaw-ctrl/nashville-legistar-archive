# the fold

**The Fold is the whole system (naming, 2026-10-01); this is its reading and
research surface.** The khora (the eoreader7 repo) perceives and produces
ground; penelope keeps the record and owns the mouth; this repo is where the
hand comes back to the loom — previously called the holodeck, now named for the
whole it serves. The former `the-fold` repo's surface is being absorbed here;
its machinery is being absorbed by plane (generation → penelope,
information-processing → eoreader7, surfacing → this repo).

A single-page reading and research surface: paste, upload, or link anything, and it gets split into statements with every name, figure, and date traced back to where it appears — grounded, never paraphrased. Cross-document agreement, disagreement, and genuine topical clusters ("paradigms") are discovered from what's actually there, not declared.

There's no build step. `index.html` is the whole app (a Claude Design `.dc.html` export, hydrated by `support.js`); open it directly or serve the directory with any static file server.

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

## What's vendored, and why

`vendor/` carries in, unchanged, the pieces of two sibling projects this surface is built on top of rather than re-deriving:

- **eoreader7** (`vendor/eoreader7/native/`) — the kernel, organs, and text adapters for real grounding: span-accurate names, referents, relation extraction. Some of this is already wired in (the Records/Assertions view's query engine); some is vendored ahead of being wired in, for what's next.
- **the-fold's engines** (`vendor/the-fold/fold.js`, `vendor/bare-metal/`) — the fold/query engine (`data-chat.js`, `operators.js`) actually powering the Assertions view's "treat this as a relational database" query bar right now. Vendored from the former `the-fold` repo before its absorption; the engines themselves are moving into the khora (eoreader7) as the repo's functionality is absorbed.

`VENDORING.md` is the real, dated provenance log: which upstream repo each file came from, and whether it was kept byte-identical or ported.

## Content

The workspace starts empty — there are no built-in sample corpora. Add anything: paste text, drop files, **drop a whole folder or choose one in the Add panel** (its files, and any nested folders, are read in place), point the omni bar at any URL, or give the Add panel a GitHub repo (`owner/repo` or a `github.com` URL) and its text files are pulled in and read. Everything you add lives in a browser-local "Your content" workspace. There is no relay of our own: a page is fetched **directly** from its own site first. Genuinely unrelated content you bring in can be split into its own workspace with "Fork" once it's recognized as a separate topic, rather than staying mixed in with everything else.

## Reading a page that blocks being read

Not every page can be read directly. A static page cannot fetch a site that refuses cross-origin requests, and a page whose article exists only after its own scripts have run (most news sites) has no text to fetch in the first place.

When a direct read is refused, the surface tries, in turn: **public CORS proxies** that return the page's HTML; a **stable anchored version** — see below; and **text readers** that render the page server-side and return its *text* (a JavaScript-rendered article cannot come back as HTML, but it can come back as text, which is worth more than nothing). Each is a third party that fetches the page for the browser, so it sees the address — this is disclosed in the ingest trace. The text readers are `r.jina.ai` and Microlink; Jina will also take a key, kept in `localStorage hd:jina`. (There is no web or news search for the same reason: it needed a relay of our own.)

**The anchor loop — a stable anchored version of any page.** `holodeck-anchor.js` runs **DEF → EVA → REC**, the three operators the records view folds. **DEF** declares the archive gates — a Memento (RFC 7089) timegate per public archive. The list is *data*, not code: a person's own list in `localStorage hd:archives` wins, else the shipped registry **`archives.json`** is fetched at runtime, else the built-in defaults, so the set of archives stays current without a code change. **EVA** asks every gate, in parallel, for the Mementos it holds and scores each (served status, size, recency), recording what every gate answered — including the misses. No single archive can stall the loop: archive.org in particular rate-limits and often refuses behind a VPN, and a 429 is just a recorded miss. **REC** keeps the surviving anchor — the best Memento any gate actually served — and the runners-up. Nothing is guessed; an anchor is only set to a URI a gate served. When a gate answers with a human-check — the archive's own check, not ours; a person is not a bot — the surface offers **“Prove you are human — open it ↗”** and, beside it, **“I've proved it — try again”**, which reads the page again *in-app* carrying the archive's clearance cookie. If it went through, the blocked shell is replaced by the readable source; if not, the buttons stay so they can try once more.

For the pages none of that can read, the page is shown live and offered for capture from the reader's own browser. On **Add & publish**, drag **✦ Explore this page** to the bookmarks bar, once. After that, when a page cannot be read directly, open it in the browser and click **✦ Explore this page**: the page *as it is rendered* — scripts already run, whatever is actually on screen — is handed to this surface, read and grounded, with no third party involved. GitHub, Wikipedia and the Internet Archive can still be searched directly.

For automatic capture, install the small **`extension/`** (Load unpacked): it reads a page only when the fold opens it as `<url>#fold-capture` (or when you press its toolbar button), waits for any human-check to clear, and hands the rendered page back — no click. It needs `host_permissions: <all_urls>` to be able to read the page you are looking at, and it stores nothing. See `extension/README.md` (set `FOLD_URL` there to wherever the fold is served).

The first time the page opens, it deletes the persisted history of the old fixed sample corpora (localStorage, the file store, and IndexedDB) — one-time cleanup, so no trace of those links remains in this browser.

## Watching it read, and Archon Fort

Every ingest records a trace from the real reading functions and opens a replay (`holodeck-ingest-player.js`): the log on the left, the source text and the holograph folding on the right, with rewind and slow motion. `holodeck-media.js` makes images, sound, scores, math, spreadsheets and unknown bytes ingestible.

**Archon Fort** (`holodeck-fort.js`) flags what a person would stop and question: names glued together from pieces of other names, sentence-opening words caught as names, form labels, headlines, OCR misreadings, word salad. It then sends a swarm of small independent witnesses (ants) to try to falsify each flag. A flag *stands* only if every ant that speaks calls it an artifact. It is *falsified* if they all call it real, and *contested* if they disagree; both sides stay on the record. Fort flags things and never removes them. Standing oddities appear on the Added card with an Inspect link into the replay.

Measured against three blind graders (90–95% agreement) on 150 held-out OHS names:

| Fort standing | Share the graders called odd |
|---|---|
| stands | 83% |
| contested | 89% |
| falsified | 35% |
| never raised (base rate) | 60% |

Known misses: generic headings made of ordinary words, OCR slips outside its confusion table, and run-togethers where one side is a single word.

## Reading every kind of source

The OHS corpus was read to a depth its own captures earned — attribution from the page's
own metadata, the article rather than the page chrome, captions as time-addressed lines,
scanned pages through OCR. `holodeck-read.js` is that reading, generalised, so any source
a person adds is read the same way:

- **A page** — the article's own text, with the page's own account of **who wrote it, when
  and where** (author, published date, publisher) taken from its metadata, never inferred.
  Those facts now name the giver in every "who says" line, for a dropped file or a live URL.
- **Captions and transcripts** (`.srt`, `.vtt`, segment JSON) — read as time-addressed
  paragraphs, each carrying its second, so a line is seekable when the recording is linked.
- **Email** (`.eml`) — the headers are received facts (sender, recipients, date, subject);
  quoted-printable and base64 bodies are decoded.
- **Tables** (`.csv`, `.tsv`) — shown as a table *and* each row stated as a sentence, so
  cells reach the holograph the way spreadsheet cells already did.
- **A scan or a photo of a page** — a PDF with no text layer, and an image, are read by a
  local WASM OCR engine loaded on demand (no relay); the recognized text is marked as a
  machine reading, never as the document's own words. Turn it off with
  `localStorage hd:ocr = 'off'`.

## What counts as normal

Whether something is unusual depends on where it is. A capitalised "Contractor" is normal in a contract that defines it; "Label:" lines are a form's furniture. `holodeck-region.js` answers "is this normal here?" against the smallest region that can be told apart from its surroundings. The ladder runs from the document, to documents of the same kind, to the workspace, to **General English** from `live_priors` (8 books, 31 encyclopedia articles and 27 statutes, received with their file list and cached in the browser), and finally to eoreader7's English part-of-speech prior. At each step the region is compared against 199 same-size draws from the next region out. It sets the normal only when it falls outside every draw; otherwise the question moves outward. The workspace can override General English only where it measurably differs, so a corpus full of junk can't declare its junk normal.

The name finder uses this ground. It drops a sentence-opening word that is normally lowercase ("Developer Adam Rosenberg" → "Adam Rosenberg"), unless that word and the next are written capitalised mid-sentence elsewhere ("Open Table Nashville"). It also strips words that have no noun or name reading ("Whether OHS" → "OHS"), drops runs that are clauses or headlines, and drops form labels. Every change is logged in the ingest replay with the region that decided it.

In a blind three-grader panel on 100 random multi-word names from the OHS workspace (graders agreed 87–98%), the share judged junk fell from 71% (95% interval 62–80%) to 50% (40–60%). What remains is mostly truncated fragments, form labels, OCR slips, headlines and generic headings.

## How things are hung

A repo, a report, and a recording don't share affordances, so every ingest is hung before it is read (`holodeck-hang.js`): witness-line counts for imports/definitions, sentence terminals, and grid alignment decide among code/graph, prose/sequence, and table — winner must strictly beat its runner-up, a tie is a recorded gap, never a guess. Media kinds keep the hang their sniff magic earned. Your input is ordinal ("prefer X over Y here"), kept append-only in `hd:hang-directions` — superseded, never edited — and every decision lands on the ingest replay under a Hang stage. Mixed kinds share no lens: one panel per kind.

## Reading a source, not just naming it

Every source the workspace holds is read by eoreader7's own relation reader, in this tab, through `holodeck-reading.js` — the same organs the engine's `POST /v1/read` drives, no server and no prebuilt index. The reader's cast and bonds fold into the same `FoldReadingIndex@2` shape the OHS ground reading already has, and `holodeck-records.js` writes them as `Referents` and `Bonds` beside the corpus, so an upload lands as a read source, not merely a named one. A referent's `standing` is `witnessed` for text.

The reader is a *witness* beside the local finder, never a replacement: measured on real documents the engine reader agreed with only part of the local names (see "The engine reads first"). `holodeck-reading.test.mjs` proves the fold; `falsify.reading.mjs` runs it over a battery of content kinds (prose, legal, transcript, CJK, Cyrillic, dense figures, attributed speech, delimited tables, HTML, code, JSON, near-empty) and checks the fold laws, merge order-stability, and records parity. Its surfaces are kept in null-prototype bags, so a name like `__proto__` is read like any other.

## Seeing a source: the middle layer, and why it beats flat OCR

Images are read in two rungs. Flat OCR (`tesseract.js`, `holodeck-read.js`) returns a string. Better — and now the default — is the **measured 2D model**: every element carries `region [x,y,w,h]`, a `role` (page/header/box/h1/p/image/rule), a parent, reading order, and the page's design tokens (ink, surfaces, radius, type scale), all read mechanically from the pixels — no vision model. This is the middle layer between pixels and HTML, and it is what makes "where is this, and what is it" answerable. It runs **in this tab** (`holodeck-screen-core.js` + `holodeck-screen.js`): the pure geometry is a faithful ESM port of the screenshot pipeline's `screen-core.cjs`, and the pixels come from a decoded image with word boxes from tesseract.js, so no binary and no server are needed. A drop-in image yields a `screen` sidecar on the doc; its referents fold into the same reading (standing `sighted`, each carrying its regions) and into the records as `Referents`/`Bonds`. `holodeck-screen-core.test.mjs` proves the port matches the pipeline core box-for-box on the real fixture.

Measured head-to-head on the pipeline's own sample (a landing page): flat OCR gave **16 lines / 50 words and no geometry**; the 2D model gave **57 elements, 57 with a region, 6 labelled headings, 9 role types, and 11 design-token groups** — and a caption the page-level OCR never saw. `screen-reading.js` folds that model into the same reading shape, so an image's referents carry their regions and stand `sighted`, and it surfaces the model as EOT observations (`role: "visual-sighted"`, `at: {image, region:[x,y,w,h]}`) — the region address beside the text's byte offset.

## Transcription, proven local

`falsify.reading.mjs` proves transcription on the machine, offline: `mlx_whisper` (whisper-small-mlx) transcribed an 8.7k-word audio file, and ffmpeg extracted a video's audio track which was then transcribed — each transcript fed back through the reading as a source. This is the two-rung path the surface offers for a video with no caption track.

## Status

This is the live, ongoing home for this surface — active development happens here going forward, not in a local-only copy. It is **the fold**, the reading/research surface of The Fold, and inherits the former `the-fold` repo's surface role.

## DeepSeek experiment (result: not in-tab)

Tried putting DeepSeek in the browser. WebLLM only prebuilds the R1-Distill **reasoning** models (`DeepSeek-R1-Distill-Llama-8B`, `DeepSeek-R1-Distill-Qwen-7B`), and a reasoning model is the wrong tool here: the fold does the reasoning itself and wants the answer only. Asked something trivial ("hi"), an R1 model over-thinks, loops, and can spend the whole token budget before it ever reaches the answer. Hiding the thinking trace does not fix that — the compute is still spent. So no DeepSeek is offered in-tab.

DeepSeek's non-reasoning option is the MoE (V2-Lite / Coder-V2-Lite, 16 B total but 2.4 B active per token). It has no published webgpu `.wasm`, so it runs through the Ollama lane (`deepseek-coder-v2:lite`) instead — non-reasoning, minimal per-token compute, and it flows through the identical full pipeline (listed in the model dropdown automatically when Ollama is up).

The roster filters reasoning models out of **both** lanes, by name (`isThinkingModel` in `holodeck-ask.js`): `deepseek-r1`, `qwq`, `qwen3` (thinks by default), and the `*-reasoning` / `*thinker` family. A reasoner over-thinks a simple prompt, loops, and can spend the whole budget before answering — the opposite of the fold, which does the reasoning itself. `qwen3-coder` and `deepseek-coder-v2` are not thinking models and stay.

## Compute workers — Heimdall invites (2026-10-01)

Settings → **Compute workers · Heimdall**: mint a heimdall compute invite under your own Matrix account. The fleet room is born with a short local alias, so the invite link is just `?r=<code>` — something you can actually type by hand on a remote computer (`scores-patch-points.github.io/heimdall/?r=h7q2x`). Record the worker's 6-digit pairing code into the account's `org.heimdall.codes` registry — the same registry the heimdall site confirms acceptance against, so an invite minted here is confirmable there and vice versa. Pure logic in `holodeck-heimdall.js` (the fold's `heimdall-invite.js` pattern); the crossings live in `fold-net.js`.

## Full-screen Chat · Fold · Notebook

Open **Ask**, then choose **Chat**, **Fold**, or **Notebook**. **Full screen** hides the workspace navigation and reading controls; Escape restores them. The workspace name and source count remain visible. Switching modes preserves the conversation, artifacts and notebook edits. Direct entry: `?work=chat`, `?work=fold`, or `?work=notebook`; add `&fullscreen=1` for a focused workspace.

**Chat** uses the existing source-grounded conversational reader. **Fold** uses the existing artifact pipeline and keeps its preview, versions and evidence ledger. **Notebook** now uses a genuine persistent Jupyter/IPython kernel: variables survive between cells, execution counts follow actual execution order, Python exceptions and rich outputs are recorded, matplotlib figures appear inline, and Markdown cells remain editable.

From this Holodeck checkout, install Python dependencies once and start the local runtime:

```bash
python3 -m pip install -r tools/notebook-requirements.txt
npm run notebook
```

Open `http://127.0.0.1:8900/?work=notebook&fullscreen=1`. Node serves the app and notebook API together. For another interpreter, port, or ledger directory:

```bash
npm run notebook -- --python /path/to/python --port 8910 --dir /path/to/notebooks --by human:your-name
```

- Add code or Markdown cells. Shift+Enter saves, runs and advances; Ctrl/Cmd+Enter stays in the cell. **Run all** saves pending edits before executing in cell order and stops on the first error. **Restart & run all** starts a fresh kernel first.
- **Interrupt** stops a running cell. **Restart kernel** clears variables while retaining the recorded output history. Each notebook tab and each Holodeck workspace has its own kernel and ledger. Kernels restart empty after server shutdown; notebooks and outputs remain on disk.
- **Upload data** or drop files into the notebook. Original bytes are available under `./data/<filename>`. Install any additional scientific packages in the selected Python environment.
- Import a `.ipynb` into a new notebook tab; imported outputs are marked as produced elsewhere and are not presented as runs performed here. Export produces nbformat 4.5 with real Jupyter MIME outputs, execution counts, kernel metadata and run seals. Figures and HTML tables round-trip; HTML output renders in a sandboxed iframe.
- Cell edits are backed up in this browser while you type. Running, switching notebook tabs, or exporting saves edits to the local ledger. The page re-verifies its append-only notebook, claim and workspace chains. Each run records its code, input hashes, outputs, kernel execution count and preceding run seal.
- Forking preserves the parent's sealed prefix and starts a separate empty kernel; run cells in the fork to rebuild its variables. Human claim promotions remain with the parent.

The Python runtime is a local ipykernel worker per conversation, using Jupyter's in-process message transport. It runs your code with your machine's permissions. It supports Python, not arbitrary remote Jupyter servers or custom kernels. It does not claim the legacy ant-colony analysis, learned-skills UI, or reproducible bundle export; those remain features of the separate EOReader7 notebook server. The old `NOTEBOOK-FALSIFICATION.md` documents that earlier server's measured behavior, not this kernel integration.

To connect a hosted Holodeck page, start the runtime with `--origin https://your-holodeck-host` and set `localStorage['hd:notebook']` to its loopback URL (or pass `?notebook=http://127.0.0.1:8900`). The runtime rejects other external origins and requires a custom header for executable requests.

Verification: `npm run test:notebook`, `node vendor-sync.mjs --check`, and `node tests/fullscreen-notebook.browser.mjs` (Playwright Chromium required). The browser test accepts `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` and `REACT_VENDOR_DIR` when these dependencies are supplied separately.

## The engine reads first

Each added document is posted to eoreader7's `POST /v1/read` (model-free; tries `localStorage hd:engine`, then `127.0.0.1:11436`, then `:11476`). The replay draws the engine's own events under an **Engine** stage, and its beings are a *witness* beside the Holodeck's finder: it adds lowercase names and recurring descriptions the local finder cannot see (`kutuzov`, `the contractor`, `the camp`), after the same hygiene every local name passes, and Fort gets an `engine` ant that votes *real* when the engine also admitted a name and stays silent otherwise. If the proxy is down the document is read locally and the Added card says so.

It does **not** replace the local finder, because measured on three real workspace documents the engine reader agreed with only 10/81, 9/60 and 18/119 of the local names. Its known defects (for the engine, not for a Holodeck workaround): it breaks names at "of" ("Continuum of Care"), admits months and "on tuesday" as beings, splits "Freddie O'Connell" to "O'Connell", and misses "Lauren Riley" and "Department of Law". Documents already in the workspace are still read locally only.

The vetting of engine additions (month and weekday names, function words) is English-only, like the rest of the local hygiene; other scripts pass through unvetted.

## The record, and the constitution

`docs/FOLD-CONSTITUTION.md` is the one document that governs what The Fold may put in front of a person, at every surface. `docs/LEGACY-RECORD.md` is the index to the instrument's own accumulated knowledge about itself — the refused list and policies in the archived former `the-fold` repo, and the living ledgers (the khora's `content-rules.json`, heimdall's derived rules). Read the legacy record before proposing a "new" idea: it names the dead ends.

## Penelope (2026-10-01)

App generation lives in the sibling `penelope/` repo now (pipeline,
organs, layout library, ladder records). Nothing here changes: ingest,
hang, and the local finder are untouched, and the engine-reader
relationship above is as measured. Builds that need generated artifacts
route through Penelope's doors, not through ingest.

## Located statements (2026-10-02)

The header shows the current question, workspace, selected source count and view.
The map names its center and why it was selected; click a connecting line to see
shared-statement witnesses and open them in their sources. Map distance describes
those counts, not ownership, coordination or control. Grouping links with no
available witness say so.

Draft distinguishes thoughts and hypotheses from source claims, owned analysis,
witnessed accounts, positions and documented absence. Thoughts and hypotheses
remain editable and are excluded from report exports. A failed source match never
declares authorship. Ownership is a deliberate choice with a named giver; absence
also requires a search note, corpus and question. Declarations retain their
question, frame, source identities and date; superseded declarations remain in
the document record. Changing the sentence invalidates its declaration. Owned
statements export with their declaration rather than a generic author footnote.
Ownership declares responsibility; it does not certify truth or source entailment.

Ground checks still use the existing name/predicate/figure matcher over the loaded
workspace. Their recorded scope says so; they are not exhaustive searches. Empty
counter-ground means no counter-ground was admitted, not that none exists.

Run the grounding regression battery with:

```bash
node --test holodeck-ground.test.mjs holodeck-holons.test.mjs holodeck-doors.test.mjs holodeck-heimdall.test.mjs
```
