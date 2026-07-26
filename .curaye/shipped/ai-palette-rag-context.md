---
id: ai-palette-rag-context
title: "AI Palette — RAG Context Enrichment"
shipped: 2026-07-26
release: ""
spec_ref: "ai-palette-rag-context"
---

# AI Palette — RAG Context Enrichment

> Shipped on 2026-07-26.

## What shipped

A shared `gatherRagContext` async function was added to `apps/desktop/src/stores/paletteStore.ts`. It runs before `buildMessages` for three AI palette commands — "Draft a spec", "Generate acceptance criteria", and "Find where I solved" — loading prd.md and stack.md via `generate_brief_context`, running keyword or semantic search (with silent fallback from vector to keyword when the index is absent or the provider is Anthropic), reading full document bodies via `read_document` for the top hits, and budgeting everything within a 12 000-character ceiling (800 prd + 600 stack + 10 600 distributed evenly across hits). The exported `RagContext` interface and the `ragContext: RagContext | null` field on `PaletteContext` replace the old `searchHits: SearchHit[]` field; `buildMessages` now injects prd/stack content and hit bodies into the system message via `appendRagToSystem`, leaving user-turn prompts unchanged. The `AbortController` is created before the RAG pre-flight so Escape/Cancel aborts context gathering as well as the AI stream.

## Changes to current/

- `current/desktop.md` — updated `usePaletteStore` store description and `AIPalette` component description to reflect the RAG pre-flight and the removal of `searchHits` from `PaletteContext`.
