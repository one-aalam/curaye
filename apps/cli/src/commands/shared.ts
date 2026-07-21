import type { Command } from 'commander'
import { intro, outro, log } from '@clack/prompts'
import { SharedLayer, ProjectRegistry } from '@curaye/core'
import type { SharedCategory } from '@curaye/core'
import { CATEGORIES } from '@curaye/core'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'

export function registerShared(program: Command): void {
  const sharedCmd = program.command('shared').description('Manage the shared layer (~/.curaye/shared/)')

  sharedCmd
    .command('init')
    .description('Create ~/.curaye/shared/ with all category subfolders')
    .action(async () => {
      await SharedLayer.init()
      if (isJsonMode()) {
        printJson({ initialized: true, categories: [...CATEGORIES] })
      } else {
        log.success('Shared layer initialised at ~/.curaye/shared/')
        for (const cat of CATEGORIES) printLine(`  ${cat}/`)
      }
    })

  sharedCmd
    .command('list')
    .description('List shared documents, grouped by category')
    .option('--category <cat>', 'Filter by category (decisions|patterns|design|agents|stack)')
    .action(async (opts: { category?: string }) => {
      const category = opts.category as SharedCategory | undefined
      if (category && !(CATEGORIES as readonly string[]).includes(category)) {
        die(`Unknown category '${category}'. Valid: ${CATEGORIES.join(', ')}`)
      }

      const docs = await SharedLayer.list(category)

      if (isJsonMode()) {
        printJson(docs.map((d) => ({ id: d.id, category: d.category, title: d.title })))
        return
      }

      if (docs.length === 0) {
        printLine('No shared documents found.')
        printLine("Run 'curaye shared init' to create the folder structure.")
        return
      }

      const byCategory = new Map<SharedCategory, typeof docs>()
      for (const doc of docs) {
        const list = byCategory.get(doc.category) ?? []
        list.push(doc)
        byCategory.set(doc.category, list)
      }

      for (const [cat, catDocs] of byCategory) {
        printLine(`\n${cat}/`)
        for (const d of catDocs) printLine(`  ${d.id}  ${d.title}`)
      }
    })

  sharedCmd
    .command('show <id>')
    .description('Print a shared document to stdout')
    .action(async (id: string) => {
      const doc = await SharedLayer.show(id)
      if (!doc) die(`Shared document '${id}' not found`)
      if (isJsonMode()) {
        printJson({ id: doc.id, category: doc.category, title: doc.title, raw: doc.raw })
      } else {
        printLine(doc.raw)
      }
    })

  sharedCmd
    .command('adopt <id>')
    .description('Declare adoption of a shared document for the given project')
    .option('--project <id>', 'Project id')
    .action(async (docId: string, opts: { project?: string }) => {
      if (!isJsonMode()) intro('curaye shared adopt')

      const doc = await SharedLayer.show(docId)
      if (!doc) die(`Shared document '${docId}' not found in shared layer`)

      let projectId = opts.project
      if (!projectId) {
        // infer from cwd
        const { resolveProject } = await import('../lib/context.js')
        const project = await resolveProject(undefined)
        projectId = project.id
      }

      await ProjectRegistry.adopt(projectId, `shared/${doc.category}/${docId}`)
      // Record the current state as "reviewed" so diff starts from here
      await SharedLayer.recordReview(docId, projectId)

      if (isJsonMode()) {
        printJson({ projectId, adopted: `shared/${doc.category}/${docId}` })
      } else {
        outro(`Project '${projectId}' now adopts shared/${doc.category}/${docId}`)
      }
    })

  sharedCmd
    .command('diff <id>')
    .description('Show what changed in a shared document since the project last reviewed it')
    .option('--project <id>', 'Project id')
    .action(async (docId: string, opts: { project?: string }) => {
      let projectId = opts.project
      if (!projectId) {
        const { resolveProject } = await import('../lib/context.js')
        const project = await resolveProject(undefined)
        projectId = project.id
      }

      const diffText = await SharedLayer.diff(docId, projectId)
      if (diffText === null) {
        die(`No review baseline recorded for '${docId}' in project '${projectId}'. Run 'curaye shared adopt ${docId}' first.`)
      }
      if (diffText === '') {
        printLine(`shared/${docId}: no changes since last review`)
        return
      }
      if (isJsonMode()) {
        printJson({ docId, projectId, diff: diffText })
      } else {
        printLine(diffText)
      }
    })

  sharedCmd
    .command('notifications')
    .description('List pending shared-layer update notifications')
    .option('--mark-reviewed <docId>', 'Clear notification for this doc id')
    .option('--project <id>', 'Project id (required with --mark-reviewed)')
    .action(async (opts: { markReviewed?: string; project?: string }) => {
      if (opts.markReviewed) {
        let projectId = opts.project
        if (!projectId) {
          const { resolveProject } = await import('../lib/context.js')
          const project = await resolveProject(undefined)
          projectId = project.id
        }
        await SharedLayer.markReviewed(opts.markReviewed, projectId)
        // Also update the review snapshot
        try {
          await SharedLayer.recordReview(opts.markReviewed, projectId)
        } catch {
          // Doc may have been deleted — ignore
        }
        if (!isJsonMode()) printLine(`Notification cleared for '${opts.markReviewed}' / project '${projectId}'`)
        return
      }

      const notifications = await SharedLayer.listNotifications()
      if (isJsonMode()) {
        printJson(notifications)
        return
      }
      if (notifications.length === 0) {
        printLine('No pending notifications.')
        return
      }
      for (const n of notifications) {
        printLine(`  ${n.docId}  (${n.category})  updated: ${n.updatedAt}  adopted by: ${n.adoptedBy.join(', ')}`)
      }
    })
}
