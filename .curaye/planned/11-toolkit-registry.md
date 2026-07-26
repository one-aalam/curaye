---
id: toolkit-registry
title: "Toolkit Registry — Preferred Starters, Frameworks & Tools by Stack"
status: building
effort: m
impact: high
desire: high
requires: [cli, shared-layer, scaffold-command]
tags: [cli, desktop, shared-layer]
created: 2026-07-26
updated: 2026-07-26
---

# Toolkit Registry — Preferred Starters, Frameworks & Tools by Stack

> A toolkit preset is a shared stack document with structured frontmatter declaring the preferred starter kit, design system, and toolchain for a given runtime and app type. `curaye toolkit` manages presets from the CLI; the desktop renders them as structured cards in the Shared Layer Panel. At scaffold time, presets are scored and ranked against the detected stack so the right generator and toolchain surface automatically.

## Problem

The scaffold command detects stack signals from `stack.md` and matches them against a built-in generator table. This table is hardcoded in the CLI, cannot be extended without a CLI release, and knows nothing about team-level preferences — which formatter, which test runner, which design system a developer uses across all their projects.

There is also no place to record "I always start Tauri projects with `create-tauri-app`, Biome, Vitest, and shadcn/ui" in a way that Curaye can act on. Shared stack documents are close, but they have no structured machine-readable schema — they are prose documents with minimal frontmatter.

## Goal

- Shared stack documents in `~/.curaye/shared/stack/` gain a defined structured frontmatter schema that captures runtime, app type, framework, starter kit, design system, and preferred tools.
- `curaye toolkit` provides a focused interface for creating and managing these presets without touching the underlying `curaye shared` commands.
- The desktop Shared Layer Panel gains a Toolkit view: structured cards with a form editor for preset fields, not a raw markdown editor.
- At scaffold time, presets are scored against the detected stack and the best match is offered — replacing the built-in table as the primary source of truth, with the built-in table as fallback.
- When a matching preset includes a design system or post-install tools, scaffold emits a `NEXT_STEPS.md` listing what to run after `pnpm install` (or equivalent).

## Non-goals

- Running `npm install`, `pnpm install`, `cargo build`, or any build step. Presets declare what to run; scaffold never runs package managers.
- Running design system setup commands (e.g. `npx shadcn@latest init`). These appear in `NEXT_STEPS.md` only.
- Enforcing presets on existing projects. Toolkit presets are consulted at scaffold time only.
- Replacing the `curaye shared` commands. `curaye toolkit` is a focused view over the `stack` category — both interfaces coexist.
- Managing non-stack shared categories. Decisions, patterns, design, and agents are outside the toolkit scope.

## Shared stack document schema

All fields except `id` and `title` are optional. Documents without toolkit fields remain valid shared stack documents — they just produce no scaffold matches.

```yaml
---
# Required (existing)
id: tauri-react
title: "Tauri + React"

# Toolkit fields (new)
runtime: [node, rust]          # one or more of: node, rust, python, go, bun, ruby, java, dotnet
app_type: desktop              # one of: desktop, web, cli, api, mobile, library
framework: [tauri, react]      # free-form list; matched against stack.md body
starter_kit: create-tauri-app  # human-readable generator name
starter_kit_cmd: npx create-tauri-app   # command scaffold will spawn
design_system: shadcn/ui       # free-form string; appears in NEXT_STEPS.md
tools:
  formatter: biome
  linter: biome
  test: vitest
  e2e: playwright

# Existing shared-layer fields (unchanged)
adopted_by: []
source_project: myproject
promoted: 2026-07-26
---

Body prose: rationale, notes, links. Written by the user. Not parsed by scaffold.
```

`runtime`, `app_type`, and `framework` are the scoring dimensions. `starter_kit_cmd` is what scaffold spawns. `design_system` and `tools` populate `NEXT_STEPS.md`.

## Scoring and matching

At scaffold time, every document in `~/.curaye/shared/stack/` that has at least one toolkit field is treated as a candidate. Each candidate is scored against the stack signals detected in the project's `stack.md`:

| Dimension | Match condition | Points |
|---|---|---|
| `app_type` | Detected app type equals preset `app_type` | +4 |
| `runtime` | Each detected runtime present in preset `runtime` list | +2 each |
| `framework` | Each detected framework token present in preset `framework` list (case-insensitive) | +2 each |

Detection reads all non-frontmatter text in `stack.md` with case-insensitive substring matching. Known token groups for detection:

| Runtime tokens | Runtime id |
|---|---|
| `Node`, `npm`, `pnpm`, `yarn`, `bun` | node |
| `Rust`, `Cargo` | rust |
| `Python`, `pip`, `uv`, `poetry` | python |
| `Go`, `golang` | go |
| `Bun` (when not also Node context) | bun |
| `Java`, `Maven`, `Gradle` | java |
| `.NET`, `C#`, `dotnet` | dotnet |
| `Ruby`, `Bundler`, `Rails` | ruby |

| App type tokens | App type id |
|---|---|
| `Tauri`, `Electron` | desktop |
| `Next`, `Astro`, `Remix`, `SvelteKit` | web |
| `CLI`, `commander`, `clap`, `yargs`, `typer`, `cobra` | cli |
| `Express`, `Fastify`, `FastAPI`, `Axum`, `Gin`, `Hono` | api |
| `React Native`, `Expo`, `Flutter` | mobile |
| `library`, `package`, `crate`, `gem` | library |

**Ranking rules:**
- Candidates with score 0 are excluded.
- If exactly one candidate has the highest score → offer it directly ("Use preset X? [y/n]").
- If multiple candidates tie for the highest score → show a ranked list to choose from.
- If no candidate scores above 0 → fall back to the built-in generator table in the scaffold command.
- If the built-in table also has no match → skip to the overlay phase (fallback directories).

The matching result is included in `--json` output under `"toolkit_match"`.

## `curaye toolkit` commands

A focused interface over `~/.curaye/shared/stack/` scoped to documents that have toolkit frontmatter fields. Internally delegates to `SharedLayer` read/write — no separate file store.

```
curaye toolkit list [--runtime <id>] [--app-type <type>] [--json]
curaye toolkit add [--json]
curaye toolkit show <id> [--json]
curaye toolkit edit <id>
curaye toolkit remove <id>
```

### `curaye toolkit list`

Lists all shared stack documents that have at least one toolkit field. Filters by `--runtime` or `--app-type` when provided.

Human output:
```
tauri-react      desktop · node, rust · create-tauri-app
turbo-node       web     · node       · create-turbo
python-fastapi   api     · python     · (no starter kit)
```

JSON output: array of `{ id, title, runtime, app_type, framework, starter_kit, starter_kit_cmd, design_system, tools }`.

### `curaye toolkit add`

Guided interview that writes a new shared stack document with toolkit frontmatter. Questions:

1. **Preset id** (slug) — used as the filename and `id` field.
2. **Title** — human-readable name.
3. **Runtime(s)** — multiselect from known runtime ids + Other.
4. **App type** — select from known app type ids + Other.
5. **Framework(s)** — free-text, comma-separated (e.g. `tauri, react`).
6. **Starter kit name** — free-text, optional (e.g. `create-tauri-app`). Skip to omit.
7. **Starter kit command** — free-text, optional (e.g. `npx create-tauri-app`). Pre-filled from known kits if name matches. Skip to omit.
8. **Design system** — free-text, optional (e.g. `shadcn/ui`). Skip to omit.
9. **Tools** — four optional free-text prompts for formatter, linter, test runner, e2e runner. Each skippable.

The body is written as a stub: `> Add rationale and notes here.`

On completion, writes `~/.curaye/shared/stack/<id>.md` atomically. Does not notify other projects — toolkit presets are personal or team defaults, not content updates.

`--json` mode: reject with "toolkit add is an interactive flow".

### `curaye toolkit show`

Prints the full document (frontmatter + body). Equivalent to `curaye shared show <id>` scoped to the stack category.

### `curaye toolkit edit`

Opens the document in `$EDITOR`. Equivalent to the existing edit flow for shared documents. The user edits raw frontmatter and body directly.

### `curaye toolkit remove`

Deletes `~/.curaye/shared/stack/<id>.md`. Prompts for confirmation first. Errors if the file does not exist.

## Desktop — Toolkit view in Shared Layer Panel

The Shared Layer Panel currently has five category tabs: Decisions, Patterns, Design, Agents, Stack. The Stack tab gains a second rendering mode: **Cards** (new) and **Edit** (existing raw markdown editor).

### Cards mode (default for Stack tab)

Each shared stack document with toolkit fields is rendered as a structured card:

```
┌─────────────────────────────────────────────────────┐
│  tauri-react                            [Edit] [✕]  │
│  Tauri + React                                       │
│                                                      │
│  desktop  ·  node  rust                              │
│  Frameworks:  tauri, react                           │
│                                                      │
│  Starter kit:  create-tauri-app                      │
│  npx create-tauri-app                                │
│                                                      │
│  Design system:  shadcn/ui                           │
│  Tools:  biome · vitest · playwright                 │
└─────────────────────────────────────────────────────┘
```

Documents without any toolkit fields are shown below the cards in a plain list (the existing doc list behaviour) under a "Stack docs (no preset)" heading.

An **Add preset** button at the top opens the preset form modal.

### Preset form modal

A structured form (not a markdown editor) for creating and editing preset fields. Fields map directly to the frontmatter schema. The body (prose rationale) is an optional freetext area at the bottom of the form.

On save, writes the document via `write_toolkit_preset` Tauri command.

Cancelling discards unsaved changes.

### Tauri commands

| Command | Purpose |
|---|---|
| `list_toolkit_presets` | List all `~/.curaye/shared/stack/` docs with parsed toolkit frontmatter. Returns `Vec<ToolkitPreset>`. |
| `get_toolkit_preset` | Read a single preset by id. Returns `ToolkitPreset \| null`. |
| `write_toolkit_preset` | Atomically write a toolkit preset (frontmatter + body). Creates or updates. Does not notify other projects. |
| `delete_toolkit_preset` | Delete `~/.curaye/shared/stack/<id>.md`. Errors if absent. |
| `match_toolkit_preset` | Accept raw `stack_md_content: String`, run the scoring algorithm, return `Vec<ToolkitMatch>` sorted by score descending. Used by scaffold and optionally exposed in the desktop for preview. |

```rust
struct ToolkitPreset {
    id:               String,
    title:            String,
    runtime:          Vec<String>,
    app_type:         Option<String>,
    framework:        Vec<String>,
    starter_kit:      Option<String>,
    starter_kit_cmd:  Option<String>,
    design_system:    Option<String>,
    tools:            ToolkitTools,
    body:             String,
    file_path:        String,
}

struct ToolkitTools {
    formatter: Option<String>,
    linter:    Option<String>,
    test:      Option<String>,
    e2e:       Option<String>,
}

struct ToolkitMatch {
    preset: ToolkitPreset,
    score:  u32,
}
```

## NEXT_STEPS.md

Scaffold writes `NEXT_STEPS.md` to the project root when the matched preset has a `design_system` or any `tools` field. Written only if the file does not already exist.

```markdown
# Next steps

Complete these after your initial install:

## Install

```sh
pnpm install       # or npm install / cargo build
```

## Design system

```sh
npx shadcn@latest init
```

## Tools

| Role | Tool |
|---|---|
| Formatter | Biome |
| Linter | Biome |
| Tests | Vitest |
| E2E | Playwright |

Run `npx playwright install` to install browser binaries.
```

When no matching preset is found (built-in table fallback or no match), `NEXT_STEPS.md` is not written.

## Error handling

| Condition | Behaviour |
|---|---|
| `~/.curaye/shared/stack/` empty or absent | `curaye toolkit list` prints "No toolkit presets found. Run `curaye toolkit add` to create one." Scaffold falls back to built-in table. |
| Preset with no `starter_kit_cmd` matches at scaffold time | Offer it in the ranked list but note "(no starter kit configured)" — the overlay phase still runs. |
| `write_toolkit_preset` with duplicate id | Overwrite in place (update semantics, consistent with `write_shared_doc`). |
| `delete_toolkit_preset` for missing id | Exit non-zero with clear message. |
| `match_toolkit_preset` with empty `stack.md` | Return empty match list; scaffold falls back to built-in table. |

## Acceptance criteria

1. A shared stack document with `runtime`, `app_type`, `framework`, `starter_kit`, and `starter_kit_cmd` frontmatter fields is written and read correctly by `SharedLayer` without modification to existing fields.
2. `curaye toolkit list` shows only shared stack documents that have at least one toolkit field.
3. `curaye toolkit list --runtime node` filters to presets whose `runtime` array includes `node`.
4. `curaye toolkit add` runs the nine-question interview and writes a valid shared stack document to `~/.curaye/shared/stack/<id>.md`.
5. `curaye toolkit remove <id>` prompts for confirmation, then deletes the file; it errors clearly when the id does not exist.
6. The scoring algorithm awards +4 for `app_type` match, +2 per matched `runtime`, +2 per matched `framework` token.
7. When exactly one preset has the highest score, scaffold prompts "Use preset X? [y/n]" before spawning the generator.
8. When multiple presets tie for the highest score, scaffold shows a ranked list and lets the user choose.
9. When no preset scores above 0, scaffold falls back to the built-in generator table.
10. `match_toolkit_preset` returns results sorted by score descending and is usable from both the CLI (scaffold) and the desktop.
11. The Stack tab in the Shared Layer Panel renders preset documents as structured cards showing all toolkit fields.
12. Documents in `~/.curaye/shared/stack/` without toolkit fields are listed below the cards under "Stack docs (no preset)" — they are not silently hidden.
13. The Add Preset button opens a form modal; submitting it calls `write_toolkit_preset` and the card list refreshes.
14. Editing a card via the Edit button opens the form modal pre-populated with current field values; saving calls `write_toolkit_preset`.
15. `NEXT_STEPS.md` is written to the project root when the matched preset has `design_system` or any `tools` field, and is skipped if already present.
16. `NEXT_STEPS.md` correctly lists the design system setup command and a tool table derived from the preset's `tools` fields.
17. When no preset matches and the built-in table is used as fallback, `NEXT_STEPS.md` is not written.
18. `--json` output from `curaye scaffold` includes a `"toolkit_match"` field: `{ id, score, source: "preset" | "builtin" | null }`.
