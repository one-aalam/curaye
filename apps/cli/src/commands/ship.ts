import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import { confirm, isCancel } from '@clack/prompts'
import { scanProject, readDocument, ProjectRegistry } from '@curaye/core'
import type { PlannedFrontmatter } from '@curaye/protocol'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { resolveProject, today } from '../lib/context.js'
import { openInEditor } from '../lib/editor.js'

export function registerShip(program: Command): void {
  program
    .command('ship <spec-id>')
    .description('Mark a planned spec as shipped and move it to shipped/')
    .option('--project <id>', 'Project id')
    .option('--release <release>', 'Release tag (e.g. v0.2.0)')
    .action(async (specId: string, opts: { project?: string; release?: string }) => {
      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)
      const index = await scanProject(curiyePath)

      const spec = index.planned.find((s) => s.id === specId)
      if (!spec) die(`Spec '${specId}' not found in project '${project.id}'`)
      if (!spec.path) die(`Cannot determine file path for spec '${specId}'`)

      const doc = await readDocument(spec.path, 'planned')
      const plannedFm = doc.frontmatter as PlannedFrontmatter

      const shippedFilename = `${specId}.md`
      const shippedDir = path.join(curiyePath, 'shipped')
      const shippedPath = path.join(shippedDir, shippedFilename)

      await fs.mkdir(shippedDir, { recursive: true })

      const release = opts.release ?? ''
      const shippedContent = `---
id: ${specId}
title: "${plannedFm.title}"
shipped: ${today()}
release: "${release}"
spec_ref: "${specId}"
---

# ${plannedFm.title}

> Shipped${release ? ` in ${release}` : ''} on ${today()}

## What shipped

## Changes to current/

## Notes
`

      const tmp = shippedPath + '.tmp'
      await fs.writeFile(tmp, shippedContent, 'utf8')
      await fs.rename(tmp, shippedPath)

      // Remove the planned spec
      await fs.unlink(spec.path)

      if (isJsonMode()) {
        printJson({ id: specId, shipped: today(), release, shippedPath })
        return
      }

      printLine(`Shipped '${specId}' → ${shippedPath}`)

      const updateCurrent = await confirm({ message: 'Update current/ now?' })
      if (!isCancel(updateCurrent) && updateCurrent) {
        const currentDir = path.join(curiyePath, 'current')
        const currentFiles = await fs.readdir(currentDir).catch(() => [] as string[])
        if (currentFiles.length === 0) {
          printLine('No current/ documents found. Create one manually.')
        } else if (currentFiles.length === 1 && currentFiles[0]) {
          openInEditor(path.join(currentDir, currentFiles[0]))
        } else {
          printLine('current/ documents:')
          for (const f of currentFiles) printLine(`  ${f}`)
          printLine('Open the relevant file manually.')
        }
      }
    })
}
