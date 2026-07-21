---
id: core
title: "@curaye/core — Project Scanner & Registry"
domain: core
updated: 2026-07-21
---

# @curaye/core — Project Scanner & Registry

## Overview

`@curaye/core` is the file system layer for the Curaye system. All reading and writing of `.curaye/` folders, and all access to the project registry, goes through this package. It depends on `@curaye/protocol` for parsing; it has no git, AI, or UI dependencies.

## `scanProject`

```ts
async function scanProject(curiyePath: string): Promise<ProjectIndex>
```

Recursively scans a `.curaye/` folder. Returns a `ProjectIndex` with typed arrays for `planned`, `current`, `shipped`, `decisions`, and `drafts`, plus a `warnings` array for non-fatal issues (missing root docs, unreadable files). Documents are sorted by numeric prefix, then alphabetically. Throws `CurayeNotFoundError` only if `curiyePath` does not exist. Never throws for missing documents or validation failures.

```ts
interface ProjectIndex {
  projectId:  string
  curiyePath: string
  root: {
    prd:     ParsedDocument<RootDocFrontmatter> | null
    stack:   ParsedDocument<RootDocFrontmatter> | null
    product: ParsedDocument<RootDocFrontmatter> | null
  }
  planned:   ParsedDocument<PlannedFrontmatter>[]
  current:   ParsedDocument<CurrentFrontmatter>[]
  shipped:   ParsedDocument<ShippedFrontmatter>[]
  decisions: ParsedDocument<DecisionFrontmatter>[]
  drafts:    ParsedDocument[]
  warnings:  ScanWarning[]
}
```

## `readDocument` / `writeDocument`

```ts
async function readDocument(path: string, type: DocumentType): Promise<ParsedDocument>
async function writeDocument(path: string, doc: ParsedDocument): Promise<void>
```

`writeDocument` is atomic: it writes to a `.tmp` file, then renames to the target path — no partial writes. Unknown frontmatter fields are written back in their original position (end of frontmatter block).

## `ProjectRegistry`

Manages `~/.curaye/projects.yaml`. Created automatically on first write.

```ts
class ProjectRegistry {
  static async read(): Promise<RegistryProject[]>
  static async add(project: RegistryProject): Promise<void>
  static async remove(id: string): Promise<void>        // no-op for unknown id
  static async update(id: string, patch: Partial<RegistryProject>): Promise<void>
  static async find(id: string): Promise<RegistryProject | null>
  static async adopt(projectId: string, sharedDocId: string): Promise<void>  // idempotent
  static curiyePath(project: RegistryProject): string   // project.path + '/.curaye'
}

interface RegistryProject {
  id:           string
  name:         string
  path:         string          // absolute local path
  gh?:          string
  sync_remote?: string
  added:        string          // ISO date
  adopts?:      string[]        // shared layer doc refs, e.g. 'shared/decisions/why-sqlite'
}
```

## `SharedLayer`

Manages `~/.curaye/shared/` — the cross-project knowledge store. All five category subfolders (`decisions/`, `patterns/`, `design/`, `agents/`, `stack/`) are created by `init()`.

```ts
class SharedLayer {
  static async init(): Promise<void>
  static async list(category?: SharedCategory): Promise<SharedDocument[]>
  static async show(id: string): Promise<SharedDocument | null>
  static async recordReview(docId: string, projectId: string): Promise<void>
  static async diff(docId: string, projectId: string): Promise<string | null>
  static async notifyUpdate(docId: string, category: SharedCategory, adoptedBy: string[]): Promise<void>
  static async listNotifications(): Promise<SharedNotification[]>
  static async markReviewed(docId: string, projectId: string): Promise<void>
}

interface SharedDocument {
  id:       string
  category: SharedCategory   // 'decisions' | 'patterns' | 'design' | 'agents' | 'stack'
  filePath: string
  title:    string
  raw:      string
}

interface SharedNotification {
  docId:     string
  category:  SharedCategory
  adoptedBy: string[]
  updatedAt: string
}
```

Review snapshots (diff baselines) are stored in `~/.curaye/shared-reviews/<projectId>/<docId>.md`. Notifications are stored in `~/.curaye/notifications.yaml`.

## Error types

```ts
class CurayeNotFoundError extends Error {}   // .curaye/ not found
class RegistryError extends Error {}          // registry read/write failure
class DocumentWriteError extends Error {}     // atomic write failure
class SharedLayerError extends Error {}       // shared layer read/write failure
```
