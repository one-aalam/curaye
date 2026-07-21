import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { intro, outro, text, select, multiselect, isCancel, spinner, log } from '@clack/prompts'
import { ProjectRegistry } from '@curaye/core'
import { readAiConfig, isAvailable, createProvider } from '@curaye/ai'
import type { Provider } from '@curaye/ai'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { today } from '../lib/context.js'

const REQUIRED_DIRS = ['planned', 'current', 'shipped', 'decisions']

const APP_TYPES = ['Desktop (Tauri)', 'Web', 'CLI', 'Mobile', 'Library', 'Other'] as const
type AppType = (typeof APP_TYPES)[number]

const STACK_TYPE_MAP: Record<AppType, string> = {
  'Desktop (Tauri)': 'tauri-react',
  'Web': 'web',
  'CLI': 'cli',
  'Mobile': 'mobile',
  'Library': 'library',
  'Other': 'other',
}

interface BootstrapAnswers {
  description: string
  targetUser: string
  appType: AppType
  selectedDecisions: string[]
  firstFeature: string
}

async function readSharedDecisions(): Promise<Array<{ id: string; title: string; filePath: string }>> {
  const sharedDecisionsDir = path.join(os.homedir(), '.curaye', 'shared', 'decisions')
  try {
    const entries = await fs.readdir(sharedDecisionsDir)
    const results: Array<{ id: string; title: string; filePath: string }> = []
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue
      const filePath = path.join(sharedDecisionsDir, entry)
      const raw = await fs.readFile(filePath, 'utf8').catch(() => '')
      const titleMatch = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m)
      const title = titleMatch?.[1] ?? entry.replace(/\.md$/, '')
      const id = entry.replace(/\.md$/, '')
      results.push({ id, title, filePath })
    }
    return results
  } catch {
    return []
  }
}

async function readSharedStack(appType: AppType): Promise<string | null> {
  const stackKey = STACK_TYPE_MAP[appType]
  const sharedStackDir = path.join(os.homedir(), '.curaye', 'shared', 'stack')
  const candidates = [`${stackKey}.md`, `${stackKey}/index.md`]
  for (const candidate of candidates) {
    const filePath = path.join(sharedStackDir, candidate)
    try {
      return await fs.readFile(filePath, 'utf8')
    } catch {
      // not found, try next
    }
  }
  return null
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function stubPrd(answers: BootstrapAnswers): string {
  return `---
updated: ${today()}
---

# Product Requirements

> ${answers.description}

## What it is

${answers.description}

## Target user

${answers.targetUser}

## What it is not

-
`
}

function stubStack(sharedContent: string | null, appType: AppType): string {
  if (sharedContent) return sharedContent
  return `---
updated: ${today()}
---

# Stack

> App type: ${appType}

## Languages & frameworks

-

## Key dependencies

-

## Architecture decisions

-
`
}

function stubProduct(appType: AppType): string {
  return `---
updated: ${today()}
---

# Product

> Fill in distribution and interface details.

## Distribution

- Platform: ${appType}
- Release channel:

## Interface

-
`
}

function stubPlannedSpec(firstFeature: string): string {
  const id = slugify(firstFeature)
  return `---
id: ${id}
title: "${firstFeature}"
status: draft
effort: m
impact: medium
desire: medium
requires: []
tags: []
created: ${today()}
updated: ${today()}
---

# ${firstFeature}

> Describe what this feature does and why it matters.

## Problem

Describe the problem this spec addresses.

## Goal

Describe the outcome in 1–3 sentences.

## Non-goals

-

## Acceptance criteria

1.
`
}

async function draftPrdWithAi(provider: Provider, answers: BootstrapAnswers): Promise<string> {
  const messages = [
    {
      role: 'user' as const,
      content: `Write a product requirements document (prd.md) for a software project.

Project description: ${answers.description}
Target user: ${answers.targetUser}
App type: ${answers.appType}

Write a concise product brief with sections: "What it is" (2-3 sentences of coherent prose), "Target user" (1-2 sentences), and "What it is not" (2-3 bullet points of explicit non-goals). Output only the markdown body — no frontmatter. Use clear, direct language.`,
    },
  ]
  const body = await provider.complete(messages, { maxTokens: 600, temperature: 0.4 })
  return `---
updated: ${today()}
---

# Product Requirements

> ${answers.description}

${body.trim()}
`
}

async function draftSpecWithAi(provider: Provider, answers: BootstrapAnswers): Promise<string> {
  const id = slugify(answers.firstFeature)
  const messages = [
    {
      role: 'user' as const,
      content: `Draft a Curaye spec document for a software feature.

Project: ${answers.description}
App type: ${answers.appType}
Feature to build: ${answers.firstFeature}

Write sections: Problem (1-2 sentences), Goal (1-2 sentences), Non-goals (2-3 bullets), Acceptance criteria (5-7 numbered items). Output only the markdown body — no frontmatter.`,
    },
  ]
  const body = await provider.complete(messages, { maxTokens: 800, temperature: 0.4 })
  return `---
id: ${id}
title: "${answers.firstFeature}"
status: draft
effort: m
impact: medium
desire: medium
requires: []
tags: []
created: ${today()}
updated: ${today()}
---

# ${answers.firstFeature}

${body.trim()}
`
}

export function registerBootstrap(program: Command): void {
  program
    .command('bootstrap [path]')
    .description('Run the project bootstrap interview and scaffold .curaye/')
    .action(async (targetPath: string | undefined) => {
      const resolvedPath = path.resolve(targetPath ?? process.cwd())
      const curayePath = path.join(resolvedPath, '.curaye')

      // AC #8 — bail if .curaye/ already exists
      try {
        await fs.access(curayePath)
        die(`.curaye/ already exists at ${resolvedPath}. Nothing was modified.`)
      } catch {
        // Good — doesn't exist
      }

      if (isJsonMode()) {
        die('bootstrap does not support --json (it is an interactive flow)')
      }

      intro('curaye bootstrap')

      // --- Interview ---
      const descResult = await text({
        message: 'What is this project? (one sentence)',
        placeholder: 'A tool that does X for Y',
      })
      if (isCancel(descResult)) die('Aborted.')
      const description = descResult as string

      const userResult = await text({
        message: 'Who is it for?',
        placeholder: 'e.g. indie developers, small teams…',
      })
      if (isCancel(userResult)) die('Aborted.')
      const targetUser = userResult as string

      const typeResult = await select({
        message: 'What type of app is it?',
        options: APP_TYPES.map((t) => ({ value: t, label: t })),
      })
      if (isCancel(typeResult)) die('Aborted.')
      const appType = typeResult as AppType

      // Q4 — shared decisions (skip if shared layer empty)
      const sharedDecisions = await readSharedDecisions()
      let selectedDecisions: string[] = []
      if (sharedDecisions.length > 0) {
        const decResult = await multiselect({
          message: 'Which shared decisions apply here? (space to select, enter to confirm)',
          options: sharedDecisions.map((d) => ({ value: d.id, label: d.title })),
          required: false,
        })
        if (!isCancel(decResult)) {
          selectedDecisions = decResult as string[]
        }
      }

      // Q5 — first feature
      const featureResult = await text({
        message: 'What do you want to build first?',
        placeholder: 'e.g. User authentication, Core data model…',
      })
      if (isCancel(featureResult)) die('Aborted.')
      const firstFeature = featureResult as string

      const answers: BootstrapAnswers = { description, targetUser, appType, selectedDecisions, firstFeature }

      // --- Read shared stack ---
      const sharedStack = await readSharedStack(appType)

      // --- AI setup ---
      const aiConfig = await readAiConfig()
      let provider: Provider | null = null
      if (aiConfig && isAvailable(aiConfig)) {
        provider = createProvider(aiConfig)
      }

      const s = spinner()
      s.start('Scaffolding .curaye/…')

      // --- Create directories ---
      await fs.mkdir(curayePath, { recursive: true })
      for (const dir of REQUIRED_DIRS) {
        await fs.mkdir(path.join(curayePath, dir), { recursive: true })
      }

      s.stop('Directories created')

      // --- Generate prd.md ---
      let prdContent: string
      if (provider) {
        const ps = spinner()
        ps.start('Drafting prd.md with AI…')
        try {
          prdContent = await draftPrdWithAi(provider, answers)
          ps.stop('prd.md drafted')
        } catch {
          ps.stop('AI unavailable — using stub')
          prdContent = stubPrd(answers)
        }
      } else {
        prdContent = stubPrd(answers)
      }
      await fs.writeFile(path.join(curayePath, 'prd.md'), prdContent, 'utf8')

      // --- Generate stack.md ---
      const stackContent = stubStack(sharedStack, appType)
      await fs.writeFile(path.join(curayePath, 'stack.md'), stackContent, 'utf8')

      // --- Generate product.md ---
      await fs.writeFile(path.join(curayePath, 'product.md'), stubProduct(appType), 'utf8')

      // --- Copy selected shared decisions ---
      const decisionMap = Object.fromEntries(sharedDecisions.map((d) => [d.id, d]))
      for (const decId of selectedDecisions) {
        const dec = decisionMap[decId]
        if (!dec) continue
        let raw = await fs.readFile(dec.filePath, 'utf8').catch(() => '')
        // Inject source field into frontmatter
        raw = raw.replace(/^(---\n)([\s\S]*?)(---)/m, (_m, open, body, close) => {
          const hasSource = /^source:/m.test(body)
          const newBody = hasSource ? body : `${body}source: shared/decisions/${decId}\n`
          return `${open}${newBody}${close}`
        })
        await fs.writeFile(path.join(curayePath, 'decisions', `${decId}.md`), raw, 'utf8')
      }

      // --- Draft first planned spec ---
      let specContent: string
      if (provider) {
        const ps = spinner()
        ps.start('Drafting first planned spec with AI…')
        try {
          specContent = await draftSpecWithAi(provider, answers)
          ps.stop('Spec drafted')
        } catch {
          ps.stop('AI unavailable — using stub')
          specContent = stubPlannedSpec(firstFeature)
        }
      } else {
        specContent = stubPlannedSpec(firstFeature)
      }
      const specId = slugify(firstFeature)
      await fs.writeFile(path.join(curayePath, 'planned', `01-${specId}.md`), specContent, 'utf8')

      // --- AC #10 — auto-link ---
      const projectId = path.basename(resolvedPath).toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const existing = await ProjectRegistry.find(projectId)
      if (!existing) {
        await ProjectRegistry.add({
          id: projectId,
          name: projectId,
          path: resolvedPath,
          added: today(),
        })
      }

      // --- Report ---
      printLine('')
      log.success('Bootstrap complete')
      printLine(`  .curaye/ created at: ${resolvedPath}`)
      printLine('  prd.md, stack.md, product.md: written')
      printLine(`  Planned spec:   planned/01-${specId}.md`)
      if (selectedDecisions.length > 0) {
        printLine(`  Decisions seeded: ${selectedDecisions.join(', ')}`)
      }
      if (sharedStack) {
        printLine(`  stack.md seeded from: shared/stack/${STACK_TYPE_MAP[appType]}`)
      }
      printLine(`  Registered as:  ${projectId}`)
      printLine('')
      outro(`Run \`curaye list\` to see your specs, or \`curaye ai draft\` to add more.`)
    })
}
