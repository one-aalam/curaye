import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import { intro, outro, text, confirm, isCancel, spinner } from '@clack/prompts'
import { ProjectRegistry, scanProject } from '@curaye/core'
import { loadProviderConfig } from '@curaye/ai'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { resolveProject, today } from '../lib/context.js'
import { openInEditor } from '../lib/editor.js'

export function registerAi(program: Command): void {
  const aiCmd = program.command('ai').description('AI-assisted commands (require a configured provider)')

  aiCmd
    .command('status')
    .description('Report which AI provider is configured and whether it is reachable')
    .action(async () => {
      const config = await loadProviderConfig()
      if (!config) {
        if (isJsonMode()) {
          printJson({ configured: false })
        } else {
          printLine('No AI provider configured.')
          printLine('Create ~/.curaye/ai.yaml with provider, model, and api_key fields.')
        }
        return
      }

      if (isJsonMode()) {
        printJson({ configured: true, provider: config.provider, model: config.model ?? null })
      } else {
        printLine(`Provider: ${config.provider}`)
        printLine(`Model:    ${config.model ?? '(default)'}`)
        printLine('Status:   configured (connectivity not verified in this release)')
      }
    })

  aiCmd
    .command('draft <title>')
    .description('Draft a new planned spec from a title (requires AI provider)')
    .option('--project <id>', 'Project id')
    .action(async (title: string, opts: { project?: string }) => {
      if (!isJsonMode()) intro('curaye ai draft')

      const config = await loadProviderConfig()
      if (!config) die('No AI provider configured. Run `curaye ai status` to check.')

      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)

      let description = ''
      if (!isJsonMode()) {
        const descResult = await text({
          message: 'Optional description (press Enter to skip)',
          placeholder: '',
        })
        if (!isCancel(descResult)) {
          description = descResult as string
        }
      }

      const s = spinner()
      if (!isJsonMode()) s.start('Drafting spec…')

      // Minimal spec skeleton conforming to protocol standard
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')

      const skeleton = `---
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

${description ? `> ${description}\n` : ''}
## Problem

${description || 'Describe the problem this spec addresses.'}

## Goal

Describe the outcome in 1–3 sentences.

## Non-goals

-

## Acceptance criteria

1.
`

      if (!isJsonMode()) s.stop('Draft ready')

      printLine('')
      printLine(skeleton)

      if (!isJsonMode()) {
        const save = await confirm({ message: 'Save to planned/?' })
        if (!isCancel(save) && save) {
          const destDir = path.join(curiyePath, 'planned')
          const destPath = path.join(destDir, `${id}.md`)
          await fs.mkdir(destDir, { recursive: true })
          await fs.writeFile(destPath, skeleton, 'utf8')
          printLine(`Saved to ${destPath}`)
          outro('Opening in $EDITOR…')
          openInEditor(destPath)
        } else {
          outro('Not saved.')
        }
      } else {
        printJson({ id, title, skeleton })
      }
    })

  aiCmd
    .command('brief')
    .description('Generate a re-entry brief for the current or specified project')
    .option('--project <id>', 'Project id')
    .action(async (opts: { project?: string }) => {
      if (!isJsonMode()) intro('curaye ai brief')

      const config = await loadProviderConfig()
      if (!config) die('No AI provider configured. Run `curaye ai status` to check.')

      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)
      const index = await scanProject(curiyePath)

      const plannedSummary = index.planned
        .map((s) => `- [${(s.frontmatter as { status?: string }).status ?? 'draft'}] ${s.id}: ${(s.frontmatter as { title?: string }).title ?? ''}`)
        .join('\n')

      const brief = `# Re-entry Brief — ${project.name}

Generated: ${today()}

## Project

${project.name} (${project.id}) at ${project.path}

## Planned specs (${index.planned.length})

${plannedSummary || 'None.'}

## Current documents (${index.current.length})

${index.current.map((d) => `- ${d.id}`).join('\n') || 'None.'}

## Decisions (${index.decisions.length})

${index.decisions.map((d) => `- ${d.id}: ${(d.frontmatter as { title?: string }).title ?? ''}`).join('\n') || 'None.'}

---

> AI-generated summaries require a provider. This release produces a structured index only.
> Configure a provider in ~/.curaye/ai.yaml for AI-enhanced briefs.
`

      if (isJsonMode()) {
        printJson({ projectId: project.id, brief })
      } else {
        printLine(brief)
        outro('Brief complete.')
      }
    })

  aiCmd
    .command('update-current <spec-id>')
    .description('Generate an update proposal for a current/ document based on a shipped spec')
    .option('--project <id>', 'Project id')
    .action(async (specId: string, opts: { project?: string }) => {
      if (!isJsonMode()) intro('curaye ai update-current')

      const config = await loadProviderConfig()
      if (!config) die('No AI provider configured. Run `curaye ai status` to check.')

      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)
      const index = await scanProject(curiyePath)

      const shipped = index.shipped.find((s) => s.id === specId)
      if (!shipped) die(`Shipped spec '${specId}' not found in project '${project.id}'`)

      const currentDir = path.join(curiyePath, 'current')
      const currentFiles = await fs.readdir(currentDir).catch(() => [] as string[])

      if (currentFiles.length === 0) {
        die('No current/ documents found. Create one manually first.')
      }

      printLine('current/ documents:')
      for (const f of currentFiles) printLine(`  ${f}`)

      if (!isJsonMode()) {
        const target = await text({ message: 'Which current/ file to update?', placeholder: currentFiles[0] ?? '' })
        if (isCancel(target)) die('Aborted.')
        const targetPath = path.join(currentDir, target as string)
        outro('Opening in $EDITOR…')
        openInEditor(targetPath)
      }
    })
}
