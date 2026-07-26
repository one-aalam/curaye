---
id: ai-palette-redesign-ux
title: AI Command Palette — Redesigned UX
shipped: 2026-07-26
tags: [desktop, ai, ux]
spec_ref: ai-palette-redesign-ux
---

> Shipped on 2026-07-26.

## What shipped

The `InputPhase` of `AIPalette.tsx` was fully redesigned. The flat `SUGGESTIONS` array was replaced with a typed `COMMANDS: CommandEntry[]` array and a `CATEGORIES: Category[]` array driving a 50 px left icon rail with six lifecycle category buttons (All / Plan / Build / Ship / Maintain / Portfolio). A fixed-height (140 px) contextual "For this spec" section sits permanently between the search bar and the command list, toggling between an open-doc view (three instant contextual commands with accent icons) and an inline spec attachment picker (search input + scrollable list). The command list renders grouped sub-sections in All view (Needs input / Quick actions / Across all projects) and a flat filtered list in category views, with type-differentiated icon colours and hover key badges (`↵` / `→`). A dashed freeform footer ("Ask anything about this project…") is always visible below the scroll area. `paletteStore.ts` gained `AttachedSpec`, `attachedSpec: AttachedSpec | null` state, `setAttachedSpec` action, and updated `gatherContext(attachedSpec)` signature. A new `list_documents` Tauri command was added to `commands/mod.rs` and registered in `lib.rs`, scanning `planned/` and `shipped/` to populate the attachment picker.

## Changes to current/

- `current/desktop.md` — updated the `AIPalette` component description to reflect the new three-phase layout (rail + contextual section + command list), the typed data structures (`CommandEntry`, `Category`, `AttachedSpec`), and the new `list_documents` Tauri command; updated `usePaletteStore` description to include `attachedSpec`.

## Notes

Tabler Icons (`@tabler-icons/react`) are not installed in the project. Lucide-react equivalents were substituted (e.g. `List`, `Map`, `Hammer`, `Rocket`, `RefreshCw`, `Globe`). The `AttachedSpec` interface stores `docType: string` rather than `icon: string` as specified; the icon is derived from `docType` at render time, which is functionally identical. Contextual commands with an attached spec route through the existing `resolveAction` param path rather than making `gatherContext` async — this is a simpler approach that satisfies the acceptance criteria without architecture change.
