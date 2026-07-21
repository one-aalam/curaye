import type { Command } from 'commander'
import path from 'path'
import { intro, outro, text, confirm, isCancel } from '@clack/prompts'
import { ProjectRegistry } from '@curaye/core'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { curayeExists, today } from '../lib/context.js'

export function registerLink(program: Command): void {
  program
    .command('link [path]')
    .description('Register a project in ~/.curaye/projects.yaml')
    .action(async (targetPath: string | undefined) => {
      const resolvedPath = path.resolve(targetPath ?? process.cwd())

      if (!isJsonMode()) intro('curaye link')

      if (!(await curayeExists(resolvedPath))) {
        if (!isJsonMode()) {
          const runInit = await confirm({
            message: `.curaye/ not found at ${resolvedPath}. Run 'curaye init' first?`,
          })
          if (isCancel(runInit) || !runInit) die('Aborted. Run `curaye init` to scaffold .curaye/ first.')
        }
        die(`.curaye/ not found at ${resolvedPath}. Run 'curaye init' first.`)
      }

      const inferredId = path.basename(resolvedPath).toLowerCase().replace(/[^a-z0-9]+/g, '-')

      let projectName: string
      if (isJsonMode()) {
        projectName = inferredId
      } else {
        const nameResult = await text({
          message: 'Project name',
          placeholder: inferredId,
          defaultValue: inferredId,
        })
        if (isCancel(nameResult)) die('Aborted.')
        projectName = nameResult as string
      }

      const existing = await ProjectRegistry.find(inferredId)
      if (existing) die(`Project '${inferredId}' is already registered at ${existing.path}`)

      await ProjectRegistry.add({
        id: inferredId,
        name: projectName,
        path: resolvedPath,
        added: today(),
      })

      if (isJsonMode()) {
        printJson({ id: inferredId, name: projectName, path: resolvedPath })
      } else {
        printLine('')
        outro(`Registered '${inferredId}' → ${resolvedPath}`)
      }
    })
}
