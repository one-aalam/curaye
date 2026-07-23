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
| `scan_project` | Scan a `.curaye/` path → `ProjectTree` with all sections (including `releases: Vec<ReleaseSummary>`) |
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
| `scan_releases` | Scan `.curaye/releases/` → `Vec<ReleaseSummary>` with `total`/`done` spec counts per release |
| `scan_release_specs` | Scan planned specs for a given release id → `Vec<ReleaseSpecItem>` (all non-shelved statuses) |
| `create_release` | Write a new `.curaye/releases/<id>.md` with `status: planning` |
| `assign_spec_to_release` | Patch the `release` field in a spec's frontmatter (replaces previous value) |
| `update_release_status` | Patch the `status` and `updated` fields in a release document |
| `ship_release` | Create `shipped/` docs for all `status: done` specs in a release, delete their `planned/` files, mark release `status: shipped` |
| `generate_brief_context` | Scan a `.curaye/` path and return structured `BriefContext` (planned specs, current docs, decisions, prd/stack content, last activity date) for use in brief generation |
| `save_brief` | Write a brief string to `.curaye/briefs/<date>.md` atomically; returns the saved path |
| `get_last_opened` | Read when a project was last opened in the desktop from `~/.curaye/desktop-state.json`; returns `Option<String>` date |
| `set_last_opened` | Write today's date for a project to `~/.curaye/desktop-state.json` |

All file writes use atomic `write_atomic` (write `.tmp`, then `fs::rename`).

Desktop-specific state (last-opened dates per `curaye_path`) is stored at `~/.curaye/desktop-state.json` — separate from the protocol registry so app-specific metadata stays out of the sync-tracked files.

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
| `useViewStore` | Active view mode — `'main'` (three-panel layout), `'backlog'`, or `'releases'`; `currentReleaseId` for the open kanban; `openRelease(id)` action |
| `useBacklogStore` | Aggregated planned specs from all registered projects, filter/sort state, `updateStatus` / `shelveSpec` / `openSpec` actions |
| `useReleaseStore` | Release detail (id, title, status, target, specs) for the currently open kanban; `loadRelease`, `updateSpecStatus`, `shipRelease` actions |
| `useBriefStore` | Brief state: `active` (whether BriefView is showing), `streaming`, `content` (accumulated text), `context` (`BriefContext` from backend), `suggestedSpecPath` for "Start working", `isDormant` (project not opened >30 days), `lastOpenedDate`. Actions: `generateBrief` (calls backend, then either builds deterministic brief or streams via `start_ai_stream`), `cancelBrief`, `saveBrief`, `closeBrief`, `loadLastOpened`, `recordOpened`. |

## Components (`src/components/`)

- **`ProjectsSidebar`** — reads registry on mount; refreshes sync status every 30 s; right-click context menu (Reveal in Finder / Sync now / Unlink); "Add project" triggers `pick_directory`. Footer contains "Backlog" toggle and `SettingsTrigger`.
- **`DocumentTree`** — renders a project name header with a "Brief" button (always visible; highlighted amber when the project is dormant), a `ReentryBanner` (shows when `isDormant` from `useBriefStore` — project not opened in >30 days — dismissed per-session), followed by `planned/`, `current/`, `shipped/`, `decisions/`, root docs, and a `releases/` section. Status-badge dots (draft=grey, ready=blue, building=amber, done=green, shelved=dim); draft items (`_` prefix) grouped under "Drafts" subsection; red `AlertCircle` on items with validation errors; `+` button per section creates a new document and focuses the `title` field. The `releases/` section shows per-release progress bars (`done/total`); shipped releases are collapsed under a "Shipped (N)" toggle by default; clicking a release sets `view = 'releases'` and opens `ReleaseView`.
- **`DocumentEditor`** — structured mode: segmented controls for status/effort/impact/desire, tag inputs for requires/tags, text inputs for release/created/updated; `updated` auto-fills to today on any field change. Raw mode: plain textarea for full file content. Mode switch round-trips via `serialize_document` / `parse_raw`. `⌘S` saves. Navigating away with unsaved changes shows a Save / Discard / Cancel prompt. Validation tray below editor lists errors and warnings; clicking an issue highlights the relevant field.
- **`ResizablePanels`** — drag-handle dividers; clamps panel widths to sane min/max values.
- **`BacklogView`** — fixed full-screen overlay (z-40) activated when `useViewStore.view === 'backlog'`. Left panel: 2×2 impact/desire matrix with four labelled quadrants ("Build next" highlighted) plus an "Unscored" section for specs missing either field. Right panel: filterable (project, status, effort, impact, desire) sortable list with inline `StatusChip` components that cycle `draft → ready → building` on click, and per-row action menus (Open spec / Shelve). "Open spec" switches back to main view and navigates to the correct project + document. "Refresh" re-runs `scan_backlog`.
- **`ReleaseView`** — fixed full-screen overlay (z-40) activated when `useViewStore.view === 'releases'`. Header shows release title, status badge, optional target date, and a progress bar. Body is a four-column kanban (Draft / Ready / Building / Done); each column is an HTML5 drop target; dragging a card between columns calls `update_spec_status` on drop, writing the new status to the spec file immediately. "Ship release" button (visible when ≥1 `done` spec exists) calls `ship_release` to create shipped docs, remove planned files, and mark the release `shipped`. Cards show spec title and effort badge.
- **`BriefView`** — replaces `DocumentEditor` in the right panel when `useBriefStore.active` is true. Renders the brief as a monospace pre-formatted block with a blinking cursor while streaming. Header has Save (writes to `.curaye/briefs/`) and "Start working" buttons; "Start working" opens `suggestedSpecPath` in the editor and closes the brief. X button cancels any in-flight stream and dismisses.
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

- Settings and configuration UI → future spec
- Real sync status from git (current `sync_project` command is a no-op)
- Production bundle icons (`.icns`, `.ico`)
