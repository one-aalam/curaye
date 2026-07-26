# curaye

Curated project knowledge for developers who build more than one thing.

---

Returning to a project untouched for months means archaeology — reading old code, reconstructing decisions, re-deriving intent. Starting a new project means repeating the same architecture choices and rewriting the same documentation that already exists elsewhere. Curaye is the private, local-first layer where that knowledge lives instead.

It gives each project a structured `.curaye/` folder: the current state of the codebase, specs for what you intend to build, a record of what shipped, and the decisions that shaped it. A shared layer above all your projects holds patterns, standing decisions, and agent steering documents that belong to you, not to any one codebase.

**What it is not:** a task manager, a note-taking app, or a project management tool. Curaye curates the *knowledge behind how you build* — not your todos.

---

## Three surfaces, one system

Curaye is used through three complementary surfaces. They share the same file format and the same `~/.curaye/` home directory.

### Desktop (primary daily interface)

A Tauri + React app with a three-panel layout: project list, `.curaye/` tree, and a structured document editor. The desktop is where you browse specs, draft new ones, manage releases on a kanban board, review the cross-project backlog, and run the AI command palette (`⌘K`) to draft specs, generate acceptance criteria, or search across everything you've ever built.

```
┌─────────────────┬──────────────────┬──────────────────────────┐
│  Projects       │  .curaye/ tree   │  Document editor         │
│  sidebar        │                  │  (structured / raw)      │
└─────────────────┴──────────────────┴──────────────────────────┘
```

### CLI (scriptable foundation)

Every operation the desktop performs is also available as a CLI command. The CLI is the right tool for scripting, CI pipelines, and anything you want to run without opening a window. All commands accept `--json` for structured output.

```bash
curaye init          # scaffold .curaye/ in a project
curaye list          # list planned specs
curaye ship <id>     # mark a spec as shipped
curaye sync          # push to your private sync repo
curaye search "auth" # search across all registered projects
```

### Claude Code skills (intelligent layer)

Six skills ship with the CLI and are installed once into Claude Code. The skills do what the CLI cannot: reasoning, comprehension, and conversation. They call the CLI for mechanical operations and use LLM judgment for everything else — conducting a project interview, writing meaningful `current/` updates, or interpreting drift findings.

```
/curaye-bootstrap   ← new project interview + scaffold
/curaye-brief       ← re-entry brief before a work session
/curaye-build       ← implement a spec to its acceptance criteria
/curaye-ship        ← graduate a spec; write current/ with comprehension
/curaye-import      ← brownfield import for projects never tracked
/curaye-check       ← drift detection with interactive resolution
```

---

## The `.curaye/` folder

Every project managed by Curaye carries a `.curaye/` folder at its root. Its structure and format are governed by the [Curaye Protocol Standard](.curaye/planned/00-protocol-standard.md).

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

Curaye is the first project to use itself — the `.curaye/` folder at the root of this repo is exactly what your project's `.curaye/` folder will look like. Browse it to see the format in practice: [`prd.md`](.curaye/prd.md), [`stack.md`](.curaye/stack.md), [`current/`](.curaye/current/), [`planned/`](.curaye/planned/).

---

## Getting started

```bash
# 1. Install the CLI
npm install -g curaye   # or: npx curaye

# 2. Install Claude Code skills globally (one-time per machine)
curaye skill install

# 3. Register your project (or start fresh)
cd your-project
curaye link .               # existing project — just register it
curaye init .               # new project — scaffold .curaye/

# 4. Start a Claude Code session and orient yourself
/curaye-brief               # re-entry brief from your .curaye/ contents
```

**New project from scratch:**
```
/curaye-bootstrap  →  /curaye-brief  →  /curaye-build <spec>  →  /curaye-ship <spec>
```

**Existing project, never tracked:**
```
/curaye-import  →  /curaye-brief  →  /curaye-build <spec>  →  /curaye-ship <spec>
```

**Returning after time away:**
```
/curaye-brief  →  /curaye-build <spec>  →  /curaye-ship <spec>
```

**Keeping patterns in sync:**
```
/curaye-check  →  /curaye-brief
```

---

## CLI vs skills — the split is strict

| CLI handles | Skills handle |
|---|---|
| File moves, frontmatter writes, registry edits | Understanding what changed |
| Git operations, index building, validation | Writing `current/` with comprehension |
| Deterministic AI commands | Conversational interview flows |
| Works in CI / any terminal | Drift interpretation and resolution |

Skills call the CLI for mechanical operations. The CLI is not a simplified version of the skills — they operate at different layers.

---

## Updating skills after a CLI upgrade

```bash
curaye skill install --update   # overwrite installed skills with current version
curaye skill install --list     # check installed vs bundled version per skill
```

---

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

## Package manager

pnpm 9+. Do not use npm or yarn.

## Tech stack

See [`.curaye/stack.md`](.curaye/stack.md).

## Specs

All planned features are in [`.curaye/planned/`](.curaye/planned/). The [protocol standard](.curaye/planned/00-protocol-standard.md) governs the format every document must follow.
