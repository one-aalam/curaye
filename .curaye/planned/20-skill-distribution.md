---
id: skill-distribution
title: Claude Code Skill Distribution
status: ready
effort: s
impact: high
desire: high
requires: [cli]
tags: [cli, agents]
created: 2026-07-21
updated: 2026-07-21
---

# Claude Code Skill Distribution

> Skills are bundled with the CLI and installed to `~/.claude/commands/` with one command. Any Claude Code session on any machine gets the full Curaye skill set after a one-time setup.

## Problem

Curaye's Claude Code skills live in `.claude/commands/` inside the curaye repo — useful for developing curaye itself, but inaccessible to any other project. Every project that wants to use `/curaye-build` or `/curaye-ship` would need to copy skill files manually, with no mechanism for updates.

## Goal

Bundle all Curaye Claude Code skills with `@curaye/cli` and provide `curaye skill install` to copy them to `~/.claude/commands/`, making them globally available in every Claude Code session on the machine.

## Non-goals

- A plugin system or skill marketplace — this is a simple, versioned file distribution.
- Automatic updates on CLI upgrade — the user runs `curaye skill install --update` explicitly.
- Skills that require a Curaye daemon or background process.

## Responsibility split

Skills and the CLI have distinct, non-overlapping responsibilities:

| CLI | Skills |
|---|---|
| Mechanical, deterministic operations | Intelligent, reasoning-heavy operations |
| File moves, frontmatter writes, registry edits | Understanding what changed, writing `current/` |
| Git operations, index building, validation | Conversational interview flows |
| Scriptable, works in CI | Requires an active Claude Code session |

Skills call the CLI for mechanical operations. The CLI does not replicate skill logic. There is no redundancy — each layer does what only it can do.

## Bundled skills

The CLI package ships a `skills/` directory alongside `dist/`:

```
@curaye/cli
  dist/
  skills/
    curaye-build.md      ← implement a spec to acceptance criteria
    curaye-ship.md       ← graduate a spec; CLI does file ops, skill does current/
    curaye-brief.md      ← re-entry brief synthesised from .curaye/
    curaye-bootstrap.md  ← new project interview + scaffold + seed from shared
    curaye-import.md     ← brownfield import with LLM-enhanced current/ docs
    curaye-check.md      ← drift detection with interpretation and resolution
```

## Install command

```
curaye skill install [--update] [--list] [--path <dir>]
```

Default target: `~/.claude/commands/`

- **`--update`** — overwrites existing skill files with the current CLI version's copies. Without this flag, existing files are never overwritten.
- **`--list`** — shows installed skills, their version, and whether they are current.
- **`--path <dir>`** — install to a custom directory. Used for project-scoped installs (e.g. `.claude/commands/` in a specific project).

Output:

```
Installed 6 skills to ~/.claude/commands/

  /curaye-build      Build a spec to acceptance criteria
  /curaye-ship       Graduate a completed spec
  /curaye-brief      Generate a re-entry brief
  /curaye-bootstrap  Bootstrap a new project
  /curaye-import     Import an existing project
  /curaye-check      Detect and resolve shared layer drift
```

## Version tracking

Each skill file begins with a version comment on the first line:

```markdown
<!-- curaye-skill: v0.2.0 -->
```

`curaye skill install --list` reads these to report installed vs available version:

```
Skill                  Installed    Available
─────────────────────────────────────────────
curaye-build           v0.1.0       v0.2.0  ← update available
curaye-ship            v0.2.0       v0.2.0  ✓
curaye-brief           v0.2.0       v0.2.0  ✓
curaye-bootstrap       —            v0.2.0  (not installed)
curaye-import          v0.2.0       v0.2.0  ✓
curaye-check           v0.2.0       v0.2.0  ✓
```

## Project-scoped install

A project can install skills locally without affecting the global `~/.claude/commands/`:

```bash
curaye skill install --path .claude/commands/
```

This is how the curaye repo itself works — its own skills are installed locally for curaye's development workflow, and the global install serves all other managed projects.

## Acceptance criteria

1. `curaye skill install` copies all 6 skill files to `~/.claude/commands/` and prints the install summary.
2. Running `curaye skill install` a second time without `--update` leaves existing files unchanged and prints "Already installed. Use --update to upgrade."
3. `curaye skill install --update` overwrites all skill files with the current CLI version's copies.
4. `curaye skill install --list` shows each skill's installed version vs available version.
5. After install, `/curaye-build` is available as a slash command in any Claude Code session on the machine.
6. `curaye skill install --path .claude/commands/` installs to the project-local directory and does not touch `~/.claude/commands/`.
7. The `skills/` directory is included in the published npm package — `npm pack` output includes skill files.
8. Each skill file begins with `<!-- curaye-skill: vX.Y.Z -->` matching the CLI package version.
9. Installing on a machine with no `~/.claude/` directory creates it before writing skills.
10. `curaye skill install --update` followed immediately by `curaye skill install --list` shows all skills as current.
