import JSZip from 'jszip'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

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
  await expect(primaryAnalyticsTab(page, 'Overview')).toBeVisible({ timeout: 20_000 })
}

function primaryAnalyticsTab(page: Page, label: string) {
  return page
    .getByRole('tablist', { name: 'Primary analytics views' })
    .getByRole('tab', { name: label, exact: true })
}

async function openPrimaryAnalyticsTab(page: Page, label: string): Promise<Locator> {
  const tab = primaryAnalyticsTab(page, label)
  await tab.click()
  const panelId = await tab.getAttribute('aria-controls')
  if (!panelId) {
    throw new Error(`Primary analytics tab "${label}" is missing aria-controls`)
  }
  return page.locator(`#${panelId}`)
}

async function openAdvancedSection(page: Page, section?: 'lab' | 'network' | 'artist' | 'plugins'): Promise<void> {
  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Advanced' })).toBeVisible()
  if (section) {
    await page.getByRole('combobox', { name: 'Advanced section' }).selectOption(section)
  }
}

test('renders upload onboarding and privacy copy', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Listentropy' })).toBeVisible()
  await expect(
    page.getByText('All processing happens locally in your browser.'),
  ).toBeVisible()
})

test('primary destinations and advanced hub sections render after upload', async ({ page }) => {
  await page.goto('/')
  await uploadFixture(page)
  await expect(page.getByRole('button', { name: 'Unlock Full Analytics' })).toHaveCount(0)
  await expect(page.getByRole('tab')).toHaveCount(4)

  const explorePanel = await openPrimaryAnalyticsTab(page, 'Explore')
  await expect(explorePanel.getByRole('heading', { name: 'Explore' })).toBeVisible()
  await expect(explorePanel.getByRole('heading', { name: 'Trends', exact: true })).toBeVisible()
  await expect(explorePanel.getByRole('heading', { name: 'Rankings', exact: true })).toBeVisible()
  await expect(explorePanel.getByRole('heading', { name: 'Behavior', exact: true })).toBeVisible()
  await expect(explorePanel.getByRole('heading', { name: 'Context', exact: true })).toBeVisible()
  await expect(explorePanel.getByRole('heading', { name: 'Rhythm', exact: true })).toBeVisible()
  await expect(explorePanel.getByRole('heading', { name: 'Eras', exact: true })).toBeVisible()
  await expect(explorePanel.getByPlaceholder('Search leaderboard...')).toBeVisible()
  await expect(explorePanel.getByRole('heading', { name: 'Listening timeline' })).toBeVisible()
  await expect(explorePanel.getByRole('heading', { name: 'Context Intelligence' })).toBeVisible()
  await expect(explorePanel.getByRole('heading', { name: 'Music Eras' })).toBeVisible()

  const sharePanel = await openPrimaryAnalyticsTab(page, 'Share')
  await expect(sharePanel.getByRole('heading', { name: 'Share Studio' })).toBeVisible()

  await openAdvancedSection(page, 'network')
  const universePanel = page.getByRole('heading', { name: 'Music Universe Graph' }).locator('..')
  await expect(universePanel.getByRole('heading', { name: 'Music Universe Graph' })).toBeVisible()
  await expect(universePanel.getByText('This view crashed')).toHaveCount(0)
  await expect(page.getByText('Network Analytics')).toBeVisible()

  const tastePanel = await openPrimaryAnalyticsTab(page, 'Taste DNA')
  await expect(tastePanel.getByRole('heading', { name: 'Taste DNA' })).toBeVisible()

  await openAdvancedSection(page, 'lab')
  await expect(page.getByRole('heading', { name: 'Xenolab', exact: true })).toBeVisible()
  await openAdvancedSection(page, 'artist')
  await expect(page.getByPlaceholder('Search artist...')).toBeVisible()
  await openAdvancedSection(page, 'plugins')
  await expect(page.getByText('Plugin Extras')).toBeVisible()
})

test('weekly timeline uses diverse ISO-like week keys', async ({ page }) => {
  await page.goto('/')
  await uploadFixture(page)

  await primaryAnalyticsTab(page, 'Explore').click()
  await page
    .locator('main select')
    .filter({ has: page.locator('option[value="weekly"]') })
    .first()
    .selectOption('weekly')

  const labels = await page.locator('svg text').allTextContents()
  const weeklyLabels = labels
    .map((value) => value.trim())
    .filter((value) => /^\d{4}-W\d{2}$/.test(value))
  expect(weeklyLabels.length).toBeGreaterThan(5)
  const weekNumbers = weeklyLabels
    .map((value) => Number(value.split('-W')[1]))
    .filter((value) => Number.isFinite(value))
  expect(Math.max(...weekNumbers)).toBeGreaterThan(6)
})

test('share studio supports full deck traversal and share links', async ({ page }) => {
  await page.goto('/')
  await uploadFixture(page)

  await primaryAnalyticsTab(page, 'Share').click()
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

  await expect(primaryAnalyticsTab(page, 'Overview')).toBeVisible()
  await expect(primaryAnalyticsTab(page, 'Share')).toBeVisible()
  await primaryAnalyticsTab(page, 'Share').click()
  await expect(page.getByRole('heading', { name: 'Share Studio' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Headline Stats' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy Share Link' })).toBeVisible()
})

test('share route handles invalid payload gracefully', async ({ page }) => {
  await page.goto('/share#not-valid-payload')
  await expect(page.getByRole('heading', { name: 'This link needs a refresh' })).toBeVisible()
})
