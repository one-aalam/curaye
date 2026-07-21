---
updated: 2026-07-21
---

# Product

## Distribution

| Interface | Distribution | Phase |
|---|---|---|
| CLI | npm (`npx curaye`) + standalone binary (GitHub Releases) | 1 |
| Desktop | GitHub Releases, Homebrew Cask | 2 |
| Web | GitHub Pages from sync repo — no separate hosting | 3 |

## Interface opinions

**CLI first.** The CLI proves the format and workflow before any UI is written. It is the scriptable, automatable, CI-friendly surface that never goes away. Every action the desktop app performs is also available via the CLI.

**Desktop is the primary daily interface.** Three-panel layout: project list, `.curaye/` tree, spec editor + AI sidebar. Calm and minimal — the same ethos as the projects it manages.

**Web is read-only.** A static Astro site generated from the sync repo. Browsable from any machine without installing anything. Not a web app — no backend, no auth, no dynamic features.

## LLM integration

- **Default:** Ollama (local). Respects the local-first, privacy-first ethos. Works offline.
- **Opt-in:** Anthropic Claude, OpenAI. Configured per machine in `~/.curaye/config.yaml`. Never stored in the sync repo.
- **Background jobs:** GitHub Actions on the sync repo for ambient tasks (drift detection, pattern surfacing). Cloud AI only — fires on push, results committed back as files.

## AI interaction model

Command palette (`⌘K`), not a persistent chat. Each invocation resolves an intent and writes to files. AI is a tool — it drafts, detects, and surfaces. It does not maintain a conversational thread.

## Evolution

- Phase 1: CLI + format standard + sync. No AI.
- Phase 2: Desktop app. Local AI via Ollama, `⌘K` command palette.
- Phase 3: Shared layer, promotion flow. Pattern detection, drift detection.
- Phase 4: GitHub Actions ambient jobs. Cloud AI opt-in on sync repo.
