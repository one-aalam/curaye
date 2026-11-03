---
id: protocol-standard
title: Curaye Protocol Standard
domain: protocol
updated: 2026-11-03
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
  inbox/           ← optional; ideas not yet specced (not scanned)
  previews/        ← optional; approach mockups, previews/<spec-id>/*.html (not scanned)
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

## Spec evolution conventions

These conventions are maintained by the `/curaye-spec`, `/curaye-capture` and `/curaye-preview` skills. They need no schema support: extension fields pass through `.passthrough()` and surface as `Info` validation entries.

**Extension fields on `planned/` documents**

| Field | Meaning |
|---|---|
| `revision` | Contract revision. Bumped when Problem, Goal, Non-goals, feature sections or acceptance criteria change in meaning. Missing means 1. |
| `last_folded` | Date of the last fold-in of log entries. |
| `pins` | Map of upstream id → the upstream `revision` this spec was last reviewed against, e.g. `pins: {sync: 3}`. Keys correspond to `requires` entries, which stay plain ids. |
| `follows` | The shipped spec this one continues. |
| `related` | Soft links to other specs; no impact tracking. |
| `approach_rev` | The `revision` the spec's `## Approach` was approved against. Lower than `revision`, or missing while an `## Approach` exists, means the approach is stale. |

A spec is stale against an upstream when its pin is lower than the upstream's `revision`. Dependents are always computed from `requires`; no reverse field is stored. Older projects may use `dependencies` in place of `requires`; the skills read it as a fallback and rename it on their next edit.

**`## Log` section**

The last section of a planned spec. Append-only, one entry per line: `- YYYY-MM-DD · <type> · <summary>`, ending in `→ unfolded` until a fold-in reviews it. Types: `resource`, `discovery`, `inspiration`, `question`, `decision-candidate`, `upstream`, `origin`, `folded`, `approach`. `origin`, `folded` and `approach` entries never carry `→ unfolded`. The Log is not part of the contract.

**`## Approach` section**

Written by `/curaye-preview` when an approach is approved, between `## Acceptance criteria` and `## Log`. It records how the spec will be built and what it will look like. It is not part of the contract: revising it does not bump `revision` or affect dependents, and the acceptance criteria remain the definition of done. At ship, the shipped document's "Approach vs landed" section compares it with what was built.

**Acceptance criteria numbering**

Criteria are never renumbered. A removed criterion keeps its number as `N. *(removed in rev R — see Log)*`.

**`inbox/`**

One file per idea that belongs to no spec yet, with `id`, `title`, `created` and `source` frontmatter. A seed graduates to `planned/` once it has a Problem and a Goal.

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
