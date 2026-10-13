# The Drive-style Sources view

Branch `holodeck-drive-sources`. The acceptance record that was written before
the code is `DRIVE-SOURCES-PREREG.md`; its "Results" section says what was and
was not established. This note is the design and the data shape.

## What a person sees

The first level of Sources is a place, not a report:

* **My sources** (folders first, then loose sources), **Recent**, **Starred**,
  **Seen, not kept** (the staging area, unchanged in meaning), **Trash**.
* **Grid** (preview, name, type icon, ⋮) or **List** (Name · Added by · Last
  modified · Size). The analytic columns — Type, Publisher, Standing,
  Statements, Names, Custody — are one **Columns** menu away, and the existing
  right-hand source panel is the **Details** pane (a toolbar toggle mirrors the
  one selected source into it).
* Folders are tiles/rows with a breadcrumb path; they nest.
* Drag sources or folders onto a folder, a breadcrumb segment, **My sources** or
  **Trash**; checkbox and shift-click range selection; right-click and ⋮ menus;
  F2 / inline rename; arrow keys, Home/End, PageUp/PageDown, Space, Enter,
  Delete, Ctrl/⌘+A, Ctrl/⌘+Z; an Undo toast after every move/trash/star.
* A status chip says *New*, *Needs read*, *Transcribing*, *Not transcribed* or
  *Not kept*. Nothing else is on a card at rest; actions appear on hover/focus.
* **Trash** replaces the card-level Discard. A trashed source is out of the
  reading (statements, names, counts) until it is restored; restoring puts it
  back in the folder it left. "Delete forever" lives only inside Trash, behind a
  confirmation.
* The previous **Cards** and **Table** modes are still there as two more
  buttons of the mode switch; **Files** is the default.

## Modules (all pure except the last two; each has a `.test.mjs`)

| file | job |
|---|---|
| `holodeck-drive-log.js` | the append-only log, the fold, resolution (what shows where), writers, inverses (undo), legacy migration, export to the record vocabulary |
| `holodeck-drive-controller.js` | one workspace's log bound to a storage: load/migrate, first-sight stamping, undo stack (with batches), subscribers, the old folder API's shapes |
| `holodeck-drive-view.js` | source → entry (type, chip, added time, honest size), rows for a place, sorts, search, the window arithmetic, the menu model, the string table |
| `holodeck-drive-select.js` | selection, shift ranges over the displayed order, roving tab stop, keys → actions, ARIA roles |
| `holodeck-drive-thumb.js` | preview planning, content-hash cache, bounded queue |
| `holodeck-drive-ui.js` | DOM only: draws, measures its container, forwards events (browser) |

`index.html` carries only: a `#drive-surface` mount point in the summary view,
a `syncDrive()` method modelled on `syncOverview()`, a one-line trashed-set
filter in `analysis()`, the folder methods delegating to the controller once it
is loaded (the flat code stays as the fallback), `trashSource()` in place of
the card Discard, and the mode switch entry.

## Folders in the workspace record — the data shape

A workspace's folder structure is **a log of events**, not a list. Each event
is a Matrix-shaped envelope in the `io.holodeck.*` namespace — the same one
`holodeck-records.js` uses — so it can be written unchanged to a store room
(MATRIX-INVITES.md: the `sources` store) and folded by anyone:

```json
{ "type": "io.holodeck.drive.<op>",
  "content": { … },
  "origin_server_ts": 1760000000000,
  "sender": "@you:this-tab",
  "event_id": "$drive-…" }
```

| `<op>` | `content` | meaning |
|---|---|---|
| `folder.create` | `{folder, name, parent\|null}` | a folder exists (ids are opaque; legacy ids are kept) |
| `folder.rename` | `{folder, name}` | |
| `folder.move` | `{folder, parent\|null}` | refused at write time and ignored at fold time if it would make a cycle |
| `folder.trash` | `{folder, withContents, at?}` | `withContents:true` → its whole subtree is in Trash; `false` → only the folder is, its children surface at its parent |
| `folder.restore` | `{folder}` | everything returns in place (placements were never edited) |
| `folder.forget` | `{folder}` | tombstone — only appended by *undo of a create* |
| `source.place` | `{sources:[id…], folder\|null}` | a source lives in at most one folder; `null` = top level; no event = top level |
| `source.star` | `{sources, on, at?}` | |
| `source.trash` / `source.restore` | `{sources, at?}` | |
| `source.seen` | `{sources, earlier?}` | first sight of a source id: its **added** time is this event's timestamp; `earlier:true` means "was here before this log existed", and no time is invented |
| `migrate.legacy` | `{from, folders, memberships, placed, residue, renamedIds}` | the report of the one-time import |

State is `fold(events)`; nothing else is stored. Nothing is ever removed from
the log: **undo appends the inverse events** (`inverseOf`), Trash is an event
with a Restore. A fold is tolerant (an event that would break an invariant is
ignored, never thrown), so a log written by another person cannot wedge a page.
Source ids are the page's existing source ids (`d.id`), the same string
`holodeck-records.js` anchors as `src:<id>`.

`toRecordEvents(state)` renders the same state in the record vocabulary
(`ins` Folders · `def` name/trashed/starred · `con` "in folder") so it can be
appended to the workspace's records log; it is not wired into `buildLog` yet
(one line when the sharing branch wants it).

### Persistence

```
hd:drive:<workspaceId>            { v:1, events:[…] }        the log (source of truth)
hd:drive:<workspaceId>:trashed    ["id", …]                  derived cache, read synchronously
                                                             by analysis() before the module loads
hd:drive-prefs:<workspaceId>      { mode, sort, cols, details }  per-viewer; not workspace state
fold-explorer-folders             legacy flat list           never written by the new code
IndexedDB holodeck-drive-previews preview cache by content hash (its own database)
```

### Migration (additive, non-destructive)

On first load of a workspace with no log, the legacy
`fold-explorer-folders[<workspaceId>]` list becomes events: one `folder.create`
per folder (ids and names kept; an empty name becomes "Untitled folder"; a
duplicate id gets `-2` and says so in `renamedIds`), one `source.place` per
folder, and a `migrate.legacy` report. The legacy key is not modified or
deleted, so an older page still finds exactly what it left. A source listed
under two legacy folders (impossible through the old UI) is placed in the first
and the rest are itemised in `residue`, never dropped. An unreadable log is
copied aside (`…:unreadable-<time>`) before a new one is started.

## Previews

A preview is made from the source's own bytes or words or it is the type icon:

* image → the image, downscaled; PDF → its first page (the page's existing
  pdf.js import); web page / note / data / document → the first words of its
  own text, verbatim; YouTube → YouTube's thumbnail for its video id;
  nothing available → the icon, with the reason in the tooltip.
* The cache key is the SHA-256 of the content the preview was made from plus
  the size bucket (next power of two ≥ tile width × devicePixelRatio). A source
  whose bytes change misses; two sources with the same bytes share an entry.
* Generation is lazy (only what is drawn), newest request first, bounded
  concurrency (half the cores, at least one). A failure is remembered as an
  icon-with-reason so a bad file is not retried on every scroll.

## What the view does not do

* It does not search inside source text (the sidebar Search does); the box says so.
* It does not change the reading: the only analysis change is that Trash is
  outside it. Folder navigation here does not scope the reading; "Read only
  this folder" on a folder's menu does, through the existing scope.
* It does not model sharing. Folders and placements are plain events a
  sharing layer can carry; who may write them is that layer's gate.
