---
id: cli
title: "CLI — Command Surface"
shipped: 2026-07-21
release: ""
spec_ref: "cli"
---

# CLI — Command Surface

> Shipped on 2026-07-21

## What shipped

`@curaye/cli` implements the full Curaye command surface as a Commander-based Node.js CLI distributed via `npx curaye` and GitHub Releases binaries for `darwin-arm64`, `darwin-x64`, `linux-x64`, and `win32-x64`. Commands span four domains: project management (`init`, `link`, `unlink`, `projects`), spec lifecycle (`new`, `list`, `status`, `ship`), sync (`sync`, `sync status`, `sync init`), and AI-assisted actions (`ai status`, `ai draft`, `ai brief`, `ai update-current`). Every command supports `--json` for structured output; errors go to `stderr` with a non-zero exit code. The CLI is a thin layer over `@curaye/core`, `@curaye/sync`, and `@curaye/ai` — no business logic lives in the CLI itself.

## Changes to current/

- `current/cli.md` (created): documents the full command surface, output format conventions, and binary distribution details.
