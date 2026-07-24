import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { Index, MetricKind, ScalarKind } from 'usearch'
import { SearchIndexError } from './errors.js'

export type EmbedFn = (text: string) => Promise<number[]>

export type IndexableDocType = 'planned' | 'current' | 'decisions' | 'shipped'

export interface DocToIndex {
  projectId: string
  type: IndexableDocType
  title: string
  filePath: string
  body: string
}

interface ManifestEntry {
  key: string
  projectId: string
  type: string
  title: string
  filePath: string
  snippet: string
  contentHash: string
  vector: string
}

interface Manifest {
  version: 1
  dimensions: number
  indexedAt: string
  entries: ManifestEntry[]
}

export interface SearchResult {
  projectId: string
  type: string
  title: string
  filePath: string
  snippet: string
  score: number
}

export interface SearchOpts {
  projectId?: string
  type?: string
  limit?: number
}

export interface IndexStatus {
  exists: boolean
  indexedAt?: string
  count?: number
  projects?: string[]
}

export interface BuildStats {
  embedded: number
  skipped: number
  total: number
}

const INDEX_DIR = path.join(os.homedir(), '.curaye', 'index')
export const INDEX_PATH = path.join(INDEX_DIR, 'index.usearch')
const MANIFEST_PATH = path.join(INDEX_DIR, 'manifest.json')

function sha256Short(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)
}

function extractSnippet(body: string, maxLen = 200): string {
  const clean = body.slice(0, maxLen).replace(/\n+/g, ' ').trim()
  return body.length > maxLen ? clean + '…' : clean
}

function float32ToBase64(arr: Float32Array): string {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).toString('base64')
}

function base64ToFloat32(b64: string): Float32Array {
  const buf = Buffer.from(b64, 'base64')
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
}

function scoreFromDistance(distance: number): number {
  // Cosine distance = 1 - cos_similarity; clamp to [0, 1]
  return Math.max(0, Math.min(1, 1 - distance))
}

async function readManifest(): Promise<Manifest | null> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf8')
    return JSON.parse(raw) as Manifest
  } catch {
    return null
  }
}

async function writeManifest(manifest: Manifest): Promise<void> {
  const tmp = MANIFEST_PATH + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(manifest, null, 2), 'utf8')
  await fs.rename(tmp, MANIFEST_PATH)
}

function makeIndex(dimensions: number): Index {
  return new Index({
    dimensions,
    metric: MetricKind.Cos,
    quantization: ScalarKind.F32,
    connectivity: 16,
    expansion_add: 128,
    expansion_search: 64,
    multi: false,
  })
}

export class SearchIndexManager {
  static async build(docs: DocToIndex[], embedFn: EmbedFn): Promise<BuildStats> {
    await fs.mkdir(INDEX_DIR, { recursive: true })

    const existing = await readManifest()
    const existingByPath = new Map<string, ManifestEntry>()
    if (existing) {
      for (const e of existing.entries) {
        existingByPath.set(e.filePath, e)
      }
    }

    const entries: ManifestEntry[] = []
    const vectors: Float32Array[] = []
    let embedded = 0
    let skipped = 0
    let dimensions = 0

    for (const doc of docs) {
      const hash = sha256Short(doc.body)
      const prev = existingByPath.get(doc.filePath)

      let vector: Float32Array
      if (prev !== undefined && prev.contentHash === hash) {
        vector = base64ToFloat32(prev.vector)
        skipped++
      } else {
        const nums = await embedFn(doc.body)
        vector = new Float32Array(nums)
        embedded++
      }

      dimensions = vector.length
      entries.push({
        key: String(entries.length),
        projectId: doc.projectId,
        type: doc.type,
        title: doc.title,
        filePath: doc.filePath,
        snippet: extractSnippet(doc.body),
        contentHash: hash,
        vector: float32ToBase64(vector),
      })
      vectors.push(vector)
    }

    if (dimensions === 0) {
      await writeManifest({ version: 1, dimensions: 0, indexedAt: new Date().toISOString(), entries: [] })
      return { embedded: 0, skipped: 0, total: 0 }
    }

    const index = makeIndex(dimensions)
    for (const [i, entry] of entries.entries()) {
      const vec = vectors[i]
      if (vec === undefined) continue
      index.add(BigInt(entry.key), vec)
    }
    index.save(INDEX_PATH)

    await writeManifest({ version: 1, dimensions, indexedAt: new Date().toISOString(), entries })
    return { embedded, skipped, total: docs.length }
  }

  static async search(queryVector: number[], opts: SearchOpts = {}): Promise<SearchResult[]> {
    const manifest = await readManifest()
    if (manifest === null || manifest.entries.length === 0 || manifest.dimensions === 0) return []

    let index: Index
    try {
      index = makeIndex(manifest.dimensions)
      index.load(INDEX_PATH)
    } catch (err) {
      throw new SearchIndexError(`Failed to load index: ${(err as Error).message}`)
    }

    const limit = opts.limit ?? 10
    const indexSize = index.size()
    const k = Math.min(indexSize, Math.max(limit * 10, 50))
    if (k === 0) return []

    const qv = new Float32Array(queryVector)
    const matches = index.search(qv, k, 0)

    const results: SearchResult[] = []
    for (let i = 0; i < matches.keys.length; i++) {
      const key = matches.keys[i]
      if (key === undefined) continue
      const distance = matches.distances[i] ?? 1
      const entry = manifest.entries[Number(key)]
      if (entry === undefined) continue
      if (opts.projectId !== undefined && entry.projectId !== opts.projectId) continue
      if (opts.type !== undefined && entry.type !== opts.type) continue

      results.push({
        projectId: entry.projectId,
        type: entry.type,
        title: entry.title,
        filePath: entry.filePath,
        snippet: entry.snippet,
        score: scoreFromDistance(distance),
      })

      if (results.length >= limit) break
    }

    return results
  }

  static async status(): Promise<IndexStatus> {
    const manifest = await readManifest()
    if (manifest === null) return { exists: false }
    const projects = [...new Set(manifest.entries.map((e) => e.projectId))]
    return {
      exists: true,
      indexedAt: manifest.indexedAt,
      count: manifest.entries.length,
      projects,
    }
  }

  static async indexExists(): Promise<boolean> {
    try {
      await fs.access(INDEX_PATH)
      await fs.access(MANIFEST_PATH)
      return true
    } catch {
      return false
    }
  }

  static async getIndexedPaths(): Promise<Set<string>> {
    const manifest = await readManifest()
    if (manifest === null) return new Set()
    return new Set(manifest.entries.map((e) => e.filePath))
  }
}
