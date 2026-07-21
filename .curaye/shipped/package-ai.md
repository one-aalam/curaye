---
id: package-ai
title: "@curaye/ai — Provider Abstraction"
shipped: 2026-07-21
release: ""
spec_ref: "package-ai"
---

# @curaye/ai — Provider Abstraction

> Shipped on 2026-07-21

## What shipped

`packages/ai/` was fully implemented as a provider-agnostic AI abstraction layer. The package exports a `Provider` interface with `complete()`, `stream()`, and `embed()` methods; three concrete implementations — `OllamaProvider` (NDJSON streaming), `AnthropicProvider` (SSE), and `OpenAIProvider` (SSE) — all using native `fetch` with no provider SDKs. The factory `createProvider(config: AiConfig)` instantiates the correct provider from config, `readAiConfig()` reads `~/.curaye/config.yaml`, and `isAvailable(config)` checks whether required fields are present. Three typed error classes cover config, auth, and network failures. The CLI `ai` command was updated to use the new `readAiConfig` / `isAvailable` API and the nested `AiConfig` shape.

## Changes to current/

- `current/packages.md` — add `@curaye/ai` package entry describing the provider interface, factory, and config convention.

## Notes

Anthropic does not expose a public embeddings endpoint, so `AnthropicProvider.embed()` throws `ProviderUnavailableError`. Users needing embeddings should use Ollama or OpenAI. A follow-up spec can formalise which providers are embedding-capable and surface this via a capability flag on the `Provider` interface.
