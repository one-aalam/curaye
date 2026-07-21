---
id: brownfield-import
title: Brownfield Import — Existing Projects Without History
status: draft
effort: l
impact: high
desire: high
requires: [project-bootstrap, package-ai]
tags: [cli, desktop, ai]
created: 2026-07-21
updated: 2026-07-21
---

# Brownfield Import — Existing Projects Without History

> An existing project with real code, real decisions, and no `.curaye/` folder. Curaye reads what it can, infers the rest, and interviews for what it cannot.

## Problem

Most projects a developer wants to manage in Curaye already exist. They were built without any structured planning layer. A tool that only works on new projects is useful for a fraction of the portfolio.

## Goal

A brownfield import flow that analyses an existing project's codebase, git history, and any existing documentation to generate an initial `.curaye/` at approximately 60% fidelity — accurate enough to be useful immediately, clearly marked for review where inferred.

## Non-goals

- Perfect accuracy — inferred documents are drafts, not ground truth.
- Importing from other planning tools (Linear, Notion, GitHub Projects) — that is a separate integration spec.
- Modifying any existing project files — the import only writes to `.curaye/`.

## Confidence model

All generated documents carry a `confidence` field in frontmatter (not part of the core protocol, but an import-specific extension that is removed once the user reviews and confirms a document):

```yaml
---
id: reader
title: Reader
domain: reader
updated: 2026-07-21
confidence: inferred    # inferred | reviewed | confirmed
---
```

The desktop app and CLI surface confidence as a visual indicator — inferred documents are shown with a distinct style (dashed border, italic label) until reviewed.

## What can be inferred automatically

| Source | What Curaye infers | Confidence |
|---|---|---|
| `package.json` / `Cargo.toml` | `stack.md` — framework, key deps, scripts | High |
| `README.md` | `prd.md` seed — name, description, purpose | Medium |
| Directory structure + file names | `current/` — feature domains (reader, library, auth…) | Medium |
| DB schema files | Data model sections in `current/` docs | Medium |
| Git tags + large commits | `shipped/` skeleton — what shipped and roughly when | Medium |
| Code TODOs + open GitHub issues | `planned/` candidates | Low |
| Code comments explaining why | `decisions/` candidates | Low |

## AI-assisted inference

With a provider configured, AI reads the following and generates richer content:

- **`current/` documents**: AI reads the source files for each inferred domain and writes a feature-level description — not "this file exists" but "the reader supports paginated and scrolled flow, with TTS and highlights."
- **`prd.md`**: AI drafts a product brief from README + inferred feature list, asking the user to confirm the north star.
- **`decisions/` candidates**: AI scans for patterns that imply decisions (specific library choices, custom implementations where popular alternatives exist) and generates ADR drafts with confidence: `inferred`.

Without AI, only deterministic inference runs (stack.md, prd.md seed, shipped skeleton).

## Interview — targeting the gaps

After inference, Curaye conducts a targeted interview (5–7 questions) based on what was *not* inferrable:

```
I've inferred your stack and a current/ skeleton. A few things I couldn't determine:

1. What is the one-sentence north star for this project?
   (I found: "A desktop EPUB reader" — confirm or replace)

2. Are there features in the codebase you consider abandoned or deprecated?

3. Any tech choices you'd redo if starting today?
   (These become decisions/ entries with status: deprecated)

4. What were you planning to build next?
   (Becomes the first planned/ entry)

5. Any decisions baked into the code that aren't obvious from reading it?
```

The interview is skippable — the user can accept the inferred documents and review manually.

## Flow

```
curaye import [path]
```

1. Detects project type (Node, Rust, Python, etc.) from package manifests.
2. Runs deterministic inference — stack.md, prd.md seed, shipped skeleton.
3. If AI is configured, runs AI-assisted inference for current/ and decisions/ candidates. Streamed progress shown.
4. Presents inference summary: "Found 4 feature domains, 3 shipped milestones, 2 decision candidates."
5. Runs targeted interview for gaps.
6. Writes `.curaye/` with all generated documents marked `confidence: inferred`.
7. Runs `curaye link` to register the project.
8. Prints: "Import complete. 8 documents created, all marked 'inferred'. Review with `curaye review [path]`."

## Review command

```
curaye review [path]
```

Lists all documents with `confidence: inferred`, opening each in `$EDITOR` for review. After the user saves, prompts: "Mark as reviewed? [y/n]". Confirmed documents have `confidence` removed from frontmatter — they become standard protocol documents.

## Acceptance criteria

1. `curaye import` on the ilmgah project produces a `stack.md` listing Tauri, React, SQLite, and foliate-js.
2. `current/` documents are generated for each major feature area with `confidence: inferred` in frontmatter.
3. `prd.md` contains a coherent product brief — not just the README verbatim.
4. `shipped/` contains at least one entry derived from git tags or significant commits.
5. No existing project files are modified — the import is strictly additive.
6. Without AI configured, the flow completes with deterministic inference only — no error, no empty files.
7. With AI configured, `current/reader.md` describes reader behaviour at the feature level, not the file level.
8. Skipping the interview produces a complete `.curaye/` — all sections present, gaps left as empty stubs.
9. `curaye review` after import presents each `confidence: inferred` document for confirmation.
10. A document with `confidence` removed after review passes protocol validation with zero errors.
