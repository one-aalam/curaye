---
id: desktop-app
title: "Desktop App — Foundation, Portfolio View & Spec Editor"
shipped: 2026-07-21
release: ""
spec_ref: "desktop-app"
---

# Desktop App — Foundation, Portfolio View & Spec Editor

> Shipped on 2026-07-21

## What shipped

`@curaye/desktop` is a Tauri v2 + React 19 application with a three-panel resizable layout: a projects sidebar reading `~/.curaye/projects.yaml` via Rust and refreshing sync indicators every 30 seconds; a document tree that scans any selected project's `.curaye/` folder (planned/current/shipped/decisions/root sections with status badges, draft labelling, and red validation-error indicators); and a dual-mode spec editor with structured form controls (segmented controls for status/effort/impact/desire, tag inputs for requires/tags, text inputs for release/created/updated with auto-fill on change) plus a raw textarea that round-trips data losslessly through Tauri serialize/parse commands. The Rust backend in `src-tauri/src/commands/mod.rs` implements atomic file writes, YAML frontmatter parsing, registry CRUD, document scanning, and a `pick_directory` command. The glass-ui design system from ilmgah (saffron/raat/neel/chaadar themes, all `@base-ui/react` primitives) is copied verbatim into `src/components/ui/`. Four Zustand stores manage project, tree, editor, and config state with persisted panel widths.

## Changes to current/

- `current/desktop.md` — created; describes the desktop app as it now exists: Tauri commands, store architecture, UI component boundary, and glass-ui token layer.

## Notes

- `pick_directory` is implemented as a Rust Tauri command via `tauri-plugin-dialog` rather than a JS import; Tauri v2 moved dialog to a plugin with no `@tauri-apps/api/dialog` export.
- `chrono_today()` in Rust computes a rough ISO date from epoch seconds for new-document filenames; the frontend passes the authoritative date for frontmatter values.
- Bundle icons are placeholder 32×32/128×128 RGBA PNGs; proper `.icns`/`.ico` assets belong in a future polish spec.
- `@curaye/ui` (packages/ui) is missing a `tsconfig.json` — pre-existing gap, not introduced here.
