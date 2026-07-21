export class ProviderUnavailableError extends Error {
  constructor(provider: string, cause?: unknown) {
    super(`AI provider '${provider}' is unavailable`)
    this.name = 'ProviderUnavailableError'
    this.cause = cause
  }
}

export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderConfigError'
  }
}
