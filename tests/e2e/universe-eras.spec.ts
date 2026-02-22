import { expect, test } from '@playwright/test'

import { uploadSyntheticFixture } from './helpers/spotifyFixture'

test('@matrix universe renders graph controls, analytics, and diagnostics', async ({ page }) => {
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await page.getByRole('tab', { name: 'Universe' }).click()

  await expect(page.getByText('Music Universe Graph')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reset Camera' })).toBeVisible()
  await expect(page.getByPlaceholder('Search artist or track in graph…')).toBeVisible()
  await expect(page.getByLabel('Co-listen edges')).toBeVisible()
  await expect(page.getByLabel('Contains edges')).toBeVisible()
  await expect(page.getByText('Network Analytics')).toBeVisible()
  await expect(page.getByText('Top Hubs')).toBeVisible()
  await expect(page.getByText('Bridge Artists')).toBeVisible()
  await expect(page.getByText('Cluster Summary')).toBeVisible()
  await expect(page.getByText('Co-listen Motifs')).toBeVisible()
  await expect(page.getByText('View Diagnostics')).toBeVisible()

  const fallbackMessage = page.getByText(/2D mode|3D renderer failed|3D rendering is unavailable/i)
  if ((await fallbackMessage.count()) > 0) {
    await expect(fallbackMessage.first()).toBeVisible()
  }

  await expect(page.locator('canvas').first()).toBeVisible()
})

test('@matrix eras tab shows timeline, detail, diagnostics, and summary table', async ({ page }) => {
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await page.getByRole('tab', { name: 'Eras' }).click()

  await expect(page.getByRole('heading', { name: 'Music Eras' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Detected Eras' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Era Intelligence Summary' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Era Detail' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Transition Diagnostics' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Era Summary Table' })).toBeVisible()

  const eraButtons = page.locator('button[aria-pressed]')
  const buttonCount = await eraButtons.count()
  expect(buttonCount).toBeGreaterThan(0)
  if (buttonCount > 1) {
    await eraButtons.nth(1).click()
    await expect(eraButtons.nth(1)).toHaveAttribute('aria-pressed', 'true')
  }

  const transitionCard = page.getByRole('heading', { name: 'Transition Diagnostics' }).locator('..')
  const firstEraText = transitionCard.getByText(/This is the first detected era/i)
  const transitionConfidenceText = transitionCard.getByText(/Transition confidence:/i)
  if ((await firstEraText.count()) > 0) {
    await expect(firstEraText.first()).toBeVisible()
  } else {
    await expect(transitionConfidenceText.first()).toBeVisible()
  }
})
