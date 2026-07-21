import fs from 'fs/promises'
import path from 'path'
import { dump as yamlDump } from 'js-yaml'
import { simpleGit, type SimpleGit, type StatusResult } from 'simple-git'
import type { RegistryProject } from '@curaye/core'
import { ProjectRegistry, SharedLayer } from '@curaye/core'
import type { SharedCategory } from '@curaye/core'
import { SyncConflictError, SyncAuthError, SyncNetworkError, SyncError } from './errors.js'

export interface SyncConfig {
  remote: string
  localRepo: string
}

export type SyncStatus =
  | { state: 'clean' }
  | { state: 'ahead'; commits: number }
  | { state: 'behind'; commits: number }
  | { state: 'diverged'; ahead: number; behind: number }
  | { state: 'no-remote' }

function git(cwd: string): SimpleGit {
  return simpleGit(cwd)
}

function classifyGitError(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err)
  if (/auth|credential|permission denied|could not read/i.test(msg)) {
    throw new SyncAuthError(msg)
  }
  if (/network|resolve host|unable to connect|timed out/i.test(msg)) {
    throw new SyncNetworkError(msg)
  }
  throw new SyncError(msg, { cause: err instanceof Error ? err : undefined })
}

export async function initSyncRepo(config: SyncConfig): Promise<void> {
  try {
    await fs.access(path.join(config.localRepo, '.git'))
    // Already a valid clone — no-op
    return
  } catch {
    // Not a git repo yet
  }

  await fs.mkdir(config.localRepo, { recursive: true })

  try {
    // Try cloning first (remote may already have content)
    await simpleGit().clone(config.remote, config.localRepo)
  } catch {
    // If clone fails because remote is empty or unreachable, init locally and set remote
    try {
      const g = git(config.localRepo)
      await g.init()
      await g.addRemote('origin', config.remote)

      // Create an initial empty commit so the repo is valid
      await fs.writeFile(path.join(config.localRepo, '.gitkeep'), '', 'utf8')
      await g.add('.gitkeep')
      await g.commit('chore: init sync repo')
      await g.push('origin', 'main', ['--set-upstream'])
    } catch (innerErr) {
      classifyGitError(innerErr)
    }
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true })
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

async function removeDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // Ignore if doesn't exist
  }
}

export async function push(projectId: string, curiyePath: string, config: SyncConfig): Promise<void> {
  const g = git(config.localRepo)

  try {
    const destDir = path.join(config.localRepo, projectId)
    await removeDir(destDir)
    await copyDir(curiyePath, destDir)

    const statusResult: StatusResult = await g.status()
    if (statusResult.isClean()) {
      // No changes — no-op, no empty commit
      return
    }

    await g.add('.')
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const timeStr = now.toTimeString().slice(0, 5)
    await g.commit(`sync: ${projectId} ${dateStr} ${timeStr}`)
    await g.push()
  } catch (err) {
    if (err instanceof SyncError) throw err
    classifyGitError(err)
  }
}

export async function pull(projectId: string, curiyePath: string, config: SyncConfig): Promise<void> {
  const g = git(config.localRepo)

  try {
    // Fetch to see what's on remote without modifying working tree
    await g.fetch()

    const statusResult: StatusResult = await g.status()
    const conflicted = statusResult.conflicted
    if (conflicted.length > 0) {
      throw new SyncConflictError(conflicted)
    }

    // Check for divergence — if local has commits not on remote AND remote has commits not local
    const aheadBehind = await g.raw(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])
    const [ahead = '0', behind = '0'] = aheadBehind.trim().split(/\s+/)
    if (parseInt(ahead) > 0 && parseInt(behind) > 0) {
      // Diverged — surface conflict without touching local files
      throw new SyncConflictError([])
    }

    await g.pull()

    // Check again for conflicts after pull
    const afterStatus: StatusResult = await g.status()
    if (afterStatus.conflicted.length > 0) {
      // Undo the pull by resetting to pre-pull state
      await g.reset(['--hard', 'HEAD@{1}'])
      throw new SyncConflictError(afterStatus.conflicted)
    }

    const srcDir = path.join(config.localRepo, projectId)
    await removeDir(curiyePath)
    await copyDir(srcDir, curiyePath)
  } catch (err) {
    if (err instanceof SyncError) throw err
    classifyGitError(err)
  }
}

export async function pullAll(config: SyncConfig): Promise<void> {
  const g = git(config.localRepo)
  try {
    await g.pull()
  } catch (err) {
    if (err instanceof SyncError) throw err
    classifyGitError(err)
  }
}

export async function status(config: SyncConfig): Promise<SyncStatus> {
  const g = git(config.localRepo)

  try {
    await g.fetch()
  } catch {
    return { state: 'no-remote' }
  }

  try {
    const raw = await g.raw(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])
    const [aheadStr = '0', behindStr = '0'] = raw.trim().split(/\s+/)
    const ahead = parseInt(aheadStr)
    const behind = parseInt(behindStr)

    if (ahead === 0 && behind === 0) return { state: 'clean' }
    if (ahead > 0 && behind === 0) return { state: 'ahead', commits: ahead }
    if (ahead === 0 && behind > 0) return { state: 'behind', commits: behind }
    return { state: 'diverged', ahead, behind }
  } catch {
    return { state: 'no-remote' }
  }
}

const SHARED_SYNC_DIR = 'shared'

/**
 * Push ~/.curaye/shared/ to the sync repo as shared/ alongside project folders.
 * Only commits if content actually changed.
 */
export async function pushShared(sharedLocalDir: string, config: SyncConfig): Promise<void> {
  const g = git(config.localRepo)
  try {
    const destDir = path.join(config.localRepo, SHARED_SYNC_DIR)
    await removeDir(destDir)
    // Copy only if the local shared dir exists
    try {
      await fs.access(sharedLocalDir)
      await copyDir(sharedLocalDir, destDir)
    } catch {
      // No local shared dir — nothing to push
      return
    }

    const statusResult: StatusResult = await g.status()
    if (statusResult.isClean()) return

    await g.add('.')
    const dateStr = new Date().toISOString().slice(0, 10)
    await g.commit(`sync: shared layer ${dateStr}`)
    await g.push()
  } catch (err) {
    if (err instanceof SyncError) throw err
    classifyGitError(err)
  }
}

/**
 * Pull shared/ from the sync repo into ~/.curaye/shared/.
 * Creates notifications for any shared docs that changed and have adopting projects.
 */
export async function pullShared(sharedLocalDir: string, config: SyncConfig): Promise<void> {
  const g = git(config.localRepo)
  try {
    await g.fetch()
    const statusResult: StatusResult = await g.status()
    if (statusResult.conflicted.length > 0) throw new SyncConflictError(statusResult.conflicted)

    const srcDir = path.join(config.localRepo, SHARED_SYNC_DIR)
    // Snapshot existing content before pull (to detect changes)
    const preSnap = await snapshotDir(srcDir)

    await g.pull()

    // Detect which shared docs changed
    const postSnap = await snapshotDir(srcDir)
    const changedIds = detectChangedDocs(preSnap, postSnap)

    // Overwrite local shared dir
    try {
      await fs.access(srcDir)
      await removeDir(sharedLocalDir)
      await copyDir(srcDir, sharedLocalDir)
    } catch {
      // No shared/ in sync repo yet — nothing to pull
      return
    }

    // Fire notifications for changed docs that have adopters
    if (changedIds.length > 0) {
      const registry = await ProjectRegistry.read()
      for (const { id, category } of changedIds) {
        const adopters = registry
          .filter((p) => p.adopts?.some((a) => a.endsWith(`/${id}`) || a === id))
          .map((p) => p.id)
        await SharedLayer.notifyUpdate(id, category as SharedCategory, adopters)
      }
    }
  } catch (err) {
    if (err instanceof SyncError) throw err
    classifyGitError(err)
  }
}

async function snapshotDir(dir: string): Promise<Map<string, string>> {
  const snap = new Map<string, string>()
  try {
    await walkDir(dir, dir, snap)
  } catch {
    // dir doesn't exist
  }
  return snap
}

async function walkDir(base: string, current: string, snap: Map<string, string>): Promise<void> {
  const entries = await fs.readdir(current, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(current, entry.name)
    if (entry.isDirectory()) {
      await walkDir(base, full, snap)
    } else {
      const rel = path.relative(base, full)
      const content = await fs.readFile(full, 'utf8').catch(() => '')
      snap.set(rel, content)
    }
  }
}

function detectChangedDocs(
  pre: Map<string, string>,
  post: Map<string, string>,
): Array<{ id: string; category: string }> {
  const changed: Array<{ id: string; category: string }> = []
  for (const [rel, content] of post) {
    if (!rel.endsWith('.md')) continue
    if (pre.get(rel) !== content) {
      const parts = rel.split(path.sep)
      if (parts.length === 2) {
        const [category, filename] = parts
        if (category && filename) {
          changed.push({ id: filename.replace(/\.md$/, ''), category })
        }
      }
    }
  }
  return changed
}

export async function syncRegistry(registry: RegistryProject[], config: SyncConfig): Promise<void> {
  const g = git(config.localRepo)

  try {
    // Strip path from each project entry
    const stripped = registry.map(({ path: _path, ...rest }) => rest)
    const yaml = yamlDump({ version: 1, projects: stripped }, { lineWidth: -1 })
    const destPath = path.join(config.localRepo, 'projects.yaml')
    const tmp = destPath + '.tmp'
    await fs.writeFile(tmp, yaml, 'utf8')
    await fs.rename(tmp, destPath)

    const statusResult: StatusResult = await g.status()
    if (statusResult.isClean()) return

    await g.add('projects.yaml')
    await g.commit('sync: registry update')
    await g.push()
  } catch (err) {
    if (err instanceof SyncError) throw err
    classifyGitError(err)
  }
}
