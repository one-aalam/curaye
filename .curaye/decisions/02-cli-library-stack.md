---
id: cli-library-stack
title: Commander.js + @clack/prompts for the CLI
status: active
date: 2026-07-21
tags: [cli]
---

# Decision: Commander.js + @clack/prompts for the CLI

## Context

The `@curaye/cli` spec (06) requires a command-parsing layer and an interactive prompts layer. Several options were evaluated:

- **Commander.js** — mature, zero-dep command parser. Already referenced in CLAUDE.md as the baseline.
- **@clack/prompts** — lightweight prompt and spinner library by the Astro team. Covers text input, confirm dialogs, and progress spinners.
- **OpenTUI / ink / blessed** — full terminal UI frameworks offering interactive browsing, focus management, and rendered views.
- **inquirer** — heavier prompt library with a larger API surface.

The CLI spec's non-goals explicitly rule out "A TUI or interactive browsing mode — that is the desktop app's role." The interactive needs are scoped: a name prompt in `curaye link`, confirm dialogs in `curaye ship` and `curaye ai draft`, and spinners during git sync and AI streaming.

## Decision

Use **Commander.js** for command definition and argument parsing, and **@clack/prompts** for interactive prompts and spinners. No TUI framework.

## Consequences

- Commander.js handles the full command surface (`curaye init`, `curaye sync`, etc.) with subcommands, flags, and `--help` generation.
- `@clack/prompts` covers all interactive moments cleanly without crossing into TUI territory: `text()`, `confirm()`, `spinner()`.
- The stack is minimal. No runtime coupling to React, a renderer, or a terminal UI abstraction. The binary stays small.
- Full-screen terminal UI (keyboard navigation, panes, focus management) remains out of scope. If that capability is ever needed it belongs in the desktop app, not the CLI.

## Alternatives considered

**ink** — React-for-CLIs. Well-suited for complex interactive UIs but requires a React render loop in the binary and is meaningfully heavier. The non-goal rules it out.

**inquirer** — capable but larger than needed. `@clack/prompts` covers the same use cases with a leaner API and better default aesthetics.

**OpenTUI / blessed** — full TUI frameworks. Explicitly excluded by the CLI spec's non-goals.
