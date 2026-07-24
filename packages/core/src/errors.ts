export class CurayeNotFoundError extends Error {
  constructor(path: string) {
    super(`No .curaye/ folder found at: ${path}`)
    this.name = 'CurayeNotFoundError'
  }
}

export class RegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegistryError'
  }
}

export class SharedLayerError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SharedLayerError'
  }
}

export class SearchIndexError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SearchIndexError'
  }
}

export class DocumentWriteError extends Error {
  constructor(path: string, cause: unknown) {
    super(`Failed to write document at: ${path}`)
    this.name = 'DocumentWriteError'
    this.cause = cause
  }
}
