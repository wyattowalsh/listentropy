import { PRIMARY_ANALYTICS_TABS_ID_BASE } from '@/components/layout/primary-analytics-tab-ids'
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
  { key: 'extras', label: 'Extras' },
] as const

interface TabNavProps {
  value: string
  experienceLevel?: ExperienceLevel
  onChange: (value: string) => void
}

export function TabNav({
  value,
  onChange,
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
          {viewTabs.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
