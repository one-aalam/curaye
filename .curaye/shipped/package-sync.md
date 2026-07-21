---
id: package-sync
title: "@curaye/sync — Git Sync Layer"
shipped: 2026-07-21
release: ""
spec_ref: "package-sync"
---

# @curaye/sync — Git Sync Layer

> Shipped on 2026-07-21

## What shipped

`@curaye/sync` is fully implemented as the git sync layer. It exports five async functions: `initSyncRepo(config)` (clones or initialises the remote sync repo), `push(projectId, curiyePath, config)` (copies `.curaye/` contents into `localRepo/<projectId>/`, commits with `sync: <projectId> YYYY-MM-DD HH:MM`, and pushes — no-op when nothing changed), `pull(projectId, curiyePath, config)` (pulls and copies back, surfaces `SyncConflictError` on divergence without touching local files), `pullAll(config)` (full repo pull for new-machine bootstrap), and `status(config)` (returns a `SyncStatus` discriminated union: `clean | ahead | behind | diverged | no-remote`). `syncRegistry` writes `projects.yaml` (omitting `path` fields) to the sync repo and pushes. All git operations use `simple-git`. Error classes exported: `SyncConflictError` (with `conflictedFiles`), `SyncAuthError`, `SyncNetworkError`.

## Changes to current/

- `current/sync.md` (created): documents the `@curaye/sync` package's public API — all five functions, `SyncConfig`, `SyncStatus`, sync repo structure, commit format, and error types.
