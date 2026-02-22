#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const root = process.cwd()
const distDir = join(root, 'dist')
const assetsDir = join(distDir, 'assets')
const budgetPath = join(root, 'scripts', 'perf', 'budgets.json')
const overrideRegression = process.env.ALLOW_PERF_REGRESSION === '1'

function readText(path) {
  return readFileSync(path, 'utf8')
}

function toBytes(path) {
  const data = readFileSync(path)
  return gzipSync(data).byteLength
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

const budgets = JSON.parse(readText(budgetPath))
const html = readText(join(distDir, 'index.html'))
const entryMatch = html.match(/src="\/assets\/([^\"]+\.js)"/)
if (!entryMatch) {
  throw new Error('Could not determine entry script from dist/index.html')
}

const entryFile = entryMatch[1]
const assetFiles = readdirSync(assetsDir).filter((file) => file.endsWith('.js'))
const entryPath = join(assetsDir, entryFile)
const entryGzip = toBytes(entryPath)

const asyncCandidates = assetFiles
  .filter((file) => file !== entryFile && !file.includes('worker'))
  .map((file) => ({ file, gzip: toBytes(join(assetsDir, file)) }))

const largestAsync = asyncCandidates.sort((a, b) => b.gzip - a.gzip)[0] ?? {
  file: '(none)',
  gzip: 0,
}

const workerCandidates = assetFiles
  .filter((file) => file.includes('worker'))
  .map((file) => ({ file, gzip: toBytes(join(assetsDir, file)) }))

const workerChunk = workerCandidates.sort((a, b) => b.gzip - a.gzip)[0] ?? {
  file: '(none)',
  gzip: 0,
}

const checks = [
  {
    name: 'entry gzip',
    actual: entryGzip,
    limit: budgets.entryGzip,
    baseline: budgets.baseline.entryGzip,
    file: entryFile,
  },
  {
    name: 'largest async gzip',
    actual: largestAsync.gzip,
    limit: budgets.largestAsyncGzip,
    baseline: budgets.baseline.largestAsyncGzip,
    file: largestAsync.file,
  },
  {
    name: 'worker gzip',
    actual: workerChunk.gzip,
    limit: budgets.workerGzip,
    baseline: budgets.baseline.workerGzip,
    file: workerChunk.file,
  },
]

const failures = []

for (const check of checks) {
  const hardLimitPass = check.actual <= check.limit
  const regressionLimit = Math.floor(check.baseline * (1 + budgets.regressionTolerance))
  const regressionPass = overrideRegression ? true : check.actual <= regressionLimit

  if (!hardLimitPass) {
    failures.push(
      `${check.name} exceeded hard budget: ${formatKiB(check.actual)} > ${formatKiB(check.limit)} (${check.file})`,
    )
  }

  if (!regressionPass) {
    failures.push(
      `${check.name} exceeded +${Math.round(budgets.regressionTolerance * 100)}% baseline tolerance: ${formatKiB(check.actual)} > ${formatKiB(regressionLimit)} (${check.file})`,
    )
  }

  console.log(
    `${check.name}: ${formatKiB(check.actual)} | hard limit ${formatKiB(check.limit)} | baseline ${formatKiB(check.baseline)} (${check.file})`,
  )
}

if (failures.length > 0) {
  console.error('\nPerformance budget check failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('\nPerformance budget check passed.')
