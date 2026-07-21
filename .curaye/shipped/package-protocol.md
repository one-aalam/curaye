---
id: package-protocol
title: "@curaye/protocol — Schema, Parser & Validator"
shipped: 2026-07-21
release: ""
spec_ref: "package-protocol"
---

# @curaye/protocol — Schema, Parser & Validator

> Shipped on 2026-07-21

## What shipped

`@curaye/protocol` is fully implemented as the lowest-level package in the monorepo with zero `@curaye/*` dependencies. It exports five Zod schemas (`PlannedFrontmatterSchema`, `CurrentFrontmatterSchema`, `ShippedFrontmatterSchema`, `DecisionFrontmatterSchema`, `RootDocFrontmatterSchema`), each with `.passthrough()`, along with their derived TypeScript types. The `parse(rawContent, type, filePath)` function uses `gray-matter` for frontmatter splitting, runs the appropriate schema via `safeParse`, collects unknown keys into `unknownFields`, and returns a fully typed `ParsedDocument` — it never throws. Three pure utility functions are exported: `deriveId()` strips numeric prefixes and `.md` from filenames, `isDraft()` checks for a `_` prefix, and `sortOrder()` extracts the leading numeric prefix or returns `null`.

## Changes to current/

- `current/protocol.md` (created): documents the `@curaye/protocol` package's public API — schemas, types, and functions — as it exists now.

## Notes

No deviations from the spec. All 10 acceptance criteria pass per the implementation in `packages/protocol/src/`.
