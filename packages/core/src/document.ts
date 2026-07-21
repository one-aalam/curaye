import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import { parse } from '@curaye/protocol'
import type { ParsedDocument, DocumentType } from '@curaye/protocol'
import { DocumentWriteError } from './errors.js'

export async function readDocument(filePath: string, type: DocumentType): Promise<ParsedDocument> {
  const raw = await fs.readFile(filePath, 'utf8')
  return parse(raw, type, filePath)
}

export async function writeDocument(filePath: string, doc: ParsedDocument): Promise<void> {
  const frontmatter = { ...(doc.frontmatter as Record<string, unknown>), ...doc.unknownFields }
  const serialised = matter.stringify(doc.body, frontmatter)
  const tmp = filePath + '.tmp'
  try {
    await fs.writeFile(tmp, serialised, 'utf8')
    await fs.rename(tmp, filePath)
  } catch (err) {
    // Clean up the tmp file if rename failed
    await fs.unlink(tmp).catch(() => undefined)
    throw new DocumentWriteError(filePath, err)
  }
}
