import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { uploadAuditFixture } from './helpers/spotifyFixture'

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'uiux-audit', 'primary')

test.describe.configure({ mode: 'serial' })

async function ensureDir(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true })
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function captureAuditScreenshot(
  page: Page,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<void> {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: options.fullPage ?? true,
    animations: 'disabled',
  })
}

async function waitForHeading(
  page: Page,
  heading: string | RegExp,
  timeout: number = 60_000,
): Promise<void> {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout })
}

test.beforeAll(async () => {
  await ensureDir(SCREENSHOT_DIR)
})

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

test('captures primary desktop UIUX flow screenshots with Spotify fixture data', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Primary desktop UIUX audit runs on chromium.')
  test.setTimeout(360_000)

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await waitForHeading(page, 'Listentropy')
  await captureAuditScreenshot(page, '01-onboarding-idle-shell')

  await uploadAuditFixture(page, { waitForTab: 'Share' })
  await expect(page.getByRole('tablist', { name: 'Primary analytics views' })).toBeVisible()
  await captureAuditScreenshot(page, '02-uploaded-shell-primary-tabs', { fullPage: false })

  await page.getByRole('tab', { name: 'Overview', exact: true }).click()
  await waitForHeading(page, 'Year-over-year listening')
  await captureAuditScreenshot(page, '03-overview')

  await page.getByRole('tab', { name: 'Explore', exact: true }).click()
  await waitForHeading(page, 'Explore')
  await captureAuditScreenshot(page, '04-explore-shell')

  await page.getByRole('button', { name: 'Trends', exact: true }).click()
  await waitForHeading(page, 'Listening timeline')
  await captureAuditScreenshot(page, '05-explore-trends')

  await page.getByRole('button', { name: 'Rankings', exact: true }).click()
  await expect(page.getByPlaceholder('Search leaderboard...')).toBeVisible({ timeout: 60_000 })
  await captureAuditScreenshot(page, '06-explore-rankings')

  await page.getByRole('button', { name: 'Behavior', exact: true }).click()
  await waitForHeading(page, 'Skip and shuffle trend')
  await captureAuditScreenshot(page, '07-explore-behavior')

  await page.getByRole('button', { name: 'Context', exact: true }).click()
  await waitForHeading(page, 'Context Intelligence')
  await captureAuditScreenshot(page, '08-explore-context')

  await page.getByRole('button', { name: 'Rhythm', exact: true }).click()
  await waitForHeading(page, 'Radial Clock')
  await captureAuditScreenshot(page, '09-explore-rhythm')

  await page.getByRole('button', { name: 'Eras', exact: true }).click()
  await waitForHeading(page, 'Music Eras')
  await waitForHeading(page, 'Era Detail')
  await captureAuditScreenshot(page, '10-explore-eras')

  await page.getByRole('tab', { name: 'Taste DNA', exact: true }).click()
  await waitForHeading(page, 'Taste DNA')
  await captureAuditScreenshot(page, '11-taste-dna-baseline')

  await page.getByRole('tab', { name: 'Share', exact: true }).click()
  await waitForHeading(page, 'Share Studio')
  await captureAuditScreenshot(page, '12-share-studio-baseline')

  await page.getByRole('button', { name: 'Headline Stats', exact: true }).click()
  await page.getByRole('button', { name: 'Anonymous Highlights', exact: true }).click()
  await page.getByRole('button', { name: 'Detailed Stats', exact: true }).click()
  await expect(page.getByText(/Included cards \(\d+(?:\/\d+)?\)/)).toBeVisible()
  await captureAuditScreenshot(page, '13-share-studio-preset-toggles')

  const nextCardButton = page.getByRole('button', { name: 'Go to next story card' })
  for (let attempts = 0; attempts < 20; attempts += 1) {
    if ((await nextCardButton.count()) === 0) {
      break
    }
    if (!(await nextCardButton.isEnabled())) {
      break
    }
    await nextCardButton.click()
  }
  if ((await nextCardButton.count()) > 0) {
    await expect(nextCardButton).toBeDisabled()
  } else {
    await expect(page.getByRole('button', { name: 'Restart story card deck' })).toBeVisible()
  }
  await captureAuditScreenshot(page, '14-share-studio-card-traversal-end')

  const shareLink = (await page.locator('code').first().innerText()).trim()
  expect(shareLink).toContain('/share#')

  await page.goto(shareLink)
  await waitForHeading(page, 'Shared Listening Snapshot')
  await expect(page.getByText(/payload v4/i)).toBeVisible()
  await captureAuditScreenshot(page, '15-share-route-v4-valid')

  const legacyV2Payload = {
    version: 2,
    privacyLevel: 'aggregate',
    checksum: 'legacy-v2-uiux-audit',
    includeName: false,
    anonymize: false,
    generatedAt: '2026-01-01T00:00:00.000Z',
    timezoneMode: 'utc',
    totalHours: 88,
    totalPlays: 1234,
    uniqueArtists: 123,
    uniqueTracks: 456,
    dateRange: ['2019', '2025'],
    topArtists: [['Legacy Artist A', 99]],
    topTracks: [['Legacy Track A', 'Legacy Artist A', 77]],
    archetype: 'Night Owl',
    archetypes: ['Night Owl'],
    peakHour: 23,
    skipRate: 0.2,
    shuffleRate: 0.6,
    longestStreak: 12,
    tasteDimensions: [0.2, 0.4, 0.6],
  }

  await page.goto(`/share#${toBase64Url(JSON.stringify(legacyV2Payload))}`)
  await waitForHeading(page, 'Shared Listening Snapshot')
  await expect(page.getByText(/^#1 Legacy Artist A$/)).toBeVisible()
  await captureAuditScreenshot(page, '16-share-route-legacy-v2-render')
})
