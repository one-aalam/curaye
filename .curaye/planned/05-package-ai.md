---
id: package-ai
title: "@curaye/ai — Provider Abstraction"
status: ready
effort: m
impact: high
desire: high
requires: [monorepo-scaffold]
tags: [ai]
created: 2026-07-21
updated: 2026-07-21
---

# @curaye/ai — Provider Abstraction

> A thin, provider-agnostic AI layer. No LangChain, no Vercel AI SDK. Three supported providers, one interface.

## Problem

Curaye uses AI for spec drafting, re-entry briefs, pattern detection, and more. These features should not be coupled to a single provider. A user running Ollama locally and a user with an Anthropic API key should get the same feature set.

## Goal

Implement `@curaye/ai`: a `Provider` interface with three concrete implementations (Ollama, Anthropic, OpenAI), streaming support, embeddings for semantic search, and a factory function driven by configuration. No `@curaye/*` dependencies.

## Non-goals

- Prompt construction — prompts live in the feature code that calls this package.
- Tool use / function calling — not needed in v1.
- Conversation memory — callers pass the full message history.
- Model management or download — Ollama model management is out of scope.

## Provider interface

```ts
export interface Message {
  role:    'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  model?:       string
  maxTokens?:   number
  temperature?: number
}

export interface Provider {
  complete(messages: Message[], opts?: CompletionOptions): Promise<string>
  stream(messages: Message[], opts?: CompletionOptions): AsyncIterable<string>
  embed(text: string): Promise<number[]>
  readonly name: string
  readonly defaultModel: string
}
```

`stream` yields token strings as they arrive. Callers consume with `for await`.

## Configuration

Provider config lives in `~/.curaye/config.yaml` (user-level, never synced):

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

## Factory

```ts
export interface AiConfig {
  provider: 'ollama' | 'anthropic' | 'openai'
  ollama?:    { baseUrl: string; model: string }
  anthropic?: { apiKey: string; model: string }
  openai?:    { apiKey: string; model: string }
}

export function createProvider(config: AiConfig): Provider
// Returns the appropriate provider instance. Throws ProviderConfigError
// if the selected provider's config is missing.

export async function readAiConfig(): Promise<AiConfig | null>
// Reads ~/.curaye/config.yaml. Returns null if absent.

export function isAvailable(config: AiConfig | null): boolean
// Returns false if config is null or the selected provider's required
// fields (e.g. apiKey) are missing.
```

## Provider implementations

**Ollama** — calls `http://localhost:11434/api/chat` (chat completions) and `/api/embeddings`. Uses `fetch`. Streams via the NDJSON response format.

**Anthropic** — calls `https://api.anthropic.com/v1/messages`. Uses `fetch` with the `anthropic-version` header. Streams via SSE. Model defaults to `claude-haiku-4-5-20251001` — fast, cost-effective for spec drafting and summarisation.

**OpenAI** — calls `https://api.openai.com/v1/chat/completions`. Uses `fetch`. Streams via SSE.

All three use native `fetch`. No provider SDKs.

## Error types

```ts
export class ProviderConfigError extends Error {}  // missing required config
export class ProviderUnavailableError extends Error {}  // network/connection failure
export class ProviderAuthError extends Error {}    // 401/403 from API
```

## Acceptance criteria

1. `createProvider({ provider: 'ollama', ollama: { baseUrl: '...', model: '...' } })` returns a provider whose `name` is `'ollama'`.
2. `provider.complete([{ role: 'user', content: 'hello' }])` returns a non-empty string when the provider is reachable.
3. `provider.stream(messages)` yields at least one token chunk before the response is complete.
4. `provider.embed('hello world')` returns a `number[]` of length > 0.
5. `createProvider` with an unsupported provider string throws `ProviderConfigError`, not a runtime type error.
6. `isAvailable(null)` returns `false`.
7. `isAvailable({ provider: 'anthropic' })` (missing `anthropic.apiKey`) returns `false`.
8. All three providers produce the same TypeScript interface — swapping provider in config requires no calling-code changes.
9. `@curaye/ai`'s `package.json` has no `@curaye/*` entries in `dependencies`.
10. A network failure during `stream` surfaces as `ProviderUnavailableError` thrown from the async iterator, not a silent hang.
