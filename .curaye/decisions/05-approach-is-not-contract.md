---
id: approach-is-not-contract
title: A spec's approach is not part of its contract
status: active
date: 2026-11-03
tags: [protocol, skills]
---

# Decision: A spec's approach is not part of its contract

## Context

`approach-preview` adds an `## Approach` section to planned specs: how the feature will be built and what it will look like, approved before building. Spec evolution already distinguishes the contract (Problem, Goal, Non-goals, feature sections, Acceptance criteria), which bumps `revision` when it changes and triggers an impact pass on dependents, from the Log, which is append-only raw material. The approach needed a place in that model.

## Decision

The approach is neither contract nor log. Revising it does not bump `revision` and does not trigger the dependency impact pass. Acceptance criteria remain the definition of done. The approach records the spec revision it was written against in `approach_rev`, so a later contract change marks it stale.

## Consequences

- Approaches can be revised freely during a build without moving the goalposts for dependents.
- Anything a dependent spec relies on, such as an interface shape, must be stated in the contract, not only in the approach.
- At ship, "Approach vs landed" compares against the approved approach, not the acceptance criteria.
