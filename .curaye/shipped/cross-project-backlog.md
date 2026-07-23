---
id: cross-project-backlog
title: "Cross-Project Backlog"
shipped: 2026-07-23
release: ""
spec_ref: "cross-project-backlog"
---

# Cross-Project Backlog

> Shipped on 2026-07-23.

## What shipped

Two new Tauri commands — `scan_backlog` (reads all registered projects and returns `planned/` specs with `status: draft | ready` as `Vec<BacklogSpec>`) and `update_spec_status` (atomically patches `status` and `updated` in a spec's frontmatter) — were added to `src-tauri/src/commands/mod.rs` and registered in `lib.rs`. On the frontend, `viewStore.ts` holds a `'main' | 'backlog'` toggle; `backlogStore.ts` manages aggregated spec data with full filter and sort state plus `updateStatus`, `shelveSpec`, and `openSpec` actions. `BacklogView.tsx` renders as a fixed full-screen overlay: a left panel shows a 2×2 impact/desire matrix (high-impact/high-desire = "Build next" quadrant, highlighted) with an Unscored section below; the right panel is a sortable, filterable list with inline status chips that cycle `draft → ready → building` on click, per-row action menus (Open spec / Shelve), and dropdowns for project, status, effort, impact, and desire filters. "Open spec" switches back to the main view and navigates to the correct project and document. A "Backlog" toggle button was added to the `ProjectsSidebar` footer. The CLI gained a `curaye backlog` command with `--status`, `--sort` (impact/desire/effort with correct xs→xl effort ordering), `--project`, and `--json` flags.

## Changes to current/

- `current/desktop.md` — added `scan_backlog`, `update_spec_status` to the Tauri command table; added `viewStore` and `backlogStore` to the stores table; added `BacklogView` to the components section; removed the "not yet built" entry for cross-project backlog.
- `current/cli.md` — added `curaye backlog` to the spec lifecycle section.

## Notes

The status chip cycles through all three active statuses (`draft → ready → building → draft`) rather than stopping at `building`, so the user can reset a spec that was incorrectly advanced without leaving the backlog view.
