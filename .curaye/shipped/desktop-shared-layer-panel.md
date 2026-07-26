---
id: desktop-shared-layer-panel
title: "Desktop Shared Layer Panel — Browse, Author, and Edit Shared Docs"
shipped: 2026-07-26
release: ""
spec_ref: "desktop-shared-layer-panel"
---

# Desktop Shared Layer Panel — Browse, Author, and Edit Shared Docs

> Shipped on 2026-07-26

## What shipped

Four new Tauri commands were added to the Rust backend (`commands/mod.rs`): `list_shared_docs`, `read_shared_doc`, `write_shared_doc` (atomic, returns notified count, accepts optional `source_project_id` to exclude from notifications), and `create_shared_doc` (errors if file already exists). A fifth command, `get_notification_count`, reads `~/.curaye/notifications.yaml` to count pending notifications for a given project. A new Zustand store (`useSharedLayerStore`) manages the panel's full state including doc loading, editing, error, and new-doc form. The `SharedLayerPanel` component is a `fixed inset-0` full-height overlay with a two-column layout: a 240 px left column with five category tabs (showing per-category counts), an independently scrollable doc list, and an inline new-doc form; and a flex-fill right column with a read-only metadata strip (source_project, promoted, adopted_by pills), a full-height editable textarea, and a footer with Cancel and "Save · N notified" buttons. The `ProjectsSidebar` gained a "Shared" toggle button with a live notification badge. In `PromoteModal`, the "Using generalized version" badge was replaced with an editable `<textarea rows={6}>` so the user can review and adjust the AI rewrite before promoting.

## Changes to current/

- `current/desktop.md` — updated to document the Shared Layer Panel entry point, panel layout, new Tauri commands, `useSharedLayerStore`, and the PromoteModal generalize preview pane.

## Notes

`write_shared_doc` accepts an extra `source_project_id: Option<String>` parameter beyond the spec signature so the frontend can exclude the currently selected project from outbound notifications — this parameter is needed because the Rust backend has no session context. The `docLoading` / `docError` states were added to `useSharedLayerStore` (beyond the spec's state list) after the initial build revealed that a silent catch block was making selection failures invisible.
