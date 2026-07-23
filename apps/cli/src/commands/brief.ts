import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import { scanProject } from '@curaye/core'
import { ProjectRegistry } from '@curaye/core'
import type { RegistryProject } from '@curaye/core'
import { readAiConfig, isAvailable, createProvider } from '@curaye/ai'
import type { PlannedFrontmatter, DecisionFrontmatter, CurrentFrontmatter } from '@curaye/protocol'
import type { ParsedDocument } from '@curaye/protocol'
import type { ProjectIndex } from '@curaye/core'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { resolveProject, today } from '../lib/context.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function latestActivityDate(index: ProjectIndex): string {
  const dates: string[] = []
  for (const doc of [...index.planned, ...index.current, ...index.shipped, ...index.decisions]) {
    const fm = doc.frontmatter as Record<string, unknown>
    const updated = fm['updated'] as string | undefined
    if (updated) dates.push(updated)
  }
  dates.sort()
  return dates[dates.length - 1] ?? 'unknown'
}

function timeAgo(dateStr: string): string {
  if (dateStr === 'unknown') return 'unknown'
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diffMs / 86_400_000)
  if (days < 1) return 'today'
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} ago`
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''} ago`
}

const STATUS_ORDER: Record<string, number> = { building: 0, ready: 1, draft: 2, done: 3, shelved: 4 }
const IMPACT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

function sortedActivePlanned(planned: ParsedDocument<PlannedFrontmatter>[]) {
  return [...planned]
    .filter((s) => s.frontmatter.status !== 'done' && s.frontmatter.status !== 'shelved')
    .sort((a, b) => (STATUS_ORDER[a.frontmatter.status] ?? 5) - (STATUS_ORDER[b.frontmatter.status] ?? 5))
}

function latestPlanned(planned: ParsedDocument<PlannedFrontmatter>[]): ParsedDocument<PlannedFrontmatter> | null {
  if (planned.length === 0) return null
  return [...planned].sort((a, b) => b.frontmatter.updated.localeCompare(a.frontmatter.updated))[0] ?? null
}

function suggestNext(planned: ParsedDocument<PlannedFrontmatter>[]): ParsedDocument<PlannedFrontmatter> | null {
  const building = planned.filter((s) => s.frontmatter.status === 'building')
  if (building.length > 0) return building[0] ?? null
  const ready = planned.filter((s) => s.frontmatter.status === 'ready')
  if (ready.length === 0) return null
  return ready.sort(
    (a, b) => (IMPACT_ORDER[a.frontmatter.impact ?? 'low'] ?? 3) - (IMPACT_ORDER[b.frontmatter.impact ?? 'low'] ?? 3),
  )[0] ?? null
}

// ── Deterministic brief ───────────────────────────────────────────────────────

function buildDeterministicBrief(projectName: string, index: ProjectIndex): string {
  const divider = '─────────────────────────────────────────'
  const lastDate = latestActivityDate(index)
  const ago = timeAgo(lastDate)

  const lines: string[] = [
    divider,
    `CURAYE  Re-entry Brief: ${projectName}`,
    `Last activity: ${ago} (${lastDate})`,
    divider,
    '',
    'CURRENT STATE',
  ]

  if (index.current.length === 0) {
    lines.push('  No current/ documents found.')
  } else {
    for (const doc of index.current) {
      const fm = doc.frontmatter as CurrentFrontmatter
      lines.push(`  ${fm.title}${fm.domain ? ` (${fm.domain})` : ''}`)
    }
  }

  lines.push('')
  lines.push('WHAT WAS PLANNED')

  const active = sortedActivePlanned(index.planned)
  if (active.length === 0) {
    lines.push('  No planned specs.')
  } else {
    for (const spec of active) {
      const fm = spec.frontmatter
      const statusPad = fm.status.padEnd(10)
      const effortLabel = `(${fm.effort})`
      lines.push(`  ${statusPad}  ${spec.id} ${effortLabel.padEnd(4)}  — ${fm.title}`)
    }
  }

  lines.push('')
  lines.push('WHERE YOU LEFT OFF')

  const latest = latestPlanned(index.planned)
  if (!latest) {
    lines.push('  No planned specs found.')
  } else {
    lines.push(`  Last touched: ${latest.id}, updated ${latest.frontmatter.updated}.`)
    lines.push(`  "${latest.frontmatter.title}"`)
  }

  lines.push('')
  lines.push('DECISIONS TO REVISIT')

  const superseded = index.decisions.filter(
    (d) => (d.frontmatter as DecisionFrontmatter).status === 'superseded',
  )
  if (superseded.length === 0) {
    lines.push('  No superseded decisions found.')
  } else {
    for (const d of superseded) {
      lines.push(`  ⚠  ${d.id} — ${(d.frontmatter as DecisionFrontmatter).title} (superseded)`)
    }
  }

  lines.push('')
  lines.push('SUGGESTED FIRST STEP')

  const next = suggestNext(index.planned)
  if (!next) {
    lines.push('  No planned specs to build next.')
  } else {
    const reason = next.frontmatter.status === 'building' ? 'already in progress' : `highest-impact ready spec`
    lines.push(`  Build ${next.id} — ${next.frontmatter.title}`)
    lines.push(`  Reason: ${reason}. Estimated effort: ${next.frontmatter.effort}.`)
  }

  lines.push('')
  lines.push('VISION CHECK')

  if (!index.root.prd) {
    lines.push('  No prd.md found — add one to enable vision alignment checks.')
  } else {
    const plannedCount = active.length
    if (plannedCount === 0) {
      lines.push('  prd.md found. No active planned specs — backlog may be complete.')
    } else {
      lines.push(`  prd.md found. ${plannedCount} active spec${plannedCount !== 1 ? 's' : ''} in the backlog.`)
      lines.push('  Run with AI enabled for a full alignment check.')
    }
  }

  lines.push(divider)
  return lines.join('\n')
}

// ── AI-enhanced brief ─────────────────────────────────────────────────────────

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch {
    return null
  }
}

async function buildAiBriefPrompt(projectName: string, curayePath: string, index: ProjectIndex): Promise<string> {
  const sections: string[] = [`# Context for Re-entry Brief: ${projectName}`, '']

  // Root docs
  const prd = await readFileIfExists(path.join(curayePath, 'prd.md'))
  const stack = await readFileIfExists(path.join(curayePath, 'stack.md'))
  if (prd) { sections.push('## PRD (North Star)'); sections.push(prd); sections.push('') }
  if (stack) { sections.push('## Stack'); sections.push(stack); sections.push('') }

  // Current docs
  if (index.current.length > 0) {
    sections.push('## Current State Documents')
    for (const doc of index.current) {
      sections.push(`### ${doc.id}`)
      sections.push(doc.body)
    }
    sections.push('')
  }

  // Planned specs
  sections.push('## Planned Specs')
  if (index.planned.length === 0) {
    sections.push('None.')
  } else {
    for (const spec of sortedActivePlanned(index.planned)) {
      const fm = spec.frontmatter
      sections.push(`- [${fm.status}] ${spec.id} (effort: ${fm.effort}, impact: ${fm.impact ?? 'unset'}) — ${fm.title} — updated: ${fm.updated}`)
    }
  }
  sections.push('')

  // Decisions
  if (index.decisions.length > 0) {
    sections.push('## Decisions')
    for (const doc of index.decisions) {
      const fm = doc.frontmatter as DecisionFrontmatter
      sections.push(`- [${fm.status}] ${doc.id} — ${fm.title}`)
    }
    sections.push('')
  }

  return sections.join('\n')
}

// ── Command ───────────────────────────────────────────────────────────────────

export function registerBrief(program: Command): void {
  program
    .command('brief')
    .description('Generate a re-entry brief for the current or specified project')
    .option('--project <id>', 'Project id')
    .option('--save', 'Save the brief to .curaye/briefs/YYYY-MM-DD.md')
    .option('--no-ai', 'Generate a deterministic brief without an AI provider')
    .action(async (opts: { project?: string; save?: boolean; ai?: boolean }) => {
      const useAi = opts.ai !== false

      let project: RegistryProject
      let curayePath: string

      try {
        project = await resolveProject(opts.project)
        curayePath = ProjectRegistry.curiyePath(project)
      } catch (err) {
        // Try cwd
        const cwd = process.cwd()
        curayePath = path.join(cwd, '.curaye')
        try {
          await fs.access(curayePath)
        } catch {
          die(err instanceof Error ? err.message : String(err))
        }
        project = { id: path.basename(cwd), name: path.basename(cwd), path: cwd, added: today() }
      }

      const index = await scanProject(curayePath)
      const projectName = project.name

      // Deterministic path
      if (!useAi) {
        const brief = buildDeterministicBrief(projectName, index)
        if (isJsonMode()) {
          printJson({ projectId: project.id, brief, mode: 'deterministic' })
        } else {
          printLine(brief)
        }
        if (opts.save) {
          await saveBrief(curayePath, brief, today())
        }
        return
      }

      // AI path
      const aiConfig = await readAiConfig()
      if (!aiConfig || !isAvailable(aiConfig)) {
        // Fall back to deterministic with a note
        const brief = buildDeterministicBrief(projectName, index)
        if (isJsonMode()) {
          printJson({ projectId: project.id, brief, mode: 'deterministic', note: 'No AI provider configured' })
        } else {
          printLine('No AI provider configured — generating deterministic brief.')
          printLine('')
          printLine(brief)
        }
        if (opts.save) {
          await saveBrief(curayePath, brief, today())
        }
        return
      }

      // Build prompt context
      const context = await buildAiBriefPrompt(projectName, curayePath, index)
      const lastDate = latestActivityDate(index)
      const ago = timeAgo(lastDate)

      const systemPrompt = `You are a developer tool that generates re-entry briefs. Your output follows a strict six-section format with NO preamble or explanation. Output ONLY the brief.`

      const userPrompt = `Generate a re-entry brief for the project "${projectName}" (last activity: ${ago}, ${lastDate}).

Use this context from the project's .curaye/ folder:

${context}

Output the brief in EXACTLY this format:

─────────────────────────────────────────
CURAYE  Re-entry Brief: ${projectName}
Last activity: ${ago} (${lastDate})
─────────────────────────────────────────

CURRENT STATE
[3–5 sentence summary of what the project does today, derived from the current/ documents above]

WHAT WAS PLANNED
[List of planned specs with their status, sorted: building first, then ready, then draft]

WHERE YOU LEFT OFF
[The most-recently-updated planned spec (by updated date) with a one-sentence summary of what it aims to do]

DECISIONS TO REVISIT
[List any decisions with status: superseded, and infer any that reference libraries or dependencies that commonly receive major updates. If none, say so clearly.]

SUGGESTED FIRST STEP
[Single recommendation: what to build next and why. If status: building exists, recommend it. Otherwise, recommend the highest-impact status: ready spec.]

VISION CHECK
[One sentence confirming whether the planned specs align with the PRD north star, or note that prd.md was not found.]
─────────────────────────────────────────

If there are no planned specs, say "No planned specs." explicitly in the WHAT WAS PLANNED section.`

      const provider = createProvider(aiConfig)

      if (isJsonMode()) {
        // In JSON mode, collect full response and return it
        const brief = await provider.complete([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ])
        printJson({ projectId: project.id, brief, mode: 'ai' })
        if (opts.save) {
          await saveBrief(curayePath, brief, today())
        }
      } else {
        // Stream to stdout
        let accumulated = ''
        for await (const chunk of provider.stream([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ])) {
          process.stdout.write(chunk)
          accumulated += chunk
        }
        process.stdout.write('\n')
        if (opts.save) {
          await saveBrief(curayePath, accumulated, today())
        }
      }
    })
}

async function saveBrief(curayePath: string, content: string, date: string): Promise<void> {
  const briefsDir = path.join(curayePath, 'briefs')
  await fs.mkdir(briefsDir, { recursive: true })
  const dest = path.join(briefsDir, `${date}.md`)
  const tmp = `${dest}.tmp`
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, dest)
  printLine(`\nBrief saved to ${dest}`)
}
