import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { execSync, spawnSync } from 'child_process'
import { intro, outro, log, confirm, multiselect, isCancel, spinner } from '@clack/prompts'
import { readAiConfig, isAvailable, createProvider } from '@curaye/ai'
import type { Provider } from '@curaye/ai'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'

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

interface ScaffoldResult {
  path: string
  starter_kit: StarterKitResult | null
  written: string[]
  directories: string[]
  patterns_applied: string[]
  git: { initialised: boolean; committed: boolean; sha: string } | null
}

// ---------------------------------------------------------------------------
// Shared stack detection
// ---------------------------------------------------------------------------

async function detectFromSharedStack(stackContent: string): Promise<{ name: string; command: string } | null> {
  const sharedStackDir = path.join(os.homedir(), '.curaye', 'shared', 'stack')
  let entries: string[]
  try {
    entries = await fs.readdir(sharedStackDir)
  } catch {
    return null
  }

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    const filePath = path.join(sharedStackDir, entry)
    const raw = await fs.readFile(filePath, 'utf8').catch(() => '')
    if (!raw) continue

    // Extract frontmatter body
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
    if (!fmMatch) continue
    const fm = fmMatch[1] ?? ''

    const kitMatch = fm.match(/^starter_kit:\s*(.+)$/m)
    const cmdMatch = fm.match(/^starter_kit_cmd:\s*(.+)$/m)
    if (!kitMatch || !cmdMatch) continue

    const name = kitMatch[1]!.trim()
    const command = cmdMatch[1]!.trim()

    // Check if stack.md content matches this shared doc's core content (case-insensitive)
    // Match by checking if the shared stack file's keywords appear in the project stack.md
    const sharedSignal = entry.replace(/\.md$/, '').toLowerCase()
    const stackLower = stackContent.toLowerCase()
    if (stackLower.includes(sharedSignal) || raw.toLowerCase().split('\n').slice(5).some((line) => stackLower.includes(line.trim().toLowerCase()) && line.trim().length > 5)) {
      return { name, command }
    }
  }
  return null
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
): Promise<{ result: StarterKitResult | null; generatorRan: boolean }> {
  if (noKit) {
    return { result: null, generatorRan: false }
  }

  // Detection order: shared stack first, then built-ins
  const sharedMatch = await detectFromSharedStack(stackContent)
  let generatorName: string
  let generatorCommand: string
  let source: 'shared-stack' | 'builtin'

  if (sharedMatch) {
    generatorName = sharedMatch.name
    generatorCommand = sharedMatch.command
    source = 'shared-stack'
  } else {
    const builtinMatch = detectFromBuiltins(stackContent)
    if (!builtinMatch) {
      return { result: null, generatorRan: false }
    }
    generatorName = builtinMatch.name
    generatorCommand = builtinMatch.command
    source = 'builtin'
  }

  // In JSON mode, skip interactive generator prompt
  if (isJsonMode()) {
    return {
      result: { name: generatorName, command: generatorCommand, source, exit_code: null, skipped: true },
      generatorRan: false,
    }
  }

  // Prompt user
  const stackSignal = generatorName.replace('create-', '').replace(/-app$/, '')
  printLine(`\n◆ Detected ${stackSignal} in stack.md`)
  printLine(`  Generator: ${generatorName}  (${generatorCommand})`)

  const shouldRun = await confirm({ message: 'Run it now?' })
  if (isCancel(shouldRun) || !shouldRun) {
    log.warn('Generator skipped — continuing to overlay phase.')
    return {
      result: { name: generatorName, command: generatorCommand, source, exit_code: null, skipped: true },
      generatorRan: false,
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

  return {
    result: { name: generatorName, command: generatorCommand, source, exit_code: exitCode },
    generatorRan: exitCode === 0,
  }
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

  // ── Phase 1 ──────────────────────────────────────────────────────────────
  if (!isJsonMode()) printLine('\nPhase 1 — Starter kit')

  if (hasStack) {
    const phase1 = await runStarterKit(stackContent, targetDir, options.noKit)
    starterKitResult = phase1.result
    generatorRan = phase1.generatorRan

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
