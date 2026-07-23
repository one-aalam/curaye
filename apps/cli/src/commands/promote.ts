import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import { intro, outro, select, text, confirm, spinner, log, isCancel } from '@clack/prompts'
import { SharedLayer, ProjectRegistry, CATEGORIES } from '@curaye/core'
import type { SharedCategory } from '@curaye/core'
import { readAiConfig, isAvailable, createProvider } from '@curaye/ai'
import { isJsonMode, printJson, die } from '../lib/output.js'
import { resolveProject } from '../lib/context.js'

export function registerPromote(program: Command): void {
  program
    .command('promote <file-path>')
    .description('Promote a project-level document to the shared layer')
    .option('--to <category>', 'Target category: decisions|patterns|design|agents|stack')
    .option('--project <id>', 'Project id (defaults to current directory)')
    .option('--id <id>', 'Override the shared document id')
    .action(async (filePath: string, opts: { to?: string; project?: string; id?: string }) => {
      if (!isJsonMode()) intro('curaye promote')

      // 1. Resolve project
      const project = await resolveProject(opts.project)
      const curayePath = ProjectRegistry.curiyePath(project)
      // project.id may be absent when the registry was written by the desktop app
      const projectId = project.id || project.name

      // 2. Resolve absolute path — first try relative to .curaye/, then cwd
      let absolutePath: string
      if (path.isAbsolute(filePath)) {
        absolutePath = filePath
      } else {
        const fromCuraye = path.join(curayePath, filePath)
        try {
          await fs.access(fromCuraye)
          absolutePath = fromCuraye
        } catch {
          absolutePath = path.resolve(filePath)
        }
      }

      // 3. Detect source section (first segment of path relative to .curaye/)
      const relToCuraye = path.relative(curayePath, absolutePath)
      const sourceSection = relToCuraye.split(path.sep)[0] ?? ''

      // 4. Validate not planned/
      if (sourceSection === 'planned') {
        die('Only current/ and decisions/ documents can be promoted.')
      }

      // 5. Read source content
      let rawContent: string
      try {
        rawContent = await fs.readFile(absolutePath, 'utf8')
      } catch {
        die(`File not found: ${absolutePath}`)
      }

      // 6. Determine target category
      let category: SharedCategory
      if (opts.to) {
        if (!(CATEGORIES as readonly string[]).includes(opts.to)) {
          die(`Invalid category '${opts.to}'. Valid: ${CATEGORIES.join(', ')}`)
        }
        category = opts.to as SharedCategory
      } else if (isJsonMode()) {
        die('--to <category> is required in --json mode')
      } else {
        const chosen = await select({
          message: 'Target category in shared layer:',
          options: CATEGORIES.map((c) => ({ value: c, label: c })),
        })
        if (isCancel(chosen)) process.exit(0)
        category = chosen as SharedCategory
      }

      // 7. Determine shared document id
      const defaultId = path.basename(absolutePath, '.md')
      let docId: string
      if (opts.id) {
        docId = opts.id
      } else if (isJsonMode()) {
        docId = defaultId
      } else {
        const typed = await text({
          message: 'Shared document id:',
          placeholder: defaultId,
          defaultValue: defaultId,
        })
        if (isCancel(typed)) process.exit(0)
        docId = (typed as string) || defaultId
      }

      // 8. AI generalisation (interactive only)
      let contentToPromote = rawContent
      if (!isJsonMode()) {
        const aiConfig = await readAiConfig()
        if (aiConfig && isAvailable(aiConfig)) {
          const wantsGeneral = await confirm({
            message: 'Generalise document for shared use? (removes project-specific references)',
          })
          if (!isCancel(wantsGeneral) && wantsGeneral === true) {
            const s = spinner()
            s.start('Rewriting for shared use…')
            const provider = createProvider(aiConfig)
            try {
              const rewritten = await provider.complete([
                {
                  role: 'system',
                  content:
                    'You rewrite technical documents for a shared knowledge layer. Remove all project-specific names, identifiers, and repository names. Replace concrete project names with generic placeholders like "your-project". Keep the structure, insights, and decisions intact. Return ONLY the rewritten document with no preamble.',
                },
                {
                  role: 'user',
                  content: `Rewrite this document to be project-neutral:\n\n${rawContent}`,
                },
              ])
              s.stop('Rewrite complete.')
              log.info('Preview (first 400 chars):')
              log.message(rewritten.slice(0, 400) + (rewritten.length > 400 ? '\n…(truncated)' : ''))
              const accept = await confirm({ message: 'Use this generalised version?' })
              if (!isCancel(accept) && accept === true) {
                contentToPromote = rewritten
              }
            } catch {
              s.stop('AI rewrite failed — using original content.')
            }
          }
        }
      }

      // 9. Promote to shared layer
      const s = spinner()
      s.start('Promoting…')
      const result = await SharedLayer.promote({
        sourcePath: absolutePath,
        sourceSection,
        category,
        id: docId,
        projectId,
        content: contentToPromote,
      })
      s.stop(result.isUpdate ? `Updated ${result.docRef}` : `Promoted to ${result.docRef}`)

      // 10. Optionally back-link source document (interactive only)
      if (!isJsonMode()) {
        const wantsRef = await confirm({
          message: `Add 'promoted_to: ${result.docRef}' to the source document?`,
        })
        if (!isCancel(wantsRef) && wantsRef === true) {
          await SharedLayer.markPromotedSource(absolutePath, result.docRef)
          log.success(`Source updated with promoted_to: ${result.docRef}`)
        }
      }

      if (isJsonMode()) {
        printJson({
          sharedPath: result.sharedPath,
          docRef: result.docRef,
          isUpdate: result.isUpdate,
          category,
          id: docId,
          sourceProject: projectId,
        })
        return
      }

      outro(
        result.isUpdate
          ? `Updated shared/${category}/${docId}`
          : `Promoted to shared/${category}/${docId}`,
      )
    })
}
