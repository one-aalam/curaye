---
id: pattern-promotion
title: "Pattern Promotion — Project to Shared Layer"
shipped: 2026-07-23
release: ""
spec_ref: "pattern-promotion"
---

# Pattern Promotion — Project to Shared Layer

> Shipped on 2026-07-23

## What shipped

`SharedLayer.promote()` and `SharedLayer.markPromotedSource()` were added to `@curaye/core`, along with exported `PromoteInput` and `PromoteResult` types. `curaye promote <file-path> [--to <category>] [--id <id>] [--project <id>]` was implemented end-to-end: it validates the source is not from `planned/`, writes the document atomically to `~/.curaye/shared/<category>/<id>.md` with `source_project`, `promoted`, and `adopted_by` frontmatter fields, notifies all other registered projects via `~/.curaye/notifications.yaml`, optionally adds `promoted_to` back to the source document, and offers AI generalisation when a provider is configured. A `promote_to_shared` Tauri command was added in Rust, and the desktop got a `PromoteModal` component plus a right-click context menu on `current/` and `decisions/` tree items that calls the same command.

## Changes to current/

- `current/shared-layer.md` — updated to document the promotion flow, the five shared categories, the `source_project`/`promoted`/`adopted_by` frontmatter fields, and the `promote_to_shared` Tauri command.
- `current/cli.md` — updated to add the `promote` command to the CLI command surface.
- `current/desktop-app.md` — updated to document the right-click context menu promotion flow and `PromoteModal`.

## Notes

The shared-layer sidebar "origin badge" described in the spec's UI section was not implemented — it would require a dedicated shared-layer panel in the sidebar, which is beyond this spec's scope. The `project.id || project.name` fallback in the CLI handles registries written by the desktop app (which omits the `id` field). The Rust command uses `chrono_today()` (the existing rough date approximation) rather than a proper chrono dependency.
