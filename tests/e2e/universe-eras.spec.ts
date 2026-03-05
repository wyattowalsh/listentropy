import { expect, test } from '@playwright/test'

import { openAdvancedTools, uploadSyntheticFixture } from './helpers/spotifyFixture'

test('@matrix universe renders graph controls, analytics, and diagnostics', async ({ page }) => {
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await openAdvancedTools(page, 'network')

  const universeGraphCard = page.getByRole('heading', { name: 'Music Universe Graph' }).locator('..')
  await expect(universeGraphCard).toBeVisible()
  const modeSelect = page.getByRole('combobox', { name: /^Mode/i })
  await expect(modeSelect).toBeVisible()
  const modeValue = await modeSelect.inputValue()
  expect(['2d', '3d']).toContain(modeValue)
  if (modeValue === '3d') {
    await expect(page.getByRole('button', { name: 'Reset Camera' })).toBeVisible()
  } else {
    await expect(page.getByRole('button', { name: 'Reset Camera' })).toHaveCount(0)
  }
  await expect(page.getByPlaceholder('Search artist or track in graph…')).toBeVisible()
  await expect(page.getByLabel('Co-listen edges')).toBeVisible()
  await expect(page.getByLabel('Contains edges')).toBeVisible()
  await expect(page.getByText('Network Analytics')).toBeVisible()
  const simpleModeButton = page.getByRole('button', { name: 'Simple', exact: true })
  const deepModeButton = page.getByRole('button', { name: 'Deep', exact: true })
  await expect(simpleModeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(deepModeButton).toHaveAttribute('aria-pressed', 'false')

  const deepBreakdown = page.locator('details').filter({ has: page.getByText('Deep network breakdown') })
  await expect(deepBreakdown).toBeVisible()
  await expect(page.getByText('Top Hubs')).toBeHidden()

  await deepBreakdown.locator('summary').click()
  await expect(deepBreakdown).toHaveAttribute('open', '')
  await expect(page.getByText('Top Hubs')).toBeVisible()
  await expect(page.getByText('Bridge Artists')).toBeVisible()
  await expect(page.getByText('Cluster Summary')).toBeVisible()
  await expect(page.getByText('Co-listen Motifs')).toBeVisible()
  await expect(page.getByText('View Diagnostics')).toBeVisible()

  await deepModeButton.click()
  await expect(deepModeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(simpleModeButton).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('details').filter({ has: page.getByText('Deep network breakdown') })).toHaveCount(0)
  await expect(page.getByText('Top Hubs')).toBeVisible()

  const fallbackMessage = page.getByText(/Running in 2D fallback|2D mode|3D renderer failed|3D rendering is unavailable/i)
  if ((await fallbackMessage.count()) > 0) {
    await expect(fallbackMessage.first()).toBeVisible()
  }

  const graphCanvas = page.locator('canvas').first()
  if ((await page.locator('canvas').count()) > 0) {
    await expect(graphCanvas).toBeVisible()
  } else {
    await expect(fallbackMessage.first()).toBeVisible()
  }
})

test('@matrix universe provides keyboard graph fallback navigation', async ({ page }) => {
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await openAdvancedTools(page, 'network')

  const keyboardNavigator = page.getByRole('group', { name: 'Graph keyboard navigator' })
  await expect(keyboardNavigator).toBeVisible()

  await keyboardNavigator.focus()
  await page.keyboard.press('ArrowDown')

  await expect(page.getByRole('status')).toContainText('Selected graph node:')
  await expect(page.getByText(/^Selected node:/)).toBeVisible()
})

test('@matrix dashboard summary exposes era counts with overview diagnostics', async ({ page }) => {
  await page.goto('/')
  await uploadSyntheticFixture(page)

  const dashboardTab = page.getByRole('tab', { name: 'Dashboard' })
  await expect(dashboardTab).toContainText(/eras/i)
  await expect(page.getByRole('heading', { name: 'Overview Snapshot' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Year-over-year listening' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Data Quality' })).toBeVisible()
})
