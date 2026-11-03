---
id: coherence-pass
title: Coherence Pass — Find Overlap and Drift, Record Conventions
status: draft
effort: l
impact: high
requires: []
tags: [cli, skills, protocol, core]
release: ''
created: 2026-11-03
updated: 2026-11-03
revision: 1
related: [approach-preview]
---

# Coherence Pass — Find Overlap and Drift, Record Conventions

## Problem

Building spec by spec produces drift by design. Each spec's acceptance criteria are local, and no spec owns cross-cutting concerns, so over time a project gains overlapping features, inconsistent UX and UI, and several implementations of the same pattern. `curaye check` doesn't catch this: it compares a project against the shared layer, not against itself.

## Goal

A coherence pass that finds overlap and inconsistency within a project, fixes what is mechanical with approval, turns structural fixes into tracked specs, and leaves behind written conventions that later builds follow.

## Non-goals

- A deterministic `curaye cohere` CLI scan. Tracked as `inbox/cohere-cli-scan`.
- Cross-project consistency. That is `curaye check` plus the shared layer; conventions reach other projects through the existing `curaye promote`.
- Changing code without approval.
- Re-implementing what linters and formatters already enforce.

## What it checks

- **Feature overlap** — capabilities in `shipped/` and `current/` that do the same job through different paths.
- **UX** — one concept under several names, mismatched confirmation patterns, error-message styles, missing `--json` on some commands, inconsistent flag names, empty states.
- **UI** — hardcoded colours where tokens exist, duplicate component variants, spacing and typography outliers.
- **Implementation patterns** — duplicated helpers and templates, code that breaks rules in CLAUDE.md or `conventions.md`.
- **Doc drift** — `current/` documents that no longer match the code.

## Conventions file

`.curaye/conventions.md` is an optional root document, like `product.md`, with `updated` frontmatter. Rules are grouped under `## UI`, `## UX`, `## CLI` and `## Code`. Each rule is one or two lines and names a canonical example file. This location was chosen over a `conventions/` folder or CLAUDE.md on 2026-11-03.

## Acceptance criteria

1. `apps/cli/skills/curaye-cohere.md` exists with the `<!-- curaye-skill: vX.Y.Z -->` header, is registered in `curaye skill install`, and `.claude/commands/curaye-cohere/SKILL.md` matches it minus the header.
2. By default the pass is incremental: it compares specs shipped since the most recent `.curaye/audits/` entry against the rest of the project. `--full` scans everything. With no previous audit, it runs a full scan.
3. Each finding names its category, cites files (and lines where applicable) on every side, and is classified as **mechanical**, **structural**, or **intentional**. No file changes until the user approves the plan.
4. Mechanical fixes are applied as a single batch after the user approves the diff. Structural fixes are written as planned specs following `/curaye-spec` conventions (`revision: 1`, `origin` log entry naming the audit). Intentional overlaps are recorded as decisions and not reported again.
5. The pass proposes additions to `.curaye/conventions.md` and writes approved rules, each with a canonical example path.
6. `@curaye/protocol` and `@curaye/core` treat `conventions.md` as an optional root document: `scanProject()` returns it as `root.conventions`, it is validated with the root document schema, and its absence is silent. `current/protocol-standard.md` documents it.
7. `/curaye-build` reads `conventions.md` alongside CLAUDE.md in its CLAUDE.md step. `/curaye-brief` reports "N specs shipped since the last coherence pass" when N is 5 or more.
8. Each run is saved as `.curaye/audits/YYYY-MM-DD.md` with `generated` and `scope` (`incremental` or `full`) frontmatter, the findings, and the actions taken. `scanProject()` ignores `audits/`.
9. A full run on the curaye repo reports the duplicated planned-spec templates as a structural finding.
10. All changed packages typecheck and build cleanly, with skill headers and `@curaye/cli` bumped.

## Log

- 2026-11-03 · origin · Design session in Claude (3 Nov): overlap and drift detection within a project, conventions as the lasting output.
- 2026-11-03 · discovery · The planned-spec template is written out separately in `apps/cli/src/commands/new.ts`, `ai.ts`, `import.ts`, `bootstrap.ts` (twice) and `apps/desktop/src/stores/paletteStore.ts`; none include `revision` or `## Log`. The first run should catch this (AC9). → unfolded
