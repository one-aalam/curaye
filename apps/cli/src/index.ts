#!/usr/bin/env node
import { Command } from 'commander'
import { setJsonMode } from './lib/output.js'
import { registerInit } from './commands/init.js'
import { registerLink } from './commands/link.js'
import { registerUnlink } from './commands/unlink.js'
import { registerProjects } from './commands/projects.js'
import { registerNew } from './commands/new.js'
import { registerList } from './commands/list.js'
import { registerStatusCmd } from './commands/status-cmd.js'
import { registerShip } from './commands/ship.js'
import { registerSync } from './commands/sync.js'
import { registerSearch } from './commands/search.js'
import { registerAi } from './commands/ai.js'
import { registerBootstrap } from './commands/bootstrap.js'
import { registerPromote } from './commands/promote.js'
import { registerShared } from './commands/shared.js'

const program = new Command()

program
  .name('curaye')
  .description('Local-first spec and knowledge management for developers')
  .version('0.0.1')
  .option('--json', 'Output structured JSON')
  .hook('preAction', () => {
    const opts = program.opts<{ json?: boolean }>()
    if (opts['json']) setJsonMode(true)
  })

registerInit(program)
registerLink(program)
registerUnlink(program)
registerProjects(program)
registerNew(program)
registerList(program)
registerStatusCmd(program)
registerShip(program)
registerSync(program)
registerSearch(program)
registerAi(program)
registerBootstrap(program)
registerPromote(program)
registerShared(program)

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write((err instanceof Error ? err.message : String(err)) + '\n')
  process.exit(1)
})
