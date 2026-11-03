<!-- curaye-skill: v0.0.4 -->
---
name: curaye-brief
description: Generate a structured re-entry brief for a Curaye-managed project. Use when returning to a project after time away or before starting a work session. Reads prd.md, stack.md, current/, planned/, inbox/, decisions/, and recent shipped/ entries, then synthesises a brief covering current state, planned work, notes waiting to be folded, where you left off, decisions to revisit, a suggested first step, and a vision check.
compatibility: Designed for Claude Code. Requires a Curaye-managed project with a .curaye/ folder.
metadata:
  version: "0.2"
---

Generate a structured re-entry brief for a Curaye-managed project. The brief answers: what exists, where you left off, what's next, and what needs revisiting.

Project (optional): $ARGUMENTS

If a project id is provided, locate it via `curaye projects --json` and read from its `.curaye/` path. If no argument, use the current working directory and find the nearest `.curaye/` folder walking upward.

## Step 1 — Locate and read the project

Read all of the following in full:
- `.curaye/prd.md` — the north star
- `.curaye/stack.md` — tech context
- `.curaye/product.md` — distribution and interface strategy (if exists)
- All files in `.curaye/current/` — what exists today
- All files in `.curaye/planned/` — what is intended next
- All files in `.curaye/decisions/` — why things are the way they are
- The most recent file in `.curaye/shipped/` (if any) — what last shipped
- Frontmatter and body of every file in `.curaye/inbox/` (if the folder exists) — ideas not yet specced
- The filename of the most recent file in `.curaye/audits/` (if any) — the last coherence pass

For each planned spec, also work out:
- **Edges:** its `requires` list of spec ids. If `requires` is missing or empty but the spec has `dependencies` (older Curaye projects), read `dependencies` instead.
- **Pins:** its `pins` map, if present — `pins: {sync: 3}` means it was last reviewed against revision 3 of `sync`.
- **Unfolded notes:** the number of entries in its `## Log` section ending in `→ unfolded`.
- **Stale edges:** ids in `requires` whose `pins` value is lower than the upstream spec's current `revision` (missing `revision` counts as 1). Ignore ids with no pin and ids whose upstream is in `shipped/`.
- **Blocked on shelved work:** ids in `requires` whose upstream has `status: shelved`.
- **Pending upstream changes:** unfolded log entries of type `upstream`.

Also run:
```bash
curaye projects --json
```
to get the project's `last_opened` date if available.

## Step 2 — Generate the brief

Produce the brief in this exact structure. Be specific — no vague summaries, no invented content:

```
─────────────────────────────────────────────────────
CURAYE  Re-entry Brief: <Project Name>
<Last activity line if date is available, otherwise omit>
─────────────────────────────────────────────────────

CURRENT STATE
<3–5 sentences synthesising what the project does today, drawn from current/.
Name specific features, not file paths. Write as if briefing a colleague.>

WHAT WAS PLANNED
<List of planned specs, grouped by status. Building first, then ready, then draft.
Then done (built, awaiting ship), then shelved on one line: "Shelved: offline-mode, themes".
Format: [status] id (effort) — one-line description
Include impact and desire after the effort when set, e.g. "(m · impact high · desire low)".
Append to a spec's line only when it applies, e.g.:
  · 4 unfolded notes
  · behind sync (pinned @3, now @4)
  · waiting on: storage (not yet shipped)
  · blocked: requires shelved offline-mode
End with one inbox line if inbox/ has seeds:
  Inbox: 3 seeds — plugin-api, unresolved-links-panel, offline-mode>

NOTES WAITING TO BE FOLDED
<Only if any spec has unfolded notes or stale edges; otherwise omit this section.
One line per spec, most urgent first (stale edges and upstream entries before
plain notes): "sync — 4 unfolded (1 question, 2 resources, 1 discovery)",
"export — behind sync @3→4: chunked payloads may break its AC3".
Close with: "Run /curaye-spec <id> to fold these in.">

COHERENCE
<Count shipped/ documents whose `shipped` date is after the last audit's date (all of
them if there is no audit). Include this section only when the count is 5 or more:
"8 specs shipped since the last coherence pass (2026-09-14) — run /curaye-cohere."
or, with no audit yet: "12 specs shipped and no coherence pass yet — run /curaye-cohere --full.">

WHERE YOU LEFT OFF
<The planned spec with the most recent `updated` date. State its id, title,
and a one-sentence summary of what it is. If multiple specs share the same
updated date, list all of them.>

DECISIONS TO REVISIT
<Scan decisions/ for:
- Any decision with status: superseded or status: deprecated
- Any decision referencing a library or tool that may have evolved
  (use stack.md for context on what's in use)
Flag each as a question, not a statement: "Why-sqlite references v2.1 — v2.3 released?">

SUGGESTED FIRST STEP
<One concrete recommendation: which spec to build next and why.
If a building spec exists, recommend continuing it.
Otherwise, recommend among ready specs, weighing in this order:
  1. how many non-shelved planned specs list it in `requires` (or `dependencies` in older projects)
  2. its `impact` (high > medium > low; unset counts as medium)
  3. its `desire` — prefer what the user wants to work on when the first two are close
Name which of these drove the choice. Never recommend a shelved spec, or one that
requires a shelved spec.
If the spec you would recommend has stale edges or unfolded upstream entries, recommend
running /curaye-spec <id> on it first, and say why.>

VISION CHECK
<One sentence: do the planned specs align with prd.md's north star?
If something in planned/ contradicts or ignores the north star, flag it.>
─────────────────────────────────────────────────────
```

## Step 3 — Offer to save

After printing the brief, ask:

"Save this brief to `.curaye/briefs/`? [y/n]"

If yes, run:
```bash
curaye brief --save
```

Or if the CLI brief command isn't available yet, write the brief to `.curaye/briefs/YYYY-MM-DD.md` directly with frontmatter:

```yaml
---
generated: YYYY-MM-DD
---
```

## Step 4 — Offer next action

"Would you like to start working on <suggested spec>? I can run `/curaye-build <spec-id>` now."

Wait for the user's response. Do not auto-start building.
