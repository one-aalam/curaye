---
id: single-spec-template
title: One Planned-Spec Template
status: draft
effort: m
impact: high
requires: []
tags: [cli, desktop, protocol]
release: ''
created: 2026-11-03
updated: 2026-11-03
revision: 1
related: [surface-consolidation]
---

# One Planned-Spec Template

## Problem

The planned-spec template is written out six times: `apps/cli/src/commands/new.ts:68`, `ai.ts:76`, `import.ts:549`, `bootstrap.ts:150` and `:226`, and `apps/desktop/src/stores/paletteStore.ts:285`. None of the copies write `revision` or a `## Log` section, so every spec created by the CLI or the desktop starts outside the spec-evolution conventions, and any future format change has to be made six times.

## Goal

Every planned spec created by Curaye — from any command, skill-invoked CLI call or desktop action — comes from one template, and that template follows the current protocol conventions.

## Non-goals

- Changing what the AI is asked to write. Only the frontmatter and section skeleton are shared.
- Migrating existing specs to add `revision` or `## Log`.

## Acceptance criteria

1. One function renders a new planned spec (frontmatter plus section skeleton) from a title, id and optional fields; it lives in a package the CLI can import.
2. `curaye new`, `curaye ai draft`, `curaye import` and `curaye bootstrap` (both paths) use it; no planned-spec frontmatter template remains inline in `apps/cli/src/commands/`.
3. The desktop palette's spec draft uses the same template, through a shared package or a Tauri command that calls it; `paletteStore.ts` no longer contains its own copy.
4. Rendered specs include `revision: 1` and end with `## Log` containing a dated `origin` entry naming the command that created it.
5. Rendered specs pass `PlannedFrontmatterSchema` validation with no errors.
6. `.curaye/conventions.md` gains a Code rule — "Planned specs are created from one template" — with the template function's file as its example.

## Log

- 2026-11-03 · origin · coherence pass audits/2026-11-03.md, finding F1.
