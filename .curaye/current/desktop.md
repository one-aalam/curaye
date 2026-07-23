---
id: desktop
title: Desktop App
domain: desktop
updated: 2026-07-23
---

# Desktop App

## Overview

`@curaye/desktop` is the primary daily interface for Curaye. It is a Tauri v2 + React 19 application with a three-panel resizable layout. The Rust backend handles all file I/O atomically; the React frontend is state-driven via Zustand. The glass-ui design system from ilmgah provides all visual components.

## Layout

Three resizable panels separated by drag-handle dividers. Widths are persisted in localStorage via `useConfigStore`.

```
┌─────────────────┬──────────────────┬────────────────────────────┐
│  Projects       │  .curaye/ tree   │  Document editor           │
│  sidebar        │                  │  (structured / raw toggle) │
└─────────────────┴──────────────────┴────────────────────────────┘
```

## Tauri commands (Rust → `src-tauri/src/commands/mod.rs`)

| Command | Purpose |
|---|---|
| `read_registry` | Read `~/.curaye/projects.yaml` → `Vec<RegistryProject>` |
| `write_registry` | Write registry atomically |
| `link_project` | Append a directory to the registry |
| `unlink_project` | Remove a project by name |
| `scan_project` | Scan a `.curaye/` path → `ProjectTree` with all sections |
| `read_document` | Parse frontmatter + body from a file path |
| `write_document` | Write a document atomically (tmp → rename) |
| `parse_raw` | Parse raw markdown string → `ParsedDocument` |
| `serialize_document` | Frontmatter map + body → YAML-fenced markdown string |
| `create_document` | Create a new stub document in a section, return path |
| `pick_directory` | Open OS directory picker (via `tauri-plugin-dialog`) |
| `reveal_in_finder` | `open -R <path>` on macOS |
| `sync_project` | No-op placeholder; delegates to `@curaye/sync` in a future spec |
| `get_ai_config` | Read AI provider config from `~/.curaye/config.yaml` → `AiProviderConfig \| null` |
| `write_ai_config` | Persist AI provider config to `~/.curaye/config.yaml` atomically |
| `start_ai_stream` | Begin streaming AI completion; emits `ai-stream` Tauri events (Token / Done / Error) |
| `cancel_ai_stream` | Abort the in-flight stream task |
| `scan_backlog` | Scan all registered projects → `Vec<BacklogSpec>` (planned specs with `status: draft \| ready`) |
| `update_spec_status` | Atomically patch `status` and `updated` in a spec's frontmatter file |

All file writes use atomic `write_atomic` (write `.tmp`, then `fs::rename`).

## Tauri capabilities (`src-tauri/capabilities/default.json`)

Grants `core:default`, `core:event:allow-listen`, `core:event:allow-unlisten`, `core:event:allow-emit`, and `dialog:default`. Tauri v2 blocks event listeners without explicit `core:event:allow-listen` — this file is required for the AI streaming event bus.

## Zustand stores (`src/stores/`)

| Store | Holds |
|---|---|
| `useProjectStore` | Registry projects list, selected project name, sync refresh interval |
| `useTreeStore` | `ProjectTree` for selected project, expanded sections, selected doc path |
| `useEditorStore` | Parsed document, unsaved flag, mode (structured/raw), validation issues, active highlighted field |
| `useConfigStore` | Theme, left/middle panel widths — persisted to localStorage |
| `usePaletteStore` | AI palette phase (input/streaming/diff), query, resolved action, streamed text, diff lines, AI config cache |
| `useViewStore` | Active view mode — `'main'` (three-panel layout) or `'backlog'` (cross-project backlog overlay) |
| `useBacklogStore` | Aggregated planned specs from all registered projects, filter/sort state, `updateStatus` / `shelveSpec` / `openSpec` actions |

## Components (`src/components/`)

- **`ProjectsSidebar`** — reads registry on mount; refreshes sync status every 30 s; right-click context menu (Reveal in Finder / Sync now / Unlink); "Add project" triggers `pick_directory`. Footer contains "Backlog" toggle and `SettingsTrigger`.
- **`DocumentTree`** — renders `planned/`, `current/`, `shipped/`, `decisions/`, root docs; status-badge dots (draft=grey, ready=blue, building=amber, done=green, shelved=dim); draft items (`_` prefix) grouped under "Drafts" subsection; red `AlertCircle` on items with validation errors; `+` button per section creates a new document and focuses the `title` field.
- **`DocumentEditor`** — structured mode: segmented controls for status/effort/impact/desire, tag inputs for requires/tags, text inputs for release/created/updated; `updated` auto-fills to today on any field change. Raw mode: plain textarea for full file content. Mode switch round-trips via `serialize_document` / `parse_raw`. `⌘S` saves. Navigating away with unsaved changes shows a Save / Discard / Cancel prompt. Validation tray below editor lists errors and warnings; clicking an issue highlights the relevant field.
- **`ResizablePanels`** — drag-handle dividers; clamps panel widths to sane min/max values.
- **`BacklogView`** — fixed full-screen overlay (z-40) activated when `useViewStore.view === 'backlog'`. Left panel: 2×2 impact/desire matrix with four labelled quadrants ("Build next" highlighted) plus an "Unscored" section for specs missing either field. Right panel: filterable (project, status, effort, impact, desire) sortable list with inline `StatusChip` components that cycle `draft → ready → building` on click, and per-row action menus (Open spec / Shelve). "Open spec" switches back to main view and navigates to the correct project + document. "Refresh" re-runs `scan_backlog`.
- **`AIPalette`** — `⌘K` modal with three phases: (1) input: free-text query + suggestion chips; (2) streaming: token-by-token output with blinking cursor, Cancel button; (3) diff: side-by-side Before/After view with Apply / Edit first / Discard actions. Does not open if a text input has focus. Restores focus on close. Shows an "AI not configured" view when no provider is set.
- **`SettingsDrawer`** (`SettingsTrigger`) — right-side drawer with a theme picker (four swatches) and an AI provider section. Supports Anthropic (API key + model), Ollama (base URL + model), and OpenAI-compatible servers (API key optional, custom base URL for Jan/LM Studio). Saves via `write_ai_config` and refreshes `usePaletteStore` immediately.

## UI component library (`src/components/ui/`)

Exact copy of ilmgah's glass-ui components (Phases 0–6 complete). Boundary rule: files in `src/components/ui/` may only import from `@base-ui/react`, `tailwind` classes, sibling `ui/` files, and `@/lib/utils`. No store or app-specific imports.

Components present: `Switch`, `Tooltip`, `Tabs`, `Dialog`, `Drawer`, `Menu`, `Popover`, `ProgressRing`, `ColorSwatch`, `NativeSlider`.

## Theme system (`src/styles/`)

`glass.css` defines four themes via `[data-theme]` attributes on `<html>`:

| Theme | Mood |
|---|---|
| `raat` | Mushaira night — dark warm (default) |
| `neel` | Indigo night — dark cool |
| `saffron` | Warm parchment — light |
| `chaadar` | Cotton white — light clean |

Each theme sets full CSS custom property palettes plus `--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-shadow` tokens used by all overlay components.

## Package dependency

`@curaye/desktop` depends on: `@curaye/core`, `@curaye/sync`, `@curaye/ai`, `@curaye/ui`. It must never be imported by any package.

## What is not yet built

- Release planning / kanban → spec `12-release-planning`
- Settings and configuration UI → future spec
- Real sync status from git (current `sync_project` command is a no-op)
- Production bundle icons (`.icns`, `.ico`)
