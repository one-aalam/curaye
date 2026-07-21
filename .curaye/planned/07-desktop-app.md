---
id: desktop-app
title: Desktop App — Foundation, Portfolio View & Spec Editor
status: draft
effort: xl
impact: high
desire: high
requires: [package-core, package-sync, package-ai, cli]
tags: [desktop, ui]
created: 2026-07-21
updated: 2026-07-21
---

# Desktop App — Foundation, Portfolio View & Spec Editor

> The primary daily interface. Built with Tauri v2 + React 19. Calm, minimal — consistent with the ethos of the projects it manages.

## Problem

The CLI proves the workflow. The desktop app makes it habitual. Browsing specs, editing documents, reviewing the shared layer, and acting on AI suggestions all require a richer surface than a terminal.

## Goal

Implement `@curaye/desktop`: a three-panel Tauri app covering project navigation, the `.curaye/` document tree, and a spec editor with frontmatter-aware fields. The foundation all subsequent desktop features build on.

## Non-goals

- AI command palette — covered in spec `08-desktop-ai-palette`.
- Cross-project backlog view — covered in spec `11-cross-project-backlog`.
- Release planning / kanban — covered in spec `12-release-planning`.
- Settings and configuration UI — a later spec.

## Layout

Three-panel layout, fixed:

```
┌─────────────┬──────────────────┬────────────────────────────┐
│             │                  │                            │
│  Projects   │   .curaye/ tree  │   Document editor          │
│  sidebar    │                  │                            │
│             │   planned/       │   # Auto-scroll            │
│  ● curaye   │     auto-scroll  │                            │
│  ● ilmgah   │     ask-the-book │   ---                      │
│  ● aiyo     │   current/       │   id: auto-scroll          │
│             │     reader       │   status: ready            │
│             │   decisions/     │   effort: m                │
│             │   prd.md         │   ...                      │
│             │   stack.md       │   ---                      │
│             │                  │                            │
│             │                  │   ## Problem               │
│             │                  │   ...                      │
└─────────────┴──────────────────┴────────────────────────────┘
```

Panel widths are resizable and persisted in app config. The tree panel collapses to an icon rail on narrow windows.

## Projects sidebar (left panel)

- Lists all registered projects from `~/.curaye/projects.yaml`.
- Each project shows: name, sync status indicator (clean / ahead / behind / diverged), and a count of `planned` specs with `status: ready`.
- "Add project" button at the bottom triggers a directory picker, then runs `link`.
- Right-click on a project: Reveal in Finder, Sync now, Unlink.
- The selected project drives the tree panel.

## Document tree (middle panel)

- Shows the `.curaye/` structure of the selected project.
- Sections: `planned/`, `current/`, `shipped/`, `decisions/`, and the three root docs.
- Each section is collapsible. `planned/` defaults open; `shipped/` defaults collapsed.
- Planned specs show a status badge (coloured dot: draft=grey, ready=blue, building=amber, done=green, shelved=dim).
- Draft files (`_` prefix) appear under a "Drafts" subsection with an italic label.
- Validation errors on a document show as a red indicator on the tree item.
- A `+` button in each section header creates a new document in that section.

## Document editor (right panel)

The editor has two modes, toggled by a pill at the top of the panel:

**Structured mode (default)** — frontmatter fields rendered as form controls:
- `status` → segmented control
- `effort` → segmented control (xs / s / m / l / xl)
- `impact`, `desire` → segmented control (low / medium / high)
- `requires` → tag input with autocomplete from known spec ids
- `tags` → tag input, free-form
- `release` → text input
- `created`, `updated` → date pickers; `updated` auto-fills to today on any change

Below the frontmatter form: a plain markdown textarea for the body. No WYSIWYG — the protocol's section structure is enforced by convention, not the editor.

**Raw mode** — the full file as a plain text editor, frontmatter and body together. Switching from raw to structured parses the current text; switching back serialises to text. No data is lost in either direction.

**Unsaved state** — a dot in the panel header indicates unsaved changes. `⌘S` saves. Navigating away with unsaved changes prompts: "Save changes to [title]? Save / Discard / Cancel".

**Validation panel** — below the editor, a collapsible tray showing any errors or warnings from the last parse. Clicking an issue highlights the relevant field.

## Tauri commands

The desktop frontend calls Tauri commands backed by Rust. For file operations that need to cross the process boundary:

```rust
// These delegate to @curaye/core via a sidecar Node process, or are
// reimplemented in Rust using the same protocol rules.
scan_project(curiye_path: String) -> Result<ProjectIndex, String>
read_document(path: String, doc_type: String) -> Result<ParsedDocument, String>
write_document(path: String, content: String) -> Result<(), String>
read_registry() -> Result<Vec<RegistryProject>, String>
write_registry(projects: Vec<RegistryProject>) -> Result<(), String>
```

## State management

Zustand stores:
- `useProjectStore` — registered projects, selected project id
- `useTreeStore` — expanded sections, selected document path
- `useEditorStore` — current document content, unsaved flag, validation result
- `useConfigStore` — app config (panel widths, theme, AI provider status)

## Acceptance criteria

1. On launch, the projects sidebar lists all registered projects from `~/.curaye/projects.yaml`.
2. Selecting a project populates the tree panel with its `.curaye/` structure.
3. Selecting a document in the tree opens it in the editor panel.
4. Editing a field in structured mode and pressing `⌘S` writes the updated file to disk.
5. Switching from structured to raw mode and back preserves all frontmatter values including unknown fields.
6. A document with a missing required field shows a red indicator on its tree item and an error in the validation tray.
7. The `updated` date auto-fills to today's date when any field is changed in structured mode.
8. Navigating away from an unsaved document shows the save prompt.
9. The `+` button in the `planned/` section header creates a new file, opens it in the editor, and focuses the `title` field.
10. The projects sidebar sync indicator updates within 30 seconds of a push/pull without requiring a full app restart.
