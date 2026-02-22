#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const summaryPath = join(process.cwd(), 'coverage', 'coverage-summary.json')
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))

const totalLinesPct = summary.total.lines.pct
const totalBranchesPct = summary.total.branches.pct

const libEntries = Object.entries(summary).filter(
  ([file]) => file.includes('/src/lib/') || file.startsWith('src/lib/'),
)
const libTotals = libEntries.reduce(
  (acc, [, metrics]) => {
    acc.linesTotal += metrics.lines.total
    acc.linesCovered += metrics.lines.covered
    return acc
  },
  { linesTotal: 0, linesCovered: 0 },
)

const libLinesPct = libTotals.linesTotal > 0 ? (libTotals.linesCovered / libTotals.linesTotal) * 100 : 0

const failures = []
if (totalLinesPct < 80) {
  failures.push(`Global line coverage ${totalLinesPct.toFixed(2)}% is below 80%`)
}
if (totalBranchesPct < 70) {
  failures.push(`Global branch coverage ${totalBranchesPct.toFixed(2)}% is below 70%`)
}
if (libLinesPct < 85) {
  failures.push(`src/lib line coverage ${libLinesPct.toFixed(2)}% is below 85%`)
}

console.log(`Coverage summary: global lines ${totalLinesPct.toFixed(2)}%, global branches ${totalBranchesPct.toFixed(2)}%, src/lib lines ${libLinesPct.toFixed(2)}%`)

if (failures.length > 0) {
  console.error('\nCoverage gate failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Coverage gate passed.')
