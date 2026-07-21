export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  model?:       string
  maxTokens?:   number
  temperature?: number
}

export interface Provider {
  complete(messages: Message[], opts?: CompletionOptions): Promise<string>
  stream(messages: Message[], opts?: CompletionOptions): AsyncIterable<string>
  embed(text: string): Promise<number[]>
  readonly name: string
  readonly defaultModel: string
}

export interface AiConfig {
  provider: 'ollama' | 'anthropic' | 'openai'
  ollama?:    { baseUrl: string; model: string }
  anthropic?: { apiKey: string; model: string }
  openai?:    { apiKey: string; model: string }
}
