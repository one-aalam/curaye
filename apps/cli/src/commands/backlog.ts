import type { Command } from 'commander'
import path from 'path'
import { scanProject, ProjectRegistry } from '@curaye/core'
import type { PlannedFrontmatter } from '@curaye/protocol'
import { isJsonMode, printJson, printLine } from '../lib/output.js'

const EFFORT_ORDER: Record<string, number> = { xs: 0, s: 1, m: 2, l: 3, xl: 4 }
const LEVEL_ORDER: Record<string, number> = { low: 1, medium: 2, high: 3 }

type SortField = 'impact' | 'desire' | 'effort'

interface BacklogRow {
  project: string
  id: string
  title: string
  status: string
  effort: string
  impact: string
  desire: string
  release: string
}

function sortRows(rows: BacklogRow[], field: SortField): BacklogRow[] {
  return [...rows].sort((a, b) => {
    if (field === 'effort') {
      const aOrd = EFFORT_ORDER[a.effort] ?? -1
      const bOrd = EFFORT_ORDER[b.effort] ?? -1
      return aOrd - bOrd
    }
    // impact and desire: descending (high first)
    const aOrd = LEVEL_ORDER[field === 'impact' ? a.impact : a.desire] ?? 0
    const bOrd = LEVEL_ORDER[field === 'impact' ? b.impact : b.desire] ?? 0
    return bOrd - aOrd
  })
}

export function registerBacklog(program: Command): void {
  program
    .command('backlog')
    .description('Cross-project backlog: all planned specs across registered projects')
    .option('--status <status>', 'Filter by status (draft or ready)')
    .option('--sort <field>', 'Sort by: impact, desire, effort', 'impact')
    .option('--project <id>', 'Limit to a single project')
    .action(
      async (opts: { status?: string; sort?: string; project?: string }) => {
        const projects = await ProjectRegistry.read()

        const targetProjects = opts.project
          ? projects.filter((p) => p.id === opts.project)
          : projects

        const rows: BacklogRow[] = []

        for (const project of targetProjects) {
          const curiyePath = ProjectRegistry.curiyePath(project)
          let index
          try {
            index = await scanProject(curiyePath)
          } catch {
            continue
          }

          for (const spec of index.planned) {
            const fm = spec.frontmatter as PlannedFrontmatter
            const status = fm.status ?? ''

            if (status !== 'draft' && status !== 'ready') continue
            if (opts.status && status !== opts.status) continue

            const title = fm.title ?? ''
            if (!title) continue

            rows.push({
              project: project.id,
              id: spec.id ?? path.basename(spec.path ?? '', '.md'),
              title,
              status,
              effort: fm.effort ?? '',
              impact: fm.impact ?? '',
              desire: fm.desire ?? '',
              release: fm.release ?? '',
            })
          }
        }

        const sortField = (opts.sort ?? 'impact') as SortField
        const sorted = sortRows(rows, sortField)

        if (isJsonMode()) {
          printJson(sorted)
          return
        }

        if (sorted.length === 0) {
          printLine('No planned specs found.')
          return
        }

        const projectW = Math.max(7, ...sorted.map((r) => r.project.length))
        const idW = Math.max(2, ...sorted.map((r) => r.id.length))
        const titleW = Math.max(5, Math.min(40, ...sorted.map((r) => r.title.length)))
        const statusW = 8
        const effortW = 6
        const impactW = 6
        const desireW = 6

        const header = [
          'PROJECT'.padEnd(projectW),
          'ID'.padEnd(idW),
          'TITLE'.padEnd(titleW),
          'STATUS'.padEnd(statusW),
          'EFFORT'.padEnd(effortW),
          'IMPACT'.padEnd(impactW),
          'DESIRE'.padEnd(desireW),
          'RELEASE',
        ].join('  ')

        const divider = [
          '-'.repeat(projectW),
          '-'.repeat(idW),
          '-'.repeat(titleW),
          '-'.repeat(statusW),
          '-'.repeat(effortW),
          '-'.repeat(impactW),
          '-'.repeat(desireW),
          '-------',
        ].join('  ')

        printLine(header)
        printLine(divider)

        for (const row of sorted) {
          const line = [
            row.project.padEnd(projectW),
            row.id.padEnd(idW),
            row.title.slice(0, titleW).padEnd(titleW),
            row.status.padEnd(statusW),
            row.effort.padEnd(effortW),
            row.impact.padEnd(impactW),
            row.desire.padEnd(desireW),
            row.release || '—',
          ].join('  ')
          printLine(line)
        }
      },
    )
}
