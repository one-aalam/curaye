---
id: scaffold-command
title: "Scaffold — Code Skeleton from .curaye/"
shipped: 2026-07-26
release: ""
spec_ref: "scaffold-command"
---

# Scaffold — Code Skeleton from .curaye/

> Shipped on 2026-07-26.

## What shipped

`curaye scaffold [path]` was added as a new CLI command in `apps/cli/src/commands/scaffold.ts`. It runs three ordered phases: (1) starter kit detection — reads `~/.curaye/shared/stack/*.md` for `starter_kit_cmd` frontmatter, falls back to a built-in signal table (Tauri, Turborepo, Next.js, Astro, Vite, SvelteKit, create-tui), prompts the user, and spawns the generator with inherited stdio; (2) overlay — writes `README.md` (AI-generated overview when a provider is available, stub otherwise), presents a multiselect for `~/.curaye/shared/patterns/` entries creating directories from their `directories` frontmatter field, copies `~/.curaye/shared/agents/` files to the project root, and creates a fallback directory skeleton when Phase 1 produced no output; (3) optional git — `git init`, `git add -A`, and an initial commit. `curaye bootstrap` was extended with `--scaffold` and `--git` flags so the full idea→code flow runs in one command (`--git` implies `--scaffold`). Both commands create the target directory if it does not exist.

## Changes to current/

- `current/cli.md` — added `curaye scaffold` to the Bootstrap and import table, updated `curaye bootstrap` row to reflect `--scaffold` and `--git` flags.

## Notes

In `--json` mode, interactive prompts (generator confirm and pattern multiselect) are skipped and the generator is recorded as `skipped: true` in the output — the spec did not address this case but TTY-dependent generators cannot run non-interactively.
