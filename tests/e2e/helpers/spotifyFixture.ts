import JSZip from 'jszip'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

interface FixtureRecord {
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
  audiobook_title: string | null
  audiobook_uri: string | null
  audiobook_chapter_uri: string | null
  audiobook_chapter_title: string | null
  reason_start: string
  reason_end: string
  shuffle: boolean
  skipped: boolean
  offline: boolean
  offline_timestamp: number | null
  incognito_mode: boolean
}

function buildFixtureRecords(): FixtureRecord[] {
  const baseTs = Date.parse('2024-01-01T08:00:00Z')
  return Array.from({ length: 180 }, (_, index) => {
    const ts = new Date(baseTs + index * 24 * 60 * 60 * 1000).toISOString()
    const artist = `Artist ${index % 12}`
    const track = `Track ${index % 25}`
    return {
      ts,
      platform: index % 3 === 0 ? 'ios' : index % 3 === 1 ? 'osx' : 'web_player osx',
      ms_played: 130000 + (index % 4) * 20000,
      conn_country: 'US',
      ip_addr: '0.0.0.0',
      master_metadata_track_name: track,
      master_metadata_album_artist_name: artist,
      master_metadata_album_album_name: `Album ${index % 6}`,
      spotify_track_uri: `spotify:track:fixture${index}`,
      episode_name: null,
      episode_show_name: null,
      spotify_episode_uri: null,
      audiobook_title: null,
      audiobook_uri: null,
      audiobook_chapter_uri: null,
      audiobook_chapter_title: null,
      reason_start: 'playbtn',
      reason_end: index % 8 === 0 ? 'fwdbtn' : 'trackdone',
      shuffle: index % 2 === 0,
      skipped: index % 8 === 0,
      offline: false,
      offline_timestamp: null,
      incognito_mode: false,
    }
  })
}

export async function buildSyntheticSpotifyZipBuffer(): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('Streaming_History_Audio_2024-2025_0.json', JSON.stringify(buildFixtureRecords()))
  return zip.generateAsync({ type: 'nodebuffer' })
}

export async function uploadSyntheticFixture(page: Page): Promise<void> {
  const buffer = await buildSyntheticSpotifyZipBuffer()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'synthetic-spotify.zip',
    mimeType: 'application/zip',
    buffer,
  })
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible({ timeout: 20_000 })
}

