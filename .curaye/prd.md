---
updated: 2026-07-21
---

# Product: Curaye

Curated project knowledge for developers who build more than one thing.

## North star

A solo developer or small team should be able to manage multiple software projects — active, dormant, or newly started — without losing context, repeating decisions, or reinventing patterns. Curaye is the private, local-first layer where that knowledge lives.

## The problem it solves

Most developers work across several projects simultaneously. Context for each project lives in their head, scattered across notes, or is simply lost when a project goes dormant. Returning to something untouched for months means archaeology — reading old code, reconstructing decisions, re-deriving intent. Starting a new project means repeating architecture decisions, rewriting documentation, and rebuilding patterns that already exist elsewhere.

## What Curaye does

- Gives each project a structured `.curaye/` folder: current state, planned work, shipped history, and recorded decisions.
- Maintains a shared layer above projects: patterns, design systems, standing decisions, and agent steering documents that belong to the developer, not to any one codebase.
- Syncs everything to a private GitHub repository for cross-machine continuity.
- Provides AI augmentation through two complementary channels: a CLI for deterministic operations and scriptable AI commands, and Claude Code skills for intelligent, reasoning-heavy workflows (implementing specs, writing current/ updates, brownfield import, drift resolution).

## The two AI channels

**CLI (`curaye ai *`)** — deterministic, scriptable, CI-friendly. Calls an AI provider for generation but treats the output as a file operation. Works in any terminal.

**Claude Code skills (`/curaye-*`)** — context-aware, conversational, intelligent. The skills call the CLI for mechanical operations and use LLM reasoning for what the CLI cannot do: understanding what changed, writing meaningful `current/` updates, conducting interviews, interpreting drift findings. Installed once via `curaye skill install`, available in every Claude Code session.

## What it is not

Not a task manager. Not a second brain. Not a team collaboration tool. Curaye is a knowledge curation tool with a defined scope: the specs, decisions, and patterns behind how you build software.

## Target user

A developer — typically solo or in a small team — who maintains more than one software project and values privacy, local ownership, and calm tooling.
