---
name: curaye-bootstrap
description: Bootstrap a new project with a .curaye/ folder. Use when starting a project that has never been tracked under Curaye. Mines the active session context first — if you have been brainstorming, the answers are already in the conversation. Falls back to a targeted interview only for genuine gaps. Generates multiple planned specs from session output, not just one. Optionally pass the project path as an argument.
compatibility: Designed for Claude Code. Requires the curaye CLI installed.
metadata:
  version: "0.3"
---

Bootstrap a new or blank project with a `.curaye/` folder. Mines session context first, interviews only for gaps, and produces a complete initial scaffold including all planned specs surfaced in the conversation.

Project path (optional): $ARGUMENTS

If a path is provided, use it. Otherwise use the current working directory.

## Step 1 — Pre-flight checks

Check that `.curaye/` does not already exist at the target path. If it does, stop:
"This project already has a .curaye/ folder. Use `/curaye-build` to work on existing specs, or `/curaye-import` if the docs are incomplete."

Scan existing files that can inform the scaffold:
- `README.md` — project name, description, purpose
- `package.json` / `Cargo.toml` / `pyproject.toml` — stack and app type
- Any loose `.md` spec or planning files at the project root or in a `docs/`, `specs/`, or `notes/` folder

Note what you found — you will use this alongside session context in the next step.

## Step 2 — Mine the session context

Before asking a single question, extract everything already established in this conversation:

- **Project identity** — name, one-sentence description, purpose
- **Target user** — who it is for
- **App type** — desktop, web app, CLI, mobile, library, other
- **Tech stack** — languages, frameworks, libraries mentioned or decided
- **Planned features** — anything described as "we want to build X", "the first thing is Y", "it should do Z"
- **Decisions made** — any deliberate choices or tradeoffs discussed ("we chose X over Y because…")
- **Things ruled out** — scope exclusions, non-goals, "not a Z" statements

Present your extraction as a confirmation block before doing anything else:

```
From our conversation I have:

  Project:  <name> — <one sentence>
  For:      <target user>
  Type:     <app type>
  Stack:    <detected stack, or "not discussed">
  
  Planned specs I found:
    1. <feature or thing to build>
    2. <feature or thing to build>
    ...
  
  Decisions to record:
    - <decision>
    ...
  
  Gaps (I'll ask about these):
    - <anything missing>

Does this look right, or should I adjust anything before we continue?
```

Wait for confirmation or corrections. Do not proceed until the user confirms.

## Step 3 — Fill the gaps (targeted interview)

Ask only about what is genuinely missing after Step 2. Skip any question whose answer was established in the session.

**If project identity is missing:** "What is this project in one sentence?"

**If target user is missing:** "Who is it for?"

**If app type is missing:** Present the choice (Desktop / Web app / CLI / Mobile / Library / Other).

**If shared decisions are relevant:**
Run `curaye shared list --category decisions` and present results. Ask which apply.
Skip silently if the shared layer has no decisions.

**If no planned specs were found in session:** "What do you want to build first?"

Ask only what is missing. If the session already answered everything, skip this step entirely and say: "I have everything I need — no questions."

## Step 4 — Run the mechanical scaffold

```bash
curaye init <path>
```

## Step 5 — Draft the documents with AI

Using session context and any interview answers, write:

**`prd.md`** — a considered product brief:
- North star from project identity + target user
- "What it does" — from session or interview
- "What it is not" — infer from scope exclusions and ruled-out things discussed in session
- "Target user" — from session or interview

**`stack.md`** — from session context first, then shared/stack/ seed for the app type, then detected manifests. Mark unconfirmed entries with `# to verify`.

**`product.md`** — distribution and interface strategy appropriate to the app type.

**Planned specs** — one spec per feature or thing-to-build surfaced in Step 2. Do not collapse them into one. Each spec gets:
- Problem derived from conversation context
- Goal, non-goals, and 5–8 acceptance criteria
- `status: draft`, appropriate `effort` estimate, `created` and `updated` today
- A numeric prefix to establish order (e.g. `01-`, `02-`)

**Decisions** — one `decisions/<id>.md` per decision surfaced in Step 2. No `confidence: inferred` needed — these came directly from the session.

## Step 6 — Copy selected shared decisions

For each shared decision selected in Step 3:
1. Read it from `~/.curaye/shared/decisions/`
2. Copy to `.curaye/decisions/<id>.md`
3. Add `source: shared/decisions/<id>` to its frontmatter

## Step 7 — Register the project

```bash
curaye link <path>
```

## Step 8 — Check for a toolkit preset

Run:
```bash
curaye shared list --category stack
```

If any shared stack documents exist, check whether any have a `starter_kit_cmd` frontmatter field that matches the detected stack. If a match is found, note it in the report so the user knows scaffold will offer it automatically.

## Step 9 — Report

```
Bootstrap complete.

  .curaye/ created at: <path>
  prd.md, stack.md, product.md: written
  Planned specs: <N> (<list of ids and titles>)
  Decisions recorded: <N> (<list>)
  Shared decisions seeded: <list or "none">
  Registered as: <project-id>
```

**Next steps — choose your path:**

If you want to generate the project skeleton now (directories, README, starter kit, shared patterns and agents):

```bash
curaye scaffold <path>          # interactive — offers generator, patterns, agents
curaye scaffold <path> --git    # same, plus git init + initial commit
```

If you want to go straight to building:

```bash
/curaye-build <first-spec-id>
```

Or review the full picture first:

```bash
/curaye-brief
```

If a toolkit preset was found in Step 8, mention it: "Your `<preset-id>` preset matches this stack — scaffold will offer `<starter_kit>` automatically."
