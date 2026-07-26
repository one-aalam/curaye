import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import { confirm, isCancel } from '@clack/prompts'
import { scanProject, ReleaseManager } from '@curaye/core'
import { ProjectRegistry } from '@curaye/core'
import type { PlannedFrontmatter } from '@curaye/protocol'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { resolveProject, today } from '../lib/context.js'

const KANBAN_STATUS = ['draft', 'ready', 'building', 'done'] as const
const COL_WIDTH = 18

function pad(s: string, width: number): string {
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length)
}

function renderKanban(
  releaseId: string,
  releaseTitle: string,
  specs: Array<{ title: string; status: string; effort: string }>,
): void {
  printLine(`${releaseTitle} (${releaseId}) — Kanban Board`)
  printLine('')

  const columns: Record<string, typeof specs> = {
    draft: [],
    ready: [],
    building: [],
    done: [],
  }

  for (const s of specs) {
    const col = columns[s.status]
    if (col !== undefined) col.push(s)
  }

  const headers = KANBAN_STATUS.map((s) => pad(s.charAt(0).toUpperCase() + s.slice(1), COL_WIDTH))
  printLine(headers.join('  '))
  printLine(KANBAN_STATUS.map(() => '─'.repeat(COL_WIDTH)).join('  '))

  const maxRows = Math.max(...KANBAN_STATUS.map((s) => columns[s]?.length ?? 0))
  if (maxRows === 0) {
    printLine(KANBAN_STATUS.map(() => pad('(empty)', COL_WIDTH)).join('  '))
    return
  }

  for (let i = 0; i < maxRows; i++) {
    const cells = KANBAN_STATUS.map((s) => {
      const spec = columns[s]?.[i]
      if (!spec) return pad('', COL_WIDTH)
      const label = spec.effort ? `${spec.title} (${spec.effort})` : spec.title
      return pad(label, COL_WIDTH)
    })
    printLine(cells.join('  '))
  }
}

export function registerRelease(program: Command): void {
  const releaseCmd = program.command('release').description('Manage releases and kanban boards')

  releaseCmd
    .command('new <name>')
    .description('Create a new release document in .curaye/releases/')
    .option('--project <id>', 'Project id')
    .option('--target <date>', 'Target date (YYYY-MM-DD)')
    .action(async (name: string, opts: { project?: string; target?: string }) => {
      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)
      const summary = await ReleaseManager.create(curiyePath, name, today(), opts.target)

      if (isJsonMode()) {
        printJson(summary)
        return
      }
      printLine(`Created release '${summary.id}' → ${summary.path}`)
    })

  releaseCmd
    .command('list')
    .description('List releases with spec counts and status')
    .option('--project <id>', 'Project id')
    .action(async (opts: { project?: string }) => {
      const projects = opts.project
        ? [await resolveProject(opts.project)]
        : await ProjectRegistry.read()

      const allSummaries: Array<{
        project: string
        id: string
        title: string
        status: string
        target: string
        done: number
        total: number
      }> = []

      for (const project of projects) {
        const curiyePath = ProjectRegistry.curiyePath(project)
        const summaries = await ReleaseManager.list(curiyePath)
        for (const s of summaries) {
          allSummaries.push({
            project: project.id,
            id: s.id,
            title: s.title,
            status: s.status,
            target: s.target ?? '—',
            done: s.done,
            total: s.total,
          })
        }
      }

      if (isJsonMode()) {
        printJson(allSummaries)
        return
      }

      if (allSummaries.length === 0) {
        printLine('No releases found. Run `curaye release new <name>` to create one.')
        return
      }

      const projectW = Math.max(7, ...allSummaries.map((r) => r.project.length))
      const idW = Math.max(2, ...allSummaries.map((r) => r.id.length))
      const titleW = Math.max(5, ...allSummaries.map((r) => r.title.length))
      const statusW = 8

      const header = [
        'PROJECT'.padEnd(projectW),
        'ID'.padEnd(idW),
        'TITLE'.padEnd(titleW),
        'STATUS'.padEnd(statusW),
        'TARGET'.padEnd(10),
        'PROGRESS',
      ].join('  ')

      const divider = [
        '-'.repeat(projectW),
        '-'.repeat(idW),
        '-'.repeat(titleW),
        '-'.repeat(statusW),
        '-'.repeat(10),
        '--------',
      ].join('  ')

      printLine(header)
      printLine(divider)

      for (const r of allSummaries) {
        const bar = r.total > 0 ? `${r.done}/${r.total}` : '—'
        const line = [
          r.project.padEnd(projectW),
          r.id.padEnd(idW),
          r.title.padEnd(titleW),
          r.status.padEnd(statusW),
          r.target.padEnd(10),
          bar,
        ].join('  ')
        printLine(line)
      }
    })

  releaseCmd
    .command('assign <spec-id> <release-id>')
    .description('Assign a planned spec to a release (replaces any existing assignment)')
    .option('--project <id>', 'Project id')
    .action(async (specId: string, releaseId: string, opts: { project?: string }) => {
      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)
      const index = await scanProject(curiyePath)

      const spec = index.planned.find((s) => s.id === specId)
      if (!spec) die(`Spec '${specId}' not found in project '${project.id}'`)
      if (!spec.path) die(`Cannot determine file path for spec '${specId}'`)

      // Verify release exists
      const releases = await ReleaseManager.list(curiyePath)
      const release = releases.find((r) => r.id === releaseId)
      if (!release) die(`Release '${releaseId}' not found. Run 'curaye release list' to see available releases.`)

      await ReleaseManager.assign(spec.path, releaseId, today())

      if (isJsonMode()) {
        printJson({ specId, releaseId, specPath: spec.path })
        return
      }
      printLine(`Assigned '${specId}' → release '${releaseId}'`)
    })

  releaseCmd
    .command('board <release-id>')
    .description('Print the kanban board for a release to stdout')
    .option('--project <id>', 'Project id')
    .action(async (releaseId: string, opts: { project?: string }) => {
      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)
      const index = await scanProject(curiyePath)

      const releases = await ReleaseManager.list(curiyePath)
      const release = releases.find((r) => r.id === releaseId)
      if (!release) die(`Release '${releaseId}' not found.`)

      const specs = index.planned
        .filter((s) => {
          const fm = s.frontmatter as PlannedFrontmatter
          return (fm.release ?? '') === releaseId && fm.status !== 'shelved'
        })
        .map((s) => {
          const fm = s.frontmatter as PlannedFrontmatter
          return {
            title: fm.title ?? s.id ?? '',
            status: fm.status ?? 'draft',
            effort: fm.effort ?? '',
          }
        })

      if (isJsonMode()) {
        printJson({ releaseId, release, specs })
        return
      }

      renderKanban(releaseId, release.title, specs)
    })

  releaseCmd
    .command('ship <release-id>')
    .description('Ship all done specs in a release and mark the release shipped')
    .option('--project <id>', 'Project id')
    .action(async (releaseId: string, opts: { project?: string }) => {
      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)

      const releases = await ReleaseManager.list(curiyePath)
      const release = releases.find((r) => r.id === releaseId)
      if (!release) die(`Release '${releaseId}' not found. Run 'curaye release list' to see available releases.`)
      if (release.status === 'shipped') die(`Release '${releaseId}' is already shipped.`)

      const index = await scanProject(curiyePath)
      const doneSpecs = index.planned.filter((s) => {
        const fm = s.frontmatter as PlannedFrontmatter
        return (fm.release ?? '') === releaseId && fm.status === 'done' && !!s.path
      })

      if (doneSpecs.length === 0) {
        die(`No specs with status 'done' found in release '${releaseId}'. Mark specs done before shipping the release.`)
      }

      if (!isJsonMode()) {
        const label = doneSpecs.length === 1 ? '1 spec' : `${doneSpecs.length} specs`
        const ok = await confirm({ message: `Ship ${label} and mark release '${releaseId}' shipped?` })
        if (isCancel(ok) || !ok) {
          printLine('Aborted.')
          return
        }
      }

      const shippedDir = path.join(curiyePath, 'shipped')
      await fs.mkdir(shippedDir, { recursive: true })

      const results: Array<{ id: string; shippedPath: string }> = []

      for (const spec of doneSpecs) {
        const fm = spec.frontmatter as PlannedFrontmatter
        const specId = spec.id ?? path.basename(spec.path!, '.md')
        const title = fm.title ?? specId
        const shippedPath = path.join(shippedDir, `${specId}.md`)

        const content = `---
id: ${specId}
title: "${title}"
shipped: ${today()}
release: "${releaseId}"
spec_ref: "${specId}"
---

# ${title}

> Shipped in ${releaseId} on ${today()}

## What shipped

## Changes to current/

## Notes
`
        const tmp = shippedPath + '.tmp'
        await fs.writeFile(tmp, content, 'utf8')
        await fs.rename(tmp, shippedPath)
        await fs.unlink(spec.path!)

        results.push({ id: specId, shippedPath })
      }

      await ReleaseManager.markReleaseStatus(release.path, 'shipped', today())

      if (isJsonMode()) {
        printJson({ releaseId, shipped: results, releasePath: release.path })
        return
      }

      for (const r of results) {
        printLine(`  ✓ ${r.id} → ${r.shippedPath}`)
      }
      printLine(`\nRelease '${releaseId}' marked shipped. Update current/ docs to reflect what landed.`)
    })
}
