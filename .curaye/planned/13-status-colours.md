---
id: status-colours
title: One Status-Colour Map in the Desktop
status: draft
effort: s
impact: medium
requires: []
tags: [desktop, ui]
release: ''
created: 2026-11-03
updated: 2026-11-03
revision: 1
---

# One Status-Colour Map in the Desktop

## Problem

The desktop defines spec status colours three times, and they disagree: `apps/desktop/src/components/DocumentTree.tsx:22` (done is `green-500`, draft is `zinc-400`), `BacklogView.tsx:42` (no `done` or `shelved` entries, so both render as draft grey) and `DocumentEditor.tsx:131` (done is `emerald-400`, draft uses theme tokens). The same spec looks different from view to view, and a done or shelved spec looks like a draft in the backlog.

## Goal

A spec's status looks the same everywhere in the desktop, for all five statuses.

## Non-goals

- Redesigning the palette beyond choosing one set of status colours.
- Colours for anything other than planned-spec status.

## Acceptance criteria

1. One module defines the colour classes for `draft`, `ready`, `building`, `done` and `shelved`, including a fallback for unknown values.
2. `DocumentTree.tsx`, `BacklogView.tsx` and `DocumentEditor.tsx` use it; none of them defines its own status-colour map.
3. `done` and `shelved` specs are visually distinct from `draft` in the backlog.
4. Status colours draw on the theme in `styles/glass.css` (existing variables, or new `--status-*` variables added there) rather than raw Tailwind palette classes.
5. `.curaye/conventions.md` gains a UI rule — "Spec status colours come from the shared status map" — with that module as its example.

## Log

- 2026-11-03 · origin · coherence pass audits/2026-11-03.md, finding F3.
