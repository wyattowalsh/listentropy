import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'
import type { Locator, Page, TestInfo } from '@playwright/test'

import { openAdvancedTools, uploadAuditFixture } from './helpers/spotifyFixture'

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'uiux-audit', 'advanced')

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

async function openAdvancedShell(page: Page): Promise<Locator> {
  await openAdvancedTools(page)
  const sectionSwitcher = page.getByRole('combobox', { name: 'Advanced section' })
  await expect(sectionSwitcher).toBeVisible({ timeout: 30_000 })
  return sectionSwitcher
}

function buildArtistSearchProbe(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) {
    return 'a'
  }
  const token = trimmed.split(/\s+/)[0] ?? trimmed
  if (token.length < trimmed.length) {
    return token
  }
  return trimmed.length > 3 ? trimmed.slice(0, trimmed.length - 1) : trimmed
}

function analysisModeToggle(page: Page, mode: 'simple' | 'deep'): Locator {
  return page.getByRole('button', { name: mode === 'simple' ? 'Simple' : 'Deep', exact: true })
}

async function captureNetworkFallbackDiagnosticIfPresent(page: Page, testInfo: TestInfo): Promise<void> {
  const fallbackMessage = page.getByText(
    /Running in 2D fallback|3D rendering is unavailable|3D renderer failed to initialize|2D fallback is active|WebGL is unavailable/i,
  )
  if ((await fallbackMessage.count()) === 0) {
    return
  }
  await expect(fallbackMessage.first()).toBeVisible()
  const fallbackText = ((await fallbackMessage.first().textContent()) ?? '').trim()
  if (fallbackText) {
    await testInfo.attach('network-fallback-diagnostic-text', {
      body: fallbackText,
      contentType: 'text/plain',
    })
  }
}

test('captures advanced hub uiux flows with fixture zip', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Advanced UI/UX audit runs on chromium.')
  test.setTimeout(360_000)

  await page.goto('/')
  await uploadAuditFixture(page)
  await expect(page.getByRole('tab', { name: 'Advanced' })).toHaveCount(0)

  const sectionSwitcher = await openAdvancedShell(page)
  const simpleModeButton = analysisModeToggle(page, 'simple')
  const deepModeButton = analysisModeToggle(page, 'deep')
  await expect(simpleModeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(deepModeButton).toHaveAttribute('aria-pressed', 'false')
  await captureAuditScreenshot(page, testInfo, '01-advanced-shell-section-switcher')

  await sectionSwitcher.selectOption('network')
  await expect(page.getByRole('heading', { name: 'Music Universe Graph' })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByRole('heading', { name: 'Network Analytics' })).toBeVisible({ timeout: 45_000 })
  const deepBreakdown = page.locator('details').filter({
    has: page.locator('summary', { hasText: 'Deep network breakdown' }),
  }).first()
  await expect(deepBreakdown).toBeVisible({ timeout: 30_000 })
  await deepBreakdown.locator('summary').click()
  await expect(deepBreakdown).toHaveAttribute('open', '')
  await expect(page.getByRole('heading', { name: 'Top Hubs' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Graph Inspector' })).toBeVisible()
  const keyboardNavigator = page.getByRole('group', { name: 'Graph keyboard navigator' })
  await expect(keyboardNavigator).toBeVisible({ timeout: 30_000 })
  await keyboardNavigator.focus()
  await expect
    .poll(async () => keyboardNavigator.evaluate((element) => document.activeElement === element))
    .toBe(true)
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('status')).toContainText('Selected graph node:', { timeout: 15_000 })
  const selectedNodeSummary = page.getByText(/^Selected node:/)
  if ((await selectedNodeSummary.count()) > 0) {
    await expect(selectedNodeSummary.first()).toBeVisible()
  }
  await captureAuditScreenshot(page, testInfo, '02-network-shell-analytics-keyboard')
  await deepModeButton.click()
  await expect(deepModeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(simpleModeButton).toHaveAttribute('aria-pressed', 'false')
  await expect(
    page.locator('details').filter({ has: page.locator('summary', { hasText: 'Deep network breakdown' }) }),
  ).toHaveCount(0)
  await captureAuditScreenshot(page, testInfo, '02b-network-analysis-mode-deep')

  await captureNetworkFallbackDiagnosticIfPresent(page, testInfo)
  const diagnosticsCard = page.getByRole('heading', { name: 'View Diagnostics' }).locator('..')
  await expect(diagnosticsCard).toBeVisible({ timeout: 30_000 })
  await expect(diagnosticsCard.locator('dt', { hasText: /^Mode$/i })).toBeVisible()
  await expect(diagnosticsCard.locator('dt', { hasText: /^State$/i })).toBeVisible()
  await captureAuditScreenshot(page, testInfo, '03-network-fallback-diagnostics')
  await simpleModeButton.click()
  await expect(simpleModeButton).toHaveAttribute('aria-pressed', 'true')

  await sectionSwitcher.selectOption('artist')
  await expect(page.getByRole('heading', { name: 'Artist Analysis' })).toBeVisible({ timeout: 30_000 })
  const artistSearch = page.getByPlaceholder('Search artist...')
  await expect(artistSearch).toBeVisible()
  await captureAuditScreenshot(page, testInfo, '04-artist-analysis-default')
  const artistSearchProbe = buildArtistSearchProbe(await artistSearch.inputValue())
  await artistSearch.fill(artistSearchProbe)
  await expect(page.getByText('Selected Artist', { exact: true })).toBeVisible({ timeout: 15_000 })
  await captureAuditScreenshot(page, testInfo, '05-artist-analysis-search')
  await artistSearch.fill('__uiux_audit_unmatched_artist__')
  await expect(page.getByText('No artist found for your search.')).toBeVisible({ timeout: 15_000 })
  await captureAuditScreenshot(page, testInfo, '05b-artist-analysis-no-result-feedback')

  await sectionSwitcher.selectOption('lab')
  await expect(page.getByRole('heading', { name: 'Xenolab', exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByRole('heading', { name: 'Module Gallery' })).toBeVisible()
  await expect(page.locator('#xenolab-scenes')).toBeVisible()
  await expect(page.locator('#xenolab-compare-workspace')).toBeVisible()
  await captureAuditScreenshot(page, testInfo, '06-xenolab-shell-module-gallery')

  const moduleGallery = page.locator('section[aria-labelledby="xenolab-module-gallery"]')
  const runModuleButton = moduleGallery
    .locator('button:has-text("Run"):not([disabled]), button:has-text("Run Again"):not([disabled])')
    .first()
  await expect(runModuleButton).toBeVisible({ timeout: 30_000 })
  await runModuleButton.click()
  const explainButton = moduleGallery.locator('button:has-text("Explain"):not([disabled])').first()
  await expect(explainButton).toBeVisible({ timeout: 60_000 })
  await explainButton.click()
  const explainabilityCard = page.getByRole('heading', { name: 'Explainability', exact: true }).locator('..')
  await expect(explainabilityCard).toBeVisible({ timeout: 30_000 })
  const explainabilityDetails = page.getByText(
    /Source fields|Select a module result to inspect its provenance\./,
  )
  if ((await explainabilityDetails.count()) > 0) {
    await expect(explainabilityDetails.first()).toBeVisible({ timeout: 30_000 })
  }
  await captureAuditScreenshot(page, testInfo, '07-xenolab-module-run-explainability')

  const chronomapSceneButton = page.getByRole('button', { name: 'Chronomap Ridgelines' })
  if ((await chronomapSceneButton.count()) > 0) {
    await chronomapSceneButton.click()
    await expect(page.getByRole('heading', { name: 'Chronomap Ridgelines' })).toBeVisible({ timeout: 30_000 })
  }
  await captureAuditScreenshot(page, testInfo, '08-xenolab-scene-switch')

  const compareWorkspace = page.locator('[aria-labelledby="xenolab-compare-workspace"]')
  await compareWorkspace.getByRole('button', { name: 'Run Compare' }).click()
  await expect(
    compareWorkspace.getByText(/Capture a baseline dataset in Compare Workspace before running Compare Engine\./i),
  ).toBeVisible({ timeout: 30_000 })
  await captureAuditScreenshot(page, testInfo, '08b-xenolab-compare-baseline-required')

  await compareWorkspace.getByRole('button', { name: 'Capture Current as Baseline' }).click()
  const nightScopeButton = compareWorkspace.getByRole('button', { name: 'Night' })
  if ((await nightScopeButton.count()) > 0) {
    await nightScopeButton.click()
  }
  await compareWorkspace.getByRole('button', { name: 'Run Compare' }).click()
  await expect(compareWorkspace.getByText(/Top Metric Shifts|Slice Compare \(/).first()).toBeVisible({ timeout: 60_000 })
  const compareFeedback = compareWorkspace.getByText(
    /Compared current dataset against baseline|same dataset|Same fingerprint as baseline/i,
  )
  if ((await compareFeedback.count()) > 0) {
    await expect(compareFeedback.first()).toContainText(
      /Compared current dataset against baseline|same dataset|Same fingerprint as baseline/i,
    )
  }
  await captureAuditScreenshot(page, testInfo, '09-xenolab-compare-workspace-result')
  const deepCompareSummary = compareWorkspace.locator('summary', { hasText: 'Deep compare diagnostics' }).first()
  if (await deepCompareSummary.isVisible()) {
    await deepCompareSummary.click()
  }
  await expect(compareWorkspace.getByText('Era vs Era Compare').first()).toBeVisible({ timeout: 30_000 })
  await captureAuditScreenshot(page, testInfo, '09b-xenolab-compare-deep-diagnostics')

  await sectionSwitcher.selectOption('plugins')
  await expect(page.getByRole('heading', { name: 'Plugin Extras' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('Filter plugins')).toBeVisible()
  await captureAuditScreenshot(page, testInfo, '10-plugins-list-shell')
  const pluginPanelOutput = page.locator('details').filter({
    has: page.locator('summary', { hasText: 'Panel Output' }),
  }).first()
  await expect(pluginPanelOutput).toBeVisible()
  await expect(pluginPanelOutput).not.toHaveAttribute('open', '')
  await deepModeButton.click()
  await expect(deepModeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(pluginPanelOutput).toHaveAttribute('open', '')
  await captureAuditScreenshot(page, testInfo, '10b-plugins-deep-panel-output')

  await page.getByRole('button', { name: 'Analyst Preset' }).click()
  await page.getByLabel('Filter plugins').fill('snapshot')
  const pluginSortSelect = page
    .locator('select')
    .filter({ has: page.locator('option[value="capabilities"]') })
    .first()
  await pluginSortSelect.selectOption('capabilities')
  await expect(page.getByRole('heading', { name: 'Snapshot Compare' })).toBeVisible({ timeout: 30_000 })
  await captureAuditScreenshot(page, testInfo, '11-plugins-preset-filter')

  const snapshotActionButton = page.getByRole('button', { name: 'Capture/Compare Snapshot' }).first()
  await expect(snapshotActionButton).toBeVisible({ timeout: 30_000 })
  await snapshotActionButton.click()
  const snapshotFeedback = page.getByText(/Baseline snapshot captured|Compared to|Snapshot overwritten/i)
  if ((await snapshotFeedback.count()) > 0) {
    await expect(snapshotFeedback.first()).toContainText(/Baseline snapshot captured|Compared to|Snapshot overwritten/i)
  }
  await captureAuditScreenshot(page, testInfo, '12-plugins-action-feedback')
})
