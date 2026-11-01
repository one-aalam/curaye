---
id: revision-pins-separate-map
title: Revision pins live in a separate map, not inside requires
status: active
date: 2026-11-01
tags: [protocol, cli]
---

# Decision: Revision pins live in a separate map, not inside requires

## Context

Spec evolution needs to know whether a dependent spec was reviewed against the current version of the spec it requires. Each planned spec now carries a `revision` that bumps when its contract changes, and each dependent needs to record which revision it last checked.

Three shapes were considered:

- **Inline pins** — `requires: [sync@3]`. One field per edge, but every consumer of `requires` (CLI validation, desktop editor, drift checks) would need to strip the suffix, or would treat `sync@3` as an unknown spec id.
- **Separate map** — `requires: [sync]` plus `pins: {sync: 3}`. `requires` stays plain ids; `pins` rides on the schema's `.passthrough()`.
- **A stored reverse field** (`enables`) for at-a-glance dependents. Two files would describe one edge and drift apart.

## Decision

Store pins in a separate `pins` map beside `requires`. Keep `requires` as the only stored direction of an edge; compute dependents by scanning it. Do not add `enables`.

## Consequences

- No change to `@curaye/protocol`, the CLI, or the desktop app: `requires` keeps its meaning and `pins` is passed through untouched (the desktop serializer preserves nested maps).
- A pin with no matching `requires` entry is harmless; the skills remove it on the next edit. A `requires` entry with no pin is simply untracked.
- Editing `requires` by hand (e.g. in the desktop editor) can leave pins stale or orphaned. The skills tolerate both.
