You are graduating a completed spec through the Curaye protocol ship flow. This updates the living truth layer of the project. Follow every step in order — do not skip steps, do not combine them.

The spec to ship: $ARGUMENTS

If no spec id was provided, scan `.curaye/planned/` for files with `status: building` or `status: done`. If exactly one exists, use it and confirm with the user. If multiple exist, list them and ask which to ship.

## Step 1 — Read the planned spec

Read the full planned spec from `.curaye/planned/`. Confirm:
- The spec id and title
- Its `tags` (these inform which `current/` documents are affected)
- The acceptance criteria (these define what was built)

If the spec has `status: draft` or `status: ready` (not `building` or `done`), stop and tell the user: "This spec has not been marked as building. Run `/curaye-build $SPEC_ID` first, or manually verify the feature is complete before shipping."

## Step 2 — Create the shipped/ document

Create `.curaye/shipped/<id>.md` with this structure:

```markdown
---
id: <same id as planned spec>
title: <same title as planned spec>
shipped: <today's date YYYY-MM-DD>
release: <value from planned spec's release field, or "" if unset>
spec_ref: planned/<original filename without extension>
---

# <Title>

> Shipped on <today's date>.

## What shipped

<Write a concise summary — 2–4 sentences — of what was actually built. This is the historical record. Be specific: what files were created, what interfaces were added, what behaviour exists now that did not before.>

## Changes to current/

<List each current/ document that was updated as part of this ship, with a one-sentence description of what changed. If no current/ documents were updated, write "None — this spec added new behaviour not yet documented in current/." and flag it in Step 4.>

## Notes

<Any deviations from the spec, judgment calls made during implementation, or follow-up items for future specs. Omit this section if there is nothing to note.>
```

## Step 3 — Update current/

Read the existing `current/` documents whose domains are affected by this spec (use the `tags` from the planned spec as a guide, and the "Changes to current/" section you just wrote).

For each affected `current/` document:
1. Read it fully.
2. Identify what needs updating: new behaviour to add, changed behaviour to revise, removed behaviour to strike.
3. Edit the document to reflect what now exists. Write in the present tense — `current/` describes what the system does today, not what was built or planned.
4. Update the `updated` frontmatter field to today's date.

If a `current/` document for the relevant domain does not exist yet, create it:

```markdown
---
id: <domain-kebab-case>
title: <Domain Title>
domain: <domain>
updated: <today YYYY-MM-DD>
---

# <Domain Title>

## Overview

<1–3 sentences describing this domain area as it now exists.>

<Additional sections as appropriate.>
```

Do not leave `current/` unchanged unless this spec truly added no observable behaviour to an existing domain (e.g. a pure internal refactor with no user-facing change). If in doubt, update it.

## Step 4 — Remove the planned spec

Delete `.curaye/planned/<filename>.md`.

Confirm the file is gone. Do not move it — delete it. The `shipped/` document is the permanent record; the `planned/` file is ephemeral.

## Step 5 — Verify protocol integrity

Run a quick sanity check:
- `.curaye/shipped/<id>.md` exists and has valid frontmatter (id, title, shipped date)
- All `current/` documents you touched have today's date in `updated`
- No `planned/` file with this id remains
- The `shipped/` document's "Changes to current/" section is accurate

If anything is missing or inconsistent, fix it before proceeding.

## Step 6 — Commit

Stage only the `.curaye/` changes (planned deletion, shipped creation, current updates). Do not stage unrelated working-tree changes.

Derive the commit scope from the spec's `tags` field. Use the first tag that maps to a known CLAUDE.md scope (`cli`, `desktop`, `web`, `core`, `protocol`, `ai`, `sync`, `ui`, `shared`). If tags don't map cleanly, use `spec`.

```bash
git add .curaye/
git commit -m "$(cat <<'EOF'
feat(<scope>): ship <spec-title>

Graduated from planned/ to shipped/. Updated current/<affected-domains>.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

## Step 7 — Report

Print a short summary:
- Spec shipped: id and title
- Shipped document created: path
- current/ documents updated: list of paths
- Commit hash

Then: "Ship complete. The living truth layer has been updated."
