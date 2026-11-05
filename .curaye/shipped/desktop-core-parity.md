---
id: desktop-core-parity
title: "Desktop and Core Agree on the Protocol"
shipped: 2026-11-05
release: ""
spec_ref: "desktop-core-parity"
---

# Desktop and Core Agree on the Protocol

> Shipped on 2026-11-05

## What shipped

The desktop Rust layer's root-document scan and drift badge were aligned with `@curaye/core`. `scan_project` in `apps/desktop/src-tauri/src/commands/mod.rs` now scans `["prd.md", "stack.md", "product.md", "conventions.md"]`, matching the protocol standard and `scanProject()` in TypeScript; `AGENTS.md` (which is not a protocol root doc) was removed from that list. `check_project_drift` now counts only `classification == "drift"` findings, matching `DriftDetector.countDrift()` and `curaye check --json`. A decision document (`decisions/06-desktop-protocol-parity.md`) records the architecture choice (guarded Rust copies) and the trade-offs of calling the CLI at runtime or using a shared machine-readable protocol description. A parity-check script (`scripts/check-protocol-parity.ts`, `pnpm check:protocol-parity`) parses both source files and exits 1 with a clear diff when the invariants disagree; the negative case was verified during the build.

## Approach vs landed

Built as approached (rev 1).

## Changes to current/

- `current/desktop.md` — updated `scan_project` command description to reflect the new root-doc list; updated `check_project_drift` badge semantics note; added the parity script to design notes.
- `current/core.md` — no changes needed; `DriftDetector.countDrift()` semantics were already correctly documented.

## Notes

- The drift badge now shows only `drift`-classified findings (not `pending-update`). This matches TypeScript behaviour. `pending-update` findings are still surfaced in the Drift Panel when it opens.
- The parity script uses regex on source files; a large mod.rs structural refactor could require updating the regex. This is acceptable — the script is a safeguard, not a contract.
- `generate_brief_context` (mod.rs:1692) is still a Rust copy of the CLI's brief logic and was explicitly left out of this spec (non-goal: AI provider layer). A follow-up spec can address it.
