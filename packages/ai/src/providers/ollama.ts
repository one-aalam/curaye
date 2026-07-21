import type { Message, CompletionOptions, Provider } from '../types.js'
import { ProviderUnavailableError } from '../errors.js'

interface OllamaChatChunk {
  message?: { content?: string }
  done?: boolean
  embedding?: number[]
}

export class OllamaProvider implements Provider {
  readonly name = 'ollama'
  readonly defaultModel: string
  private baseUrl: string

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.defaultModel = model
  }

  async complete(messages: Message[], opts?: CompletionOptions): Promise<string> {
    const chunks: string[] = []
    for await (const chunk of this.stream(messages, opts)) {
      chunks.push(chunk)
    }
    return chunks.join('')
  }

  async *stream(messages: Message[], opts?: CompletionOptions): AsyncIterable<string> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opts?.model ?? this.defaultModel,
          messages,
          stream: true,
          ...(opts?.temperature !== undefined && { options: { temperature: opts.temperature } }),
        }),
      })
    } catch (err) {
      throw new ProviderUnavailableError('ollama', err)
    }

    if (!res.ok) {
      throw new ProviderUnavailableError('ollama', new Error(`HTTP ${res.status}`))
    }

    const reader = res.body?.getReader()
    if (!reader) throw new ProviderUnavailableError('ollama', new Error('No response body'))

    const decoder = new TextDecoder()
    try {
      while (true) {
        let result: { done: boolean; value: Uint8Array | undefined }
        try {
          result = await reader.read()
        } catch (err) {
          throw new ProviderUnavailableError('ollama', err)
        }
        if (result.done) break
        const lines = decoder.decode(result.value, { stream: true }).split('\n')
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const chunk = JSON.parse(line) as OllamaChatChunk
            const content = chunk.message?.content
            if (content) yield content
          } catch {
            // skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async embed(text: string): Promise<number[]> {
    let res: Response
    try {
      res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.defaultModel, prompt: text }),
      })
    } catch (err) {
      throw new ProviderUnavailableError('ollama', err)
    }
    if (!res.ok) throw new ProviderUnavailableError('ollama', new Error(`HTTP ${res.status}`))
    const data = await res.json() as { embedding: number[] }
    return data.embedding
  }
}
