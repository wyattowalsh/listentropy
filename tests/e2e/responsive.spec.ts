import { expect, test } from '@playwright/test'

import { uploadSyntheticFixture } from './helpers/spotifyFixture'

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

  await page.getByRole('tab', { name: 'Explore' }).click()
  await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Context Intelligence' })).toBeVisible()
  await expectNoPageOverflow(page)

  await page.getByRole('heading', { name: 'Music Eras' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: 'Era Detail' })).toBeVisible()
  await expectNoPageOverflow(page)

  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await page.getByRole('combobox', { name: 'Advanced section' }).selectOption('network')
  await expect(page.getByRole('heading', { name: 'Music Universe Graph' })).toBeVisible()
  await expect(page.getByText('Network Analytics')).toBeVisible()
  await expectNoPageOverflow(page)

  await page.getByRole('tab', { name: 'Taste DNA' }).click()
  await expect(page.getByRole('heading', { name: 'Taste DNA' })).toBeVisible()
  await expectNoPageOverflow(page)
})

test('@matrix fresh upload shows simplified tabs immediately and explore rankings renders', async ({ page }) => {
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await expect(page.getByRole('button', { name: 'Unlock Full Analytics' })).toHaveCount(0)
  await expect(page.getByRole('tab')).toHaveCount(4)
  await page.getByRole('tab', { name: 'Explore' }).click()
  await expect(page.getByPlaceholder('Search leaderboard...')).toBeVisible()
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

  await page.getByRole('tab', { name: 'Explore' }).click()
  await page.getByRole('heading', { name: 'Music Eras' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: 'Era Detail' })).toBeVisible()
  await expect(page).toHaveScreenshot('mobile-eras-detail.png', {
    fullPage: true,
    animations: 'disabled',
  })

  await page.getByRole('button', { name: 'Advanced', exact: true }).click()
  await page.getByRole('combobox', { name: 'Advanced section' }).selectOption('network')
  await expect(page.getByText('Network Analytics')).toBeVisible()
  await expect(page).toHaveScreenshot('mobile-universe-analytics.png', {
    fullPage: true,
    animations: 'disabled',
  })
})
