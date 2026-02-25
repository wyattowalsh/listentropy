import { readFileSync } from 'node:fs'

import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { parseSpotifyZip } from './data/parser'
import { processRecords } from './processor'
import type { RawSpotifyRecord } from './types'

describe('pipeline integration', () => {
  it('parses fixture records and preserves processing invariants', async () => {
    const seed = JSON.parse(
      readFileSync('tests/fixtures/sanitized/minimal-records.json', 'utf8'),
    ) as RawSpotifyRecord[]

    const records = [
      {
        ...seed[0],
        ts: '2024-04-02T01:00:00Z',
        master_metadata_track_name: 'Track B',
        master_metadata_album_artist_name: 'Artist B',
      },
      {
        ...seed[0],
        ts: '2024-04-01T01:00:00Z',
        master_metadata_track_name: 'Track A',
        master_metadata_album_artist_name: 'Artist A',
      },
    ]

    const zip = new JSZip()
    zip.file('Streaming_History_Audio_2024-2025_0.json', JSON.stringify(records))
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'synthetic.zip', { type: 'application/zip' })

    const parsed = await parseSpotifyZip(file)
    expect(parsed).toHaveLength(2)
    expect(parsed[0]?.ts).toBe('2024-04-01T01:00:00Z')
    expect(parsed[1]?.ts).toBe('2024-04-02T01:00:00Z')
    expect('ip_addr' in parsed[0]).toBe(false)

    const processed = processRecords(parsed)
    expect(processed.summary.totalPlays).toBe(2)
    expect(processed.modelVersion).toBeGreaterThanOrEqual(1)
    expect(processed.datasetIdentity.fingerprint).toMatch(/^le-/)
    expect(processed.datasetIdentity.recordCount).toBe(2)
    expect(processed.datasetIdentity.timezoneMode).toBe(processed.timezoneMode)
    expect(processed.diagnostics.inputRecords).toBe(2)
    expect(processed.diagnostics.validRecords).toBe(2)
    expect(processed.diagnostics.droppedRecords).toBe(0)
    expect(processed.stageProvenance.length).toBeGreaterThanOrEqual(10)
    expect(processed.stageProvenance.every((item) => item.durationMs >= 0)).toBe(true)
    expect(processed.monthlyBehavior.length).toBeGreaterThan(0)
    expect(Object.keys(processed.artistMonthlyTrends).length).toBeGreaterThan(0)
    expect(processed.contextAnalytics.reasons.transitions.length).toBeGreaterThan(0)
    expect(processed.narrativeInsights.length).toBeGreaterThan(0)
    expect(processed.dataQuality.unknownCountryRate).toBeGreaterThanOrEqual(0)
  })
})
