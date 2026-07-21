import type { Command } from 'commander'
import { scanProject, ProjectRegistry } from '@curaye/core'
import type { PlannedFrontmatter } from '@curaye/protocol'
import { isJsonMode, printJson, printLine } from '../lib/output.js'
import { resolveProject } from '../lib/context.js'

export function registerList(program: Command): void {
  program
    .command('list')
    .description('List planned specs for the current or specified project')
    .option('--project <id>', 'Project id')
    .option('--status <status>', 'Filter by status')
    .option('--tag <tag>', 'Filter by tag')
    .action(async (opts: { project?: string; status?: string; tag?: string }) => {
      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)
      const index = await scanProject(curiyePath)

      let specs = index.planned

      if (opts.status) {
        specs = specs.filter((s) => (s.frontmatter as PlannedFrontmatter).status === opts.status)
      }
      if (opts.tag) {
        specs = specs.filter((s) => (s.frontmatter as PlannedFrontmatter).tags?.includes(opts.tag!))
      }

      if (isJsonMode()) {
        printJson(specs.map((s) => ({ id: s.id, ...s.frontmatter })))
        return
      }

      if (specs.length === 0) {
        printLine('No specs found.')
        return
      }

      const idWidth = Math.max(2, ...specs.map((s) => (s.id ?? '').length))
      const statusWidth = Math.max(6, ...specs.map((s) => ((s.frontmatter as PlannedFrontmatter).status ?? '').length))
      const effortWidth = 6

      printLine(
        `${'ID'.padEnd(idWidth)}  ${'STATUS'.padEnd(statusWidth)}  ${'EFFORT'.padEnd(effortWidth)}  TITLE`,
      )
      printLine(`${'-'.repeat(idWidth)}  ${'-'.repeat(statusWidth)}  ${'-'.repeat(effortWidth)}  -----`)

      for (const spec of specs) {
        const fm = spec.frontmatter as PlannedFrontmatter
        printLine(
          `${(spec.id ?? '').padEnd(idWidth)}  ${(fm.status ?? '').padEnd(statusWidth)}  ${(fm.effort ?? '').padEnd(effortWidth)}  ${fm.title}`,
        )
      }
    })
}
