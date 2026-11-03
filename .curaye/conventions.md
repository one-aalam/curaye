---
updated: 2026-11-03
---

# Conventions

Rules this project follows. Each names a canonical example. `/curaye-build` reads this file; `/curaye-cohere` checks against it.

## CLI

- **Project scope and JSON output.** Every project-scoped command takes `--project <id>` and supports `--json` through `isJsonMode()` / `printJson()`. Example: `apps/cli/src/commands/ship.ts`.
