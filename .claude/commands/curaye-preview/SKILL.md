---
name: curaye-preview
description: Preview how a Curaye spec will be built before building it — screens and states for UI work, a sample terminal session for CLI work, signatures for libraries, before/after layouts for data and refactors — then store the approved approach with the spec so it can be compared with what lands. Use before /curaye-build on any non-trivial spec; /curaye-build also runs it automatically for effort m and up or UI work. Pass a spec id.
compatibility: Designed for Claude Code. Requires a Curaye-managed project with a .curaye/planned/ folder.
metadata:
  version: "0.1"
---

Show the developer what they will find when a spec lands, before any code is written, and keep the approved approach with the spec.

Spec (optional): $ARGUMENTS

The argument is a spec id, optionally followed by `--kind <kinds>` to set the build kind up front (e.g. `sync --kind cli,library`).

## What an approach is

The approach describes **how** a spec will be built and what it will look like. It is not part of the contract (see `decisions/approach-is-not-contract` in Curaye-managed projects that record it):

- Revising it never bumps `revision` and never triggers the dependency impact pass.
- The acceptance criteria remain the definition of done.
- Anything a dependent spec relies on, such as an interface shape, belongs in the contract; if the preview reveals one, say so and suggest `/curaye-spec <id>`.

It is stored in three places:
- An `## Approach` section in the spec, between `## Acceptance criteria` and `## Log`.
- `approach_rev` in the frontmatter: the spec `revision` the approach was written against (missing `revision` counts as 1). `approach_rev` lower than `revision` means the approach is **stale**. An `## Approach` section with no `approach_rev` also counts as stale.
- HTML mockups, when used, in `.curaye/previews/<id>/`. Curaye does not scan this folder; `curaye sync` carries it with the rest of `.curaye/`.

## Step 1 — Find the spec

Find the nearest `.curaye/` folder walking upward. If none exists, stop: "No .curaye/ folder found."

**If an id was given:** find it in `.curaye/planned/` by frontmatter `id` first, then by filename without its numeric prefix.

**If no id was given:** list planned specs with status `draft`, `ready` or `building`, with their approach state, and ask which one:

```
  [ready]    10-approach-preview   effort m   approach: none
  [building] 07-sync               effort l   approach: stale (rev 2, spec now rev 3)
  [draft]    11-coherence-pass     effort l   approach: approved (rev 1)
```

Status checks:
- `shelved` — stop: "<id> is shelved. Unshelve it before previewing."
- `done` — stop: "<id> is already built. Run /curaye-ship <id>."
- Not found in `planned/` but present in `shipped/` — stop: "<id> has shipped. A change to it needs a follow-up spec (/curaye-spec)."

**Existing approach:**
- **Approved and current** — show it and ask: "This spec already has an approved approach (rev N). Revise it? [y / n]". On `n`, stop (or hand back to build).
- **Stale** — read the Log entries added since the approach was approved (especially `folded` entries) to see what changed in the contract, and say so in one or two lines. The new preview starts from the old approach and changes only what the contract change requires.

## Step 2 — Read what the preview must fit

Read in full:
- The spec
- `CLAUDE.md` at the project root, if present — code conventions and boundaries
- `.curaye/conventions.md`, if present — project conventions, each with a canonical example
- `.curaye/stack.md`
- The `current/` documents for the domains the spec touches (use its `tags`)

Then read the code the spec will touch or sit beside. The preview must be grounded in what exists: real file paths, real component and command names, the project's existing output and error patterns. Read entry points and the nearest similar feature — not the whole codebase.

## Step 3 — Classify the build kind

A spec can be more than one kind; the preview covers each.

| Kind | Signals |
|---|---|
| `ui` | Tags such as `ui`, `desktop`, `web`; the spec describes screens, views, panels, modals, or interactions; likely files are components, pages or styles |
| `cli` | Tag `cli`; the spec describes commands, flags, terminal output or prompts |
| `library` | Tags naming a package (`core`, `protocol`, …); the spec describes exported functions, types or classes |
| `data` | The spec changes a schema, file format, folder layout, frontmatter, storage, or needs a migration |
| `refactor` | The spec changes structure without changing observable behaviour: consolidation, moves, extraction |

If `--kind` was passed, use it. Otherwise state the classification with its reason and let the user change it before generating:

```
Kind: cli + library — tagged cli; the spec adds exported functions to @curaye/core.
Generate the preview for these kinds? [y / <kinds>]
```

Wait for the answer.

## Step 4 — Generate the preview

Present the preview in one block. Use the section for each kind that applies, then the common sections.

### `ui`

- **Each screen or view** as a wireframe: an ASCII sketch inline for one or two simple screens; otherwise an HTML mockup (see "Mockups" below).
- **States** for each screen: populated, empty, loading, error — plus any others the spec implies (disabled, permission denied, offline).
- **Interaction flow**: what the user does, step by step, and what responds.
- **Components**: which existing components are reused (with paths) and which are new, and why a new one is needed.

### `cli`

A sample terminal session, written as it will actually print:
- Each new or changed command with its flags
- Normal output
- At least one error case and its message
- The `--json` output shape, if the project supports `--json`
- Any interactive prompts

### `library`

- Public signatures with types, exactly as they will be exported
- New error classes and when each is thrown
- One short example call

### `data`

- Before and after: schema, file format, frontmatter, or folder layout
- How existing data is migrated or stays compatible
- What older readers do when they meet the new shape

### `refactor`

- A before/after module map: what moves where, what is extracted, what is deleted
- Call sites that change
- How unchanged behaviour will be confirmed

### Common sections — every preview

- **Files** — expected to be created (`+`), changed (`~`) or deleted (`−`), one line each with its purpose.
- **Dependencies** — new runtime or dev dependencies with a reason each, or "none".
- **Conventions followed** — the CLAUDE.md or `conventions.md` rules this build relies on, with canonical examples where `conventions.md` gives them. Omit if neither file exists.
- **Verifying each criterion** — every acceptance criterion by number (skip removed ones), with how it will be checked: a test, a command to run, a screen to look at.
- **Risks and open choices** — anything that could go differently than shown, and choices the developer may want to make now.

### Mockups

Use an HTML mockup when a UI preview has more than two screens, or a layout ASCII can't convey:
- One self-contained file per screen, or one `index.html` with every screen and state laid out side by side and labelled. No external assets, scripts or fonts.
- Wireframe styling: greys, simple boxes, real labels and realistic sample content. It shows structure and states, not final visual design.
- Write it to `.curaye/previews/<id>/` now, so the developer can open it while reviewing, and give the path.

### Presenting

```
─────────────────────────────────────────────────────
APPROACH PREVIEW  <id> — <title>  (rev N)
Kind: <kinds>
─────────────────────────────────────────────────────

<kind sections>

FILES
  + …
  ~ …
DEPENDENCIES
  …
CONVENTIONS FOLLOWED
  …
VERIFYING EACH CRITERION
  1. … → …
RISKS AND OPEN CHOICES
  - …
─────────────────────────────────────────────────────

Approve this approach? [y / adjust / discard]
```

- `adjust` — take the developer's changes, revise, and present again.
- `discard` — write nothing to the spec. If mockups were written in this run, ask whether to keep or delete them.

## Step 5 — Store the approved approach

On `y`, edit the spec:

1. **`## Approach` section.** Place it after `## Acceptance criteria` and before `## Log`; if the spec has no Log, place it at the end. If an `## Approach` section already exists, replace it. Its content is the approved preview, condensed:

   ```markdown
   ## Approach

   > Approved <today> against rev <N>. Kind: <kinds>.

   ### <Kind-specific heading, e.g. "Terminal session" or "Screens">

   <the wireframes, session, signatures, before/after or module map — inline;
   link HTML mockups as `.curaye/previews/<id>/<file>.html`>

   ### Files

   <the files list>

   ### Verifying each criterion

   <the per-criterion list>

   ### Risks and open choices

   <as approved, with any choices the developer made noted>
   ```

   Include a `### Dependencies` or `### Conventions followed` subsection only when it has content.

2. **Frontmatter:** set `approach_rev` to the spec's current `revision` (1 if missing) and `updated` to today. Do not change `revision`, `last_folded`, `status`, `requires`, `pins`, or any contract section.

3. **Log:** append `- <today> · approach · approved (rev N)` — or `revised (rev N): <what changed>` when replacing an earlier approach. Approach entries do not take the ` → unfolded` marker.

Re-read the file and check that the frontmatter still parses, the contract sections are unchanged, and the Log is still the last section.

## Step 6 — Hand back

If `/curaye-build` started this preview, return to it with the result (approved, or discarded) and continue there.

Otherwise report:

```
Approach approved for <id> (rev N).
  Kind:      <kinds>
  Mockups:   .curaye/previews/<id>/… (or "none")
```

"Run `/curaye-build <id>` to build it. The approach will be checked against what lands when you run `/curaye-ship <id>`."
