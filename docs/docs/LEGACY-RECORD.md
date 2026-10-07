# The instrument's own record — what it refuses, and where that knowledge lives

*A surface that cannot tell you what it has already ruled out will be made to re-learn
it. This is the index to The Fold's own accumulated knowledge about itself: the refused
list, the policies, the audits, and the living ledgers. It exists so a person (or an
agent) landing on the five repos can find that record in one hop, instead of hunting an
archive.*

## The five, and where each kind of knowledge lives

| knowledge | home | form |
|---|---|---|
| what the instrument may produce, under which standing | `docs/FOLD-CONSTITUTION.md` (this repo) | the one governing document |
| the swarm's standing rules for hard content types | khora `content-rules.json`, served at `GET /content-rules` | append-only JSON |
| heimdall's derived rules (recurrences that minted a rule) | khora `heimdall-derived-rules.json` | append-only JSON, each with a falsifying control |
| the archive choices this surface honours | `archives.json` / `localStorage hd:archives` | data, not code |
| the surface's own prefer-X-over-Y directions | `localStorage hd:hang-directions` | append-only; superseded, never edited |
| the record of every computed event | the workspace record (per folder/workspace) | append-only |

The constitution is the one document that governs all five. It ships here, in the surface
repo, because "everything The Fold puts in front of a person" is what it decides, and the
surface is where that happens.

## The archived policy corpus (the former `the-fold` repo)

The old surface's accumulated "what went wrong / what we refuse" record lives in the
former `the-fold` repo, now being absorbed by plane and archived as `the-fold-legacy`
(see `THE-FOLD-ABSORPTION.md` in the workspace root). Its history is the last resort for
anything absorption missed; the archive is a rename, never a delete. The load-bearing
documents, and what each is for:

- **`NEXT-PASSES.md`** — the **refused list**: measured dead ends not to retry. The
  absorption plan carries those refusals forward verbatim ("no furniture gate on surprise,
  no recurrence-as-anchor, no distributional-company-as-identity, no tenth vocabulary
  widening, no slicer, no identity-folding-as-corroboration-lever"). This is the single
  most important file to consult before proposing a "new" idea.
- **`CAPABILITY-POLICIES.md`** — what each capability may and may not claim.
- **`REASONING-POLICIES.md`** / **`THEORY-GUARDS.md`** — the theory and the guards that
  keep a reading honest.
- **`GENERATION-POLICIES.md`** / **`CHAT-POLICIES.md`** / **`SERVING-POLICY.md`** /
  **`SERVING-POLICY-RESIDENCY.md`** — how artifacts and model calls are produced and served.
- **`THE-FIFTH-TURN.md`** — the distilled statement of the fifth turn.
- **`AUDIT-2026-08-16.md`** — a full audit; its defects and fixes are the appendix's own
  measured record.
- **`ARCHITECTURE.md`** / **`MIGRATION-TO-NATIVE.md`** / **`MVP-LAUNCH-CHECKLIST.md`** —
  the old architecture and its migration to the khora.

## The standing rule for legacy material

The five repos may not require a legacy (`clovenbradshaw`) repo at runtime. That is a
correctness rule, not a memory rule: the record above is *read for history only* — do not
wire it into new work, do not "fix" it, do not treat it as a live dependency. When a
policy in the archive still holds, restate it in the living home (the constitution, the
khora's `content-rules.json`, heimdall's derived rules), where it can be enforced, and
cite the archive entry it came from.
