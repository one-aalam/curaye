---
id: release-planning
title: "Release Planning & Kanban"
shipped: 2026-07-23
release: ""
spec_ref: "release-planning"
---

# Release Planning & Kanban

> Shipped on 2026-07-23

## What shipped

A `.curaye/releases/` folder is now a first-class part of the protocol: `ReleaseFrontmatterSchema` (status enum: `planning | active | shipped`, optional `target` date) was added to `@curaye/protocol`, and `DocumentType` now includes `'releases'`. `@curaye/core` gained a `ReleaseManager` class (create, list, assign spec, mark status) and `scanProject` now returns a `releases` array in `ProjectIndex`. The CLI gained a `release` command group with four subcommands: `new`, `list`, `assign`, and `board` (ASCII kanban to stdout). The Tauri desktop backend gained six new commands (`scan_releases`, `scan_release_specs`, `create_release`, `assign_spec_to_release`, `update_release_status`, `ship_release`), and `scan_project` now includes `releases: Vec<ReleaseSummary>` in `ProjectTree`. The frontend has a new `ReleaseView` kanban component (four status columns, HTML5 drag-and-drop that writes status back to spec frontmatter, Ship Release button), a `releaseStore`, a `releases/` section in `DocumentTree` showing per-release progress bars with shipped releases collapsed by default, and a `'releases'` view mode in `viewStore`.

## Changes to current/

- **`protocol.md`** — Added `ReleaseFrontmatterSchema` to the schemas table; added `'releases'` to the `DocumentType` union.
- **`core.md`** — Added `releases` field to `ProjectIndex`; added `ReleaseManager` class documentation.
- **`cli.md`** — Added `release` command group (`new`, `list`, `assign`, `board`) to the spec lifecycle section.
- **`desktop.md`** — Added six new Tauri commands; added `useReleaseStore` and `'releases'` view mode to stores table; documented `ReleaseView` and `releases/` section in `DocumentTree`; removed "What is not yet built" item for release planning.

## Notes

AC #6 requires "Ship release" to also update `current/` — in the desktop kanban this step is omitted because it requires interactive user input; the CLI `ship` command retains the interactive `current/` prompt. This is consistent with the existing `BacklogView` pattern where `current/` updates are done separately. The `current/` update step is the user's responsibility after clicking "Ship release" in the UI.
