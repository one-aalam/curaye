/**
 * Parity check: verifies that the desktop Rust layer agrees with the
 * TypeScript scanProject() on:
 *   1. Root-document file names
 *   2. Drift-count filter (only "drift"-classified findings count)
 *
 * Run: pnpm check:protocol-parity
 * Exits 1 with a diff when any invariant is violated.
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..')

// ── Expected values (source of truth: protocol-standard.md + core/src/scanner.ts) ──

const EXPECTED_ROOT_DOCS = ['prd.md', 'stack.md', 'product.md', 'conventions.md']

// ── Helpers ──────────────────────────────────────────────────────────────────

function fail(message: string): never {
  console.error(`\n✗ Protocol parity check failed:\n\n  ${message}\n`)
  process.exit(1)
}

function ok(message: string): void {
  console.log(`  ✓  ${message}`)
}

// ── Check 1: root-doc list in mod.rs ─────────────────────────────────────────

async function checkRootDocList(): Promise<void> {
  const modPath = resolve(ROOT, 'apps/desktop/src-tauri/src/commands/mod.rs')
  const source = await readFile(modPath, 'utf8')

  // Find the array literal passed to scan_project's root-doc loop
  // Pattern: for name in &["prd.md", "stack.md", ...] {
  const match = source.match(/for name in &\[([^\]]+)\]/)
  if (!match) {
    fail(
      `Could not find root-doc array in ${modPath}.\n` +
        `  Expected pattern: for name in &[...]`,
    )
  }

  const rawEntries = match[1]
  const rustDocs = [...rawEntries.matchAll(/"([^"]+)"/g)].map((m) => m[1])

  const missing = EXPECTED_ROOT_DOCS.filter((d) => !rustDocs.includes(d))
  const extra = rustDocs.filter((d) => !EXPECTED_ROOT_DOCS.includes(d))

  if (missing.length > 0 || extra.length > 0) {
    const lines: string[] = ['Root-doc list mismatch in apps/desktop/src-tauri/src/commands/mod.rs:']
    if (missing.length > 0) lines.push(`  Missing from Rust: ${missing.join(', ')}`)
    if (extra.length > 0) lines.push(`  Extra in Rust:     ${extra.join(', ')}`)
    lines.push(`  Expected: ${EXPECTED_ROOT_DOCS.join(', ')}`)
    lines.push(`  Got:      ${rustDocs.join(', ')}`)
    fail(lines.join('\n  '))
  }

  ok(`Root-doc list matches: [${rustDocs.join(', ')}]`)
}

// ── Check 2: drift-count filter in mod.rs ────────────────────────────────────

async function checkDriftCountFilter(): Promise<void> {
  const modPath = resolve(ROOT, 'apps/desktop/src-tauri/src/commands/mod.rs')
  const source = await readFile(modPath, 'utf8')

  // The check_project_drift function must filter to classification == "drift"
  // before counting. Look for the filter pattern near check_project_drift.
  const fnMatch = source.match(/pub async fn check_project_drift[\s\S]{0,400}?\}/)
  if (!fnMatch) {
    fail(`Could not locate check_project_drift function in ${modPath}.`)
  }

  const fnBody = fnMatch[0]
  const hasFilter =
    fnBody.includes('classification') &&
    (fnBody.includes('"drift"') || fnBody.includes("'drift'"))

  if (!hasFilter) {
    fail(
      `check_project_drift in mod.rs does not filter by classification == "drift".\n` +
        `  It must count only drift findings, not pending-update findings.\n` +
        `  See DriftDetector.countDrift() in packages/core/src/drift-detector.ts.`,
    )
  }

  ok(`check_project_drift filters to classification == "drift" before counting`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

void (async () => {
  console.log('\nProtocol parity check\n')
  await checkRootDocList()
  await checkDriftCountFilter()
  console.log('\nAll parity checks passed.\n')
})()
