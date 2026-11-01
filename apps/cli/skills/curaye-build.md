<!-- curaye-skill: v0.0.2 -->
---
name: curaye-build
description: Implement a Curaye protocol spec to its acceptance criteria. Use when you want to build a planned feature in a Curaye-managed project. Reads the spec, marks it building, implements it, and verifies every acceptance criterion before reporting. Pass a spec id as an argument, or omit to be shown the list of available specs.
compatibility: Designed for Claude Code. Requires a Curaye-managed project with a .curaye/planned/ folder.
metadata:
  version: "0.2"
---

You are about to implement a feature defined by a Curaye protocol spec. Follow every step in order without skipping.

## Step 1 — Identify the spec

The user may have passed a spec id as an argument: $ARGUMENTS

**If an id was provided:** look for a file matching that id in `.curaye/planned/` — by frontmatter `id` first, then by filename without its numeric prefix (e.g. `planned/06-cli.md` for id `cli`). Read it. If its status is `shelved`, stop and ask whether to unshelve it before building.

**If no id was provided:** scan `.curaye/planned/` for all files with `status: ready` or `status: building`. List them in this format, adding a short marker after the effort when a spec has stale dependencies or unfolded notes (e.g. `· behind sync`, `· 3 unfolded`), and ask the user which to work on:

```
Available specs:

  [ready]    02-package-protocol    @curaye/protocol — Schema, Parser & Validator    (effort: m)
  [ready]    03-package-core        @curaye/core — Project Scanner & Registry         (effort: m)
  [building] 06-cli                 CLI — Command Surface                              (effort: l)

Which spec should I work on?
```

Do not proceed until a spec is confirmed.

## Step 2 — Read and internalise the spec

Read the full spec file. Extract and confirm you understand:
- **Problem** — what is broken or missing
- **Goal** — the outcome, not the solution
- **Non-goals** — what is explicitly out of scope; do not implement these
- **All feature-specific sections** — data structures, APIs, UI behaviour, etc.
- **Acceptance criteria** — the numbered list near the end; these are the definition of done. Skip any criterion marked `*(removed in rev N …)*` — it is kept only so numbering stays stable. Refer to the remaining criteria by their existing numbers; never renumber them.
- **Log** — the `## Log` section at the very end, if present. It is context, not contract: resources to consult, discoveries to keep in mind, inspirations for the approach. Where the log and the acceptance criteria disagree, the acceptance criteria win.

### Readiness checks

Before summarising, check the spec against its surroundings. Read its `requires` list of spec ids; if it is missing or empty but the spec has `dependencies` (older Curaye projects), use that. Read its `pins` map if present (`pins: {sync: 3}`).

1. **Unmet dependencies** — for each required id, find it in `.curaye/shipped/` or `.curaye/planned/`. If it is planned and not `building` or `done`, warn: "This spec requires <id>, which hasn't been built yet." If it is `shelved`, warn more strongly: "This spec requires <id>, which is shelved."
2. **Stale dependencies** — if `pins[id]` is lower than the upstream spec's current `revision` (missing counts as 1), the contract upstream changed since this spec was last reviewed against it. Ids with no pin are not checked.
3. **Unfolded notes** — count log entries ending in `→ unfolded`, and call out any of type `upstream` or `question` specifically.

If any check fires, present it before the summary:

```
Before building api-client:
  ⚠ requires sync — pinned @3, now @4 (chunked payloads changed AC2)
  ⚠ 1 unfolded upstream note, 1 open question
  · 2 unfolded resources (will be used as context)

  1. Fold first — stop here; run /curaye-spec api-client, then build
  2. Build anyway — I'll treat the current acceptance criteria as final
```

Shelved dependencies, stale dependencies, upstream notes and open questions default to option 1; plain resources and inspirations never block. Wait for the user's choice. If they choose to build anyway, note it in the Step 7 report.

Summarise what you are about to build in 3–5 sentences and state the acceptance criteria count (excluding removed ones). Wait for the user to confirm before touching any code.

## Step 3 — Mark as building

Update the spec's frontmatter:
- Set `status: building`
- Set `updated` to today's date (YYYY-MM-DD)

Save the file. Do not commit yet.

## Step 4 — Read CLAUDE.md

Read `CLAUDE.md` in full. Pay particular attention to:
- The package dependency rules — do not add an import that violates the dependency graph
- The per-package conventions that apply to the package(s) you are about to modify
- The "What not to build" section

## Step 5 — Implement

Implement the feature according to the spec. Hold strictly to:
- The non-goals — do not implement anything listed there
- The package boundary rules from CLAUDE.md
- TypeScript 7.x strict mode — no `any`, no unsafe type assertions
- Error handling patterns defined in CLAUDE.md for the relevant package

Work through the acceptance criteria methodically. After completing each criterion, mentally verify it is satisfied before moving to the next.

## Step 6 — Verify acceptance criteria

Go through the acceptance criteria list from the spec one by one. For each:
- State whether it is satisfied
- If not, fix it before proceeding

Do not mark work complete if any criterion is unsatisfied. If a criterion cannot be satisfied without violating a non-goal or CLAUDE.md rule, surface the conflict to the user and wait for guidance.

## Step 7 — Report

When all criteria are satisfied, report:
- What was built (1 paragraph)
- Which files were created or modified
- Any criteria that required interpretation or judgment calls
- Anything that should be addressed in a follow-up spec
- If readiness warnings were overridden in Step 2, say which

Offer to record discoveries made during the build: "Capture these as log notes? I can run `/curaye-capture`." Do not edit the spec's contract yourself; changes to it go through `/curaye-spec`.

Do NOT run `/curaye-ship` automatically. Shipping is a separate, explicit decision. Tell the user: "Ready to ship. Run `/curaye-ship $SPEC_ID` when you are satisfied."
