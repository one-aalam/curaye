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

## Shared layer

| Command | Description |
|---|---|
| `curaye shared init` | Creates `~/.curaye/shared/` with all five category subfolders. Idempotent. |
| `curaye shared list [--category <cat>]` | Lists all shared documents grouped by category. `--category` filters to one of: `decisions`, `patterns`, `design`, `agents`, `stack`. |
| `curaye shared show <id>` | Prints a shared document to stdout. |
| `curaye shared adopt <id> [--project <id>]` | Declares adoption of a shared document for the given project; records the current state as the diff baseline; infers project from cwd when `--project` is omitted. |
| `curaye shared diff <id> [--project <id>]` | Shows what changed in a shared document since the project last reviewed it (LCS line diff). Errors if no baseline exists — run `adopt` first. |
| `curaye shared notifications [--mark-reviewed <docId> --project <id>]` | Lists pending update notifications. `--mark-reviewed` clears the notification for the given doc/project pair and updates the review snapshot. |

## Bootstrap and import

| Command | Description |
|---|---|
| `curaye bootstrap [path]` | Runs the project bootstrap interview and scaffolds `.curaye/`. Asks 5 questions (description, target user, app type, shared decisions, first feature), drafts `prd.md` and first planned spec via AI if configured, seeds `stack.md` from shared layer, copies selected shared decisions with `source` field, and auto-registers the project. Errors cleanly if `.curaye/` already exists. |
| `curaye import [path] [--deterministic-only] [--skip-interview]` | Analyses an existing project without `.curaye/` and generates one at ~60% fidelity. Detects project type from `package.json`, `Cargo.toml`, or `pyproject.toml`; infers `stack.md`, `prd.md`, `current/` domain stubs, and `shipped/` entries from git tags. With AI configured, enhances `current/` docs with feature-level descriptions and infers `decisions/` candidates. Runs a 5-question targeted interview by default. All generated documents carry `confidence: inferred` in frontmatter. Auto-registers the project. |
| `curaye review [path]` | Lists all documents with `confidence: inferred`, opens each in `$EDITOR`, and removes the `confidence` field when the user marks it reviewed — converting it to a standard protocol document. Supports `--json` to list inferred docs without interactive review. |
| `curaye promote <file> --to <shared\|decisions\|patterns\|design>` | Promotes a document to the shared layer (spec `17-pattern-promotion`). |

## Binary distribution

Built with `pkgroll` or `esbuild` targeting Node.js. Binaries published to GitHub Releases for:
- `darwin-arm64`, `darwin-x64`
- `linux-x64`
- `win32-x64`

Available via `npx curaye` from the npm registry.
