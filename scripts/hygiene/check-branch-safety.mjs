#!/usr/bin/env node
import { execSync } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const allowUntracked = args.has('--allow-untracked')

const output = execSync('git status --porcelain', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

const disallowed = output.filter((line) => {
  if (allowUntracked && line.startsWith('??')) {
    return false
  }
  return true
})

if (disallowed.length > 0) {
  console.error('Branch safety check failed: repository is not clean.')
  for (const line of disallowed) {
    console.error(`  ${line}`)
  }
  process.exit(1)
}

console.log('Branch safety check passed: no disallowed uncommitted changes.')
