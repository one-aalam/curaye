---
name: curaye-check
description: Detect and resolve drift between a project and its adopted shared-layer documents. Use when you suspect a project has diverged from shared patterns or when shared documents have been updated. Calls the CLI for deterministic comparison, interprets each finding with LLM judgment, and walks through resolutions interactively. Optionally pass a project id as an argument.
compatibility: Designed for Claude Code. Requires a Curaye-managed project and the curaye CLI installed.
metadata:
  version: "0.1"
---

Detect drift between this project's local decisions and the shared layer it has adopted. Surfaces findings, interprets them, and walks through resolutions interactively.

Project (optional): $ARGUMENTS

If a project id is provided, use it. Otherwise use the current working directory.

## Step 1 — Run mechanical drift detection

Call the CLI for the deterministic comparison:

```bash
curaye check [--project <id>]
```

Read the full output. The CLI produces findings classified as:
- `drift` — undocumented divergence from an adopted shared document
- `pending-update` — shared document updated since the project last reviewed it
- `stale` — a version or dependency reference that may be outdated
- `ok` — no issue found

If the CLI reports "Nothing to check" (no adopted shared documents), stop here:
"This project has no adopted shared documents. Run `curaye shared adopt <id>` to declare which shared patterns apply, then check again."

## Step 2 — Interpret each finding with LLM comprehension

For each `drift` or `stale` finding, do what the CLI cannot: understand *why* it might be intentional vs accidental.

Read the relevant shared document and the project's local equivalent (the file in `decisions/`, `stack.md`, or `current/` that diverges). Assess:

- Is this divergence explained by a local decision that supersedes the shared one?
  Check `decisions/` for any entry with `superseded_by` or a clear overriding rationale.
- Is this a known evolution (e.g. the project upgraded a library intentionally)?
- Is this drift that clearly crept in without intent?

Classify each finding as:
- **Intentional, undocumented** — the divergence makes sense but isn't recorded
- **Accidental** — the project probably drifted without noticing
- **Uncertain** — needs the user's input

For `pending-update` findings, summarise what changed in the shared document in plain English — the user shouldn't have to read the raw diff to decide whether to adopt the change.

## Step 3 — Present findings with interpretation

Print a summary before walking through items:

```
Drift check: <project-name>
Checked against <N> adopted shared documents.

  2 findings require attention
  1 pending update to review
  1 item looks clean

─────────────────────────────────────────────
```

Then present each finding with your interpretation:

```
⚠  DRIFT: shared/stack/tauri-react → stack.md
   Shared recommends Zustand 5.x. This project uses Zustand 4.x.
   No local override decision found.
   My read: likely accidental — Zustand 5 was released after this project
   was set up. Either update, or record why you're staying on 4.x.

📋  PENDING UPDATE: shared/design/glass-ui (14 days old)
   What changed: Added a new Dialog component and revised the token
   naming convention for border-radius values.
   Impact on this project: Low — the Dialog component isn't used here,
   but the border-radius tokens may affect existing components.
```

## Step 4 — Walk through resolutions interactively

For each `drift` or `stale` finding, offer concrete options and wait for the user's choice:

**For accidental drift:**
```
Options:
  1. Update this project to match the shared document
  2. Record a local override decision (I diverged intentionally)
  3. Ignore for now (remind me next check)

Your choice:
```

**For intentional, undocumented drift:**
```
This looks intentional but isn't documented. I'll draft a local override
decision now. Confirm the rationale: why did you diverge from the shared
recommendation?
```
(Write the decision doc from the user's answer.)

**For pending updates:**
```
Do you want to adopt this change? [y/n/partial]
- y: mark as reviewed, adopt the change
- n: mark as reviewed, note the reason for not adopting
- partial: review specific parts now
```

## Step 5 — Apply resolutions

For each resolution agreed in Step 4:

- **Update to match shared**: edit the relevant file in the project
- **Record override**: create or update `decisions/<id>.md` with the rationale
- **Mark reviewed**: run `curaye shared diff <id> --mark-reviewed --project <project-id>`
- **Ignore**: run `curaye check --ignore <finding-id>` to suppress until next sync

## Step 6 — Commit resolved items

If any files were changed:

```bash
git add .curaye/
git commit -m "$(cat <<'HEREDOC'
chore(shared): resolve drift findings from shared layer check

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
HEREDOC
)"
```

## Step 7 — Report

Print a final summary:
- Findings resolved: N
- New decisions recorded: list
- Pending updates adopted: list
- Items snoozed until next check: N

"Drift check complete."
