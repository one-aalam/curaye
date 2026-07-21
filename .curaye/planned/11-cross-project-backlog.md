---
id: cross-project-backlog
title: Cross-Project Backlog
status: draft
effort: m
impact: high
desire: high
requires: [desktop-app, shared-layer]
tags: [desktop, ui]
created: 2026-07-21
updated: 2026-07-21
---

# Cross-Project Backlog

> All planned specs from all registered projects in one view. Scored by impact and desire. The obvious build-next candidates surface at the top.

## Problem

A developer managing multiple projects has no aggregated view of what to build next. Each project's `planned/` folder is siloed. Prioritisation across projects — which spec has the highest impact, which one they most want to build — requires mentally holding all projects at once.

## Goal

A cross-project backlog view in the desktop app that aggregates all `planned/` specs (with `status: draft | ready`), surfaces them scored by `impact` and `desire`, and lets the developer decide build order across their entire portfolio.

## Non-goals

- Automatic prioritisation or AI-driven ordering — the scoring is manual, the view is derived.
- Task tracking or time estimates — effort is an existing frontmatter field, not a new concept.
- Integration with external tools (Linear, GitHub Projects) — Curaye is the tool.

## Scoring and the 2×2 view

`impact` and `desire` are frontmatter fields on `planned/` specs (low / medium / high). The 2×2 maps them:

```
          low desire    high desire
          ──────────────────────────
high      │ Build if   │ Build      │
impact    │ strategic  │ next       │
          ├────────────┼────────────┤
low       │ Shelve     │ Build when │
impact    │ or drop    │ bored      │
          └────────────┴────────────┘
```

Specs without `impact` or `desire` set appear in a separate "Unscored" section below the 2×2.

## List view

Alongside the 2×2, a sortable list view of all planned specs:

| Project | Title | Status | Effort | Impact | Desire | Release |
|---|---|---|---|---|---|---|
| ilmgah | Ask the book | ready | l | high | high | — |
| curaye | CLI | draft | l | high | high | v0.1.0 |
| aiyo | Onboarding | draft | m | high | medium | — |

Sortable by any column. Filterable by project, status, effort, impact, desire, and release.

## Status transitions

From the backlog, the developer can change a spec's status without opening the project:

- Inline status chip that cycles: draft → ready → building (click to advance)
- "Shelve" action moves status to `shelved` and removes it from the backlog view
- "Open spec" opens the project in the desktop app with that spec selected

All status changes write directly to the spec's frontmatter file in the project's `.curaye/planned/`.

## CLI equivalent

```
curaye backlog [--status draft|ready] [--sort impact|desire|effort] [--project <id>]
```

Outputs the backlog as a table. `--json` for structured output.

## Acceptance criteria

1. The backlog view aggregates planned specs from all registered projects with status `draft` or `ready`.
2. Specs in the "high impact, high desire" quadrant appear in the top-right of the 2×2.
3. Specs without `impact` or `desire` set appear in the "Unscored" section, not in the 2×2.
4. Clicking a status chip on a spec in the list view writes the new status to that spec's frontmatter file.
5. Shelving a spec from the backlog removes it from the view immediately and updates the file.
6. Filtering by project shows only specs from that project.
7. Sorting by effort orders xs → xl correctly (not alphabetically).
8. "Open spec" navigates the app to the correct project and selects the spec in the tree panel.
9. `curaye backlog --sort impact` outputs specs in impact-descending order.
10. Adding `impact` or `desire` to a previously unscored spec moves it from the "Unscored" section to the correct 2×2 quadrant on next view refresh.
