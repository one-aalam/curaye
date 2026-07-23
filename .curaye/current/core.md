---
id: core
title: "@curaye/core — Project Scanner & Registry"
domain: core
updated: 2026-07-23
---

# @curaye/core — Project Scanner & Registry

## Overview

`@curaye/core` is the file system layer for the Curaye system. All reading and writing of `.curaye/` folders, and all access to the project registry, goes through this package. It depends on `@curaye/protocol` for parsing; it has no git, AI, or UI dependencies.

## `scanProject`

```ts
async function scanProject(curiyePath: string): Promise<ProjectIndex>
```

Recursively scans a `.curaye/` folder. Returns a `ProjectIndex` with typed arrays for `planned`, `current`, `shipped`, `decisions`, `releases`, and `drafts`, plus a `warnings` array for non-fatal issues (missing root docs, unreadable files). Documents are sorted by numeric prefix, then alphabetically. Throws `CurayeNotFoundError` only if `curiyePath` does not exist. Never throws for missing documents or validation failures.

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
  releases:  ParsedDocument<ReleaseFrontmatter>[]
  drafts:    ParsedDocument[]
  warnings:  ScanWarning[]
}
```

A missing `.curaye/releases/` folder produces an empty array and a non-fatal warning — never an error.

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
  agent_files?: AgentFile[]     // tracked agent steering files; populated by trackAgentChanges
}

interface AgentFile {
  path:            string   // relative to project root (e.g. 'CLAUDE.md', '.claude/CLAUDE.md')
  last_seen_hash:  string   // 'sha256:<hex>'
  last_changed:    string   // ISO date of last detected change
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
  static async promote(input: PromoteInput): Promise<PromoteResult>
  static async markPromotedSource(sourcePath: string, docRef: string): Promise<void>
}

interface PromoteInput {
  sourcePath:    string          // absolute path to the source document
  sourceSection: string          // detected folder name ('current', 'decisions', etc.)
  category:      SharedCategory  // destination category in shared layer
  id:            string          // id for the shared document (defaults to source filename)
  projectId:     string          // originating project's id or name
  content:       string          // document content to write (may be AI-rewritten)
}

interface PromoteResult {
  sharedPath: string             // absolute path of the written shared document
  docRef:     string             // e.g. 'shared/decisions/why-sqlite'
  isUpdate:   boolean            // true when the shared document already existed
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

`promote()` elevates a project document to the shared layer: it preserves original frontmatter, injects `source_project`, `promoted`, and `adopted_by` fields, writes the result atomically to `~/.curaye/shared/<category>/<id>.md`, and fires `notifyUpdate()` for all other registered projects. Running `promote()` on a document that already has a shared counterpart updates it in place (`isUpdate: true`) — never creates a duplicate. `planned/` documents are rejected with `SharedLayerError`. `markPromotedSource()` adds `promoted_to: <docRef>` to the source document's frontmatter atomically.

## Agent file tracking

Detects and tracks `CLAUDE.md`, `AGENTS.md`, `*AGENTS*.md` files at the project root, and `CLAUDE.md` up to two directory levels deep (e.g. `.claude/CLAUDE.md`). Changes are recorded as dated Markdown files in `.curaye/agent-log/`.

```ts
// Scan the project directory for agent steering files. Returns a Map<relativePath, sha256Hash>.
async function detectAgentFiles(projectPath: string): Promise<Map<string, string>>

// Compare detected files against registry, write log entries for changes, update registry.
// generateSummary is optional — called at the CLI layer when an AI provider is configured.
async function trackAgentChanges(
  project: RegistryProject,
  projectPath: string,
  curiyePath: string,
  today: string,
  generateSummary?: (filePath: string, changeType: AgentChangeType, prevHash: string | null, currHash: string | null) => Promise<string>,
): Promise<AgentChange[]>

// Write a single dated log entry atomically to .curaye/agent-log/YYYY-MM-DD-{basename}.md.
async function writeAgentLogEntry(
  curiyePath: string,
  entry: AgentLogEntry,
  date: string,
  body?: string,
): Promise<string>

// Read all agent log entries, optionally filtered to entries on or after `since` (YYYY-MM-DD).
async function readAgentLog(
  curiyePath: string,
  since?: string,
): Promise<Array<{ entry: AgentLogEntry; body: string; filename: string }>>

type AgentChangeType = 'created' | 'modified' | 'deleted'

interface AgentLogEntry {
  date:          string
  file:          string
  change_type:   AgentChangeType
  previous_hash: string | null
  current_hash:  string | null
}

interface AgentChange {
  entry:       AgentLogEntry
  logFilePath: string
}
```

Log files are named `YYYY-MM-DD-{basename}.md` — one file per (date, agent file) pair. Frontmatter holds structured metadata; body holds the optional AI-generated summary.

## `ReleaseManager`

Manages `.curaye/releases/` documents. All writes are atomic (`.tmp` → rename).

```ts
class ReleaseManager {
  static async list(curiyePath: string): Promise<ReleaseSummary[]>
  static async create(curiyePath: string, name: string, today: string, target?: string): Promise<ReleaseSummary>
  static async assign(specPath: string, releaseId: string, today: string): Promise<void>
  static async markReleaseStatus(releasePath: string, status: string, today: string): Promise<void>
}

interface ReleaseSummary {
  id:     string
  title:  string
  status: string          // 'planning' | 'active' | 'shipped'
  target: string | null   // ISO date or null
  path:   string
  total:  number          // non-shelved planned specs assigned to this release
  done:   number          // planned specs with status: 'done' in this release
}
```

`create()` converts the `name` argument to a slug (`v0.3.0` → `v0-3-0`) for the filename. The `list()` method cross-references `planned/` to compute `total` and `done` counts per release.

## `DriftDetector`

Compares a project's adopted shared documents against its local content to surface undocumented divergence. Ignores are persisted to `~/.curaye/drift-ignores.yaml`; cleared automatically when the project syncs.

```ts
class DriftDetector {
  static async checkProject(project: RegistryProject): Promise<DriftReport>
  static async checkAll(): Promise<DriftReport[]>
  static async addIgnore(projectId: string, docId: string): Promise<void>
  static async clearIgnores(projectId: string): Promise<void>
  static async countDrift(project: RegistryProject): Promise<number>
}

type DriftClassification = 'drift' | 'intentional-override' | 'pending-update' | 'no-drift'

interface DriftFinding {
  sharedDocId:    string
  docRef:         string               // e.g. 'shared/decisions/why-sqlite'
  classification: DriftClassification
  description:    string
  hint?:          string
}

interface DriftReport {
  projectId:    string
  projectPath:  string
  checkedCount: number                 // number of adopted docs checked
  findings:     DriftFinding[]         // only non-'no-drift' findings included
}
```

**Detection algorithm** (no AI required):

1. For each doc ref in `project.adopts`, ignore entries present in `~/.curaye/drift-ignores.yaml` for this project.
2. Check `SharedLayer.diff(docId, projectId)`: non-empty diff → `pending-update`.
3. Scan `decisions/` for any file with `superseded_by: <docRef>` frontmatter → `intentional-override` (not drift).
4. Run `computeTermDrift`: extract key technology terms from the shared doc body (alphanumeric tokens >2 chars, excluding common English words) and check their presence in local `stack.md`, `decisions/`, and `current/` content. Significant missing terms → `drift`.

`countDrift()` returns only `drift`-classified finding count (not `pending-update`), for use as a badge threshold. `clearIgnores()` is called by `curaye sync` after each successful push or pull.

## Error types

```ts
class CurayeNotFoundError extends Error {}   // .curaye/ not found
class RegistryError extends Error {}          // registry read/write failure
class DocumentWriteError extends Error {}     // atomic write failure
class SharedLayerError extends Error {}       // shared layer read/write failure
```
