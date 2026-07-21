import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { load as yamlLoad, dump as yamlDump } from 'js-yaml'
import { RegistryError } from './errors.js'

export interface RegistryProject {
  id: string
  name: string
  path: string
  gh?: string
  sync_remote?: string
  added: string
}

interface RegistryFile {
  version: number
  projects: RegistryProject[]
}

const REGISTRY_PATH = path.join(os.homedir(), '.curaye', 'projects.yaml')

async function readFile(): Promise<RegistryFile> {
  try {
    const raw = await fs.readFile(REGISTRY_PATH, 'utf8')
    const parsed = yamlLoad(raw) as RegistryFile | null
    if (!parsed || typeof parsed !== 'object') {
      return { version: 1, projects: [] }
    }
    return { version: parsed.version ?? 1, projects: parsed.projects ?? [] }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, projects: [] }
    }
    throw new RegistryError(`Failed to read registry: ${(err as Error).message}`)
  }
}

async function writeFile(data: RegistryFile): Promise<void> {
  const dir = path.dirname(REGISTRY_PATH)
  try {
    await fs.mkdir(dir, { recursive: true })
    const tmp = REGISTRY_PATH + '.tmp'
    await fs.writeFile(tmp, yamlDump(data, { lineWidth: -1 }), 'utf8')
    await fs.rename(tmp, REGISTRY_PATH)
  } catch (err) {
    throw new RegistryError(`Failed to write registry: ${(err as Error).message}`)
  }
}

export class ProjectRegistry {
  static async read(): Promise<RegistryProject[]> {
    const data = await readFile()
    return data.projects
  }

  static async add(project: RegistryProject): Promise<void> {
    const data = await readFile()
    const existing = data.projects.findIndex((p) => p.id === project.id)
    if (existing >= 0) {
      data.projects[existing] = project
    } else {
      data.projects.push(project)
    }
    await writeFile(data)
  }

  static async remove(id: string): Promise<void> {
    const data = await readFile()
    data.projects = data.projects.filter((p) => p.id !== id)
    await writeFile(data)
  }

  static async update(id: string, patch: Partial<RegistryProject>): Promise<void> {
    const data = await readFile()
    const idx = data.projects.findIndex((p) => p.id === id)
    if (idx >= 0) {
      data.projects[idx] = { ...data.projects[idx]!, ...patch }
      await writeFile(data)
    }
  }

  static async find(id: string): Promise<RegistryProject | null> {
    const data = await readFile()
    return data.projects.find((p) => p.id === id) ?? null
  }

  static curiyePath(project: RegistryProject): string {
    return path.join(project.path, '.curaye')
  }
}
