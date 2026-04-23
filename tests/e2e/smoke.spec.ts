import JSZip from 'jszip'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  assertInvalidShareRecovery,
  getPrimaryAnalyticsTab,
  openPrimaryAnalyticsTab,
  PRIMARY_ANALYTICS_TABS,
} from './helpers/auditContract.mjs'

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

async function buildFixtureZipBuffer(): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('Streaming_History_Audio_2024-2025_0.json', JSON.stringify(buildFixtureRecords()))
  return zip.generateAsync({ type: 'nodebuffer' })
}

async function uploadFixture(page: Page): Promise<void> {
  const buffer = await buildFixtureZipBuffer()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'synthetic-spotify.zip',
    mimeType: 'application/zip',
    buffer,
  })
  await expect(getPrimaryAnalyticsTab(page, PRIMARY_ANALYTICS_TABS.dashboard)).toBeVisible({ timeout: 20_000 })
}

test('renders upload onboarding and privacy copy', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Listentropy' })).toBeVisible()
  await expect(
    page.getByText('All processing happens locally in your browser.'),
  ).toBeVisible()
})

test('primary destinations render after upload', async ({ page }) => {
  await page.goto('/')
  await uploadFixture(page)
  await expect(page.getByRole('button', { name: 'Unlock Full Analytics' })).toHaveCount(0)
  await expect(page.getByRole('tab')).toHaveCount(2)

  const dashboardPanel = await openPrimaryAnalyticsTab(page, PRIMARY_ANALYTICS_TABS.dashboard)
  await expect(dashboardPanel.getByRole('heading', { name: 'Overview Snapshot' })).toBeVisible()

  const sharePanel = await openPrimaryAnalyticsTab(page, PRIMARY_ANALYTICS_TABS.share)
  await expect(sharePanel.getByRole('heading', { name: 'Share Studio' })).toBeVisible()
})

test('dashboard exposes advanced controls via progressive disclosure', async ({ page }) => {
  await page.goto('/')
  await uploadFixture(page)

  const dashboardPanel = await openPrimaryAnalyticsTab(page, PRIMARY_ANALYTICS_TABS.dashboard)
  await dashboardPanel.getByRole('button', { name: 'Show advanced tools' }).click()
  await expect(dashboardPanel.getByRole('heading', { name: 'Advanced', exact: true })).toBeVisible()
  await expect(dashboardPanel.getByRole('combobox', { name: 'Advanced section' })).toBeVisible()
})

test('share studio supports full deck traversal and share links', async ({ page }) => {
  await page.goto('/')
  await uploadFixture(page)

  await getPrimaryAnalyticsTab(page, PRIMARY_ANALYTICS_TABS.share).click()
  await page.getByRole('button', { name: 'Headline Stats' }).click()
  await page.getByRole('button', { name: 'Detailed Stats' }).click()

  for (let index = 0; index < 13; index += 1) {
    await page.getByRole('button', { name: 'Go to next story card' }).click()
  }
  await expect(page.getByText('Card 14 / 14')).toBeVisible()

  const shareButton = page.getByRole('button', { name: 'Share...' })
  await expect(shareButton).toHaveCount(0)

  const copyShareLink = page.getByRole('button', { name: 'Copy Share Link' })
  await expect(copyShareLink).toBeVisible()

  const shareLink = await page.locator('code').first().innerText()
  expect(shareLink).toContain('/share#')

  await page.goto(shareLink)
  await expect(page.getByRole('heading', { name: 'Shared Listening Snapshot' })).toBeVisible()
  await expect(page.getByText(/payload v4/i)).toBeVisible()
})

test('upload-to-share funnel works on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await uploadFixture(page)

  await expect(getPrimaryAnalyticsTab(page, PRIMARY_ANALYTICS_TABS.dashboard)).toBeVisible()
  await expect(getPrimaryAnalyticsTab(page, PRIMARY_ANALYTICS_TABS.share)).toBeVisible()
  await getPrimaryAnalyticsTab(page, PRIMARY_ANALYTICS_TABS.share).click()
  await expect(page.getByRole('heading', { name: 'Share Studio' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Headline Stats' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy Share Link' })).toBeVisible()
})

test('share route handles invalid payload gracefully', async ({ page }) => {
  await page.goto('/share#not-valid-payload')
  await assertInvalidShareRecovery(page)
})
