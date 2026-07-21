export class SyncError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SyncError'
  }
}

export class SyncConflictError extends SyncError {
  conflictedFiles: string[]

  constructor(conflictedFiles: string[]) {
    super(`Sync conflict in files: ${conflictedFiles.join(', ')}`)
    this.name = 'SyncConflictError'
    this.conflictedFiles = conflictedFiles
  }
}

export class SyncAuthError extends SyncError {
  constructor(message: string) {
    super(message)
    this.name = 'SyncAuthError'
  }
}

export class SyncNetworkError extends SyncError {
  constructor(message: string) {
    super(message)
    this.name = 'SyncNetworkError'
  }
}
