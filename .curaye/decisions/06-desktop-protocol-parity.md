---
id: desktop-protocol-parity
title: How the Desktop Gets Protocol Knowledge
status: accepted
created: 2026-11-05
updated: 2026-11-05
---

# How the Desktop Gets Protocol Knowledge

## Context

The desktop's Rust layer (`apps/desktop/src-tauri/src/commands/mod.rs`) re-implements logic that `@curaye/core` already owns: `scan_project` mirrors `packages/core/src/scanner.ts`, `check_project_drift` mirrors `packages/core/src/drift-detector.ts`, and `generate_brief_context` mirrors `apps/cli/src/commands/brief.ts`. The copies diverged: the desktop's root-document list was `["prd.md", "stack.md", "AGENTS.md"]` while the protocol standard defines `prd.md`, `stack.md`, `product.md` (optional), `conventions.md` (optional) with no `AGENTS.md` in root. The drift badge counted all findings (including `pending-update`) rather than only `drift`-classified findings.

## Options considered

**A — Call the CLI's `--json` output from Tauri at runtime**
- Tauri commands shell out to `curaye scan --json` / `curaye check --json` via `std::process::Command`.
- Keeps a single source of truth (the CLI).
- Rejected: the CLI may not be on PATH at desktop launch time (users install the desktop app standalone without the CLI). Shelling out on every project-select adds ~200 ms latency and an extra failure mode (CLI version mismatch, PATH issues on macOS app launch).

**B — A shared machine-readable protocol description**
- A JSON/YAML file checked in alongside the protocol package, listing root-doc names, scanned folders, and classification semantics. Both TypeScript and Rust read it at build time or runtime.
- Keeps a canonical source of truth that scales to future divergences.
- Rejected for now: adds infrastructure (a generated or checked-in artefact, a Rust build step to read it, a TypeScript step to generate it) for a problem that is currently two one-line fixes. The complexity is not yet justified. Worth revisiting if the number of diverging invariants grows beyond five.

**C — Keep guarded Rust copies (chosen)**
- Fix the specific divergences (root-doc list, drift count filter) in the Rust implementation.
- Add a parity-check script (`scripts/check-protocol-parity.ts`) that parses both source files and fails when the invariants disagree. Register it as `pnpm check:protocol-parity` and run it in CI.
- Record the invariants in `.curaye/conventions.md` so protocol changes prompt the author to run the check.

## Consequences

- Protocol changes that touch root-document names or drift-count semantics now have a machine check (`pnpm check:protocol-parity`) that fails fast.
- The drift badge on the desktop sidebar now shows only `drift`-classified findings, matching `DriftDetector.countDrift()` and `curaye check --json`. `pending-update` findings remain visible in the Drift Panel when it opens, but no longer light the amber dot.
- Future protocol invariants (e.g. scanned-folder list, frontmatter field names) can be added to the parity script incrementally.
- If the number of guarded invariants grows beyond ~5, revisit option B.
