import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import { spawn } from 'child_process'
import { intro, outro, confirm, isCancel, log } from '@clack/prompts'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findInferredDocs(curayePath: string): Promise<string[]> {
  const results: string[] = []
  const dirs = ['planned', 'current', 'shipped', 'decisions']
  const rootFiles = ['prd.md', 'stack.md', 'product.md']

  for (const f of rootFiles) {
    const filePath = path.join(curayePath, f)
    if (await hasConfidenceInferred(filePath)) results.push(filePath)
  }

  for (const dir of dirs) {
    const dirPath = path.join(curayePath, dir)
    try {
      const entries = await fs.readdir(dirPath)
      for (const entry of entries) {
        if (!entry.endsWith('.md')) continue
        const filePath = path.join(dirPath, entry)
        if (await hasConfidenceInferred(filePath)) results.push(filePath)
      }
    } catch {
      // dir may not exist
    }
  }

  return results
}

async function hasConfidenceInferred(filePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return /^confidence:\s*inferred/m.test(content)
  } catch {
    return false
  }
}

function removeConfidenceField(content: string): string {
  // Remove "confidence: ..." line from frontmatter
  return content.replace(/^confidence:.*\n/m, '')
}

async function openInEditor(filePath: string): Promise<void> {
  const editor = process.env['EDITOR'] ?? process.env['VISUAL'] ?? 'vi'
  const parts = editor.split(' ')
  const cmd = parts[0]
  const args = parts.slice(1)
  if (!cmd) return
  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, [...args, filePath], { stdio: 'inherit' })
    child.on('close', (code) => {
      if (code === 0 || code === null) resolve()
      else reject(new Error(`Editor exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export function registerReview(program: Command): void {
  program
    .command('review [path]')
    .description('Review all confidence:inferred documents and confirm or edit them')
    .action(async (targetPath: string | undefined) => {
      const resolvedPath = path.resolve(targetPath ?? process.cwd())
      const curayePath = path.join(resolvedPath, '.curaye')

      if (!isJsonMode()) intro('curaye review')

      // Check .curaye/ exists
      try {
        await fs.access(curayePath)
      } catch {
        die(`.curaye/ not found at ${resolvedPath}. Run 'curaye init' or 'curaye import' first.`)
      }

      const inferredDocs = await findInferredDocs(curayePath)

      if (inferredDocs.length === 0) {
        if (isJsonMode()) {
          printJson({ reviewed: 0, message: 'No inferred documents found.' })
        } else {
          log.info('No documents with confidence: inferred found.')
          outro('Nothing to review.')
        }
        return
      }

      if (isJsonMode()) {
        // In JSON mode, just list them
        const docs = inferredDocs.map((f) => path.relative(curayePath, f))
        printJson({ inferredDocs: docs, count: docs.length })
        return
      }

      printLine(`\nFound ${inferredDocs.length} document(s) marked 'confidence: inferred':\n`)
      for (const doc of inferredDocs) {
        printLine(`  ${path.relative(resolvedPath, doc)}`)
      }
      printLine('')

      let confirmed = 0
      let skipped = 0

      for (const filePath of inferredDocs) {
        const rel = path.relative(resolvedPath, filePath)
        printLine(`\n── ${rel}`)

        const action = await confirm({
          message: `Open in $EDITOR to review?`,
        })

        if (isCancel(action)) {
          printLine('Aborted.')
          break
        }

        if (action) {
          await openInEditor(filePath)

          const markReviewed = await confirm({
            message: 'Mark as reviewed? (removes confidence: inferred)',
          })

          if (!isCancel(markReviewed) && markReviewed) {
            const content = await fs.readFile(filePath, 'utf8')
            const updated = removeConfidenceField(content)
            const tmp = `${filePath}.tmp`
            await fs.writeFile(tmp, updated, 'utf8')
            await fs.rename(tmp, filePath)
            log.success(`Confirmed: ${rel}`)
            confirmed++
          } else {
            skipped++
          }
        } else {
          skipped++
        }
      }

      printLine('')
      log.info(`Review complete: ${confirmed} confirmed, ${skipped} skipped`)
      outro(
        confirmed > 0
          ? 'Confirmed documents are now standard protocol documents.'
          : 'No documents were confirmed. Run `curaye review` again when ready.',
      )
    })
}
