import type { Message, CompletionOptions, Provider } from '../types.js'
import { ProviderUnavailableError, ProviderAuthError } from '../errors.js'

type SSEChunk = { choices?: Array<{ delta?: { content?: string } }> }

export class OpenAIProvider implements Provider {
  readonly name = 'openai'
  readonly defaultModel: string
  private apiKey: string

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey
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
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: opts?.model ?? this.defaultModel,
          messages,
          stream: true,
          ...(opts?.maxTokens !== undefined && { max_tokens: opts.maxTokens }),
          ...(opts?.temperature !== undefined && { temperature: opts.temperature }),
        }),
      })
    } catch (err) {
      throw new ProviderUnavailableError('openai', err)
    }

    if (res.status === 401 || res.status === 403) throw new ProviderAuthError('openai')
    if (!res.ok) throw new ProviderUnavailableError('openai', new Error(`HTTP ${res.status}`))

    const reader = res.body?.getReader()
    if (!reader) throw new ProviderUnavailableError('openai', new Error('No response body'))

    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        let result: { done: boolean; value: Uint8Array | undefined }
        try {
          result = await reader.read()
        } catch (err) {
          throw new ProviderUnavailableError('openai', err)
        }
        if (result.done) break
        buffer += decoder.decode(result.value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') return
          try {
            const chunk = JSON.parse(data) as SSEChunk
            const content = chunk.choices?.[0]?.delta?.content
            if (content) yield content
          } catch {
            // skip malformed
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
      res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
      })
    } catch (err) {
      throw new ProviderUnavailableError('openai', err)
    }
    if (res.status === 401 || res.status === 403) throw new ProviderAuthError('openai')
    if (!res.ok) throw new ProviderUnavailableError('openai', new Error(`HTTP ${res.status}`))
    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0]?.embedding ?? []
  }
}
