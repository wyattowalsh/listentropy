import { Users, BarChart3, Share2 } from 'lucide-react'
import { PRIMARY_ANALYTICS_TABS_ID_BASE } from '@/components/layout/primary-analytics-tab-ids'
import { getTabsTabId } from '@/components/ui/tab-ids'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

const viewTabs = [
  { key: 'home', label: 'Home', icon: Users },
  { key: 'analytics', label: 'My Analytics', icon: BarChart3 },
  { key: 'share', label: 'Share', icon: Share2 },
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
    <div className="min-w-0 space-y-2.5">
      <Tabs
        value={value}
        onValueChange={onChange}
        className="min-w-0"
        idBase={PRIMARY_ANALYTICS_TABS_ID_BASE}
      >
        <TabsList
          className="grid w-full max-w-full min-w-0 grid-cols-3 items-stretch gap-1 rounded-theme-lg border-border/80 bg-surface/80 p-1.5"
          aria-label="Primary views"
        >
          {viewTabs.map((tab) => {
            const tabMeta = metadata?.[tab.key]
            const hasMeta = Boolean(tabMeta?.detail || tabMeta?.badge)
            const metaDescriptionId = hasMeta
              ? `${getTabsTabId(PRIMARY_ANALYTICS_TABS_ID_BASE, tab.key)}-meta`
              : undefined
            const Icon = tab.icon
            return (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="control-interactive w-full min-w-0 whitespace-normal border border-transparent bg-transparent px-2.5 py-2.5 text-left align-top transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-standard hover:-translate-y-px hover:border-border hover:bg-surface-hover/40 focus-visible:-translate-y-px aria-selected:border-accent/45 aria-selected:bg-accent aria-selected:text-accent-contrast sm:px-3"
                aria-label={tab.label}
                aria-describedby={metaDescriptionId}
              >
                <span className="flex w-full min-w-0 flex-col items-start gap-1 leading-tight">
                  <span className="flex items-center gap-1.5 font-medium tracking-[0.01em]">
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </span>
                  {hasMeta ? (
                    <span
                      id={metaDescriptionId}
                      className="flex w-full min-w-0 flex-wrap items-center gap-1 text-[10px] uppercase tracking-[0.12em] text-current/85"
                    >
                      {tabMeta?.badge ? (
                        <span className="rounded-theme border border-current/20 bg-bg/10 px-1.5 py-0.5">
                          {tabMeta.badge}
                        </span>
                      ) : null}
                      {tabMeta?.detail ? (
                        <span className="min-w-0 break-words normal-case tracking-normal text-current/75">
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
