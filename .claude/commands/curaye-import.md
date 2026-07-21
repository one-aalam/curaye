Import an existing project that has no `.curaye/` history into the Curaye system. Runs deterministic inference via the CLI, then uses LLM comprehension to write meaningful `current/` documents and surface decision candidates.

Project path (optional): $ARGUMENTS

If a path is provided, use it. Otherwise use the current working directory.

## Step 1 — Pre-flight checks

Confirm `.curaye/` does not exist at the target path. If it does, stop:
"This project already has a .curaye/ folder. If it's incomplete, edit the documents directly or run `/curaye-brief` to review what's there."

Read the following to orient yourself before touching anything:
- `README.md` (if exists)
- `package.json` / `Cargo.toml` / `pyproject.toml` (if exists)
- Top-level directory structure (one level deep)

Report what you found: "I can see this is a [type] project built with [stack]. Found [N] top-level source directories."

## Step 2 — Deterministic inference via CLI

Run the CLI import in deterministic-only mode — no AI, just file analysis:

```bash
curaye import <path> --deterministic-only
```

This produces:
- `stack.md` from package manifests (high confidence)
- `prd.md` seed from README (medium confidence)
- `current/` domain stubs from directory structure (medium confidence)
- `shipped/` skeleton from git tags (medium confidence)

All generated files are marked `confidence: inferred` in frontmatter. Do not modify them yet — read them first.

## Step 3 — Enhance current/ with LLM comprehension

The CLI stubs `current/` from directory names — it knows files exist, not what they do. Your job is to replace stubs with meaningful descriptions.

For each `current/` document with `confidence: inferred`:

1. Identify the source directory or files this domain corresponds to.
2. Read the most relevant source files (entry points, key modules, main components — not every file).
3. Rewrite the `current/` document to describe **what the feature does**, not what files exist. Present tense. Observable behaviour.
4. Keep `confidence: inferred` — the user will review and confirm.

Example transformation:
```
BEFORE (CLI stub):
## Overview
Source files found in src/reader/

AFTER (LLM enhanced):
## Overview
The reader renders EPUB files via foliate-js inside a sandboxed iframe.
Supports paginated and scrolled flow modes, configurable per-book.
Highlights and notes are created via text selection and stored in SQLite.
```

## Step 4 — Surface decision candidates

Read the source code at the boundary level — `package.json`, imports in entry files, config files. Look for choices that imply decisions:

- An unusual library choice where popular alternatives exist
- A custom implementation where a library would be expected
- A pattern that recurs across the codebase suggesting a deliberate convention

For each candidate, draft a `decisions/<id>.md` with `confidence: inferred` and `status: active`:

```markdown
---
id: <kebab-id>
title: <What was decided>
status: active
date: <today>
confidence: inferred
---

# Decision: <Title>

## Context
<Why this decision was likely needed, inferred from the code>

## Decision
<What was chosen, stated plainly>

## Consequences
<What this makes easier or harder — infer from code patterns>
```

Limit to 3–5 high-confidence candidates. Do not invent decisions that are not evidenced by the code.

## Step 5 — Targeted interview

Ask 5 targeted questions covering what cannot be inferred:

**Q1** — "I found: [prd.md seed from README]. Is this the right north star, or would you describe it differently?"
(Revise `prd.md` from the answer.)

**Q2** — "Are there features in the codebase you consider abandoned, deprecated, or temporary?"
(Mark those `current/` domains with a note or remove them if appropriate.)

**Q3** — "Any tech choices you'd make differently if starting today?"
(These become `decisions/` entries with `status: deprecated` and the reason noted.)

**Q4** — "What were you planning to build next?"
(Becomes the first `planned/` spec. Draft it from the answer.)

**Q5** — "Any decisions baked into the code that weren't obvious from reading it?"
(Add these to `decisions/` as additional confirmed entries, no `confidence` field needed — the user stated them directly.)

## Step 6 — Register the project

```bash
curaye link <path>
```

## Step 7 — Report and review prompt

Print a summary:
- Documents created: counts by type (current: N, decisions: N, planned: N)
- All marked `confidence: inferred` except those confirmed in the interview
- "Review inferred documents with `curaye review <path>` or open them in the desktop app."

"Import complete. Run `/curaye-brief` to generate a re-entry brief, or `/curaye-build` to start on the first planned spec."
