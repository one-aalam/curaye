---
id: desktop-core-parity
title: Desktop and Core Agree on the Protocol
status: draft
effort: l
impact: high
requires: []
tags: [desktop, core, protocol]
release: ''
created: 2026-11-03
updated: 2026-11-03
revision: 1
related: [surface-consolidation]
---

# Desktop and Core Agree on the Protocol

## Problem

The desktop's Rust layer re-implements logic that `@curaye/core` already owns: `scan_project` (`apps/desktop/src-tauri/src/commands/mod.rs:709`) mirrors `packages/core/src/scanner.ts`, `check_project_drift` (`mod.rs:2450`) mirrors `packages/core/src/drift-detector.ts`, and `generate_brief_context` (`mod.rs:1692`) mirrors `apps/cli/src/commands/brief.ts`. The copies have already diverged: the desktop's root-document list (`mod.rs:719`) is `prd.md`, `stack.md` and `AGENTS.md`, with no `product.md` or `conventions.md`. `decisions/03-desktop-rust-ai-layer` covers only the AI providers. Every protocol change now has to be made twice, and nothing catches it when one side is missed.

## Goal

The desktop and the CLI see the same `.curaye/` project: the same documents, the same root files, the same drift findings. A protocol change made once reaches both, or fails a check until it does.

## Non-goals

- Moving the desktop's AI provider layer (covered by `decisions/03`).
- Rewriting desktop UI.

## Acceptance criteria

1. A decision records how the desktop gets protocol knowledge — for example calling the CLI's `--json` output, a shared machine-readable protocol description both sides read, or keeping Rust copies guarded by a parity test — with the reasons.
2. The desktop shows the same root documents as `scanProject()`, including `product.md` and `conventions.md`.
3. For the same project, the desktop's drift count equals the number of `drift` findings from `curaye check --json`.
4. A check (test, script, or CI step) fails when the TypeScript and Rust sides disagree on root-document names or scanned folders.
5. `.curaye/conventions.md` gains a Code rule stating how protocol changes reach the desktop, with an example file.

## Log

- 2026-11-03 · origin · coherence pass audits/2026-11-03.md, finding F2. Judged not intentional: planned as a spec rather than a decision.
