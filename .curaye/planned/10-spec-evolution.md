---
id: spec-evolution
title: Spec Evolution — Capture, Fold-in & Dependency Impact
status: building
effort: s
impact: high
requires: []
tags: [cli, protocol]
release: ''
created: 2026-11-01
updated: 2026-11-01
revision: 1
---

# Spec Evolution — Capture, Fold-in & Dependency Impact

## Problem

Specs are written once (bootstrap, import) and consumed at the end (build, ship). Nothing handles the long middle: a brainstorm that produces new specs, a discovery that should change an existing spec, a useful link or inspiration found weeks later. These either get lost or force a full rewrite of the spec. When a spec does change, nothing checks the specs that depend on it.

## Goal

Two new skills cover the middle of a spec's life. `/curaye-capture` files a note into the right spec's log, or into an inbox, with one confirmation. `/curaye-spec` turns a session or accumulated notes into new specs and amendments, folds approved changes into the contract with a revision bump, and runs an impact pass on dependent specs. Brief, build and ship read the new structures so nothing captured is lost.

## Non-goals

- Typing the extension fields (`revision`, `last_folded`, `pins`, `follows`, `related`) in `@curaye/protocol` — they ride on `.passthrough()`.
- A `dependencies` → `requires` alias in the schema. Nothing in the TypeScript layer reads `requires` today; the skills handle the fallback.
- A CLI command for capture (`curaye note`). Possible follow-up.
- Desktop UI for the log or the inbox.
- An `enables` reverse field. Dependents are always computed from `requires`.

## Conventions introduced

- **Two speeds of a spec:** the contract (Problem, Goal, Non-goals, feature sections, Acceptance criteria) changes only through a fold-in, which bumps `revision`. The `## Log` section at the end is append-only raw material.
- **Log entries:** `- YYYY-MM-DD · <type> · <summary> → unfolded`, with types `resource`, `discovery`, `inspiration`, `question`, `decision-candidate`, `upstream`, `origin`, `folded`.
- **Revision pins:** `pins: {<upstream id>: <revision>}` beside `requires`, recording which upstream revision a spec was last reviewed against. `requires` stays plain ids.
- **Stable acceptance criteria numbering:** removed criteria keep their number as `N. *(removed in rev R — see Log)*`.
- **Inbox:** `.curaye/inbox/<id>.md` holds ideas not yet specced. The scanner ignores the folder.
- **Shelved specs** are logged on but never amended, and skipped by the impact pass.

## Acceptance criteria

1. `apps/cli/skills/curaye-spec.md` and `apps/cli/skills/curaye-capture.md` exist, each starting with the `<!-- curaye-skill: vX.Y.Z -->` header.
2. The bundled `curaye-brief`, `curaye-build` and `curaye-ship` skills are updated: `requires` with a `dependencies` fallback, `pins`, the `## Log` section, `inbox/`, `shelved`, and stable criteria numbering.
3. `curaye skill install` installs all eight skills, and `--list` reports all eight.
4. Every bundled skill header matches the `@curaye/cli` package version, bumped to `0.0.2`, so `--list` flags existing installs as out of date.
5. The repo's own `.claude/commands/` copies of the five new or changed skills match the bundled versions (minus the version header).
6. `README.md` lists all eight skills and shows `inbox/` in the `.curaye/` layout.
7. `@curaye/cli` typechecks and builds cleanly.

## Log

- 2026-11-01 · origin · Design session in Claude: two-speed specs, capture vs fold-in, inbox, revision pins, impact pass on dependents.
- 2026-11-01 · folded · Created with revision 1. Pins stored as a separate map after checking `PlannedFrontmatterSchema`; `enables` considered and dropped.
