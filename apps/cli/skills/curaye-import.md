<!-- curaye-skill: v0.0.1 -->
---
name: curaye-import
description: Import an existing project with no .curaye/ history into the Curaye system. Use when a project has code and possibly existing spec or planning files but has never been tracked under Curaye. Mines the active session context and ingests any existing markdown spec files before running deterministic CLI inference. If no product documentation is found, offers to hand off to /curaye-bootstrap instead. Optionally pass the project path as an argument.
compatibility: Designed for Claude Code. Requires the curaye CLI installed.
metadata:
  version: "0.2"
---

Import an existing project that has no `.curaye/` history into the Curaye system. Mines session context, ingests existing spec files, runs deterministic code inference via the CLI, then uses LLM comprehension to write meaningful `current/` documents and surface decision candidates.

Project path (optional): $ARGUMENTS

If a path is provided, use it. Otherwise use the current working directory.

## Step 1 — Pre-flight checks

Confirm `.curaye/` does not exist at the target path. If it does, stop:
"This project already has a .curaye/ folder. If it's incomplete, edit the documents directly or run `/curaye-brief` to review what's there."

Do a quick read to orient yourself:
- `README.md` (if exists)
- `package.json` / `Cargo.toml` / `pyproject.toml` (if exists)
- Top-level directory structure (one level deep)

Report what you found: "I can see this is a [type] project built with [stack]. Found [N] top-level source directories."

## Step 2 — Mine the session context and ingest existing spec files

**Session mining:** Before reading any files, extract everything already established in this conversation about this project — the same extraction as `/curaye-bootstrap` Step 2:
- Project identity, target user, app type, stack
- Features already designed or discussed
- Decisions made or tradeoffs weighed
- Scope exclusions and non-goals

**Spec file ingestion:** Scan the project for human-written planning documents — look in the project root and in `docs/`, `specs/`, `notes/`, `planning/`, `.plan/` folders. Files to collect:
- Any `.md` file that looks like a spec, feature description, or planning doc (not README, not CHANGELOG, not license)
- Any file with a name suggesting planning intent: `spec-*.md`, `feature-*.md`, `*.spec.md`, `plan.md`, `roadmap.md`, brainstorm files

For each spec-like file found, read it and extract:
- What feature or capability it describes
- Any acceptance criteria, goals, or non-goals stated
- Status signals (draft, wip, done, etc.)

**Assessment:** After mining session and files, report:

```
From the session and existing files I found:

  Project:  <name or "not established">
  Stack:    <stack or "will infer from code">

  Existing spec files found: <N>
    - <filename> → "<what it describes>"
    - ...

  From our conversation:
    - <features or decisions discussed>
    - ...

  Product documentation: <"found" / "thin" / "none">
```

**Bootstrap offer:** If product documentation is effectively absent — no README or a stub README under ~10 lines, no spec files, and nothing about the project's purpose in the session — stop and ask:

```
I can't find enough product context to write meaningful prd.md or planned/ docs.
Curaye import works best when there's something to go from.

Options:
  1. Run /curaye-bootstrap first — answer a few questions, define what this project
     is and what you want to build, then come back to import the code layer.
  2. Tell me now — what is this project and what should it do? (I'll proceed with
     your answer as the product context.)

Which would you prefer?
```

If they choose option 1, stop. If they give context inline, record it and continue.

## Step 3 — Convert existing spec files to planned/ docs

For each spec-like file identified in Step 2:

1. Read it in full.
2. Map it to a Curaye `planned/` document: write proper frontmatter (`id`, `title`, `status`, `effort`, `created`, `updated`) and normalise the body to the standard structure (Problem, Goal, Non-goals, Acceptance criteria).
3. Infer `status` from any signals in the file:
   - Mentions of "done", "shipped", "v1 complete" → consider `status: done` (note for user review)
   - Mentions of "wip", "in progress" → `status: building`
   - Everything else → `status: draft`
4. Mark each with `confidence: inferred` if the mapping required interpretation; omit if the file was already well-structured.
5. Write to `.curaye/planned/<numeric-prefix>-<id>.md`.

If session context described additional features not covered by any file, draft planned/ specs for those too — these come from the conversation, so no `confidence: inferred` needed.

Present the converted specs to the user before writing:

```
I'll create these planned/ docs from your existing files and session context:

  01-<id>  <title>  [from: spec-auth.md]         status: draft
  02-<id>  <title>  [from: session]               status: draft
  03-<id>  <title>  [from: roadmap.md, status: done — review before shipping]

Write these? [y/n/edit]
```

Wait for confirmation.

## Step 4 — Deterministic inference via CLI

Run the CLI import in deterministic-only mode:

```bash
curaye import <path> --deterministic-only
```

This produces:
- `stack.md` from package manifests (high confidence)
- `prd.md` seed from README (medium confidence — will be overwritten with session context if richer)
- `current/` domain stubs from directory structure (medium confidence)
- `shipped/` skeleton from git tags (medium confidence)

All generated files are marked `confidence: inferred`. Do not modify them yet — read them first.

If the CLI produced a `prd.md` seed but session context has a richer product description, replace the CLI seed with the session-derived version.

## Step 5 — Enhance current/ with LLM comprehension

The CLI stubs `current/` from directory names — it knows files exist, not what they do.

For each `current/` document with `confidence: inferred`:

1. Identify the source directory or files this domain corresponds to.
2. Read the most relevant source files (entry points, key modules, main components — not every file).
3. Rewrite the document to describe **what the feature does**, not what files exist. Present tense. Observable behaviour.
4. Keep `confidence: inferred`.

Example:
```
BEFORE: Source files found in src/reader/

AFTER:  The reader renders EPUB files via foliate-js inside a sandboxed iframe.
        Supports paginated and scrolled flow modes, configurable per-book.
        Highlights and notes are created via text selection and stored in SQLite.
```

## Step 6 — Surface decision candidates

Read at the boundary level — `package.json`, imports in entry files, config files. Look for choices that imply decisions:
- An unusual library choice where popular alternatives exist
- A custom implementation where a library would be expected
- A recurring pattern suggesting a deliberate convention

Cross-reference with any decisions already established from the session (Step 2) — do not duplicate them.

Draft `decisions/<id>.md` for each candidate (limit 3–5):

```markdown
---
id: <kebab-id>
title: <What was decided>
status: active
date: <today>
confidence: inferred
---

## Context
<Why this decision was likely needed>

## Decision
<What was chosen>

## Consequences
<What this makes easier or harder>
```

## Step 7 — Targeted interview (gaps only)

Ask only about what the session, spec files, and code inference did not establish. Skip any question whose answer is already known.

Possible gap questions — ask only the ones that apply:

- "I inferred this north star from the README: [text]. Is that right, or would you describe it differently?" (Revise `prd.md`.)
- "Are there features in the codebase you consider abandoned, deprecated, or temporary?" (Mark those `current/` domains.)
- "Any tech choices you'd make differently if starting today?" (Add as `decisions/` with `status: deprecated`.)
- "Any decisions baked into the code that weren't obvious from reading it?" (Add as confirmed decisions — no `confidence: inferred`.)

If session context already answered all of these, skip the interview entirely and say: "No gaps — I have everything I need."

## Step 8 — Register the project

```bash
curaye link <path>
```

## Step 9 — Report

```
Import complete.

  planned/:   <N> docs (<M> from existing files, <K> from session)
  current/:   <N> docs (all confidence: inferred — review recommended)
  decisions/: <N> docs (<M> inferred, <K> confirmed from session)
  shipped/:   <N> skeleton entries from git tags

  Review inferred documents with `curaye review <path>` or open them in the desktop app.
```

"Run `/curaye-brief` for a full re-entry brief, or `/curaye-build` to start on the first planned spec."
