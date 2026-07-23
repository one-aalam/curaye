---
id: skill-distribution
title: "Claude Code Skill Distribution"
shipped: 2026-07-23
release: ""
spec_ref: "skill-distribution"
---

# Claude Code Skill Distribution

> Shipped on 2026-07-23

## What shipped

Added `curaye skill install` — a new CLI subcommand that bundles all six Curaye Claude Code skills (`curaye-build`, `curaye-ship`, `curaye-brief`, `curaye-bootstrap`, `curaye-import`, `curaye-check`) with `@curaye/cli` and copies them to `~/.claude/commands/` (or any custom `--path`) with one command. Each bundled skill file in `apps/cli/skills/` is prefixed with a `<!-- curaye-skill: vX.Y.Z -->` version header. The `--list` flag parses these headers to report installed vs available versions in a table. The `--update` flag overwrites existing files; without it, existing files are never touched. A `files` field was added to `package.json` ensuring `skills/` ships in the npm package alongside `dist/`.

## Changes to current/

- `current/cli.md` — added a new "Skill distribution" section documenting `curaye skill install [--update] [--list] [--path <dir>]`.

## Notes

The bundled skill files are flat `.md` files (`curaye-build.md`), while the curaye repo's own local skills use the directory format (`curaye-build/SKILL.md`). Both are valid Claude Code slash command formats; flat files were chosen for the distributed bundle because they're simpler to copy as single files.
