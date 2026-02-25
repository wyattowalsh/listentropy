import type { DatasetIdentity, StreamRecord, TimezoneMode } from '@/lib/types'

function fnv1a(seed: number, input: string): number {
  let hash = seed >>> 0
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function toBase36Hash(value: number): string {
  return value.toString(36).padStart(7, '0')
}

export function buildDatasetFingerprint(records: StreamRecord[], timezoneMode: TimezoneMode): string {
  // Order-sensitive on purpose because the parser/processor normalizes ordering before analytics.
  let hash = 0x811c9dc5
  hash = fnv1a(hash, `tz:${timezoneMode}`)
  hash = fnv1a(hash, `count:${records.length}`)

  for (const record of records) {
    hash = fnv1a(
      hash,
      [
        record.ts,
        record.ms_played,
        record.master_metadata_track_name ?? '',
        record.master_metadata_album_artist_name ?? '',
        record.platform,
        record.conn_country,
        record.skipped ? '1' : '0',
        record.shuffle ? '1' : '0',
        record.offline ? '1' : '0',
      ].join('|'),
    )
  }

  return `le-${toBase36Hash(hash)}`
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

export function buildDatasetIdentity(records: StreamRecord[], timezoneMode: TimezoneMode): DatasetIdentity {
  const importedAt = new Date().toISOString()
  return {
    id: `dataset-${importedAt.slice(0, 19).replaceAll(':', '').replaceAll('-', '')}-${randomSuffix()}`,
    fingerprint: buildDatasetFingerprint(records, timezoneMode),
    importedAt,
    recordCount: records.length,
    timezoneMode,
  }
}
