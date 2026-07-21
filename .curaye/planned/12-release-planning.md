---
id: release-planning
title: Release Planning & Kanban
status: draft
effort: m
impact: medium
desire: high
requires: [desktop-app]
tags: [desktop, ui]
created: 2026-07-21
updated: 2026-07-21
---

# Release Planning & Kanban

> Group planned specs into a named release. A kanban derived from spec status — no separate board state to maintain.

## Problem

A developer shipping a version of their app needs to know: which specs are in this release, which are done, which are still in progress. The current view shows all planned specs without a grouping mechanism for releases.

## Goal

A release planning feature that lets a developer assign planned specs to a named release and see a kanban board view of that release's progress. The kanban is derived from frontmatter — no new state layer.

## Non-goals

- Cross-project releases (a release spanning multiple projects) — single-project scope only in v1.
- Release notes generation — that is an AI command in the palette.
- Publishing or tagging releases — Curaye is the planning layer, not the CI/CD layer.

## Release documents

A release is defined by a lightweight document in `.curaye/releases/` (a new top-level folder in the protocol):

```yaml
# .curaye/releases/v0-3-0.md
---
id: v0-3-0
title: v0.3.0
target: 2026-09-01     # optional target date
status: planning       # planning | active | shipped
created: 2026-07-21
updated: 2026-07-21
---

# v0.3.0

Optional release notes or goals here.
```

Specs are assigned to a release via the `release` frontmatter field on the planned spec:

```yaml
# .curaye/planned/ask-the-book.md
---
...
release: v0-3-0
---
```

The `releases/` folder is added to the protocol standard (spec `00`) as an optional top-level folder.

## Kanban view

The kanban board for a release shows all planned specs assigned to that release, grouped by status:

```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   Draft     │    Ready    │  Building   │    Done     │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ emoji-      │ ask-the-    │ llm-        │ auto-scroll │
│ reactions   │ book        │ provider    │             │
│ (m)         │ (l)         │ (m)         │ (m)         │
│             │             │             │             │
│             │ auto-scroll │             │             │
│             │ (s)         │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

Cards show: spec title, effort badge. Drag-and-drop between columns updates the spec's `status` frontmatter. A "ship release" button at the top marks all `done` specs as shipped and sets the release `status: shipped`.

## Release list view

A "Releases" section in the desktop tree panel (below `decisions/`). Lists all releases with their status and a progress bar (done / total specs in release).

## CLI commands

```
curaye release new <name> [--target YYYY-MM-DD]
```
Creates a new release document in `.curaye/releases/`.

```
curaye release list [--project <id>]
```
Lists releases with spec counts and status.

```
curaye release assign <spec-id> <release-id> [--project <id>]
```
Sets `release` field on the given planned spec.

```
curaye release board <release-id> [--project <id>]
```
Prints the kanban board as ASCII in the terminal.

## Acceptance criteria

1. Creating a release with `curaye release new v0.3.0` writes `.curaye/releases/v0-3-0.md` with correct frontmatter.
2. Assigning a spec to a release updates only the `release` field in that spec's frontmatter.
3. The kanban board shows all specs assigned to a release, grouped by their current `status`.
4. Dragging a card from "Ready" to "Building" on the kanban writes `status: building` to the spec's file.
5. A spec with `status: shelved` does not appear on the kanban.
6. "Ship release" transitions all `status: done` specs through the ship flow (creates `shipped/` docs, updates `current/`) and marks the release `status: shipped`.
7. The release list shows a progress bar that reflects the ratio of `done` specs to total specs in the release.
8. `curaye release board v0-3-0` prints a readable ASCII kanban to stdout.
9. A spec can only belong to one release at a time — assigning to a new release replaces the old value.
10. Releases with `status: shipped` appear in the list but are collapsed by default in the tree panel.
