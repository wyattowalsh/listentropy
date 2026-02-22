import { expect, test } from '@playwright/test'

import { uploadSyntheticFixture } from './helpers/spotifyFixture'

test('@matrix universe renders graph controls, analytics, and diagnostics', async ({ page }) => {
  await page.goto('/')
  await uploadSyntheticFixture(page)

  await page.getByRole('tab', { name: 'Universe' }).click()

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
  await expect(page.getByText('Top Hubs')).toBeVisible()
  await expect(page.getByText('Bridge Artists')).toBeVisible()
  await expect(page.getByText('Cluster Summary')).toBeVisible()
  await expect(page.getByText('Co-listen Motifs')).toBeVisible()
  await expect(page.getByText('View Diagnostics')).toBeVisible()

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

  const detectedErasCard = page.getByRole('heading', { name: 'Detected Eras' }).locator('..')
  const eraButtons = detectedErasCard.locator('button[aria-pressed]')
  const buttonCount = await eraButtons.count()
  expect(buttonCount).toBeGreaterThan(0)

  const eraDetailCard = page.getByRole('heading', { name: 'Era Detail' }).locator('..')
  const eraDetailDescription = eraDetailCard.locator('p').first()
  const transitionCard = page.getByRole('heading', { name: 'Transition Diagnostics' }).locator('..')
  const transitionDescription = transitionCard.locator('p').first()

  if (buttonCount > 1) {
    const activeIndex = await eraButtons.evaluateAll((buttons) =>
      buttons.findIndex((button) => button.getAttribute('aria-pressed') === 'true'),
    )
    const targetIndex = activeIndex === 0 ? 1 : 0
    const detailDescriptionBefore = (await eraDetailDescription.textContent())?.trim() ?? ''
    const transitionDescriptionBefore = (await transitionDescription.textContent())?.trim() ?? ''
    expect(detailDescriptionBefore).not.toBe('')
    expect(transitionDescriptionBefore).not.toBe('')

    await eraButtons.nth(targetIndex).click()
    await expect(eraButtons.nth(targetIndex)).toHaveAttribute('aria-pressed', 'true')
    await expect(eraDetailDescription).not.toHaveText(detailDescriptionBefore)
    await expect(transitionDescription).not.toHaveText(transitionDescriptionBefore)
  }

  const firstEraText = transitionCard.getByText(/This is the first detected era/i)
  const transitionConfidenceText = transitionCard.getByText(/Transition confidence:/i)
  if ((await firstEraText.count()) > 0) {
    await expect(firstEraText.first()).toBeVisible()
  } else {
    await expect(transitionConfidenceText.first()).toBeVisible()
  }
})
