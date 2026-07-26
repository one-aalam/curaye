---
id: desktop-drift-panel
title: "Desktop Drift Panel — Per-finding review and resolution"
status: ready
effort: m
impact: high
desire: high
requires: [drift-detection, desktop-app]
tags: [desktop]
created: 2026-07-26
updated: 2026-07-26
---

# Desktop Drift Panel — Per-finding review and resolution

## Problem

The drift badge (amber dot in `ProjectsSidebar`) signals that a project has drift against its adopted shared-layer documents. Clicking the dot does nothing. Resolving drift requires context-switching to `curaye check` in a terminal or `/curaye-check` in a Claude Code session. For the primary daily interface this is a dead end — the badge tells you something needs attention but gives you no way to act on it.

## Goal

A Drift Panel opened by clicking the amber badge dot. It surfaces each drift finding with enough context to understand it and provides three mechanical resolution actions — Mark reviewed, Ignore until sync, Record override — without leaving the desktop. No LLM reasoning; that stays with `/curaye-check`. The panel handles resolution mechanics; the skill handles interpretation.

## Non-goals

- LLM-assisted drift interpretation (intentional vs accidental). That is `/curaye-check`'s job.
- Full parity with `curaye check --fix` interactive mode. The panel covers the same three resolution paths but as a UI, not a CLI prompt loop.
- Showing the full shared document content inline. A snippet (first 400 chars of the body) is sufficient context; the full doc is accessible via "Open shared file".
- Auto-resolving any finding. Every resolution requires an explicit user action.

## Detection logic — refactor to a shared function

`check_project_drift` (badge count) and the new `get_drift_findings` command both need to run the same three-stage detection. Before adding `get_drift_findings`, extract the inner loop into a private async function:

```rust
async fn detect_drift_findings(
    project_name: &str,
    project_path: &str,
) -> Result<Vec<DriftFinding>, String>
```

`check_project_drift` calls this and returns `findings.len() as u32`. `get_drift_findings` calls this and returns the full `Vec<DriftFinding>`. No duplication of detection logic.

## New Tauri commands

### `get_drift_findings(project_name, project_path) → Vec<DriftFinding>`

Runs the full three-stage detection (pending-update, intentional override, term-drift) and returns per-finding detail. Called on demand when the panel opens; not on the 30-second refresh cycle.

```rust
pub struct DriftFinding {
    pub doc_id: String,
    pub doc_ref: String,       // e.g. "decisions/atomic-writes"
    pub category: String,      // "decisions" | "patterns" | "design" | "agents" | "stack"
    pub classification: String, // "drift" | "pending-update"
    pub shared_path: String,   // absolute path to the shared doc
    pub shared_snippet: String, // first 400 chars of shared doc body (for context)
}
```

`doc_ref` is `category/doc_id` — the canonical reference used in `adopts` lists and `superseded_by` fields.

### `mark_reviewed(project_id, doc_id, shared_path) → ()`

Copies the current shared doc content to `~/.curaye/shared-reviews/<project_id>/<doc_id>.md`. Creates the directory if it does not exist. Atomic write (`.tmp` → rename). Clears the `pending-update` finding for this doc on the next badge refresh.

### `ignore_drift_finding(project_id, doc_id) → ()`

Appends `{ projectId, docId }` to `~/.curaye/drift-ignores.yaml`. Reads the existing file first to avoid duplicates. Atomic write. Ignores are cleared automatically after the next `curaye sync` (existing behaviour).

### `create_override_decision(curaye_path, doc_id, doc_ref) → String`

Creates a stub `decisions/` document with `superseded_by` frontmatter and returns its file path. The caller opens the file in the editor panel.

Generated content:

```markdown
---
id: override-<doc_id>
title: "Override: <doc_ref>"
status: active
superseded_by: <doc_ref>
created: <today>
updated: <today>
---

# Override: <doc_ref>

This project intentionally diverges from the shared layer document `<doc_ref>`.

## Reason

[Explain why this project's approach differs from the shared layer]
```

File path: `<curaye_path>/decisions/override-<doc_id>.md`. Atomic write. Does not overwrite if the file already exists — return the existing path instead.

## UI

### Trigger

In `ProjectsSidebar`, the amber badge dot becomes a clickable button. Clicking it calls `get_drift_findings` and opens the `DriftPanel` for that project. The dot remains a visual indicator when the panel is not open.

### `DriftPanel` component

A `Dialog` (same primitive as `PromoteModal`). Opens centred, wider than PromoteModal to accommodate finding rows — approximately 640px.

**Header:** "Drift — `<project name>`" with a close button. Subtitle: "N finding`s` against adopted shared documents."

**Loading state:** spinner while `get_drift_findings` is in flight.

**Empty state (no findings):** "No drift found. The badge will clear on the next refresh." A "Close" button.

**Finding row** (one per `DriftFinding`):

```
┌────────────────────────────────────────────────────────────┐
│  decisions/atomic-writes          [pending-update]         │
│  "Write operations use write-atomic (write .tmp, then..."  │
│                                                            │
│  [Mark reviewed]  [Ignore until sync]  [Record override]   │
└────────────────────────────────────────────────────────────┘
```

- `doc_ref` shown as the row title in monospace.
- `classification` shown as a badge: amber for `drift`, blue for `pending-update`.
- `shared_snippet` shown as a dimmed excerpt (truncated at 120 chars in the UI with `…`).
- Three action buttons, left-aligned below the excerpt.

**Action behaviour:**

| Action | Tauri call | On success |
|---|---|---|
| Mark reviewed | `mark_reviewed(projectId, docId, sharedPath)` | Remove row from panel; decrement header count |
| Ignore until sync | `ignore_drift_finding(projectId, docId)` | Remove row from panel; decrement header count |
| Record override | `create_override_decision(curiyePath, docId, docRef)` → path | Remove row; open returned path in editor; close panel |

When the last finding is resolved, transition to the empty state without closing the panel.

### State

Add to `useProjectStore` (or a dedicated `useDriftStore`): `driftPanelOpen: boolean`, `driftPanelProject: string | null`, `driftFindings: DriftFinding[]`, `driftLoading: boolean`. Actions: `openDriftPanel(projectName)`, `closeDriftPanel()`, `removeFinding(docId)`.

## Acceptance criteria

1. Clicking the amber badge dot in `ProjectsSidebar` opens `DriftPanel` for that project. A project with `drift_count === 0` has no clickable dot (the dot does not render).
2. `DriftPanel` shows a spinner while `get_drift_findings` is in flight, then renders one row per finding.
3. Each finding row shows: `doc_ref` (monospace), classification badge, and a 120-char snippet of the shared doc body.
4. "Mark reviewed" writes the review snapshot atomically and removes the row from the panel. The sidebar badge count decrements by 1 on the next 30-second refresh (or immediately if the panel triggers a recount on close).
5. "Ignore until sync" appends to `drift-ignores.yaml` atomically and removes the row.
6. "Record override" creates the stub `decisions/` file with `superseded_by: <doc_ref>` in its frontmatter, opens the file in the editor panel, closes the Drift Panel.
7. "Record override" on a doc that already has an `override-<doc_id>.md` in `decisions/` returns the existing path (no duplicate creation) and opens it.
8. When all findings are resolved interactively, the panel transitions to the empty state.
9. `get_drift_findings` returns the same set of findings that `check_project_drift` counts — both call the same internal `detect_drift_findings` function after the refactor. The badge count equals `get_drift_findings().length` for any given project state.
10. `get_drift_findings` is not called on the 30-second background refresh cycle — only on explicit panel open. The badge still uses `check_project_drift` (count only).
