import type { Command } from 'commander'
import { ProjectRegistry, SearchIndexManager, scanProject } from '@curaye/core'
import type { ParsedDocument } from '@curaye/protocol'
import { readAiConfig, isAvailable, createEmbedProvider } from '@curaye/ai'
import { isJsonMode, printJson, printLine } from '../lib/output.js'
import { resolveProject } from '../lib/context.js'

// ── Keyword search ────────────────────────────────────────────────────────────

function extractSnippet(body: string, query: string, maxLen = 120): string {
  const lower = body.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return body.slice(0, maxLen).replace(/\n/g, ' ').trim()
  const start = Math.max(0, idx - 40)
  const end = Math.min(body.length, idx + query.length + 80)
  return (start > 0 ? '…' : '') + body.slice(start, end).replace(/\n/g, ' ').trim() + (end < body.length ? '…' : '')
}

interface KeywordHit {
  projectId: string
  id: string | null
  type: string
  title: string
  filePath: string
  snippet: string
}

function searchDocs(docs: ParsedDocument[], type: string, query: string, projectId: string): KeywordHit[] {
  const hits: KeywordHit[] = []
  for (const doc of docs) {
    const haystack = (doc.body + ' ' + JSON.stringify(doc.frontmatter)).toLowerCase()
    if (haystack.includes(query.toLowerCase())) {
      hits.push({
        projectId,
        id: doc.id ?? null,
        type,
        title: (doc.frontmatter as { title?: string }).title ?? doc.id ?? '',
        filePath: doc.path,
        snippet: extractSnippet(doc.body, query),
      })
    }
  }
  return hits
}

async function runKeywordSearch(
  query: string,
  opts: { project?: string; type?: string },
): Promise<KeywordHit[]> {
  const hits: KeywordHit[] = []
  const types = opts.type !== undefined ? [opts.type] : ['planned', 'current', 'decisions', 'shipped']

  async function searchProject(projectId: string, curiyePath: string): Promise<void> {
    const index = await scanProject(curiyePath)
    if (types.includes('planned')) hits.push(...searchDocs(index.planned, 'planned', query, projectId))
    if (types.includes('current')) hits.push(...searchDocs(index.current, 'current', query, projectId))
    if (types.includes('decisions')) hits.push(...searchDocs(index.decisions, 'decisions', query, projectId))
    if (types.includes('shipped')) hits.push(...searchDocs(index.shipped, 'shipped', query, projectId))
  }

  if (opts.project !== undefined) {
    const project = await resolveProject(opts.project)
    await searchProject(project.id, ProjectRegistry.curiyePath(project))
  } else {
    const projects = await ProjectRegistry.read()
    for (const project of projects) {
      await searchProject(project.id, ProjectRegistry.curiyePath(project))
    }
  }

  return hits
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stars(score: number): string {
  const filled = Math.round(score * 5)
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

// ── Command ───────────────────────────────────────────────────────────────────

export function registerSearch(program: Command): void {
  program
    .command('search <query>')
    .description('Search across .curaye/ documents (semantic if indexed, keyword fallback)')
    .option('--project <id>', 'Search within a specific project')
    .option('--type <type>', 'Filter by type: planned, current, decisions, shipped')
    .option('--limit <n>', 'Maximum results to return', '10')
    .action(async (query: string, opts: { project?: string; type?: string; limit?: string }) => {
      const limit = parseInt(opts.limit ?? '10', 10)
      const aiConfig = await readAiConfig()
      const aiReady = isAvailable(aiConfig)
      const indexExists = await SearchIndexManager.indexExists()

      // ── Semantic mode ─────────────────────────────────────────────────────
      if (aiReady && indexExists && aiConfig !== null) {
        const embedProvider = createEmbedProvider(aiConfig)
        if (embedProvider !== null) {
          let queryVector: number[]
          try {
            queryVector = await embedProvider.embed(query)
          } catch {
            printLine('Warning: embedding failed, falling back to keyword search.\n')
            await runKeywordFallback()
            return
          }

          const results = await SearchIndexManager.search(queryVector, {
            ...(opts.project !== undefined ? { projectId: opts.project } : {}),
            ...(opts.type !== undefined ? { type: opts.type } : {}),
            limit,
          })

          // Stale check: are there keyword-matching files not present in the index?
          const indexedPaths = await SearchIndexManager.getIndexedPaths()
          const keyHits = await runKeywordSearch(query, opts)
          const hasUnindexed = keyHits.some((h) => !indexedPaths.has(h.filePath))

          if (isJsonMode()) {
            printJson({ mode: 'semantic', results, stale: hasUnindexed })
            return
          }

          const projects = await ProjectRegistry.read()
          const projectCount = opts.project !== undefined ? 1 : projects.length
          printLine(`Results (semantic, across ${projectCount} project${projectCount === 1 ? '' : 's'}):\n`)

          if (results.length === 0) {
            printLine(`  No semantic results for "${query}".`)
          } else {
            for (const r of results) {
              const filename = r.filePath.split('/').pop() ?? ''
              printLine(`  ${stars(r.score)}  ${r.projectId} / ${r.type} / ${filename}`)
              printLine(`          "${r.snippet}"\n`)
            }
          }

          if (hasUnindexed) {
            printLine('Index is stale — run `curaye index` for complete semantic results.')
          }
          return
        }
      }

      // ── Keyword fallback ──────────────────────────────────────────────────
      async function runKeywordFallback(): Promise<void> {
        if (!indexExists) {
          printLine('Note: No semantic index built. Run `curaye index --all` to enable semantic search.\n')
        }
        const hits = await runKeywordSearch(query, opts)

        if (isJsonMode()) {
          printJson({ mode: 'keyword', results: hits })
          return
        }

        if (hits.length === 0) {
          printLine(`No results for "${query}".`)
          return
        }

        printLine(`${hits.length} result(s) for "${query}" (keyword):\n`)
        for (const hit of hits) {
          printLine(`[${hit.projectId}] ${hit.type}/${hit.id ?? '?'} — ${hit.title}`)
          printLine(`  ${hit.filePath}`)
          printLine(`  ${hit.snippet}\n`)
        }
      }

      await runKeywordFallback()
    })
}
