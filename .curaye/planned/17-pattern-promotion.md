---
id: pattern-promotion
title: Pattern Promotion — Project to Shared Layer
status: draft
effort: m
impact: high
desire: high
requires: [shared-layer, cli]
tags: [shared, cli, desktop]
created: 2026-07-21
updated: 2026-07-21
---

# Pattern Promotion — Project to Shared Layer

> Something proved itself in one project. Promote it to shared so every future project inherits it.

## Problem

Valuable patterns, decisions, and design systems evolve in specific projects and stay there. Promoting them to the shared layer is currently a manual copy-paste operation with no structure, no tracking of which project originated the pattern, and no way to notify other projects that it exists.

## Goal

A promotion flow — via CLI and desktop — that elevates a document from a project's `.curaye/` into the shared layer, recording its origin, making it available for adoption, and notifying registered projects that a new shared resource exists.

## Non-goals

- Automatically applying promoted patterns to other projects — adoption is always a deliberate choice.
- Versioning shared documents with semver — Curaye uses dates and git history, not version numbers.
- Merging conflicting patterns from different projects — the user resolves conflicts manually.

## What can be promoted

| Source | Promoted to |
|---|---|
| Project `decisions/` doc | `shared/decisions/` |
| Project `current/` doc describing a reusable pattern | `shared/patterns/` |
| Project `current/` doc describing a design system or component | `shared/design/` |
| Project `stack.md` or a subset | `shared/stack/` |
| Project `CLAUDE.md` / agent log pattern | `shared/agents/` |

`planned/` specs are not promotable — they describe intent, not proven patterns.

## Promotion flow

```
curaye promote <file-path> [--to decisions|patterns|design|agents|stack] [--project <id>]
```

Or from the desktop: right-click a document in the tree → "Promote to shared layer".

**Steps:**

1. Curaye reads the source document.
2. Prompts for the target category if `--to` is not specified.
3. Optionally prompts for a new `id` for the shared document (defaults to the source document's id).
4. Adds shared-layer metadata to frontmatter:
   ```yaml
   source_project: ilmgah
   promoted: 2026-07-21
   adopted_by: []
   ```
5. Writes the document to `~/.curaye/shared/<category>/<id>.md` and the sync repo.
6. Adds the source project to `adopted_by` automatically — the project that promoted it is an implicit adopter.
7. Sends a notification to all other registered projects: "New shared resource available: `shared/design/glass-ui`."
8. Asks: "Add a reference to the original in the source project? [y/n]" — if yes, adds `promoted_to: shared/design/glass-ui` to the source document's frontmatter.

## Post-promotion updates

After a pattern is promoted, updates to the shared document come from direct edits to `shared/<category>/<id>.md`. The link back to the originating project is informational only — changes to the project's local copy do not automatically update the shared version. To update the shared version from a project change, the user runs `curaye promote` again on the updated file.

## AI-assisted generalisation

When AI is configured, the promotion flow offers: "Generalise this document for shared use? [y/n]"

If yes, AI rewrites the document to remove project-specific references:
- Replaces `ilmgah` with `your-project` or removes project names.
- Removes implementation details that are specific to the originating codebase.
- Adjusts the title and overview to be project-neutral.

The user reviews the AI-rewritten version before it is saved.

## Desktop integration

In the desktop app:
- A "Promote" option appears in the right-click menu on any `decisions/` or `current/` document.
- The promotion modal shows the target category options and a preview of the shared-layer metadata that will be added.
- After promotion, the shared layer section in the sidebar shows the new document with an "origin" badge.

## Acceptance criteria

1. `curaye promote decisions/why-sqlite.md --to decisions` writes the document to `~/.curaye/shared/decisions/why-sqlite.md`.
2. The promoted document contains `source_project`, `promoted`, and `adopted_by` fields in frontmatter.
3. The originating project appears in `adopted_by` after promotion.
4. All other registered projects receive a notification that `shared/decisions/why-sqlite` is now available.
5. The source document gains `promoted_to: shared/decisions/why-sqlite` in frontmatter if the user confirms.
6. Running `curaye promote` on the same file twice updates the shared version rather than creating a duplicate.
7. With AI configured and generalisation accepted, the shared document does not contain the originating project's name.
8. `curaye shared list` shows the newly promoted document immediately after promotion.
9. The desktop right-click promotion flow writes the same output as the CLI promotion flow.
10. Promoting a `planned/` document surfaces an error: "Only current/ and decisions/ documents can be promoted."
