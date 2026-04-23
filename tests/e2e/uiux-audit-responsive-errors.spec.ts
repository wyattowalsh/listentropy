import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import JSZip from 'jszip'
import { expect, test } from '@playwright/test'
import type { Page, TestInfo } from '@playwright/test'

import { assertInvalidShareRecovery, PRIMARY_ANALYTICS_TABS } from './helpers/auditContract.mjs'
import { openAdvancedTools, uploadAuditFixture } from './helpers/spotifyFixture'

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'uiux-audit', 'responsive-errors')
const STRICT_REAL_DATA_AUDIT = process.env.PW_AUDIT_STRICT_REAL_DATA === '1'

test.describe.configure({ mode: 'serial' })

async function ensureScreenshotDir(): Promise<void> {
  await mkdir(SCREENSHOT_DIR, { recursive: true })
}

async function captureAuditScreenshot(
  page: Page,
  testInfo: TestInfo,
  label: string,
  options: { fullPage?: boolean } = {},
): Promise<void> {
  await ensureScreenshotDir()
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${testInfo.project.name}--${label}.png`),
    fullPage: options.fullPage ?? true,
    animations: 'disabled',
  })
}

async function buildZipWithoutHistory(): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('README.txt', 'missing spotify history')
  return zip.generateAsync({ type: 'nodebuffer' })
}

async function buildZipWithMalformedHistory(): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('Streaming_History_Audio_2024-2025_0.json', '{not-valid-json')
  return zip.generateAsync({ type: 'nodebuffer' })
}

test('captures mobile responsive happy-path shells with fixture zip', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Responsive mobile audit runs on chromium.')
  test.setTimeout(240_000)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await uploadAuditFixture(page, { waitForTab: 'Share', requireRealData: STRICT_REAL_DATA_AUDIT })

  await expect(page.getByRole('tab', { name: PRIMARY_ANALYTICS_TABS.analytics })).toBeVisible()
  await captureAuditScreenshot(page, testInfo, 'mobile-uploaded-shell', { fullPage: false })
  const themeSelect = page.getByLabel('Select theme')
  const timezoneSelect = page.getByLabel('Select timezone mode')
  await expect(themeSelect).toBeVisible()
  await expect(timezoneSelect).toBeVisible()
  await timezoneSelect.selectOption('utc')
  await expect(timezoneSelect).toHaveValue('utc')
  await captureAuditScreenshot(page, testInfo, 'mobile-settings-timezone-utc', { fullPage: false })
  await timezoneSelect.selectOption('local')
  await expect(timezoneSelect).toHaveValue('local')

  await page.getByRole('tab', { name: 'Share' }).click()
  await expect(page.getByRole('heading', { name: 'Share Studio' })).toBeVisible({ timeout: 30_000 })
  await captureAuditScreenshot(page, testInfo, 'mobile-share-studio')

  await page.getByRole('tab', { name: PRIMARY_ANALYTICS_TABS.analytics }).click()
  await page.getByRole('heading', { name: 'Year-over-year listening' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: 'Country context' })).toBeVisible({ timeout: 30_000 })
  await captureAuditScreenshot(page, testInfo, 'mobile-explore-eras')

  await openAdvancedTools(page, 'network')
  await expect(page.getByRole('heading', { name: 'Music Universe Graph' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Network Analytics')).toBeVisible({ timeout: 30_000 })
  await captureAuditScreenshot(page, testInfo, 'mobile-advanced-network')
})

test('captures webkit mobile responsive variant shell', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'webkit-mobile', 'Variant capture runs on webkit mobile.')
  test.setTimeout(240_000)

  await page.goto('/')
  await uploadAuditFixture(page, { waitForTab: 'Share', requireRealData: STRICT_REAL_DATA_AUDIT })
  await expect(page.getByRole('tab', { name: PRIMARY_ANALYTICS_TABS.analytics })).toBeVisible()
  await captureAuditScreenshot(page, testInfo, 'webkit-mobile-uploaded-shell', { fullPage: false })
  await page.getByRole('tab', { name: 'Share' }).click()
  await expect(page.getByRole('heading', { name: 'Share Studio' })).toBeVisible({ timeout: 30_000 })
  await captureAuditScreenshot(page, testInfo, 'webkit-mobile-share-studio')
})

test('captures invalid zip upload error state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Error-state capture runs on chromium.')

  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'not-a-zip.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('plain text upload'),
  })
  await expect(page.getByText(/valid \.zip archive/i)).toBeVisible({ timeout: 30_000 })
  await captureAuditScreenshot(page, testInfo, 'error-invalid-zip')
})

test('captures missing history zip guidance state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Error-state capture runs on chromium.')

  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'missing-history.zip',
    mimeType: 'application/zip',
    buffer: await buildZipWithoutHistory(),
  })
  await expect(page.getByText(/No Spotify Extended Streaming History files were found/i)).toBeVisible({
    timeout: 30_000,
  })
  await captureAuditScreenshot(page, testInfo, 'error-missing-history')
})

test('captures malformed history parse-error state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Error-state capture runs on chromium.')

  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'malformed-history.zip',
    mimeType: 'application/zip',
    buffer: await buildZipWithMalformedHistory(),
  })
  await expect(page.getByRole('heading', { name: 'Failed to parse data' })).toBeVisible({ timeout: 30_000 })
  await captureAuditScreenshot(page, testInfo, 'error-malformed-history')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Listentropy' })).toBeVisible({ timeout: 30_000 })
  await captureAuditScreenshot(page, testInfo, 'recovery-return-to-upload', { fullPage: false })
  await uploadAuditFixture(page, { waitForTab: 'Share', requireRealData: STRICT_REAL_DATA_AUDIT })
  await expect(page.getByRole('tab', { name: PRIMARY_ANALYTICS_TABS.analytics })).toBeVisible()
  await captureAuditScreenshot(page, testInfo, 'recovery-reupload-shell', { fullPage: false })
})

test('captures invalid share hash route state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Error-state capture runs on chromium.')

  await page.goto('/share#not-valid-payload')
  await assertInvalidShareRecovery(page)
  await expect(page.getByRole('link', { name: 'Create a new share snapshot' })).toHaveAttribute('href', '/')
  await captureAuditScreenshot(page, testInfo, 'error-invalid-share-hash')
})
