---
id: drift-detection
title: Drift Detection — Project vs Shared Layer
status: draft
effort: m
impact: medium
desire: high
requires: [shared-layer, package-ai]
tags: [shared, ai]
created: 2026-07-21
updated: 2026-07-21
---

# Drift Detection — Project vs Shared Layer

> A project that diverges from a shared decision without recording why has drifted. Curaye surfaces that drift so it becomes a conscious choice, not an accident.

## Problem

Projects adopt shared decisions and patterns. Over time, projects evolve — sometimes they diverge intentionally (a better approach was found), sometimes accidentally (the developer forgot the standing decision existed). Currently, there is no way to detect or surface this drift.

## Goal

A drift detection system that compares a project's local decisions and stack against its adopted shared documents, identifies divergence, and surfaces it as an actionable notification rather than an error.

## Non-goals

- Forcing alignment — drift is surfaced, never enforced.
- Real-time detection — drift is detected on explicit `curaye check` runs or on sync.
- Detecting drift between two projects (neither of which has adopted a shared document) — the shared layer is always the reference.

## What counts as drift

Drift is detected by comparing the project's actual documents against the shared documents it has declared as adopted:

| Scenario | Classification |
|---|---|
| Project uses a different library than `shared/decisions/why-sqlite` recommends, with no local override decision | Drift |
| Project has a local `decisions/why-drizzle.md` that supersedes `shared/decisions/why-sqlite` | Intentional override — not drift |
| A shared document was updated; the project has not reviewed the update | Pending update — not drift |
| Project's `stack.md` lists a dependency version significantly older than the shared stack references | Stale — flagged as info |

The key distinction: drift is undocumented divergence. Documented local decisions that override shared ones are intentional and not flagged.

## Detection mechanism

```
curaye check [--project <id>] [--all]
```

For each adopted shared document:

1. Reads the shared document and the project's relevant local content.
2. Runs an AI comparison (or deterministic text diff without AI) to identify meaningful differences.
3. Classifies the finding as drift, intentional override, pending update, or stale.
4. Outputs findings.

Without AI, the comparison is textual — differences in key terms (library names, patterns) are flagged as potential drift for the user to investigate.

## Finding output

```
curaye check --project ilmgah

Checking ilmgah against 4 adopted shared documents...

  ✓  shared/decisions/why-sqlite       No drift detected
  ⚠  shared/stack/tauri-react          Potential drift
     ilmgah uses Zustand 4.x; shared/stack references Zustand 5.x
     → Is this intentional? Record a local override or update your stack.

  ⚠  shared/design/glass-ui            Pending update (14 days)
     shared/design/glass-ui was updated 2026-07-07
     → Run `curaye shared diff glass-ui --project ilmgah` to review

  ✓  shared/decisions/why-turborepo    No drift detected

2 findings. Run `curaye check --fix` to address them interactively.
```

## `--fix` mode

`curaye check --fix` walks through each finding interactively:

For a drift finding:
```
Potential drift: ilmgah uses Zustand 4.x; shared recommends Zustand 5.x.

Options:
  1. Record a local override decision (I upgraded intentionally)
  2. Update stack.md to match shared (I missed this update)
  3. Ignore for now (remind me next check)
```

For a pending update finding:
```
shared/design/glass-ui was updated. Review the diff? [y/n]
```

## Desktop integration

Drift findings appear as badges in the projects sidebar (amber warning dot next to the project name). The tree panel shows an "Issues" section at the top when drift is detected, listing findings with links to the relevant documents.

Running a drift check is triggered by a "Check" button in the project panel header, or automatically on project open if the last check was > 7 days ago.

## Acceptance criteria

1. `curaye check` for a project with no adopted shared documents reports "Nothing to check" and exits cleanly.
2. A project using a library not mentioned in its adopted shared stack document surfaces a "Potential drift" warning.
3. A project with a local decision that explicitly `superseded_by`-references a shared decision is not flagged as drift.
4. A shared document updated after adoption surfaces as "Pending update", not as drift.
5. `curaye check --fix` walks through findings and the "Ignore for now" option suppresses the finding until the next `curaye sync` or manual check.
6. `curaye check --all` checks all registered projects and outputs findings grouped by project.
7. The desktop sidebar shows an amber badge on projects with unresolved drift findings.
8. Resolving all findings for a project clears the badge in the sidebar.
9. Without AI configured, drift detection falls back to text comparison and flags term-level differences.
10. `curaye check` exits with a non-zero code if any findings are classified as drift (useful in CI/CD pre-sync hooks).
