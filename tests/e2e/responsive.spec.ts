import { expect, test } from '@playwright/test'

import { openAdvancedTools, uploadSyntheticFixture } from './helpers/spotifyFixture'

async function expectNoPageOverflow(page: Parameters<typeof test>[0]['page']): Promise<void> {
  const metrics = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth + 1)
}

test('@matrix mobile key views avoid page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await expectNoPageOverflow(page)

  await page.getByRole('tab', { name: 'Share' }).click()
  await expect(page.getByRole('heading', { name: 'Share Studio' })).toBeVisible()
  await expectNoPageOverflow(page)

  await page.getByRole('tab', { name: 'Dashboard' }).click()
  await expect(page.getByRole('heading', { name: 'Overview Snapshot' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Country context' })).toBeVisible()
  await expectNoPageOverflow(page)

  await openAdvancedTools(page, 'network')
  await expect(page.getByRole('heading', { name: 'Music Universe Graph' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Network at a glance' })).toBeVisible()
  await expect(page.getByText('Network Analytics')).toBeVisible()
  const deepBreakdown = page.locator('details').filter({
    has: page.locator('summary', { hasText: 'Deep network breakdown' }),
  }).first()
  await expect(deepBreakdown).toBeVisible()
  await expect(deepBreakdown).not.toHaveAttribute('open', '')
  const advancedControls = page.locator('details').filter({
    has: page.locator('summary', { hasText: 'Advanced renderer and density controls' }),
  }).first()
  await expect(advancedControls).toBeVisible()
  await expect(advancedControls).not.toHaveAttribute('open', '')
  await expectNoPageOverflow(page)
})

test('@matrix fresh upload shows simplified tabs immediately and explore rankings renders', async ({ page }) => {
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await expect(page.getByRole('button', { name: 'Unlock Full Analytics' })).toHaveCount(0)
  await expect(page.getByRole('tab')).toHaveCount(2)
  await expect(page.getByRole('tab', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Share' })).toBeVisible()
  await openAdvancedTools(page, 'network')
  await expect(page.getByText('Network Analytics')).toBeVisible()
})

test('@visual mobile header and tab strip snapshot', async ({ page }) => {
  test.skip(process.env.PW_VISUAL !== '1', 'Opt-in visual snapshots only')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await expect(page).toHaveScreenshot('mobile-uploaded-header-tabs.png', {
    fullPage: false,
    animations: 'disabled',
  })
})

test('@visual mobile share studio controls snapshot', async ({ page }) => {
  test.skip(process.env.PW_VISUAL !== '1', 'Opt-in visual snapshots only')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await uploadSyntheticFixture(page)
  await page.getByRole('tab', { name: 'Share' }).click()
  await expect(page.getByRole('heading', { name: 'Share Studio' })).toBeVisible()

  await expect(page).toHaveScreenshot('mobile-share-studio-controls.png', {
    fullPage: true,
    animations: 'disabled',
  })
})

test('@visual mobile universe and eras snapshot', async ({ page }) => {
  test.skip(process.env.PW_VISUAL !== '1', 'Opt-in visual snapshots only')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await page.getByRole('heading', { name: 'Year-over-year listening' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: 'Country context' })).toBeVisible()
  await expect(page).toHaveScreenshot('mobile-eras-detail.png', {
    fullPage: true,
    animations: 'disabled',
  })

  await openAdvancedTools(page, 'network')
  await expect(page.getByText('Network Analytics')).toBeVisible()
  await expect(page).toHaveScreenshot('mobile-universe-analytics.png', {
    fullPage: true,
    animations: 'disabled',
  })
})
