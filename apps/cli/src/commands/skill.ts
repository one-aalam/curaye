import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import { fileURLToPath } from 'url'
import os from 'os'
import { isJsonMode, printJson, printLine } from '../lib/output.js'

const VERSION_RE = /^<!-- curaye-skill: (v[\d.]+) -->/

type SkillName =
  | 'curaye-build'
  | 'curaye-ship'
  | 'curaye-brief'
  | 'curaye-bootstrap'
  | 'curaye-import'
  | 'curaye-check'

const SKILL_NAMES: readonly SkillName[] = [
  'curaye-build',
  'curaye-ship',
  'curaye-brief',
  'curaye-bootstrap',
  'curaye-import',
  'curaye-check',
]

function describeSkill(name: SkillName): string {
  switch (name) {
    case 'curaye-build':
      return 'Build a spec to acceptance criteria'
    case 'curaye-ship':
      return 'Graduate a completed spec'
    case 'curaye-brief':
      return 'Generate a re-entry brief'
    case 'curaye-bootstrap':
      return 'Bootstrap a new project'
    case 'curaye-import':
      return 'Import an existing project'
    case 'curaye-check':
      return 'Detect and resolve shared layer drift'
  }
}

function getSkillsDir(): string {
  const thisFile = fileURLToPath(import.meta.url)
  // compiled to dist/commands/skill.js; skills/ is at ../../skills/ from here
  return path.resolve(path.dirname(thisFile), '..', '..', 'skills')
}

function defaultTargetDir(): string {
  return path.join(os.homedir(), '.claude', 'commands')
}

function extractVersion(content: string): string | null {
  const firstLine = content.split('\n')[0] ?? ''
  const match = VERSION_RE.exec(firstLine)
  return match?.[1] ?? null
}

async function readInstalledVersion(targetDir: string, name: SkillName): Promise<string | null> {
  try {
    const content = await fs.readFile(path.join(targetDir, `${name}.md`), 'utf8')
    return extractVersion(content)
  } catch {
    return null
  }
}

async function readAvailableVersion(skillsDir: string, name: SkillName): Promise<string> {
  const content = await fs.readFile(path.join(skillsDir, `${name}.md`), 'utf8')
  return extractVersion(content) ?? 'unknown'
}

export function registerSkill(program: Command): void {
  const skillCmd = program.command('skill').description('Manage Curaye Claude Code skills')

  skillCmd
    .command('install')
    .description('Install Curaye skills to ~/.claude/commands/')
    .option('--update', 'Overwrite existing skill files with the current version')
    .option('--list', 'Show installed skills and their version status')
    .option('--path <dir>', 'Install to a custom directory instead of ~/.claude/commands/')
    .action(async (opts: { update?: boolean; list?: boolean; path?: string }) => {
      const skillsDir = getSkillsDir()
      const targetDir = opts.path ?? defaultTargetDir()

      if (opts.list) {
        const rows = await Promise.all(
          SKILL_NAMES.map(async (name) => ({
            name,
            installed: await readInstalledVersion(targetDir, name),
            available: await readAvailableVersion(skillsDir, name),
          })),
        )

        if (isJsonMode()) {
          printJson(
            rows.map((r) => ({
              name: r.name,
              installed: r.installed,
              available: r.available,
              current: r.installed === r.available,
            })),
          )
          return
        }

        const col1 = 22
        const col2 = 13
        printLine(
          `\n${'Skill'.padEnd(col1)}${'Installed'.padEnd(col2)}Available`,
        )
        printLine('─'.repeat(col1 + col2 + 18))
        for (const row of rows) {
          const installed = row.installed ?? '—'
          const status =
            row.installed === null
              ? '(not installed)'
              : row.installed === row.available
                ? '✓'
                : '← update available'
          printLine(
            `${row.name.padEnd(col1)}${installed.padEnd(col2)}${row.available}  ${status}`,
          )
        }
        printLine('')
        return
      }

      // ensure target directory exists (criterion 9: creates ~/.claude/ if absent)
      await fs.mkdir(targetDir, { recursive: true })

      type InstallAction = 'installed' | 'updated' | 'skipped'
      const results: Array<{ name: SkillName; action: InstallAction }> = []

      for (const name of SKILL_NAMES) {
        const srcPath = path.join(skillsDir, `${name}.md`)
        const destPath = path.join(targetDir, `${name}.md`)

        let exists = false
        try {
          await fs.access(destPath)
          exists = true
        } catch {
          // file does not exist yet
        }

        if (exists && !opts.update) {
          results.push({ name, action: 'skipped' })
          continue
        }

        const content = await fs.readFile(srcPath, 'utf8')
        await fs.writeFile(destPath, content, 'utf8')
        results.push({ name, action: exists ? 'updated' : 'installed' })
      }

      const allSkipped = results.every((r) => r.action === 'skipped')

      if (isJsonMode()) {
        printJson({
          installed: results.filter((r) => r.action === 'installed').map((r) => r.name),
          updated: results.filter((r) => r.action === 'updated').map((r) => r.name),
          skipped: results.filter((r) => r.action === 'skipped').map((r) => r.name),
          targetDir,
        })
        return
      }

      if (allSkipped) {
        printLine('Already installed. Use --update to upgrade.')
        return
      }

      const installedCount = results.filter((r) => r.action === 'installed').length
      const updatedCount = results.filter((r) => r.action === 'updated').length
      const count = installedCount + updatedCount
      const verb = installedCount === 0 ? 'Updated' : 'Installed'

      printLine(`\n${verb} ${count} skill${count === 1 ? '' : 's'} to ${targetDir}\n`)
      for (const { name, action } of results) {
        if (action !== 'skipped') {
          printLine(`  /${name.padEnd(18)} ${describeSkill(name)}`)
        }
      }
      printLine('')
    })
}
