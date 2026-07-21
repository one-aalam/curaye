import type { Command } from 'commander'
import { ProjectRegistry, scanProject } from '@curaye/core'
import type { ParsedDocument } from '@curaye/protocol'
import { isJsonMode, printJson, printLine } from '../lib/output.js'
import { resolveProject } from '../lib/context.js'

interface SearchHit {
  projectId: string
  id: string | null
  type: string
  title: string
  filePath: string
  snippet: string
}

function extractSnippet(body: string, query: string, maxLen = 120): string {
  const lower = body.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return body.slice(0, maxLen).replace(/\n/g, ' ').trim()
  const start = Math.max(0, idx - 40)
  const end = Math.min(body.length, idx + query.length + 80)
  return (start > 0 ? '…' : '') + body.slice(start, end).replace(/\n/g, ' ').trim() + (end < body.length ? '…' : '')
}

function searchDocs(docs: ParsedDocument[], type: string, query: string, projectId: string): SearchHit[] {
  const hits: SearchHit[] = []
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

export function registerSearch(program: Command): void {
  program
    .command('search <query>')
    .description('Keyword search across .curaye/ documents')
    .option('--project <id>', 'Search within a specific project')
    .option('--type <type>', 'Filter by type: planned, current, decisions, shipped')
    .action(async (query: string, opts: { project?: string; type?: string }) => {
      const hits: SearchHit[] = []

      if (opts.project) {
        const project = await resolveProject(opts.project)
        const curiyePath = ProjectRegistry.curiyePath(project)
        const index = await scanProject(curiyePath)
        if (!opts.type || opts.type === 'planned') hits.push(...searchDocs(index.planned, 'planned', query, project.id))
        if (!opts.type || opts.type === 'current') hits.push(...searchDocs(index.current, 'current', query, project.id))
        if (!opts.type || opts.type === 'decisions') hits.push(...searchDocs(index.decisions, 'decisions', query, project.id))
        if (!opts.type || opts.type === 'shipped') hits.push(...searchDocs(index.shipped, 'shipped', query, project.id))
      } else {
        const projects = await ProjectRegistry.read()
        for (const project of projects) {
          const curiyePath = ProjectRegistry.curiyePath(project)
          const index = await scanProject(curiyePath)
          if (!opts.type || opts.type === 'planned') hits.push(...searchDocs(index.planned, 'planned', query, project.id))
          if (!opts.type || opts.type === 'current') hits.push(...searchDocs(index.current, 'current', query, project.id))
          if (!opts.type || opts.type === 'decisions') hits.push(...searchDocs(index.decisions, 'decisions', query, project.id))
          if (!opts.type || opts.type === 'shipped') hits.push(...searchDocs(index.shipped, 'shipped', query, project.id))
        }
      }

      if (isJsonMode()) {
        printJson(hits)
        return
      }

      if (hits.length === 0) {
        printLine(`No results for "${query}".`)
        return
      }

      printLine(`${hits.length} result(s) for "${query}":\n`)
      for (const hit of hits) {
        printLine(`[${hit.projectId}] ${hit.type}/${hit.id ?? '?'} — ${hit.title}`)
        printLine(`  ${hit.filePath}`)
        printLine(`  ${hit.snippet}\n`)
      }
    })
}
