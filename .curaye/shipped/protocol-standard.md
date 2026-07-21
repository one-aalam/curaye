---
id: protocol-standard
title: "Curaye Protocol Standard"
shipped: 2026-07-21
release: ""
spec_ref: "protocol-standard"
---

# Curaye Protocol Standard

> Shipped on 2026-07-21

## What shipped

The Curaye Protocol Standard (version 1) is the canonical specification governing every `.curaye/` folder. It defines the required folder layout (`prd.md`, `stack.md`, `current/`, `planned/`, `shipped/`, and optional `decisions/`), file naming rules (kebab-case, optional numeric prefix, `_` prefix for drafts), complete YAML frontmatter schemas for all five document types (root, planned, current, shipped, decisions), required and optional body section conventions per type, and the full set of scanning and validation rules (non-destructive, severity-classified: error/warning/info). It also introduces `protocol.yaml` for version declaration, with parsers defaulting to version 1 when absent.

## Changes to current/

- `current/protocol-standard.md` (created): documents the protocol standard — folder layout, file naming, frontmatter schemas, body conventions, parsing rules, and validation severity model.

## Notes

This spec is a definition document rather than an implementation. Its acceptance criteria describe parser behaviour; `@curaye/protocol` (spec `package-protocol`) is the TypeScript implementation of these rules.
