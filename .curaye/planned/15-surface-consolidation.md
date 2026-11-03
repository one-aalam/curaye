---
id: surface-consolidation
title: One Owner per Job Across CLI, Skills and Desktop
status: draft
effort: m
impact: medium
requires: []
tags: [cli, desktop]
release: ''
created: 2026-11-03
updated: 2026-11-03
revision: 1
related: [single-spec-template, desktop-core-parity]
---

# One Owner per Job Across CLI, Skills and Desktop

## Problem

Two jobs are implemented on three surfaces each. Spec drafting: `curaye new`, `curaye ai draft`, bootstrap's AI drafting, the desktop palette, and `/curaye-spec`. Briefs: `curaye brief` (`apps/cli/src/commands/brief.ts`), the desktop's `briefStore.ts`, and `/curaye-brief`. `prd.md` sanctions two channels (the deterministic CLI and the conversational skills); the desktop is a third copy with its own prompts and output. The three briefs can describe the same project differently.

## Goal

Each job has one owner per channel, and the desktop presents what an owner produces instead of re-implementing it. A user gets the same brief and the same kind of spec draft whichever surface they start from.

## Non-goals

- Removing the CLI/skill split that `prd.md` describes.
- Removing desktop features; the desktop keeps the actions, not its own implementations of them.
- The spec template itself (`single-spec-template`).

## Acceptance criteria

1. A decision names the owner of spec drafting and of brief generation for each channel, and what the desktop does for each (call the CLI, show a saved brief, hand off to a skill).
2. The desktop's brief comes from the chosen owner; `briefStore.ts` no longer builds its own brief prompt.
3. The desktop palette's spec drafting goes through the chosen owner.
4. For the same project, the CLI brief and the desktop brief have the same sections in the same order.
5. `.curaye/conventions.md` gains a rule stating which surface owns each job.

## Log

- 2026-11-03 · origin · coherence pass audits/2026-11-03.md, finding F6. Judged not intentional: planned as a spec rather than a decision.
