---
id: desktop-shared-layer-panel
title: "Desktop Shared Layer Panel — Browse, Author, and Edit Shared Docs"
status: planned
effort: m
impact: high
desire: high
requires: [shared-layer, pattern-promotion, desktop-drift-panel]
tags: [desktop, shared-layer]
created: 2026-07-26
updated: 2026-07-26
---

# Desktop Shared Layer Panel — Browse, Author, and Edit Shared Docs

> The shared layer is currently write-only from the desktop. You can promote into it but never inspect, edit, or author from it. This spec closes that gap: a dedicated panel that makes the shared layer a first-class writable surface, not just a promotion target.

## Problem

After promoting a document to `~/.curaye/shared/`, there is no way in the desktop to:

- Browse what is already in the shared layer
- Read a shared document's content
- Edit a shared document in place (to evolve a pattern or fix a mistake)
- Author a new shared document without a source project document to promote from
- Know which projects will be notified when a shared doc changes

The only way to do any of this today is to open Finder, navigate to `~/.curaye/shared/`, and edit the markdown files directly — which defeats the purpose of having a managed shared layer.

Additionally, the `generalize_document` Tauri command added in the pattern-promotion spec produces output the user cannot read before committing it. The "Using generalized version" badge in `PromoteModal` is a black box.

## Goal

1. **A Shared Layer panel** in the desktop that lets the user browse, read, edit, and create shared documents without leaving the app.

2. **A generalize preview pane** in `PromoteModal` that shows the AI-rewritten content in an editable text area so the user can review and adjust it before promoting.

## Non-goals

- Deleting shared documents — dangerous, no undo, deferred.
- Adopting shared documents into a project from this panel — that flow belongs to the Drift Panel and `curaye shared adopt` CLI.
- Syncing the shared layer to the remote — that is `curaye sync`'s job.
- Conflict resolution when two projects promoted to the same `id` — surface the diff, do not auto-resolve.
- Markdown preview / rendered view — raw editor only.

## Entry point

A **Shared** button is added to the bottom of `ProjectsSidebar`, below the project list, styled as a secondary nav item. Clicking it opens the `SharedLayerPanel` as a full-height drawer anchored to the left edge of the app, overlaying the document tree and editor. Closing the panel returns to the previous three-panel view.

The button shows a badge count of pending unreviewed shared docs (docs where `~/.curaye/notifications.yaml` has an entry for the currently selected project). This reuses the existing notification plumbing already written in `SharedLayer.listNotifications()`.

## Panel layout

Two columns inside the panel:

```
┌─────────────────────────────────────────────────────────────┐
│ [← Close]   Shared Layer          [+ New]                   │
├──────────────────────┬──────────────────────────────────────┤
│  [decisions] [patt…] │  source_project: curaye              │
│  [design] [agents]   │  promoted: 2026-07-21                │
│  [stack]             │  adopted_by: curaye, project-b       │
│  ─────────────       │  ─────────────────────────────────── │
│  ○ 01-why-turborepo  │  # Decision: Turborepo over ...      │
│  ○ 02-cli-stack      │                                       │
│  ○ 03-rust-ai-layer  │  [editable content area]             │
│                      │                                       │
│                      │  [Cancel]  [Save · 2 notified]       │
└──────────────────────┴──────────────────────────────────────┘
```

**Left column** — category tabs + document list:
- Five category tabs across the top: `decisions`, `patterns`, `design`, `agents`, `stack`
- Doc list below: one row per document in `~/.curaye/shared/<category>/`. Each row shows the document title (from frontmatter `title:` or the id as fallback), the `adopted_by` count as a dim chip, and the `promoted` date.
- Selecting a doc loads it into the right column.
- Empty category shows a prompt to create the first document.

**Right column** — document view and editor:
- A read-only metadata strip at the top: `source_project`, `promoted` date, `adopted_by` list as pills.
- An editable `<textarea>` below showing the full raw document content (frontmatter + body). The textarea is pre-populated on doc selection.
- A footer with **Cancel** (resets unsaved edits) and **Save** buttons. The Save button is disabled when content is unchanged. When `adopted_by` is non-empty, Save reads "Save · N notified" where N is the adopter count — the user sees the blast radius before committing.
- Saving writes atomically to `~/.curaye/shared/<category>/<id>.md` and calls `update_shared_notification` for all `adopted_by` projects except the one currently selected in the sidebar.

## Creating a new shared document

Clicking **+ New** opens a small inline form at the top of the left column (not a modal):
- Category picker — same five options, radio pattern as in `PromoteModal`
- Doc id input — same validation as `PromoteModal` (no path separators, no `.` or `..`)
- Confirm button creates `~/.curaye/shared/<category>/<id>.md` with minimal frontmatter:

```yaml
---
id: <id>
title: ""
created: <today>
adopted_by: []
---

```

The new doc is immediately selected in the list and the right column opens in edit mode. No notifications are sent on creation — no project has adopted it yet.

## Generalize preview in PromoteModal

When `handleGeneralize()` succeeds in `PromoteModal`, instead of only showing the "Using generalized version" badge, the modal expands to show the generalized content in a scrollable, editable `<textarea>`. The user can read and adjust the rewrite. The edited text in the area (not the original AI output) is what gets passed as `contentOverride` to `promote_to_shared`.

The Reset link clears both the textarea and the `generalizedContent` state, reverting to the original file.

## New Tauri commands

| Command | Signature | Notes |
|---|---|---|
| `list_shared_docs` | `(category: Option<String>) → Vec<SharedDocSummary>` | Returns id, category, title, adopted_by count, promoted date. Reads `~/.curaye/shared/`. |
| `read_shared_doc` | `(category: String, doc_id: String) → Result<String, String>` | Returns raw file content including frontmatter. |
| `write_shared_doc` | `(category: String, doc_id: String, content: String) → Result<usize, String>` | Atomic write. Returns number of projects notified. Reads `adopted_by` from new content's frontmatter to determine who to notify. |
| `create_shared_doc` | `(category: String, doc_id: String) → Result<String, String>` | Writes minimal frontmatter stub, returns the path. Errors if file already exists. |

`SharedDocSummary` is a new `#[derive(Serialize)]` struct:

```rust
pub struct SharedDocSummary {
    pub id: String,
    pub category: String,
    pub title: String,
    pub adopted_by_count: usize,
    pub promoted: Option<String>,
}
```

## New React component

`SharedLayerPanel` — a full-height drawer. State lives in a new `useSharedLayerStore` (Zustand):

```
sharedLayerOpen: bool
selectedCategory: SharedCategory
docs: SharedDocSummary[]
docsLoading: bool
selectedDocId: string | null
selectedDocContent: string | null   ← original loaded content
editedContent: string | null        ← user's working copy
saving: bool
saveError: string | null
```

Actions: `openPanel`, `closePanel`, `selectCategory`, `selectDoc`, `saveDoc`, `createDoc`.

`selectDoc` invokes `read_shared_doc` and populates both `selectedDocContent` and `editedContent`. `saveDoc` invokes `write_shared_doc` with `editedContent`, then reloads the doc list.

## Acceptance criteria

1. A **Shared** button appears at the bottom of `ProjectsSidebar`. Clicking it opens `SharedLayerPanel`; clicking again or pressing Escape closes it.
2. The Shared button shows a numeric badge when `notifications.yaml` has entries for the currently selected project. The badge is absent when there are none.
3. The panel loads all five category tabs. Each tab shows the count of documents in that category.
4. Selecting a category shows the document list for that category. Each row shows the title (or id), adopted-by count, and promoted date.
5. Selecting a document populates the right column: metadata strip at top, full raw content in an editable textarea.
6. Editing the content and clicking **Save** writes the file atomically and emits a notification for all `adopted_by` projects (excluding the currently selected sidebar project). The Save button's label reflects the notified count: "Save · N notified".
7. The Save button is disabled when `editedContent === selectedDocContent` (no changes).
8. Cancel resets `editedContent` to `selectedDocContent`.
9. Clicking **+ New**, filling in a valid category and doc id, and confirming creates the stub file and selects the new doc in the list. Creating fails gracefully (inline error) if a file with that id already exists in the chosen category.
10. The new doc form rejects doc ids that contain `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`, or equal `.` / `..`.
11. In `PromoteModal`: after "Generalize with AI" completes, the modal shows the generalized content in an editable scrollable textarea (min 6 rows). The user can edit the content. The edited text — not the raw AI output — is what is passed to `promote_to_shared` as `contentOverride`. Reset clears the textarea and the generalized content state.
12. `write_shared_doc` and `create_shared_doc` use the same atomic write pattern (`write_atomic`) as all other file operations in the Rust backend.
13. The panel's left column scrolls independently when the doc list overflows. The right column's textarea fills remaining height.
14. An empty category (no `.md` files) shows "No shared documents in this category yet" and a prompt to create one.
