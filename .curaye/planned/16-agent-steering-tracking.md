---
id: agent-steering-tracking
title: Agent Steering Document Tracking
status: draft
effort: s
impact: medium
desire: high
requires: [package-core, shared-layer]
tags: [core, agents]
created: 2026-07-21
updated: 2026-07-21
---

# Agent Steering Document Tracking

> CLAUDE.md and AGENTS.md files describe how AI agents work in a project. They are as important as the code they govern. Curaye tracks them alongside specs and decisions.

## Problem

AI-driven development workflows depend on `CLAUDE.md` and `AGENTS.md` files that steer how agents behave in a project. These files change over time — commands are added, conventions are refined, MCP servers are registered. Currently, changes are tracked only in git history, with no structured change log, no cross-project visibility, and no canonical shared patterns.

## Goal

Track `CLAUDE.md` and `AGENTS.md` (and any `*AGENTS*`-pattern file) in the Curaye system: log changes, surface diffs, maintain shared patterns in the shared layer, and notify adopting projects when the shared pattern updates.

## Non-goals

- Generating or editing `CLAUDE.md` content — Curaye tracks and surfaces, does not author.
- Enforcing a specific `CLAUDE.md` structure — the content is the project's own concern.
- Real-time watching of files (inotify/kqueue) — changes are detected on next `curaye sync` or app open.

## Tracking mechanism

Curaye scans for agent steering files at the project root on every `scanProject` call:

- `CLAUDE.md`
- `AGENTS.md`
- `**/CLAUDE.md` (up to 2 levels deep, e.g. `.claude/CLAUDE.md`)
- Any file matching `*AGENTS*.md` at the root

Detected files are recorded in a new section of the project registry entry:

```yaml
- id: ilmgah
  ...
  agent_files:
    - path: CLAUDE.md
      last_seen_hash: sha256:abc123...
      last_changed: 2026-07-15
```

On each scan, if the file's current SHA256 differs from `last_seen_hash`, a change is recorded in `.curaye/agent-log/YYYY-MM-DD.md`:

```yaml
---
date: 2026-07-21
file: CLAUDE.md
change_type: modified      # created | modified | deleted
previous_hash: sha256:abc...
current_hash:  sha256:def...
---

<!-- AI-generated diff summary if provider is configured -->
Added: MCP server registration for filesystem access.
Removed: Reference to deprecated `read_file` command.
```

## Shared layer integration

`shared/agents/` holds canonical `CLAUDE.md` patterns:

```
shared/agents/
  tauri-react.md       ← CLAUDE.md pattern for Tauri + React projects
  typescript-cli.md    ← pattern for TypeScript CLI projects
  base.md              ← baseline conventions shared across all projects
```

A project can adopt a shared agent pattern — same adoption mechanism as other shared documents. When the shared pattern changes, adopting projects are notified.

## CLI commands

```
curaye agents list [--project <id>]
```
Lists tracked agent steering files and their last-change dates.

```
curaye agents log [--project <id>] [--since YYYY-MM-DD]
```
Shows the agent change log for a project.

```
curaye agents diff <date> [--project <id>]
```
Shows the AI-generated diff summary for a specific log entry.

## Desktop integration

A new "Agents" section in the tree panel, below `decisions/`, showing tracked agent files and a badge count of recent changes (last 30 days). Clicking a log entry opens the diff summary.

## Acceptance criteria

1. `curaye sync` for a project with a modified `CLAUDE.md` creates a dated entry in `.curaye/agent-log/`.
2. The log entry includes `change_type: modified` and the correct SHA256 hashes.
3. With AI configured, the log entry includes a plain-English summary of what changed.
4. `curaye agents list` shows all tracked agent files for the current project with their last-change date.
5. `curaye agents log --since 2026-01-01` shows only entries from that date forward.
6. A deleted `CLAUDE.md` creates a `change_type: deleted` log entry — it is not silently dropped.
7. A newly created `CLAUDE.md` creates a `change_type: created` entry.
8. The desktop tree panel shows the "Agents" section with tracked files and a badge for recent changes.
9. Adopting `shared/agents/tauri-react` for a project adds it to the project's `adopts` list.
10. Updating `shared/agents/tauri-react` notifies all projects that have adopted it, same as other shared documents.
