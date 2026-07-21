import fs from 'fs/promises'
import path from 'path'
import {
  parse,
  isDraft,
  sortOrder,
} from '@curaye/protocol'
import type {
  ParsedDocument,
  PlannedFrontmatter,
  CurrentFrontmatter,
  ShippedFrontmatter,
  DecisionFrontmatter,
  RootDocFrontmatter,
} from '@curaye/protocol'
import { CurayeNotFoundError } from './errors.js'

export interface ScanWarning {
  path: string
  message: string
}

export interface ProjectIndex {
  projectId: string
  curiyePath: string
  root: {
    prd: ParsedDocument<RootDocFrontmatter> | null
    stack: ParsedDocument<RootDocFrontmatter> | null
    product: ParsedDocument<RootDocFrontmatter> | null
  }
  planned: ParsedDocument<PlannedFrontmatter>[]
  current: ParsedDocument<CurrentFrontmatter>[]
  shipped: ParsedDocument<ShippedFrontmatter>[]
  decisions: ParsedDocument<DecisionFrontmatter>[]
  drafts: ParsedDocument[]
  warnings: ScanWarning[]
}

async function readRootDoc(
  filePath: string,
  warnings: ScanWarning[],
): Promise<ParsedDocument<RootDocFrontmatter> | null> {
  try {
    await fs.access(filePath)
  } catch {
    warnings.push({ path: filePath, message: `Root document not found: ${path.basename(filePath)}` })
    return null
  }
  const raw = await fs.readFile(filePath, 'utf8')
  return parse(raw, 'root', filePath) as ParsedDocument<RootDocFrontmatter>
}

async function scanFolder<T>(
  folderPath: string,
  type: 'planned' | 'current' | 'shipped' | 'decisions',
  drafts: ParsedDocument[],
  warnings: ScanWarning[],
): Promise<ParsedDocument<T>[]> {
  let entries: string[]
  try {
    entries = await fs.readdir(folderPath)
  } catch {
    warnings.push({ path: folderPath, message: `Folder not found: ${path.basename(folderPath)}` })
    return []
  }

  const mdFiles = entries.filter((f) => f.endsWith('.md'))
  const docs: ParsedDocument<T>[] = []

  for (const filename of mdFiles) {
    const filePath = path.join(folderPath, filename)
    const raw = await fs.readFile(filePath, 'utf8')
    const doc = parse(raw, type, filePath)

    if (isDraft(filename)) {
      drafts.push(doc)
    } else {
      docs.push(doc as ParsedDocument<T>)
    }
  }

  docs.sort((a, b) => {
    const aOrder = sortOrder(path.basename(a.path))
    const bOrder = sortOrder(path.basename(b.path))
    if (aOrder !== null && bOrder !== null) return aOrder - bOrder
    if (aOrder !== null) return -1
    if (bOrder !== null) return 1
    return path.basename(a.path).localeCompare(path.basename(b.path))
  })

  return docs
}

export async function scanProject(curiyePath: string): Promise<ProjectIndex> {
  try {
    const stat = await fs.stat(curiyePath)
    if (!stat.isDirectory()) throw new CurayeNotFoundError(curiyePath)
  } catch (err) {
    if (err instanceof CurayeNotFoundError) throw err
    throw new CurayeNotFoundError(curiyePath)
  }

  const warnings: ScanWarning[] = []
  const drafts: ParsedDocument[] = []

  const [prd, stack, product, planned, current, shipped, decisions] = await Promise.all([
    readRootDoc(path.join(curiyePath, 'prd.md'), warnings),
    readRootDoc(path.join(curiyePath, 'stack.md'), warnings),
    readRootDoc(path.join(curiyePath, 'product.md'), warnings),
    scanFolder<PlannedFrontmatter>(path.join(curiyePath, 'planned'), 'planned', drafts, warnings),
    scanFolder<CurrentFrontmatter>(path.join(curiyePath, 'current'), 'current', drafts, warnings),
    scanFolder<ShippedFrontmatter>(path.join(curiyePath, 'shipped'), 'shipped', drafts, warnings),
    scanFolder<DecisionFrontmatter>(path.join(curiyePath, 'decisions'), 'decisions', drafts, warnings),
  ])

  const projectId = path.basename(path.dirname(curiyePath))

  return {
    projectId,
    curiyePath,
    root: { prd, stack, product },
    planned,
    current,
    shipped,
    decisions,
    drafts,
    warnings,
  }
}
