---
id: cli
title: CLI — Command Surface
status: draft
effort: l
impact: high
desire: high
requires: [package-core, package-sync, package-ai]
tags: [cli]
created: 2026-07-21
updated: 2026-07-21
---

# CLI — Command Surface

> The foundation of Curaye. Proves the format and workflow before any UI is built. Every action the desktop app performs is also available here.

## Problem

There is no way to interact with the Curaye system without building the full desktop app first. The CLI must exist independently — scriptable, fast, and complete enough to be the only interface a developer needs during Phase 1.

## Goal

Implement `@curaye/cli`: all core commands covering project registration, spec lifecycle, sync, search, and AI-assisted actions. Distributed as a single binary via `npx curaye` and GitHub Releases.

## Non-goals

- A TUI or interactive browsing mode — that is the desktop app's role.
- Rendering markdown in the terminal — output is plain text or structured JSON (`--json` flag).
- Authentication management for git or AI providers.

## Command surface

### Project management

```
curaye init [path]
```
Scaffolds `.curaye/` in `path` (default: current directory). Creates the four required subfolders and stub root documents. Errors if `.curaye/` already exists.

```
curaye link [path]
```
Registers the project at `path` in `~/.curaye/projects.yaml`. Infers `id` from the directory name, prompts for `name`. If `.curaye/` does not exist, offers to run `init` first.

```
curaye unlink <id>
```
Removes a project from the registry. Does not delete the `.curaye/` folder.

```
curaye projects
```
Lists all registered projects: id, name, path, sync status.

---

### Spec lifecycle

```
curaye new <title> [--type planned|decision] [--project <id>]
```
Creates a new document in `planned/` (or `decisions/` with `--decision`). Generates frontmatter with today's date, `status: draft`, and a derived `id` from the title. Opens the file in `$EDITOR`.

```
curaye list [--project <id>] [--status <status>] [--tag <tag>]
```
Lists planned specs for the current or specified project. Default: all statuses. Columns: id, title, status, effort.

```
curaye status <spec-id> <new-status> [--project <id>]
```
Updates the `status` field of a planned spec and sets `updated` to today.

```
curaye ship <spec-id> [--project <id>] [--release <release>]
```
Marks a planned spec as shipped:
1. Sets `status: done` on the planned spec (as a transitional flag).
2. Creates a corresponding document in `shipped/` with today's date.
3. Prompts: "Update current/ now? [y/n]" — if yes, opens the relevant `current/` file in `$EDITOR`.
4. Removes the planned spec.

---

### Sync

```
curaye sync [--project <id>] [--all] [--pull] [--push]
```
Pushes (default) or pulls `.curaye/` content to/from the sync remote. `--all` syncs every registered project. `--pull` and `--push` are explicit directional flags; without either, defaults to push.

```
curaye sync status
```
Reports ahead/behind/clean state of the local sync repo vs remote.

```
curaye sync init <remote-url>
```
Clones or initialises the sync repo at `~/.curaye/sync/`. One-time setup per machine.

---

### Search

```
curaye search <query> [--project <id>] [--type planned|current|decisions|shipped]
```
Keyword search across `.curaye/` documents. Without `--project`, searches all registered projects. Outputs matching documents with file path and a snippet. Semantic search requires AI to be configured; falls back to keyword search if not.

---

### AI-assisted commands

All AI commands require a configured provider (`curaye ai status` to check).

```
curaye ai status
```
Reports which provider is configured and whether it is reachable.

```
curaye ai draft <title> [--project <id>]
```
Drafts a new planned spec from a title and optional description (prompted interactively). Streams the draft to stdout, then asks "Save to planned/? [y/n]".

```
curaye ai brief [--project <id>]
```
Generates a re-entry brief for the specified (or current) project. Reads `prd.md`, `stack.md`, `current/`, `planned/`, and `decisions/` and produces a structured summary. Streamed to stdout.

```
curaye ai update-current <spec-id> [--project <id>]
```
Reads the shipped spec and the relevant `current/` document, generates a diff-based update proposal, and opens it in `$EDITOR` for review before saving.

---

### Bootstrap and import

```
curaye bootstrap [path]
```
Runs the project bootstrap flow for a blank or existing project. See spec `13-project-bootstrap`.

```
curaye promote <file-path> --to <shared|decisions|patterns|design>
```
Promotes a project-level document to the shared layer. See spec `17-pattern-promotion`.

---

## Output format

All commands support `--json` for structured output (useful in scripts and CI). Human-readable output is the default. Errors go to `stderr` with a non-zero exit code.

## Binary distribution

The CLI is compiled to a standalone binary using `pkgroll` or `esbuild` targeting the Node.js runtime. GitHub Releases publishes binaries for `darwin-arm64`, `darwin-x64`, `linux-x64`, and `win32-x64`. An `npm` package publishes the same binary via `npx curaye`.

## Acceptance criteria

1. `curaye init` in an empty directory creates `.curaye/` with all required subfolders and stub root documents.
2. `curaye link` with an existing `.curaye/` folder adds the project to `~/.curaye/projects.yaml` and prints the registered id.
3. `curaye new "auto-scroll"` creates `planned/auto-scroll.md` with valid frontmatter and `status: draft`.
4. `curaye ship <id>` with `--release v0.2.0` creates a `shipped/` document with `release: v0.2.0` and removes the planned file.
5. `curaye list --status ready` returns only specs with `status: ready`.
6. `curaye sync` pushes the current project's `.curaye/` content and prints the commit hash.
7. `curaye search "offline sync"` returns results from all registered projects when no `--project` flag is given.
8. `curaye ai draft "dark mode"` produces a spec skeleton that conforms to the protocol standard.
9. `curaye --json projects` outputs valid JSON with one object per registered project.
10. Any command run outside a registered project directory, without `--project`, prints a clear error and exits non-zero.
