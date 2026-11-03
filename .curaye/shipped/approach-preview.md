---
id: approach-preview
title: "Approach Preview — See How It Will Be Built Before Building"
shipped: 2026-11-03
release: ""
spec_ref: "approach-preview"
---

# Approach Preview — See How It Will Be Built Before Building

> Shipped on 2026-11-03

## What shipped

A new `/curaye-preview <id>` Claude Code skill (`apps/cli/skills/curaye-preview.md`) previews how a spec will be built before any code is written. It classifies the build as `ui`, `cli`, `library`, `data` or `refactor` (overridable with `--kind` or at a confirmation prompt) and produces the matching preview: wireframes with empty, loading and error states; a sample terminal session with error and `--json` output; exported signatures; before/after layouts; or a module map. Every preview lists files, dependencies, conventions followed, per-criterion verification and risks. On approval it writes an `## Approach` section between the acceptance criteria and the Log, sets `approach_rev`, and logs `approach · approved (rev N)`, without bumping `revision`; HTML mockups go to `.curaye/previews/<id>/`.

`/curaye-build` now offers the preview for effort `m`+ or UI specs without a current approach (approval replaces the summary confirmation; `skip` is logged), follows an approved approach and reports deviations. `/curaye-ship` saves the approach before graduation and writes an "Approach vs landed" section. `/curaye-spec` recognises the `approach` log type and flags approaches made stale by a revision bump. `curaye skill install` registers the skill; `@curaye/cli` and all nine skill headers are at `0.0.3`.

## Changes to current/

- `current/cli.md` — Skill distribution now covers nine skills at v0.0.3 and describes what `curaye-preview` adds.
- `current/protocol-standard.md` — documents `previews/`, the `approach_rev` field, the `## Approach` section and the `approach` log type.

## Notes

- Built before the preview step existed, so this spec has no `## Approach` and no "Approach vs landed" record.
- `/curaye-spec` was also edited (not in the acceptance criteria) so its log rules and plan flags know about approaches.
- `curaye sync --pull` replaces the whole `.curaye/` folder, so a mockup created since the last push is lost on pull, like any unsynced `.curaye/` file.
- Shipped from a cloud session with a temporary registry, so `~/.curaye/projects.yaml` on the developer's machine was not touched.
