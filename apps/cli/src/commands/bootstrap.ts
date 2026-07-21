import type { Command } from 'commander'
import { printLine } from '../lib/output.js'

export function registerBootstrap(program: Command): void {
  program
    .command('bootstrap [path]')
    .description('Run the project bootstrap flow (see spec 13-project-bootstrap)')
    .action(async (_targetPath: string | undefined) => {
      printLine('bootstrap: not yet implemented (spec 13-project-bootstrap)')
      process.exit(1)
    })
}
