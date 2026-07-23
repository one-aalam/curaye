import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const PlannedFrontmatterSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    status: z.enum(['draft', 'ready', 'building', 'done', 'shelved']),
    effort: z.enum(['xs', 's', 'm', 'l', 'xl']),
    impact: z.enum(['low', 'medium', 'high']).optional(),
    desire: z.enum(['low', 'medium', 'high']).optional(),
    requires: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    release: z.string().default(''),
    created: z.string().regex(dateRegex),
    updated: z.string().regex(dateRegex),
  })
  .passthrough()

export const CurrentFrontmatterSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    domain: z.string(),
    updated: z.string().regex(dateRegex),
  })
  .passthrough()

export const ShippedFrontmatterSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    shipped: z.string().regex(dateRegex),
    release: z.string().default(''),
    spec_ref: z.string().default(''),
  })
  .passthrough()

export const DecisionFrontmatterSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    status: z.enum(['active', 'superseded', 'deprecated']),
    date: z.string().regex(dateRegex),
    superseded_by: z.string().default(''),
    tags: z.array(z.string()).default([]),
  })
  .passthrough()

export const RootDocFrontmatterSchema = z
  .object({
    updated: z.string().regex(dateRegex),
  })
  .passthrough()

export const ReleaseFrontmatterSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    status: z.enum(['planning', 'active', 'shipped']),
    target: z.string().regex(dateRegex).optional(),
    created: z.string().regex(dateRegex),
    updated: z.string().regex(dateRegex),
  })
  .passthrough()

export type PlannedFrontmatter = z.infer<typeof PlannedFrontmatterSchema>
export type CurrentFrontmatter = z.infer<typeof CurrentFrontmatterSchema>
export type ShippedFrontmatter = z.infer<typeof ShippedFrontmatterSchema>
export type DecisionFrontmatter = z.infer<typeof DecisionFrontmatterSchema>
export type RootDocFrontmatter = z.infer<typeof RootDocFrontmatterSchema>
export type ReleaseFrontmatter = z.infer<typeof ReleaseFrontmatterSchema>
