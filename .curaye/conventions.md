---
updated: 2026-11-03
---

# Conventions

Rules this project follows. Each names a canonical example. `/curaye-build` reads this file; `/curaye-cohere` checks against it.

## Code

- **Planned specs are created from one template.** Use `renderPlannedSpec()` from `@curaye/protocol` wherever a command or store creates a new planned spec file. Never write inline frontmatter strings. Example: `packages/protocol/src/template.ts`.

## UI

- **Spec status colours come from the shared status map.** Use `statusBadgeClass()` or `statusChipClass()` from `apps/desktop/src/lib/statusColors.ts`. Never define a local `STATUS_COLORS` map in a component. Example: `apps/desktop/src/lib/statusColors.ts`.

## CLI

- **Project scope and JSON output.** Every project-scoped command takes `--project <id>` and supports `--json` through `isJsonMode()` / `printJson()`. Example: `apps/cli/src/commands/ship.ts`.
