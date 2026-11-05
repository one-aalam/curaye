export interface RenderPlannedSpecOptions {
  id: string
  title: string
  /** Name of the originating command, e.g. 'curaye new', 'curaye ai draft' */
  source: string
  today?: string
  effort?: 'xs' | 's' | 'm' | 'l' | 'xl'
  impact?: 'low' | 'medium' | 'high'
  desire?: 'low' | 'medium' | 'high'
  requires?: string[]
  tags?: string[]
  confidence?: string
  release?: string
}

function isoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function renderPlannedSpec(opts: RenderPlannedSpecOptions): string {
  const date = opts.today ?? isoDate()
  const effort = opts.effort ?? 'm'
  const impact = opts.impact ?? 'medium'
  const desire = opts.desire ?? 'medium'
  const requires = opts.requires ?? []
  const tags = opts.tags ?? []
  const release = opts.release ?? ''

  const requiresYaml = `[${requires.join(', ')}]`
  const tagsYaml = `[${tags.join(', ')}]`

  const extraFields = opts.confidence != null ? `confidence: ${opts.confidence}\n` : ''

  return `---
id: ${opts.id}
title: "${opts.title}"
status: draft
effort: ${effort}
impact: ${impact}
desire: ${desire}
requires: ${requiresYaml}
tags: ${tagsYaml}
release: '${release}'
revision: 1
${extraFields}created: ${date}
updated: ${date}
---

# ${opts.title}

## Problem

## Goal

## Non-goals

## Acceptance criteria

1.

## Log

- ${date} · origin · created by ${opts.source}
`
}
