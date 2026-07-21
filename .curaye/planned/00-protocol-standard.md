---
id: protocol-standard
title: Curaye Protocol Standard
status: ready
effort: m
impact: high
desire: high
requires: []
tags: [core, protocol]
created: 2026-07-21
updated: 2026-07-21
---

# Curaye Protocol Standard

> The canonical format that all `.curaye/`-managed projects must follow. Any Curaye-compatible tool — CLI, desktop app, or third-party implementation — must implement this spec in full to guarantee consistent parsing, validation, and display across all registered projects.

## Problem

Without an explicit, versioned standard for how `.curaye/` folders are structured and how documents within them are formatted, no tool can reliably parse, validate, or aggregate project knowledge. Inconsistency compounds silently across projects and over time.

## Goal

Define a complete protocol governing the structure of a `.curaye/` folder — folder layout, file naming, frontmatter schemas, document body conventions, and parsing rules — such that any conforming tool can parse any conforming project without configuration.

## Non-goals

- Dictating writing style or prose quality within document bodies.
- Enforcing a particular programming language for the parser implementation.
- Restricting the use of additional files or folders beyond the defined structure — unknown content is ignored, not rejected.

---

## Folder structure

A `.curaye/` folder at the root of a project is the sole structural requirement. Its layout:

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

**Root documents** describe the project at a whole-product level. **Subfolders** contain per-feature or per-area documents. The four subfolders represent the lifecycle of a feature from intention to archived history.

Parsers must not fail on the absence of `product.md` or `decisions/`. They must fail gracefully if `prd.md`, `stack.md`, `current/`, `planned/`, or `shipped/` are absent — surfacing a warning, not an error.

---

## File naming

- All files use the `.md` extension. Non-markdown files are ignored silently.
- Filenames use `kebab-case`.
- Files may carry an optional **numeric prefix** for explicit ordering: `00-protocol-standard.md`, `01-monorepo-scaffold.md`. The prefix is stripped when deriving the document `id` for display.
- Files prefixed with `_` (e.g. `_draft-feature.md`) are considered drafts. Parsers load them but exclude them from the main index. They are surfaced in a separate "drafts" view.
- Subdirectories within `current/`, `planned/`, `shipped/`, or `decisions/` are permitted for grouping. A document's type is determined by its top-level ancestor folder, not its depth. `planned/llm/04-ask-the-book.md` is a `planned` document.

---

## Frontmatter

All documents open with a YAML frontmatter block delimited by `---`. The block is required. An empty block (`---\n---`) is valid for root documents with no metadata beyond `updated`.

Parsers must use a YAML 1.2-compatible parser. Unknown keys are preserved and passed through unchanged — they are never an error.

### Root documents (`prd.md`, `stack.md`, `product.md`)

```yaml
---
updated: YYYY-MM-DD   # required
---
```

No additional required fields. These documents are prose-primary.

### `planned/` documents

```yaml
---
id: kebab-case-string         # required — derived from filename if absent
title: Human-readable title   # required
status: draft                 # required — see Lifecycle States
effort: s                     # required — xs | s | m | l | xl
impact: medium                # optional — low | medium | high
desire: high                  # optional — low | medium | high
requires: []                  # optional — list of spec ids this depends on
tags: []                      # optional — free strings for filtering
release: ""                   # optional — release id this is assigned to
created: YYYY-MM-DD           # required
updated: YYYY-MM-DD           # required
---
```

**Lifecycle states for `status`:**

| Value | Meaning |
|---|---|
| `draft` | Being written; not ready for implementation |
| `ready` | Spec is complete; ready to build |
| `building` | Actively in progress |
| `done` | Implementation complete; pending move to `shipped/` |
| `shelved` | Intentionally deferred; not abandoned |

`done` is a transitional state. Once a spec is confirmed shipped, it moves to `shipped/` and `current/` is updated. The `planned/` file is then removed.

### `current/` documents

```yaml
---
id: kebab-case-string         # required
title: Human-readable title   # required
domain: string                # required — logical area (reader, library, auth…)
updated: YYYY-MM-DD           # required
---
```

`current/` documents describe the system as it exists today. They are living documents — updated when features ship, never when features are merely planned.

### `shipped/` documents

```yaml
---
id: kebab-case-string         # required
title: Human-readable title   # required
shipped: YYYY-MM-DD           # required
release: ""                   # optional — version or release name
spec_ref: planned/id          # optional — id of the originating planned spec
---
```

`shipped/` documents are frozen after creation. They must not be edited except to correct factual errors.

### `decisions/` documents

```yaml
---
id: kebab-case-string         # required
title: Human-readable title   # required
status: active                # required — active | superseded | deprecated
date: YYYY-MM-DD              # required
superseded_by: ""             # optional — id of the superseding decision
tags: []                      # optional
---
```

---

## Document body sections

The body follows the frontmatter block. Section conventions vary by document type. **Required sections must be present; their absence is a validation warning, not a parse error.**

### `planned/` specs

```
# Title                          ← H1, required, matches frontmatter title

> Optional one-liner or          ← blockquote, optional
  inspiration note

## Problem                       ← required
## Goal                          ← required — 1–3 sentences, outcome not solution
## Non-goals                     ← optional, strongly encouraged
## [Feature-specific sections]   ← flexible — name freely (UI, Data model, etc.)
## Acceptance criteria           ← required — numbered, testable statements
```

Acceptance criteria must be a numbered list. Each item must be independently verifiable.

### `current/` documents

```
# Title                          ← H1, required

## Overview                      ← required — 1–3 sentence description of this domain
## [Domain-specific sections]    ← flexible
```

### `decisions/` documents

```
# Decision: Title                ← H1, required, prefixed with "Decision:"

## Context                       ← required — why this decision was needed
## Decision                      ← required — what was decided, stated plainly
## Consequences                  ← required — what this makes easier, harder, or impossible
## Alternatives considered       ← optional
```

### `shipped/` documents

```
# Title                          ← H1, required

> Shipped in [release] on [date] ← blockquote, required

## What shipped                  ← required — summary of what was built
## Changes to current/           ← required if current/ was updated
## Notes                         ← optional
```

### Root documents (`prd.md`, `stack.md`, `product.md`)

Free-form prose. No required section structure beyond an H1.

---

## Parsing rules

These rules govern any conforming parser implementation.

### Scanning

1. The parser scans `.curaye/` recursively.
2. Only `.md` files are processed. All other file types are silently ignored.
3. Document type is determined by the top-level subfolder: `planned/`, `current/`, `shipped/`, `decisions/`. Root-level `.md` files are root documents.
4. Subfolders within the four type folders are traversed. Document type is inherited from the ancestor folder, not the immediate parent.
5. Files prefixed with `_` are collected as drafts and excluded from the primary index.
6. Numeric prefixes on filenames (`00-`, `01-`, `42-`) are stripped when deriving the display `id`. The numeric value is retained for sort order within the folder.
7. Unknown top-level folders are logged and skipped. They are not an error.

### Frontmatter parsing

1. The frontmatter block is delimited by the first `---` on line 1 and the next `---` on its own line.
2. If no frontmatter block is found, the document is loaded with an empty metadata object and a warning is surfaced.
3. The `id` field, if absent from frontmatter, is derived from the filename: strip the numeric prefix and the `.md` extension, resulting in a kebab-case string.
4. All date fields must conform to ISO 8601 (`YYYY-MM-DD`). Non-conforming dates surface a warning; the field is set to `null`.
5. Enum fields (`status`, `effort`, `impact`, `desire`) that contain values outside their defined sets surface a warning; the field is set to `null`.
6. Unknown frontmatter fields are preserved in a `meta.unknown` bag and passed through to consumers. They are never discarded.
7. Arrays default to `[]` when absent. Strings default to `""` when absent. Booleans default to `false` when absent.

### Validation

Validation is always **non-destructive**. A document with validation errors is loaded, displayed, and editable. Errors and warnings are surfaced in the UI as indicators alongside the document — they do not prevent access.

| Severity | Condition |
|---|---|
| Error | Required frontmatter field missing and not derivable |
| Error | Frontmatter block entirely absent |
| Warning | Required body section missing |
| Warning | Date field non-conforming |
| Warning | Enum field value unrecognised |
| Warning | `requires` references a spec `id` that does not exist |
| Info | Unknown frontmatter fields present |
| Info | Draft file (`_` prefix) found |

### Encoding

All `.md` files must be UTF-8. A parser encountering a non-UTF-8 file surfaces an error and skips that file.

---

## Protocol versioning

The protocol is versioned with a single integer. The current version is **1**.

A `.curaye/` folder may carry a root `protocol.yaml` file declaring its version:

```yaml
version: 1
```

If absent, parsers assume version 1. A parser encountering a version it does not support must surface a clear error and refuse to write to that folder, but may read it in a degraded mode.

---

## Acceptance criteria

1. A parser implementation that follows these rules produces identical document indices from identical `.curaye/` folders, regardless of operating system or implementation language.
2. A document with a missing required frontmatter field is loaded and accessible; the missing field is surfaced as an error indicator in the UI.
3. A document with unknown frontmatter fields retains those fields through a full read-write cycle without data loss.
4. Files prefixed with `_` do not appear in the primary index but are accessible via the drafts view.
5. Numeric filename prefixes do not appear in the resolved document `id` but are used for sort ordering within their folder.
6. A document in `planned/llm/04-ask-the-book.md` is typed as `planned`, not as a custom type.
7. A non-markdown file anywhere in `.curaye/` is ignored without error.
8. A `planned/` document with `status: done` that has not yet been moved to `shipped/` appears in the primary index with a visual indicator distinguishing it from `shipped/` documents.
9. Removing an unknown frontmatter field from a document and saving it does not cause the parser to error — the field is simply absent on the next read.
10. A parser encountering a `.curaye/` folder with `protocol.yaml` version > its supported version surfaces an error and does not write to the folder.
