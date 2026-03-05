import { expect, test } from '@playwright/test'

import { buildSyntheticSpotifyZipBuffer, openAdvancedTools, uploadSyntheticFixture } from './helpers/spotifyFixture'

async function openAdvancedLab(page: Parameters<typeof test>[0]['page']): Promise<void> {
  await openAdvancedTools(page, 'lab')
}

test('xenolab advanced lab section runs deferred module and renders explainability + scene gallery', async ({ page }) => {
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

  await openAdvancedLab(page)
  await expect(page.getByRole('heading', { name: 'Xenolab', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Module Gallery' })).toBeVisible()
  await expect(page.locator('#xenolab-scenes')).toBeVisible()
  await expect(page.locator('#xenolab-compare-workspace')).toBeVisible()

  const moduleGallery = page.locator('section[aria-labelledby="xenolab-module-gallery"]')
  const runModuleButton = moduleGallery
    .locator('button:has-text("Run"):not([disabled]), button:has-text("Run Again"):not([disabled])')
    .first()
  await expect(runModuleButton).toBeVisible({ timeout: 30_000 })
  await runModuleButton.click()

  await expect(page.getByRole('heading', { name: 'Explainability Drawer' })).toBeVisible()
  await expect(page.getByText(/descriptive|heuristic/i).first()).toBeVisible({ timeout: 10_000 })
  const explainabilityDrawer = page.locator('[aria-labelledby="xenolab-explainability"]')
  await explainabilityDrawer.locator('summary', { hasText: 'Source fields' }).click()
  await expect(explainabilityDrawer.getByText(/Duration \d+ms/i)).toBeVisible()

  await page.getByRole('button', { name: /Chronomap Ridgelines/ }).click()
  await expect(page.getByRole('heading', { name: 'Chronomap Ridgelines' })).toBeVisible()

  const compareWorkspace = page.locator('[aria-labelledby="xenolab-compare-workspace"]')
  await compareWorkspace.getByRole('button', { name: 'Capture Current as Baseline' }).click()
  const nightScopeButton = compareWorkspace.getByRole('button', { name: 'Night' })
  if (!(await nightScopeButton.isVisible())) {
    const compareScopeSummary = compareWorkspace.locator('summary', { hasText: 'Compare Scope' }).first()
    if (await compareScopeSummary.isVisible()) {
      await compareScopeSummary.click()
    }
  }
  await nightScopeButton.click()
  await compareWorkspace.getByRole('button', { name: 'Run Compare' }).click()
  await expect(compareWorkspace.locator('p', { hasText: /Compared current dataset against baseline/i }).first()).toBeVisible({ timeout: 10_000 })
  await expect(compareWorkspace.getByText('Top Metric Shifts').first()).toBeVisible()
  await expect(compareWorkspace.getByText(/Slice Compare \(Night Listening\)/).first()).toBeVisible()
  const deepCompareSummary = compareWorkspace.locator('summary', { hasText: 'Deep compare diagnostics' }).first()
  if (await deepCompareSummary.isVisible()) {
    await deepCompareSummary.click()
  }
  await expect(compareWorkspace.getByText('Era vs Era Compare').first()).toBeVisible()
  await expect(compareWorkspace.getByText('Archetype Tournament').first()).toBeVisible()

  const compareBuffer = await buildSyntheticSpotifyZipBuffer({ variant: 'compare' })
  await compareWorkspace.getByLabel('Import compare dataset zip').setInputFiles({
    name: 'compare-spotify.zip',
    mimeType: 'application/zip',
    buffer: compareBuffer,
  })
  const importedBaselineButton = compareWorkspace.getByRole('button', { name: /Imported Baseline Active|Use Imported as Baseline/ }).first()
  if (!(await importedBaselineButton.isVisible())) {
    const importedSummary = compareWorkspace.locator('summary', { hasText: 'Imported Compare Dataset' }).first()
    if (await importedSummary.isVisible()) {
      await importedSummary.click()
    }
  }
  await expect(importedBaselineButton).toBeVisible({ timeout: 20_000 })
  await compareWorkspace.getByRole('button', { name: 'Run Compare' }).click()
  await expect(compareWorkspace.locator('p', { hasText: /Compared current dataset against baseline/i }).first()).toBeVisible({ timeout: 10_000 })
  await expect(compareWorkspace.getByText(/Slice Compare \(Night Listening\)|Slice Compare \(All Records\)/).first()).toBeVisible()

  await expect(compareWorkspace.getByText('Saved Compare Snapshots')).toBeVisible()
  const capturedSnapshotRow = compareWorkspace.locator('li').filter({ hasText: /captured current/i }).first()
  if (!(await capturedSnapshotRow.isVisible())) {
    const savedSnapshotsSummary = compareWorkspace.locator('summary', { hasText: 'Saved Compare Snapshots' }).first()
    if (await savedSnapshotsSummary.isVisible()) {
      await savedSnapshotsSummary.click()
    }
  }
  await expect(capturedSnapshotRow).toBeVisible()
  await capturedSnapshotRow.getByRole('button', { name: 'Use as Baseline' }).click()
  await expect(compareWorkspace.getByText(/Same fingerprint as baseline \(self-compare\)/)).toBeVisible()
  await compareWorkspace.getByRole('button', { name: 'Run Compare' }).click()
  await expect(compareWorkspace.locator('p', { hasText: /same dataset/i }).first()).toBeVisible({ timeout: 10_000 })

  const filteredConsoleErrors = consoleErrors.filter((text) => !/favicon|Failed to load resource/i.test(text))
  expect(pageErrors).toEqual([])
  expect(filteredConsoleErrors).toEqual([])
})

test('xenolab advanced lab section renders under reduced motion preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await openAdvancedLab(page)
  await expect(page.getByRole('heading', { name: 'Xenolab', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Entropy Phase Portrait/ }).click()
  await expect(page.getByRole('heading', { name: 'Entropy Phase Portrait' })).toBeVisible()
})
