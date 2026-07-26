import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { execSync, spawnSync } from 'child_process'
import { intro, outro, log, confirm, multiselect, select, isCancel, spinner } from '@clack/prompts'
import { readAiConfig, isAvailable, createProvider } from '@curaye/ai'
import type { Provider } from '@curaye/ai'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { readAllPresets } from './toolkit.js'
import type { ToolkitPreset } from './toolkit.js'

// ---------------------------------------------------------------------------
// Built-in generator table
// ---------------------------------------------------------------------------

interface GeneratorEntry {
  signal: string[]
  name: string
  command: string
  /** For priority ordering: lower = higher priority */
  priority: number
}

const BUILTIN_GENERATORS: GeneratorEntry[] = [
  { signal: ['tauri'], name: 'create-tauri-app', command: 'npx create-tauri-app', priority: 1 },
  { signal: ['turborepo'], name: 'create-turbo', command: 'npx create-turbo', priority: 2 },
  { signal: ['opentui'], name: 'create-tui', command: 'npx @msmps/create-tui', priority: 3 },
  { signal: ['next.js', 'next '], name: 'create-next-app', command: 'npx create-next-app', priority: 4 },
  { signal: ['astro'], name: 'create-astro', command: 'npx create astro', priority: 5 },
  { signal: ['sveltekit'], name: 'create-svelte', command: 'npx sv create', priority: 6 },
  { signal: ['vite'], name: 'create-vite', command: 'npx create vite', priority: 7 },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StarterKitResult {
  name: string
  command: string
  source: 'shared-stack' | 'builtin'
  exit_code: number | null
  skipped?: boolean
}

interface ToolkitMatchInfo {
  id: string | null
  score: number
  source: 'preset' | 'builtin' | null
}

interface ScaffoldResult {
  path: string
  starter_kit: StarterKitResult | null
  written: string[]
  directories: string[]
  patterns_applied: string[]
  git: { initialised: boolean; committed: boolean; sha: string } | null
  toolkit_match: ToolkitMatchInfo
}

// ---------------------------------------------------------------------------
// Toolkit scoring
// ---------------------------------------------------------------------------

interface RuntimeGroup {
  id: string
  tokens: string[]
}

interface AppTypeGroup {
  id: string
  tokens: string[]
}

const RUNTIME_GROUPS: RuntimeGroup[] = [
  { id: 'node', tokens: ['node', 'npm', 'pnpm', 'yarn', 'bun'] },
  { id: 'rust', tokens: ['rust', 'cargo'] },
  { id: 'python', tokens: ['python', 'pip', 'uv', 'poetry'] },
  { id: 'go', tokens: ['go', 'golang'] },
  { id: 'bun', tokens: ['bun'] },
  { id: 'java', tokens: ['java', 'maven', 'gradle'] },
  { id: 'dotnet', tokens: ['.net', 'c#', 'dotnet'] },
  { id: 'ruby', tokens: ['ruby', 'bundler', 'rails'] },
]

const APP_TYPE_GROUPS: AppTypeGroup[] = [
  { id: 'desktop', tokens: ['tauri', 'electron'] },
  { id: 'web', tokens: ['next', 'astro', 'remix', 'sveltekit'] },
  { id: 'cli', tokens: ['cli', 'commander', 'clap', 'yargs', 'typer', 'cobra'] },
  { id: 'api', tokens: ['express', 'fastify', 'fastapi', 'axum', 'gin', 'hono'] },
  { id: 'mobile', tokens: ['react native', 'expo', 'flutter'] },
  { id: 'library', tokens: ['library', 'package', 'crate', 'gem'] },
]

function detectRuntimes(stackContent: string): string[] {
  const lower = stackContent.toLowerCase()
  return RUNTIME_GROUPS.filter((g) => g.tokens.some((t) => lower.includes(t))).map((g) => g.id)
}

function detectAppType(stackContent: string): string | null {
  const lower = stackContent.toLowerCase()
  const match = APP_TYPE_GROUPS.find((g) => g.tokens.some((t) => lower.includes(t)))
  return match?.id ?? null
}

interface ScoredPreset {
  preset: ToolkitPreset
  score: number
}

export function scorePresets(stackContent: string, presets: ToolkitPreset[]): ScoredPreset[] {
  const detectedRuntimes = detectRuntimes(stackContent)
  const detectedAppType = detectAppType(stackContent)
  const lower = stackContent.toLowerCase()

  return presets
    .map((preset) => {
      let score = 0

      if (preset.app_type && detectedAppType === preset.app_type) {
        score += 4
      }

      for (const rt of preset.runtime) {
        if (detectedRuntimes.includes(rt)) {
          score += 2
        }
      }

      for (const fw of preset.framework) {
        if (lower.includes(fw.toLowerCase())) {
          score += 2
        }
      }

      return { preset, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
}

async function detectFromSharedStack(stackContent: string): Promise<{ name: string; command: string; id: string; score: number; preset: ToolkitPreset } | null> {
  const presets = await readAllPresets()
  if (presets.length === 0) return null

  const scored = scorePresets(stackContent, presets)
  if (scored.length === 0) return null

  const bestScore = scored[0]!.score
  const topMatches = scored.filter((s) => s.score === bestScore)

  // Exactly one winner
  if (topMatches.length === 1) {
    const winner = topMatches[0]!.preset
    return {
      name: winner.starter_kit ?? winner.id,
      command: winner.starter_kit_cmd ?? '',
      id: winner.id,
      score: bestScore,
      preset: winner,
    }
  }

  // Multiple ties — return the first, caller handles interactive selection
  return {
    name: topMatches[0]!.preset.starter_kit ?? topMatches[0]!.preset.id,
    command: topMatches[0]!.preset.starter_kit_cmd ?? '',
    id: topMatches[0]!.preset.id,
    score: bestScore,
    preset: topMatches[0]!.preset,
    // Signal that there were ties by attaching them as a property
    ...(topMatches.length > 1 ? { _ties: topMatches } : {}),
  } as { name: string; command: string; id: string; score: number; preset: ToolkitPreset; _ties?: ScoredPreset[] }
}

function detectFromBuiltins(stackContent: string): GeneratorEntry | null {
  const lower = stackContent.toLowerCase()
  const matches = BUILTIN_GENERATORS.filter((g) => g.signal.some((s) => lower.includes(s)))
  if (matches.length === 0) return null
  // Sort by priority, return highest priority (lowest number)
  matches.sort((a, b) => a.priority - b.priority)
  return matches[0] ?? null
}

// ---------------------------------------------------------------------------
// Phase 1 — Starter kit
// ---------------------------------------------------------------------------

async function runStarterKit(
  stackContent: string,
  targetDir: string,
  noKit: boolean,
): Promise<{ result: StarterKitResult | null; generatorRan: boolean; toolkitMatch: ToolkitMatchInfo }> {
  const noMatch: ToolkitMatchInfo = { id: null, score: 0, source: null }

  if (noKit) {
    return { result: null, generatorRan: false, toolkitMatch: noMatch }
  }

  // Detection order: scored presets first, then built-ins
  const sharedMatch = await detectFromSharedStack(stackContent)
  let generatorName: string
  let generatorCommand: string
  let source: 'shared-stack' | 'builtin'
  let toolkitMatch: ToolkitMatchInfo
  let matchedPreset: ToolkitPreset | null = null

  if (sharedMatch) {
    // Check for ties — need to let user choose
    const allTies = (sharedMatch as { _ties?: ScoredPreset[] })['_ties']
    let chosenMatch = sharedMatch

    if (allTies && allTies.length > 1 && !isJsonMode()) {
      printLine('\n◆ Multiple toolkit presets matched with equal score:')
      const choiceResult = await select({
        message: 'Choose a preset',
        options: allTies.map((s) => ({
          value: s.preset.id,
          label: `${s.preset.id} — ${s.preset.title}${s.preset.starter_kit ? ` (${s.preset.starter_kit})` : ' (no starter kit)'}`,
        })),
      })
      if (isCancel(choiceResult)) {
        return { result: null, generatorRan: false, toolkitMatch: noMatch }
      }
      const chosen = allTies.find((s) => s.preset.id === (choiceResult as string))
      if (chosen) {
        chosenMatch = {
          name: chosen.preset.starter_kit ?? chosen.preset.id,
          command: chosen.preset.starter_kit_cmd ?? '',
          id: chosen.preset.id,
          score: chosen.score,
          preset: chosen.preset,
        }
      }
    }

    generatorName = chosenMatch.name
    generatorCommand = chosenMatch.command
    source = 'shared-stack'
    matchedPreset = chosenMatch.preset
    toolkitMatch = { id: chosenMatch.id, score: chosenMatch.score, source: 'preset' }
  } else {
    const builtinMatch = detectFromBuiltins(stackContent)
    if (!builtinMatch) {
      return { result: null, generatorRan: false, toolkitMatch: noMatch }
    }
    generatorName = builtinMatch.name
    generatorCommand = builtinMatch.command
    source = 'builtin'
    toolkitMatch = { id: null, score: 0, source: 'builtin' }
  }

  // In JSON mode, skip interactive generator prompt
  if (isJsonMode()) {
    return {
      result: { name: generatorName, command: generatorCommand, source, exit_code: null, skipped: true },
      generatorRan: false,
      toolkitMatch,
    }
  }

  // Preset match prompt: "Use preset X? [y/n]" (when single best match from presets)
  if (source === 'shared-stack' && !(sharedMatch as { _ties?: ScoredPreset[] })['_ties']) {
    printLine(`\n◆ Toolkit preset match: ${matchedPreset?.title ?? generatorName} (score: ${toolkitMatch.score})`)
    if (generatorCommand) {
      printLine(`  Starter kit: ${generatorName}  (${generatorCommand})`)
    } else {
      printLine(`  (no starter kit configured — overlay phase will still run)`)
    }

    if (generatorCommand) {
      const use = await confirm({ message: `Use preset ${matchedPreset?.id ?? generatorName}?` })
      if (isCancel(use) || !use) {
        log.warn('Preset skipped — falling back to built-in detection.')
        const builtinMatch = detectFromBuiltins(stackContent)
        if (!builtinMatch) {
          return { result: null, generatorRan: false, toolkitMatch: { id: null, score: 0, source: null } }
        }
        generatorName = builtinMatch.name
        generatorCommand = builtinMatch.command
        source = 'builtin'
        toolkitMatch = { id: null, score: 0, source: 'builtin' }
        matchedPreset = null
      }
    }
  } else if (source === 'shared-stack') {
    // Tie was resolved interactively above; just show what was chosen
    if (generatorCommand) {
      printLine(`\n◆ Using preset: ${generatorName}  (${generatorCommand})`)
    } else {
      printLine(`\n◆ Using preset: ${generatorName}  (no starter kit configured)`)
    }
  } else {
    // Built-in match
    const stackSignal = generatorName.replace('create-', '').replace(/-app$/, '')
    printLine(`\n◆ Detected ${stackSignal} in stack.md`)
    printLine(`  Generator: ${generatorName}  (${generatorCommand})`)
  }

  if (!generatorCommand) {
    log.warn('No starter kit command — skipping to overlay phase.')
    return {
      result: { name: generatorName, command: '', source, exit_code: null, skipped: true },
      generatorRan: false,
      toolkitMatch,
    }
  }

  const shouldRun = await confirm({ message: 'Run it now?' })
  if (isCancel(shouldRun) || !shouldRun) {
    log.warn('Generator skipped — continuing to overlay phase.')
    // Still write NEXT_STEPS.md if the preset has design_system/tools
    if (matchedPreset && (matchedPreset.design_system || Object.keys(matchedPreset.tools).length > 0)) {
      await writeNextSteps(targetDir, matchedPreset)
    }
    return {
      result: { name: generatorName, command: generatorCommand, source, exit_code: null, skipped: true },
      generatorRan: false,
      toolkitMatch,
    }
  }

  // Build spawn args — append target dir as last positional arg
  const parts = generatorCommand.split(' ')
  const cmd = parts[0]!
  const args = [...parts.slice(1), './']

  printLine('')
  const childResult = spawnSync(cmd, args, {
    cwd: targetDir,
    stdio: 'inherit',
    shell: true,
  })

  const exitCode = childResult.status ?? 1

  if (exitCode !== 0) {
    log.warn(`Generator exited with code ${exitCode} — continuing to overlay phase.`)
  } else {
    log.step('Generator complete')
  }

  // Write NEXT_STEPS.md if preset has design_system or tools
  if (matchedPreset && (matchedPreset.design_system || Object.keys(matchedPreset.tools).length > 0)) {
    await writeNextSteps(targetDir, matchedPreset)
  }

  return {
    result: { name: generatorName, command: generatorCommand, source, exit_code: exitCode },
    generatorRan: exitCode === 0,
    toolkitMatch,
  }
}

// ---------------------------------------------------------------------------
// NEXT_STEPS.md
// ---------------------------------------------------------------------------

async function writeNextSteps(targetDir: string, preset: ToolkitPreset): Promise<void> {
  const nextStepsPath = path.join(targetDir, 'NEXT_STEPS.md')
  const already = await fs.access(nextStepsPath).then(() => true).catch(() => false)
  if (already) return

  const lines: string[] = [
    '# Next steps',
    '',
    'Complete these after your initial install:',
    '',
    '## Install',
    '',
    '```sh',
    'pnpm install       # or npm install / cargo build',
    '```',
  ]

  if (preset.design_system) {
    lines.push('')
    lines.push('## Design system')
    lines.push('')
    lines.push('```sh')
    // Derive a best-effort install command from the design system name
    const ds = preset.design_system.toLowerCase()
    if (ds.includes('shadcn')) {
      lines.push('npx shadcn@latest init')
    } else {
      lines.push(`# Set up ${preset.design_system}`)
    }
    lines.push('```')
  }

  const toolEntries = Object.entries(preset.tools).filter(([, v]) => v)
  if (toolEntries.length > 0) {
    lines.push('')
    lines.push('## Tools')
    lines.push('')
    lines.push('| Role | Tool |')
    lines.push('|---|---|')
    const roleLabel: Record<string, string> = { formatter: 'Formatter', linter: 'Linter', test: 'Tests', e2e: 'E2E' }
    for (const [role, tool] of toolEntries) {
      lines.push(`| ${roleLabel[role] ?? role} | ${tool} |`)
    }

    // Playwright hint
    if (preset.tools.e2e?.toLowerCase().includes('playwright')) {
      lines.push('')
      lines.push('Run `npx playwright install` to install browser binaries.')
    }
  }

  lines.push('')
  await fs.writeFile(nextStepsPath, lines.join('\n'), 'utf8')
  log.step('NEXT_STEPS.md written')
}

// ---------------------------------------------------------------------------
// Phase 2 — Overlay
// ---------------------------------------------------------------------------

async function readSharedPatterns(): Promise<Array<{ id: string; title: string; directories: string[]; filePath: string }>> {
  const dir = path.join(os.homedir(), '.curaye', 'shared', 'patterns')
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }

  const results: Array<{ id: string; title: string; directories: string[]; filePath: string }> = []
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    const filePath = path.join(dir, entry)
    const raw = await fs.readFile(filePath, 'utf8').catch(() => '')
    if (!raw) continue

    const id = entry.replace(/\.md$/, '')
    const titleMatch = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m)
    const title = titleMatch?.[1] ?? id

    const dirsMatch = raw.match(/^directories:\s*\[([^\]]*)\]/m)
    let directories: string[] = []
    if (dirsMatch) {
      directories = dirsMatch[1]!.split(',').map((d) => d.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
    }

    results.push({ id, title, directories, filePath })
  }
  return results
}

async function readSharedAgents(): Promise<Array<{ name: string; filePath: string }>> {
  const dir = path.join(os.homedir(), '.curaye', 'shared', 'agents')
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }

  return entries
    .filter((e) => e.endsWith('.md'))
    .map((e) => ({ name: e, filePath: path.join(dir, e) }))
}

function detectFallbackDirs(stackContent: string, projectSlug: string): string[] {
  const lower = stackContent.toLowerCase()

  if (lower.includes('tauri')) return ['src', 'src-tauri']
  if (lower.includes('react') || lower.includes('next.js') || lower.includes('next ') || lower.includes('vite') || lower.includes('astro')) return ['src', 'public']
  if (lower.includes('node') || lower.includes('express') || lower.includes('fastify')) return ['src']
  if (lower.includes('cli') || lower.includes('commander') || lower.includes('yargs')) return ['src', 'bin']
  if (lower.includes('python') || lower.includes('fastapi') || lower.includes('flask')) return [projectSlug, 'tests']
  if (lower.includes('rust')) return ['src']
  if (lower.includes('go')) return ['cmd', 'internal']
  return ['src']
}

function detectGitignoreContent(stackContent: string): string {
  const lower = stackContent.toLowerCase()
  const lines = ['.DS_Store', '.env', '.env.*']

  if (lower.includes('node') || lower.includes('react') || lower.includes('next') || lower.includes('tauri') || lower.includes('vite') || lower.includes('astro')) {
    lines.push('node_modules/')
  }
  if (lower.includes('tauri') || lower.includes('rust')) {
    lines.push('target/')
  }
  if (lower.includes('python') || lower.includes('fastapi') || lower.includes('flask')) {
    lines.push('__pycache__/', '*.pyc', '.venv/', 'venv/')
  }
  if (lower.includes('go')) {
    lines.push('*.exe', '*.out')
  }

  return lines.join('\n') + '\n'
}

async function generateReadme(
  curayePath: string,
  provider: Provider | null,
): Promise<string> {
  const prdPath = path.join(curayePath, 'prd.md')
  const stackPath = path.join(curayePath, 'stack.md')
  const productPath = path.join(curayePath, 'product.md')

  const prdContent = await fs.readFile(prdPath, 'utf8').catch(() => '')
  const stackContent = await fs.readFile(stackPath, 'utf8').catch(() => '')
  const productContent = await fs.readFile(productPath, 'utf8').catch(() => '')

  // Extract project name from directory (parent of .curaye)
  const projectDir = path.dirname(curayePath)
  const projectName = path.basename(projectDir)

  // Extract description from prd.md — first blockquote or opening paragraph
  const blockquoteMatch = prdContent.match(/^>\s*(.+)$/m)
  const description = blockquoteMatch?.[1] ?? `${projectName} project`

  // Extract stack signal for display
  const stackLower = stackContent.toLowerCase()
  let stackDisplay = 'Unknown'
  if (stackLower.includes('tauri')) stackDisplay = 'Tauri + Rust'
  else if (stackLower.includes('next.js') || stackLower.includes('next ')) stackDisplay = 'Next.js'
  else if (stackLower.includes('react')) stackDisplay = 'React'
  else if (stackLower.includes('astro')) stackDisplay = 'Astro'
  else if (stackLower.includes('vite')) stackDisplay = 'Vite'
  else if (stackLower.includes('sveltekit')) stackDisplay = 'SvelteKit'
  else if (stackLower.includes('node')) stackDisplay = 'Node.js'
  else if (stackLower.includes('python')) stackDisplay = 'Python'
  else if (stackLower.includes('go')) stackDisplay = 'Go'
  else if (stackLower.includes('rust')) stackDisplay = 'Rust'

  // Extract platform from product.md
  const platformMatch = productContent.match(/platform:\s*(.+)/i)
  const platform = platformMatch?.[1]?.trim() ?? ''

  let overview: string

  if (provider) {
    try {
      const body = await provider.complete(
        [
          {
            role: 'user',
            content: `Write a 2-3 sentence project overview for a README based on this product requirements doc:\n\n${prdContent}\n\nBe concise and direct. Output only the prose — no headings, no bullets, no frontmatter.`,
          },
        ],
        { maxTokens: 200, temperature: 0.4 },
      )
      overview = body.trim()
    } catch {
      overview = `${description} ${platform ? `Targets ${platform}.` : ''}`
    }
  } else {
    overview = `${description} ${platform ? `Targets ${platform}.` : ''}`
  }

  return `# ${projectName}

> ${description}

## Overview

${overview}

## Stack

${stackDisplay}

## Getting started

_Add setup instructions here._
`
}

// ---------------------------------------------------------------------------
// Phase 3 — Git
// ---------------------------------------------------------------------------

function gitInPath(): boolean {
  try {
    execSync('git --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function gitIdentityConfigured(): boolean {
  try {
    const name = execSync('git config user.name', { stdio: 'pipe' }).toString().trim()
    const email = execSync('git config user.email', { stdio: 'pipe' }).toString().trim()
    return name.length > 0 && email.length > 0
  } catch {
    return false
  }
}

function runGitPhase(targetDir: string): { initialised: boolean; committed: boolean; sha: string } {
  execSync('git init', { cwd: targetDir, stdio: 'pipe' })
  execSync('git add -A', { cwd: targetDir, stdio: 'pipe' })
  execSync('git commit -m "chore: init project with curaye scaffold"', { cwd: targetDir, stdio: 'pipe' })
  const sha = execSync('git rev-parse --short HEAD', { cwd: targetDir, stdio: 'pipe' }).toString().trim()
  return { initialised: true, committed: true, sha }
}

// ---------------------------------------------------------------------------
// Core scaffold logic (reusable by bootstrap --scaffold)
// ---------------------------------------------------------------------------

export interface ScaffoldOptions {
  git: boolean
  noKit: boolean
}

export async function runScaffold(targetDir: string, options: ScaffoldOptions): Promise<ScaffoldResult> {
  const curayePath = path.join(targetDir, '.curaye')
  const stackPath = path.join(curayePath, 'stack.md')

  // Guard: .curaye/ must exist
  try {
    await fs.access(curayePath)
  } catch {
    die(`No .curaye/ found at ${targetDir}. Run curaye init or curaye bootstrap first.`)
  }

  // AC #22 — git identity check before any work
  if (options.git) {
    if (!gitInPath()) {
      // Warn and clear the flag — handled later, just note here
    } else if (!gitIdentityConfigured()) {
      die('git user.name and user.email must be configured before committing.')
    }
  }

  // Read stack.md
  let stackContent = ''
  const hasStack = await fs.access(stackPath).then(() => true).catch(() => false)
  if (!hasStack) {
    log.warn('No stack.md found — writing README stub only.')
  } else {
    stackContent = await fs.readFile(stackPath, 'utf8')
  }

  const written: string[] = []
  const directories: string[] = []
  const patternsApplied: string[] = []
  let starterKitResult: StarterKitResult | null = null
  let generatorRan = false
  let toolkitMatch: ToolkitMatchInfo = { id: null, score: 0, source: null }

  // ── Phase 1 ──────────────────────────────────────────────────────────────
  if (!isJsonMode()) printLine('\nPhase 1 — Starter kit')

  if (hasStack) {
    const phase1 = await runStarterKit(stackContent, targetDir, options.noKit)
    starterKitResult = phase1.result
    generatorRan = phase1.generatorRan
    toolkitMatch = phase1.toolkitMatch

    if (options.noKit && !isJsonMode()) {
      log.step('--no-kit: starter kit phase skipped')
    } else if (!starterKitResult && !isJsonMode()) {
      log.step('No generator match — skipping to overlay')
    }
  } else if (!isJsonMode()) {
    log.step('No stack.md — skipping starter kit')
  }

  // ── Phase 2 ──────────────────────────────────────────────────────────────
  if (!isJsonMode()) printLine('\nPhase 2 — Overlay')

  // AI provider
  const aiConfig = await readAiConfig()
  let provider: Provider | null = null
  if (aiConfig && isAvailable(aiConfig)) {
    provider = createProvider(aiConfig)
  }

  // README.md — written if absent
  const readmePath = path.join(targetDir, 'README.md')
  const readmeExists = await fs.access(readmePath).then(() => true).catch(() => false)
  if (!readmeExists) {
    const s = spinner()
    if (!isJsonMode()) s.start(provider ? 'Generating README.md with AI…' : 'Writing README.md…')
    const readmeContent = await generateReadme(curayePath, provider)
    await fs.writeFile(readmePath, readmeContent, 'utf8')
    if (!isJsonMode()) s.stop('README.md written')
    written.push('README.md')
  }

  // Shared patterns (skipped in JSON mode — interactive)
  const patterns = await readSharedPatterns()
  if (patterns.length > 0 && !isJsonMode()) {
    const selection = await multiselect({
      message: 'Shared patterns — select any that apply (space to toggle, enter to confirm)',
      options: patterns.map((p) => ({ value: p.id, label: p.title })),
      required: false,
    })
    if (!isCancel(selection)) {
      const selected = selection as string[]
      for (const id of selected) {
        const pattern = patterns.find((p) => p.id === id)
        if (!pattern) continue
        patternsApplied.push(id)
        for (const dir of pattern.directories) {
          const dirPath = path.join(targetDir, dir)
          const exists = await fs.access(dirPath).then(() => true).catch(() => false)
          if (!exists) {
            await fs.mkdir(dirPath, { recursive: true })
            await fs.writeFile(path.join(dirPath, '.gitkeep'), '', 'utf8')
            directories.push(dir)
            if (!isJsonMode()) log.step(`Pattern applied: ${id}  (${dir}/)`)
          } else if (!isJsonMode()) {
            log.step(`${dir}/ already exists — skipped`)
          }
        }
        if (pattern.directories.length === 0 && !isJsonMode()) {
          log.step(`Pattern applied: ${id}  (no directories defined)`)
        }
      }
    }
  }

  // Fallback directory skeleton — only when Phase 1 produced no generator output AND stack.md exists.
  // When stack.md is absent, AC #20 says "README stub only; skip all directory/generator detection".
  const needsFallback = !generatorRan && hasStack
  if (needsFallback) {
    const projectSlug = path.basename(targetDir).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const fallbackDirs = detectFallbackDirs(stackContent, projectSlug)
    for (const dir of fallbackDirs) {
      const dirPath = path.join(targetDir, dir)
      const exists = await fs.access(dirPath).then(() => true).catch(() => false)
      if (!exists) {
        await fs.mkdir(dirPath, { recursive: true })
        await fs.writeFile(path.join(dirPath, '.gitkeep'), '', 'utf8')
        directories.push(dir)
        if (!isJsonMode()) log.step(`Created ${dir}/`)
      } else if (!isJsonMode()) {
        log.step(`${dir}/ already exists — skipped`)
      }
    }
  }

  // Shared agents
  const agents = await readSharedAgents()
  for (const agent of agents) {
    const destPath = path.join(targetDir, agent.name)
    const exists = await fs.access(destPath).then(() => true).catch(() => false)
    if (!exists) {
      const content = await fs.readFile(agent.filePath, 'utf8')
      await fs.writeFile(destPath, content, 'utf8')
      written.push(agent.name)
      if (!isJsonMode()) log.step(`Agent file copied: ${agent.name}`)
    } else if (!isJsonMode()) {
      log.step(`${agent.name} already exists — skipped`)
    }
  }

  // .gitignore — only when --git and not already present
  let gitResult: { initialised: boolean; committed: boolean; sha: string } | null = null
  if (options.git) {
    const gitignorePath = path.join(targetDir, '.gitignore')
    const gitignoreExists = await fs.access(gitignorePath).then(() => true).catch(() => false)
    if (!gitignoreExists) {
      await fs.writeFile(gitignorePath, detectGitignoreContent(stackContent), 'utf8')
      written.push('.gitignore')
      if (!isJsonMode()) log.step('.gitignore written')
    }
  }

  // ── Phase 3 ──────────────────────────────────────────────────────────────
  if (options.git) {
    if (!isJsonMode()) printLine('\nPhase 3 — Git')

    if (!gitInPath()) {
      log.warn('git not found in PATH — skipping Phase 3.')
    } else {
      try {
        gitResult = runGitPhase(targetDir)
        if (!isJsonMode()) {
          log.step('git init')
          log.step(`Initial commit: chore: init project with curaye scaffold  (${gitResult.sha})`)
        }
      } catch (err) {
        log.warn(`Git phase failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  const result: ScaffoldResult = {
    path: targetDir,
    starter_kit: starterKitResult,
    written,
    directories,
    patterns_applied: patternsApplied,
    git: gitResult,
    toolkit_match: toolkitMatch,
  }

  return result
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerScaffold(program: Command): void {
  program
    .command('scaffold [path]')
    .description('Scaffold a working project from .curaye/ (starter kit, overlay, git)')
    .option('--git', 'Run git init + initial commit after all phases')
    .option('--no-kit', 'Skip starter kit phase; go straight to overlay')
    .action(async (targetPath: string | undefined, opts: { git?: boolean; noKit?: boolean }) => {
      const resolvedPath = path.resolve(targetPath ?? process.cwd())

      // Create target directory if it doesn't exist
      await fs.mkdir(resolvedPath, { recursive: true })

      if (!isJsonMode()) intro('curaye scaffold')

      const result = await runScaffold(resolvedPath, {
        git: opts.git ?? false,
        noKit: opts.noKit ?? false,
      })

      if (isJsonMode()) {
        printJson(result)
      } else {
        printLine('')
        outro('Done.')
      }
    })
}
