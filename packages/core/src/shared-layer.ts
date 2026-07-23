import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { load as yamlLoad, dump as yamlDump } from 'js-yaml'
import { SharedLayerError } from './errors.js'
import { ProjectRegistry } from './registry.js'

export const SHARED_DIR = path.join(os.homedir(), '.curaye', 'shared')
export const CATEGORIES = ['decisions', 'patterns', 'design', 'agents', 'stack'] as const
export type SharedCategory = (typeof CATEGORIES)[number]

const NOTIFICATIONS_PATH = path.join(os.homedir(), '.curaye', 'notifications.yaml')
const REVIEWS_DIR = path.join(os.homedir(), '.curaye', 'shared-reviews')

export interface SharedDocument {
  id: string
  category: SharedCategory
  filePath: string
  title: string
  raw: string
}

export interface PromoteInput {
  sourcePath: string
  sourceSection: string
  category: SharedCategory
  id: string
  projectId: string
  content: string
}

export interface PromoteResult {
  sharedPath: string
  docRef: string
  isUpdate: boolean
}

export interface SharedNotification {
  docId: string
  category: SharedCategory
  adoptedBy: string[]
  updatedAt: string
}

function parseFrontmatter(raw: string): { fm: Record<string, unknown>; body: string } {
  const stripped = raw.trimStart()
  if (!stripped.startsWith('---')) return { fm: {}, body: raw }
  const rest = stripped.slice(3)
  const end = rest.indexOf('\n---')
  if (end < 0) return { fm: {}, body: raw }
  const yamlStr = rest.slice(0, end)
  const body = rest.slice(end + 4)
  const fm = (yamlLoad(yamlStr) as Record<string, unknown> | null) ?? {}
  return { fm, body }
}

function buildFrontmatterString(fm: Record<string, unknown>, body: string): string {
  return `---\n${yamlDump(fm, { lineWidth: -1 })}---${body}`
}

interface NotificationsFile {
  notifications: SharedNotification[]
}

async function readNotificationsFile(): Promise<NotificationsFile> {
  try {
    const raw = await fs.readFile(NOTIFICATIONS_PATH, 'utf8')
    const parsed = yamlLoad(raw) as NotificationsFile | null
    if (!parsed || typeof parsed !== 'object') return { notifications: [] }
    return { notifications: parsed.notifications ?? [] }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { notifications: [] }
    throw new SharedLayerError(`Failed to read notifications: ${(err as Error).message}`)
  }
}

async function writeNotificationsFile(data: NotificationsFile): Promise<void> {
  const dir = path.dirname(NOTIFICATIONS_PATH)
  await fs.mkdir(dir, { recursive: true })
  const tmp = NOTIFICATIONS_PATH + '.tmp'
  await fs.writeFile(tmp, yamlDump(data, { lineWidth: -1 }), 'utf8')
  await fs.rename(tmp, NOTIFICATIONS_PATH)
}

function extractTitle(raw: string, fallback: string): string {
  const match = raw.match(/^title:\s*["']?(.+?)["']?\s*$/m)
  return match?.[1] ?? fallback
}

export class SharedLayer {
  /** Create ~/.curaye/shared/ with all category subfolders. Idempotent. */
  static async init(): Promise<void> {
    for (const category of CATEGORIES) {
      await fs.mkdir(path.join(SHARED_DIR, category), { recursive: true })
    }
  }

  /** List shared documents, optionally filtered by category. */
  static async list(category?: SharedCategory): Promise<SharedDocument[]> {
    const results: SharedDocument[] = []
    const categoriesToScan = category ? [category] : [...CATEGORIES]
    for (const cat of categoriesToScan) {
      const dir = path.join(SHARED_DIR, cat)
      let entries: string[]
      try {
        entries = await fs.readdir(dir)
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.endsWith('.md')) continue
        const filePath = path.join(dir, entry)
        const raw = await fs.readFile(filePath, 'utf8').catch(() => '')
        const id = entry.replace(/\.md$/, '')
        results.push({ id, category: cat, filePath, title: extractTitle(raw, id), raw })
      }
    }
    return results
  }

  /** Read a single shared document by id. Returns null if not found. */
  static async show(id: string): Promise<SharedDocument | null> {
    for (const cat of CATEGORIES) {
      const filePath = path.join(SHARED_DIR, cat, `${id}.md`)
      try {
        const raw = await fs.readFile(filePath, 'utf8')
        return { id, category: cat, filePath, title: extractTitle(raw, id), raw }
      } catch {
        // not in this category
      }
    }
    return null
  }

  /** Record the current state of a shared doc as "reviewed" by the given project. */
  static async recordReview(docId: string, projectId: string): Promise<void> {
    const doc = await SharedLayer.show(docId)
    if (!doc) throw new SharedLayerError(`Shared document '${docId}' not found`)
    const reviewDir = path.join(REVIEWS_DIR, projectId)
    await fs.mkdir(reviewDir, { recursive: true })
    const reviewPath = path.join(reviewDir, `${docId}.md`)
    const tmp = reviewPath + '.tmp'
    await fs.writeFile(tmp, doc.raw, 'utf8')
    await fs.rename(tmp, reviewPath)
  }

  /**
   * Diff a shared document against the snapshot recorded when the project last reviewed it.
   * Returns a unified-style diff string, or null if no review has been recorded yet.
   */
  static async diff(docId: string, projectId: string): Promise<string | null> {
    const doc = await SharedLayer.show(docId)
    if (!doc) throw new SharedLayerError(`Shared document '${docId}' not found`)

    const reviewPath = path.join(REVIEWS_DIR, projectId, `${docId}.md`)
    let baseline: string
    try {
      baseline = await fs.readFile(reviewPath, 'utf8')
    } catch {
      return null
    }

    if (baseline === doc.raw) return ''
    return buildDiff(baseline, doc.raw, `shared/${doc.category}/${docId}.md (reviewed)`, `shared/${doc.category}/${docId}.md (current)`)
  }

  /** Write a notification that a shared doc was updated and which projects have adopted it. */
  static async notifyUpdate(docId: string, category: SharedCategory, adoptedBy: string[]): Promise<void> {
    if (adoptedBy.length === 0) return
    const data = await readNotificationsFile()
    const existing = data.notifications.findIndex((n) => n.docId === docId)
    const entry: SharedNotification = {
      docId,
      category,
      adoptedBy,
      updatedAt: new Date().toISOString().slice(0, 10),
    }
    if (existing >= 0) {
      data.notifications[existing] = entry
    } else {
      data.notifications.push(entry)
    }
    await writeNotificationsFile(data)
  }

  /** List all pending notifications. */
  static async listNotifications(): Promise<SharedNotification[]> {
    const data = await readNotificationsFile()
    return data.notifications
  }

  /** Remove a notification for a (docId, projectId) pair. */
  static async markReviewed(docId: string, projectId: string): Promise<void> {
    const data = await readNotificationsFile()
    const idx = data.notifications.findIndex((n) => n.docId === docId)
    if (idx < 0) return
    const notification = data.notifications[idx]
    if (!notification) return
    const remaining = notification.adoptedBy.filter((id) => id !== projectId)
    if (remaining.length === 0) {
      data.notifications.splice(idx, 1)
    } else {
      data.notifications[idx] = { ...notification, adoptedBy: remaining }
    }
    await writeNotificationsFile(data)
  }

  /**
   * Promote a project document to the shared layer.
   * Writes to ~/.curaye/shared/<category>/<id>.md, adds shared-layer frontmatter,
   * records the originating project as an adopter, and notifies all other registered projects.
   */
  static async promote(input: PromoteInput): Promise<PromoteResult> {
    const { sourcePath, sourceSection, category, id, projectId, content } = input

    if (sourceSection === 'planned') {
      throw new SharedLayerError('Only current/ and decisions/ documents can be promoted.')
    }

    const categoryDir = path.join(SHARED_DIR, category)
    await fs.mkdir(categoryDir, { recursive: true })

    const sharedPath = path.join(categoryDir, `${id}.md`)
    const docRef = `shared/${category}/${id}`

    // Check for existing promotion (idempotent update)
    let isUpdate = false
    let existingAdopted: string[] = []
    try {
      const existingRaw = await fs.readFile(sharedPath, 'utf8')
      const { fm: existingFm } = parseFrontmatter(existingRaw)
      const raw = existingFm['adopted_by']
      existingAdopted = Array.isArray(raw)
        ? (raw as unknown[]).filter((x): x is string => typeof x === 'string')
        : []
      isUpdate = true
    } catch {
      // New promotion — no existing file
    }

    // Build frontmatter: preserve original fields, add shared-layer metadata
    const { fm, body } = parseFrontmatter(content)
    const today = new Date().toISOString().slice(0, 10)
    const adoptedBy = [...new Set([...existingAdopted, projectId])]

    fm['source_project'] = projectId
    fm['promoted'] = today
    fm['adopted_by'] = adoptedBy

    const sharedContent = buildFrontmatterString(fm, body)
    const tmp = sharedPath + '.tmp'
    await fs.writeFile(tmp, sharedContent, 'utf8')
    await fs.rename(tmp, sharedPath)

    // Notify all other registered projects
    const allProjects = await ProjectRegistry.read()
    const otherProjectIds = allProjects
      .map((p) => p.id || p.name)
      .filter((pid) => pid !== projectId)
    if (otherProjectIds.length > 0) {
      await SharedLayer.notifyUpdate(id, category, otherProjectIds)
    }

    return { sharedPath, docRef, isUpdate }
  }

  /** Add promoted_to: <docRef> to a source document's frontmatter. */
  static async markPromotedSource(sourcePath: string, docRef: string): Promise<void> {
    const raw = await fs.readFile(sourcePath, 'utf8')
    const { fm, body } = parseFrontmatter(raw)
    fm['promoted_to'] = docRef
    const updated = buildFrontmatterString(fm, body)
    const tmp = sourcePath + '.tmp'
    await fs.writeFile(tmp, updated, 'utf8')
    await fs.rename(tmp, sourcePath)
  }
}

function buildDiff(a: string, b: string, labelA: string, labelB: string): string {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const hunks: string[] = [`--- ${labelA}`, `+++ ${labelB}`]

  // Simple LCS-based line diff
  const lcs = computeLcs(aLines, bLines)
  let ai = 0
  let bi = 0
  let li = 0

  while (ai < aLines.length || bi < bLines.length) {
    if (li < lcs.length && ai < aLines.length && bi < bLines.length && aLines[ai] === lcs[li] && bLines[bi] === lcs[li]) {
      hunks.push(` ${aLines[ai] ?? ''}`)
      ai++; bi++; li++
    } else if (bi < bLines.length && (li >= lcs.length || bLines[bi] !== lcs[li])) {
      hunks.push(`+${bLines[bi] ?? ''}`)
      bi++
    } else {
      hunks.push(`-${aLines[ai] ?? ''}`)
      ai++
    }
  }

  return hunks.join('\n')
}

function computeLcs(a: string[], b: string[]): string[] {
  const m = a.length
  const n = b.length
  // dp[i][j] = length of LCS of a[0..i-1] and b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = (dp[i - 1]![j - 1] ?? 0) + 1
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j] ?? 0, dp[i]![j - 1] ?? 0)
      }
    }
  }
  // Backtrack
  const result: string[] = []
  let i = m; let j = n
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]!)
      i--; j--
    } else if ((dp[i - 1]![j] ?? 0) > (dp[i]![j - 1] ?? 0)) {
      i--
    } else {
      j--
    }
  }
  return result
}
