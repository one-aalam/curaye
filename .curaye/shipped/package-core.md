---
id: package-core
title: "@curaye/core — Project Scanner & Registry"
shipped: 2026-07-21
release: ""
spec_ref: "package-core"
---

# @curaye/core — Project Scanner & Registry

> Shipped on 2026-07-21

## What shipped

`@curaye/core` is fully implemented as the file system layer. It exports `scanProject(curiyePath)` which recursively scans a `.curaye/` folder and returns a typed `ProjectIndex` (with `planned`, `current`, `shipped`, `decisions`, `drafts`, and `warnings` arrays), delegating all parsing to `@curaye/protocol`. It exports `readDocument(path, type)` and `writeDocument(path, doc)` — the latter writes atomically via `.tmp` → `fs.rename` to prevent partial writes. The `ProjectRegistry` class manages `~/.curaye/projects.yaml` with static async methods `read`, `add`, `remove`, `update`, `find`, and `curiyePath`. Three typed error classes are exported: `CurayeNotFoundError`, `RegistryError`, and `DocumentWriteError`. All file operations use `fs/promises` exclusively.

## Changes to current/

- `current/core.md` (created): documents the `@curaye/core` package's public API — `scanProject`, `readDocument`, `writeDocument`, `ProjectRegistry`, `ProjectIndex`, and error types.
