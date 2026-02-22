#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
const outputDir = join(process.cwd(), 'docs', 'baseline')
const outputFile = join(outputDir, `baseline-${timestamp}.md`)

const status = run('git status --short --branch')
const head = run('git rev-parse HEAD')
const branch = run('git rev-parse --abbrev-ref HEAD')
const nodeVersion = run('node -v')
const pnpmVersion = run('pnpm -v')

let trackedCount = '0'
try {
  trackedCount = run('git ls-files | wc -l')
} catch {
  // no-op; this should not block snapshot generation
}

const content = `# Baseline Snapshot\n\n- Timestamp: ${new Date().toISOString()}\n- Branch: ${branch}\n- HEAD: ${head}\n- Node: ${nodeVersion}\n- pnpm: ${pnpmVersion}\n- Tracked files: ${trackedCount}\n\n## Git Status\n\n\`\`\`\n${status}\n\`\`\`\n`

mkdirSync(outputDir, { recursive: true })
writeFileSync(outputFile, content, 'utf8')

console.log(`Wrote baseline snapshot: ${outputFile}`)
