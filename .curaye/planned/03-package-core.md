---
id: package-core
title: "@curaye/core — Project Scanner & Registry"
status: ready
effort: m
impact: high
desire: high
requires: [package-protocol]
tags: [core]
created: 2026-07-21
updated: 2026-07-21
---

# @curaye/core — Project Scanner & Registry

> The file system layer. Reads and writes `.curaye/` folders and manages the project registry. No UI, no AI, no git — those are other packages.

## Problem

Every consumer — CLI, desktop, web — needs to scan `.curaye/` folders, read and write documents, and know which projects are registered. Without a shared implementation, this logic gets duplicated and diverges.

## Goal

Implement `@curaye/core`: a project scanner, a document reader/writer, and a project registry. All file system access in the Curaye system goes through this package.

## Non-goals

- Frontmatter parsing and schema validation — delegated to `@curaye/protocol`.
- Git operations — delegated to `@curaye/sync`.
- AI provider communication — delegated to `@curaye/ai`.

## Project index

The result of scanning a `.curaye/` folder:

```ts
export interface ProjectIndex {
  projectId:  string
  curiyePath: string   // absolute path to .curaye/
  root: {
    prd:     ParsedDocument<RootDocFrontmatter> | null
    stack:   ParsedDocument<RootDocFrontmatter> | null
    product: ParsedDocument<RootDocFrontmatter> | null
  }
  planned:   ParsedDocument<PlannedFrontmatter>[]
  current:   ParsedDocument<CurrentFrontmatter>[]
  shipped:   ParsedDocument<ShippedFrontmatter>[]
  decisions: ParsedDocument<DecisionFrontmatter>[]
  drafts:    ParsedDocument[]       // _ prefixed files, all types
  warnings:  ScanWarning[]
}

export interface ScanWarning {
  path:    string
  message: string
}
```

## `scanProject`

```ts
export async function scanProject(curiyePath: string): Promise<ProjectIndex>
```

1. Verify `curiyePath` exists and is a directory. If not, throw `CurayeNotFoundError`.
2. Read root documents (`prd.md`, `stack.md`, `product.md`). Missing root docs surface as warnings, not errors.
3. Recursively scan each of the four typed folders. Delegate parsing to `@curaye/protocol`'s `parse`.
4. Sort documents within each folder by `sortOrder` (numeric prefix), then alphabetically.
5. Separate draft files into `drafts`.
6. Return the `ProjectIndex`.

Never throws for missing documents or validation failures — those become `ScanWarning` entries or `ValidationResult` on the document itself.

## `readDocument` / `writeDocument`

```ts
export async function readDocument(path: string, type: DocumentType): Promise<ParsedDocument>

export async function writeDocument(path: string, doc: ParsedDocument): Promise<void>
```

`writeDocument` serialises frontmatter back to YAML and prepends it to the body. Unknown fields are written back in their original position (end of frontmatter block). The file is written atomically: write to a `.tmp` file, then rename — no partial writes.

## Project registry

The registry lives at `~/.curaye/projects.yaml`. It is the only file Curaye writes outside of `.curaye/` folders.

```yaml
version: 1
projects:
  - id: curaye
    name: Curaye
    path: /Users/aftalam/Desktop/code/curaye
    gh: https://github.com/aftalam/curaye
    sync_remote: git@github.com:aftalam/curaye-sync.git
    added: 2026-07-21
```

```ts
export interface RegistryProject {
  id:           string
  name:         string
  path:         string          // absolute local path to project root
  gh?:          string          // GitHub URL (optional)
  sync_remote?: string          // git remote for sync repo (optional)
  added:        string          // ISO date
}

export class ProjectRegistry {
  static async read(): Promise<RegistryProject[]>
  static async add(project: RegistryProject): Promise<void>
  static async remove(id: string): Promise<void>
  static async update(id: string, patch: Partial<RegistryProject>): Promise<void>
  static async find(id: string): Promise<RegistryProject | null>
  static curiyePath(project: RegistryProject): string  // project.path + '/.curaye'
}
```

The registry file is created automatically on first write if it does not exist.

## Error types

```ts
export class CurayeNotFoundError extends Error {}   // .curaye/ not found at path
export class RegistryError extends Error {}          // registry read/write failure
export class DocumentWriteError extends Error {}     // atomic write failure
```

## Acceptance criteria

1. `scanProject` on the Curaye repo's own `.curaye/` returns a `ProjectIndex` with `planned` length ≥ 2 and no `CurayeNotFoundError`.
2. `scanProject` on a path with no `.curaye/` throws `CurayeNotFoundError`.
3. A valid document with one unknown frontmatter field round-trips through `readDocument` → `writeDocument` → `readDocument` with the unknown field preserved.
4. `writeDocument` writes atomically — a crash mid-write leaves either the old file or the new file, never a partial file.
5. Documents in `planned/` are sorted by numeric prefix first, then alphabetically when no prefix is present.
6. Files prefixed with `_` appear in `ProjectIndex.drafts`, not in `planned`, `current`, `shipped`, or `decisions`.
7. `ProjectRegistry.add` creates `~/.curaye/projects.yaml` if it does not exist.
8. `ProjectRegistry.remove` on a non-existent id is a no-op, not an error.
9. `scanProject` on a `.curaye/` folder with a missing `prd.md` returns a `ProjectIndex` with `root.prd === null` and a `ScanWarning`, not a thrown error.
10. Calling `scanProject` twice on the same path returns structurally identical results (no mutable shared state).
