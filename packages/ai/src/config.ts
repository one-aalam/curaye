import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { load as yamlLoad } from 'js-yaml'
import type { ProviderConfig } from './types.js'

const CONFIG_PATH = path.join(os.homedir(), '.curaye', 'ai.yaml')

interface AiConfigFile {
  provider?: string
  model?: string
  api_key?: string
  base_url?: string
}

export async function loadProviderConfig(): Promise<ProviderConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    const parsed = yamlLoad(raw) as AiConfigFile | null
    if (!parsed?.provider) return null
    return {
      provider: parsed.provider as ProviderConfig['provider'],
      ...(parsed.model !== undefined && { model: parsed.model }),
      ...(parsed.api_key !== undefined && { apiKey: parsed.api_key }),
      ...(parsed.base_url !== undefined && { baseUrl: parsed.base_url }),
    }
  } catch {
    return null
  }
}
