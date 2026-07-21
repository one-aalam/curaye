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

Curaye ships six Claude Code skills that handle the intelligent, reasoning-heavy parts of the workflow. The CLI handles mechanical operations; the skills call the CLI and add LLM comprehension on top. Skills are not a UI for the CLI — they do what the CLI cannot: reasoning, comprehension, and conversation.

### Install (one-time per machine)

After installing the CLI, copy all skills to your global Claude Code commands directory:

```bash
curaye skill install
```

Skills are then available as slash commands in every Claude Code session on that machine. To update skills after a CLI upgrade:

```bash
curaye skill install --update
```

To check what's installed and whether anything is out of date:

```bash
curaye skill install --list
```

### The six skills

#### `/curaye-bootstrap`

**When:** Starting a new project from scratch.

Conducts a short conversational interview (name, domain, stack, first milestone, sync repo), then calls `curaye init` for the mechanical scaffold and drafts `prd.md`, `stack.md`, `product.md`, and a first planned spec — all tailored from your answers. Copies relevant decisions from the shared layer.

```
/curaye-bootstrap
```

No arguments. The skill asks everything it needs.

---

#### `/curaye-import`

**When:** An existing project was never tracked under Curaye.

Calls `curaye import <path>` to do the deterministic analysis (reading the file tree, package.json, git log), then enhances the generated `current/` docs with feature-level descriptions and surfaces 3–5 decision candidates inferred from code patterns. All generated docs are marked `confidence: inferred`.

```
/curaye-import path/to/project
```

Argument: path to the project root (optional — defaults to the current directory).

---

#### `/curaye-brief`

**When:** Returning to a project after time away, or orienting before a work session.

Reads `prd.md`, `stack.md`, all `current/`, `planned/`, `decisions/`, and the latest `shipped/` entries. Synthesises a six-section brief: Current State, What Was Planned, Where You Left Off, Decisions to Revisit, Suggested First Step, and Vision Check.

```
/curaye-brief
```

No arguments. Run it from a project directory with a `.curaye/` folder.

---

#### `/curaye-build`

**When:** Implementing a planned spec.

Reads the spec you name (or lets you pick one), loads `prd.md` and `CLAUDE.md` for context, marks the spec `building`, then implements it to its acceptance criteria. Reports on each criterion when done.

```
/curaye-build 03-package-core
```

Argument: spec id or filename (without path). Omit to be prompted to choose.

---

#### `/curaye-ship`

**When:** A spec's implementation is complete and ready to graduate.

Calls `curaye ship <id>` for the mechanical file operations (moves `planned/` → `shipped/`, writes frontmatter). Then reads the shipped spec and the implementation to write a `current/` doc — the living record of what exists — with genuine comprehension rather than a template fill.

```
/curaye-ship 03-package-core
```

Argument: spec id (same as the filename without the `.md`). Run after `/curaye-build` (or after manually completing the implementation).

---

#### `/curaye-check`

**When:** Checking whether a project has drifted from its adopted shared-layer patterns.

Calls `curaye check` for the deterministic comparison, then interprets each finding: intentional vs accidental vs uncertain. Walks through resolutions interactively — update to match, record an override decision, or snooze — and commits anything resolved.

```
/curaye-check
/curaye-check my-project-id
```

Argument: project id (optional — defaults to the current directory).

---

### Typical workflows

**New project:**
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

**Maintenance and drift:**
```
/curaye-check  →  /curaye-brief
```

### CLI vs skills

Skills call the CLI for mechanical operations. The split is strict:

| CLI handles | Skills handle |
|---|---|
| File moves, frontmatter writes, registry edits | Understanding what changed |
| Git operations, index building, validation | Writing `current/` with comprehension |
| Deterministic AI commands | Conversational interview flows |
| Works in CI / any terminal | Drift interpretation and resolution |

## Getting started

```bash
# Install the CLI
npm install -g curaye   # or: npx curaye

# Install Claude Code skills globally
curaye skill install

# Bootstrap a new project
cd your-project
/curaye-bootstrap        # in a Claude Code session

# Or link an existing project
curaye link .
```

## Package manager

pnpm 9+. Do not use npm or yarn.

## Tech stack

See [`.curaye/stack.md`](.curaye/stack.md).

## Specs

All planned features are in [`.curaye/planned/`](.curaye/planned/). The [protocol standard](.curaye/planned/00-protocol-standard.md) governs the format every document must follow.
