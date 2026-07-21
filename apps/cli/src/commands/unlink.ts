import type { Command } from 'commander'
import { ProjectRegistry } from '@curaye/core'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'

export function registerUnlink(program: Command): void {
  program
    .command('unlink <id>')
    .description('Remove a project from the registry (does not delete .curaye/)')
    .action(async (id: string) => {
      const project = await ProjectRegistry.find(id)
      if (!project) die(`Project '${id}' is not registered.`)

      await ProjectRegistry.remove(id)

      if (isJsonMode()) {
        printJson({ removed: id })
      } else {
        printLine(`Unregistered '${id}'.`)
      }
    })
}
