---
id: monorepo
title: Monorepo Structure
domain: infra
updated: 2026-07-21
---

# Monorepo Structure

## Overview

Curaye is a pnpm + Turborepo monorepo. Three apps and five packages are managed as a single workspace. Turborepo enforces correct build ordering via the dependency graph declared in each package's `package.json`.

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
  package.json        ← private workspace root
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
```

## Dependency graph

```
protocol          ← no @curaye/* deps
core              ← protocol
ai                ← no @curaye/* deps
sync              ← core
ui                ← no @curaye/* deps
cli               ← core, sync, ai
desktop           ← core, sync, ai, ui
web               ← core, ui
```

Packages never depend on apps. Violating this graph is a blocking issue.

## TypeScript configuration

`tsconfig.base.json` at the repo root:

- `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`
- `strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`
- `declaration: true`, `declarationMap: true`, `sourceMap: true`

Each workspace extends this with a local `tsconfig.json`.

## Turbo pipeline

| Task | Depends on | Cache | Notes |
|---|---|---|---|
| `build` | `^build` | Yes | Outputs: `dist/` |
| `dev` | — | No | Persistent |
| `typecheck` | `^build` | Yes | — |
| `lint` | `^build` | Yes | — |
| `clean` | — | No | Removes `dist/` |

## Common commands

```bash
pnpm install                           # install all workspace deps
pnpm build                             # build all in dependency order
pnpm dev                               # start all dev servers
pnpm typecheck                         # typecheck all workspaces
pnpm lint                              # lint all workspaces
turbo build --filter=@curaye/cli       # build cli + upstream deps only
pnpm --filter @curaye/protocol build   # build one package
```
