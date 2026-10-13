# Drive-style Sources view — pre-registered acceptance record

Branch `holodeck-drive-sources`. Written **before any code**. Predictions below
are never edited after the fact; results are appended under "Results" with the
commit they were measured at. If a prediction fails, the failure is recorded
next to it, not rewritten.

The page is a thin client. Everything that can be decided mechanically lives in
pure modules with `node --test` tests; the DOM module only draws and forwards.
No model is called anywhere in this feature.

## What would embarrass it

Each line is an embarrassment, the measurement that would expose it, and the
**control built to fail** — a deliberately wrong implementation the same
measurement must catch. A measurement that cannot catch its own control proves
nothing and is reported as such.

| # | Embarrassment | Measurement | Control that must fail |
|---|---|---|---|
| E1 | A drag, a click or a context menu moves the page (scroll jumps, focus steals the viewport). | Live, in the browser pane: scrollY of the window and scrollTop of the sources scroller are equal before and after drag-drop, click-select, shift-click, and context-menu open. | A handler that calls `scrollIntoView` on the dropped tile. |
| E2 | A thumbnail shows content from the wrong source. | Pure: the cache key is the SHA-256 of the content the thumbnail was made from; looking up a source whose content changed (same id, new bytes) misses; two sources with the same bytes share one entry; the snippet shown is a verbatim prefix of the source's own text. | A cache keyed by source id: it must serve the stale thumbnail after the content is swapped. |
| E3 | Migration loses a folder or a source's membership. | Pure property test over randomized legacy `fold-explorer-folders` stores (empty, malformed, duplicate ids, a source in two folders, a folder referencing a source that is gone): every legacy folder id survives with its name; every legacy (source, folder) membership is either adopted or itemised in the migration record; the legacy key is byte-identical afterwards. | A migration that copies only the first folder. |
| E4 | Undo does not restore. | Pure property test: for random sequences of operations (bulk move, trash, restore, rename, star, folder create/move/trash with contents), applying the operation and then its undo yields a state deep-equal to the state before. | An undo that reverses only the last item of a bulk move. |
| E5 | 2,000 sources freezes the page. | Pure: deriving the rows (filter, sort, window) for 500 and 2,000 synthetic sources, timed, medians of repeated runs. Live: scrolling and sorting a 2,000-source workspace in the browser pane, with long tasks counted by `PerformanceObserver`. DOM node count stays bounded by the window, not by N. | A renderer that mounts every row: its node count and render time must visibly scale with N. |
| E6 | A preview is fabricated. | Pure: a source with no bytes and no text yields the type icon and never an image; a PDF whose first page cannot be rendered yields the icon, not a placeholder page; the preview record says what it was made from. | A generator that returns a stock image when generation fails. |
| E7 | "Last modified" shows the published date instead of when the source was added, or invents an added time for a source this view never saw arrive. | Pure: a source published in 1999 and first seen today shows today; a source present before the view existed shows "Earlier" with no time; the added time never changes after first sight. | A column that reads `published`. |
| E8 | Trash is not a safety net: a trashed source still counts in the reading, or restore puts it somewhere else, or Discard is still one click. | Pure: trashed ids are excluded from the analysed set and listed in Trash; restore returns it to the folder it left (or to the top level, said plainly, if that folder is itself in Trash); the page no longer exposes a one-click permanent delete on a card. | A trash that only hides the tile. |
| E9 | A folder is moved into itself or its own descendant. | Pure: the move is refused at write time and ignored at fold time (a log written elsewhere cannot create a cycle). | A move without the ancestor check: it must produce a cycle that the fold would loop on. |
| E10 | Keyboard or screen-reader users cannot operate it. | Pure: roving-tabindex model has exactly one tab stop; arrow/Home/End/PageUp/PageDown/Space/Enter/Delete/F2/Escape map to the right actions; roles are `grid`/`row`/`gridcell` (list) and `listbox`/`option` (grid), `menu`/`menuitem` for the context menu. Live: Tab order walked in the browser pane. | A model that gives every tile `tabindex=0`. |
| E11 | Multi-select is wrong (a range across a sorted order, selection lost on sort, select-all counting hidden sources). | Pure property test of the selection state machine. | A range computed over insertion order instead of the displayed order. |
| E12 | Analytic or canon vocabulary fronts the surface. | Pure: a lint over every user-visible string the modules can emit against a forbidden-word list (terrain/EO terms). | A string table containing "ground" or "holon". |
| E13 | The three branches stop merging. | `git merge-tree` of this branch against `holodeck-matrix-invites` and `claude/holodeck-research-assistant-babe7f`: no conflict in `index.html`; the number of changed `index.html` lines is reported. | n/a (reported as measured). |
| E14 | The surface breaks at the narrow width (horizontal page scroll, controls off-screen, grid tiles overlapping). | Live: `document.documentElement.scrollWidth <= innerWidth` at the operator's ~1134 px and at 375 px, screenshots shared. | A fixed 960 px table. |
| E15 | The page is no longer plain-language. | The status chips, empty states, menus and toasts are read in the live page and in the string table; no chip is a raw status code. | n/a (reviewed; listed under what is not established if only reviewed). |

## Predictions about the numbers

* **P-scale.** Row derivation for 2,000 sources is within the same order of
  magnitude per source as for 500 (it is O(n log n) for sorting only, nothing
  quadratic); the DOM node count in the viewport is independent of N (window
  size ± one overscan page).
* **P-budget.** One interaction (select, sort change, folder open) over 2,000
  sources finishes derivation inside a single frame budget of the display
  (declared once in `DECLARED`, with its reason). I expect this to hold for the
  pure derivation and to be at risk for first paint of thumbnails (images
  decode off the main thread; PDF page render does not and is queued).
* **P-thumb.** For a mixed workspace the preview coverage is: image sources
  100% when bytes exist; PDFs when pdf.js loads (the page already loads it
  from its existing CDN import; offline it is the honest icon); text-bearing
  sources 100% (a verbatim snippet); audio/video: YouTube thumbnail when the
  id is known, otherwise icon. Nothing else gets an image.

## Declared constants (the only ones; each with its reason)

Recorded in `holodeck-drive-view.js` as `DECLARED`, nowhere else:

* `FRAME_MS` — the display's frame period at 60 Hz (16.7 ms). A physical
  property of the display, used only as the budget a single interaction's
  derivation must fit in.
* `OVERSCAN_ROWS` — the number of extra rows rendered beyond the viewport on
  each side, so a fast scroll does not show blank space. Chosen as the
  viewport row count itself (one page each side); not a free parameter — it is
  derived from the measured container height.
* Tile and row sizes are **measured** from the container width/height and a
  declared minimum tile width (`MIN_TILE_PX`, the narrowest at which a
  two-line title is still legible at 14 px).

## Results

(appended below, never edited above)

### Run 1 — measured on branch `holodeck-drive-sources`

Environment: node 24 for the pure tiers; the browser pane (Chromium, over
`http://localhost:8841/`, served from the worktree) at 1134 px and 375 px, with
a synthetic workspace seeded into localStorage/IndexedDB (24 sources; then
2,000). Existing tests: 34 passing names / 8 failing names before and after,
identical by name (the 8 are the four files that fail to load because
`vendor/fold-chat` is a partial closure in git — pre-existing).

**Predictions that held**

| # | Result |
|---|---|
| E2 | Pure: keyed by content — same id with new bytes misses, same bytes under another id shares one entry, text previews are verbatim prefixes; the id-keyed control serves the stale picture. Live: replaced the image bytes under the same id; the thumbnail changed (`590f79885afa` → `a0416ab8c83f`) while the old cache entry was still present. |
| E3 | 300 randomised legacy stores: every folder and every membership is adopted or itemised; the legacy key is byte-identical afterwards (pure and live: 3 folders / 5 memberships appeared as 3 folders with 2/0/3 sources). The "copy only the first folder" control fails the same invariant. |
| E4 | 400 randomised op sequences × every step: apply then undo returns the exact state. Controls (undo of last item only) fail. Live: drag-drop of one source onto a folder (Press 3→4) and the toast's Undo button (→3). |
| E7 | "Last modified" shows the time added; a source present before the log reads "Earlier" with no invented time; the added time never changes. Live, hydration is not mistaken for arrival (`ready:false` stamps nothing). |
| E8 | Live: Move to Trash took the page's header from "22 documents · 88 statements" to "21 · 84"; the source is listed in Trash; Restore returned it to its place and "22 · 88". The card-level Discard button now reads "Move to Trash". |
| E9 | Cycle refused at write time, ignored at fold time; the guard terminates the unchecked-cycle control. |
| E10 | One tab stop in the surface (pure and live, including after the focused item re-sorted out of the window); arrows/Home/End/PageUp/PageDown/Space/Enter/Delete/F2/Esc/⌘A/⌘Z mapped; roles grid/row/gridcell (list), listbox/option (grid), menu/menuitem. |
| E11 | Range selection is over the displayed order; the insertion-order control gives a different set. |
| E12 | String lint passes; its control (a canon string) is caught. |
| E14 | `scrollWidth === innerWidth` at 1134 and 375 px (list and grid). |
| E1 (partial) | Click-select, shift-range, drop on a folder, context-menu open: `scrollY` and the top of the first tile unchanged. See "not established" for native pointer drag. |
| P-scale / P-budget (derivation) | `rowsFor` for all six sorts, search and the top level: n=500 ≤ 1.7 ms, n=2,000 ≤ 3.6 ms (median of 15); the test asserts ≤ one frame (16.7 ms) and passes. The window is 48 nodes at most at 2,000 sources (control that mounts everything: 26,000 nodes, 670 ms). |

**Predictions that did not hold, or held only partly**

* *P-budget, whole interaction.* A sort or a search keystroke is a full redraw of
  chrome + rows + window: 11–22 ms at 1,751 analysed sources (one of six sorts
  above the 16.7 ms frame on its first run, 21.6 ms; JIT-cold). A 100 px wheel
  step costs a median 2.7 ms; a 600 px jump a median 9.9 ms of script plus 4.5 ms
  of layout with a ~28 ms tail (about a dozen new tiles at ~0.8 ms each). So the
  derivation fits one frame; a large jump does not always.
* *Preview coverage.* The page's pdf.js import hung rendering one test PDF in
  this environment (a handcrafted file with different glyphs; likely a font
  that never arrives). The first version had no timeout and a hung render held
  the queue. Fixed after seeing it: a declared 10 s `RENDER_TIMEOUT_MS`, the
  tile falls back to the source's own words when it has them, the failure is
  remembered for the session only. Unit-tested; also seen live.

**Defects found by the live run and fixed before this record (each has a test or a live re-check)**

1. The stylesheet constant was named `CSS` and shadowed `window.CSS`; every
   keyboard move threw. Renamed.
2. Arrow-key moves selected in state but did not redraw the tiles. Fixed.
3. After a rename re-sorted the focused tile out of the window nothing had
   `tabindex=0` (no tab stop). The stop now falls to the first drawn item.
4. With **Details** on, `syncDetails()` called the page's `setState` on every
   render → React update-depth error #185 loop. It now mirrors only when the
   selected id changes.
5. The bulk-actions bar pushed the tiles down on first selection (a layout
   shift under the pointer). It now overlays the toolbar row; the first tile's
   top is unchanged by selecting (357.2 px before, after one, after a range).
6. A grid-mode probe for tile height measured the wrong thing for folders
   (folders were stretched to file-tile height). Folders are their own block
   with their own measured row height.
7. Test-expectation mistakes of mine (not product changes): a time-zone
   dependent "Yesterday" case, and one sort-order expectation. Corrected.

**Existing behaviour seen on the way, not changed**

* `analysis()` de-duplicates sources by URL with the query string stripped, so
  two YouTube sources whose URLs differ only in `?v=` collapse to one in the
  reading (seed sources 11 and 19 were dropped in the synthetic run). Not
  verified against how real YouTube sources are stored (they may carry
  `media.id` only).
* Renaming a source in a 2,000-source workspace re-analyses the whole
  workspace (several seconds, main thread) — the page's `renameDocTitle` path.

### What is not established

* **Native pointer drag-and-drop.** The pane's synthetic drag did not start an
  HTML5 drag; the handlers were exercised with dispatched `DragEvent`s carrying
  a real `DataTransfer`. A real mouse drag, and touch (HTML5 DnD does not exist
  on touch; **Move to…** is the touch path), are not tested.
* **Screen readers.** Roles, labels, `aria-selected`, `aria-sort`, live regions
  are set and unit-checked; no assistive technology was run.
* **Type-ahead** (typing a name to jump) is not built.
* **Preview cache has no size bound or eviction** (IndexedDB database
  `holodeck-drive-previews`; 1,550 entries after the 2,000-source run).
* **Recent** is "added or first opened": the page's read log stores only the
  first open, so a source opened again does not move up.
* **Added by** is "You" or "This workspace" — the page has no per-source author;
  the sharing branch can fill `sender` on the events.
* **Added time** exists only from the first load of this version; everything
  earlier reads "Earlier".
* **Sharing**: folders/places/stars/trash are events shaped for a store room,
  but no sharing path was run (that branch is unmerged). Whether two writers'
  interleaved events fold to the same state on both sides is true by
  construction (the fold is a function of the timestamp-ordered log) but not
  tested with a second writer.
* **A hung render in an offline browser**: first pages need the page's existing
  pdf.js CDN import; offline, PDFs show their own words or the icon. Not tested
  offline.
* **Large first load**: the first draw of a 2,000-source workspace took ~13.8 s
  from navigation in this pane, almost all of it the page's own analysis
  (existing); the Drive module's first render was 17 ms. Not separated further.
* **Light theme** not visually checked.
* **The 2,000-source numbers are from a hidden-pane run** (requestAnimationFrame
  does not fire there, so scrolling was driven by calling the redraw
  synchronously); they are script and layout costs, not measured frame times.
