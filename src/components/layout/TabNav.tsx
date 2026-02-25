import { PRIMARY_ANALYTICS_TABS_ID_BASE } from '@/components/layout/primary-analytics-tab-ids'
import { getTabsTabId } from '@/components/ui/tab-ids'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ExperienceLevel } from '@/lib/types'

const viewTabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'charts', label: 'Charts' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'clock', label: 'Clock' },
  { key: 'artist', label: 'Artist' },
  { key: 'habits', label: 'Habits' },
  { key: 'context', label: 'Context' },
  { key: 'eras', label: 'Eras' },
  { key: 'share', label: 'Share' },
  { key: 'universe', label: 'Universe' },
  { key: 'taste', label: 'Taste DNA' },
  { key: 'lab', label: 'Lab' },
  { key: 'extras', label: 'Extras' },
] as const

type ViewTabKey = (typeof viewTabs)[number]['key']

export interface TabNavTabMeta {
  badge?: string
  detail?: string
}

interface TabNavProps {
  value: string
  experienceLevel?: ExperienceLevel
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
        <TabsList className="w-full max-w-full min-w-0" aria-label="Primary analytics views">
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
                className="min-w-[112px] whitespace-normal px-3 py-2 text-left align-top"
                aria-label={tab.label}
                aria-describedby={metaDescriptionId}
              >
                <span className="flex min-w-0 flex-col items-start gap-1 leading-tight">
                  <span>{tab.label}</span>
                  {hasMeta ? (
                    <span
                      id={metaDescriptionId}
                      className="flex min-w-0 flex-wrap items-center gap-1 text-[10px] uppercase tracking-[0.12em] opacity-90"
                    >
                      {tabMeta?.badge ? (
                        <span className="rounded-theme border border-current/20 px-1.5 py-0.5">
                          {tabMeta.badge}
                        </span>
                      ) : null}
                      {tabMeta?.detail ? (
                        <span className="truncate normal-case tracking-normal opacity-80">
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
