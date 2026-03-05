import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

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
  testInfo: TestInfo,
  name: string,
  options: { fullPage?: boolean } = {},
): Promise<void> {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${testInfo.project.name}--${name}.png`),
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
  await captureAuditScreenshot(page, testInfo, '01-shell-onboarding-idle')

  await uploadAuditFixture(page, { waitForTab: 'Share' })
  await expect(page.getByRole('tablist', { name: 'Primary analytics views' })).toBeVisible()
  await captureAuditScreenshot(page, testInfo, '02-shell-uploaded-primary-tabs', { fullPage: false })

  await page.getByRole('tab', { name: 'Dashboard', exact: true }).click()
  await waitForHeading(page, 'Year-over-year listening')
  await captureAuditScreenshot(page, testInfo, '03-dashboard-overview')

  await expect(page.getByLabel('Select theme')).toBeVisible()
  await expect(page.getByLabel('Select timezone mode')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset uploaded data' })).toBeVisible()
  await captureAuditScreenshot(page, testInfo, '04-settings-shell-controls', { fullPage: false })

  const timezoneModeSelect = page.getByLabel('Select timezone mode')
  await timezoneModeSelect.selectOption('utc')
  await expect(timezoneModeSelect).toHaveValue('utc')
  await captureAuditScreenshot(page, testInfo, '05-settings-timezone-utc', { fullPage: false })

  const themeSelect = page.getByLabel('Select theme')
  const currentThemeValue = await themeSelect.inputValue()
  const themeValues = await themeSelect.locator('option').evaluateAll((options) =>
    options
      .map((option) => (option as HTMLOptionElement).value)
      .filter((value) => typeof value === 'string' && value.length > 0),
  )
  const alternateThemeValue = themeValues.find((value) => value !== currentThemeValue)
  if (alternateThemeValue) {
    await themeSelect.selectOption(alternateThemeValue)
    await expect(themeSelect).toHaveValue(alternateThemeValue)
  }
  await captureAuditScreenshot(page, testInfo, '06-settings-theme-switch', { fullPage: false })

  const resetButton = page.getByRole('button', { name: 'Reset uploaded data' })
  await resetButton.click()
  await expect(page.getByRole('button', { name: 'Confirm reset uploaded data' })).toBeVisible()
  await captureAuditScreenshot(page, testInfo, '07-settings-reset-confirm-armed', { fullPage: false })

  await page.getByRole('tab', { name: 'Share', exact: true }).click()
  await waitForHeading(page, 'Share Studio')
  await captureAuditScreenshot(page, testInfo, '08-share-studio-baseline')

  await page.getByRole('button', { name: 'Headline Stats', exact: true }).click()
  await page.getByRole('button', { name: 'Anonymous Highlights', exact: true }).click()
  await page.getByRole('button', { name: 'Detailed Stats', exact: true }).click()
  await expect(page.getByText(/Included cards \(\d+(?:\/\d+)?\)/)).toBeVisible()
  await captureAuditScreenshot(page, testInfo, '09-share-studio-preset-toggles')

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
  await captureAuditScreenshot(page, testInfo, '10-share-studio-card-traversal-end')

  const shareLink = (await page.locator('code').filter({ hasText: '/share#' }).first().innerText()).trim()
  expect(shareLink).toContain('/share#')

  await page.goto(shareLink)
  await waitForHeading(page, 'Shared Listening Snapshot')
  await expect(page.getByText(/payload v4/i)).toBeVisible()
  await captureAuditScreenshot(page, testInfo, '11-share-route-v4-valid')

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
  await captureAuditScreenshot(page, testInfo, '12-share-route-legacy-v2-render')
})
