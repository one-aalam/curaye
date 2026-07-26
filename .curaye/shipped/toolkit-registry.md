---
id: toolkit-registry
title: "Toolkit Registry — Preferred Starters, Frameworks & Tools by Stack"
shipped: 2026-07-26
release: ""
spec_ref: "toolkit-registry"
---

# Toolkit Registry — Preferred Starters, Frameworks & Tools by Stack

> Shipped on 2026-07-26.

## What shipped

A `curaye toolkit` CLI command group (`list`, `add`, `show`, `edit`, `remove`) for managing toolkit presets — shared stack documents in `~/.curaye/shared/stack/` with structured frontmatter fields (`runtime`, `app_type`, `framework`, `starter_kit`, `starter_kit_cmd`, `design_system`, `tools`). The scaffold command's shared-stack detection was replaced with a scoring algorithm (+4 for `app_type`, +2 per matched `runtime`, +2 per matched `framework` token), with single-best-match confirmation and tie-breaking via an interactive list; unmatched stacks fall back to the built-in generator table. Scaffold now writes `NEXT_STEPS.md` when a matched preset includes a `design_system` or `tools` field, and the `--json` output includes a `toolkit_match` field. Five new Tauri commands were added (`list_toolkit_presets`, `get_toolkit_preset`, `write_toolkit_preset`, `delete_toolkit_preset`, `match_toolkit_preset`), and the desktop's Shared Layer Panel Stack tab now renders toolkit-field documents as structured cards with an Add Preset / Edit form modal and a "Stack docs (no preset)" section for plain stack documents.

## Changes to current/

- `current/cli.md` — added `curaye toolkit` subcommand surface and `NEXT_STEPS.md` generation behaviour; updated scaffold's detection algorithm description.
- `current/desktop-shared-layer-panel.md` — added Toolkit Cards view for the Stack tab, `ToolkitCard` component, `ToolkitFormModal`, `StackTabContent`, and `toolkitStore.ts`.

## Notes

`NEXT_STEPS.md` is written regardless of whether the generator ran (including when the user declines the "Run it now?" prompt), since the spec ties it to the presence of `design_system`/`tools` fields in the matched preset, not to generator success. This is a deliberate judgment call.
