---
id: semantic-search
title: "Semantic Search — Cross-Project"
shipped: 2026-07-24
release: ""
spec_ref: "semantic-search"
---

# Semantic Search — Cross-Project

> Shipped on 2026-07-24

## What shipped

`SearchIndexManager` in `@curaye/core` builds and queries a local HNSW vector index at `~/.curaye/index/` using the `usearch` npm package, with a companion `manifest.json` mapping uint64 keys to document metadata and cached content hashes for incremental re-embedding. The `curaye index [--project <id>] [--all]` CLI command embeds documents from all registered projects (and, when `--all`, shared-layer documents at `~/.curaye/shared/` via `SharedLayer.list()`) using a configurable embed provider, skipping unchanged files. The `curaye search <query>` command runs semantic search via embedded query vector when an index exists and an AI provider is configured, falling back to `grep -ri` keyword search with a stale-index notice when not. The Tauri desktop layer exposes `search_semantic`, `search_keyword`, and `search_index_status` commands consumed by a `searchStore` Zustand store; the `SearchBar` React component renders results with score progress bars, a "All projects" globe toggle, and type filter chips (All / Planned / Current / Decisions / Shipped) that appear when a search is active.

## Changes to current/

- `current/search.md` — created to document the semantic search system: index location, CLI commands, desktop integration, and provider configuration.
- `current/cli.md` — updated to add `index` and `search` to the command inventory.
- `current/desktop.md` — updated to document the SearchBar component, searchStore, and Tauri search commands.

## Notes

Shared-layer documents use `projectId: "shared"`; shared `decisions` category maps to type `decisions`, all other shared categories (`patterns`, `design`, `agents`, `stack`) map to type `current`. The Rust Tauri side reads the same `index.usearch` binary produced by the TypeScript CLI via the `usearch` crate — no conversion step. The `⌘K` palette routes "find where I solved X" queries to semantic search (tracked in `paletteStore`) but a dedicated palette integration spec is pending.
