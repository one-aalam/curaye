import type { Message, CompletionOptions, Provider } from '../types.js'
import { ProviderUnavailableError, ProviderAuthError } from '../errors.js'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

type SSEEvent = { type: string; delta?: { type?: string; text?: string }; error?: { message: string } }

export class AnthropicProvider implements Provider {
  readonly name = 'anthropic'
  readonly defaultModel: string
  private apiKey: string

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey
    this.defaultModel = model
  }

  private buildMessages(messages: Message[]): { system: string | undefined; msgs: AnthropicMessage[] } {
    let system: string | undefined
    const msgs: AnthropicMessage[] = []
    for (const m of messages) {
      if (m.role === 'system') {
        system = m.content
      } else {
        msgs.push({ role: m.role as 'user' | 'assistant', content: m.content })
      }
    }
    return { system, msgs }
  }

  async complete(messages: Message[], opts?: CompletionOptions): Promise<string> {
    const chunks: string[] = []
    for await (const chunk of this.stream(messages, opts)) {
      chunks.push(chunk)
    }
    return chunks.join('')
  }

  async *stream(messages: Message[], opts?: CompletionOptions): AsyncIterable<string> {
    const { system, msgs } = this.buildMessages(messages)

    let res: Response
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: opts?.model ?? this.defaultModel,
          max_tokens: opts?.maxTokens ?? 1024,
          ...(system !== undefined && { system }),
          messages: msgs,
          stream: true,
          ...(opts?.temperature !== undefined && { temperature: opts.temperature }),
        }),
      })
    } catch (err) {
      throw new ProviderUnavailableError('anthropic', err)
    }

    if (res.status === 401 || res.status === 403) throw new ProviderAuthError('anthropic')
    if (!res.ok) throw new ProviderUnavailableError('anthropic', new Error(`HTTP ${res.status}`))

    const reader = res.body?.getReader()
    if (!reader) throw new ProviderUnavailableError('anthropic', new Error('No response body'))

    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        let result: { done: boolean; value: Uint8Array | undefined }
        try {
          result = await reader.read()
        } catch (err) {
          throw new ProviderUnavailableError('anthropic', err)
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
            const event = JSON.parse(data) as SSEEvent
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              const text = event.delta.text
              if (text) yield text
            }
          } catch {
            // skip malformed
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  async embed(_text: string): Promise<number[]> {
    // Anthropic does not offer a public embeddings endpoint; throw as unavailable
    throw new ProviderUnavailableError('anthropic', new Error('Anthropic does not support embeddings'))
  }
}
