import { constants as fsConstants } from 'node:fs'
import { access } from 'node:fs/promises'

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

interface SyntheticFixtureOptions {
  variant?: 'base' | 'compare'
}

interface UploadAuditFixtureOptions {
  waitForTab?: string
  requireRealData?: boolean
}

async function resolveAuditFixtureInputFiles(options: UploadAuditFixtureOptions = {}): Promise<
  | string
  | {
      name: string
      mimeType: string
      buffer: Buffer
    }
> {
  const requireRealData = options.requireRealData ?? process.env.PW_AUDIT_STRICT_REAL_DATA === '1'
  const realSpotifyZipPath = process.env.SPOTIFY_ZIP_PATH?.trim()
  if (requireRealData && !realSpotifyZipPath) {
    throw new Error(
      'SPOTIFY_ZIP_PATH is required in strict audit fixture mode. Example: SPOTIFY_ZIP_PATH=/abs/path.zip',
    )
  }
  if (realSpotifyZipPath) {
    await access(realSpotifyZipPath, fsConstants.R_OK)
    return realSpotifyZipPath
  }

  return {
    name: 'synthetic-spotify.zip',
    mimeType: 'application/zip',
    buffer: await buildSyntheticSpotifyZipBuffer(),
  }
}

function buildFixtureRecords(options: SyntheticFixtureOptions = {}): FixtureRecord[] {
  const variant = options.variant ?? 'base'
  const baseTs = Date.parse('2024-01-01T08:00:00Z')
  return Array.from({ length: 180 }, (_, index) => {
    const variantOffset = variant === 'compare' ? 6 * 60 * 60 * 1000 : 0
    const ts = new Date(baseTs + index * 24 * 60 * 60 * 1000 + variantOffset).toISOString()
    const artist = variant === 'compare' ? `Artist ${index % 10}` : `Artist ${index % 12}`
    const track = variant === 'compare' ? `Track ${index % 21}` : `Track ${index % 25}`
    return {
      ts,
      platform:
        variant === 'compare'
          ? (index % 3 === 0 ? 'android' : index % 3 === 1 ? 'web_player android' : 'ios')
          : (index % 3 === 0 ? 'ios' : index % 3 === 1 ? 'osx' : 'web_player osx'),
      ms_played: (variant === 'compare' ? 110000 : 130000) + (index % 4) * 20000,
      conn_country: variant === 'compare' && index % 9 === 0 ? 'CA' : 'US',
      ip_addr: '0.0.0.0',
      master_metadata_track_name: track,
      master_metadata_album_artist_name: artist,
      master_metadata_album_album_name: `Album ${variant === 'compare' ? index % 5 : index % 6}`,
      spotify_track_uri: `spotify:track:${variant}fixture${index}`,
      episode_name: null,
      episode_show_name: null,
      spotify_episode_uri: null,
      audiobook_title: null,
      audiobook_uri: null,
      audiobook_chapter_uri: null,
      audiobook_chapter_title: null,
      reason_start: 'playbtn',
      reason_end: variant === 'compare' ? (index % 6 === 0 ? 'endplay' : 'trackdone') : (index % 8 === 0 ? 'fwdbtn' : 'trackdone'),
      shuffle: variant === 'compare' ? index % 3 === 0 : index % 2 === 0,
      skipped: variant === 'compare' ? index % 11 === 0 : index % 8 === 0,
      offline: variant === 'compare' ? index % 10 === 0 : false,
      offline_timestamp: null,
      incognito_mode: variant === 'compare' ? index % 17 === 0 : false,
    }
  })
}

export async function buildSyntheticSpotifyZipBuffer(options: SyntheticFixtureOptions = {}): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('Streaming_History_Audio_2024-2025_0.json', JSON.stringify(buildFixtureRecords(options)))
  return zip.generateAsync({ type: 'nodebuffer' })
}

export async function uploadSyntheticFixture(page: Page): Promise<void> {
  const buffer = await buildSyntheticSpotifyZipBuffer()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'synthetic-spotify.zip',
    mimeType: 'application/zip',
    buffer,
  })
  await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeVisible({ timeout: 20_000 })
}

export async function uploadAuditFixture(page: Page, options: UploadAuditFixtureOptions = {}): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(await resolveAuditFixtureInputFiles(options))
  await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeVisible({ timeout: 180_000 })

  const unlockFullAnalyticsButton = page.getByRole('button', { name: 'Unlock Full Analytics' })
  if ((await unlockFullAnalyticsButton.count()) > 0) {
    await unlockFullAnalyticsButton.click()
  }

  if (options.waitForTab) {
    await expect(page.getByRole('tab', { name: options.waitForTab })).toBeVisible({ timeout: 30_000 })
  }
}

export async function openAdvancedTools(page: Page, section?: 'lab' | 'network' | 'artist' | 'plugins'): Promise<void> {
  const advancedHeading = page.getByRole('heading', { name: 'Advanced', exact: true })
  if ((await advancedHeading.count()) === 0) {
    await page.getByRole('button', { name: 'Show advanced tools' }).click()
  }
  await expect(advancedHeading).toBeVisible({ timeout: 30_000 })
  if (section) {
    await page.getByRole('combobox', { name: 'Advanced section' }).selectOption(section)
  }
}
