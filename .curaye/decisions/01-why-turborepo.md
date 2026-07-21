---
id: why-turborepo
title: Turborepo over alternatives for monorepo orchestration
status: active
date: 2026-07-21
tags: [infra]
---

# Decision: Turborepo over alternatives for monorepo orchestration

## Context

Curaye is structured as a monorepo with multiple apps (`cli`, `desktop`, `web`) and multiple shared packages (`core`, `protocol`, `ai`, `sync`, `ui`). Build order matters — `@curaye/core` must be built before `@curaye/cli`. A monorepo tool is needed to manage this dependency graph, cache build outputs, and provide a consistent dev experience.

The candidates considered were Turborepo, Nx, and no orchestration (plain pnpm scripts).

## Decision

Use Turborepo.

## Consequences

- Build caching is handled automatically. Unchanged packages are not rebuilt — critical for the desktop app which has the longest build time.
- The `turbo.json` pipeline is the single source of truth for task ordering. New packages declare their dependencies once and the graph is resolved automatically.
- `--filter` lets the CLI, desktop, and web be built independently without coupling their pipelines.
- Turborepo is a build orchestrator, not a code generator or opinionated scaffolding tool. It adds no runtime coupling to the packages it orchestrates.

The tradeoff: Turborepo does not offer the code generation, module federation, or extensive plugin ecosystem of Nx. Those features are not needed here.

## Alternatives considered

**Nx** — more powerful but significantly more opinionated. Adds `project.json` per package, a plugin model, and a generator system. The overhead is not justified for this project's scale. Nx is better suited to large teams or polyglot monorepos.

**Plain pnpm scripts** — workable for small monorepos but does not handle build caching or parallel execution with dependency awareness. Would require manual ordering scripts that become brittle as the package graph grows.
