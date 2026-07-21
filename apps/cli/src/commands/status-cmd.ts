import type { Command } from 'commander'
import path from 'path'
import { scanProject, readDocument, writeDocument, ProjectRegistry } from '@curaye/core'
import type { PlannedFrontmatter } from '@curaye/protocol'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { resolveProject, today } from '../lib/context.js'

const VALID_STATUSES = ['draft', 'ready', 'building', 'done', 'shelved'] as const

export function registerStatusCmd(program: Command): void {
  program
    .command('status <spec-id> <new-status>')
    .description('Update the status field of a planned spec')
    .option('--project <id>', 'Project id')
    .action(async (specId: string, newStatus: string, opts: { project?: string }) => {
      if (!(VALID_STATUSES as readonly string[]).includes(newStatus)) {
        die(`Invalid status '${newStatus}'. Must be one of: ${VALID_STATUSES.join(', ')}`)
      }

      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)
      const index = await scanProject(curiyePath)

      const spec = index.planned.find((s) => s.id === specId)
      if (!spec) die(`Spec '${specId}' not found in ${project.id}`)

      if (!spec.path) die(`Cannot determine file path for spec '${specId}'`)

      const doc = await readDocument(spec.path, 'planned')
      const fm = doc.frontmatter as PlannedFrontmatter & Record<string, unknown>
      fm.status = newStatus as PlannedFrontmatter['status']
      fm.updated = today()
      await writeDocument(spec.path, doc)

      if (isJsonMode()) {
        printJson({ id: specId, status: newStatus })
      } else {
        printLine(`Updated '${specId}' → ${newStatus}`)
      }
    })
}
