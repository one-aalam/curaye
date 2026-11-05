---
id: status-colours
title: "One Status-Colour Map in the Desktop"
shipped: 2026-11-05
release: ""
spec_ref: "status-colours"
---

# One Status-Colour Map in the Desktop

> Shipped on 2026-11-05

## What shipped

A single module `apps/desktop/src/lib/statusColors.ts` now defines all spec-status colour classes, exporting `statusBadgeClass(status)` (text + background) and `statusChipClass(status)` (text + background + border) with a fallback for unknown values. Fifteen CSS custom properties (`--status-{draft,ready,building,done,shelved}-{color,surface,border}`) were added to the `:root` block of `apps/desktop/src/styles/glass.css`; all three colour maps previously scattered across `DocumentTree.tsx`, `BacklogView.tsx`, and `DocumentEditor.tsx` were removed and replaced with calls to these helpers. `done` and `shelved` now render correctly in the backlog (they had been missing from `BacklogView`'s old map, falling back to grey).

## Changes to current/

- `current/desktop.md` — updated to describe the status-colour module and the `--status-*` CSS variables as part of the desktop's shared utilities.

## Notes

No approach was previewed (effort `s`). `BacklogView` previously only cycled through `draft → ready → building`; the chip colours for `done` and `shelved` now exist but those statuses are not reachable via the click-to-advance cycle — this is intentional per the spec's non-goals (no behaviour redesign, only colour consistency).
