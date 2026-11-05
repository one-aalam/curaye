---
id: single-spec-template
title: "One Planned-Spec Template"
shipped: 2026-11-05
release: ""
spec_ref: "single-spec-template"
---

# One Planned-Spec Template

> Shipped on 2026-11-05.

## What shipped

`renderPlannedSpec(opts: RenderPlannedSpecOptions): string` was added to `@curaye/protocol` (`packages/protocol/src/template.ts`, exported from `src/index.ts`). It accepts `id`, `title`, `source`, and optional frontmatter fields, and returns a complete `.md` string with frontmatter, section skeleton, `revision: 1`, and a `## Log` section containing a dated `origin` entry naming the source command. All six previous inline planned-spec templates were removed: `curaye new`, `curaye ai draft`, `curaye import`, and both `curaye bootstrap` paths now call `renderPlannedSpec()`; `paletteStore.ts` does the same after `@curaye/protocol` was added as a direct dependency of `@curaye/desktop`. A "Code" rule was added to `.curaye/conventions.md` requiring all future planned-spec creation to go through this function.

## Approach vs landed

Built as approached (rev 1). One risk noted in the approach was resolved: AI prompt callers (`bootstrap.ts` `draftSpecWithAi` and `paletteStore.ts`) strip the `## Log` section from the rendered skeleton before it reaches the model, keeping the origin entry out of the AI prompt.

## Changes to current/

- `current/protocol.md` — added `renderPlannedSpec` to the Functions section.

## Notes

- The `decision-candidate` log entry (AI callers strip `## Log` from the prompt) is unresolved — proposed as inbox seed in Step 5.
