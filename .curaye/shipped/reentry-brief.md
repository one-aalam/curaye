---
id: reentry-brief
title: "Re-entry Brief — Dormant Project Revival"
shipped: 2026-07-23
release: ""
spec_ref: "reentry-brief"
---

# Re-entry Brief — Dormant Project Revival

> Shipped on 2026-07-23.

## What shipped

A new top-level `curaye brief` command streams a structured 6-section re-entry brief (Current State, What Was Planned, Where You Left Off, Decisions to Revisit, Suggested First Step, Vision Check) derived from a project's `.curaye/` contents. It accepts `--no-ai` for deterministic output and `--save` to write a dated file to `.curaye/briefs/`. The desktop gains four new Tauri commands (`generate_brief_context`, `save_brief`, `get_last_opened`, `set_last_opened`), a `useBriefStore` Zustand store managing brief state and streaming, a `BriefView` component that renders the brief inline in the right panel with Save and Start Working actions, a "Brief" button in the tree panel header always visible, and a `ReentryBanner` that appears in the tree panel when a project has not been opened in the desktop for more than 30 days. Last-opened dates are persisted to `~/.curaye/desktop-state.json`.

## Changes to current/

- `current/cli.md` — added `curaye brief` as a new top-level command with its flags (`--project`, `--no-ai`, `--save`); replaced the placeholder `curaye ai brief` entry with a note that `curaye brief` is the canonical surface.
- `current/desktop.md` — added four new Tauri commands to the commands table; added `useBriefStore` to the Zustand stores table; updated `DocumentTree` and added `BriefView` to the components section; documented the desktop-state.json last-opened tracking file.

## Notes

The old `curaye ai brief` subcommand in `commands/ai.ts` was a pre-existing placeholder that produced a basic index-only output. It remains in the codebase but is now superseded by `curaye brief`. A follow-up cleanup spec could remove it.
