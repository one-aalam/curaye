---
id: ai
title: "@curaye/ai — Provider Abstraction"
domain: ai
updated: 2026-07-21
---

# @curaye/ai — Provider Abstraction

## Overview

`@curaye/ai` is a thin, provider-agnostic AI layer with no `@curaye/*` dependencies. It exposes a single `Provider` interface implemented by three concrete providers: Ollama, Anthropic, and OpenAI. All network calls use native `fetch`; no provider SDKs are used.

## Provider interface

```ts
interface Provider {
  complete(messages: Message[], opts?: CompletionOptions): Promise<string>
  stream(messages: Message[], opts?: CompletionOptions): AsyncIterable<string>
  embed(text: string): Promise<number[]>
  readonly name: string
  readonly defaultModel: string
}
```

`stream()` yields token strings as they arrive via `for await`. `embed()` returns a `number[]` embedding vector (Ollama and OpenAI only — Anthropic throws `ProviderUnavailableError`).

## Configuration shape

Provider config is read from `~/.curaye/config.yaml` under an `ai:` key:

```yaml
ai:
  provider: ollama          # ollama | anthropic | openai
  ollama:
    baseUrl: http://localhost:11434
    model:   llama3.1:8b
  anthropic:
    apiKey:  sk-ant-...
    model:   claude-haiku-4-5-20251001
  openai:
    apiKey:  sk-...
    model:   gpt-4o-mini
```

## Public API

| Export | Description |
|---|---|
| `createProvider(config)` | Returns the configured `Provider`. Throws `ProviderConfigError` if the selected provider's sub-config is missing. |
| `readAiConfig()` | Reads `~/.curaye/config.yaml`. Returns `AiConfig \| null`. |
| `isAvailable(config)` | Returns `false` if config is `null` or required fields (e.g. `apiKey`) are absent. |

## Error types

| Class | When thrown |
|---|---|
| `ProviderConfigError` | Missing or invalid provider configuration |
| `ProviderUnavailableError` | Network/connection failure, or unsupported operation (e.g. Anthropic embed) |
| `ProviderAuthError` | 401 or 403 response from provider API |

## Provider implementations

- **Ollama** — `POST /api/chat` for chat, `/api/embeddings` for embed. Streams via NDJSON (`stream: true`).
- **Anthropic** — `POST https://api.anthropic.com/v1/messages` with `anthropic-version: 2023-06-01` header. Streams via SSE. Default model: `claude-haiku-4-5-20251001`.
- **OpenAI** — `POST https://api.openai.com/v1/chat/completions`. Streams via SSE. Embeddings via `POST /v1/embeddings` with `text-embedding-3-small`.
