---
updated: 2026-07-21
---

# Stack

## Monorepo

- **Workspace:** pnpm 9+ with pnpm workspaces
- **Build orchestration:** Turborepo 2.x
- **Language:** TypeScript 7.x across all packages and apps

## apps/cli

- **Runtime:** Node.js 20+
- **Framework:** None — plain TypeScript, compiled to a single binary via `esbuild` or `pkgroll`
- **Argument parsing:** `commander`
- **Frontmatter parsing:** `gray-matter`
- **Git operations:** `simple-git`

## apps/desktop

- **Shell:** Tauri v2 (Rust)
- **Frontend:** React 19, Vite, Tailwind CSS v4
- **UI primitives:** Base UI (`@base-ui/react`)
- **State:** Zustand

## apps/web

- **Framework:** Astro (static output)
- **Styling:** Tailwind CSS v4
- **Deployment:** GitHub Pages from the sync repo (zero infrastructure)

## packages/core

- **File system:** Node.js `fs/promises` — no abstraction layer
- **Schema validation:** Zod 3.x
- **Date handling:** Native `Temporal` API (Node 20+)

## packages/protocol

- **Frontmatter parsing:** `gray-matter`
- **Validation:** Zod schemas per document type
- **No runtime dependencies beyond gray-matter and zod**

## packages/ai

- **Provider abstraction:** Custom thin layer — not LangChain, not Vercel AI SDK
- **Supported providers:** Ollama (default, local), Anthropic, OpenAI
- **Streaming:** Native fetch with ReadableStream

## packages/sync

- **Git operations:** `simple-git`
- **Remote:** GitHub private repo via HTTPS or SSH

## packages/ui

- **Framework:** React 19
- **Styling:** Tailwind CSS v4
- **Primitives:** Base UI (`@base-ui/react`)
