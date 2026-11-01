---
name: curaye-capture
description: Quickly capture a link, discovery, inspiration, or open question into a Curaye project — appended to the right planned spec's Log, or saved as an inbox seed when it belongs to no spec yet. Never changes a spec's contract. Use mid-session the moment something relevant comes up. Pass the thing to capture as an argument, or omit to capture what was just discussed.
compatibility: Designed for Claude Code. Requires a Curaye-managed project with a .curaye/ folder.
metadata:
  version: "0.1"
---

Jot something down in the right place, with one confirmation. This skill is the low-friction half of spec evolution; `/curaye-spec` is the deliberate half that folds captured notes into the contract later.

What to capture (optional): $ARGUMENTS

**Speed is the point.** One read pass, one confirmation line, one write. If you find yourself asking more than one question, route to the inbox instead and let `/curaye-spec` sort it out.

## Rules

- **Never touch the contract.** Do not edit Problem, Goal, Non-goals, feature sections, or acceptance criteria. Do not change `revision`, `last_folded`, `status`, `requires`, or `pins`.
- **Append only.** Add entries to the end of a spec's `## Log` section. Never edit or remove existing entries.
- Capture into a spec of any status, including `building`; a log entry never moves goalposts.
- Never write to `shipped/`. Anything about shipped work becomes an inbox seed with `follows: <id>`.

## Step 1 — Identify what to capture

- If an argument was given, that is the item.
- Otherwise, take the most recent thing in this conversation worth keeping: a URL shared, a constraint discovered, an idea floated, a question left open. If several were raised since the last capture, capture all of them (one confirmation for the batch).
- If nothing is identifiable, ask once: "What should I capture?"

Classify each item:

| Type | Examples |
|---|---|
| `resource` | A link, library, article, repo, prior art |
| `discovery` | A constraint, a gotcha, something harder or different than planned |
| `inspiration` | "Like how X does it", a reference UX or pattern |
| `question` | An open question about scope or behaviour |
| `decision-candidate` | A choice that seems settled but hasn't been recorded |

Keep URLs exact. Write the summary in your own words, one line; add at most two indented detail lines (why it matters, which criterion it touches).

## Step 2 — Find where it goes

Find the nearest `.curaye/` folder walking upward. If none exists, stop: "No .curaye/ folder found."

Read only what is needed to match:
- Frontmatter (`id`, `title`, `status`, `tags`) and the Goal section of each file in `.curaye/planned/`
- Frontmatter of each file in `.curaye/inbox/` (if it exists)
- Ids and titles in `.curaye/shipped/`

Match by meaning. Outcomes:
- **One clear planned spec** → its Log. If that spec is `shelved`, still log it there, and add "(shelved)" after its id in the confirmation line so the user can redirect.
- **Matches an existing inbox seed** → append to that seed's body as a dated line.
- **About shipped work** → new inbox seed with `follows: <shipped id>`.
- **No match, or genuinely ambiguous** → new inbox seed.

## Step 3 — Confirm in one line

Single item:
```
Capture as discovery on sync (03-sync)?  [y / <other spec id> / inbox]
  "SQLite WAL mode breaks on network drives"
```

Batch:
```
Capture 3 items?  [y / edit]
  resource     → sync         Automerge sync protocol writeup
  inspiration  → inbox (new)  Obsidian-style unresolved-links panel for conflicts
  question     → storage      Do settings sync, or only content?
```

On `edit`, take the user's corrections and write without asking again.

## Step 4 — Write

**To a spec's Log** — append at the end of the file. If the spec has no `## Log` section, add it as the last section.

```markdown
- <today> · <type> · <summary> → unfolded
  <optional detail line>
```

Update the spec's `updated` frontmatter to today. Change nothing else.

**New inbox seed** — `.curaye/inbox/<kebab-id>.md` (create the folder if needed):

```markdown
---
id: <kebab-id>
title: <short title>
created: <today>
source: capture
follows: <shipped id>      # only for shipped work
---

<today> · <type> · <summary>
<optional detail line>
```

**Existing inbox seed** — append `<today> · <type> · <summary>` as a new line at the end of its body.

## Step 5 — Report

One line per item, nothing more:

```
Captured: discovery → sync · inspiration → inbox/unresolved-links-panel
```

If any spec now has five or more unfolded entries, add one line: "sync has 6 unfolded notes — run `/curaye-spec sync` when you want to fold them in."
