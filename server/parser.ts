import crypto from 'node:crypto'
import JSZip from 'jszip'

const HISTORY_FILE_PATTERN = /Streaming_History_(Audio|Video)_.*\.json$/i

const ZIP_INGEST_LIMITS = {
  maxZipBytes: 256 * 1024 * 1024,
  maxArchiveEntries: 500,
  maxHistoryUncompressedBytes: 64 * 1024 * 1024,
  maxTotalHistoryUncompressedBytes: 256 * 1024 * 1024,
  maxParsedRecords: 2_000_000,
} as const

type ContentType = 'music' | 'podcast' | 'audiobook'

export interface ParsedRecord {
  ts: string
  platform: string
  ms_played: number
  conn_country: string
  master_metadata_track_name: string | null
  master_metadata_album_artist_name: string | null
  master_metadata_album_album_name: string | null
  spotify_track_uri: string | null
  episode_name: string | null
  episode_show_name: string | null
  spotify_episode_uri: string | null
  reason_start: string
  reason_end: string
  shuffle: boolean
  skipped: boolean
  offline: boolean
  offline_timestamp: number | null
  incognito_mode: boolean
  content_type: ContentType
  dedup_hash: string
}

export interface ServerParseResult {
  records: ParsedRecord[]
  historyFileCount: number
  dateRangeStart: string | null
  dateRangeEnd: string | null
}

interface RawRecord {
  ts: string
  platform: string
  ms_played: number
  conn_country: string
  ip_addr: string
  master_metadata_track_name: string | null
  master_metadata_album_artist_name: string | null
  master_metadata_album_album_name: string | null
  spotify_track_uri: string | null
  episode_name: string | null
  episode_show_name: string | null
  spotify_episode_uri: string | null
  reason_start: string
  reason_end: string
  shuffle: boolean
  skipped: boolean | null
  offline: boolean
  offline_timestamp: number | null
  incognito_mode: boolean
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function coerceRawRecord(input: unknown): RawRecord | null {
  if (!input || typeof input !== 'object') return null
  const c = input as Record<string, unknown>
  if (typeof c.ts !== 'string') return null
  if (Number.isNaN(new Date(c.ts).getTime())) return null
  return {
    ts: c.ts,
    platform: asString(c.platform, 'unknown'),
    ms_played: asNumber(c.ms_played),
    conn_country: asString(c.conn_country, 'ZZ'),
    ip_addr: asString(c.ip_addr, '0.0.0.0'),
    master_metadata_track_name: asNullableString(c.master_metadata_track_name),
    master_metadata_album_artist_name: asNullableString(c.master_metadata_album_artist_name),
    master_metadata_album_album_name: asNullableString(c.master_metadata_album_album_name),
    spotify_track_uri: asNullableString(c.spotify_track_uri),
    episode_name: asNullableString(c.episode_name),
    episode_show_name: asNullableString(c.episode_show_name),
    spotify_episode_uri: asNullableString(c.spotify_episode_uri),
    reason_start: asString(c.reason_start, 'unknown'),
    reason_end: asString(c.reason_end, 'unknown'),
    shuffle: asBoolean(c.shuffle),
    skipped: typeof c.skipped === 'boolean' ? c.skipped : null,
    offline: asBoolean(c.offline),
    offline_timestamp: asNullableNumber(c.offline_timestamp),
    incognito_mode: asBoolean(c.incognito_mode),
  }
}

function inferContentType(r: RawRecord): ContentType {
  if (r.spotify_track_uri || r.master_metadata_track_name) return 'music'
  if (r.spotify_episode_uri || r.episode_name) return 'podcast'
  return 'audiobook'
}

function computeDedupHash(ts: string, uri: string | null, trackName: string | null, artistName: string | null): string {
  const key = `${ts}|${uri ?? ''}|${trackName ?? ''}|${artistName ?? ''}`
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)
}

function sanitize(raw: RawRecord): ParsedRecord {
  const contentType = inferContentType(raw)
  return {
    ts: raw.ts,
    platform: raw.platform,
    ms_played: Math.max(0, raw.ms_played),
    conn_country: raw.conn_country,
    master_metadata_track_name: raw.master_metadata_track_name,
    master_metadata_album_artist_name: raw.master_metadata_album_artist_name,
    master_metadata_album_album_name: raw.master_metadata_album_album_name,
    spotify_track_uri: raw.spotify_track_uri,
    episode_name: raw.episode_name,
    episode_show_name: raw.episode_show_name,
    spotify_episode_uri: raw.spotify_episode_uri,
    reason_start: raw.reason_start,
    reason_end: raw.reason_end,
    shuffle: raw.shuffle,
    skipped: raw.skipped ?? false,
    offline: raw.offline,
    offline_timestamp: raw.offline_timestamp,
    incognito_mode: raw.incognito_mode,
    content_type: contentType,
    dedup_hash: computeDedupHash(
      raw.ts,
      raw.spotify_track_uri ?? raw.spotify_episode_uri,
      raw.master_metadata_track_name ?? raw.episode_name,
      raw.master_metadata_album_artist_name ?? raw.episode_show_name,
    ),
  }
}

export async function parseZipBuffer(buffer: Buffer): Promise<ServerParseResult> {
  if (buffer.byteLength > ZIP_INGEST_LIMITS.maxZipBytes) {
    throw new Error('Upload zip is too large.')
  }

  const zip = await JSZip.loadAsync(buffer)
  const entries = Object.values(zip.files).filter((f) => !f.dir)

  if (entries.length > ZIP_INGEST_LIMITS.maxArchiveEntries) {
    throw new Error('Upload zip contains too many entries.')
  }

  const historyEntries = entries.filter((f) => HISTORY_FILE_PATTERN.test(f.name))

  if (historyEntries.length === 0) {
    throw new Error('No Extended Streaming History files found in the archive.')
  }

  const parsed: ParsedRecord[] = []
  let totalUncompressedBytes = 0

  for (const zipFile of historyEntries) {
    const rawJson = await zipFile.async('string')
    const rawJsonBytes = Buffer.byteLength(rawJson, 'utf8')

    if (rawJsonBytes > ZIP_INGEST_LIMITS.maxHistoryUncompressedBytes) {
      throw new Error(`Uncompressed history entry is too large (${zipFile.name}).`)
    }

    totalUncompressedBytes += rawJsonBytes
    if (totalUncompressedBytes > ZIP_INGEST_LIMITS.maxTotalHistoryUncompressedBytes) {
      throw new Error('Uncompressed history payload is too large.')
    }

    let data: unknown
    try {
      data = JSON.parse(rawJson)
    } catch {
      throw new Error(`Failed to parse JSON in ${zipFile.name}`)
    }

    if (!Array.isArray(data)) continue

    if (parsed.length + data.length > ZIP_INGEST_LIMITS.maxParsedRecords) {
      throw new Error('Spotify history contains too many records to process safely.')
    }

    for (const candidate of data) {
      const raw = coerceRawRecord(candidate)
      if (!raw) continue
      parsed.push(sanitize(raw))
    }
  }

  parsed.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

  return {
    records: parsed,
    historyFileCount: historyEntries.length,
    dateRangeStart: parsed[0]?.ts ?? null,
    dateRangeEnd: parsed[parsed.length - 1]?.ts ?? null,
  }
}
