export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface Provider {
  name: string
  complete(messages: Message[]): Promise<string>
  stream(messages: Message[]): AsyncIterable<string>
  isAvailable(): Promise<boolean>
}

export type ProviderName = 'anthropic' | 'openai' | 'ollama'

export interface ProviderConfig {
  provider: ProviderName
  model?: string | undefined
  apiKey?: string | undefined
  baseUrl?: string | undefined
}
