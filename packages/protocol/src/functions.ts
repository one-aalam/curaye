import matter from 'gray-matter'
import { z } from 'zod'
import {
  PlannedFrontmatterSchema,
  CurrentFrontmatterSchema,
  ShippedFrontmatterSchema,
  DecisionFrontmatterSchema,
  RootDocFrontmatterSchema,
} from './schemas.js'
import type { DocumentType, ParsedDocument, ValidationResult, ValidationIssue } from './types.js'
import path from 'node:path'

const SCHEMA_MAP = {
  planned: PlannedFrontmatterSchema,
  current: CurrentFrontmatterSchema,
  shipped: ShippedFrontmatterSchema,
  decisions: DecisionFrontmatterSchema,
  root: RootDocFrontmatterSchema,
} satisfies Record<DocumentType, z.ZodTypeAny>

/**
 * Derives the document id from a filename.
 * Strips a leading numeric prefix (e.g. "01-") and the ".md" extension.
 */
export function deriveId(filename: string): string {
  // Strip path, keep basename
  const base = path.basename(filename)
  // Remove numeric prefix like "01-"
  const withoutPrefix = base.replace(/^\d+-/, '')
  // Remove .md extension
  return withoutPrefix.replace(/\.md$/, '')
}

/**
 * Returns true if the filename starts with an underscore (draft convention).
 */
export function isDraft(filename: string): boolean {
  return path.basename(filename).startsWith('_')
}

/**
 * Returns the numeric sort order from a filename prefix, or null if absent.
 */
export function sortOrder(filename: string): number | null {
  const base = path.basename(filename)
  const match = /^(\d+)-/.exec(base)
  if (match === null) return null
  return parseInt(match[1] ?? '0', 10)
}

/**
 * Validate frontmatter against the schema for the given document type.
 * Never throws.
 */
export function validate(frontmatter: unknown, type: DocumentType): ValidationResult {
  const schema = SCHEMA_MAP[type]
  const result = schema.safeParse(frontmatter)

  if (result.success) {
    return { valid: true, errors: [], warnings: [], infos: [] }
  }

  const errors: ValidationIssue[] = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }))

  return { valid: false, errors, warnings: [], infos: [] }
}

/**
 * gray-matter parses bare YAML date values (e.g. 2026-01-01) as JS Date objects.
 * The protocol expects ISO date strings. Walk the frontmatter and convert any
 * Date instances to YYYY-MM-DD strings before validation.
 */
function coerceDates(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof Date) {
      // Convert to YYYY-MM-DD using UTC to avoid timezone shifts
      out[k] = v.toISOString().slice(0, 10)
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * Parse raw markdown content into a ParsedDocument.
 * Never throws — all failures are captured in ValidationResult.
 */
export function parse(
  rawContent: string,
  type: DocumentType,
  filePath: string,
): ParsedDocument {
  let parsed: matter.GrayMatterFile<string>
  try {
    parsed = matter(rawContent)
  } catch {
    // gray-matter threw — return a document with an error
    const filename = path.basename(filePath)
    return {
      type,
      id: deriveId(filename),
      path: filePath,
      isDraft: isDraft(filename),
      sortOrder: sortOrder(filename),
      frontmatter: {},
      body: rawContent,
      unknownFields: {},
      validation: {
        valid: false,
        errors: [{ field: '(frontmatter)', message: 'Failed to parse frontmatter block' }],
        warnings: [],
        infos: [],
      },
    }
  }

  const rawFrontmatter: Record<string, unknown> = coerceDates(parsed.data as Record<string, unknown>)
  const body = parsed.content

  const schema = SCHEMA_MAP[type]
  const safeResult = schema.safeParse(rawFrontmatter)

  const filename = path.basename(filePath)

  // Collect known fields from the schema to separate unknown fields
  const schemaShape = (schema as z.ZodObject<z.ZodRawShape>)._def.shape()
  const knownKeys = new Set(Object.keys(schemaShape))
  const unknownFields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rawFrontmatter)) {
    if (!knownKeys.has(k)) {
      unknownFields[k] = v
    }
  }

  // Derive id from frontmatter or filename
  const idFromFrontmatter = rawFrontmatter['id']
  const derivedId =
    typeof idFromFrontmatter === 'string' && idFromFrontmatter.length > 0
      ? idFromFrontmatter
      : deriveId(filename)

  let validationResult: ValidationResult
  if (safeResult.success) {
    const infos: ValidationIssue[] = Object.keys(unknownFields).map((k) => ({
      field: k,
      message: `Unknown frontmatter field: ${k}`,
    }))
    validationResult = { valid: true, errors: [], warnings: [], infos }
    return {
      type,
      id: derivedId,
      path: filePath,
      isDraft: isDraft(filename),
      sortOrder: sortOrder(filename),
      frontmatter: safeResult.data as Record<string, unknown>,
      body,
      unknownFields,
      validation: validationResult,
    }
  } else {
    const errors: ValidationIssue[] = safeResult.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    }))
    const infos: ValidationIssue[] = Object.keys(unknownFields).map((k) => ({
      field: k,
      message: `Unknown frontmatter field: ${k}`,
    }))
    validationResult = { valid: false, errors, warnings: [], infos }
    return {
      type,
      id: derivedId,
      path: filePath,
      isDraft: isDraft(filename),
      sortOrder: sortOrder(filename),
      frontmatter: rawFrontmatter,
      body,
      unknownFields,
      validation: validationResult,
    }
  }
}
