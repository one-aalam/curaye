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
Format: [status] id (effort) — one-line description>

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
Otherwise, recommend the highest-impact ready spec, or the spec that unblocks the most others via requires[].>

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
