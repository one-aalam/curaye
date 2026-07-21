---
name: curaye-build
description: Implement a Curaye protocol spec to its acceptance criteria. Use when you want to build a planned feature in a Curaye-managed project. Reads the spec, marks it building, implements it, and verifies every acceptance criterion before reporting. Pass a spec id as an argument, or omit to be shown the list of available specs.
compatibility: Designed for Claude Code. Requires a Curaye-managed project with a .curaye/planned/ folder.
metadata:
  version: "0.1"
---

You are about to implement a feature defined by a Curaye protocol spec. Follow every step in order without skipping.

## Step 1 — Identify the spec

The user may have passed a spec id as an argument: $ARGUMENTS

**If an id was provided:** look for a file matching that id in `.curaye/planned/` (e.g. `planned/06-cli.md` for id `cli`). Read it.

**If no id was provided:** scan `.curaye/planned/` for all files with `status: ready` or `status: building`. List them in this format and ask the user which to work on:

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
- **Acceptance criteria** — the numbered list at the end; these are the definition of done

Summarise what you are about to build in 3–5 sentences and state the acceptance criteria count. Wait for the user to confirm before touching any code.

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

Do NOT run `/curaye-ship` automatically. Shipping is a separate, explicit decision. Tell the user: "Ready to ship. Run `/curaye-ship $SPEC_ID` when you are satisfied."
