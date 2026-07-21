---
id: project-bootstrap
title: Project Bootstrap — Blank Project Onboarding
status: draft
effort: m
impact: high
desire: high
requires: [package-core, package-ai, cli, shared-layer]
tags: [cli, desktop, ai]
created: 2026-07-21
updated: 2026-07-21
---

# Project Bootstrap — Blank Project Onboarding

> New project, blank directory. Curaye runs a brief interview, scaffolds `.curaye/`, and seeds it from the shared layer. The boring documentation is done on day one.

## Problem

Starting a new project with Curaye from scratch requires manually writing `prd.md`, `stack.md`, `product.md`, and an initial set of decisions. Without tooling, this is enough friction that it won't happen — developers will use Curaye only on established projects.

## Goal

A bootstrap flow — available via CLI and as a Claude Code skill — that takes a blank or early-stage project, conducts a brief interview, optionally analyses any existing code, and produces a fully scaffolded `.curaye/` seeded from the shared layer.

## Non-goals

- Bootstrapping projects with a substantial codebase that has no `.curaye/` history — that is brownfield import (spec `14`), a distinct flow.
- Generating implementation code or project scaffolding (directory structure, `package.json`) — Curaye bootstraps the knowledge layer, not the code layer.

## Entry points

1. `curaye bootstrap [path]` — CLI command.
2. A Claude Code skill (`lore-bootstrap` or `curaye-bootstrap`) that fires when `.curaye/` doesn't exist in the current project.
3. "Bootstrap project" button in the desktop app when a linked project has no `.curaye/`.

## Interview flow

Five questions, asked interactively (CLI: prompted; desktop: a modal wizard; skill: conversational):

```
1. What is this project? (one sentence)
   → seeds prd.md overview

2. Who is it for?
   → seeds prd.md target user

3. What type of app is it?
   [Desktop (Tauri)] [Web] [CLI] [Mobile] [Library] [Other]
   → selects shared/stack/ candidate

4. Which of your shared decisions apply here? (multi-select)
   Shows list from shared/decisions/ — user selects relevant ones
   → seeds decisions/ with selected entries

5. What do you want to build first?
   (free text — becomes the first planned spec title)
   → drafts first planned/ spec with AI
```

Questions 4 and 5 require the shared layer to exist. If it is empty, they are skipped.

## AI involvement

After the interview, if an AI provider is configured:

- AI drafts `prd.md` from the answers to questions 1 and 2 — a paragraph that reads like a considered product brief.
- AI drafts the first planned spec from question 5, using the shared stack context to inform the technical sections.
- AI suggests which `shared/stack/` document matches the app type from question 3.

Without AI, the flow produces stub documents with the interview answers inserted as raw text.

## Output

```
.curaye/
  prd.md              ← drafted from interview (+ AI)
  stack.md            ← pre-filled from shared/stack/<type> if available
  product.md          ← stub with distribution and interface fields to fill
  current/            ← empty (nothing is built yet)
  planned/
    01-<first-spec>.md  ← drafted from question 5 (+ AI)
  shipped/            ← empty
  decisions/
    01-<decision>.md  ← one entry per selection from question 4
```

## Claude Code skill

The `curaye-bootstrap` skill is the most natural entry point for developers already using Claude Code. When invoked in a project directory without `.curaye/`:

1. Reads any existing `README.md`, `package.json`, or `Cargo.toml` to pre-fill answers.
2. Asks the five interview questions conversationally.
3. Generates the scaffold and reports what was created.

The skill is defined as a `.claude/skills/curaye-bootstrap.md` file, distributable via the Curaye CLI (`curaye skill install`).

## Acceptance criteria

1. `curaye bootstrap` in an empty directory produces a valid `.curaye/` that passes `scanProject` with zero errors.
2. The `prd.md` generated from the interview contains the user's answers from questions 1 and 2.
3. If `shared/stack/tauri-react` exists and the user selects "Desktop (Tauri)", `stack.md` is pre-filled from that shared document.
4. Selected shared decisions are copied into `decisions/` with a `source` field referencing the shared original.
5. The first planned spec is created with `status: draft` and a valid frontmatter block.
6. Without AI configured, the flow completes with stub documents — no error or empty files.
7. With AI configured, `prd.md` contains a paragraph of coherent prose, not just the raw interview answers.
8. Running `curaye bootstrap` in a directory that already has `.curaye/` exits with an error and a clear message, without modifying existing files.
9. The Claude Code skill produces the same `.curaye/` structure as the CLI flow.
10. `curaye link` is called automatically at the end of bootstrap — the project is registered in `~/.curaye/projects.yaml` without a separate step.
