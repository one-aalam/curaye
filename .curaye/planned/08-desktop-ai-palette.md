---
id: desktop-ai-palette
title: Desktop — AI Command Palette
status: building
effort: m
impact: high
desire: high
requires: [desktop-app, package-ai]
tags: [desktop, ai, ui]
created: 2026-07-21
updated: 2026-07-22
---

# Desktop — AI Command Palette

> `⌘K` anywhere in the app. Resolves intent, writes to files, closes. AI as a tool — not a persistent thread.

## Problem

AI features scattered across buttons and menus fragment the experience and make discoverability poor. A command palette gives every AI action a single, keyboard-driven entry point that feels fast and purposeful rather than embedded and chatty.

## Goal

Implement the `⌘K` AI command palette for the desktop app: a modal input that accepts natural-language intent, resolves it to a specific AI action, executes it with streaming feedback, and writes the result to disk.

## Non-goals

- A persistent chat panel or conversational memory across invocations.
- Non-AI commands in the palette (those belong in a separate command palette spec).
- Actions that require the user to review output in an external editor — the palette handles the full flow inline.

## Trigger and appearance

`⌘K` opens the palette from anywhere in the app. It overlays the current view as a centred modal with a backdrop blur. `Escape` closes it at any point without saving.

```
┌─────────────────────────────────────────────────────┐
│  ⌘K                                                 │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🔍  What do you want to do?                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Suggestions                                        │
│  ────────────────────────────────────────────────  │
│  ✦  Draft a spec                                    │
│  ✦  Re-entry brief for current project              │
│  ✦  Update current/ from shipped spec               │
│  ✦  Detect drift in this project                    │
│  ✦  Find where I solved this before                 │
└─────────────────────────────────────────────────────┘
```

## Action resolution

The input is free-form. As the user types, the palette matches against known actions:

| User input pattern | Resolved action |
|---|---|
| "draft a spec for X" | `draft-spec` with title X |
| "brief" / "where was I" | `reentry-brief` for current project |
| "update current" / "ship X" | `update-current` for spec X |
| "find where I solved X" | `semantic-search` for X |
| "promote X to shared" | `promote` for X |
| "detect drift" | `drift-detection` for current project |
| "generate acceptance criteria" | `generate-ac` for open document |

Unrecognised input falls through to a generic completion action with the full input as the prompt, scoped to the open document's context.

## Execution flow

After action resolution, the palette transitions to an execution view:

```
┌─────────────────────────────────────────────────────┐
│  Drafting: "Auto-scroll hands-free reading"         │
│  ─────────────────────────────────────────────────  │
│  # Auto-scroll                                      │
│                                                     │
│  ## Problem                                         │
│  Readers who prefer visual reading have no hands-   │
│  free mode beyond TTS...                            │
│                                             ▌       │  ← streaming cursor
│                                                     │
│  [ Save to planned/ ]        [ Discard ]            │
└─────────────────────────────────────────────────────┘
```

- Output streams token-by-token.
- "Save" writes the result to disk (path is auto-determined by action type).
- "Discard" closes without writing.
- `Escape` during streaming cancels the request and closes.

For actions that update an existing file (e.g., `update-current`), a diff view replaces the streaming view once generation is complete:

```
  Before          │   After (proposed)
  ──────────────  │  ──────────────────
  ## Reader       │  ## Reader
  ...old text...  │  ...updated text...
```

"Apply" writes the new version. "Edit first" opens it in the main editor. "Discard" closes.

## Context awareness

The palette reads the current app state to pre-fill context:

- If a document is open in the editor, its id and type are included in every prompt.
- If a project is selected, its `prd.md` and `stack.md` are included as system context.
- `⌘K` with a text selection in the editor pre-fills the input with the selected text and suggests relevant actions (generate AC from selected goal, explain this section, etc.).

## AI unavailable state

If no provider is configured or reachable, the palette opens but shows:

```
  AI is not configured.
  Set up a provider in Settings → AI to use these features.
```

The rest of the app works normally.

## Acceptance criteria

1. `⌘K` opens the palette from the project sidebar, tree panel, and editor panel.
2. Typing "draft a spec for dark mode" and pressing Enter resolves to `draft-spec` and begins streaming.
3. Streamed output is visible token-by-token with a blinking cursor at the insertion point.
4. Pressing `Escape` during streaming cancels the in-flight request cleanly with no partial file written.
5. "Save" after drafting writes a valid `.md` file to `planned/` with correct frontmatter and opens it in the editor.
6. `update-current` shows a diff view before applying changes.
7. The palette includes the open document's id in the context sent to the provider — the draft for `ask-the-book` mentions the reader, not a generic app.
8. With no AI provider configured, the palette opens and shows the setup prompt rather than an error.
9. `⌘K` with the cursor in the title field of the editor does not steal focus from the field.
10. Closing the palette with `Escape` restores focus to the element that was focused before the palette opened.
