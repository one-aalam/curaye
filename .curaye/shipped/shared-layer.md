---
id: shared-layer
title: "Shared Layer — Cross-Project Patterns & Decisions"
shipped: 2026-07-21
release: ""
spec_ref: "shared-layer"
---

# Shared Layer — Cross-Project Patterns & Decisions

> Shipped on 2026-07-21

## What shipped

`SharedLayer` was added to `@curaye/core`: a class with `init()` (creates `~/.curaye/shared/` with five category subfolders), `list(category?)`, `show(id)`, `adopt()` (delegates to `ProjectRegistry`), `diff(docId, projectId)` (LCS line diff against a snapshot in `~/.curaye/shared-reviews/`), `notifyUpdate()`, `listNotifications()`, and `markReviewed()` backed by `~/.curaye/notifications.yaml`. `RegistryProject` gained an `adopts?: string[]` field and `ProjectRegistry` a new `adopt()` method. `@curaye/sync` gained `pushShared` and `pullShared` — they copy `~/.curaye/shared/` into `shared/` in the sync repo, detect changed documents on pull, and fire notifications for adopting projects; both are called automatically by `curaye sync` and `curaye sync --pull`. Six CLI sub-commands were added under `curaye shared`: `init`, `list`, `show`, `adopt`, `diff`, and `notifications`.

## Changes to current/

- `current/core.md` — added `SharedLayer` class documentation, updated `RegistryProject` interface to include `adopts`, added `ProjectRegistry.adopt()`, added `SharedLayerError` to error types.
- `current/sync.md` — added `pushShared` and `pullShared` to functions section; updated sync repo structure to show `shared/` directory.
- `current/cli.md` — added `curaye shared` command group with all six sub-commands.

## Notes

Desktop ACs #7 and #8 (sidebar Shared section and propagation badge) were deferred by user request — no desktop changes in this ship. Notification generation for direct edits (outside of sync pull) requires a file watcher; the current implementation fires notifications only during `pullShared`. `curaye promote` (spec 17) should call `SharedLayer.notifyUpdate()` when it ships.
