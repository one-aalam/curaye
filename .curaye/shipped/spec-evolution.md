---
id: spec-evolution
title: "Spec Evolution — Capture, Fold-in & Dependency Impact"
shipped: 2026-11-01
release: ""
spec_ref: "spec-evolution"
---

# Spec Evolution — Capture, Fold-in & Dependency Impact

> Shipped on 2026-11-01

## What shipped

Two new CLI skills were added: `apps/cli/skills/curaye-spec.md` and `apps/cli/skills/curaye-capture.md`, each starting with a `<!-- curaye-skill: v0.0.2 -->` version header. The three existing skills `curaye-brief`, `curaye-build`, and `curaye-ship` were updated to understand `requires`/`dependencies` fallback, revision `pins`, the `## Log` section, `inbox/` seeds, `shelved` specs, and stable criteria numbering. The `@curaye/cli` package version was bumped to `0.0.2`; `curaye skill install --list` now reports all eight skills and flags existing installs as out of date. The `.claude/commands/` copies in the repo were updated to match the bundled versions.

## Changes to current/

- `current/cli.md` — updated Skill distribution section to reflect eight skills (was six), updated version to 0.0.2, and added entries for the two new install-time skills.

## Notes

The `revision`, `last_folded`, `pins`, `follows`, and `related` frontmatter fields ride on `.passthrough()` as specified — no TypeScript schema changes were needed in `@curaye/protocol`.
