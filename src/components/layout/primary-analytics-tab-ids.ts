import { getTabsPanelId, getTabsTabId } from '@/components/ui/tab-ids'

export const PRIMARY_ANALYTICS_TABS_ID_BASE = 'primary-analytics'

export function getPrimaryAnalyticsTabId(value: string): string {
  return getTabsTabId(PRIMARY_ANALYTICS_TABS_ID_BASE, value)
}

export function getPrimaryAnalyticsPanelId(value: string): string {
  return getTabsPanelId(PRIMARY_ANALYTICS_TABS_ID_BASE, value)
}

