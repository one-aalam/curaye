---
id: cli
title: CLI — Command Surface
domain: cli
updated: 2026-07-21
---

# CLI — Command Surface

## Overview

`@curaye/cli` is the primary interface to the Curaye system. It exposes all core actions — project registration, spec lifecycle, sync, search, and AI-assisted authoring — as a Commander-based CLI. It is a thin layer over `@curaye/core`, `@curaye/sync`, and `@curaye/ai`; no business logic lives in the CLI itself. Distributed as a standalone binary via `npx curaye` and GitHub Releases.

## Output conventions

- All commands default to human-readable output.
- `--json` flag on any command returns structured JSON (useful in scripts and CI).
- Errors go to `stderr` with a non-zero exit code.
- AI commands check provider availability first and print a clear message if unavailable — they never fail silently.

## Project management

| Command | Description |
|---|---|
| `curaye init [path]` | Scaffolds `.curaye/` with required subfolders and stub root docs. Errors if already exists. |
| `curaye link [path]` | Registers project at `path` in `~/.curaye/projects.yaml`. Infers `id` from directory name. |
| `curaye unlink <id>` | Removes a project from the registry. Does not delete `.curaye/`. |
| `curaye projects` | Lists all registered projects: id, name, path, sync status. |

## Spec lifecycle

| Command | Description |
|---|---|
| `curaye new <title> [--type planned\|decision] [--project <id>]` | Creates a new document with draft frontmatter, opens in `$EDITOR`. |
| `curaye list [--project <id>] [--status <status>] [--tag <tag>]` | Lists planned specs. Columns: id, title, status, effort. |
| `curaye status <spec-id> <new-status> [--project <id>]` | Updates `status` field and sets `updated` to today. |
| `curaye ship <spec-id> [--project <id>] [--release <release>]` | Creates `shipped/` document, prompts to update `current/`, removes planned spec. |

## Sync

| Command | Description |
|---|---|
| `curaye sync [--project <id>] [--all] [--pull\|--push]` | Pushes (default) or pulls `.curaye/` content. `--all` syncs every registered project. |
| `curaye sync status` | Reports ahead/behind/clean state vs remote. |
| `curaye sync init <remote-url>` | One-time setup: clones or initialises the sync repo at `~/.curaye/sync/`. |

## Search

| Command | Description |
|---|---|
| `curaye search <query> [--project <id>] [--type planned\|current\|decisions\|shipped]` | Keyword search across `.curaye/` documents. Searches all registered projects when `--project` is omitted. Falls back to keyword if AI not configured. |

## AI-assisted commands

All AI commands require a configured provider.

| Command | Description |
|---|---|
| `curaye ai status` | Reports which provider is configured and whether it is reachable. |
| `curaye ai draft <title> [--project <id>]` | Streams a drafted planned spec to stdout; prompts to save. |
| `curaye ai brief [--project <id>]` | Streams a re-entry brief from `prd.md`, `stack.md`, `current/`, `planned/`, and `decisions/`. |
| `curaye ai update-current <spec-id> [--project <id>]` | Generates a `current/` update proposal from a shipped spec and opens in `$EDITOR`. |

## Bootstrap and import

| Command | Description |
|---|---|
| `curaye bootstrap [path]` | Runs the project bootstrap flow (spec `13-project-bootstrap`). |
| `curaye promote <file> --to <shared\|decisions\|patterns\|design>` | Promotes a document to the shared layer (spec `17-pattern-promotion`). |

## Binary distribution

Built with `pkgroll` or `esbuild` targeting Node.js. Binaries published to GitHub Releases for:
- `darwin-arm64`, `darwin-x64`
- `linux-x64`
- `win32-x64`

Available via `npx curaye` from the npm registry.
