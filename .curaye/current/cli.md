---
id: cli
title: CLI — Command Surface
domain: cli
updated: 2026-07-26
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
| `curaye backlog [--status draft\|ready] [--sort impact\|desire\|effort] [--project <id>]` | Cross-project backlog: aggregates `planned/` specs with `status: draft \| ready` from all registered projects (or one). `--sort effort` orders xs → xl; `--sort impact` and `--sort desire` order high → low. `--json` for structured output. |

## Release management

| Command | Description |
|---|---|
| `curaye release new <name> [--target YYYY-MM-DD] [--project <id>]` | Creates `.curaye/releases/<slugified-name>.md` with `status: planning` frontmatter. `v0.3.0` becomes `v0-3-0.md`. |
| `curaye release list [--project <id>]` | Lists all releases for a project (or all registered projects) with id, title, status, target date, and `done/total` spec count. |
| `curaye release assign <spec-id> <release-id> [--project <id>]` | Sets the `release` field in the spec's frontmatter. Replaces any existing assignment — a spec can only belong to one release. |
| `curaye release board <release-id> [--project <id>]` | Prints an ASCII kanban board to stdout with four columns (Draft / Ready / Building / Done), showing all non-shelved specs assigned to the release. |
| `curaye release ship <release-id> [--project <id>]` | Ships all `status: done` specs in the release: creates a `shipped/` document for each, removes their `planned/` files, and marks the release `status: shipped`. Errors if the release is already shipped or has no done specs. Prompts for confirmation in interactive mode; skips the prompt with `--json`. |

## Sync

| Command | Description |
|---|---|
| `curaye sync [--project <id>] [--all] [--pull\|--push]` | Pushes (default) or pulls `.curaye/` content. `--all` syncs every registered project. After each project sync, runs agent file tracking (non-fatal) and clears drift ignores for that project (`~/.curaye/drift-ignores.yaml`). |
| `curaye sync status` | Reports ahead/behind/clean state vs remote. |
| `curaye sync init <remote-url>` | One-time setup: clones or initialises the sync repo at `~/.curaye/sync/`. |

## Agent steering

Tracks `CLAUDE.md`, `AGENTS.md`, and `*AGENTS*.md` files across registered projects. Change detection and log writes happen during `curaye sync`.

| Command | Description |
|---|---|
| `curaye agents list [--project <id>]` | Lists all tracked agent steering files for a project with their last-change date and truncated hash. |
| `curaye agents log [--project <id>] [--since YYYY-MM-DD]` | Shows all agent change log entries, optionally filtered by date. Includes AI-generated summaries when present. |
| `curaye agents diff <date> [--project <id>]` | Shows all log entries recorded on `<date>`, including structured metadata and diff summary body. |
| `curaye agents detect [--project <id>]` | Detects agent steering files in the project directory without writing any changes (dry-run). |

## Re-entry brief

| Command | Description |
|---|---|
| `curaye brief [--project <id>] [--no-ai] [--save]` | Generates a structured 6-section re-entry brief (Current State, What Was Planned, Where You Left Off, Decisions to Revisit, Suggested First Step, Vision Check) from the project's `.curaye/` contents. With AI configured, streams prose to stdout; `--no-ai` forces deterministic output from structured data alone. `--save` writes the output to `.curaye/briefs/YYYY-MM-DD.md` (not tracked by the protocol scanner). Falls back to deterministic output automatically when no AI provider is configured. |

## Search and indexing

| Command | Description |
|---|---|
| `curaye index [--project <id>] [--all]` | Builds or incrementally updates the local vector index at `~/.curaye/index/`. Only re-embeds documents whose content hash has changed. When `--all` is passed, also indexes shared-layer documents from `~/.curaye/shared/` (projectId `"shared"`). Requires an embedding provider (Ollama `nomic-embed-text`, Anthropic, or OpenAI). |
| `curaye index status` | Shows index coverage: document count, last-indexed timestamp, and which project ids are present in the index. |
| `curaye search <query> [--project <id>] [--type planned\|current\|decisions\|shipped] [--limit N]` | Semantic search when an AI provider is configured and the index exists; falls back to `grep -ri` keyword search otherwise. Prints a stale-index notice when keyword results contain documents missing from the semantic index. Searches all registered projects and the shared layer when `--project` is omitted. |

## AI-assisted commands

All AI commands require a configured provider.

| Command | Description |
|---|---|
| `curaye ai status` | Reports which provider is configured and whether it is reachable. |
| `curaye ai draft <title> [--project <id>]` | Streams a drafted planned spec to stdout; prompts to save. |
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

## Drift detection

| Command | Description |
|---|---|
| `curaye check [--project <id>] [--all] [--fix] [--json]` | Check a project (or all registered projects) for drift against its adopted shared documents. Prints per-finding output with `✓` / `⚠` icons. `--all` groups findings by project. `--fix` walks through each actionable finding interactively: for drift, offers "Record a local override decision" (creates a `decisions/` file with `superseded_by` frontmatter), "Open local content to update it", or "Ignore for now"; for pending-update, offers "Review the diff", "Mark as reviewed" (updates review snapshot), or "Ignore for now". "Ignore for now" writes to `~/.curaye/drift-ignores.yaml` and suppresses the finding on subsequent checks; ignores are cleared after the next `curaye sync`. Exits with code `1` when any finding is classified as `drift` (useful in CI/CD pre-sync hooks). Exits `0` for `pending-update` only. |

## Bootstrap and import

| Command | Description |
|---|---|
| `curaye bootstrap [path] [--scaffold] [--git]` | Runs the project bootstrap interview and scaffolds `.curaye/`. Asks 5 questions (description, target user, app type, shared decisions, first feature), drafts `prd.md` and first planned spec via AI if configured, seeds `stack.md` from shared layer, copies selected shared decisions with `source` field, and auto-registers the project. Errors cleanly if `.curaye/` already exists. `--scaffold` immediately runs all three scaffold phases after writing `.curaye/`; `--git` implies `--scaffold` and captures everything in a single initial commit. Creates target directory if missing. |
| `curaye scaffold [path] [--git] [--no-kit]` | Reads an existing `.curaye/` folder and produces a working project skeleton in three phases. **Phase 1 — Starter kit:** detects the generator from `~/.curaye/shared/stack/*.md` (`starter_kit_cmd` frontmatter) or from a built-in signal table (Tauri → `create-tauri-app`, Turborepo → `create-turbo`, create-tui, Next.js, Astro, SvelteKit, Vite), prompts the user, and spawns it with inherited stdio. `--no-kit` skips Phase 1. **Phase 2 — Overlay:** writes `README.md` (AI-generated overview or stub), presents a multiselect for shared patterns (`~/.curaye/shared/patterns/`) creating directories from their `directories` frontmatter field, copies shared agent files (`~/.curaye/shared/agents/`), and creates a fallback directory skeleton when Phase 1 produced no output. **Phase 3 — Git:** `--git` runs `git init`, `git add -A`, and `git commit -m "chore: init project with curaye scaffold"`. Errors with a clear message when `.curaye/` is absent. Creates target directory if missing. |
| `curaye import [path] [--deterministic-only] [--skip-interview]` | Analyses an existing project without `.curaye/` and generates one at ~60% fidelity. Detects project type from `package.json`, `Cargo.toml`, or `pyproject.toml`; infers `stack.md`, `prd.md`, `current/` domain stubs, and `shipped/` entries from git tags. With AI configured, enhances `current/` docs with feature-level descriptions and infers `decisions/` candidates. Runs a 5-question targeted interview by default. All generated documents carry `confidence: inferred` in frontmatter. Auto-registers the project. |
| `curaye review [path]` | Lists all documents with `confidence: inferred`, opens each in `$EDITOR`, and removes the `confidence` field when the user marks it reviewed — converting it to a standard protocol document. Supports `--json` to list inferred docs without interactive review. |
| `curaye promote <file> [--to decisions\|patterns\|design\|agents\|stack] [--project <id>] [--id <id>]` | Promotes a `current/` or `decisions/` document to `~/.curaye/shared/<category>/`. Resolves the file path relative to the project's `.curaye/` directory, then falls back to cwd. Interactively prompts for category and id when `--to` / `--id` are omitted; in `--json` mode both must be supplied. Adds `source_project`, `promoted`, and `adopted_by` frontmatter fields; notifies all other registered projects via `~/.curaye/notifications.yaml`. Offers AI generalisation (removes project-specific names) when a provider is configured. Asks whether to add `promoted_to: <docRef>` back to the source document. Running promote on the same file twice updates the shared document in place. Promoting a `planned/` document errors: "Only current/ and decisions/ documents can be promoted." |

## Skill distribution

`@curaye/cli` bundles all six Curaye Claude Code skills in a `skills/` directory alongside `dist/`. A single command copies them to `~/.claude/commands/`, making `/curaye-build`, `/curaye-ship`, `/curaye-brief`, `/curaye-bootstrap`, `/curaye-import`, and `/curaye-check` available as slash commands in every Claude Code session on the machine.

| Command | Description |
|---|---|
| `curaye skill install [--path <dir>]` | Copies all 6 bundled skill files to `~/.claude/commands/` (or custom `--path`). Skips files that already exist. Prints an install summary on success; prints "Already installed. Use --update to upgrade." when all files are already present. |
| `curaye skill install --update [--path <dir>]` | Same as above but overwrites existing skill files with the current CLI version's copies. |
| `curaye skill install --list [--path <dir>]` | Shows each skill's installed version vs the version bundled with the current CLI, with a `✓` or `← update available` status column. |

Each skill file begins with `<!-- curaye-skill: vX.Y.Z -->` matching the CLI package version. The `--list` command reads this header to compare versions. The `skills/` directory is included in the npm package via the `files` field in `package.json`.

## Binary distribution

Built with `pkgroll` or `esbuild` targeting Node.js. Binaries published to GitHub Releases for:
- `darwin-arm64`, `darwin-x64`
- `linux-x64`
- `win32-x64`

Available via `npx curaye` from the npm registry.
