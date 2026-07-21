---
id: monorepo-scaffold
title: "Monorepo Scaffold"
shipped: 2026-07-21
release: ""
spec_ref: "monorepo-scaffold"
---

# Monorepo Scaffold

> Shipped on 2026-07-21

## What shipped

The Curaye monorepo is established as a pnpm + Turborepo workspace containing three apps (`@curaye/cli`, `@curaye/desktop`, `@curaye/web`) and five packages (`@curaye/protocol`, `@curaye/core`, `@curaye/ai`, `@curaye/sync`, `@curaye/ui`). A shared `tsconfig.base.json` enforces strict TypeScript 7.x with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` across all workspaces. The Turbo pipeline defines `build` (with `^build` dependency ordering, `dist/` outputs), `dev` (persistent), `typecheck`, `lint`, and `clean` tasks. Each workspace has a `src/index.ts` exporting at least one named symbol, with workspace-local `package.json` and `tsconfig.json` files in place.

## Changes to current/

- `current/monorepo.md` (created): documents the workspace layout, dependency graph between packages and apps, TypeScript config, and Turbo pipeline as they exist today.
