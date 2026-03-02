import { PRIMARY_ANALYTICS_TABS_ID_BASE } from '@/components/layout/primary-analytics-tab-ids'
import { getTabsTabId } from '@/components/ui/tab-ids'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const viewTabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'explore', label: 'Explore' },
  { key: 'taste', label: 'Taste DNA' },
  { key: 'share', label: 'Share' },
] as const

type ViewTabKey = (typeof viewTabs)[number]['key']

export interface TabNavTabMeta {
  badge?: string
  detail?: string
}

interface TabNavProps {
  value: string
  onChange: (value: string) => void
  metadata?: Partial<Record<ViewTabKey, TabNavTabMeta>>
}

export function TabNav({
  value,
  onChange,
  metadata,
}: TabNavProps): JSX.Element {
  return (
    <div className="min-w-0 space-y-2">
      <Tabs
        value={value}
        onValueChange={onChange}
        className="min-w-0"
        idBase={PRIMARY_ANALYTICS_TABS_ID_BASE}
      >
        <TabsList
          className="grid w-full max-w-full min-w-0 grid-cols-2 items-stretch sm:grid-cols-4"
          aria-label="Primary analytics views"
        >
          {viewTabs.map((tab) => {
            const tabMeta = metadata?.[tab.key]
            const hasMeta = Boolean(tabMeta?.detail || tabMeta?.badge)
            const metaDescriptionId = hasMeta
              ? `${getTabsTabId(PRIMARY_ANALYTICS_TABS_ID_BASE, tab.key)}-meta`
              : undefined
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="w-full min-w-0 whitespace-normal px-2 py-2 text-left align-top sm:px-3"
                aria-label={tab.label}
                aria-describedby={metaDescriptionId}
              >
                <span className="flex w-full min-w-0 flex-col items-start gap-1 leading-tight">
                  <span>{tab.label}</span>
                  {hasMeta ? (
                    <span
                      id={metaDescriptionId}
                      className="flex w-full min-w-0 flex-wrap items-center gap-1 text-[10px] uppercase tracking-[0.12em] opacity-90"
                    >
                      {tabMeta?.badge ? (
                        <span className="rounded-theme border border-current/20 px-1.5 py-0.5">
                          {tabMeta.badge}
                        </span>
                      ) : null}
                      {tabMeta?.detail ? (
                        <span className="min-w-0 break-words normal-case tracking-normal opacity-80">
                          {tabMeta.detail}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
    </div>
  )
}
