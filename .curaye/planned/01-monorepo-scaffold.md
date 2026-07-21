---
id: monorepo-scaffold
title: Monorepo Scaffold
status: ready
effort: s
impact: high
desire: high
requires: []
tags: [infra]
created: 2026-07-21
updated: 2026-07-21
---

# Monorepo Scaffold

> The foundational project structure. Everything else is built on top of this.

## Problem

Curaye spans a CLI, a desktop app, a static web viewer, and several shared packages. Without a structured monorepo from the start, shared logic gets duplicated, build order becomes manual, and adding a new app or package creates friction.

## Goal

Establish a pnpm + Turborepo monorepo with the correct app and package boundaries, a working build pipeline, and enough scaffolding in each workspace for subsequent specs to build on immediately.

## Non-goals

- Implementing any business logic — each package gets a `src/index.ts` stub only.
- Configuring CI/CD — that is a separate spec.
- Setting up Tauri's Rust side — covered in the desktop app spec.

## Workspace layout

```
curaye/
  apps/
    cli/          ← @curaye/cli
    desktop/      ← @curaye/desktop
    web/          ← @curaye/web
  packages/
    core/         ← @curaye/core
    protocol/     ← @curaye/protocol
    ai/           ← @curaye/ai
    sync/         ← @curaye/sync
    ui/           ← @curaye/ui
  package.json    ← private, no name, workspace root
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
```

## Package responsibilities

### `@curaye/protocol`

The lowest-level package. No dependencies on other `@curaye/*` packages.

Exports:
- Zod schemas for each document type (`PlannedSchema`, `CurrentSchema`, `DecisionSchema`, `ShippedSchema`, `RootDocSchema`)
- Type exports derived from schemas
- `validate(doc, type)` — returns `{ valid, errors, warnings }`
- `deriveId(filename)` — strips numeric prefix and `.md` extension

### `@curaye/core`

Depends on `@curaye/protocol`. No dependencies on apps.

Exports:
- `scanProject(curiyePath)` — recursively scans a `.curaye/` folder, returns a typed `ProjectIndex`
- `readDocument(path)` — parses frontmatter + body, validates, returns a `Document`
- `writeDocument(path, doc)` — serialises a `Document` to disk
- `ProjectRegistry` — reads/writes `~/.curaye/projects.yaml`

### `@curaye/sync`

Depends on `@curaye/core`.

Exports:
- `push(projectPath, remote)` — commits `.curaye/` changes and pushes to the sync remote
- `pull(projectPath, remote)` — pulls from remote and applies to `.curaye/`
- `status(projectPath)` — returns sync state (ahead, behind, diverged, clean)

### `@curaye/ai`

No dependencies on other `@curaye/*` packages.

Exports:
- `createProvider(config)` — returns a provider instance (Ollama | Anthropic | OpenAI)
- `Provider` interface: `complete(messages)`, `stream(messages)`, `embed(text)`

### `@curaye/ui`

Depends on no other `@curaye/*` packages. React 19 components only.

### `@curaye/cli`

Depends on `@curaye/core`, `@curaye/sync`, `@curaye/ai`.

### `@curaye/desktop`

Depends on `@curaye/core`, `@curaye/sync`, `@curaye/ai`, `@curaye/ui`.

### `@curaye/web`

Depends on `@curaye/core`, `@curaye/ui`.

## TypeScript configuration

A shared `tsconfig.base.json` at the root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Each package extends this with a local `tsconfig.json`.

## Turbo pipeline

The `turbo.json` pipeline:

- `build` depends on `^build` (dependencies built first). Outputs: `dist/`.
- `dev` is persistent with no caching.
- `typecheck` depends on `^build`.
- `lint` depends on `^build`.
- `clean` removes `dist/` with no caching.

## Acceptance criteria

1. `pnpm install` at the repo root installs all workspace dependencies without errors.
2. `pnpm build` builds all packages and apps in correct dependency order via Turborepo.
3. `pnpm typecheck` passes across all workspaces with zero errors on the stub implementations.
4. Each package has a `src/index.ts` that exports at least one named symbol — build is not a no-op.
5. `@curaye/protocol` has no `@curaye/*` dependencies in its `package.json`.
6. `@curaye/core` imports from `@curaye/protocol` via the workspace protocol (`workspace:*`) and the import resolves correctly after build.
7. `turbo build --filter=@curaye/cli` builds only `cli` and its upstream dependencies, not `@curaye/ui` or `@curaye/web`.
8. Adding a new package under `packages/` and running `pnpm install` picks it up without modifying `pnpm-workspace.yaml`.
