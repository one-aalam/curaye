---
id: sync
title: "@curaye/sync — Git Sync Layer"
domain: sync
updated: 2026-07-21
---

# @curaye/sync — Git Sync Layer

## Overview

`@curaye/sync` encapsulates all git operations for cross-machine continuity. It pushes and pulls `.curaye/` content to a dedicated private sync repository. No other package in the system calls git directly. All operations use `simple-git` — no `child_process` or shell exec.

## Sync repository structure

```
curaye-sync/               ← private GitHub repo
  projects.yaml            ← registry metadata (no local paths)
  curaye/                  ← mirrors curaye/.curaye/
    planned/
    current/
    shipped/
    decisions/
    prd.md
    stack.md
  ilmgah/                  ← mirrors ilmgah/.curaye/
    ...
```

## Configuration

```ts
interface SyncConfig {
  remote:    string   // git remote URL (HTTPS or SSH)
  localRepo: string   // absolute path to the local sync repo clone
}
```

## Functions

```ts
async function initSyncRepo(config: SyncConfig): Promise<void>
```
Clones the remote if `localRepo` doesn't exist. Creates and pushes an empty repo if the remote is empty. No-op if a valid clone already exists.

```ts
async function push(projectId: string, curiyePath: string, config: SyncConfig): Promise<void>
```
Copies `curiyePath` contents into `localRepo/<projectId>/`, commits with message `sync: <projectId> YYYY-MM-DD HH:MM`, and pushes. No-op (no empty commit) when nothing has changed.

```ts
async function pull(projectId: string, curiyePath: string, config: SyncConfig): Promise<void>
```
Pulls from remote, copies `localRepo/<projectId>/` back to `curiyePath`. Throws `SyncConflictError` on divergence — never auto-resolves, never modifies local files on conflict.

```ts
async function pullAll(config: SyncConfig): Promise<void>
```
Pulls the full sync repo. Used on new-machine bootstrap.

```ts
async function status(config: SyncConfig): Promise<SyncStatus>
```
Returns sync state of the local repo vs its remote.

```ts
async function syncRegistry(registry: RegistryProject[], config: SyncConfig): Promise<void>
```
Writes `projects.yaml` (without `path` fields) to the sync repo and pushes.

## `SyncStatus`

```ts
type SyncStatus =
  | { state: 'clean' }
  | { state: 'ahead';    commits: number }
  | { state: 'behind';   commits: number }
  | { state: 'diverged'; ahead: number; behind: number }
  | { state: 'no-remote' }
```

## Error types

```ts
class SyncConflictError extends Error {
  conflictedFiles: string[]
}
class SyncAuthError extends Error {}      // git authentication failure
class SyncNetworkError extends Error {}   // network unreachable
```

All other git errors are wrapped in a generic `SyncError` with the original message attached.
