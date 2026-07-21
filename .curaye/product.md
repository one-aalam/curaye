---
updated: 2026-07-21
---

# Product

## Distribution

| Interface | Distribution | Phase |
|---|---|---|
| CLI | npm (`npx curaye`) + standalone binary (GitHub Releases) | 1 |
| Claude Code skills | Bundled with CLI, installed via `curaye skill install` | 1 |
| Desktop | GitHub Releases, Homebrew Cask | 2 |
| Web | GitHub Pages from sync repo — no separate hosting | 3 |

Skills ship alongside the CLI in Phase 1 — they are not a separate release. When the CLI is installed, the skills are available via `curaye skill install`.

## Interface opinions

**CLI first.** The CLI proves the format and workflow before any UI is written. It owns all mechanical, deterministic operations: file management, frontmatter writes, registry edits, git sync, index building, drift detection, and the structural parts of AI commands. It is scriptable, CI-friendly, and never requires an interactive session.

**Skills complement the CLI — they do not replace it.** Claude Code skills handle what the CLI cannot: reasoning, comprehension, and conversation. They call the CLI for mechanical operations and use LLM judgment for everything else. The responsibility split is strict:

| CLI owns | Skills own |
|---|---|
| File operations, registry, git | Understanding what changed |
| Deterministic AI commands | Writing `current/` with comprehension |
| Structural scaffold | Conversational interview flows |
| Drift detection mechanics | Drift interpretation and resolution |
| Works in CI / any terminal | Requires an active Claude Code session |

**Desktop is the primary daily interface.** Three-panel layout: project list, `.curaye/` tree, spec editor + AI command palette. Calm and minimal — the same ethos as the projects it manages.

**Web is read-only.** A static Astro site generated from the sync repo. Browsable from any machine without installing anything. Not a web app — no backend, no auth.

## Claude Code skills

Six skills ship with the CLI:

| Skill | What it does |
|---|---|
| `/curaye-build` | Pick a spec, brief the agent, implement to acceptance criteria |
| `/curaye-ship` | Graduate a spec: CLI does file ops, skill writes `current/` |
| `/curaye-brief` | Re-entry brief synthesised from the full `.curaye/` |
| `/curaye-bootstrap` | New project interview + scaffold + seed from shared layer |
| `/curaye-import` | Brownfield import with LLM-enhanced `current/` docs |
| `/curaye-check` | Drift detection with interpretation and interactive resolution |

**Install:** `curaye skill install` copies all skills to `~/.claude/commands/`. One-time per machine. `curaye skill install --update` refreshes them on CLI upgrade.

## LLM integration

- **Default:** Ollama (local). Respects the local-first, privacy-first ethos. Works offline. Used by both CLI and skills.
- **Opt-in:** Anthropic Claude, OpenAI. Configured per machine in `~/.curaye/config.yaml`. Never stored in the sync repo.
- **Background jobs:** GitHub Actions on the sync repo for ambient tasks (drift detection, pattern surfacing). Cloud AI only — fires on push, results committed back as files.

## AI interaction model — ⌘K command palette (desktop)

In the desktop app, AI is invoked via `⌘K` — not a persistent chat. Each invocation resolves intent and writes to files. The palette routes naturally to the underlying CLI commands for mechanical operations and produces output equivalent to the skills for intelligent operations.

## Evolution

- Phase 1: CLI + skills + format standard + sync. Local AI via Ollama.
- Phase 2: Desktop app. `⌘K` command palette. Skills and desktop share the same AI layer.
- Phase 3: Shared layer, promotion flow. Pattern detection, drift detection ambient.
- Phase 4: GitHub Actions ambient jobs. Cloud AI opt-in on sync repo.
