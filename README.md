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

Every project managed by Curaye carries a `.curaye/` folder at its root, gitignored from the project repo. Its structure and format are governed by the [Curaye Protocol Standard](.curaye/planned/00-protocol-standard.md).

```
.curaye/
  prd.md          ← north star
  stack.md        ← tech stack
  product.md      ← distribution, interfaces, AI strategy
  current/        ← what the project does today
  planned/        ← what you intend to build
  shipped/        ← what was built (the changelog)
  decisions/      ← why things are the way they are
```

Curaye is the first project to use itself.

## Claude Code skills

Curaye ships six Claude Code skills that handle the intelligent, reasoning-heavy parts of the workflow. The CLI handles mechanical operations; the skills call the CLI and add LLM comprehension on top.

| Skill | What it does |
|---|---|
| `/curaye-build` | Pick a spec, brief the agent, implement to acceptance criteria |
| `/curaye-ship` | Graduate a spec: CLI does file ops, skill writes `current/` |
| `/curaye-brief` | Re-entry brief synthesised from `.curaye/` |
| `/curaye-bootstrap` | New project interview + scaffold + seed from shared layer |
| `/curaye-import` | Brownfield import with LLM-enhanced `current/` docs |
| `/curaye-check` | Drift detection with interpretation and interactive resolution |

**Install skills** (one-time per machine, after installing the CLI):

```bash
curaye skill install
```

## Getting started

```bash
# Install the CLI
npm install -g curaye   # or: npx curaye

# Install Claude Code skills globally
curaye skill install

# Bootstrap a new project
cd your-project
curaye bootstrap        # or: /curaye-bootstrap in Claude Code

# Link an existing project
curaye link .
```

## Package manager

pnpm 9+. Do not use npm or yarn.

## Tech stack

See [`.curaye/stack.md`](.curaye/stack.md).

## Specs

All planned features are in [`.curaye/planned/`](.curaye/planned/). The [protocol standard](.curaye/planned/00-protocol-standard.md) governs the format every document must follow.
