---
created: 2026-07-21
desire: high
effort: l
id: semantic-search
impact: high
requires:
- package-core
- package-ai
status: ready
tags:
- core
- ai
- cli
- desktop
title: Semantic Search — Cross-Project
updated: 2026-07-23
---

# Semantic Search — Cross-Project

> "Where have I solved this before?" Semantic search across all registered projects and the shared layer — finds related specs, decisions, and patterns by meaning, not by keyword.

## Problem

Keyword search works well when you know the exact term. It fails when you know the concept but not the words used to document it. A developer looking for "how I handled offline sync" won't find a spec titled "cross-machine continuity" via grep. Semantic search bridges this gap.

## Goal

Implement semantic search across all `.curaye/` content — planned specs, current docs, decisions, shipped, and the shared layer — using vector embeddings. Keyword search remains the fallback when no AI provider is configured.

## Non-goals

- Searching source code — only `.curaye/` documents are indexed.
- Real-time indexing as files change — index is rebuilt on `curaye index` or on sync.
- Ranking by recency or project priority — results are ranked by semantic similarity only.

## Index

Each document in `.curaye/` is embedded and stored in a local vector index at `~/.curaye/index/`. The index is a flat file format (no external database):

```
~/.curaye/index/
  vectors.bin     ← binary flat index (document embeddings)
  manifest.json   ← map of document path → embedding metadata
```

Embedding model: Ollama's `nomic-embed-text` (local, free, runs offline) or the provider's embedding API. The embedding model is configured separately from the completion model in `~/.curaye/config.yaml`:

```yaml
ai:
  embed:
    provider: ollama
    model: nomic-embed-text
```

## Index management

```
curaye index [--project <id>] [--all]
```
Builds or updates the vector index for the specified project(s). Only re-embeds documents whose content has changed since last index.

```
curaye index status
```
Shows which projects are indexed and when they were last indexed.

The index is rebuilt incrementally on `curaye sync --all` if the index is > 7 days old.

## Search

```
curaye search <query> [--project <id>] [--type planned|current|decisions|shipped] [--limit N]
```

Without `--project`: searches all registered projects and the shared layer.

**Semantic mode** (AI configured + indexed): embeds the query, runs cosine similarity against the vector index, returns top-N results.

**Keyword mode** (fallback): runs `grep -ri` across all `.curaye/` directories with the query string. Returns matching file paths and snippets.

Output:

```
curaye search "offline sync"

Results (semantic, across 6 projects):

  ★★★★★  curaye / planned / package-sync.md
          "Push and pull .curaye/ content to a private GitHub repository..."

  ★★★★☆  ilmgah / decisions / why-git-sync.md
          "Git is the right mechanism — developers already understand it..."

  ★★★☆☆  aiyo / current / data-persistence.md
          "User data is persisted locally with fallback cloud sync on..."

  ★★☆☆☆  shared / patterns / cross-machine-sync.md
          "Pattern for keeping local data consistent across machines..."
```

## Desktop integration

A search bar at the top of the middle panel. Defaults to searching the current project; a "All projects" toggle expands to cross-project. Results replace the tree panel temporarily — clicking a result opens the document in the editor. `Escape` returns to the tree.

The `⌘K` palette routes "find where I solved X" queries to semantic search rather than draft-spec.

## Result context

Each search result includes:
- Project name and document path
- Document type and title
- A 2–3 sentence snippet with the matching passage highlighted
- Similarity score (rendered as stars in CLI, a progress bar in desktop)

## Acceptance criteria

1. `curaye index --all` embeds all documents across all registered projects without error.
2. `curaye search "offline sync"` returns `package-sync.md` as the top result when the index contains it.
3. A keyword search for the same query returns results containing the literal string "offline" or "sync".
4. `curaye search` without an index built falls back to keyword search and prints a notice.
5. `curaye search --type decisions "database choice"` returns only decision documents.
6. `curaye search --project ilmgah "reader navigation"` returns only results from ilmgah.
7. Documents added after the last `curaye index` run appear in keyword results but not in semantic results, with a notice: "Index is stale — run `curaye index` for complete semantic results."
8. The desktop search bar returns results within 2 seconds for a fully indexed portfolio of 10 projects with 200 total documents.
9. Clicking a search result in the desktop opens the document and highlights the relevant passage if the result has a snippet offset.
10. `curaye index` is idempotent — running it twice on unchanged files produces the same index without re-embedding.
