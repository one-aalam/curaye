<!-- curaye-skill: v0.0.2 -->
---
name: curaye-spec
description: Create new specs and evolve existing ones in a Curaye-managed project after a brainstorm, a discovery, or a batch of captured notes. Mines the session, routes each idea to a new spec, an amendment, a log entry, a decision, or the inbox, runs a dependency impact pass on every contract change, and folds approved changes in with a revision bump. Pass a spec id to groom that one spec's unfolded log; omit to work from the current session.
compatibility: Designed for Claude Code. Requires a Curaye-managed project with a .curaye/ folder.
metadata:
  version: "0.1"
---

Turn session thinking and accumulated notes into correct, well-placed spec changes. Bootstrap and import write specs once; build and ship consume them. This skill owns everything in between.

Argument (optional): $ARGUMENTS

- **A spec id** (e.g. `sync`) → **grooming mode**: review that spec's unfolded log, resolve its open questions, fold in what is ready.
- **Anything else** (e.g. a working title) → **session mode**, using the text as a hint for what to focus on.
- **Nothing** → **session mode** over the whole conversation.

## Conventions this skill maintains

Read these before doing anything. Every write must follow them.

### Two speeds of a spec

- **The contract** — Problem, Goal, Non-goals, feature sections, Acceptance criteria. `/curaye-build` treats it as the definition of done. It changes only through a fold-in (Step 6), which bumps `revision`.
- **The raw material** — the `## Log` section at the very end of the spec. Append-only. Cheap. Never changes the contract by itself.

### Spec frontmatter fields this skill reads and writes

```yaml
# Protocol schema fields (validated by @curaye/protocol)
id: sync                 # optional in the schema; the file is planned/<NN>-<id>.md
title: Sync engine
status: draft            # draft | ready | building | done | shelved
effort: m                # xs | s | m | l | xl
impact: high             # optional: low | medium | high
desire: medium           # optional: low | medium | high
requires: [storage, auth]
tags: [core, sync]
release: ''
created: 2026-09-02      # YYYY-MM-DD
updated: 2026-11-01      # YYYY-MM-DD

# Extension fields (kept by the schema's passthrough; only Curaye skills read them)
revision: 3              # contract revision; treat missing as 1
last_folded: 2026-11-01  # date of the last fold-in; omit if never folded
pins: {storage: 2, auth: 1}
follows: sync-v1         # optional: the shipped spec this one continues
related: [conflict-panel] # optional: soft links, no impact tracking
```

Never write a value the schema would reject: `status`, `effort`, `impact`, and `desire` must use the enum values above, and dates must be `YYYY-MM-DD`.

### Dependency edges: `requires`

- `requires` lists the bare ids this spec depends on. It is the **only** place an edge is stored. Dependents are always computed by scanning every spec's `requires`; never store the reverse direction.
- `requires` entries are always plain ids — never put a revision or any other suffix in them. Other Curaye tools resolve these strings as spec ids.
- **Legacy fallback:** if a spec has no `requires` key (or an empty one) but has `dependencies`, read `dependencies` as if it were `requires`. Whenever this skill edits that spec for any reason, move the entries to `requires`, delete `dependencies` in the same edit, and say so in the plan (Step 5). Never leave both keys in one file.
- Resolve an id by matching frontmatter `id` first, then filename without the numeric prefix (`id` is optional in the schema).

### Revision pins: `pins`

- `pins` maps an upstream id to the upstream `revision` this spec was last reviewed against: `pins: {storage: 2}`.
- **Untracked edge:** an id in `requires` with no entry in `pins`. Pin it at the upstream's current revision the next time this skill checks that edge.
- **Stale edge:** `pins[id]` < the upstream's current `revision`.
- **Orphan pin:** a key in `pins` that is not in `requires`. Harmless; remove it the next time this skill edits that spec.
- **Satisfied edge:** the upstream id exists in `shipped/`. Keep it in `requires` as history; its pin no longer matters and can be removed on the next edit.
- **Dangling edge:** the upstream id is in neither `planned/` nor `shipped/`.
- If `pins` ends up empty, remove the key.

### Shelved specs

`status: shelved` means parked on purpose. Treat a shelved spec as out of play:
- Do not amend its contract unless the user unshelves it (sets it back to `draft` or `ready`) in this run.
- Ideas that match it are logged on it, and the plan flags that it is shelved.
- As a dependent, it is skipped by the impact pass: leave its pin as is, so the stale pin flags it if it is ever unshelved.
- As an upstream, a spec that `requires` a shelved spec gets flagged in the plan: it is blocked on parked work.

### Log format

```markdown
## Log

- 2026-10-14 · resource · Automerge sync protocol writeup — https://… → unfolded
  Relevant to AC4; their tombstone approach avoids our GC problem.
- 2026-10-22 · discovery · SQLite WAL mode breaks on network drives. → unfolded
- 2026-11-01 · folded · rev 2 → 3: AC4 revised; non-goal added (network drives). Reviewed 2 entries.
```

- One entry per line: `- YYYY-MM-DD · <type> · <summary>`, optional indented detail lines underneath.
- Types: `resource`, `discovery`, `inspiration`, `question`, `decision-candidate`, `upstream`, `origin`, `folded`.
- Every new entry except `origin` and `folded` ends with ` → unfolded`. "Unfolded" means "not yet reviewed in a fold-in", not "must change the contract".
- The **only** permitted edit to an existing entry is removing its ` → unfolded` marker when a fold-in reviews it. Never rewrite or delete entries.

### Acceptance criteria numbering

Never renumber acceptance criteria — dependents and log entries refer to them by number. A removed criterion keeps its number:

```markdown
4. *(removed in rev 3 — see Log)*
```

New criteria are appended with the next unused number.

### Inbox

`.curaye/inbox/<id>.md` holds ideas that belong to no spec yet:

```markdown
---
id: plugin-api
title: Plugin API
created: 2026-11-01
source: session          # session | capture | ship
related: [sync]          # optional
follows: export          # optional, when it extends shipped work
---

<2–6 lines: the idea, why it came up, any links.>
```

A seed graduates to `planned/` when it has a Problem and a Goal. On graduation, delete the inbox file and record `origin` in the new spec's log.

## Step 1 — Load the project

Find the nearest `.curaye/` folder walking upward from the current directory. If none exists, stop: "No .curaye/ folder found. Run `/curaye-bootstrap` or `/curaye-import` first."

Read:
- `.curaye/prd.md` — the north star, for judging whether new ideas fit
- Every file in `.curaye/planned/` in full
- Every file in `.curaye/inbox/` (if the folder exists)
- Titles and status of every file in `.curaye/decisions/`
- Ids and titles of every file in `.curaye/shipped/`
- Titles of every file in `.curaye/current/`

Build a working index of planned specs: id, file, status, revision (default 1), `requires` (with the legacy fallback), `pins`, stale and untracked edges, and count of unfolded log entries. Compute each spec's dependents by reverse-scanning `requires`.

## Step 2 — Gather material

**Session mode:** extract from this conversation every item of these kinds:
- **Feature ideas** — "it should also…", "what if we…", new capabilities
- **Discoveries** — constraints, bugs in the plan, things that turned out harder or different
- **Resources** — links, articles, libraries, prior art (keep URLs exact)
- **Inspirations** — "like X does it", reference UX or patterns
- **Decisions** — choices settled in the session, with the reason given
- **Scope cuts** — "not doing X", "leave Y for later"
- **Open questions** — anything raised and left unanswered

Also collect unfolded log entries from any spec the session clearly touched — a fold-in should absorb notes captured earlier, not only today's.

**Grooming mode:** the material is the target spec's unfolded log entries, plus anything in this session about that spec. If the spec does not exist, stop and list valid ids.

If there is no material at all, say so and ask: "What would you like to work on — a new idea, or a specific spec?"

## Step 3 — Route each item

Assign every item exactly one route:

| Route | When |
|---|---|
| **NEW SPEC** | A capability with a clear problem and goal that no planned spec covers. Also an inbox seed that has matured. |
| **AMEND** | The item changes an existing spec's Problem, Goal, Non-goals, feature sections, or acceptance criteria. |
| **LOG** | Useful context that does not change a contract: resources, inspirations, most open questions, discoveries without a clear contract consequence. |
| **DECISION** | A settled choice with a rationale that outlives any one spec → `decisions/<id>.md`. |
| **INBOX** | An idea too early to spec, or that fits no existing spec. |
| **FOLLOW-UP** | A change to something already shipped, or to a spec with `status: done`. Shipped specs are history and are never edited; create a new spec (or inbox seed if immature) with `follows: <id>`. |

Matching rules:
- Match by meaning, using titles, goals, tags, and acceptance criteria — not just keywords.
- An item that affects two specs gets routed to the spec that owns the behaviour, with a LOG entry on the other pointing to it.
- If an item could reasonably go to two places and the choice matters, ask; do not guess silently.
- Check new ideas against `prd.md`. If one contradicts "What it is not", route it to INBOX and flag the conflict in the plan.
- For NEW SPEC, look for existing specs it should `require`, and specs that should now require it.

## Step 4 — Impact pass

Run this for every AMEND and every NEW SPEC before presenting the plan.

### 4a. Classify each contract change

- **Additive** — new acceptance criterion, new feature detail, expanded goal. Rarely breaks dependents.
- **Narrowing** — criterion removed, new non-goal, scope cut. Breaks any dependent that relied on the removed part.
- **Reshaping** — criterion reworded in substance, interface, data shape, or behaviour changed. Needs a real read of each dependent.

Wording-only edits that change no meaning are not contract changes and do not bump `revision`.

### 4b. Assess each dependent (one hop)

For each spec whose `requires` includes the amended spec:

1. If every change is additive, mark it **unaffected**.
2. Otherwise read the dependent in full and decide whether it actually relies on the changed parts. Cite the specific criterion or section on both sides ("its AC3 assumes our AC2 single-blob payload").
3. Classify as **unaffected**, **needs review**, or **breaking**.

Do not recurse to dependents-of-dependents unless a dependent is itself being amended in this run; then run 4b for it too.

### 4c. Upstream check

For the amended or new spec itself:
- Does any new or changed criterion need something its `requires` targets don't provide? If the upstream is planned, propose an AMEND on it or a `question` LOG entry on it. If the upstream is shipped, check `current/` instead.
- Did the session reveal a dependency not yet listed? Propose adding the edge.
- Does a change contradict behaviour described in `current/`? Add a "Migration concern" note to the spec's feature sections so build handles it.

### 4d. Graph integrity

- **Cycles:** refuse any new edge that would create a cycle. Name the specs in the loop and ask how to break it.
- **Dangling edges:** flag any `requires` entry that resolves to nothing, and propose a fix (rename, remove, or point at the right spec).
- **Splits and merges:** when one spec is split, rewrite each dependent's edge to the part it actually relies on (judged from the dependent's body). When specs merge, collapse edges onto the merged id and re-pin.

## Step 5 — Present the plan

Show the whole plan in one block before writing anything:

```
curaye-spec plan — <project name>

  NEW SPEC   08-conflict-panel   draft · effort s
               from: session (Obsidian idea) + inbox/conflict-ui
               requires: sync  (pinned @4)

  AMEND      03-sync             rev 3 → 4
               + AC9  chunked payloads over 1 MB          (additive)
               − AC4  network-drive support → non-goal     (narrowing)
               ~ AC2  payload shape now chunked            (reshaping)
               log: 2 resources folded, 1 discovery folded
               key: dependencies → requires

    Dependents of sync:
      export      [ready]     relies on AC2 payload shape   NEEDS REVIEW
      conflict    [draft]     relies on AC5 only            unaffected → pin @4
      mobile      [building]  relies on AC4                 ⚠ BREAKING (mid-build)
      offline     [shelved]   —                             skipped (pin left @3)

  LOG        04-storage          1 question
  DECISION   why-crdt-over-ot
  INBOX      plugin-api          too early to spec
  FOLLOW-UP  —

  Flags:
    ⚠ mobile is being built and depends on AC4, which this plan removes.

Proceed? [y / edit / amend dependents now]
```

- `edit` — the user adjusts routes or content; re-present the plan.
- `amend dependents now` — add AMEND routes for every NEEDS REVIEW / BREAKING dependent that is `draft` or `ready`, run Step 4 for them, re-present.

**Status guards** (apply while planning, restate as flags):
- `draft` / `ready` — amend freely.
- `building` — never amend the contract without explicit confirmation. Default to LOG entries. If the user insists, say plainly that this moves the goalposts of an in-progress build.
- `done` — route to FOLLOW-UP, not AMEND.
- `shelved` — LOG only, flagged. If the session clearly revives it, offer: "Unshelve <id> and amend it?" On yes, set `status: draft` and route as AMEND.
- Shipped — FOLLOW-UP only.

For any BREAKING dependent with `status: building`, ask the user to choose before writing:
```
mobile is mid-build and relies on AC4, which this change removes.
  1. Hold this change — log it on sync, amend later
  2. Apply it — I'll log an upstream note on mobile; you replan the build
  3. Keep AC4 — record a decision explaining why it stays
```

Wait for confirmation. Do not write anything until the user says `y`.

## Step 6 — Write

Apply in this order so dependency pins are always written against final revisions.

### 6a. Decisions and inbox seeds

- **DECISION** → `decisions/<id>.md` using the project's existing decision format (Context, Decision, Consequences; `status: active`, `date: <today>`).
- **INBOX** → `inbox/<id>.md` in the inbox format above. Create the folder if needed.

### 6b. New specs

File: `planned/<NN>-<id>.md`, where `NN` is one more than the highest numeric prefix in `planned/` (zero-padded to two digits).

```markdown
---
id: <id>
title: <title>
status: draft
effort: <xs | s | m | l | xl>
impact: <low | medium | high>     # only if the session made it clear; else omit
desire: <low | medium | high>     # only if the user expressed it; else omit
requires: [<id>, …]
tags: [<tags>]
created: <today>
updated: <today>
revision: 1
pins: {<id>: <its current revision>, …}   # omit if requires is empty
---

## Problem

<What is broken or missing, from the session.>

## Goal

<The outcome, not the solution.>

## Non-goals

- <…>

## <Feature-specific sections as needed>

## Acceptance criteria

1. <…>

## Log

- <today> · origin · <where this came from: session / inbox/<id> / follows <id>>
- <today> · resource · <…> → unfolded
```

Never guess `desire` — it is how much the user wants this, so set it only from their own words. `impact` may be proposed in the plan when the session made it clear; leave it out otherwise.

5–8 acceptance criteria, matching bootstrap's depth. Carry relevant resources and inspirations into the new spec's log. If created from an inbox seed, delete the seed file.

### 6c. Amendments (fold-in)

For each AMEND, show the exact contract diff for that spec and wait for `y` before writing it:

```
03-sync — contract changes (rev 3 → 4)

  Non-goals
  + Syncing databases that live on network drives (WAL locking is unreliable there).

  Acceptance criteria
  ~ 2. Sync payloads are sent as one blob.
  →    Sync payloads over 1 MB are split into ordered chunks and reassembled atomically.
  − 4. Works when the database is on a network drive.
  →    4. *(removed in rev 4 — see Log)*
  + 9. A failed chunk transfer resumes from the last confirmed chunk.

Write? [y / edit / skip]
```

Then write:
1. The contract edits, following the numbering rule.
2. Frontmatter: `revision` +1 (only if the contract changed in meaning), `updated` and `last_folded` = today, legacy `dependencies` moved to `requires`, orphan pins removed. Changes to `effort`, `impact`, `desire`, `tags`, or `release` are metadata, not contract — they never bump `revision` on their own.
3. New LOG entries from this run, each ending ` → unfolded` unless folded in this same step.
4. Remove ` → unfolded` from every entry this fold reviewed — whether it changed the contract or was judged to need no change.
5. Append one `folded` entry summarising the fold: `rev N → N+1: <changes>. Reviewed <k> entries.` If nothing in the contract changed, write `no contract change. Reviewed <k> entries.` and do not bump `revision`.

### 6d. LOG-only routes

Append the entries to the target spec. Do not touch the contract, `revision`, or `last_folded`. Update `updated`.

### 6e. Dependents

For each dependent of every amended spec, using the upstream's **final** revision:

| Assessment | Action |
|---|---|
| **unaffected** | Bump the pin (`pins.sync: 3` → `4`). No log entry. |
| **needs review / breaking**, dependent is `draft` or `ready`, not amended in this run | Leave the pin as is (it is now stale on purpose). Append: `- <today> · upstream · <upstream id> rev <n>: <what changed>. <what here relies on it>. → unfolded` |
| **needs review / breaking**, dependent was amended in this run | Its own fold-in already absorbed the change; bump the pin. |
| **breaking**, dependent is `building` | Per the user's choice in Step 5. If applied: append the `upstream` entry, leave the pin stale, do not touch its contract. |
| dependent is `shelved` | Skip. Leave its pin as is. |

For new edges added in this run, add the id to `requires` and pin it at the upstream's current revision in `pins`.

## Step 7 — Verify

Re-read every file written. Check:
- Frontmatter parses as YAML and satisfies the protocol schema: `title`, `status`, `effort`, `created`, `updated` present; enum values valid; dates `YYYY-MM-DD`.
- No file has both `requires` and `dependencies`; no `requires` entry contains anything but a plain id.
- Every `pins` key is in `requires`.
- No acceptance criterion was renumbered.
- Every `→ unfolded` marker removed corresponds to an entry this fold reviewed.
- No cycles; no new dangling edges.
- Every pin written in this run matches the upstream's `revision` on disk.
- Every inbox seed graduated in this run has been deleted.

Fix anything that fails before reporting.

## Step 8 — Commit (offer)

Ask: "Commit these .curaye/ changes? [y/n]". If yes:

```bash
git add .curaye/
git commit -m "$(cat <<'HEREDOC'
docs(spec): <short summary, e.g. "amend sync rev 4, add conflict-panel">

<One line per route applied: NEW SPEC conflict-panel; AMEND sync rev 3→4; …>
HEREDOC
)"
```

Do not commit without the user's yes.

## Step 9 — Report

```
curaye-spec complete.

  New specs:     <ids or "none">
  Amended:       <id rev a→b, …>
  Logged:        <N entries across <M> specs>
  Decisions:     <ids or "none">
  Inbox:         <N seeds added, <K> graduated>
  Dependents:    <N re-pinned, <K> flagged for review: ids>
  Commit:        <hash or "not committed">
```

If dependents were flagged, close with: "Run `/curaye-spec <id>` on each flagged spec to review its upstream changes."
