import { describe, expect, it } from 'vitest'

import { DEFAULT_THRESHOLDS, RISKY_FILE_THRESHOLDS, evaluateCoverageGate } from './check-coverage.mjs'

type CoverageMetric = {
  lines: { total: number; covered: number; pct: number }
  branches: { total: number; covered: number; pct: number }
}

type CoverageSummary = Record<string, CoverageMetric> & {
  total: CoverageMetric
}

function metric(linesPct: number, branchesPct: number, total = 100): CoverageMetric {
  return {
    lines: {
      total,
      covered: Math.round((linesPct / 100) * total),
      pct: linesPct,
    },
    branches: {
      total,
      covered: Math.round((branchesPct / 100) * total),
      pct: branchesPct,
    },
  }
}

function buildSummary(): CoverageSummary {
  const summary: CoverageSummary = {
    total: metric(90, 80, 1000),
    '/repo/src/lib/example.ts': metric(92, 82, 1000),
  }

  for (const threshold of RISKY_FILE_THRESHOLDS) {
    summary[`/repo/${threshold.file}`] = metric(
      Math.max(threshold.lines + 2, DEFAULT_THRESHOLDS.libLines + 1),
      threshold.branches + 2,
      200,
    )
  }

  return summary
}

describe('evaluateCoverageGate', () => {
  it('fails when a risky file is missing from coverage summary', () => {
    const summary = buildSummary()
    const [missing] = RISKY_FILE_THRESHOLDS
    delete summary[`/repo/${missing.file}`]

    const result = evaluateCoverageGate(summary)

    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${missing.file} is missing from coverage summary`),
      ]),
    )
  })

  it('fails when a risky file drops below line/branch thresholds', () => {
    const summary = buildSummary()
    const [risky] = RISKY_FILE_THRESHOLDS
    summary[`/repo/${risky.file}`] = metric(risky.lines - 1, risky.branches - 1, 200)

    const result = evaluateCoverageGate(summary)

    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${risky.file} line coverage`),
        expect.stringContaining(`${risky.file} branch coverage`),
      ]),
    )
  })
})
