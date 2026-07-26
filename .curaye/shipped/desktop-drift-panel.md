---
id: desktop-drift-panel
title: "Desktop Drift Panel — Per-finding review and resolution"
shipped: 2026-07-26
release: ""
spec_ref: "desktop-drift-panel"
---

# Desktop Drift Panel — Per-finding review and resolution

> Shipped on 2026-07-26.

## What shipped

The amber drift badge dot in `ProjectsSidebar` is now a clickable element that opens a `DriftPanel` dialog. The Rust backend was refactored to extract `detect_drift_findings` — a private async function shared by both `check_project_drift` (badge count) and the new `get_drift_findings` Tauri command (per-finding detail). Three resolution commands were added: `mark_reviewed` writes an atomic review snapshot to `~/.curaye/shared-reviews/<project_id>/<doc_id>.md`; `ignore_drift_finding` appends an entry to `~/.curaye/drift-ignores.yaml` atomically with deduplication; `create_override_decision` generates a stub `decisions/override-<doc_id>.md` with `superseded_by` frontmatter and returns the path without overwriting an existing file. The `DriftPanel` React component renders a spinner while findings load, a per-finding row with `doc_ref` (monospace), classification badge (amber for drift, blue for pending-update), and a 120-char shared-doc snippet, and three action buttons per row. Resolving the last finding transitions to an empty state. Closing the panel triggers an immediate `check_project_drift` recount to update the sidebar badge without waiting for the 30-second cycle. Drift panel state (`driftPanelOpen`, `driftPanelProject`, `driftFindings`, `driftLoading`) and actions (`openDriftPanel`, `closeDriftPanel`, `removeFinding`) live in `useProjectStore`.

## Changes to current/

- `desktop.md` — Added `get_drift_findings`, `mark_reviewed`, `ignore_drift_finding`, `create_override_decision` to the Tauri commands table. Noted the `detect_drift_findings` refactor. Updated `useProjectStore` description to include drift panel state and actions. Updated `ProjectsSidebar` description to reflect the clickable dot and `DriftPanel` trigger. Added `DriftPanel` to the components section. Revised the "Drift badge is a lightweight approximation" design note to clarify the badge/panel split.

## Notes

The amber dot uses `<span role="button">` rather than `<button>` because it lives inside an existing `<button>` element (the project row), and HTML forbids nested buttons. `stopPropagation` prevents project selection from also firing. This is a known accessibility tradeoff; restructuring the row to allow a true nested button is a candidate for a follow-up housekeeping spec.
