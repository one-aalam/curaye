---
id: project-bootstrap
title: "Project Bootstrap — Blank Project Onboarding"
shipped: 2026-07-21
release: ""
spec_ref: "project-bootstrap"
---

# Project Bootstrap — Blank Project Onboarding

> Shipped on 2026-07-21

## What shipped

`curaye bootstrap [path]` is now a fully implemented CLI command. It runs a five-question interactive interview (`@clack/prompts`) covering project description, target user, app type, shared decisions, and first feature; scaffolds `.curaye/` with all required directories and root documents; seeds `stack.md` from `~/.curaye/shared/stack/<type>` when a matching shared document exists; copies selected shared decisions into `decisions/` with a `source` frontmatter field; drafts `prd.md` and the first planned spec via the configured AI provider when available, falling back to structured stubs; and registers the project in `~/.curaye/projects.yaml` automatically. The existing `curaye-bootstrap` Claude Code skill (`.claude/commands/curaye-bootstrap/SKILL.md`) handles the conversational entry point, producing an equivalent `.curaye/` structure by calling `curaye init` and `curaye link` and writing files directly.

## Changes to current/

- `current/cli.md` — `curaye bootstrap` entry updated from stub placeholder to full description of its interview flow, AI involvement, and auto-link behaviour.

## Notes

The shared-decisions multi-select (Q4) silently skips if `~/.curaye/shared/decisions/` is empty or absent — the shared layer spec (10) is not yet shipped. The `--json` flag is rejected with a clear error since bootstrap is an inherently interactive flow.
