---
id: approach-preview
title: Approach Preview — See How It Will Be Built Before Building
status: draft
effort: m
impact: high
requires: []
tags: [cli, skills]
release: ''
created: 2026-11-03
updated: 2026-11-03
revision: 1
follows: spec-evolution
related: [coherence-pass]
---

# Approach Preview — See How It Will Be Built Before Building

## Problem

`/curaye-build` pauses once before writing code, and only to summarise *what* it will build, which the spec already says. Nobody sees *how* it will work or what it will look like until it has landed: the screens, the command output, the API shape, the files it touches. When the result surprises, there is no record of what was intended to compare it with.

## Goal

Before a non-trivial build, the developer sees a preview of the approach suited to the kind of build, approves or adjusts it, and the approved approach is stored with the spec. At ship, what was planned is compared with what landed.

## Non-goals

- Rendering real application components in previews. Mockups are illustrative HTML or ASCII.
- Pixel-perfect visual design. That belongs in a design tool.
- Previews for `xs` and `s` specs by default. Build's existing summary covers them.
- Treating the approach as contract. Acceptance criteria stay the definition of done (see `decisions/05-approach-is-not-contract`).
- Running the dependency impact pass when an approach changes. Dependents rely on the contract, not the approach.

## Build kinds and what each preview shows

| Kind | Preview |
|---|---|
| `ui` | A wireframe per screen (ASCII inline, or an HTML mockup in `previews/`), including empty, loading and error states; the interaction flow; existing components reused vs new ones introduced. |
| `cli` | A sample terminal session: commands, flags, normal output, error output, and `--json` shape. |
| `library` | Public signatures, types, error classes, and one example call. |
| `data` | Before/after schema or folder layout, with migration and compatibility notes. |
| `refactor` | Before/after module map: what moves, what is deleted. |

A spec can be more than one kind; the preview covers each. Every preview also lists files expected to be touched, new dependencies, how each acceptance criterion will be verified, and risks.

## Storage

- `## Approach` section in the spec, placed between `## Acceptance criteria` and `## Log`.
- `approach_rev` frontmatter field (extension, via passthrough): the spec `revision` the approach was written against. `approach_rev` < `revision` means the approach is stale.
- `.curaye/previews/<id>/` for HTML mockups. Not scanned; carried by `curaye sync` like the rest of `.curaye/`.

## Acceptance criteria

1. `apps/cli/skills/curaye-preview.md` exists with the `<!-- curaye-skill: vX.Y.Z -->` header, is registered in `curaye skill install` (name list and description), and `.claude/commands/curaye-preview/SKILL.md` matches it minus the header.
2. `/curaye-preview <id>` classifies the build kind from the spec's tags, body and likely files, states the classification, and lets the user override it before generating.
3. Each kind produces the preview defined in "Build kinds", and every preview lists files to touch, new dependencies, per-criterion verification, and risks.
4. On approval, the approach is written as `## Approach` between the acceptance criteria and the Log; `approach_rev` is set to the spec's current `revision`; a log entry `- <date> · approach · approved (rev N)` is appended; `revision` is not bumped.
5. HTML mockups are written to `.curaye/previews/<id>/`; `scanProject()` ignores the folder and `curaye sync` carries it unchanged.
6. `/curaye-build` runs the preview before marking a spec `building` when the spec has effort `m` or larger, or is kind `ui`, and has no approved approach or a stale one; the user can skip it. For `xs` and `s` specs, build keeps its existing summary.
7. `/curaye-ship` adds an "Approach vs landed" section to the shipped document when the spec has an `## Approach`, listing each deviation and why, and linking any `previews/<id>/` files.
8. When `.curaye/conventions.md` exists, the preview reads it and names the conventions and canonical examples it follows; without it, the preview works unchanged.
9. Skill headers and `@curaye/cli` are bumped to the next patch version; the CLI typechecks and builds cleanly.

## Log

- 2026-11-03 · origin · Design session in Claude (3 Nov): kind-aware approach previews, tracked with the spec and compared at ship.
- 2026-11-03 · decision-candidate · Previews are synced: `curaye sync` copies all of `.curaye/`, mockups are small, and the web viewer could show them. → unfolded
