---
updated: 2026-11-05
---

# Conventions

Rules this project follows. Each names a canonical example. `/curaye-build` reads this file; `/curaye-cohere` checks against it.

## Code

- **Planned specs are created from one template.** Use `renderPlannedSpec()` from `@curaye/protocol` wherever a command or store creates a new planned spec file. Never write inline frontmatter strings. Example: `packages/protocol/src/template.ts`.
- **Protocol changes reach the desktop via guarded Rust copies.** The desktop Rust layer (`apps/desktop/src-tauri/src/commands/mod.rs`) keeps its own copies of root-document lists and drift-count logic. After any change to these invariants in TypeScript (`packages/core/src/scanner.ts`, `packages/core/src/drift-detector.ts`) or in the Rust layer, run `pnpm check:protocol-parity` to confirm both sides agree. Example: `scripts/check-protocol-parity.ts`.

## UI

- **Spec status colours come from the shared status map.** Use `statusBadgeClass()` or `statusChipClass()` from `apps/desktop/src/lib/statusColors.ts`. Never define a local `STATUS_COLORS` map in a component. Example: `apps/desktop/src/lib/statusColors.ts`.

## CLI

- **Project scope and JSON output.** Every project-scoped command takes `--project <id>` and supports `--json` through `isJsonMode()` / `printJson()`. Example: `apps/cli/src/commands/ship.ts`.
