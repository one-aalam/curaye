---
id: protocol
title: "@curaye/protocol — Schema, Parser & Validator"
domain: protocol
updated: 2026-11-05
---

# @curaye/protocol — Schema, Parser & Validator

## Overview

`@curaye/protocol` is the lowest-level package in the Curaye monorepo. It has zero `@curaye/*` dependencies. Every other package that needs to parse or validate `.curaye/` documents imports from here.

## Schemas

Six Zod schemas cover every document type. All use `.passthrough()` so unknown frontmatter fields are preserved rather than rejected.

| Schema | Document type |
|---|---|
| `PlannedFrontmatterSchema` | `.curaye/planned/*.md` |
| `CurrentFrontmatterSchema` | `.curaye/current/*.md` |
| `ShippedFrontmatterSchema` | `.curaye/shipped/*.md` |
| `DecisionFrontmatterSchema` | `.curaye/decisions/*.md` |
| `RootDocFrontmatterSchema` | `.curaye/prd.md`, `stack.md`, `product.md` |
| `ReleaseFrontmatterSchema` | `.curaye/releases/*.md` |

`ReleaseFrontmatterSchema` requires `id` (optional), `title`, `status` (`'planning' | 'active' | 'shipped'`), optional `target` (ISO date), `created`, and `updated`.

TypeScript types (`PlannedFrontmatter`, `CurrentFrontmatter`, `ReleaseFrontmatter`, etc.) are derived from these schemas via `z.infer` — never written by hand.

## Core types

```ts
type DocumentType = 'planned' | 'current' | 'shipped' | 'decisions' | 'root' | 'releases'

interface ParsedDocument<T = unknown> {
  type:          DocumentType
  id:            string
  path:          string
  isDraft:       boolean
  sortOrder:     number | null
  frontmatter:   T
  body:          string
  unknownFields: Record<string, unknown>
  validation:    ValidationResult
}

interface ValidationResult {
  valid:    boolean
  errors:   ValidationIssue[]
  warnings: ValidationIssue[]
  infos:    ValidationIssue[]
}

interface ValidationIssue {
  field:   string
  message: string
}
```

## Functions

### `parse(rawContent, type, filePath) → ParsedDocument`

Splits raw markdown using `gray-matter`, runs the appropriate schema via `safeParse`, collects unknown keys into `unknownFields`, and returns a fully populated `ParsedDocument`. Never throws — all failures appear in `validation.errors`.

### `validate(frontmatter, type) → ValidationResult`

Runs just the schema check against an already-parsed frontmatter object. Useful for re-validating after programmatic mutation.

### `deriveId(filename) → string`

Strips a leading numeric prefix (`01-`) and the `.md` extension. `'01-monorepo-scaffold.md'` → `'monorepo-scaffold'`.

### `isDraft(filename) → boolean`

Returns `true` if the filename starts with `_`.

### `sortOrder(filename) → number | null`

Returns the leading numeric prefix as a number, or `null` if none is present.

### `renderPlannedSpec(opts: RenderPlannedSpecOptions) → string`

Creates a new planned spec document as a complete markdown string. Accepts `id`, `title`, `source` (the originating command name), an optional `today` (YYYY-MM-DD, defaults to system date), and optional frontmatter fields (`effort`, `impact`, `desire`, `requires`, `tags`, `confidence`, `release`). The returned string includes `revision: 1` and a `## Log` section with a dated `origin` entry naming `source`. Passes `PlannedFrontmatterSchema` validation with no errors.

```ts
interface RenderPlannedSpecOptions {
  id: string
  title: string
  source: string
  today?: string
  effort?: 'xs' | 's' | 'm' | 'l' | 'xl'
  impact?: 'low' | 'medium' | 'high'
  desire?: 'low' | 'medium' | 'high'
  requires?: string[]
  tags?: string[]
  confidence?: string
  release?: string
}
```

This is the canonical way to create a new planned spec anywhere in the codebase — CLI commands and the desktop store all call it. AI prompt callers strip the `## Log` section from the output before sending the skeleton to the model.

## Public entry point

All exports are from `packages/protocol/src/index.ts`. Internal files (`schemas.ts`, `types.ts`, `functions.ts`, `template.ts`) must not be imported directly by other packages.
