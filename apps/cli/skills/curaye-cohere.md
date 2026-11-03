<!-- curaye-skill: v0.0.4 -->
---
name: curaye-cohere
description: Run a coherence pass on a Curaye-managed project — find overlapping features, inconsistent UX and UI, and duplicated or divergent implementation patterns that accumulate when an app is built spec by spec. Applies mechanical fixes with approval, turns structural fixes into planned specs, records intentional overlaps as decisions, and writes lasting rules to .curaye/conventions.md. Incremental by default (since the last pass); pass --full to scan everything.
compatibility: Designed for Claude Code. Requires a Curaye-managed project with a .curaye/ folder.
metadata:
  version: "0.1"
---

Find where a project has stopped being one coherent thing, fix what is safe to fix, track what needs a spec, and leave rules behind so it doesn't drift again.

Arguments (optional): $ARGUMENTS

- `--full` — scan the whole project. Without it, the pass is **incremental**.
- `--area <ui|ux|cli|code|overlap|docs>` — limit the pass to one or more categories (comma-separated).

**Read-only until approved.** Steps 1–5 change nothing. No file is written, edited or deleted before the user approves the plan in Step 5, except that Step 7 always saves the audit record.

## How this differs from other checks

- `/curaye-check` compares a project against the **shared layer**. This pass compares a project against **itself**.
- Linters and formatters already enforce syntax and style. Do not re-report what they catch; look for what they can't — two features doing one job, one concept with three names, a pattern implemented four ways.

## Step 1 — Load the project and set the scope

Find the nearest `.curaye/` folder walking upward. If none exists, stop: "No .curaye/ folder found."

Read:
- `.curaye/prd.md` — what the product is for; overlap is judged against it
- `.curaye/conventions.md`, if present — rules already agreed
- `CLAUDE.md` at the project root, if present — code conventions and boundaries
- `.curaye/stack.md`
- Every file in `.curaye/current/`
- Every file in `.curaye/decisions/` — note decisions tagged `coherence`: these record overlaps already judged intentional
- Every file in `.curaye/shipped/` (frontmatter and "What shipped")
- The most recent file in `.curaye/audits/` (latest by filename date), if any

**Scope:**
- **Incremental (default).** "New" means shipped documents whose `shipped` date is after the last audit's `generated` date. Check the new features — the specs and the code they touched — against the rest of the project. If nothing has shipped since the last audit, say so and ask: "Nothing has shipped since the last coherence pass (<date>). Run a full pass instead? [y / n]".
- **Full** (`--full`, or no previous audit). Check everything against everything. Say which mode is running and why: "Full pass — no previous coherence pass found."

## Step 2 — Find the code

Map the project before reading it: the source folders, entry points, and where each kind of thing lives (commands, screens and components, styles and tokens, shared helpers, templates, error definitions). Use `stack.md` and `current/` to orient; use search (grep/glob) to locate; read files only where a check needs them. In incremental mode, start from the files the new shipped specs touched.

## Step 3 — Run the checks

Run every category in scope. For each, the goal is to find real inconsistencies with evidence on **every side** — never a single location described as "inconsistent" with nothing to compare.

### `overlap` — features

Compare capabilities described in `shipped/` and `current/`, and the code behind them. Look for:
- Two or more paths that produce the same outcome (two commands, a command and a palette action, a CLI flow and a skill flow doing the same job)
- A newer feature that subsumes an older one that was never removed
- Near-duplicates that differ only in surface (one has `--json`, the other doesn't)

Skip anything a `coherence`-tagged decision already covers.

### `ux` — interaction

- One concept under several names in user-facing text (commands, labels, messages, docs)
- Confirmation and destructive-action patterns that differ between similar actions
- Error messages in different styles (tone, structure, whether they suggest a fix)
- Empty states, loading states and success messages handled differently for similar views or commands

### `cli` — command surface (if the project has a CLI)

- Flag names and short flags that differ for the same meaning (`--project` vs `--proj`, `-p` used for two things)
- Commands that support `--json` or `--help` text conventions where siblings don't
- Output formatting that differs between similar commands (tables, prefixes, icons, exit codes)

### `ui` — visual (if the project has a UI)

- Hardcoded colours, spacing, radii or font sizes where design tokens or theme variables exist
- Component variants that duplicate an existing component (a second modal, button or card implementation)
- Layout and typography outliers among sibling screens

### `code` — implementation patterns

- The same template, helper or logic written out in several places
- Several approaches to one concern (error handling, file writes, config loading, data fetching) where the project otherwise has one
- Code that breaks a rule stated in CLAUDE.md or `conventions.md`

### `docs` — truth layer

- `current/` documents that describe behaviour the code no longer has, or omit behaviour it does

### Recording a finding

Give each finding an id (`F1`, `F2`, …) and record:
- **Category** — one of the above
- **Severity** — `high` (users or future builds are actively affected), `medium`, or `low` (cosmetic)
- **Evidence** — every location, as `path:line` where a line applies
- **Class**:
  - **mechanical** — a local, behaviour-preserving edit with one obvious right answer (a hardcoded colour to an existing token, a message to the established style, a flag description fixed). No interfaces change.
  - **structural** — needs design or touches behaviour, interfaces, or several modules (merging templates, choosing one of two features, renaming a public flag).
  - **intentional?** — plausibly deliberate (for example a CLI and a skill doing related jobs by design). The user decides.
- **Proposal** — the concrete fix, or for structural findings the spec it should become

Also note **convention candidates**: a rule that, had it existed, would have prevented a finding. Each must name a canonical example — a real file in this project that already does it right.

## Step 4 — Present the findings

Lead with a summary, then each finding, most severe first:

```
Coherence pass — <project> (<full | incremental since YYYY-MM-DD> · <N> shipped specs in scope)

  3 structural · 4 mechanical · 1 to decide · 2 convention candidates

F1  code · structural · high
    Planned-spec template written out 6×:
      apps/cli/src/commands/new.ts:72
      apps/cli/src/commands/ai.ts:80
      …
    None include revision or ## Log.
    → new spec: single-spec-template

F4  ui · mechanical · low
    Status dot uses `bg-amber-400`; every other status colour uses `--status-*` tokens
      apps/desktop/src/components/ProjectsSidebar.tsx:88
      apps/desktop/src/styles/tokens.css:14
    → replace with `bg-[var(--status-warning)]`

F6  overlap · intentional? · medium
    `curaye ai draft` and `/curaye-spec` both draft planned specs
      apps/cli/src/commands/ai.ts:42 · apps/cli/skills/curaye-spec.md
    → record as intentional (CLI is deterministic, skill is conversational), or spec a consolidation

Convention candidates
  Code — Planned specs are created from one template.     Example: <path once it exists, or the best current one>
  UI   — Status colours come from --status-* tokens.        Example: apps/desktop/src/styles/tokens.css
```

If there are no findings, say so plainly, still offer convention candidates if any, and go to Step 7.

## Step 5 — Agree the plan

Ask once, for the whole pass:

```
Apply?
  y         — mechanical fixes, specs for structural findings, your call on each "intentional?", and the conventions
  pick      — choose per finding and per convention
  findings  — change nothing; save the audit only
```

For each `intentional?` finding (under `y` or `pick`), ask: "Intentional — record a decision, or spec a consolidation? [decision / spec / skip]".

Wait for answers. Do not write anything until they are given.

## Step 6 — Apply

In this order:

### 6a. Mechanical fixes

Show the complete diff for all approved mechanical fixes together and wait for `y`. Then apply them. Afterwards, run the project's typecheck or build if one is defined (`package.json` scripts, `Cargo.toml`, and so on) and report the result. If a fix breaks the build, revert that fix and reclassify the finding as structural.

### 6b. Structural findings → planned specs

Write one planned spec per structural finding (or per closely related group), following `/curaye-spec` conventions:
- `planned/<NN>-<id>.md`, `NN` one more than the highest prefix in `planned/`
- `status: draft`, an `effort` estimate, `revision: 1`, `created` and `updated` today, `tags` from the affected areas
- Problem (from the evidence), Goal, Non-goals, 4–8 acceptance criteria — one of which states the convention it establishes, if any
- `## Log` with `- <today> · origin · coherence pass <audit filename>, finding F<n>`

If the finding belongs to an existing planned spec, append a `discovery` entry to that spec's Log instead (` → unfolded`), and say so.

### 6c. Intentional findings → decisions

Write `decisions/<NN>-<id>.md` using the project's decision format (`status: active`, `date` today), with `tags` including `coherence`. Context names every location from the evidence; Decision says why the overlap stays. Later passes skip overlaps a `coherence` decision covers.

### 6d. Conventions

Create `.curaye/conventions.md` if it doesn't exist:

```markdown
---
updated: <today>
---

# Conventions

Rules this project follows. Each names a canonical example. `/curaye-build` reads this file; `/curaye-cohere` checks against it.

## UI

## UX

## CLI

## Code
```

Add each approved rule under its heading (drop headings the project has no use for):

```markdown
- **<Rule name>.** <One or two lines stating the rule.> Example: `<path>`.
```

Never remove or reword an existing rule without asking. Update `updated` to today.

## Step 7 — Save the audit

Always write `.curaye/audits/<today>.md` (create the folder if needed; if the file exists, use `<today>-2.md`, `-3`, …):

```markdown
---
generated: <today>
scope: <full | incremental>
since: <last audit date>      # incremental only
---

# Coherence pass — <today>

## Summary

<Mode and why; specs in scope; counts by class and category.>

## Findings

### F1 — <title>
- Category: <category> · Severity: <severity> · Class: <class>
- Evidence: <locations>
- Outcome: <fixed | spec planned/<file> | decision decisions/<file> | logged on <spec> | not applied | skipped>

## Actions taken

<Files changed, specs written, decisions written — or "None (findings only).">

## Conventions added

<Rules added to conventions.md, or "None.">
```

## Step 8 — Verify

Re-read every file written. Check:
- Frontmatter of new specs, decisions and `conventions.md` parses as YAML, with the required fields and valid enum values.
- Every finding in the audit has an outcome.
- Every new spec's `origin` entry names this audit.
- Every convention names an example file that exists.

Fix anything that fails before reporting.

## Step 9 — Commit (offer)

Ask: "Commit these changes? [y/n]". If yes, stage the `.curaye/` changes and any files changed by mechanical fixes:

```bash
git add .curaye/ <mechanically fixed files>
git commit -m "$(cat <<'HEREDOC'
chore(spec): coherence pass <today>

<N> findings: <k> fixed, <m> specs planned, <d> decisions, <c> conventions added.
HEREDOC
)"
```

Use the project's own commit conventions if CLAUDE.md defines them. Do not commit without the user's yes.

## Step 10 — Report

```
Coherence pass complete — <full | incremental>.

  Findings:     <N> (<high> high · <medium> medium · <low> low)
  Fixed:        <k> mechanical
  Specs:        <ids or "none">
  Decisions:    <ids or "none">
  Conventions:  <n added, or "none">
  Audit:        .curaye/audits/<file>
```

If specs were planned, close with: "Run `/curaye-spec <id>` to refine them, or `/curaye-build <id>` to fix them."
