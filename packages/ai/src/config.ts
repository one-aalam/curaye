import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { load as yamlLoad } from 'js-yaml'
import type { AiConfig } from './types.js'

const CONFIG_PATH = path.join(os.homedir(), '.curaye', 'config.yaml')

interface RawConfig {
  ai?: {
    provider?: string
    ollama?:    { baseUrl?: string; model?: string }
    anthropic?: { apiKey?: string; model?: string }
    openai?:    { apiKey?: string; model?: string }
    embed?:     { provider?: string; model?: string }
  }
}

export async function readAiConfig(): Promise<AiConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    const parsed = yamlLoad(raw) as RawConfig | null
    const ai = parsed?.ai
    if (!ai?.provider) return null

    const provider = ai.provider as AiConfig['provider']
    if (provider !== 'ollama' && provider !== 'anthropic' && provider !== 'openai') return null

    const embedProvider = ai.embed?.provider
    const embedModel = ai.embed?.model
    const embedConfig: AiConfig['embed'] =
      (embedProvider === 'ollama' || embedProvider === 'openai') && embedModel
        ? { provider: embedProvider, model: embedModel }
        : undefined

    return {
      provider,
      ...(ai.ollama?.baseUrl && ai.ollama.model
        ? { ollama: { baseUrl: ai.ollama.baseUrl, model: ai.ollama.model } }
        : {}),
      ...(ai.anthropic?.apiKey && ai.anthropic.model
        ? { anthropic: { apiKey: ai.anthropic.apiKey, model: ai.anthropic.model } }
        : {}),
      ...(ai.openai?.apiKey && ai.openai.model
        ? { openai: { apiKey: ai.openai.apiKey, model: ai.openai.model } }
        : {}),
      ...(embedConfig !== undefined ? { embed: embedConfig } : {}),
    }
  } catch {
    return null
  }
}

export function isAvailable(config: AiConfig | null): boolean {
  if (config === null) return false
  switch (config.provider) {
    case 'ollama':
      return config.ollama !== undefined
    case 'anthropic':
      return config.anthropic?.apiKey !== undefined
    case 'openai':
      return config.openai?.apiKey !== undefined
  }
}
