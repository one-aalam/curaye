export type DocumentType = 'planned' | 'current' | 'shipped' | 'decisions' | 'root'

export interface ValidationIssue {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  infos: ValidationIssue[]
}

export interface ParsedDocument<T = unknown> {
  type: DocumentType
  id: string
  path: string
  isDraft: boolean
  sortOrder: number | null
  frontmatter: T
  body: string
  unknownFields: Record<string, unknown>
  validation: ValidationResult
}
