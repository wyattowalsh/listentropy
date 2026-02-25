import { expect, test } from '@playwright/test'

import { buildSyntheticSpotifyZipBuffer, uploadSyntheticFixture } from './helpers/spotifyFixture'

test('xenolab lab tab runs deferred module and renders explainability + scene gallery', async ({ page }) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []

  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await page.goto('/')
  await uploadSyntheticFixture(page)

  await page.getByRole('tab', { name: 'Lab' }).click()
  await expect(page.getByRole('heading', { name: 'Xenolab', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Module Gallery' })).toBeVisible()
  await expect(page.locator('#xenolab-scenes')).toBeVisible()
  await expect(page.locator('#xenolab-compare-workspace')).toBeVisible()

  const sequenceMotifsCard = page.locator('.rounded-theme').filter({ has: page.getByRole('heading', { name: 'Sequence Motifs' }) }).first()
  await sequenceMotifsCard.getByRole('button', { name: 'Run' }).click()

  await expect(page.getByRole('heading', { name: 'Explainability Drawer' })).toBeVisible()
  await expect(page.getByText(/descriptive|heuristic/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Duration \d+ms/i)).toBeVisible()

  await page.getByRole('button', { name: /Chronomap Ridgelines/ }).click()
  await expect(page.getByRole('heading', { name: 'Chronomap Ridgelines' })).toBeVisible()

  await page.getByRole('button', { name: 'Capture Current as Baseline' }).click()
  await page.getByRole('button', { name: 'Night' }).click()
  await page.getByRole('button', { name: 'Run Compare' }).click()
  await expect(page.getByText(/Compared current dataset against baseline/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Top Metric Shifts')).toBeVisible()
  await expect(page.getByText(/Slice Compare \(Night Listening\)/)).toBeVisible()
  await expect(page.getByText('Era vs Era Compare')).toBeVisible()
  await expect(page.getByText('Archetype Tournament')).toBeVisible()

  const compareBuffer = await buildSyntheticSpotifyZipBuffer({ variant: 'compare' })
  await page.getByLabel('Import compare dataset zip').setInputFiles({
    name: 'compare-spotify.zip',
    mimeType: 'application/zip',
    buffer: compareBuffer,
  })
  await expect(page.getByText(/Imported Baseline Active|Use Imported as Baseline/)).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Run Compare' }).click()
  await expect(page.getByText(/Compared current dataset against baseline/i).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/Slice Compare \(Night Listening\)|Slice Compare \(All Records\)/)).toBeVisible()

  await expect(page.getByText('Saved Compare Snapshots')).toBeVisible()
  const capturedSnapshotRow = page.locator('li').filter({ hasText: /captured current/i }).first()
  await expect(capturedSnapshotRow).toBeVisible()
  await capturedSnapshotRow.getByRole('button', { name: 'Use as Baseline' }).click()
  await expect(page.getByText(/Same fingerprint as baseline \(self-compare\)/)).toBeVisible()
  await page.getByRole('button', { name: 'Run Compare' }).click()
  await expect(page.getByText(/same dataset/i).first()).toBeVisible({ timeout: 10_000 })

  const filteredConsoleErrors = consoleErrors.filter((text) => !/favicon|Failed to load resource/i.test(text))
  expect(pageErrors).toEqual([])
  expect(filteredConsoleErrors).toEqual([])
})

test('xenolab lab tab renders under reduced motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await page.getByRole('tab', { name: 'Lab' }).click()
  await expect(page.getByRole('heading', { name: 'Xenolab', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Entropy Phase Portrait/ }).click()
  await expect(page.getByRole('heading', { name: 'Entropy Phase Portrait' })).toBeVisible()
})
