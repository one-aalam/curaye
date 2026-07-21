import type { Command } from 'commander'
import { printLine } from '../lib/output.js'

export function registerPromote(program: Command): void {
  program
    .command('promote <file-path>')
    .description('Promote a project-level document to the shared layer (see spec 17-pattern-promotion)')
    .option('--to <destination>', 'Target: shared, decisions, patterns, or design')
    .action(async (_filePath: string, _opts: { to?: string }) => {
      printLine('promote: not yet implemented (spec 17-pattern-promotion)')
      process.exit(1)
    })
}
