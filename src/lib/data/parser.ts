import JSZip from 'jszip'

import type { ParseOptions, RawSpotifyRecord, StreamRecord } from '@/lib/types'

const HISTORY_FILE_PATTERN = /Streaming_History_(Audio|Video)_.*\.json$/i

export interface ZipInspectionResult {
  totalEntries: number
  historyFileCount: number
  historyFiles: string[]
}

export interface PreparedSpotifyZipArchive {
  zip: JSZip
  entries: JSZip.JSZipObject[]
  historyEntries: JSZip.JSZipObject[]
  inspection: ZipInspectionResult
}

export interface ParseSpotifyZipOptions extends ParseOptions {
  archive?: PreparedSpotifyZipArchive
  historyFileNames?: string[]
}

const preparedZipArchiveCache = new WeakMap<File, PreparedSpotifyZipArchive>()

function inferContentType(record: RawSpotifyRecord): StreamRecord['content_type'] {
  if (record.spotify_track_uri || record.master_metadata_track_name) {
    return 'music'
  }
  if (record.spotify_episode_uri || record.episode_name) {
    return 'podcast'
  }
  return 'audiobook'
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

function coerceRawRecord(input: unknown): RawSpotifyRecord | null {
  if (!input || typeof input !== 'object') {
    return null
  }
  const candidate = input as Record<string, unknown>
  if (typeof candidate.ts !== 'string') {
    return null
  }
  if (Number.isNaN(new Date(candidate.ts).getTime())) {
    return null
  }
  return {
    ts: candidate.ts,
    platform: asString(candidate.platform, 'unknown'),
    ms_played: asNumber(candidate.ms_played),
    conn_country: asString(candidate.conn_country, 'ZZ'),
    ip_addr: asString(candidate.ip_addr, '0.0.0.0'),
    master_metadata_track_name: asNullableString(candidate.master_metadata_track_name),
    master_metadata_album_artist_name: asNullableString(candidate.master_metadata_album_artist_name),
    master_metadata_album_album_name: asNullableString(candidate.master_metadata_album_album_name),
    spotify_track_uri: asNullableString(candidate.spotify_track_uri),
    episode_name: asNullableString(candidate.episode_name),
    episode_show_name: asNullableString(candidate.episode_show_name),
    spotify_episode_uri: asNullableString(candidate.spotify_episode_uri),
    audiobook_title: asNullableString(candidate.audiobook_title),
    audiobook_uri: asNullableString(candidate.audiobook_uri),
    audiobook_chapter_uri: asNullableString(candidate.audiobook_chapter_uri),
    audiobook_chapter_title: asNullableString(candidate.audiobook_chapter_title),
    reason_start: asString(candidate.reason_start, 'unknown'),
    reason_end: asString(candidate.reason_end, 'unknown'),
    shuffle: asBoolean(candidate.shuffle),
    skipped: typeof candidate.skipped === 'boolean' ? candidate.skipped : null,
    offline: asBoolean(candidate.offline),
    offline_timestamp: asNullableNumber(candidate.offline_timestamp),
    incognito_mode: asBoolean(candidate.incognito_mode),
  }
}

export function sanitizeRecord(record: RawSpotifyRecord): StreamRecord {
  return {
    ts: record.ts,
    platform: record.platform,
    ms_played: Math.max(0, record.ms_played),
    conn_country: record.conn_country,
    master_metadata_track_name: record.master_metadata_track_name,
    master_metadata_album_artist_name: record.master_metadata_album_artist_name,
    master_metadata_album_album_name: record.master_metadata_album_album_name,
    spotify_track_uri: record.spotify_track_uri,
    episode_name: record.episode_name,
    episode_show_name: record.episode_show_name,
    spotify_episode_uri: record.spotify_episode_uri,
    audiobook_title: record.audiobook_title,
    audiobook_uri: record.audiobook_uri,
    audiobook_chapter_uri: record.audiobook_chapter_uri,
    audiobook_chapter_title: record.audiobook_chapter_title,
    reason_start: record.reason_start,
    reason_end: record.reason_end,
    shuffle: record.shuffle,
    skipped: record.skipped ?? false,
    offline: record.offline,
    offline_timestamp: record.offline_timestamp,
    incognito_mode: record.incognito_mode,
    content_type: inferContentType(record),
  }
}

function getArchiveEntries(zip: JSZip): JSZip.JSZipObject[] {
  return Object.values(zip.files).filter((zipFile) => !zipFile.dir)
}

function getHistoryEntries(entries: JSZip.JSZipObject[]): JSZip.JSZipObject[] {
  return entries.filter((zipFile) => HISTORY_FILE_PATTERN.test(zipFile.name))
}

function buildZipInspection(entries: JSZip.JSZipObject[], historyEntries: JSZip.JSZipObject[]): ZipInspectionResult {
  const historyFiles = historyEntries.map((entry) => entry.name).sort((a, b) => a.localeCompare(b))

  return {
    totalEntries: entries.length,
    historyFileCount: historyFiles.length,
    historyFiles,
  }
}

function buildPreparedSpotifyZipArchive(zip: JSZip): PreparedSpotifyZipArchive {
  const entries = getArchiveEntries(zip)
  const historyEntries = getHistoryEntries(entries)
  return {
    zip,
    entries,
    historyEntries,
    inspection: buildZipInspection(entries, historyEntries),
  }
}

function resolveHistoryEntriesByName(
  zip: JSZip,
  historyFileNames: string[] | undefined,
): JSZip.JSZipObject[] | null {
  if (!historyFileNames || historyFileNames.length === 0) {
    return null
  }

  const resolved: JSZip.JSZipObject[] = []
  for (const fileName of historyFileNames) {
    const zipFile = zip.files[fileName]
    if (!zipFile || zipFile.dir || !HISTORY_FILE_PATTERN.test(zipFile.name)) {
      continue
    }
    resolved.push(zipFile)
  }

  return resolved
}

export async function prepareSpotifyZipArchive(file: File): Promise<PreparedSpotifyZipArchive> {
  const cached = preparedZipArchiveCache.get(file)
  if (cached) {
    return cached
  }

  const zip = await JSZip.loadAsync(file)
  const prepared = buildPreparedSpotifyZipArchive(zip)
  preparedZipArchiveCache.set(file, prepared)
  return prepared
}

export async function parseSpotifyZip(
  file: File,
  options: ParseSpotifyZipOptions = {},
): Promise<StreamRecord[]> {
  const resolvedPreparedArchive =
    options.archive ??
    preparedZipArchiveCache.get(file) ??
    (options.historyFileNames ? null : await prepareSpotifyZipArchive(file))

  const zip = resolvedPreparedArchive?.zip ?? (await JSZip.loadAsync(file))
  const historyFiles =
    resolvedPreparedArchive?.historyEntries ??
    resolveHistoryEntriesByName(zip, options.historyFileNames) ??
    getHistoryEntries(getArchiveEntries(zip))

  if (historyFiles.length === 0) {
    throw new Error(
      'No Extended Streaming History files found. Request the Spotify Extended Streaming History export and upload the original zip.',
    )
  }

  const parsed: StreamRecord[] = []
  for (let index = 0; index < historyFiles.length; index += 1) {
    const zipFile = historyFiles[index]
    const rawJson = await zipFile.async('string')
    let data: unknown
    try {
      data = JSON.parse(rawJson)
    } catch {
      throw new Error(`Failed to parse JSON in ${zipFile.name}`)
    }

    if (!Array.isArray(data)) {
      continue
    }

    for (const candidate of data) {
      const raw = coerceRawRecord(candidate)
      if (!raw) {
        continue
      }
      parsed.push(sanitizeRecord(raw))
    }

    options.onProgress?.({
      stage: 'parsing',
      filesParsed: index + 1,
      totalFiles: historyFiles.length,
      recordsParsed: parsed.length,
      currentFile: zipFile.name,
    })
  }

  parsed.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
  return parsed
}

export async function inspectSpotifyZipArchive(file: File): Promise<ZipInspectionResult> {
  const prepared = await prepareSpotifyZipArchive(file)
  return prepared.inspection
}
