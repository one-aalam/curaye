import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import { select, isCancel, intro, outro, log } from '@clack/prompts'
import { ProjectRegistry, DriftDetector, SharedLayer } from '@curaye/core'
import type { DriftFinding, DriftReport } from '@curaye/core'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { resolveProject } from '../lib/context.js'

function classificationIcon(c: DriftFinding['classification']): string {
  switch (c) {
    case 'drift': return '⚠'
    case 'pending-update': return '⚠'
    case 'intentional-override': return '✓'
    case 'no-drift': return '✓'
  }
}

function printReport(report: DriftReport): void {
  const { findings, checkedCount, projectId } = report

  if (checkedCount === 0) {
    printLine(`${projectId}: Nothing to check (no adopted shared documents).`)
    return
  }

  printLine(`\nChecking ${projectId} against ${checkedCount} adopted shared document${checkedCount === 1 ? '' : 's'}…\n`)

  if (findings.length === 0) {
    printLine('  ✓  No drift detected.\n')
    return
  }

  for (const finding of findings) {
    const icon = classificationIcon(finding.classification)
    printLine(`  ${icon}  ${finding.docRef}`)
    if (finding.classification === 'drift' || finding.classification === 'pending-update') {
      printLine(`     ${finding.description}`)
      if (finding.hint) printLine(`     → ${finding.hint}`)
    }
    printLine('')
  }

  const driftCount = findings.filter((f) => f.classification === 'drift').length
  const pendingCount = findings.filter((f) => f.classification === 'pending-update').length
  const total = driftCount + pendingCount
  printLine(`${total} finding${total === 1 ? '' : 's'}. Run \`curaye check --fix${report.projectId ? ` --project ${report.projectId}` : ''}\` to address them interactively.`)
}

async function runFix(report: DriftReport, projectId: string): Promise<void> {
  const actionableFindings = report.findings.filter(
    (f) => f.classification === 'drift' || f.classification === 'pending-update',
  )

  if (actionableFindings.length === 0) {
    printLine('No actionable findings to fix.')
    return
  }

  for (const finding of actionableFindings) {
    printLine(`\n${finding.classification === 'drift' ? 'Potential drift' : 'Pending update'}: ${finding.description}`)
    printLine(`Document: ${finding.docRef}`)

    if (finding.classification === 'drift') {
      const choice = await select({
        message: 'How would you like to resolve this?',
        options: [
          { value: 'override', label: 'Record a local override decision (I diverged intentionally)' },
          { value: 'update', label: 'Open local content to update it (I missed this)' },
          { value: 'ignore', label: 'Ignore for now (remind me next check)' },
        ],
      })

      if (isCancel(choice)) {
        printLine('Aborted.')
        return
      }

      if (choice === 'ignore') {
        await DriftDetector.addIgnore(projectId, finding.sharedDocId)
        log.info(`Ignored ${finding.sharedDocId} until next sync.`)
      } else if (choice === 'override') {
        const project = await ProjectRegistry.find(projectId)
        if (project) {
          const decisionsDir = path.join(ProjectRegistry.curiyePath(project), 'decisions')
          await fs.mkdir(decisionsDir, { recursive: true })
          const today = new Date().toISOString().slice(0, 10)
          const id = `override-${finding.sharedDocId}`
          const filePath = path.join(decisionsDir, `${id}.md`)
          const content = `---
id: ${id}
title: "Override: ${finding.sharedDocId}"
status: active
superseded_by: ${finding.docRef}
created: ${today}
updated: ${today}
---

# Override: ${finding.sharedDocId}

> This project intentionally diverges from ${finding.docRef}.

## Why

Describe why this project diverges from the shared decision.
`
          try {
            await fs.access(filePath)
            log.warn(`Override file already exists at ${filePath}`)
          } catch {
            await fs.writeFile(filePath, content, 'utf8')
            log.success(`Created override decision at ${filePath}`)
          }
        }
      } else if (choice === 'update') {
        const editorEnv = process.env['EDITOR'] ?? process.env['VISUAL'] ?? 'vi'
        const project = await ProjectRegistry.find(projectId)
        if (project) {
          const stackPath = path.join(ProjectRegistry.curiyePath(project), 'stack.md')
          log.info(`Open ${stackPath} in your editor to update it.`)
        } else {
          log.info(`Update your local stack.md or decisions/ to match ${finding.docRef}.`)
        }
      }
    } else if (finding.classification === 'pending-update') {
      const choice = await select({
        message: 'How would you like to handle this pending update?',
        options: [
          { value: 'review', label: `Review the diff (curaye shared diff ${finding.sharedDocId})` },
          { value: 'mark', label: 'Mark as reviewed (accept the update)' },
          { value: 'ignore', label: 'Ignore for now (remind me next check)' },
        ],
      })

      if (isCancel(choice)) {
        printLine('Aborted.')
        return
      }

      if (choice === 'ignore') {
        await DriftDetector.addIgnore(projectId, finding.sharedDocId)
        log.info(`Ignored ${finding.sharedDocId} until next sync.`)
      } else if (choice === 'mark') {
        await SharedLayer.recordReview(finding.sharedDocId, projectId)
        await SharedLayer.markReviewed(finding.sharedDocId, projectId)
        log.success(`Marked ${finding.sharedDocId} as reviewed.`)
      } else if (choice === 'review') {
        const diffText = await SharedLayer.diff(finding.sharedDocId, projectId)
        if (diffText) {
          printLine('\n' + diffText + '\n')
        } else {
          printLine('No diff available.')
        }
      }
    }
  }
}

export function registerCheck(program: Command): void {
  program
    .command('check')
    .description('Check a project for drift against its adopted shared documents')
    .option('--project <id>', 'Project id')
    .option('--all', 'Check all registered projects')
    .option('--fix', 'Walk through findings interactively')
    .action(
      async (opts: { project?: string; all?: boolean; fix?: boolean }) => {
        if (!opts.all && !isJsonMode()) intro('curaye check')

        if (opts.all) {
          const reports = await DriftDetector.checkAll()

          if (isJsonMode()) {
            printJson(reports)
            const hasDrift = reports.some((r) => r.findings.some((f) => f.classification === 'drift'))
            if (hasDrift) process.exit(1)
            return
          }

          const allFindings: DriftReport[] = []
          for (const report of reports) {
            printReport(report)
            allFindings.push(report)
          }

          const hasDrift = allFindings.some((r) => r.findings.some((f) => f.classification === 'drift'))
          if (hasDrift) process.exit(1)
          return
        }

        const project = await resolveProject(opts.project)
        const report = await DriftDetector.checkProject(project)

        if (isJsonMode()) {
          printJson(report)
          const hasDrift = report.findings.some((f) => f.classification === 'drift')
          if (hasDrift) process.exit(1)
          return
        }

        if (report.checkedCount === 0) {
          printLine('Nothing to check. This project has no adopted shared documents.')
          printLine("Run 'curaye shared adopt <id> --project <id>' to adopt a shared document.")
          if (!opts.all) outro('Done.')
          return
        }

        printReport(report)

        if (opts.fix) {
          await runFix(report, project.id)
        }

        if (!opts.all) outro('Check complete.')

        const hasDrift = report.findings.some((f) => f.classification === 'drift')
        if (hasDrift) process.exit(1)
      },
    )
}
