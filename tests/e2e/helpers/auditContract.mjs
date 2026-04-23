import { expect } from '@playwright/test'

export const PRIMARY_ANALYTICS_TABLIST_LABEL = 'Primary views'
export const PRIMARY_ANALYTICS_TABS = {
  home: 'Home',
  analytics: 'My Analytics',
  share: 'Share',
}
export const INVALID_SHARE_TITLE = 'This link needs a refresh'

function toDomIdSegment(value) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-')
}

export function getPrimaryAnalyticsPanelId(value) {
  return `primary-analytics-panel-${toDomIdSegment(value)}`
}

export function getPrimaryAnalyticsTab(page, label) {
  return page
    .getByRole('tablist', { name: PRIMARY_ANALYTICS_TABLIST_LABEL })
    .getByRole('tab', { name: label, exact: true })
}

export async function openPrimaryAnalyticsTab(page, label) {
  const tab = getPrimaryAnalyticsTab(page, label)
  await tab.click()
  const panelId = await tab.getAttribute('aria-controls')
  if (!panelId) {
    throw new Error(`Primary analytics tab "${label}" is missing aria-controls`)
  }
  return page.locator(`#${panelId}`)
}

export async function assertInvalidShareRecovery(page) {
  await expect(page.getByRole('heading', { name: INVALID_SHARE_TITLE })).toBeVisible()
  await expect(page.getByText(/couldn't decode this snapshot payload safely/i)).toBeVisible()
  await expect(page.getByText(/data privacy: decoding happens in your browser/i)).toBeVisible()
  await expect(page.getByText(/link authenticity: snapshots are browser-generated and unverified in this release/i)).toBeVisible()
  await expect(page.getByRole('link', { name: /create a new share snapshot/i })).toBeVisible()
}
