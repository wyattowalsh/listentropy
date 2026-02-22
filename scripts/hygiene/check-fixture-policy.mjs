#!/usr/bin/env node
import { execSync } from 'node:child_process'

const FIXTURE_ROOT = 'tests/fixtures/'
const ALLOWED_FIXTURE_PATHS = ['tests/fixtures/generated/', 'tests/fixtures/sanitized/']
const FORBIDDEN_PATTERNS = [
  /my_spotify_data/i,
  /extended streaming history/i,
  /streaming_history_audio/i,
  /streaming_history_video/i,
]

function isAllowedFixture(path) {
  return ALLOWED_FIXTURE_PATHS.some((prefix) => path.startsWith(prefix))
}

function collectPathsFromStatus() {
  const status = execSync('git status --porcelain', { encoding: 'utf8' })
  return status
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
}

function collectTrackedPaths() {
  const tracked = execSync('git ls-files', { encoding: 'utf8' })
  return tracked
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

const paths = new Set([...collectTrackedPaths(), ...collectPathsFromStatus()])
const violations = []

for (const path of paths) {
  const lower = path.toLowerCase()

  if (lower.endsWith('.zip')) {
    violations.push(`${path} (zip files are forbidden in tracked or pending source)`) 
    continue
  }

  if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(lower))) {
    violations.push(`${path} (looks like personal Spotify export artifact)`) 
    continue
  }

  if (path.startsWith(FIXTURE_ROOT) && !isAllowedFixture(path) && !path.endsWith('README.md')) {
    violations.push(`${path} (fixtures must live under tests/fixtures/generated or tests/fixtures/sanitized)`) 
  }
}

if (violations.length > 0) {
  console.error('Fixture policy check failed:')
  for (const violation of violations) {
    console.error(`  - ${violation}`)
  }
  process.exit(1)
}

console.log('Fixture policy check passed.')
