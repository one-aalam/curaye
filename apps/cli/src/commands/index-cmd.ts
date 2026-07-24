import type { Command } from 'commander'
import { ProjectRegistry, SearchIndexManager, scanProject, SharedLayer, SHARED_DIR } from '@curaye/core'
import type { DocToIndex } from '@curaye/core'
import { readAiConfig, isAvailable, createEmbedProvider } from '@curaye/ai'
import { isJsonMode, printJson, printLine, die } from '../lib/output.js'
import { resolveProject } from '../lib/context.js'

async function collectSharedDocs(): Promise<DocToIndex[]> {
  const docs: DocToIndex[] = []
  const sharedDocs = await SharedLayer.list()
  for (const doc of sharedDocs) {
    const type: DocToIndex['type'] = doc.category === 'decisions' ? 'decisions' : 'current'
    docs.push({ projectId: 'shared', type, title: doc.title, filePath: doc.filePath, body: doc.raw })
  }
  return docs
}

async function collectDocs(curiyePath: string, projectId: string): Promise<DocToIndex[]> {
  const index = await scanProject(curiyePath)
  const docs: DocToIndex[] = []
  for (const doc of index.planned) {
    docs.push({ projectId, type: 'planned', title: (doc.frontmatter as { title?: string }).title ?? doc.id ?? '', filePath: doc.path, body: doc.body })
  }
  for (const doc of index.current) {
    docs.push({ projectId, type: 'current', title: (doc.frontmatter as { title?: string }).title ?? doc.id ?? '', filePath: doc.path, body: doc.body })
  }
  for (const doc of index.decisions) {
    docs.push({ projectId, type: 'decisions', title: (doc.frontmatter as { title?: string }).title ?? doc.id ?? '', filePath: doc.path, body: doc.body })
  }
  for (const doc of index.shipped) {
    docs.push({ projectId, type: 'shipped', title: (doc.frontmatter as { title?: string }).title ?? doc.id ?? '', filePath: doc.path, body: doc.body })
  }
  return docs
}

export function registerIndexCmd(program: Command): void {
  const indexCmd = program
    .command('index')
    .description('Build or update the semantic search index')

  indexCmd
    .command('status')
    .description('Show index status and coverage')
    .action(async () => {
      const status = await SearchIndexManager.status()
      if (isJsonMode()) {
        printJson(status)
        return
      }
      if (!status.exists) {
        printLine('No index built. Run: curaye index --all')
        return
      }
      printLine(`Index: ${status.count ?? 0} documents`)
      printLine(`Indexed at: ${status.indexedAt ?? 'unknown'}`)
      if (status.projects && status.projects.length > 0) {
        printLine(`Projects: ${status.projects.join(', ')}`)
      }
    })

  indexCmd
    .argument('[project]', 'Project id to index (omit with --all to index everything)')
    .option('--all', 'Index all registered projects')
    .action(async (projectArg: string | undefined, opts: { all?: boolean }) => {
      const aiConfig = await readAiConfig()
      if (!isAvailable(aiConfig)) {
        die('No AI provider configured. Add one with: curaye ai setup')
      }

      const embedProvider = createEmbedProvider(aiConfig!)
      if (embedProvider === null) {
        die('No embedding provider available. Configure ai.embed in ~/.curaye/config.yaml or use Ollama/OpenAI as the main provider.')
      }

      const embedFn = (text: string) => embedProvider.embed(text)

      let docs: DocToIndex[] = []

      if (opts.all) {
        const projects = await ProjectRegistry.read()
        if (projects.length === 0) {
          die('No registered projects. Run: curaye link')
        }
        for (const project of projects) {
          const curiyePath = ProjectRegistry.curiyePath(project)
          const projectDocs = await collectDocs(curiyePath, project.id)
          docs = docs.concat(projectDocs)
        }
        const sharedDocs = await collectSharedDocs()
        if (sharedDocs.length > 0) {
          docs = docs.concat(sharedDocs)
          printLine(`  + ${sharedDocs.length} shared-layer document(s) from ${SHARED_DIR}`)
        }
      } else if (projectArg !== undefined) {
        const project = await resolveProject(projectArg)
        const curiyePath = ProjectRegistry.curiyePath(project)
        docs = await collectDocs(curiyePath, project.id)
      } else {
        const project = await resolveProject(undefined)
        const curiyePath = ProjectRegistry.curiyePath(project)
        docs = await collectDocs(curiyePath, project.id)
      }

      if (docs.length === 0) {
        printLine('No documents found to index.')
        return
      }

      printLine(`Indexing ${docs.length} document(s)…`)
      const stats = await SearchIndexManager.build(docs, embedFn)

      if (isJsonMode()) {
        printJson(stats)
        return
      }

      printLine(`Done. ${stats.embedded} embedded, ${stats.skipped} unchanged, ${stats.total} total.`)
    })
}
