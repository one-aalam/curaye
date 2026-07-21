# Curaye — Agent Steering Document

## What this is

Curaye is a local-first, private spec and knowledge management tool for developers managing multiple software projects. It is a pnpm + Turborepo monorepo containing a CLI, a Tauri desktop app, a static web viewer, and shared packages.

Curaye is also the first project to use its own `.curaye/` convention. The `.curaye/` folder at the repo root is not gitignored here — it is the canonical source of truth for what Curaye is building and why.

## Read specs before implementing

Every feature in this project has a spec in `.curaye/planned/`. Before implementing anything:

1. Read the relevant spec file. It defines the problem, goal, non-goals, data structures, and acceptance criteria.
2. The spec's acceptance criteria are the definition of done — implementation is complete when all criteria pass.
3. If the spec and this file conflict, the spec wins for feature behaviour; this file wins for code conventions.

When a feature ships, update its status:
- Move the spec from `.curaye/planned/` to `.curaye/shipped/`
- Update the relevant `current/` document to reflect what now exists
- Do not leave `status: done` specs sitting in `planned/` — ship them or leave them `building`

## Monorepo structure

```
curaye/
  apps/
    cli/        @curaye/cli       ← commander-based CLI, compiled to binary
    desktop/    @curaye/desktop   ← Tauri v2 + React 19
    web/        @curaye/web       ← Astro static site
  packages/
    core/       @curaye/core      ← file system, scanner, registry
    protocol/   @curaye/protocol  ← schemas, parser, validator
    ai/         @curaye/ai        ← provider abstraction
    sync/       @curaye/sync      ← git sync layer
    ui/         @curaye/ui        ← shared React components
```

## Package dependency rules

The dependency graph is strict and must not be violated:

```
protocol          ← no @curaye/* deps (lowest level)
core              ← depends on: protocol
ai                ← no @curaye/* deps
sync              ← depends on: core
ui                ← no @curaye/* deps
cli               ← depends on: core, sync, ai
desktop           ← depends on: core, sync, ai, ui
web               ← depends on: core, ui
```

**Enforced invariants:**
- `@curaye/protocol` must never import from any `@curaye/*` package. If you need to add a dependency to `protocol`, reconsider the design.
- `@curaye/ai` must never import from any `@curaye/*` package. AI is a leaf — nothing in the protocol or core layer should know about it.
- `@curaye/ui` must never import from `@curaye/core`, `@curaye/sync`, or `@curaye/ai`. UI components must be portable.
- Apps (`cli`, `desktop`, `web`) may depend on packages but packages must never depend on apps.

Violating these rules is a blocking issue. Fix it before merging.

## Protocol standard

The `.curaye/` folder format is governed by `.curaye/planned/00-protocol-standard.md`. This is the authoritative spec for:
- Folder layout and file naming
- Frontmatter schemas per document type
- Required and optional body sections
- Scanning and parsing rules
- Validation behaviour

When implementing `@curaye/protocol` or `@curaye/core`, this spec is the source of truth. When in doubt about parsing behaviour, the protocol spec wins.

## Conventions

### TypeScript

All packages use strict TypeScript with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. No `any`. No type assertions (`as`) except when interfacing with untyped third-party APIs, and only at the boundary — not propagated inward.

Types are derived from Zod schemas, not written by hand. If a type and a schema diverge, fix the schema and re-derive.

### Package exports

Each package exports from a single `src/index.ts`. Do not import internal paths from other packages (e.g. `@curaye/core/src/scanner`). The public API is what is exported from `src/index.ts`.

### Error handling

Packages use typed error classes, not generic `Error` with string messages. Each package defines its own error types in `src/errors.ts`. Functions that can fail either return `Result`-style objects or throw typed errors — not both patterns in the same function.

File operations in `@curaye/core` never throw for missing or malformed documents. They return the document with a populated `ValidationResult`. Only IO errors (permission denied, disk full) are thrown.

### `@curaye/protocol` — schema rules

- One Zod schema per document type, using `.passthrough()` for unknown fields.
- `parse()` never throws — failures go into `ValidationResult`.
- `deriveId()`, `isDraft()`, and `sortOrder()` are pure functions with no side effects.

### `@curaye/core` — file system rules

- All file reads and writes use `fs/promises`. No synchronous fs calls.
- `writeDocument()` is atomic: write to a `.tmp` file, then `fs.rename()`. Never write directly to the target path.
- `scanProject()` is idempotent — calling it twice returns structurally identical results.
- The project registry lives at `~/.curaye/projects.yaml`. Nothing else is written outside `.curaye/` project folders.

### `@curaye/ai` — provider rules

- All three providers (Ollama, Anthropic, OpenAI) implement the same `Provider` interface.
- `provider.complete()` and `provider.stream()` accept `Message[]` — callers build the messages, the provider just executes.
- No prompt construction inside `@curaye/ai`. Prompts are the caller's responsibility.
- `stream()` returns an `AsyncIterable<string>`. Network errors surface as `ProviderUnavailableError` thrown from the iterator.

### `@curaye/sync` — git rules

- All git operations use `simple-git`. No shell-exec or child_process for git.
- `push()` creates at most one commit per call. No empty commits.
- Conflicts are never auto-resolved. Surface `SyncConflictError` and stop.
- The sync repo's `projects.yaml` must never contain `path` fields (machine-specific).

### CLI

- Every command must work with `--json` for structured output.
- Errors go to `stderr` with a non-zero exit code.
- Commands that require an AI provider check availability first and print a clear message if unavailable — they do not error silently.
- The CLI is a thin layer over the packages. No business logic lives in the CLI itself.

### Desktop (Tauri)

- Tauri commands live in `src-tauri/src/commands/` and are registered in `lib.rs`.
- All Tauri command input/output types use `serde::{Serialize, Deserialize}`.
- Prefer `Result<T, String>` return types from Tauri commands so errors surface cleanly on the frontend.
- React state is managed with Zustand. One store per domain area (project, tree, editor, config).
- No business logic in React components. Components call stores or Tauri commands; stores call packages.

### `@curaye/ui` — component rules

Components in `@curaye/ui` must be boundary-clean:
- **Allowed:** React, Tailwind classes, `@base-ui/react`, sibling `ui/` files
- **Forbidden:** `@curaye/core`, `@curaye/sync`, `@curaye/ai`, any app-specific code

A violation in `ui/` is a blocking issue. The goal is that any component can be copied to a new project without modification.

## Running locally

```bash
pnpm install          # install all workspace deps
pnpm build            # build all packages and apps in dependency order
pnpm dev              # start all dev servers (turbo persistent)
pnpm typecheck        # typecheck all workspaces
pnpm lint             # lint all workspaces

# Scoped
pnpm --filter @curaye/protocol build
pnpm --filter @curaye/cli dev
turbo build --filter=@curaye/desktop
```

## Commits

Conventional Commits. The CHANGELOG is generated from commit messages.

```
<type>(<scope>): <short description>
```

**Types:** `feat` | `fix` | `perf` | `refactor` | `docs` | `chore` | `ci`

**Scopes:** `cli` | `desktop` | `web` | `core` | `protocol` | `ai` | `sync` | `ui` | `shared` | `spec`

Breaking changes: append `!` after the type/scope — `feat(core)!: change scanProject return type`.

Always pass the commit message via a heredoc:

```bash
git commit -m "$(cat <<'EOF'
feat(protocol): implement parse() and deriveId() functions
EOF
)"
```

Never use `--no-verify`.

## What not to build

- Do not add AI functionality to `@curaye/protocol` or `@curaye/core`. Those packages are AI-unaware by design.
- Do not add a web app backend. `@curaye/web` is a static Astro site — no server, no auth, no dynamic routes.
- Do not add real-time file watching. Changes are detected on explicit `scanProject()` calls or sync.
- Do not auto-resolve git conflicts in `@curaye/sync`. Surface `SyncConflictError` and stop.
- Do not add LangChain, Vercel AI SDK, or any orchestration framework to `@curaye/ai`. Three providers, one interface, native fetch.

When in doubt about whether something belongs here, read the relevant spec in `.curaye/planned/`. If no spec covers it, ask before building it.
