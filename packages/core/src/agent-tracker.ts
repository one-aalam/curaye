import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { dump as yamlDump, load as yamlLoad } from 'js-yaml'
import type { RegistryProject } from './registry.js'
import { ProjectRegistry } from './registry.js'

export interface AgentFile {
  path: string
  last_seen_hash: string
  last_changed: string
}

export type AgentChangeType = 'created' | 'modified' | 'deleted'

export interface AgentLogEntry {
  date: string
  file: string
  change_type: AgentChangeType
  previous_hash: string | null
  current_hash: string | null
}

export interface AgentChange {
  entry: AgentLogEntry
  logFilePath: string
}

function sha256(content: Buffer): string {
  return 'sha256:' + crypto.createHash('sha256').update(content).digest('hex')
}

/** Finds all agent steering files relative to projectPath (one level above curiyePath). */
export async function detectAgentFiles(projectPath: string): Promise<Map<string, string>> {
  const results = new Map<string, string>()

  // Candidates: CLAUDE.md and AGENTS.md at root, *AGENTS*.md at root,
  // and CLAUDE.md up to 2 levels deep.
  const rootCandidates = await fs.readdir(projectPath).catch(() => [] as string[])
  for (const name of rootCandidates) {
    if (name === 'CLAUDE.md' || name === 'AGENTS.md' || (name.includes('AGENTS') && name.endsWith('.md'))) {
      const full = path.join(projectPath, name)
      try {
        const buf = await fs.readFile(full)
        results.set(name, sha256(buf))
      } catch {
        // file not readable
      }
    }
  }

  // Subdirectories up to 2 levels deep for CLAUDE.md
  for (const entry of rootCandidates) {
    const subDir = path.join(projectPath, entry)
    let stat: Awaited<ReturnType<typeof fs.stat>> | null = null
    try { stat = await fs.stat(subDir) } catch { continue }
    if (!stat.isDirectory()) continue

    const level1 = await fs.readdir(subDir).catch(() => [] as string[])
    for (const name of level1) {
      if (name === 'CLAUDE.md') {
        const rel = path.join(entry, name)
        const full = path.join(projectPath, rel)
        try {
          const buf = await fs.readFile(full)
          results.set(rel, sha256(buf))
        } catch { continue }
      }

      // One more level
      const sub2 = path.join(subDir, name)
      let stat2: Awaited<ReturnType<typeof fs.stat>> | null = null
      try { stat2 = await fs.stat(sub2) } catch { continue }
      if (!stat2.isDirectory()) continue

      const level2 = await fs.readdir(sub2).catch(() => [] as string[])
      for (const name2 of level2) {
        if (name2 === 'CLAUDE.md') {
          const rel = path.join(entry, name, name2)
          const full = path.join(projectPath, rel)
          try {
            const buf = await fs.readFile(full)
            results.set(rel, sha256(buf))
          } catch { continue }
        }
      }
    }
  }

  return results
}

/**
 * Compare detected agent files against the registry, write log entries for changes,
 * and update the registry. Returns the list of changes recorded.
 */
export async function trackAgentChanges(
  project: RegistryProject,
  projectPath: string,
  curiyePath: string,
  today: string,
  generateSummary?: (filePath: string, changeType: AgentChangeType, prevHash: string | null, currHash: string | null) => Promise<string>,
): Promise<AgentChange[]> {
  const detected = await detectAgentFiles(projectPath)
  const known = new Map<string, AgentFile>((project.agent_files ?? []).map((f) => [f.path, f]))
  const changes: AgentChange[] = []

  // Check for created or modified files
  for (const [rel, hash] of detected) {
    const prev = known.get(rel)
    if (!prev) {
      // created
      const entry: AgentLogEntry = {
        date: today,
        file: rel,
        change_type: 'created',
        previous_hash: null,
        current_hash: hash,
      }
      const logFilePath = await writeAgentLogEntry(curiyePath, entry, today, generateSummary
        ? await generateSummary(path.join(projectPath, rel), 'created', null, hash)
        : undefined)
      changes.push({ entry, logFilePath })
    } else if (prev.last_seen_hash !== hash) {
      // modified
      const entry: AgentLogEntry = {
        date: today,
        file: rel,
        change_type: 'modified',
        previous_hash: prev.last_seen_hash,
        current_hash: hash,
      }
      const logFilePath = await writeAgentLogEntry(curiyePath, entry, today, generateSummary
        ? await generateSummary(path.join(projectPath, rel), 'modified', prev.last_seen_hash, hash)
        : undefined)
      changes.push({ entry, logFilePath })
    }
  }

  // Check for deleted files
  for (const [rel, agentFile] of known) {
    if (!detected.has(rel)) {
      const entry: AgentLogEntry = {
        date: today,
        file: rel,
        change_type: 'deleted',
        previous_hash: agentFile.last_seen_hash,
        current_hash: null,
      }
      const logFilePath = await writeAgentLogEntry(curiyePath, entry, today, undefined)
      changes.push({ entry, logFilePath })
    }
  }

  // Update registry: rebuild agent_files list
  const updated: AgentFile[] = []
  for (const [rel, hash] of detected) {
    const changed = changes.find((c) => c.entry.file === rel)
    updated.push({
      path: rel,
      last_seen_hash: hash,
      last_changed: changed ? today : (known.get(rel)?.last_changed ?? today),
    })
  }

  await ProjectRegistry.update(project.id, { agent_files: updated })

  return changes
}

/** Writes a dated log entry to `.curaye/agent-log/YYYY-MM-DD-{basename}.md` atomically. */
export async function writeAgentLogEntry(
  curiyePath: string,
  entry: AgentLogEntry,
  date: string,
  body?: string,
): Promise<string> {
  const logDir = path.join(curiyePath, 'agent-log')
  await fs.mkdir(logDir, { recursive: true })

  const safeName = path.basename(entry.file).replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename = `${date}-${safeName}`
  const filePath = path.join(logDir, filename)

  const frontmatter: Record<string, unknown> = {
    date: entry.date,
    file: entry.file,
    change_type: entry.change_type,
    previous_hash: entry.previous_hash ?? null,
    current_hash: entry.current_hash ?? null,
  }

  let content = '---\n' + yamlDump(frontmatter, { lineWidth: -1 }).trimEnd() + '\n---\n'
  if (body) {
    content += '\n' + body.trim() + '\n'
  }

  const tmp = filePath + '.tmp'
  await fs.writeFile(tmp, content, 'utf8')
  await fs.rename(tmp, filePath)

  return filePath
}

/** Reads all agent log entries from `.curaye/agent-log/`, optionally filtered by date. */
export async function readAgentLog(
  curiyePath: string,
  since?: string,
): Promise<Array<{ entry: AgentLogEntry; body: string; filename: string }>> {
  const logDir = path.join(curiyePath, 'agent-log')
  let files: string[]
  try {
    files = await fs.readdir(logDir)
  } catch {
    return []
  }

  files = files.filter((f) => f.endsWith('.md')).sort()

  const results: Array<{ entry: AgentLogEntry; body: string; filename: string }> = []

  for (const filename of files) {
    // Extract date from filename prefix YYYY-MM-DD
    const dateMatch = /^(\d{4}-\d{2}-\d{2})/.exec(filename)
    if (!dateMatch) continue
    const fileDate = dateMatch[1]!
    if (since && fileDate < since) continue

    const raw = await fs.readFile(path.join(logDir, filename), 'utf8')
    const parsed = parseLogFile(raw)
    if (parsed) {
      results.push({ entry: parsed.entry, body: parsed.body, filename })
    }
  }

  return results
}

function parseLogFile(raw: string): { entry: AgentLogEntry; body: string } | null {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw)
  if (!match) return null

  let fm: unknown
  try {
    fm = yamlLoad(match[1]!)
  } catch {
    return null
  }

  if (!fm || typeof fm !== 'object') return null
  const obj = fm as Record<string, unknown>

  return {
    entry: {
      date: String(obj['date'] ?? ''),
      file: String(obj['file'] ?? ''),
      change_type: (obj['change_type'] as AgentChangeType) ?? 'modified',
      previous_hash: obj['previous_hash'] != null ? String(obj['previous_hash']) : null,
      current_hash: obj['current_hash'] != null ? String(obj['current_hash']) : null,
    },
    body: (match[2] ?? '').trim(),
  }
}
