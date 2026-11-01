---
name: curaye-ship
description: Graduate a completed Curaye spec from planned/ to shipped/, update the current/ layer, and optionally sync stack.md and CLAUDE.md. Use after /curaye-build when the implementation is done. The CLI handles mechanical file operations; this skill writes the current/ update with LLM comprehension, then proposes targeted edits to stack.md and CLAUDE.md when what shipped affects the tech stack or agent conventions. Pass the spec id as an argument.
compatibility: Designed for Claude Code. Requires a Curaye-managed project and the curaye CLI installed.
metadata:
  version: "0.2"
---

You are graduating a completed spec through the Curaye protocol ship flow. The CLI handles all mechanical file operations. Your job is the intelligent part: writing the `current/` update that reflects what now exists.

The spec to ship: $ARGUMENTS

If no spec id was provided, scan `.curaye/planned/` for files with `status: building` or `status: done`. If exactly one exists, use it and confirm with the user. If multiple exist, list them and ask which to ship.

## Step 1 — Read the planned spec

Read the full planned spec from `.curaye/planned/`. Confirm you understand:
- The spec id, title, and tags
- What was built (from the goal and feature sections)
- Which domains are affected (use `tags` and the non-goals as guides)
- The acceptance criteria — these define what actually shipped. Ignore any marked `*(removed in rev N …)*`.

If `status` is `draft` or `ready`, stop: "This spec has not been built. Run `/curaye-build $SPEC_ID` first."

**Save what the CLI is about to delete.** `curaye ship` removes the planned file in Step 2, so collect these now and keep them for later steps:
- The spec's `revision` (missing counts as 1)
- From its `## Log` section (if any):
  - every `resource` entry (summary and URL), folded or not
  - every entry still ending in `→ unfolded`, of any type
- Its **dependents**: every other file in `.curaye/planned/` whose `requires` list includes this spec's id. If a spec's `requires` is missing or empty but it has `dependencies` (older Curaye projects), read that instead. For each dependent, note its pin on this spec from its `pins` map (e.g. `pins: {sync: 3}`), or that it has none. Skip dependents with `status: shelved`.

## Step 2 — Call the CLI for mechanical graduation

Run the CLI ship command. It handles: creating the `shipped/` document skeleton, deleting the planned spec, and updating the registry.

```bash
curaye ship <spec-id>
```

If the spec has a `release` field set, pass it:

```bash
curaye ship <spec-id> --release <release-value>
```

When the CLI prompts "Update current/ now?", answer `n` — you will handle this in the next step with full LLM comprehension rather than opening an editor.

Confirm the planned spec file is gone and `shipped/<id>.md` exists before continuing.

## Step 3 — Write the shipped/ document body

The CLI creates the `shipped/` document with frontmatter only. Open it and write the body:

```markdown
> Shipped on <today's date>.

## What shipped

<2–4 specific sentences describing what was actually built. Reference concrete things: interfaces exported, commands added, files created, behaviour that now exists. This is the permanent historical record — be precise.>

## Changes to current/

<List each current/ document you are about to update, with one sentence per document describing the change. If a current/ document needs to be created, note it here too.>

## Notes

<Deviations from the spec, judgment calls, or items for follow-up specs. Omit section entirely if nothing to note.>

## References

<The resource entries saved in Step 1, one per line: "- <summary> — <URL>". Omit the section if there were none.>
```

Save the shipped document.

## Step 4 — Update current/

This is the core intelligent step. Read the existing `current/` documents for the affected domains. For each:

1. Read it in full.
2. Determine what this shipped spec adds, changes, or removes in that domain.
3. Edit the document so it accurately describes the system **as it exists now** — present tense, no references to plans or intentions.
4. Update its `updated` frontmatter field to today's date.

If no `current/` document exists for an affected domain, create one:

```markdown
---
id: <domain-kebab>
title: <Domain Title>
domain: <domain>
updated: <today YYYY-MM-DD>
---

# <Domain Title>

## Overview

<What this domain is and what it does, as of today.>
```

Do not leave `current/` unchanged unless the spec was a pure internal refactor with zero observable behaviour change — and even then, note this explicitly.

## Step 5 — Carry forward open notes and tell dependents

Nothing captured against the spec should disappear at graduation.

### 5a. Open notes → inbox seeds

Take the unfolded log entries saved in Step 1, excluding `resource` entries (already preserved in References). For each, decide whether the build resolved it. Propose the unresolved ones as inbox seeds, grouping closely related entries into one seed:

```
These notes on sync were never folded in and aren't resolved by what shipped:
  question     Do settings sync, or only content?
  inspiration  Obsidian-style unresolved-links panel for conflicts

Save them to the inbox as follow-ups? [y / n / edit]
```

On yes, write each seed to `.curaye/inbox/<kebab-id>.md` (create the folder if needed):

```markdown
---
id: <kebab-id>
title: <short title>
created: <today>
source: ship
follows: <shipped spec id>
---

<the original entry line or lines>
```

Skip this sub-step silently if there are no unfolded non-resource entries.

### 5b. Dependents

For each dependent saved in Step 1, the edge is now satisfied by `shipped/`; do not change its `requires` list or its `pins`.

- **Pinned at the shipped revision** — no action.
- **Stale pin or unpinned** — it was last reviewed against an older contract, or never. Compare what actually shipped (Step 3, including Notes) with what that dependent relies on. If anything it relies on differs, append to the end of its `## Log` section (add the section if missing):
  ```markdown
  - <today> · upstream · <shipped id> shipped: <what differs from what this spec assumed>. → unfolded
  ```
  Update its `updated` field. If nothing it relies on differs, make no change.

Mention any notified dependents in the report so the user can run `/curaye-spec <id>` on them.

## Step 6 — Sync stack.md and CLAUDE.md (optional, user-confirmed)

Reason about whether what just shipped has implications for the two meta-documents. These are not updated on every ship — only when something structurally changed.

**`stack.md` is affected when the spec introduced:**
- A new package or app in the monorepo
- A new runtime dependency (library, tool, runtime version)
- A removed or replaced dependency
- A new version pin or constraint

**`CLAUDE.md` is affected when the spec established:**
- A new package boundary rule or dependency constraint
- A new error-handling pattern or convention
- A new commit scope or type
- A new "what not to build" invariant
- A new per-package convention agents must follow

**If neither document is affected**, skip this step silently — do not mention it to the user.

**If one or both are affected**, present your proposed changes before writing anything:

```
stack.md needs updating:
  + js-yaml ^4.3.0 added as a runtime dependency of @curaye/core
  + @types/js-yaml added as a dev dependency

CLAUDE.md needs updating:
  + Note that js-yaml must be imported as named exports ({ load, dump }),
    not a default import, due to its CJS export shape

Apply these changes? [y/n/edit]
  y     — write both files as proposed
  n     — skip, no changes
  edit  — show me the diff first, I'll tell you what to adjust
```

Wait for the user's response before writing. If they say `edit`, show the exact lines you intend to add or change and wait for approval.

When approved, write the changes. Update the `updated` frontmatter field in `stack.md` if it has one.

## Step 7 — Commit

Stage only `.curaye/` changes. Derive the commit scope from the spec's first tag that maps to a CLAUDE.md scope (`cli`, `desktop`, `web`, `core`, `protocol`, `ai`, `sync`, `ui`, `shared`). Fall back to `spec`.

```bash
git add .curaye/ stack.md CLAUDE.md
git commit -m "$(cat <<'HEREDOC'
feat(<scope>): ship <spec-title>

Graduated planned/<id> → shipped/<id>. Updated current/<domains>.
<If inbox seeds were created or dependents notified, add a line saying so.>
<If stack.md or CLAUDE.md were updated, add a line: Updated stack.md / CLAUDE.md.>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
HEREDOC
)"
```

## Step 8 — Report

- Spec shipped: id and title
- Shipped document: path
- current/ documents updated or created: list
- Inbox seeds created: list, or omit if none
- Dependents notified: list with one-line reason each, or omit if none
- Commit: hash

"Ship complete. The living truth layer has been updated."
