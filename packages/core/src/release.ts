import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import { scanProject } from './scanner.js'
import type { PlannedFrontmatter, ReleaseFrontmatter } from '@curaye/protocol'

export interface ReleaseSummary {
  id: string
  title: string
  status: string
  target: string | null
  path: string
  total: number
  done: number
}

function slugify(name: string): string {
  return name.replace(/\./g, '-').replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function coerceDates(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v
  }
  return out
}

export class ReleaseManager {
  static releasesDir(curiyePath: string): string {
    return path.join(curiyePath, 'releases')
  }

  static async list(curiyePath: string): Promise<ReleaseSummary[]> {
    const releasesDir = this.releasesDir(curiyePath)
    let files: string[]
    try {
      files = await fs.readdir(releasesDir)
    } catch {
      return []
    }

    const mdFiles = files.filter((f) => f.endsWith('.md')).sort()
    const index = await scanProject(curiyePath)

    const summaries: ReleaseSummary[] = []
    for (const filename of mdFiles) {
      const filePath = path.join(releasesDir, filename)
      const raw = await fs.readFile(filePath, 'utf8')
      let parsed: matter.GrayMatterFile<string>
      try {
        parsed = matter(raw)
      } catch {
        continue
      }
      const fm = coerceDates(parsed.data as Record<string, unknown>) as Partial<ReleaseFrontmatter>
      const releaseId = (fm.id as string | undefined) ?? filename.replace(/\.md$/, '')

      const specs = index.planned.filter((s) => {
        const pfm = s.frontmatter as PlannedFrontmatter
        return (pfm.release ?? '') === releaseId
      })

      const nonShelved = specs.filter((s) => {
        const pfm = s.frontmatter as PlannedFrontmatter
        return pfm.status !== 'shelved'
      })

      const done = nonShelved.filter((s) => {
        const pfm = s.frontmatter as PlannedFrontmatter
        return pfm.status === 'done'
      })

      summaries.push({
        id: releaseId,
        title: (fm.title as string | undefined) ?? releaseId,
        status: (fm.status as string | undefined) ?? 'planning',
        target: (fm.target as string | undefined) ?? null,
        path: filePath,
        total: nonShelved.length,
        done: done.length,
      })
    }

    return summaries
  }

  static async create(
    curiyePath: string,
    name: string,
    today: string,
    target?: string,
  ): Promise<ReleaseSummary> {
    const releasesDir = this.releasesDir(curiyePath)
    await fs.mkdir(releasesDir, { recursive: true })

    const id = slugify(name)
    const filename = `${id}.md`
    const filePath = path.join(releasesDir, filename)

    const lines = [
      '---',
      `id: ${id}`,
      `title: "${name}"`,
      `status: planning`,
    ]
    if (target) lines.push(`target: ${target}`)
    lines.push(`created: ${today}`)
    lines.push(`updated: ${today}`)
    lines.push('---')
    lines.push('')
    lines.push(`# ${name}`)
    lines.push('')

    const content = lines.join('\n')
    const tmp = filePath + '.tmp'
    await fs.writeFile(tmp, content, 'utf8')
    await fs.rename(tmp, filePath)

    return { id, title: name, status: 'planning', target: target ?? null, path: filePath, total: 0, done: 0 }
  }

  static async assign(
    specPath: string,
    releaseId: string,
    today: string,
  ): Promise<void> {
    const raw = await fs.readFile(specPath, 'utf8')
    let parsed: matter.GrayMatterFile<string>
    try {
      parsed = matter(raw)
    } catch {
      throw new Error(`Failed to parse frontmatter in ${specPath}`)
    }
    const fm = { ...parsed.data as Record<string, unknown> }
    fm['release'] = releaseId
    fm['updated'] = today
    const updated = matter.stringify(parsed.content, fm)
    const tmp = specPath + '.tmp'
    await fs.writeFile(tmp, updated, 'utf8')
    await fs.rename(tmp, specPath)
  }

  static async markReleaseStatus(
    releasePath: string,
    status: string,
    today: string,
  ): Promise<void> {
    const raw = await fs.readFile(releasePath, 'utf8')
    let parsed: matter.GrayMatterFile<string>
    try {
      parsed = matter(raw)
    } catch {
      throw new Error(`Failed to parse frontmatter in ${releasePath}`)
    }
    const fm = { ...parsed.data as Record<string, unknown> }
    fm['status'] = status
    fm['updated'] = today
    const updated = matter.stringify(parsed.content, fm)
    const tmp = releasePath + '.tmp'
    await fs.writeFile(tmp, updated, 'utf8')
    await fs.rename(tmp, releasePath)
  }
}
