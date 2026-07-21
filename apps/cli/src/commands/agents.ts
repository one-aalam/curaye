import type { Command } from 'commander'
import { ProjectRegistry, detectAgentFiles, readAgentLog } from '@curaye/core'
import type { AgentFile } from '@curaye/core'
import { isJsonMode, printJson, printLine } from '../lib/output.js'
import { resolveProject } from '../lib/context.js'

export function registerAgents(program: Command): void {
  const agentsCmd = program
    .command('agents')
    .description('Track and inspect agent steering files (CLAUDE.md, AGENTS.md)')

  agentsCmd
    .command('list')
    .description('List tracked agent steering files for a project')
    .option('--project <id>', 'Project id')
    .action(async (opts: { project?: string }) => {
      const project = await resolveProject(opts.project)

      if (isJsonMode()) {
        printJson(project.agent_files ?? [])
        return
      }

      const files = project.agent_files ?? []
      if (files.length === 0) {
        printLine('No agent steering files tracked yet. Run `curaye sync` to detect them.')
        return
      }

      const pathWidth = Math.max(4, ...files.map((f: AgentFile) => f.path.length))
      printLine(`${'FILE'.padEnd(pathWidth)}  LAST CHANGED  HASH`)
      printLine(`${'-'.repeat(pathWidth)}  ------------  ----`)
      for (const f of files) {
        printLine(`${f.path.padEnd(pathWidth)}  ${f.last_changed}  ${f.last_seen_hash.slice(0, 20)}…`)
      }
    })

  agentsCmd
    .command('log')
    .description('Show agent file change log for a project')
    .option('--project <id>', 'Project id')
    .option('--since <date>', 'Show only entries from this date forward (YYYY-MM-DD)')
    .action(async (opts: { project?: string; since?: string }) => {
      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)

      const entries = await readAgentLog(curiyePath, opts.since)

      if (isJsonMode()) {
        printJson(entries.map(({ entry, body, filename }) => ({ ...entry, body, filename })))
        return
      }

      if (entries.length === 0) {
        printLine('No agent log entries found.')
        return
      }

      for (const { entry, body } of entries) {
        printLine(`${entry.date}  [${entry.change_type}]  ${entry.file}`)
        if (body) {
          for (const line of body.split('\n')) {
            printLine(`  ${line}`)
          }
        }
      }
    })

  agentsCmd
    .command('diff <date>')
    .description('Show the agent log entry and diff summary for a specific date')
    .option('--project <id>', 'Project id')
    .action(async (date: string, opts: { project?: string }) => {
      const project = await resolveProject(opts.project)
      const curiyePath = ProjectRegistry.curiyePath(project)

      const entries = await readAgentLog(curiyePath, date)
      const dayEntries = entries.filter((e) => e.entry.date === date)

      if (isJsonMode()) {
        printJson(dayEntries.map(({ entry, body }) => ({ ...entry, body })))
        return
      }

      if (dayEntries.length === 0) {
        printLine(`No agent log entries for ${date}.`)
        return
      }

      for (const { entry, body } of dayEntries) {
        printLine(`File: ${entry.file}`)
        printLine(`Change: ${entry.change_type}`)
        if (entry.previous_hash) printLine(`Previous hash: ${entry.previous_hash}`)
        if (entry.current_hash) printLine(`Current hash:  ${entry.current_hash}`)
        if (body) {
          printLine('')
          printLine(body)
        }
        printLine('')
      }
    })

  agentsCmd
    .command('detect')
    .description('Detect agent steering files in a project (without writing changes)')
    .option('--project <id>', 'Project id')
    .action(async (opts: { project?: string }) => {
      const project = await resolveProject(opts.project)
      const detected = await detectAgentFiles(project.path)

      if (isJsonMode()) {
        printJson(Object.fromEntries(detected))
        return
      }

      if (detected.size === 0) {
        printLine('No agent steering files found.')
        return
      }

      for (const [rel, hash] of detected) {
        printLine(`${rel}  ${hash.slice(0, 20)}…`)
      }
    })
}
