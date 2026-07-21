import type { Command } from 'commander'
import os from 'os'
import path from 'path'
import { intro, outro, spinner } from '@clack/prompts'
import { ProjectRegistry } from '@curaye/core'
import {
  push,
  pull,
  pullAll,
  status as syncStatus,
  initSyncRepo,
  syncRegistry,
} from '@curaye/sync'
import type { SyncConfig } from '@curaye/sync'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { resolveProject } from '../lib/context.js'

const DEFAULT_LOCAL_REPO = path.join(os.homedir(), '.curaye', 'sync')

async function loadSyncConfig(): Promise<SyncConfig> {
  // For now, localRepo is always the default location.
  // The remote is read from the first project that has sync_remote set,
  // or from an environment variable.
  const envRemote = process.env['CURAYE_SYNC_REMOTE']
  if (envRemote) {
    return { remote: envRemote, localRepo: DEFAULT_LOCAL_REPO }
  }
  const projects = await ProjectRegistry.read()
  const withRemote = projects.find((p) => p.sync_remote)
  if (!withRemote?.sync_remote) {
    die(
      'No sync remote configured. Run `curaye sync init <remote-url>` to set up, or set CURAYE_SYNC_REMOTE.',
    )
  }
  return { remote: withRemote.sync_remote, localRepo: DEFAULT_LOCAL_REPO }
}

export function registerSync(program: Command): void {
  const syncCmd = program
    .command('sync')
    .description('Push or pull .curaye/ content to/from the sync remote')
    .option('--project <id>', 'Project id')
    .option('--all', 'Sync all registered projects')
    .option('--pull', 'Pull from remote')
    .option('--push', 'Push to remote (default)')
    .action(
      async (opts: { project?: string; all?: boolean; pull?: boolean; push?: boolean }) => {
        if (!isJsonMode()) intro('curaye sync')

        const config = await loadSyncConfig()
        const doPull = opts.pull === true && opts.push !== true

        if (opts.all) {
          const projects = await ProjectRegistry.read()
          if (projects.length === 0) die('No registered projects.')

          for (const project of projects) {
            const curiyePath = ProjectRegistry.curiyePath(project)
            const s = spinner()
            if (!isJsonMode()) s.start(`Syncing ${project.id}…`)
            try {
              if (doPull) {
                await pull(project.id, curiyePath, config)
              } else {
                await push(project.id, curiyePath, config)
              }
              if (!isJsonMode()) s.stop(`${project.id} synced`)
            } catch (err) {
              if (!isJsonMode()) s.stop(`${project.id} failed`)
              die(err instanceof Error ? err.message : String(err))
            }
          }

          await syncRegistry(projects, config)

          if (isJsonMode()) {
            printJson({ synced: projects.map((p) => p.id) })
          } else {
            outro('All projects synced.')
          }
          return
        }

        const project = await resolveProject(opts.project)
        const curiyePath = ProjectRegistry.curiyePath(project)

        const s = spinner()
        if (!isJsonMode()) s.start(`Syncing ${project.id}…`)

        try {
          if (doPull) {
            await pull(project.id, curiyePath, config)
          } else {
            await push(project.id, curiyePath, config)
          }
          if (!isJsonMode()) s.stop(`${project.id} synced`)
        } catch (err) {
          if (!isJsonMode()) s.stop('Sync failed')
          die(err instanceof Error ? err.message : String(err))
        }

        const projects = await ProjectRegistry.read()
        await syncRegistry(projects, config)

        if (isJsonMode()) {
          printJson({ synced: project.id })
        } else {
          outro(`Pushed ${project.id}`)
        }
      },
    )

  // sync status subcommand
  syncCmd
    .command('status')
    .description('Report ahead/behind/clean state of the sync repo vs remote')
    .action(async () => {
      const config = await loadSyncConfig()
      const result = await syncStatus(config)

      if (isJsonMode()) {
        printJson(result)
        return
      }

      switch (result.state) {
        case 'clean':
          printLine('Sync repo is up to date.')
          break
        case 'ahead':
          printLine(`Ahead by ${result.commits} commit(s). Run \`curaye sync\` to push.`)
          break
        case 'behind':
          printLine(`Behind by ${result.commits} commit(s). Run \`curaye sync --pull\` to update.`)
          break
        case 'diverged':
          printLine(`Diverged: ${result.ahead} ahead, ${result.behind} behind. Manual resolution required.`)
          break
        case 'no-remote':
          printLine('No remote configured. Run `curaye sync init <remote-url>`.')
          break
      }
    })

  // sync init subcommand
  syncCmd
    .command('init <remote-url>')
    .description('Clone or initialise the sync repo at ~/.curaye/sync/')
    .action(async (remoteUrl: string) => {
      if (!isJsonMode()) intro('curaye sync init')

      const config: SyncConfig = { remote: remoteUrl, localRepo: DEFAULT_LOCAL_REPO }

      const s = spinner()
      if (!isJsonMode()) s.start('Setting up sync repo…')

      try {
        await initSyncRepo(config)
        if (!isJsonMode()) s.stop('Sync repo ready')
      } catch (err) {
        if (!isJsonMode()) s.stop('Failed')
        die(err instanceof Error ? err.message : String(err))
      }

      // Persist remote on all registered projects
      const projects = await ProjectRegistry.read()
      for (const p of projects) {
        await ProjectRegistry.update(p.id, { sync_remote: remoteUrl })
      }

      if (isJsonMode()) {
        printJson({ remote: remoteUrl, localRepo: DEFAULT_LOCAL_REPO })
      } else {
        outro(`Sync repo initialised at ${DEFAULT_LOCAL_REPO}`)
      }
    })
}
