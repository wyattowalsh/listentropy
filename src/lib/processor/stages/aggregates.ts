import type { AlbumStats, ArtistStats, StreamRecord, TrackStats } from '@/lib/types'

export function buildArtistStats(records: StreamRecord[]): ArtistStats[] {
  const map = new Map<
    string,
    {
      plays: number
      totalMs: number
      firstListen: string
      lastListen: string
      skipped: number
    }
  >()
  for (const record of records) {
    const artist = record.master_metadata_album_artist_name
    if (!artist) {
      continue
    }
    if (!map.has(artist)) {
      map.set(artist, {
        plays: 0,
        totalMs: 0,
        firstListen: record.ts,
        lastListen: record.ts,
        skipped: 0,
      })
    }
    const value = map.get(artist)!
    value.plays += 1
    value.totalMs += record.ms_played
    value.firstListen = value.firstListen < record.ts ? value.firstListen : record.ts
    value.lastListen = value.lastListen > record.ts ? value.lastListen : record.ts
    if (record.skipped) {
      value.skipped += 1
    }
  }
  return [...map.entries()]
    .map(([name, value]) => ({
      key: name,
      name,
      plays: value.plays,
      totalMs: value.totalMs,
      hours: value.totalMs / 1000 / 60 / 60,
      firstListen: value.firstListen,
      lastListen: value.lastListen,
      skipRate: value.skipped / Math.max(1, value.plays),
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
}

export function buildTrackStats(records: StreamRecord[]): TrackStats[] {
  const map = new Map<
    string,
    {
      track: string
      artist: string
      plays: number
      totalMs: number
      firstListen: string
      lastListen: string
      skipped: number
    }
  >()

  for (const record of records) {
    const track = record.master_metadata_track_name
    const artist = record.master_metadata_album_artist_name
    if (!track || !artist) {
      continue
    }
    const key = `${track}::${artist}`
    if (!map.has(key)) {
      map.set(key, {
        track,
        artist,
        plays: 0,
        totalMs: 0,
        firstListen: record.ts,
        lastListen: record.ts,
        skipped: 0,
      })
    }
    const value = map.get(key)!
    value.plays += 1
    value.totalMs += record.ms_played
    value.firstListen = value.firstListen < record.ts ? value.firstListen : record.ts
    value.lastListen = value.lastListen > record.ts ? value.lastListen : record.ts
    if (record.skipped) {
      value.skipped += 1
    }
  }

  return [...map.entries()]
    .map(([key, value]) => ({
      key,
      name: value.track,
      artist: value.artist,
      plays: value.plays,
      totalMs: value.totalMs,
      hours: value.totalMs / 1000 / 60 / 60,
      firstListen: value.firstListen,
      lastListen: value.lastListen,
      skipRate: value.skipped / Math.max(1, value.plays),
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
}

export function buildAlbumStats(records: StreamRecord[]): AlbumStats[] {
  const map = new Map<
    string,
    {
      album: string
      artist: string
      plays: number
      totalMs: number
      firstListen: string
      lastListen: string
    }
  >()

  for (const record of records) {
    const album = record.master_metadata_album_album_name
    const artist = record.master_metadata_album_artist_name
    if (!album || !artist) {
      continue
    }
    const key = `${album}::${artist}`
    if (!map.has(key)) {
      map.set(key, {
        album,
        artist,
        plays: 0,
        totalMs: 0,
        firstListen: record.ts,
        lastListen: record.ts,
      })
    }
    const value = map.get(key)!
    value.plays += 1
    value.totalMs += record.ms_played
    value.firstListen = value.firstListen < record.ts ? value.firstListen : record.ts
    value.lastListen = value.lastListen > record.ts ? value.lastListen : record.ts
  }

  return [...map.entries()]
    .map(([key, value]) => ({
      key,
      name: value.album,
      artist: value.artist,
      plays: value.plays,
      totalMs: value.totalMs,
      hours: value.totalMs / 1000 / 60 / 60,
      firstListen: value.firstListen,
      lastListen: value.lastListen,
    }))
    .sort((a, b) => b.totalMs - a.totalMs)
}
