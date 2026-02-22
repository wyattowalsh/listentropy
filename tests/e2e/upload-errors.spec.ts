import JSZip from 'jszip'
import { expect, test } from '@playwright/test'

async function makeZipWithoutHistory(): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('README.txt', 'hello')
  return zip.generateAsync({ type: 'nodebuffer' })
}

async function makeZipWithMalformedHistoryJson(): Promise<Buffer> {
  const zip = new JSZip()
  zip.file('Streaming_History_Audio_2024-2025_0.json', '{not-json')
  return zip.generateAsync({ type: 'nodebuffer' })
}

test('plain text upload shows friendly invalid zip guidance', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'not-a-zip.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('plain text'),
  })

  await expect(page.getByText(/valid \.zip archive/i)).toBeVisible()
  await expect(page.getByText(/central directory/i)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Failed to parse data' })).toHaveCount(0)
})

test('zip without spotify history shows extended-history guidance', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'missing-history.zip',
    mimeType: 'application/zip',
    buffer: await makeZipWithoutHistory(),
  })

  await expect(page.getByText(/No Spotify Extended Streaming History files were found/i)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Failed to parse data' })).toHaveCount(0)
})

test('malformed spotify history json shows friendly parse error', async ({ page }) => {
  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'malformed-history.zip',
    mimeType: 'application/zip',
    buffer: await makeZipWithMalformedHistoryJson(),
  })

  await expect(page.getByRole('heading', { name: 'Failed to parse data' })).toBeVisible()
  await expect(page.getByText(/appears corrupted/i)).toBeVisible()
  await expect(page.getByText(/re-download/i)).toBeVisible()
})

