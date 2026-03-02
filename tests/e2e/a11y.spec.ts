import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

import { uploadSyntheticFixture } from './helpers/spotifyFixture'

async function expectNoAxeViolations(page: Parameters<typeof test>[0]['page']): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('listentropy-theme', 'spotify-dark')
  })
})

test('@a11y home upload screen has no axe violations', async ({ page }) => {
  await page.goto('/')
  await expectNoAxeViolations(page)
})

test('@a11y uploaded overview and share screens have no axe violations', async ({ page }) => {
  await page.goto('/')
  await uploadSyntheticFixture(page)
  await expectNoAxeViolations(page)

  await page.getByRole('tab', { name: 'Share' }).click()
  await expect(page.getByRole('heading', { name: 'Share Studio' })).toBeVisible()
  await expectNoAxeViolations(page)
})

test('@a11y invalid upload error screen has no axe violations', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'malformed-history.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('not-a-real-zip'),
  })

  await expect(page.getByText(/valid \.zip archive/i)).toBeVisible()
  await expectNoAxeViolations(page)
})
