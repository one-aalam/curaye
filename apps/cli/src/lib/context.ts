import path from 'path'
import fs from 'fs/promises'
import { ProjectRegistry } from '@curaye/core'
import type { RegistryProject } from '@curaye/core'
import { die } from './output.js'

export async function resolveProject(projectId: string | undefined): Promise<RegistryProject> {
  if (projectId) {
    const project = await ProjectRegistry.find(projectId)
    if (!project) die(`Project '${projectId}' is not registered. Run 'curaye projects' to see registered projects.`)
    return project
  }

  // Try to find a registered project whose path matches cwd or an ancestor
  const cwd = process.cwd()
  const projects = await ProjectRegistry.read()

  for (const project of projects) {
    const relative = path.relative(project.path, cwd)
    if (!relative.startsWith('..')) {
      return project
    }
  }

  die(
    `Not inside a registered Curaye project. Run 'curaye link' to register this directory, or pass --project <id>.`,
  )
}

export async function curayeExists(dirPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(dirPath, '.curaye'))
    return true
  } catch {
    return false
  }
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
