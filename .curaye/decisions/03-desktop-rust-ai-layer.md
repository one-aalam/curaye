---
id: desktop-rust-ai-layer
title: Native Rust AI providers in the Tauri backend instead of @curaye/ai
status: active
date: 2026-07-26
tags: [desktop, ai]
---

# Decision: Native Rust AI providers in the Tauri backend instead of @curaye/ai

## Context

The desktop app needs to stream AI completions token-by-token into the React frontend. `@curaye/ai` already implements streaming for all three providers (Ollama, Anthropic, OpenAI) in TypeScript using native `fetch` with `ReadableStream`.

The naive path would be to call `@curaye/ai` from the frontend directly. This fails for two reasons:

1. **Tauri's WebView blocks certain SSE headers from JavaScript.** Anthropic's API requires the `anthropic-version` header and the `x-api-key` header on a cross-origin SSE connection. Tauri's WebView enforces a restrictive CORS and header policy on `fetch` calls that originates from the webview process, which prevents these requests from completing. Ollama and OpenAI-compatible servers are affected by similar restrictions depending on their CORS configuration.

2. **There is no Rust FFI bridge to `@curaye/ai`.** `@curaye/ai` is a Node.js TypeScript package. The Tauri backend is a Rust binary. There is no supported mechanism to call a Node.js package from Rust in a Tauri app without introducing a sidecar process (a separately managed Node.js runtime that communicates over IPC). That is a substantial infrastructure addition for a solved problem.

The Tauri event bus (`app.emit`) exists precisely for this pattern: long-running async work in the Rust backend that needs to push incremental updates to the frontend. It is the canonical Tauri approach for streaming.

## Decision

Implement all three AI provider clients (Anthropic, Ollama, OpenAI-compatible) natively in Rust in `src-tauri/src/commands/mod.rs`, using `reqwest` for HTTP and `futures-util` for stream processing. Stream tokens to the frontend via `app.emit("ai-stream", AiStreamEvent::Token(...))` Tauri events, consumed by `aiClient.ts`.

The shared contract between the Rust and TypeScript implementations is the config file schema: both read `~/.curaye/config.yaml` under the same `ai:` key with the same field names (`provider`, `anthropic.apiKey`, `anthropic.model`, `ollama.baseUrl`, `ollama.model`, `openai.apiKey`, `openai.baseUrl`, `openai.model`).

`@curaye/ai` remains the AI layer for the CLI and skills. The desktop does not use it.

## Consequences

- The AI provider logic exists in two places: TypeScript (`@curaye/ai`) and Rust (the Tauri backend). This is intentional and must stay that way. Do not attempt to unify them.
- **When a provider's API changes** (new required header, changed streaming format, model name deprecation), both implementations need updating. Check both when making AI provider changes.
- **Keep these in sync manually:**
  - Provider defaults (model names, `max_tokens`, timeout values)
  - Config key names in `~/.curaye/config.yaml`
  - The `embed` sub-config block (currently only the Rust layer reads the `embed.provider` and `embed.model` fields for the search feature)
- The Rust implementation has a 60-second `reqwest` timeout on all provider connections. The TypeScript implementation's timeout behaviour is determined by the runtime. These should be kept equivalent.
- The desktop app's `SettingsDrawer` writes `~/.curaye/config.yaml` via `write_ai_config`. That file is then read by the CLI's `@curaye/ai` on the next invocation. Config written by either surface is immediately usable by the other.

## Alternatives considered

**Call `@curaye/ai` from the frontend directly** — fails due to WebView header restrictions on cross-origin SSE requests, as described above. Not viable.

**Node.js sidecar process** — Tauri supports sidecar binaries that communicate over IPC. A Node.js sidecar running `@curaye/ai` would allow code reuse, but introduces: a second process to manage, an IPC protocol to maintain, a Node.js runtime bundled in the app, and sidecar lifecycle management (start, crash recovery, shutdown). The implementation complexity is not justified when the Rust streaming approach works cleanly.

**Shell out to the CLI for AI operations** — `tokio::process::Command` to invoke `curaye ai draft` or `curaye ai brief`. This creates a hard runtime dependency on the CLI being installed, makes the desktop app non-functional without a separate install step, and produces no streaming output (the CLI streams to a terminal, not to a structured event bus). Not viable for an embedded UI.

**Use `complete()` instead of `stream()`** — avoid streaming entirely, wait for the full response, display it at once. Eliminates the header restriction problem. Rejected because the AI palette and brief view are designed around streaming — a visible cursor and incremental text are core to the UX. A multi-second blank wait before output appears is a significantly worse experience.
