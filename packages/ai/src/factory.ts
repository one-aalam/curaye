import type { AiConfig, Provider } from './types.js'
import { ProviderConfigError } from './errors.js'
import { OllamaProvider } from './providers/ollama.js'
import { AnthropicProvider } from './providers/anthropic.js'
import { OpenAIProvider } from './providers/openai.js'

export function createProvider(config: AiConfig): Provider {
  switch (config.provider) {
    case 'ollama': {
      if (!config.ollama) {
        throw new ProviderConfigError("Provider 'ollama' requires ollama.baseUrl and ollama.model in config")
      }
      return new OllamaProvider(config.ollama.baseUrl, config.ollama.model)
    }
    case 'anthropic': {
      if (!config.anthropic) {
        throw new ProviderConfigError("Provider 'anthropic' requires anthropic.apiKey and anthropic.model in config")
      }
      return new AnthropicProvider(config.anthropic.apiKey, config.anthropic.model)
    }
    case 'openai': {
      if (!config.openai) {
        throw new ProviderConfigError("Provider 'openai' requires openai.apiKey and openai.model in config")
      }
      return new OpenAIProvider(config.openai.apiKey, config.openai.model)
    }
    default: {
      const _: never = config.provider
      throw new ProviderConfigError(`Unknown provider: ${String(_)}`)
    }
  }
}

export function createEmbedProvider(config: AiConfig): Provider | null {
  const embed = config.embed
  if (embed === undefined) {
    // Fall back to the main provider if it supports embeddings (Ollama, OpenAI)
    if (config.provider === 'ollama' && config.ollama !== undefined) {
      return new OllamaProvider(config.ollama.baseUrl, config.ollama.model)
    }
    if (config.provider === 'openai' && config.openai !== undefined) {
      return new OpenAIProvider(config.openai.apiKey, config.openai.model)
    }
    return null
  }

  switch (embed.provider) {
    case 'ollama': {
      if (config.ollama === undefined) return null
      return new OllamaProvider(config.ollama.baseUrl, embed.model)
    }
    case 'openai': {
      if (config.openai === undefined) return null
      return new OpenAIProvider(config.openai.apiKey, embed.model)
    }
  }
}
