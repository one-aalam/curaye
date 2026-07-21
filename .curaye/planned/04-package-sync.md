---
id: package-sync
title: "@curaye/sync — Git Sync Layer"
status: building
effort: s
impact: high
desire: high
requires: [package-core]
tags: [sync]
created: 2026-07-21
updated: 2026-07-21
---

# @curaye/sync — Git Sync Layer

> Pushes and pulls `.curaye/` content to a private GitHub repository. The sync repo is the only remote Curaye writes to.

## Problem

Cross-machine continuity requires a shared remote. Git is the right mechanism — developers already understand it, private repos are free on GitHub, and version history comes for free. The sync package encapsulates all git operations so no other package needs to know about `simple-git`.

## Goal

Implement `@curaye/sync`: push/pull of `.curaye/` content to a dedicated private sync repository, sync status reporting, and initial repo setup.

## Non-goals

- Syncing anything outside `.curaye/` folders.
- Conflict resolution UI — surface conflicts as errors, let the user resolve.
- Authentication management — assumes the user's git credentials are configured in the environment.

## Sync repository structure

The sync repo mirrors the project registry, using project `id` as folder names:

```
curaye-sync/                  ← private GitHub repo
  projects.yaml               ← registry metadata (no local paths)
  curaye/                     ← mirrors curaye/.curaye/
    planned/
    current/
    shipped/
    decisions/
    prd.md
    stack.md
    product.md
  ilmgah/                     ← mirrors ilmgah/.curaye/
    ...
```

`projects.yaml` in the sync repo stores project metadata but never local `path` values — those are machine-specific.

## API

```ts
export interface SyncConfig {
  remote:    string   // git remote URL (HTTPS or SSH)
  localRepo: string   // absolute path to the local sync repo clone
}

export type SyncStatus =
  | { state: 'clean' }
  | { state: 'ahead';    commits: number }
  | { state: 'behind';   commits: number }
  | { state: 'diverged'; ahead: number; behind: number }
  | { state: 'no-remote' }

export async function initSyncRepo(config: SyncConfig): Promise<void>
// Clones the remote if localRepo doesn't exist.
// Creates and pushes an empty repo if the remote is empty.

export async function push(projectId: string, curiyePath: string, config: SyncConfig): Promise<void>
// Copies curiyePath contents into localRepo/projectId/,
// commits with message "sync: projectId YYYY-MM-DD HH:MM",
// and pushes to remote.

export async function pull(projectId: string, curiyePath: string, config: SyncConfig): Promise<void>
// Pulls from remote, copies localRepo/projectId/ back to curiyePath.
// Errors on conflict — does not auto-merge.

export async function pullAll(config: SyncConfig): Promise<void>
// Pulls the full sync repo. Used on new machine bootstrap.

export async function status(config: SyncConfig): Promise<SyncStatus>
// Returns the sync state of the local sync repo vs its remote.

export async function syncRegistry(registry: RegistryProject[], config: SyncConfig): Promise<void>
// Writes projects.yaml (sans local paths) to the sync repo and pushes.
```

## Commit message format

```
sync: <projectId> YYYY-MM-DD HH:MM
```

One commit per push call, per project. Bulk syncs (all projects) produce one commit per project in sequence.

## Error handling

```ts
export class SyncConflictError extends Error {
  conflictedFiles: string[]
}
export class SyncAuthError extends Error {}     // git authentication failure
export class SyncNetworkError extends Error {}  // network unreachable
```

All other git errors are wrapped in a generic `SyncError` with the original message attached.

## Acceptance criteria

1. `push` on the Curaye project creates a commit in the local sync repo containing the current `.curaye/` contents under a `curaye/` subfolder.
2. `pull` on a project where the sync repo is ahead of local updates the local `.curaye/` files.
3. `status` returns `clean` when local and remote are at the same commit.
4. `status` returns `ahead` with correct commit count when local has unpushed commits.
5. `push` followed immediately by `push` with no file changes is a no-op (no empty commit created).
6. `projects.yaml` written by `syncRegistry` contains no `path` field for any project.
7. `pull` on a project where both local and remote have changed returns `SyncConflictError` without modifying local files.
8. `initSyncRepo` on a path that already contains a valid clone is a no-op, not an error.
