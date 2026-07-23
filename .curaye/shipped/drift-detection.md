---
id: drift-detection
title: "Drift Detection — Project vs Shared Layer"
shipped: 2026-07-23
release: ""
spec_ref: "drift-detection"
---

# Drift Detection — Project vs Shared Layer

> Shipped on 2026-07-23

## What shipped

`DriftDetector` was added to `@curaye/core` (`packages/core/src/drift-detector.ts`): a class with `checkProject(project)` (reads a project's `adopts` list, compares each shared doc against the review snapshot for pending-update detection, scans local `decisions/` for `superseded_by` frontmatter for intentional-override detection, and runs keyword-term extraction via `computeTermDrift` for text-level drift), `checkAll()` (iterates all registered projects), `addIgnore(projectId, docId)` (writes to `~/.curaye/drift-ignores.yaml`), `clearIgnores(projectId)` (called after sync to reset suppressions), and `countDrift(project)`. The CLI gained `curaye check [--project <id>] [--all] [--fix] [--json]`: single-project and all-project modes print per-finding output with `✓`/`⚠` icons; `--fix` walks each finding interactively with options to record a local override decision, open content for editing, or ignore until next sync; the command exits with code 1 when any findings are classified as `drift`. The desktop gained a `check_project_drift` Tauri command (Rust, in `commands/mod.rs`) implementing the same three-stage detection; `RegistryProject` gained a `drift_count: Option<u32>` field; `projectStore.ts` calls `check_project_drift` for each project on load and on the existing 30-second refresh cycle; `ProjectsSidebar.tsx` renders an amber dot (`bg-amber-400`) next to any project with `drift_count > 0`. `curaye sync` now calls `DriftDetector.clearIgnores` after each successful project push or pull.

## Changes to current/

- `current/core.md` — add `DriftDetector` class documentation, `DriftFinding` / `DriftReport` / `DriftClassification` types, ignore file path (`~/.curaye/drift-ignores.yaml`).
- `current/cli.md` — add `curaye check` command with all flags and interactive `--fix` behaviour.
- `current/desktop.md` — add `check_project_drift` Tauri command, `drift_count` on `RegistryProject`, amber drift badge in `ProjectsSidebar`.

## Notes

The desktop "Issues" section in the tree panel (spec's desktop integration section, second paragraph) and the automatic "Check on project open if last check > 7 days" trigger were not implemented — the badge and 30-second refresh satisfy ACs #7 and #8 with less surface area. A follow-up spec can add the tree-panel Issues list and the auto-check trigger. The `DriftDetector.countDrift` TypeScript method counts only `drift` findings (not `pending-update`); the Rust `check_project_drift` command counts both for the desktop badge, which is the more useful threshold for a visual indicator.
