---
id: desktop-ai-palette
title: "Desktop — AI Command Palette"
shipped: 2026-07-22
release: ""
spec_ref: "desktop-ai-palette"
---

# Desktop — AI Command Palette

> Shipped on 2026-07-22.

## What shipped

`AIPalette` — a three-phase modal (input → streaming → diff) wired to `⌘K` globally. `paletteStore` (Zustand) drives action resolution, streaming, diff computation (LCS), and file writes. `aiClient.ts` tunnels streaming through Tauri events (`ai-stream`) rather than fetch, bypassing WebView header restrictions. Four new Tauri commands were added to the Rust backend: `get_ai_config`, `write_ai_config`, `start_ai_stream`, `cancel_ai_stream` — each provider (Anthropic, Ollama, OpenAI-compat) implemented natively via `reqwest` with SSE parsing. `SettingsDrawer` adds a Settings panel with theme picker and AI provider configuration (provider, model, API key, base URL). A `capabilities/default.json` was added to grant `core:event:allow-listen` — without it Tauri v2 blocks `listen()` entirely.

## Changes to current/

- `current/desktop.md` — add AIPalette, SettingsDrawer, paletteStore, and the four AI Tauri commands; remove the "not yet built" entry for this spec; add Tauri v2 capabilities config note.
- `current/ai.md` — note that the desktop Rust backend has its own native streaming implementation reading the same `~/.curaye/config.yaml` format, and that the `openai` provider now accepts a `baseUrl` field for OpenAI-compatible local servers (Jan, LM Studio).

## Notes

The desktop AI streaming bypasses `@curaye/ai` (Node package) entirely — the Rust backend calls providers directly. This avoids the Node → Tauri sidecar complexity but means the desktop and CLI have separate provider implementations. A future spec may unify them via a sidecar. The fake `Bearer local` header that caused 401s on Jan was removed; local servers now receive no `Authorization` header unless `apiKey` is explicitly configured.
