---
id: protocol-standard
title: Curaye Protocol Standard
domain: protocol
updated: 2026-07-21
---

# Curaye Protocol Standard

## Overview

The Curaye Protocol Standard (version 1) defines the canonical format for all `.curaye/` folders. Any conforming tool — CLI, desktop app, or third-party implementation — can parse any conforming project without configuration.

## Folder layout

```
.curaye/
  prd.md           ← required
  stack.md         ← required
  product.md       ← optional
  current/         ← required (may be empty)
  planned/         ← required (may be empty)
  shipped/         ← required (may be empty)
  decisions/       ← optional
```

Parsers surface a warning (not an error) for missing required folders. Absence of `product.md` or `decisions/` is silent.

## File naming

- All files use `.md`. Non-markdown files are silently ignored.
- Filenames use `kebab-case`.
- Optional numeric prefix (`00-`, `01-`, …) controls sort order; the prefix is stripped when deriving the document `id`.
- Files prefixed with `_` are drafts: loaded but excluded from the primary index.
- Subdirectories within the four type folders are allowed. Document type is determined by the top-level ancestor folder (`planned/llm/spec.md` is type `planned`).

## Frontmatter schemas

All documents open with a YAML 1.2 frontmatter block. Unknown keys are preserved and passed through — never an error.

| Document type | Required fields |
|---|---|
| Root (`prd.md`, `stack.md`, `product.md`) | `updated` |
| `planned/` | `id` (or derived), `title`, `status`, `effort`, `created`, `updated` |
| `current/` | `id`, `title`, `domain`, `updated` |
| `shipped/` | `id`, `title`, `shipped` |
| `decisions/` | `id`, `title`, `status`, `date` |

`planned/` status values: `draft | ready | building | done | shelved`

## Validation model

Validation is always non-destructive — documents with errors are still loaded and accessible.

| Severity | Condition |
|---|---|
| Error | Required frontmatter field missing and not derivable |
| Error | Frontmatter block entirely absent |
| Warning | Required body section missing |
| Warning | Date field non-conforming |
| Warning | Enum field value unrecognised |
| Warning | `requires` references a non-existent spec id |
| Info | Unknown frontmatter fields present |
| Info | Draft file (`_` prefix) found |

## Protocol versioning

Current version: **1**. Declared via `.curaye/protocol.yaml` (`version: 1`). When absent, parsers assume version 1. A parser encountering a higher version must refuse to write and surface a clear error.
