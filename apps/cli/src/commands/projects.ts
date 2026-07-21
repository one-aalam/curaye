import type { Command } from 'commander'
import { ProjectRegistry } from '@curaye/core'
import { isJsonMode, printJson, printLine } from '../lib/output.js'

export function registerProjects(program: Command): void {
  program
    .command('projects')
    .description('List all registered projects')
    .action(async () => {
      const projects = await ProjectRegistry.read()

      if (isJsonMode()) {
        printJson(projects)
        return
      }

      if (projects.length === 0) {
        printLine('No projects registered. Run `curaye link` to register one.')
        return
      }

      const idWidth = Math.max(2, ...projects.map((p) => p.id.length))
      const nameWidth = Math.max(4, ...projects.map((p) => p.name.length))

      printLine(`${'ID'.padEnd(idWidth)}  ${'NAME'.padEnd(nameWidth)}  PATH`)
      printLine(`${'-'.repeat(idWidth)}  ${'-'.repeat(nameWidth)}  ----`)

      for (const p of projects) {
        printLine(`${p.id.padEnd(idWidth)}  ${p.name.padEnd(nameWidth)}  ${p.path}`)
      }
    })
}
