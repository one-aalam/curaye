---
id: brownfield-import
title: "Brownfield Import — Existing Projects Without History"
shipped: 2026-07-21
release: ""
spec_ref: "brownfield-import"
---

# Brownfield Import — Existing Projects Without History

> Shipped on 2026-07-21

## What shipped

Two CLI commands added to `@curaye/cli`: `curaye import [path]` and `curaye review [path]`. The import command detects project type from `package.json`, `Cargo.toml`, or `pyproject.toml`; runs deterministic inference to produce `stack.md`, `prd.md`, `current/` domain stubs (from source directory structure), and `shipped/` entries (from git tags); and optionally runs AI-assisted inference to write feature-level `current/` descriptions and surface decision candidates from the dependency graph. A 5-question targeted interview fills gaps the code cannot infer. The review command scans for all `confidence: inferred` documents, opens each in `$EDITOR`, and strips the `confidence` field when the user confirms — leaving a standard protocol document. Both commands support `--json` mode and are registered in `apps/cli/src/index.ts`.

## Changes to current/

- `current/cli.md` — updated to document `import` and `review` as new commands, including their flags (`--deterministic-only`, `--skip-interview`, `--json`) and the `confidence: inferred` document lifecycle they introduce.

## Notes

Desktop integration (dashed border / italic label for inferred documents in the Tauri app) is noted in the spec but explicitly out of scope for this CLI-only implementation — it belongs in a follow-up spec targeting `@curaye/desktop`. AI-enhanced `prd.md` drafting (parallel to bootstrap) is a natural next enhancement.
