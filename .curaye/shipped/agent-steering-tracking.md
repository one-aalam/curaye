---
id: agent-steering-tracking
title: "Agent Steering Document Tracking"
shipped: 2026-07-21
release: ""
spec_ref: "agent-steering-tracking"
---

# Agent Steering Document Tracking

> Shipped on 2026-07-21

## What shipped

`@curaye/core` gained a new `agent-tracker.ts` module exporting `detectAgentFiles`, `trackAgentChanges`, `writeAgentLogEntry`, and `readAgentLog`, along with `AgentFile`, `AgentLogEntry`, `AgentChangeType`, and `AgentChange` types. `RegistryProject` was extended with an optional `agent_files` field that persists tracked file paths, SHA256 hashes, and last-changed dates. `curaye sync` now calls `trackAgentChanges` after each project sync, writing dated entries to `.curaye/agent-log/YYYY-MM-DD-{filename}.md` for created, modified, and deleted agent steering files; if an AI provider is configured, a plain-English summary is generated and written as the entry body. A new `curaye agents` command group was added with four subcommands: `list`, `log` (with `--since`), `diff <date>`, and `detect`. The `agents` shared-layer category was already present in `CATEGORIES`, so `shared/agents/` adoption and notification work without further changes.

## Changes to current/

- `current/core.md` — added `agent-tracker.ts` module documentation: `AgentFile` type, `AgentLogEntry` type, `AgentChangeType` union, `AgentChange` type, and the four exported functions; noted `agent_files` addition to `RegistryProject`.
- `current/cli.md` — added `curaye agents` command group with all four subcommands; noted that `curaye sync` now runs agent tracking as a non-fatal step.

## Notes

- AC #8 (desktop "Agents" tree panel) was deferred by user request — no desktop changes in this ship.
- Log files are named `YYYY-MM-DD-{basename}.md` (one per file per day) rather than one file per day with multiple entries, to avoid multi-document YAML parsing complexity.
- Agent tracking in sync is non-fatal: errors are swallowed so a tracking failure never blocks a sync operation.
