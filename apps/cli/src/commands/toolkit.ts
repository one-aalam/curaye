import type { Command } from 'commander'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { execSync } from 'child_process'
import {
  intro,
  outro,
  log,
  text,
  multiselect,
  select,
  confirm,
  isCancel,
} from '@clack/prompts'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolkitTools {
  formatter?: string
  linter?: string
  test?: string
  e2e?: string
}

export interface ToolkitPreset {
  id: string
  title: string
  runtime: string[]
  app_type: string | undefined
  framework: string[]
  starter_kit: string | undefined
  starter_kit_cmd: string | undefined
  design_system: string | undefined
  tools: ToolkitTools
  body: string
  file_path: string
}

// ---------------------------------------------------------------------------
// Known options
// ---------------------------------------------------------------------------

const KNOWN_RUNTIMES = ['node', 'rust', 'python', 'go', 'bun', 'ruby', 'java', 'dotnet'] as const
const KNOWN_APP_TYPES = ['desktop', 'web', 'cli', 'api', 'mobile', 'library'] as const

// Known starter kit defaults: name → command
const KNOWN_KITS: Record<string, string> = {
  'create-tauri-app': 'npx create-tauri-app',
  'create-turbo': 'npx create-turbo',
  'create-next-app': 'npx create-next-app',
  'create-astro': 'npx create astro',
  'create-svelte': 'npx sv create',
  'create-vite': 'npx create vite',
  'create-tui': 'npx @msmps/create-tui',
}

// ---------------------------------------------------------------------------
// Stack directory path
// ---------------------------------------------------------------------------

function stackDir(): string {
  return path.join(os.homedir(), '.curaye', 'shared', 'stack')
}

function presetPath(id: string): string {
  return path.join(stackDir(), `${id}.md`)
}

// ---------------------------------------------------------------------------
// Parse a raw shared stack document into a ToolkitPreset
// ---------------------------------------------------------------------------

function parsePreset(id: string, raw: string, filePath: string): ToolkitPreset | null {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) return null
  const fm = fmMatch[1] ?? ''

  const getField = (name: string): string | undefined => {
    const m = fm.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))
    return m?.[1]?.trim().replace(/^["']|["']$/g, '')
  }

  const getList = (name: string): string[] => {
    // Inline: field: [a, b, c]
    const inlineM = fm.match(new RegExp(`^${name}:\\s*\\[([^\\]]*)\\]`, 'm'))
    if (inlineM?.[1] !== undefined) {
      return inlineM[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    }
    // Block list
    const blockM = fm.match(new RegExp(`^${name}:\\s*\\n((?:\\s+-\\s+.+\\n?)*)`, 'm'))
    if (blockM?.[1] !== undefined) {
      return blockM[1].split('\n').map((l) => l.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    }
    // Scalar (single value)
    const scalar = getField(name)
    return scalar ? [scalar] : []
  }

  const runtime = getList('runtime')
  const appType = getField('app_type')
  const framework = getList('framework')
  const starterKit = getField('starter_kit')
  const starterKitCmd = getField('starter_kit_cmd')
  const designSystem = getField('design_system')

  // Tools sub-map
  const toolsM = fm.match(/^tools:\s*\n((?:\s+\w+:\s*.+\n?)*)/m)
  const tools: ToolkitTools = {}
  if (toolsM?.[1]) {
    const lines = toolsM[1].split('\n')
    for (const line of lines) {
      const m = line.match(/^\s+(\w+):\s*(.+)$/)
      if (m) {
        const key = m[1]!.trim() as keyof ToolkitTools
        const val = m[2]!.trim().replace(/^["']|["']$/g, '')
        if (key === 'formatter' || key === 'linter' || key === 'test' || key === 'e2e') {
          tools[key] = val
        }
      }
    }
  }

  // Check if any toolkit field exists
  const hasToolkitFields = runtime.length > 0 || appType !== undefined || framework.length > 0 ||
    starterKit !== undefined || starterKitCmd !== undefined || designSystem !== undefined ||
    Object.keys(tools).length > 0

  if (!hasToolkitFields) return null

  // Body = everything after closing ---
  const body = raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trimStart()

  return {
    id,
    title: getField('title') ?? id,
    runtime,
    app_type: appType,
    framework,
    starter_kit: starterKit,
    starter_kit_cmd: starterKitCmd,
    design_system: designSystem,
    tools,
    body,
    file_path: filePath,
  }
}

// ---------------------------------------------------------------------------
// Read all presets from ~/.curaye/shared/stack/
// ---------------------------------------------------------------------------

async function readAllPresets(): Promise<ToolkitPreset[]> {
  const dir = stackDir()
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }

  const presets: ToolkitPreset[] = []
  for (const entry of entries.filter((e) => e.endsWith('.md'))) {
    const fp = path.join(dir, entry)
    const raw = await fs.readFile(fp, 'utf8').catch(() => '')
    if (!raw) continue
    const id = entry.replace(/\.md$/, '')
    const preset = parsePreset(id, raw, fp)
    if (preset) presets.push(preset)
  }
  return presets
}

// ---------------------------------------------------------------------------
// Serialize a preset back to markdown
// ---------------------------------------------------------------------------

function serializePreset(preset: Omit<ToolkitPreset, 'file_path'>): string {
  const lines: string[] = ['---']
  lines.push(`id: ${preset.id}`)
  lines.push(`title: "${preset.title}"`)

  if (preset.runtime.length > 0) {
    lines.push(`runtime: [${preset.runtime.join(', ')}]`)
  }
  if (preset.app_type) {
    lines.push(`app_type: ${preset.app_type}`)
  }
  if (preset.framework.length > 0) {
    lines.push(`framework: [${preset.framework.join(', ')}]`)
  }
  if (preset.starter_kit) {
    lines.push(`starter_kit: ${preset.starter_kit}`)
  }
  if (preset.starter_kit_cmd) {
    lines.push(`starter_kit_cmd: ${preset.starter_kit_cmd}`)
  }
  if (preset.design_system) {
    lines.push(`design_system: ${preset.design_system}`)
  }

  const toolEntries = Object.entries(preset.tools).filter(([, v]) => v)
  if (toolEntries.length > 0) {
    lines.push('tools:')
    for (const [k, v] of toolEntries) {
      lines.push(`  ${k}: ${v}`)
    }
  }

  lines.push('adopted_by: []')
  lines.push('---')
  lines.push('')
  lines.push(preset.body || '> Add rationale and notes here.')
  lines.push('')

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

async function writeAtomic(fp: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(fp), { recursive: true })
  const tmp = `${fp}.tmp`
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, fp)
}

// ---------------------------------------------------------------------------
// Command: list
// ---------------------------------------------------------------------------

async function cmdList(opts: { runtime?: string; appType?: string }): Promise<void> {
  const presets = await readAllPresets()

  let filtered = presets
  if (opts.runtime) {
    filtered = filtered.filter((p) => p.runtime.includes(opts.runtime!))
  }
  if (opts.appType) {
    filtered = filtered.filter((p) => p.app_type === opts.appType)
  }

  if (isJsonMode()) {
    printJson(filtered.map(({ file_path: _fp, body: _body, ...rest }) => rest))
    return
  }

  if (filtered.length === 0) {
    printLine('No toolkit presets found. Run `curaye toolkit add` to create one.')
    return
  }

  for (const p of filtered) {
    const runtimeStr = p.runtime.join(', ')
    const appTypeStr = p.app_type ?? '(any)'
    const kitStr = p.starter_kit ?? '(no starter kit)'
    printLine(`${p.id.padEnd(20)} ${appTypeStr.padEnd(10)} · ${runtimeStr.padEnd(20)} · ${kitStr}`)
  }
}

// ---------------------------------------------------------------------------
// Command: add (interactive)
// ---------------------------------------------------------------------------

async function cmdAdd(): Promise<void> {
  if (isJsonMode()) {
    die('toolkit add is an interactive flow')
  }

  intro('curaye toolkit add')

  const idResult = await text({
    message: 'Preset id (slug)',
    placeholder: 'tauri-react',
    validate: (v) => {
      if (!v?.trim()) return 'Required'
      if (/[/\\:*?"<>|\s]/.test(v)) return 'No spaces or special characters'
      return undefined
    },
  })
  if (isCancel(idResult)) return
  const id = (idResult as string).trim()

  const fp = presetPath(id)
  const alreadyExists = await fs.access(fp).then(() => true).catch(() => false)
  if (alreadyExists) {
    log.warn(`Preset '${id}' already exists — use 'curaye toolkit edit ${id}' to modify it.`)
    return
  }

  const titleResult = await text({
    message: 'Title (human-readable)',
    placeholder: 'Tauri + React',
  })
  if (isCancel(titleResult)) return
  const title = (titleResult as string).trim() || id

  const runtimeResult = await multiselect({
    message: 'Runtime(s)',
    options: [
      ...KNOWN_RUNTIMES.map((r) => ({ value: r, label: r })),
      { value: '__other__', label: 'Other (enter below)' },
    ],
    required: false,
  })
  if (isCancel(runtimeResult)) return
  let runtime = (runtimeResult as string[]).filter((v) => v !== '__other__')
  if ((runtimeResult as string[]).includes('__other__')) {
    const otherResult = await text({ message: 'Enter additional runtimes (comma-separated)' })
    if (!isCancel(otherResult) && (otherResult as string).trim()) {
      runtime = [...runtime, ...(otherResult as string).split(',').map((s) => s.trim()).filter(Boolean)]
    }
  }

  const appTypeResult = await select({
    message: 'App type',
    options: [
      ...KNOWN_APP_TYPES.map((t) => ({ value: t, label: t })),
      { value: '', label: 'Other / skip' },
    ],
  })
  if (isCancel(appTypeResult)) return
  let appType = appTypeResult as string

  if (appType === '' || appType === 'Other / skip') {
    const customResult = await text({ message: 'App type (or leave empty to skip)' })
    if (!isCancel(customResult)) {
      appType = (customResult as string).trim()
    } else {
      appType = ''
    }
  }

  const frameworkResult = await text({
    message: 'Frameworks (comma-separated, e.g. tauri, react)',
    placeholder: 'Leave empty to skip',
  })
  if (isCancel(frameworkResult)) return
  const framework = (frameworkResult as string).trim()
    ? (frameworkResult as string).split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const kitNameResult = await text({
    message: 'Starter kit name (e.g. create-tauri-app) — leave empty to skip',
    placeholder: 'Leave empty to skip',
  })
  if (isCancel(kitNameResult)) return
  const starterKit = (kitNameResult as string).trim() || undefined

  let starterKitCmd: string | undefined
  if (starterKit) {
    const knownCmd = KNOWN_KITS[starterKit]
    const cmdResult = await text({
      message: 'Starter kit command',
      placeholder: knownCmd ?? `npx ${starterKit}`,
      initialValue: knownCmd ?? '',
    })
    if (!isCancel(cmdResult)) {
      starterKitCmd = (cmdResult as string).trim() || undefined
    }
  }

  const dsResult = await text({
    message: 'Design system (e.g. shadcn/ui) — leave empty to skip',
    placeholder: 'Leave empty to skip',
  })
  if (isCancel(dsResult)) return
  const designSystem = (dsResult as string).trim() || undefined

  printLine('\nTools (leave empty to skip each):')
  const tools: ToolkitTools = {}

  for (const [role, key] of [['Formatter', 'formatter'], ['Linter', 'linter'], ['Test runner', 'test'], ['E2E runner', 'e2e']] as [string, keyof ToolkitTools][]) {
    const result = await text({ message: role, placeholder: 'Leave empty to skip' })
    if (!isCancel(result) && (result as string).trim()) {
      tools[key] = (result as string).trim()
    }
  }

  const preset: Omit<ToolkitPreset, 'file_path'> = {
    id,
    title,
    runtime,
    app_type: appType || undefined,
    framework,
    starter_kit: starterKit,
    starter_kit_cmd: starterKitCmd,
    design_system: designSystem,
    tools,
    body: '> Add rationale and notes here.',
  }

  await writeAtomic(fp, serializePreset(preset))
  log.success(`Preset '${id}' written to ${fp}`)
  outro('Done.')
}

// ---------------------------------------------------------------------------
// Command: show
// ---------------------------------------------------------------------------

async function cmdShow(id: string): Promise<void> {
  const fp = presetPath(id)
  const raw = await fs.readFile(fp, 'utf8').catch(() => null)
  if (!raw) die(`Preset '${id}' not found`)

  if (isJsonMode()) {
    const preset = parsePreset(id, raw!, fp)
    if (!preset) die(`'${id}' is not a toolkit preset`)
    printJson(preset)
  } else {
    printLine(raw!)
  }
}

// ---------------------------------------------------------------------------
// Command: edit
// ---------------------------------------------------------------------------

async function cmdEdit(id: string): Promise<void> {
  const fp = presetPath(id)
  const exists = await fs.access(fp).then(() => true).catch(() => false)
  if (!exists) die(`Preset '${id}' not found`)

  const editor = process.env['EDITOR'] ?? process.env['VISUAL'] ?? 'vi'
  try {
    execSync(`${editor} "${fp}"`, { stdio: 'inherit' })
  } catch {
    die(`Failed to open editor: ${editor}`)
  }
}

// ---------------------------------------------------------------------------
// Command: remove
// ---------------------------------------------------------------------------

async function cmdRemove(id: string): Promise<void> {
  const fp = presetPath(id)
  const exists = await fs.access(fp).then(() => true).catch(() => false)
  if (!exists) die(`Preset '${id}' not found at ${fp}`)

  if (!isJsonMode()) {
    const confirmed = await confirm({ message: `Delete preset '${id}'? This cannot be undone.` })
    if (isCancel(confirmed) || !confirmed) {
      log.warn('Cancelled.')
      return
    }
  }

  await fs.unlink(fp)

  if (isJsonMode()) {
    printJson({ deleted: id })
  } else {
    log.success(`Preset '${id}' deleted.`)
  }
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export function registerToolkit(program: Command): void {
  const tk = program.command('toolkit').description('Manage toolkit presets (~/.curaye/shared/stack/)')

  tk.command('list')
    .description('List all toolkit presets')
    .option('--runtime <id>', 'Filter by runtime id (node, rust, python, …)')
    .option('--app-type <type>', 'Filter by app type (desktop, web, cli, api, mobile, library)')
    .action(async (opts: { runtime?: string; appType?: string }) => {
      await cmdList(opts)
    })

  tk.command('add')
    .description('Add a new toolkit preset via guided interview')
    .action(async () => {
      await cmdAdd()
    })

  tk.command('show <id>')
    .description('Print a toolkit preset')
    .action(async (id: string) => {
      await cmdShow(id)
    })

  tk.command('edit <id>')
    .description('Open a toolkit preset in $EDITOR')
    .action(async (id: string) => {
      await cmdEdit(id)
    })

  tk.command('remove <id>')
    .description('Delete a toolkit preset (prompts for confirmation)')
    .action(async (id: string) => {
      await cmdRemove(id)
    })
}

// ---------------------------------------------------------------------------
// Re-export for use by scaffold
// ---------------------------------------------------------------------------

export { readAllPresets, parsePreset, stackDir }
export type { ToolkitPreset as ParsedPreset }
