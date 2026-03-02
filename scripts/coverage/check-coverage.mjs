#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEFAULT_THRESHOLDS = Object.freeze({
  globalLines: 80,
  globalBranches: 70,
  libLines: 85,
})

export const RISKY_FILE_THRESHOLDS = Object.freeze([
  { file: 'src/lib/share/share-encoder.ts', lines: 68, branches: 70 },
  { file: 'src/lib/data/parser.ts', lines: 76, branches: 72 },
  { file: 'src/lib/labs/worker-client.ts', lines: 72, branches: 68 },
  { file: 'src/lib/audio-traits/providers/spotify/provider.ts', lines: 72, branches: 58 },
])

function toPosixPath(value) {
  return value.replace(/\\/g, '/')
}

function getLibLineCoveragePct(summary) {
  const libEntries = Object.entries(summary).filter(([file]) => {
    if (file === 'total') {
      return false
    }
    const normalized = toPosixPath(file)
    return normalized.includes('/src/lib/') || normalized.startsWith('src/lib/')
  })
  const libTotals = libEntries.reduce(
    (acc, [, metrics]) => {
      acc.linesTotal += metrics.lines.total
      acc.linesCovered += metrics.lines.covered
      return acc
    },
    { linesTotal: 0, linesCovered: 0 },
  )
  return libTotals.linesTotal > 0 ? (libTotals.linesCovered / libTotals.linesTotal) * 100 : 0
}

function findFileMetrics(summary, targetFile) {
  const normalizedTarget = toPosixPath(targetFile).replace(/^\.\//, '')
  for (const [file, metrics] of Object.entries(summary)) {
    if (file === 'total') {
      continue
    }
    const normalizedFile = toPosixPath(file).replace(/^\.\//, '')
    if (normalizedFile === normalizedTarget || normalizedFile.endsWith(`/${normalizedTarget}`)) {
      return metrics
    }
  }
  return null
}

export function evaluateCoverageGate(summary, options = {}) {
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(options.thresholds ?? {}),
  }
  const riskyFiles = options.riskyFiles ?? RISKY_FILE_THRESHOLDS
  const totalLinesPct = Number(summary?.total?.lines?.pct ?? 0)
  const totalBranchesPct = Number(summary?.total?.branches?.pct ?? 0)
  const libLinesPct = getLibLineCoveragePct(summary)
  const failures = []

  if (totalLinesPct < thresholds.globalLines) {
    failures.push(`Global line coverage ${totalLinesPct.toFixed(2)}% is below ${thresholds.globalLines}%`)
  }
  if (totalBranchesPct < thresholds.globalBranches) {
    failures.push(`Global branch coverage ${totalBranchesPct.toFixed(2)}% is below ${thresholds.globalBranches}%`)
  }
  if (libLinesPct < thresholds.libLines) {
    failures.push(`src/lib line coverage ${libLinesPct.toFixed(2)}% is below ${thresholds.libLines}%`)
  }

  for (const riskyFile of riskyFiles) {
    const metrics = findFileMetrics(summary, riskyFile.file)
    if (!metrics) {
      failures.push(`Risky file ${riskyFile.file} is missing from coverage summary (blind spot).`)
      continue
    }

    const fileLinesPct = Number(metrics.lines?.pct ?? 0)
    const fileBranchesPct = Number(metrics.branches?.pct ?? 0)
    if (fileLinesPct < riskyFile.lines) {
      failures.push(`${riskyFile.file} line coverage ${fileLinesPct.toFixed(2)}% is below ${riskyFile.lines}%`)
    }
    if (fileBranchesPct < riskyFile.branches) {
      failures.push(`${riskyFile.file} branch coverage ${fileBranchesPct.toFixed(2)}% is below ${riskyFile.branches}%`)
    }
  }

  return {
    totalLinesPct,
    totalBranchesPct,
    libLinesPct,
    failures,
  }
}

function loadCoverageSummary(cwd = process.cwd()) {
  const summaryPath = join(cwd, 'coverage', 'coverage-summary.json')
  return JSON.parse(readFileSync(summaryPath, 'utf8'))
}

function runCoverageGate(cwd = process.cwd()) {
  const summary = loadCoverageSummary(cwd)
  const result = evaluateCoverageGate(summary)

  console.log(
    `Coverage summary: global lines ${result.totalLinesPct.toFixed(2)}%, global branches ${result.totalBranchesPct.toFixed(2)}%, src/lib lines ${result.libLinesPct.toFixed(2)}%, risky files ${RISKY_FILE_THRESHOLDS.length}`,
  )

  if (result.failures.length > 0) {
    console.error('\nCoverage gate failed:')
    for (const failure of result.failures) {
      console.error(`- ${failure}`)
    }
    return 1
  }

  console.log('Coverage gate passed.')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runCoverageGate())
}
