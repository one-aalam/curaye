# curaye

Curated project knowledge for developers who build more than one thing.

Curaye is a local-first, private tool for managing specs, decisions, patterns, and product knowledge across multiple software projects. It lives in each project as a `.curaye/` folder and syncs to a private repository for cross-machine continuity.

## What it is not

Not a task manager. Not a note-taking app. Not a project management tool. Curaye curates the *knowledge behind how you build* — specs for what you intend to build, a living record of what exists, the decisions that shaped it, and the patterns that repeat across your work.

## Monorepo structure

```
curaye/
  apps/
    cli/        ← the foundation; init, link, sync, ship, search
    desktop/    ← primary daily interface; Tauri + React
    web/        ← read-only static view of the sync repo
  packages/
    core/       ← file system, project registry, spec I/O
    protocol/   ← schema definitions, frontmatter validation, parser
    ai/         ← provider abstraction; Ollama, Anthropic, OpenAI
    sync/       ← git sync layer; push/pull to private remote
    ui/         ← shared React components (desktop + web)
```

## The `.curaye/` convention

Every project managed by Curaye carries a `.curaye/` folder at its root. This folder is gitignored from the project repo. Its structure and format are governed by the [Curaye Protocol Standard](.curaye/planned/00-protocol-standard.md).

Curaye is the first project to use itself.

## Getting started

```bash
pnpm install
pnpm build
```

## Package manager

pnpm 9+. Do not use npm or yarn.

## Tech stack

See [`.curaye/stack.md`](.curaye/stack.md).
