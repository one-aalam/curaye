---
id: package-protocol
title: "@curaye/protocol — Schema, Parser & Validator"
status: building
effort: m
impact: high
desire: high
requires: [monorepo-scaffold]
tags: [core, protocol]
created: 2026-07-21
updated: 2026-07-21
---

# @curaye/protocol — Schema, Parser & Validator

> The lowest-level package. No `@curaye/*` dependencies. Every other package depends on this one.

## Problem

The protocol standard (spec `00`) defines the rules. This package is the implementation of those rules as executable code — Zod schemas, a frontmatter parser, and a validator that every consumer can import without duplicating logic.

## Goal

Implement the `@curaye/protocol` package: Zod schemas for each document type, frontmatter parsing via `gray-matter`, type exports, a validate function, and a set of pure utility functions. Zero `@curaye/*` dependencies.

## Non-goals

- File system access — reading and writing files is `@curaye/core`'s responsibility.
- Rendering or display logic.
- Any awareness of the project registry or sync state.

## Schemas

One Zod schema per document type. Schemas are the single source of type truth — TypeScript types are derived from them, never written by hand.

```ts
// planned/
export const PlannedFrontmatterSchema = z.object({
  id:       z.string().optional(),
  title:    z.string(),
  status:   z.enum(['draft', 'ready', 'building', 'done', 'shelved']),
  effort:   z.enum(['xs', 's', 'm', 'l', 'xl']),
  impact:   z.enum(['low', 'medium', 'high']).optional(),
  desire:   z.enum(['low', 'medium', 'high']).optional(),
  requires: z.array(z.string()).default([]),
  tags:     z.array(z.string()).default([]),
  release:  z.string().default(''),
  created:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updated:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// current/
export const CurrentFrontmatterSchema = z.object({
  id:      z.string().optional(),
  title:   z.string(),
  domain:  z.string(),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// shipped/
export const ShippedFrontmatterSchema = z.object({
  id:       z.string().optional(),
  title:    z.string(),
  shipped:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  release:  z.string().default(''),
  spec_ref: z.string().default(''),
})

// decisions/
export const DecisionFrontmatterSchema = z.object({
  id:             z.string().optional(),
  title:          z.string(),
  status:         z.enum(['active', 'superseded', 'deprecated']),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  superseded_by:  z.string().default(''),
  tags:           z.array(z.string()).default([]),
})

// root docs (prd.md, stack.md, product.md)
export const RootDocFrontmatterSchema = z.object({
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})
```

Unknown keys are passed through via `.passthrough()` on each schema.

## Document type

A parsed document carries its frontmatter, body, and derived metadata:

```ts
export type DocumentType = 'planned' | 'current' | 'shipped' | 'decisions' | 'root'

export interface ParsedDocument<T = unknown> {
  type:       DocumentType
  id:         string          // derived from filename if absent from frontmatter
  path:       string          // absolute path to the file
  isDraft:    boolean         // true if filename starts with _
  sortOrder:  number | null   // numeric prefix if present
  frontmatter: T
  body:       string          // raw markdown body after frontmatter
  unknownFields: Record<string, unknown>
  validation: ValidationResult
}

export interface ValidationResult {
  valid:    boolean
  errors:   ValidationIssue[]
  warnings: ValidationIssue[]
  infos:    ValidationIssue[]
}

export interface ValidationIssue {
  field:   string
  message: string
}
```

## Exports

```ts
// Schemas
export { PlannedFrontmatterSchema, CurrentFrontmatterSchema,
         ShippedFrontmatterSchema, DecisionFrontmatterSchema,
         RootDocFrontmatterSchema }

// Inferred types
export type { PlannedFrontmatter, CurrentFrontmatter,
              ShippedFrontmatter, DecisionFrontmatter, RootDocFrontmatter }

// Core types
export type { ParsedDocument, ValidationResult, ValidationIssue, DocumentType }

// Functions
export { parse }     // parse(rawContent, type, filePath) → ParsedDocument
export { validate }  // validate(frontmatter, type) → ValidationResult
export { deriveId }  // deriveId(filename) → string — strips numeric prefix + .md
export { isDraft }   // isDraft(filename) → boolean — checks for _ prefix
export { sortOrder } // sortOrder(filename) → number | null
```

## `parse` function

```ts
function parse(rawContent: string, type: DocumentType, filePath: string): ParsedDocument
```

1. Split `rawContent` into frontmatter block and body using `gray-matter`.
2. Run the appropriate Zod schema with `.passthrough()` via `safeParse`.
3. Collect unknown keys into `unknownFields`.
4. Derive `id` from filename if absent in frontmatter.
5. Build `ValidationResult` from Zod issues, classified as errors/warnings/infos per the protocol rules.
6. Return a fully typed `ParsedDocument`.

`parse` never throws. All failures are captured in `ValidationResult`.

## Acceptance criteria

1. `parse` called with valid content for each document type returns `validation.valid === true` with no errors.
2. `parse` called with a missing required field returns `validation.valid === false` with a descriptive error for that field.
3. Unknown frontmatter keys appear in `unknownFields` and do not cause an error.
4. `deriveId('01-monorepo-scaffold.md')` returns `'monorepo-scaffold'`.
5. `deriveId('my-spec.md')` returns `'my-spec'`.
6. `isDraft('_draft-feature.md')` returns `true`; `isDraft('my-spec.md')` returns `false`.
7. `sortOrder('01-monorepo-scaffold.md')` returns `1`; `sortOrder('my-spec.md')` returns `null`.
8. `parse` never throws — calling it with an empty string returns a document with errors, not an exception.
9. TypeScript: consuming code cannot assign a `PlannedFrontmatter` where a `DecisionFrontmatter` is expected.
10. `@curaye/protocol`'s `package.json` has no `@curaye/*` entries in `dependencies`.
