import { outro } from '@clack/prompts'

let jsonMode = false

export function setJsonMode(value: boolean): void {
  jsonMode = value
}

export function isJsonMode(): boolean {
  return jsonMode
}

export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n')
}

export function printLine(text: string): void {
  process.stdout.write(text + '\n')
}

export function die(message: string, code = 1): never {
  if (jsonMode) {
    process.stderr.write(JSON.stringify({ error: message }) + '\n')
  } else {
    outro(`Error: ${message}`)
  }
  process.exit(code)
}
