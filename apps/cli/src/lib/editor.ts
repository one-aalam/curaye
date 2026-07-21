import { spawnSync } from 'child_process'

export function openInEditor(filePath: string): void {
  const editor = process.env['EDITOR'] ?? process.env['VISUAL'] ?? 'vi'
  spawnSync(editor, [filePath], { stdio: 'inherit' })
}
