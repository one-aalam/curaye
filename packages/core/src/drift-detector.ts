import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { load as yamlLoad, dump as yamlDump } from 'js-yaml'
import { SharedLayer } from './shared-layer.js'
import { ProjectRegistry } from './registry.js'
import type { RegistryProject } from './registry.js'

export type DriftClassification = 'drift' | 'intentional-override' | 'pending-update' | 'no-drift'

export interface DriftFinding {
  sharedDocId: string
  docRef: string
  classification: DriftClassification
  description: string
  hint?: string
}

export interface DriftReport {
  projectId: string
  projectPath: string
  checkedCount: number
  findings: DriftFinding[]
}

const IGNORES_PATH = path.join(os.homedir(), '.curaye', 'drift-ignores.yaml')
const REVIEWS_DIR = path.join(os.homedir(), '.curaye', 'shared-reviews')

interface IgnoreEntry {
  projectId: string
  docId: string
  ignoredAt: string
}

interface IgnoresFile {
  ignores: IgnoreEntry[]
}

async function readIgnoresFile(): Promise<IgnoresFile> {
  try {
    const raw = await fs.readFile(IGNORES_PATH, 'utf8')
    const parsed = yamlLoad(raw) as IgnoresFile | null
    if (!parsed || typeof parsed !== 'object') return { ignores: [] }
    return { ignores: parsed.ignores ?? [] }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ignores: [] }
    throw err
  }
}

async function writeIgnoresFile(data: IgnoresFile): Promise<void> {
  const dir = path.dirname(IGNORES_PATH)
  await fs.mkdir(dir, { recursive: true })
  const tmp = IGNORES_PATH + '.tmp'
  await fs.writeFile(tmp, yamlDump(data, { lineWidth: -1 }), 'utf8')
  await fs.rename(tmp, IGNORES_PATH)
}

function parseFrontmatterFields(raw: string): Record<string, unknown> {
  const stripped = raw.trimStart()
  if (!stripped.startsWith('---')) return {}
  const rest = stripped.slice(3)
  const end = rest.indexOf('\n---')
  if (end < 0) return {}
  const yamlStr = rest.slice(0, end)
  return (yamlLoad(yamlStr) as Record<string, unknown> | null) ?? {}
}

const COMMON_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
  'how', 'its', 'let', 'may', 'now', 'old', 'say', 'see', 'set', 'two',
  'way', 'who', 'did', 'man', 'new', 'put', 'too', 'use', 'via', 'as',
  'at', 'be', 'by', 'do', 'go', 'if', 'in', 'is', 'it', 'me', 'my',
  'no', 'of', 'on', 'or', 'so', 'to', 'up', 'we', 'a', 'i',
  'this', 'that', 'with', 'have', 'from', 'they', 'will', 'been', 'when',
  'more', 'than', 'what', 'some', 'each', 'then', 'them', 'also', 'into',
  'your', 'over', 'even', 'most', 'just', 'such', 'well', 'back', 'only',
  'here', 'both', 'much', 'were', 'same', 'need', 'like', 'very', 'take',
  'used', 'make', 'data', 'type', 'base', 'code', 'file', 'name', 'list',
  'page', 'text', 'true', 'main', 'must', 'docs', 'view', 'spec', 'test',
  'work', 'does', 'able', 'call', 'show', 'keep', 'sure', 'left', 'read',
  'user', 'path', 'long', 'run', 'done', 'item', 'key', 'new', 'set',
  'api', 'url', 'ide', 'cli', 'app',
])

function extractKeyTerms(text: string): Set<string> {
  const terms = new Set<string>()
  // Extract words and hyphenated compound words (package names, library names)
  const wordPattern = /\b([a-zA-Z][a-zA-Z0-9]*(?:[-][a-zA-Z0-9]+)*)\b/g
  let match
  while ((match = wordPattern.exec(text)) !== null) {
    const word = match[1]
    if (!word || word.length < 3) continue
    const lower = word.toLowerCase()
    if (!COMMON_WORDS.has(lower)) {
      terms.add(lower)
    }
  }
  return terms
}

async function readProjectLocalContent(project: RegistryProject): Promise<string> {
  const curiyePath = ProjectRegistry.curiyePath(project)
  const sections = ['decisions', 'current']
  const parts: string[] = []

  // Stack.md at the curaye root
  for (const rootFile of ['stack.md', 'prd.md']) {
    try {
      const content = await fs.readFile(path.join(curiyePath, rootFile), 'utf8')
      parts.push(content)
    } catch {
      // not present
    }
  }

  for (const section of sections) {
    const dir = path.join(curiyePath, section)
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.endsWith('.md')) continue
      try {
        const content = await fs.readFile(path.join(dir, entry), 'utf8')
        parts.push(content)
      } catch {
        // skip unreadable files
      }
    }
  }

  return parts.join('\n')
}

async function hasLocalOverride(project: RegistryProject, docRef: string): Promise<boolean> {
  const curiyePath = ProjectRegistry.curiyePath(project)
  const decisionsDir = path.join(curiyePath, 'decisions')
  let entries: string[]
  try {
    entries = await fs.readdir(decisionsDir)
  } catch {
    return false
  }

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue
    try {
      const raw = await fs.readFile(path.join(decisionsDir, entry), 'utf8')
      const fm = parseFrontmatterFields(raw)
      const superseded = fm['superseded_by']
      if (typeof superseded === 'string' && superseded === docRef) return true
      if (Array.isArray(superseded) && (superseded as unknown[]).includes(docRef)) return true
    } catch {
      // skip
    }
  }
  return false
}

function computeTermDrift(sharedRaw: string, localContent: string): string | null {
  const sharedTerms = extractKeyTerms(sharedRaw)
  const localTerms = extractKeyTerms(localContent)

  // Terms in shared doc not found at all in local content are candidate drift signals
  // We focus on terms that look like library/technology identifiers (contain digit, hyphen, or capitalization)
  const missingTerms = [...sharedTerms].filter((term) => {
    if (localTerms.has(term)) return false
    // Only flag terms that look technology-specific (contains a digit, hyphen, or is multi-syllable)
    const looksLikeTech = /\d/.test(term) || term.includes('-') || term.length > 6
    return looksLikeTech
  })

  if (missingTerms.length === 0) return null

  // Return the top few terms that are most likely to represent real drift
  const topTerms = missingTerms.slice(0, 5)
  return `Key terms from shared document not found in local content: ${topTerms.join(', ')}`
}

export class DriftDetector {
  /** Check all adopted shared documents for a single project. */
  static async checkProject(project: RegistryProject): Promise<DriftReport> {
    const projectId = project.id
    const adopts = project.adopts ?? []

    if (adopts.length === 0) {
      return { projectId, projectPath: project.path, checkedCount: 0, findings: [] }
    }

    const ignoresData = await readIgnoresFile()
    const ignoredSet = new Set(
      ignoresData.ignores
        .filter((e) => e.projectId === projectId)
        .map((e) => e.docId),
    )

    const localContent = await readProjectLocalContent(project)
    const findings: DriftFinding[] = []

    for (const docRef of adopts) {
      // docRef format: "shared/<category>/<id>"
      const parts = docRef.split('/')
      if (parts.length < 3) continue
      const docId = parts[parts.length - 1] ?? ''
      if (!docId) continue

      if (ignoredSet.has(docId)) continue

      const sharedDoc = await SharedLayer.show(docId)
      if (!sharedDoc) {
        // Shared doc was removed — not actionable as drift
        continue
      }

      // Check for pending update: snapshot differs from current shared doc
      const diffResult = await SharedLayer.diff(docId, projectId)
      if (diffResult !== null && diffResult !== '') {
        // Shared doc was updated since last review
        const reviewDir = path.join(REVIEWS_DIR, projectId)
        const reviewPath = path.join(reviewDir, `${docId}.md`)
        let daysSinceUpdate = 0
        try {
          const stat = await fs.stat(reviewPath)
          daysSinceUpdate = Math.floor((Date.now() - stat.mtimeMs) / 86_400_000)
        } catch {
          // ignore
        }
        findings.push({
          sharedDocId: docId,
          docRef,
          classification: 'pending-update',
          description: `${docRef} was updated${daysSinceUpdate > 0 ? ` ${daysSinceUpdate} day(s) ago` : ''}`,
          hint: `Run \`curaye shared diff ${docId} --project ${projectId}\` to review`,
        })
        continue
      }

      // Check for intentional local override
      const isOverride = await hasLocalOverride(project, docRef)
      if (isOverride) {
        // Intentional — not drift, skip
        continue
      }

      // Text comparison — detect potential drift
      const driftDescription = computeTermDrift(sharedDoc.raw, localContent)
      if (driftDescription !== null) {
        findings.push({
          sharedDocId: docId,
          docRef,
          classification: 'drift',
          description: driftDescription,
          hint: `Is this intentional? Record a local override decision or update your local content.`,
        })
      }
    }

    return {
      projectId,
      projectPath: project.path,
      checkedCount: adopts.length,
      findings,
    }
  }

  /** Check all registered projects and return per-project reports. */
  static async checkAll(): Promise<DriftReport[]> {
    const projects = await ProjectRegistry.read()
    const reports: DriftReport[] = []
    for (const project of projects) {
      const report = await DriftDetector.checkProject(project)
      reports.push(report)
    }
    return reports
  }

  /** Persist an ignore for (projectId, docId). */
  static async addIgnore(projectId: string, docId: string): Promise<void> {
    const data = await readIgnoresFile()
    const alreadyIgnored = data.ignores.some(
      (e) => e.projectId === projectId && e.docId === docId,
    )
    if (!alreadyIgnored) {
      data.ignores.push({
        projectId,
        docId,
        ignoredAt: new Date().toISOString().slice(0, 10),
      })
      await writeIgnoresFile(data)
    }
  }

  /** Clear all ignores for a project (called after sync). */
  static async clearIgnores(projectId: string): Promise<void> {
    const data = await readIgnoresFile()
    const filtered = data.ignores.filter((e) => e.projectId !== projectId)
    if (filtered.length !== data.ignores.length) {
      await writeIgnoresFile({ ignores: filtered })
    }
  }

  /** Count unresolved drift findings for a project (no-ignore suppression — for desktop badge). */
  static async countDrift(project: RegistryProject): Promise<number> {
    const report = await DriftDetector.checkProject(project)
    return report.findings.filter((f) => f.classification === 'drift').length
  }
}
