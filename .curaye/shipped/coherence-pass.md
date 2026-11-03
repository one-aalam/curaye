---
id: coherence-pass
title: "Coherence Pass — Find Overlap and Drift, Record Conventions"
shipped: 2026-11-03
release: ""
spec_ref: "coherence-pass"
---

# Coherence Pass — Find Overlap and Drift, Record Conventions

> Shipped on 2026-11-03

## What shipped

A new `/curaye-cohere` Claude Code skill (`apps/cli/skills/curaye-cohere.md`) runs a coherence pass: it checks a project against itself across six categories (overlap, ux, cli, ui, code, docs), records each finding with category, severity, `path:line` evidence on every side and a class (mechanical, structural, intentional?), and changes nothing until the user approves. Approved mechanical fixes are applied as one batch after a diff and followed by a build; structural findings become planned specs; intentional overlaps become `coherence`-tagged decisions that later passes skip; rules go to `.curaye/conventions.md` with a canonical example each. Every run is saved to `.curaye/audits/YYYY-MM-DD.md`, whose date sets the window for the next incremental pass (`--full` scans everything).

`@curaye/core`'s `scanProject()` now returns `root.conventions` and treats `product.md` and `conventions.md` as optional root documents with no warning when absent. `/curaye-build` reads `conventions.md`; `/curaye-brief` suggests a pass after five or more ships. `curaye skill install` registers the skill; `@curaye/cli` and all ten skill headers are at `0.0.4`.

The first full pass on curaye (`.curaye/audits/2026-11-03.md`) found six issues: two documentation drifts were fixed (stale protocol-standard links in CLAUDE.md and README.md; a `product.md` warning the standard says should be silent), four were planned as specs (`single-spec-template`, `status-colours`, `desktop-core-parity`, `surface-consolidation`), and `.curaye/conventions.md` was created with its first rule.

## Approach vs landed

Built from the approach approved against rev 1, with these deviations:

- Files: the approach listed `.curaye/audits/2026-11-03.md` as the only output of the AC9 run → that run also wrote four planned specs, `.curaye/conventions.md`, and fixes to `CLAUDE.md`, `README.md` and `packages/core/src/scanner.ts` — the user approved applying the findings, not only recording them.
- Library: `product.md` was not in the approach → it is now optional too, as finding F5 of the run (the protocol standard already said its absence is silent).
- Skill session: the sample findings were illustrative → the real run found no token-replacement fix, because the desktop has no status-colour tokens yet; that became part of `status-colours`.

## Changes to current/

- `current/core.md` — `ProjectIndex.root.conventions`, optional `product.md` and `conventions.md`, and the folders the scanner ignores.
- `current/cli.md` — ten skills at v0.0.4, and what `curaye-cohere` does.
- `current/protocol-standard.md` — `conventions.md` and `audits/` in the folder layout, root-document table, and a "Conventions and audits" section (written during the build, as AC6 required).

## Notes

- The desktop's Rust tree still lists only `prd.md`, `stack.md` and `AGENTS.md` as root files, so `conventions.md` doesn't appear there; this is acceptance criterion 2 of `desktop-core-parity`.
- The pass's own commit step (Step 9) was skipped during the build; its changes are committed with this ship.
- Shipped from a cloud session with a temporary registry, so `~/.curaye/projects.yaml` on the developer's machine was not touched. The installed ship skill (pre-v0.0.4) was used; the "Approach vs landed" step was applied from the repo's v0.0.4 skill.
