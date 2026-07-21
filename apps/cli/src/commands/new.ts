import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import { intro, outro } from '@clack/prompts'
import { ProjectRegistry } from '@curaye/core'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { resolveProject, today } from '../lib/context.js'
import { openInEditor } from '../lib/editor.js'

function titleToId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function registerNew(program: Command): void {
  program
    .command('new <title>')
    .description('Create a new planned spec or decision document')
    .option('--type <type>', 'Document type: planned or decision', 'planned')
    .option('--project <id>', 'Project to create the document in')
    .action(async (title: string, opts: { type: string; project?: string }) => {
      if (!isJsonMode()) intro('curaye new')

      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)
      const docType = opts.type === 'decision' ? 'decisions' : 'planned'

      const id = titleToId(title)
      const filename = `${id}.md`
      const destDir = path.join(curiyePath, docType)
      const destPath = path.join(destDir, filename)

      try {
        await fs.access(destPath)
        die(`Document already exists: ${destPath}`)
      } catch {
        // Good
      }

      await fs.mkdir(destDir, { recursive: true })

      let content: string
      if (docType === 'decisions') {
        content = `---
id: ${id}
title: "${title}"
status: active
date: ${today()}
tags: []
---

# Decision: ${title}

## Context

## Decision

## Consequences

## Alternatives considered
`
      } else {
        content = `---
id: ${id}
title: "${title}"
status: draft
effort: m
impact: medium
desire: medium
requires: []
tags: []
created: ${today()}
updated: ${today()}
---

# ${title}

## Problem

## Goal

## Non-goals

## Acceptance criteria

1.
`
      }

      await fs.writeFile(destPath, content, 'utf8')

      if (isJsonMode()) {
        printJson({ id, path: destPath, type: docType })
      } else {
        printLine(`Created ${destPath}`)
        outro(`Opening in $EDITOR…`)
        openInEditor(destPath)
      }
    })
}
