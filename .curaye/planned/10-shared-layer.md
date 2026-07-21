---
id: shared-layer
title: Shared Layer — Cross-Project Patterns & Decisions
status: draft
effort: l
impact: high
desire: high
requires: [package-core, cli]
tags: [core, shared]
created: 2026-07-21
updated: 2026-07-21
---

# Shared Layer — Cross-Project Patterns & Decisions

> The layer above individual projects. Patterns, decisions, and design systems that belong to you as a developer — not to any one codebase.

## Problem

Developers managing multiple projects repeat themselves constantly: the same architecture decisions, the same design system choices, the same agent steering patterns. This knowledge lives in their head or is re-derived each time. There is no canonical place where it lives, compounds, and propagates.

## Goal

Define and implement the shared layer: a structured folder above the project registry, carrying cross-project patterns, standing decisions, design systems, and agent steering documents. Integrate it into the CLI, desktop app, and project bootstrap flow.

## Non-goals

- Automatically syncing shared layer changes into projects — propagation is informed, not automatic.
- A package registry or component distribution system — the shared layer is documentation, not runnable code.
- Version-locking shared patterns to projects — no semver or lockfile for knowledge.

## Folder structure

The shared layer lives in the sync repo and in a local mirror at `~/.curaye/shared/`:

```
shared/
  decisions/      ← standing architectural decisions (same format as project decisions/)
  patterns/       ← reusable architecture and design patterns
  design/         ← design system docs, component libraries, theming
  agents/         ← CLAUDE.md and AGENTS.md patterns
  stack/          ← default stack definitions by app type
```

Files within `shared/` follow the same protocol standard as project documents. The `domain` field in `current/`-style documents is replaced by `category` in shared context:

```yaml
# shared/design/glass-ui.md
---
id: glass-ui
title: Glass UI Component Library
category: design
source_project: ilmgah        # the project this was promoted from
promoted: 2026-07-21
updated: 2026-07-21
adopted_by: [ilmgah, aiyo]    # projects that have declared adoption
---
```

## Project adoption

A project declares which shared documents it has adopted in its `project.yaml` (registry entry):

```yaml
- id: ilmgah
  name: Ilmgah
  path: /Users/aftalam/Desktop/code/ilmgah
  adopts:
    - shared/design/glass-ui
    - shared/decisions/why-sqlite
    - shared/stack/tauri-react
```

Adoption is informational — it enables propagation notifications and drift detection. It does not copy files or create bindings.

## New project bootstrap integration

When bootstrapping a new project (spec `13`), Curaye reads the shared layer and:

1. Pre-fills `stack.md` from the matching `shared/stack/` document if one is declared.
2. Seeds `decisions/` with any `shared/decisions/` documents the user selects — copied into the project as local decisions with a `source: shared/decisions/why-sqlite` reference.
3. Presents the full shared layer for the user to declare adoption.

## Propagation notifications

When a shared document is updated (via promotion or direct edit), Curaye identifies all projects that have adopted it and surfaces a notification in the desktop app tree panel and CLI output:

```
shared/design/glass-ui updated — adopted by: ilmgah, aiyo
Run `curaye shared diff glass-ui --project ilmgah` to review changes.
```

Notifications are stored as a lightweight log in `~/.curaye/notifications.yaml`. They are cleared once the user has reviewed the diff for the affected project.

## CLI commands

```
curaye shared list [--category decisions|patterns|design|agents|stack]
```
Lists shared documents, optionally filtered by category.

```
curaye shared show <id>
```
Prints a shared document to stdout.

```
curaye shared diff <id> --project <project-id>
```
Shows what changed in a shared document since the project last reviewed it.

```
curaye shared adopt <id> --project <project-id>
```
Declares adoption of a shared document for the given project.

## Desktop integration

The shared layer appears in the desktop app as a top-level section in the projects sidebar, distinct from individual projects. Selecting it shows the shared layer tree. Documents open in the same editor panel as project documents.

A "Propagation" badge on the sidebar shows the count of pending notifications across all adopted shared documents.

## Acceptance criteria

1. `~/.curaye/shared/` is created on first run with empty category subfolders.
2. `curaye shared list` lists all documents in the shared layer grouped by category.
3. Declaring adoption of `shared/decisions/why-sqlite` for a project adds it to that project's `adopts` list in the registry.
4. Updating a shared document that has adopting projects creates a notification entry in `~/.curaye/notifications.yaml`.
5. `curaye shared diff glass-ui --project ilmgah` shows a diff between the shared document and the version last reviewed by ilmgah.
6. A new project bootstrapped with `shared/stack/tauri-react` declared has its `stack.md` pre-filled from that shared document.
7. The desktop sidebar shows a "Shared" section with the full shared layer tree.
8. The propagation badge count reflects unreviewed notifications accurately.
9. Marking a notification as reviewed clears it from `~/.curaye/notifications.yaml`.
10. The shared layer syncs to the sync repo alongside project `.curaye/` content.
