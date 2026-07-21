import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { intro, outro, confirm, isCancel, spinner, log } from '@clack/prompts'
import { ProjectRegistry } from '@curaye/core'
import { readAiConfig, isAvailable, createProvider } from '@curaye/ai'
import type { Provider } from '@curaye/ai'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { today } from '../lib/context.js'

const execFileAsync = promisify(execFile)

const REQUIRED_DIRS = ['planned', 'current', 'shipped', 'decisions']

// ---------------------------------------------------------------------------
// Project type detection
// ---------------------------------------------------------------------------

interface ProjectManifest {
  type: 'node' | 'rust' | 'python' | 'go' | 'unknown'
  name: string
  description: string
  framework: string
  keyDeps: string[]
  scripts: Record<string, string>
  raw: string
}

async function detectProject(projectPath: string): Promise<ProjectManifest> {
  // Node
  try {
    const pkgRaw = await fs.readFile(path.join(projectPath, 'package.json'), 'utf8')
    const pkg = JSON.parse(pkgRaw) as {
      name?: string
      description?: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      scripts?: Record<string, string>
    }
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
    const framework = detectNodeFramework(allDeps)
    return {
      type: 'node',
      name: pkg.name ?? path.basename(projectPath),
      description: pkg.description ?? '',
      framework,
      keyDeps: Object.keys(allDeps).slice(0, 20),
      scripts: pkg.scripts ?? {},
      raw: pkgRaw,
    }
  } catch {
    // not node
  }

  // Rust
  try {
    const raw = await fs.readFile(path.join(projectPath, 'Cargo.toml'), 'utf8')
    const nameMatch = raw.match(/^name\s*=\s*"([^"]+)"/m)
    const descMatch = raw.match(/^description\s*=\s*"([^"]+)"/m)
    return {
      type: 'rust',
      name: nameMatch?.[1] ?? path.basename(projectPath),
      description: descMatch?.[1] ?? '',
      framework: 'rust',
      keyDeps: extractCargoKeys(raw),
      scripts: {},
      raw,
    }
  } catch {
    // not rust
  }

  // Python
  try {
    const raw = await fs.readFile(path.join(projectPath, 'pyproject.toml'), 'utf8')
    const nameMatch = raw.match(/^name\s*=\s*"([^"]+)"/m)
    return {
      type: 'python',
      name: nameMatch?.[1] ?? path.basename(projectPath),
      description: '',
      framework: 'python',
      keyDeps: [],
      scripts: {},
      raw,
    }
  } catch {
    // not python
  }

  return {
    type: 'unknown',
    name: path.basename(projectPath),
    description: '',
    framework: 'unknown',
    keyDeps: [],
    scripts: {},
    raw: '',
  }
}

function detectNodeFramework(deps: Record<string, string>): string {
  if ('tauri' in deps || '@tauri-apps/api' in deps || '@tauri-apps/cli' in deps) return 'Tauri'
  if ('next' in deps) return 'Next.js'
  if ('astro' in deps) return 'Astro'
  if ('vite' in deps && 'react' in deps) return 'React + Vite'
  if ('react' in deps) return 'React'
  if ('vue' in deps) return 'Vue'
  if ('svelte' in deps) return 'Svelte'
  if ('express' in deps) return 'Express'
  if ('fastify' in deps) return 'Fastify'
  if ('commander' in deps) return 'CLI (commander)'
  return 'Node.js'
}

function extractCargoKeys(raw: string): string[] {
  const matches = raw.matchAll(/^\s*(\w[\w-]+)\s*=/gm)
  const keys = new Set<string>()
  for (const m of matches) {
    if (m[1] && !['name', 'version', 'edition', 'description', 'authors', 'license'].includes(m[1])) {
      keys.add(m[1])
    }
  }
  return [...keys].slice(0, 20)
}

// ---------------------------------------------------------------------------
// Deterministic inference
// ---------------------------------------------------------------------------

async function inferStackMd(manifest: ProjectManifest): Promise<string> {
  const deps = manifest.keyDeps
    .map((d) => `- ${d}`)
    .join('\n')

  const scriptsSection =
    Object.keys(manifest.scripts).length > 0
      ? '\n## Scripts\n\n' +
        Object.entries(manifest.scripts)
          .map(([k, v]) => `- \`${k}\`: ${v}`)
          .join('\n')
      : ''

  return `---
updated: ${today()}
confidence: inferred
---

# Stack

> ${manifest.framework} project — inferred from ${manifest.type === 'node' ? 'package.json' : manifest.type === 'rust' ? 'Cargo.toml' : 'project manifest'}.

## Languages & frameworks

- ${manifest.framework}

## Key dependencies

${deps || '- (none detected)'}
${scriptsSection}

## Architecture decisions

-
`
}

async function inferPrdMd(projectPath: string, manifest: ProjectManifest): Promise<string> {
  let readmeContent = ''
  try {
    readmeContent = await fs.readFile(path.join(projectPath, 'README.md'), 'utf8')
    // Extract the first meaningful paragraph
    const lines = readmeContent.split('\n').filter((l) => l.trim() && !l.startsWith('#'))
    readmeContent = lines.slice(0, 5).join(' ').trim()
  } catch {
    // no readme
  }

  const description = readmeContent || manifest.description || `${manifest.name} — purpose not yet documented.`

  return `---
updated: ${today()}
confidence: inferred
---

# Product Requirements

> ${description}

## What it is

${description}

## Target user

-

## What it is not

-
`
}

async function inferCurrentDomains(projectPath: string): Promise<Array<{ domain: string; dir: string }>> {
  const srcDirs = ['src', 'lib', 'app', 'packages', 'apps']
  const domains: Array<{ domain: string; dir: string }> = []

  for (const srcDir of srcDirs) {
    const srcPath = path.join(projectPath, srcDir)
    try {
      const entries = await fs.readdir(srcPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_')) {
          domains.push({ domain: entry.name, dir: path.join(srcPath, entry.name) })
        }
      }
      if (domains.length > 0) break // found domains in the first srcDir that has them
    } catch {
      // dir doesn't exist
    }
  }

  // Fallback: top-level directories
  if (domains.length === 0) {
    const entries = await fs.readdir(projectPath, { withFileTypes: true })
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !['node_modules', 'dist', 'build', 'target', '__pycache__'].includes(entry.name)
      ) {
        domains.push({ domain: entry.name, dir: path.join(projectPath, entry.name) })
      }
    }
  }

  return domains.slice(0, 8)
}

function stubCurrentDoc(domain: string): string {
  const title = domain.charAt(0).toUpperCase() + domain.slice(1)
  return `---
updated: ${today()}
confidence: inferred
---

# ${title}

> Feature area inferred from directory structure. Review and fill in actual behaviour.

## What it does

-

## Key behaviours

-

## Data model

-

## Open questions

-
`
}

async function inferShipped(projectPath: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', [
      '-C', projectPath,
      'log', '--tags', '--simplify-by-decoration', '--pretty=format:%D|%ai|%s',
    ])
    const entries: string[] = []
    for (const line of stdout.split('\n')) {
      const parts = line.split('|')
      const refs = parts[0] ?? ''
      const date = (parts[1] ?? '').slice(0, 10)
      const subject = parts[2] ?? ''
      const tagMatch = refs.match(/tag:\s*([\w.v-]+)/)
      if (tagMatch?.[1]) {
        entries.push(`${tagMatch[1]}|${date}|${subject}`)
      }
    }
    return entries.slice(0, 10)
  } catch {
    return []
  }
}

function buildShippedDoc(version: string, date: string, subject: string): string {
  return `---
id: ${version.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}
title: "${version}"
shipped: ${date || today()}
updated: ${today()}
confidence: inferred
---

# ${version}

> ${subject || 'Release — details inferred from git tag.'}

## What shipped

-

## Context

-
`
}

// ---------------------------------------------------------------------------
// AI-assisted inference
// ---------------------------------------------------------------------------

async function enhanceCurrentDocWithAi(
  provider: Provider,
  domain: string,
  domainDir: string,
): Promise<string> {
  // Read up to 3 key files from the domain directory
  let sourceSample = ''
  try {
    const entries = await fs.readdir(domainDir, { withFileTypes: true })
    const files = entries
      .filter((e) => e.isFile() && /\.(ts|tsx|js|jsx|py|rs|go|svelte|vue)$/.test(e.name))
      .slice(0, 3)

    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(domainDir, file.name), 'utf8')
        sourceSample += `\n// ${file.name}\n${content.slice(0, 800)}\n`
      } catch {
        // skip unreadable files
      }
    }
  } catch {
    // domain dir not readable
  }

  if (!sourceSample) {
    return stubCurrentDoc(domain)
  }

  const messages = [
    {
      role: 'user' as const,
      content: `You are writing a feature description for a developer's spec folder.

Feature area: ${domain}

Source code sample:
${sourceSample}

Write a "current/" document describing what this feature does at the user-observable behaviour level — not what files exist. Use present tense. Be specific about what the feature actually does based on the code.

Format:
## What it does
(2-4 sentences)

## Key behaviours
- bullet 1
- bullet 2
- bullet 3

## Data model
(brief description or "-" if not applicable)

Output only the markdown body sections. No frontmatter. No headings above "## What it does".`,
    },
  ]

  const body = await provider.complete(messages, { maxTokens: 500, temperature: 0.3 })
  const title = domain.charAt(0).toUpperCase() + domain.slice(1)

  return `---
updated: ${today()}
confidence: inferred
---

# ${title}

> Feature description inferred by AI from source code. Review for accuracy.

${body.trim()}

## Open questions

-
`
}

async function inferDecisionsWithAi(
  provider: Provider,
  manifest: ProjectManifest,
  projectPath: string,
): Promise<Array<{ id: string; content: string }>> {
  const messages = [
    {
      role: 'user' as const,
      content: `You are analysing a ${manifest.type} project to identify notable technology decisions.

Project: ${manifest.name}
Framework: ${manifest.framework}
Key dependencies: ${manifest.keyDeps.join(', ')}

Identify 2-4 notable technology or architecture decisions implied by this stack. For each decision write:

DECISION: <kebab-id>
TITLE: <What was decided>
CONTEXT: <Why this decision was likely needed (1-2 sentences)>
DECISION_TEXT: <What was chosen (1 sentence)>
CONSEQUENCES: <What this makes easier or harder (1-2 sentences)>
---

Output only the decisions in the format above.`,
    },
  ]

  const body = await provider.complete(messages, { maxTokens: 800, temperature: 0.3 })

  const results: Array<{ id: string; content: string }> = []
  const blocks = body.split(/^---$/m).filter((b) => b.trim())

  for (const block of blocks) {
    const idMatch = block.match(/^DECISION:\s*(.+)$/m)
    const titleMatch = block.match(/^TITLE:\s*(.+)$/m)
    const contextMatch = block.match(/^CONTEXT:\s*(.+)$/m)
    const decisionMatch = block.match(/^DECISION_TEXT:\s*(.+)$/m)
    const consMatch = block.match(/^CONSEQUENCES:\s*(.+)$/m)

    if (!idMatch?.[1] || !titleMatch?.[1]) continue

    const id = idMatch[1].trim()
    const title = titleMatch[1].trim()
    const context = contextMatch?.[1]?.trim() ?? ''
    const decision = decisionMatch?.[1]?.trim() ?? ''
    const consequences = consMatch?.[1]?.trim() ?? ''

    results.push({
      id,
      content: `---
id: ${id}
title: "${title}"
status: active
date: ${today()}
confidence: inferred
---

# ${title}

## Context

${context}

## Decision

${decision}

## Consequences

${consequences}
`,
    })
  }

  return results.slice(0, 4)
}

// ---------------------------------------------------------------------------
// Interview
// ---------------------------------------------------------------------------

async function runInterview(
  manifest: ProjectManifest,
  prdDescription: string,
): Promise<{ northStar: string; deprecated: string[]; regrets: string[]; nextFeature: string; hiddenDecisions: string }> {
  const { text, isCancel: isCancelLocal } = await import('@clack/prompts')

  printLine('')
  printLine("I've inferred your stack and a current/ skeleton. A few things I couldn't determine:")
  printLine('')

  const northStarResult = await text({
    message: `1. What is the one-sentence north star for this project?\n   (I found: "${prdDescription}" — confirm or replace)`,
    placeholder: prdDescription,
    defaultValue: prdDescription,
  })
  const northStar = isCancelLocal(northStarResult) ? prdDescription : (northStarResult as string)

  const deprecatedResult = await text({
    message: '2. Any features in the codebase you consider abandoned or deprecated? (comma-separated, or leave blank)',
    placeholder: '',
    defaultValue: '',
  })
  const deprecated = isCancelLocal(deprecatedResult)
    ? []
    : (deprecatedResult as string)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

  const regretsResult = await text({
    message: '3. Any tech choices you\'d redo if starting today? (comma-separated, or leave blank)',
    placeholder: '',
    defaultValue: '',
  })
  const regrets = isCancelLocal(regretsResult)
    ? []
    : (regretsResult as string)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

  const nextFeatureResult = await text({
    message: '4. What were you planning to build next? (becomes the first planned/ entry)',
    placeholder: 'e.g. User authentication, Offline sync…',
    defaultValue: '',
  })
  const nextFeature = isCancelLocal(nextFeatureResult) ? '' : (nextFeatureResult as string)

  const hiddenResult = await text({
    message: '5. Any decisions baked into the code that aren\'t obvious from reading it? (or leave blank)',
    placeholder: '',
    defaultValue: '',
  })
  const hiddenDecisions = isCancelLocal(hiddenResult) ? '' : (hiddenResult as string)

  return { northStar, deprecated, regrets, nextFeature, hiddenDecisions }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function buildPlannedSpec(title: string): string {
  const id = slugify(title)
  return `---
id: ${id}
title: "${title}"
status: draft
effort: m
impact: medium
desire: medium
requires: []
tags: []
created: ${today()}
updated: ${today()}
confidence: inferred
---

# ${title}

> Describe what this feature does and why it matters.

## Problem

-

## Goal

-

## Non-goals

-

## Acceptance criteria

1.
`
}

function buildDeprecatedDecision(name: string): string {
  const id = slugify(name)
  return `---
id: ${id}
title: "${name}"
status: deprecated
date: ${today()}
confidence: inferred
---

# ${name}

## Context

This was identified as a tech choice worth reconsidering.

## Decision

${name}

## Consequences

Marked deprecated — would be reworked if starting today.
`
}

function buildHiddenDecision(description: string): string {
  const id = slugify(description).slice(0, 40) + '-hidden'
  return `---
id: ${id}
title: "${description}"
status: active
date: ${today()}
---

# ${description}

## Context

Identified during brownfield import as a non-obvious decision in the codebase.

## Decision

${description}

## Consequences

-
`
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export function registerImport(program: Command): void {
  program
    .command('import [path]')
    .description('Analyse an existing project and generate .curaye/ with inferred documents')
    .option('--deterministic-only', 'Skip AI-assisted inference', false)
    .option('--skip-interview', 'Skip the targeted interview', false)
    .action(
      async (
        targetPath: string | undefined,
        opts: { deterministicOnly: boolean; skipInterview: boolean },
      ) => {
        const resolvedPath = path.resolve(targetPath ?? process.cwd())
        const curayePath = path.join(resolvedPath, '.curaye')

        if (!isJsonMode()) intro('curaye import')

        // AC #5 — check .curaye/ doesn't exist
        try {
          await fs.access(curayePath)
          die(`.curaye/ already exists at ${resolvedPath}. Nothing was modified.`)
        } catch {
          // Good — doesn't exist
        }

        // --- Step 1: Detect project ---
        const s = spinner()
        s.start('Detecting project type…')
        const manifest = await detectProject(resolvedPath)
        s.stop(`Detected: ${manifest.framework} (${manifest.type})`)

        // --- Step 2: Deterministic inference ---
        s.start('Running deterministic inference…')

        const stackContent = await inferStackMd(manifest)
        const prdContent = await inferPrdMd(resolvedPath, manifest)
        const domains = await inferCurrentDomains(resolvedPath)
        const shippedEntries = await inferShipped(resolvedPath)

        s.stop(
          `Found ${domains.length} feature domains, ${shippedEntries.length} shipped milestones`,
        )

        // --- Step 3: AI-assisted inference ---
        let provider: Provider | null = null
        const enhancedCurrentDocs: Map<string, string> = new Map()
        const inferredDecisions: Array<{ id: string; content: string }> = []

        if (!opts.deterministicOnly) {
          const aiConfig = await readAiConfig()
          if (aiConfig && isAvailable(aiConfig)) {
            provider = createProvider(aiConfig)

            s.start('Enhancing current/ documents with AI…')
            for (const { domain, dir } of domains) {
              try {
                const enhanced = await enhanceCurrentDocWithAi(provider, domain, dir)
                enhancedCurrentDocs.set(domain, enhanced)
              } catch {
                // fall back to stub
              }
            }
            s.stop(`Enhanced ${enhancedCurrentDocs.size} current/ documents`)

            s.start('Inferring decision candidates with AI…')
            try {
              const decisions = await inferDecisionsWithAi(provider, manifest, resolvedPath)
              inferredDecisions.push(...decisions)
              s.stop(`Found ${decisions.length} decision candidates`)
            } catch {
              s.stop('AI decision inference skipped')
            }
          }
        }

        // --- Step 4: Interview ---
        let interviewResult: Awaited<ReturnType<typeof runInterview>> | null = null
        if (!opts.skipInterview && !isJsonMode()) {
          const skipResult = await confirm({
            message: 'Run a short interview to fill in gaps? (5 questions, skippable)',
          })
          if (!isCancel(skipResult) && skipResult) {
            // Extract north star from prd for the interview prompt
            const prdLines = prdContent.split('\n').filter((l) => l.trim() && !l.startsWith('#') && !l.startsWith('---') && !l.startsWith('updated:') && !l.startsWith('confidence:'))
            const northStarHint = prdLines[0]?.replace(/^>\s*/, '') ?? manifest.description
            interviewResult = await runInterview(manifest, northStarHint)
          }
        }

        // --- Step 5: Write .curaye/ ---
        s.start('Writing .curaye/…')

        await fs.mkdir(curayePath, { recursive: true })
        for (const dir of REQUIRED_DIRS) {
          await fs.mkdir(path.join(curayePath, dir), { recursive: true })
        }

        // stack.md (AC #1)
        await atomicWrite(path.join(curayePath, 'stack.md'), stackContent)

        // prd.md (AC #3) — update north star if interview ran
        let finalPrd = prdContent
        if (interviewResult?.northStar) {
          finalPrd = prdContent.replace(/^> .+$/m, `> ${interviewResult.northStar}`)
          // Also update "What it is" section
          finalPrd = finalPrd.replace(
            /^## What it is\n\n.+$/m,
            `## What it is\n\n${interviewResult.northStar}`,
          )
        }
        await atomicWrite(path.join(curayePath, 'prd.md'), finalPrd)

        // current/ (AC #2, #7)
        for (const { domain } of domains) {
          const content = enhancedCurrentDocs.get(domain) ?? stubCurrentDoc(domain)
          await atomicWrite(path.join(curayePath, 'current', `${domain}.md`), content)
        }

        // shipped/ (AC #4)
        for (const entry of shippedEntries) {
          const parts = entry.split('|')
          const version = parts[0] ?? 'v0'
          const date = parts[1] ?? today()
          const subject = parts[2] ?? ''
          const fileId = version.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
          await atomicWrite(
            path.join(curayePath, 'shipped', `${fileId}.md`),
            buildShippedDoc(version, date, subject),
          )
        }

        // decisions/ — AI-inferred
        for (const dec of inferredDecisions) {
          await atomicWrite(path.join(curayePath, 'decisions', `${dec.id}.md`), dec.content)
        }

        // decisions/ — from interview regrets (deprecated)
        if (interviewResult) {
          for (const regret of interviewResult.regrets) {
            const id = slugify(regret)
            await atomicWrite(
              path.join(curayePath, 'decisions', `${id}-deprecated.md`),
              buildDeprecatedDecision(regret),
            )
          }

          // decisions/ — hidden decisions
          if (interviewResult.hiddenDecisions) {
            const id = slugify(interviewResult.hiddenDecisions).slice(0, 40)
            await atomicWrite(
              path.join(curayePath, 'decisions', `${id}.md`),
              buildHiddenDecision(interviewResult.hiddenDecisions),
            )
          }

          // planned/ — next feature from interview
          if (interviewResult.nextFeature) {
            await atomicWrite(
              path.join(curayePath, 'planned', `01-${slugify(interviewResult.nextFeature)}.md`),
              buildPlannedSpec(interviewResult.nextFeature),
            )
          }
        }

        s.stop('.curaye/ written')

        // --- Step 6: Register the project (AC #6 implicit — flow completes) ---
        const projectId = path.basename(resolvedPath).toLowerCase().replace(/[^a-z0-9]+/g, '-')
        const existing = await ProjectRegistry.find(projectId)
        if (!existing) {
          await ProjectRegistry.add({
            id: projectId,
            name: manifest.name || projectId,
            path: resolvedPath,
            added: today(),
          })
        }

        // --- Step 7: Report ---
        const totalDocs =
          1 + // stack.md
          1 + // prd.md
          domains.length +
          shippedEntries.length +
          inferredDecisions.length +
          (interviewResult?.regrets.length ?? 0) +
          (interviewResult?.hiddenDecisions ? 1 : 0) +
          (interviewResult?.nextFeature ? 1 : 0)

        if (isJsonMode()) {
          printJson({
            path: resolvedPath,
            curayePath,
            project: projectId,
            domains: domains.map((d) => d.domain),
            shippedEntries: shippedEntries.length,
            decisions: inferredDecisions.length,
            totalDocs,
            aiUsed: provider !== null,
          })
        } else {
          printLine('')
          log.success('Import complete.')
          printLine(`  ${totalDocs} documents created, all marked 'confidence: inferred'`)
          printLine(`  stack.md:     ${manifest.framework} stack detected`)
          printLine(`  current/:     ${domains.length} feature domains`)
          printLine(`  shipped/:     ${shippedEntries.length} milestone(s) from git tags`)
          printLine(`  decisions/:   ${inferredDecisions.length} candidate(s)${provider ? ' (AI-assisted)' : ''}`)
          printLine(`  Registered as: ${projectId}`)
          printLine('')
          outro(`Review with \`curaye review ${resolvedPath}\``)
        }
      },
    )
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = `${filePath}.tmp`
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, filePath)
}
