import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import { intro, outro, log } from '@clack/prompts'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { today } from '../lib/context.js'

const REQUIRED_DIRS = ['planned', 'current', 'shipped', 'decisions']

const STUB_PRD = `---
updated: ${today()}
---

# Product Requirements

> Describe what this product does and why it exists.
`

const STUB_STACK = `---
updated: ${today()}
---

# Stack

> Describe the technology stack, key dependencies, and architectural decisions.
`

export function registerInit(program: Command): void {
  program
    .command('init [path]')
    .description('Scaffold .curaye/ in the given directory (default: current directory)')
    .action(async (targetPath: string | undefined) => {
      const resolvedPath = path.resolve(targetPath ?? process.cwd())
      const curayePath = path.join(resolvedPath, '.curaye')

      if (!isJsonMode()) intro('curaye init')

      try {
        await fs.access(curayePath)
        die(`.curaye/ already exists at ${resolvedPath}`)
      } catch {
        // Good — doesn't exist yet
      }

      await fs.mkdir(curayePath, { recursive: true })
      for (const dir of REQUIRED_DIRS) {
        await fs.mkdir(path.join(curayePath, dir), { recursive: true })
      }

      await fs.writeFile(path.join(curayePath, 'prd.md'), STUB_PRD, 'utf8')
      await fs.writeFile(path.join(curayePath, 'stack.md'), STUB_STACK, 'utf8')

      if (isJsonMode()) {
        printJson({ path: resolvedPath, curiyePath: curayePath, created: REQUIRED_DIRS })
      } else {
        log.success(`Created .curaye/ in ${resolvedPath}`)
        for (const dir of REQUIRED_DIRS) {
          printLine(`  ${dir}/`)
        }
        outro('Done. Run `curaye link` to register this project.')
      }
    })
}
