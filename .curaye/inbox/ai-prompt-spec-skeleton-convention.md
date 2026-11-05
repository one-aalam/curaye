---
id: ai-prompt-spec-skeleton-convention
title: AI prompt callers strip ## Log from renderPlannedSpec() output
created: 2026-11-05
source: ship
follows: single-spec-template
---

2026-11-05 · decision-candidate · AI prompt callers strip ## Log from renderPlannedSpec() output — only frontmatter + section skeleton is sent to the model, so the origin entry is not part of the prompt. This is a standing convention currently applied in bootstrap.ts and paletteStore.ts but not formally specified anywhere. Consider whether it belongs in the renderPlannedSpec API (a separate renderPlannedSpecForPrompt() helper or a stripLog option) or in the conventions doc.
