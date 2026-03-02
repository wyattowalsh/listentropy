import { Suspense, lazy, useEffect, useMemo, useState } from 'react'

import { Header } from '@/components/layout/Header'
import { getPrimaryAnalyticsPanelId, getPrimaryAnalyticsTabId } from '@/components/layout/primary-analytics-tab-ids'
import { TabNav } from '@/components/layout/TabNav'
import { ViewContainer } from '@/components/layout/ViewContainer'
import { ViewErrorBoundary } from '@/components/layout/ViewErrorBoundary'
import { ParseProgress } from '@/components/upload/ParseProgress'
import { DropZone } from '@/components/upload/DropZone'
import { pluginRegistry } from '@/lib/plugins/runtime'
import { firstPartyPlugins } from '@/features/plugins/firstPartyPlugins'
import type { AdvancedHubSection } from '@/components/views/AdvancedHub'
import { applyTheme, useThemeStore } from '@/store/useThemeStore'
import { useDataStore } from '@/store/useDataStore'
import { useExperienceStore } from '@/store/useExperienceStore'
import { useSessionMetricsStore } from '@/store/useSessionMetricsStore'

const OverviewDashboard = lazy(() =>
  import('@/components/views/OverviewDashboard').then((module) => ({
    default: module.OverviewDashboard,
  })),
)
const ShareStudio = lazy(() =>
  import('@/components/views/ShareStudio').then((module) => ({
    default: module.ShareStudio,
  })),
)
const ExploreDashboard = lazy(() =>
  import('@/components/views/ExploreDashboard').then((module) => ({
    default: module.ExploreDashboard,
  })),
)
const TasteDNA = lazy(() =>
  import('@/components/views/TasteDNA').then((module) => ({
    default: module.TasteDNA,
  })),
)
const AdvancedHub = lazy(() =>
  import('@/components/views/AdvancedHub').then((module) => ({
    default: module.AdvancedHub,
  })),
)

type MainView =
  | 'overview'
  | 'explore'
  | 'taste'
  | 'share'
  | 'advanced'

type PrimaryMainView = Exclude<MainView, 'advanced'>

interface ViewTabMeta {
  badge?: string
  detail?: string
}

export function DashboardApp(): JSX.Element {
  const [primaryView, setPrimaryView] = useState<PrimaryMainView>('overview')
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [advancedSection, setAdvancedSection] = useState<AdvancedHubSection>('lab')
  const mode = useDataStore((state) => state.mode)
  const progress = useDataStore((state) => state.progress)
  const error = useDataStore((state) => state.error)
  const data = useDataStore((state) => state.data)
  const ingestZip = useDataStore((state) => state.ingestZip)
  const reset = useDataStore((state) => state.reset)
  const timezoneMode = useDataStore((state) => state.timezoneMode)
  const setTimezoneMode = useDataStore((state) => state.setTimezoneMode)
  const themeKey = useThemeStore((state) => state.themeKey)
  const recordExperienceBehavior = useExperienceStore((state) => state.recordBehavior)
  const recordMetric = useSessionMetricsStore((state) => state.record)
  const view: MainView = isAdvancedOpen ? 'advanced' : primaryView

  useEffect(() => {
    applyTheme(themeKey)
  }, [themeKey])

  useEffect(() => {
    for (const plugin of firstPartyPlugins) {
      if (!pluginRegistry.get(plugin.manifest.id)) {
        pluginRegistry.register(plugin)
      }
    }
  }, [])

  useEffect(() => {
    const fullViews: MainView[] = ['explore', 'advanced']
    if (fullViews.includes(view)) {
      recordExperienceBehavior('full_tab_visit')
      recordMetric({
        type: 'full_tab_visit',
        timestamp: new Date().toISOString(),
        dedupeKey: `full-tab:${view}`,
        metadata: { view },
      })
    }
  }, [recordExperienceBehavior, recordMetric, view])

  function openAdvanced(nextSection?: AdvancedHubSection): void {
    if (nextSection) {
      setAdvancedSection(nextSection)
    }
    setIsAdvancedOpen(true)
  }

  const body = useMemo(() => {
    if (!data) {
      return null
    }
    if (view === 'overview') {
      return <OverviewDashboard data={data} />
    }
    if (view === 'explore') {
      return (
        <ExploreDashboard
          data={data}
          onOpenAdvancedSection={(section) => {
            setAdvancedSection(section)
            setIsAdvancedOpen(true)
          }}
        />
      )
    }
    if (view === 'share') {
      return <ShareStudio data={data} />
    }
    if (view === 'taste') {
      return (
        <TasteDNA
          data={data}
          onOpenSpotifySetup={() => {
            setAdvancedSection('lab')
            setIsAdvancedOpen(true)
          }}
        />
      )
    }
    return (
      <AdvancedHub
        data={data}
        section={advancedSection}
        onSectionChange={setAdvancedSection}
      />
    )
  }, [advancedSection, data, view])

  const loadingFallback = (
    <div className="rounded-theme border border-border bg-surface p-6">
      <div className="skeleton h-5 w-32 rounded-sm" />
      <div className="skeleton mt-3 h-4 w-2/3 rounded-sm" />
      <div className="skeleton mt-6 h-64 w-full rounded-sm" />
    </div>
  )

  const tabMetadata = useMemo<Record<PrimaryMainView, ViewTabMeta> | null>(() => {
    if (!data) {
      return null
    }
    return {
      overview: {
        badge: `${Math.round(data.summary.totalHours)}h`,
        detail: `${data.summary.totalPlays.toLocaleString()} plays`,
      },
      explore: {
        badge: '6 sections',
        detail: `${data.graphAnalytics.summary.nodeCount.toLocaleString()} graph nodes · ${data.eras.length} eras`,
      },
      share: {
        badge: `${data.narrativeInsights.length} insights`,
        detail: 'story cards + export formats',
      },
      taste: {
        badge: `${data.taste.dimensions.length} dims`,
        detail: 'DNA + Spotify enrichment',
      },
    }
  }, [data])

  if (mode === 'idle') {
    return (
      <div className="relative min-h-screen bg-bg text-text">
        <ViewContainer>
          <div className="mx-auto mt-12 max-w-3xl">
            <div className="mb-6 text-center">
              <h1 className="font-heading text-5xl text-text">Listentropy</h1>
              <p className="mt-3 text-sm text-text-muted">
                Request your Spotify Extended Streaming History zip and drop it below.
                All processing happens locally in your browser.
              </p>
            </div>
            <div className="mb-4 rounded-theme border border-border bg-surface p-4 text-left">
              <p className="text-sm font-semibold text-text">Upload preflight</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-muted">
                <li>Use the original Spotify Extended Streaming History `.zip` file.</li>
                <li>Expected files include `Streaming_History_Audio_*.json` entries.</li>
                <li>Listentropy strips `ip_addr` and processes data locally in-browser.</li>
              </ul>
            </div>
            <DropZone onFileSelected={ingestZip} />
            <div className="mt-5 rounded-theme border border-border bg-surface p-4 text-sm text-text-muted">
              <p className="font-semibold text-text">How to get your Spotify export</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Go to spotify.com/account/privacy and sign in.</li>
                <li>Open data request controls and request Extended Streaming History.</li>
                <li>Download the zip when Spotify sends it.</li>
                <li>Upload the original .zip here.</li>
              </ol>
            </div>
          </div>
        </ViewContainer>
      </div>
    )
  }

  if (mode === 'parsing') {
    return (
      <div className="min-h-screen bg-bg text-text">
        <ViewContainer>
          <div className="mx-auto mt-16 max-w-2xl">
            <h2 className="font-heading text-3xl text-text">Processing your history...</h2>
            <p className="mt-2 text-sm text-text-muted">
              Worker-first pipeline is aggregating your data locally.
            </p>
            <ParseProgress progress={progress} />
          </div>
        </ViewContainer>
      </div>
    )
  }

  if (mode === 'error') {
    return (
      <div className="min-h-screen bg-bg text-text">
        <ViewContainer>
          <div className="mx-auto mt-16 max-w-2xl rounded-theme border border-negative/40 bg-surface p-6">
            <h2 className="font-heading text-2xl text-negative">Failed to parse data</h2>
            <p className="mt-2 text-sm text-text-muted">{error}</p>
            <button
              className="mt-4 rounded-theme border border-border px-3 py-2 text-sm"
              onClick={handleReset}
            >
              Try again
            </button>
          </div>
        </ViewContainer>
      </div>
    )
  }

  function handleReset(): void {
    setIsAdvancedOpen(false)
    setPrimaryView('overview')
    setAdvancedSection('lab')
    reset()
  }
  const activePrimaryNavView = primaryView

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header
        onReset={handleReset}
        onOpenAdvanced={openAdvanced}
        timezoneMode={timezoneMode}
        onTimezoneModeChange={setTimezoneMode}
      />
      <ViewContainer>
        <section className="space-y-4 sm:space-y-5">
          <TabNav
            value={activePrimaryNavView}
            onChange={(value) => {
              setIsAdvancedOpen(false)
              setPrimaryView(value as PrimaryMainView)
            }}
            metadata={tabMetadata ?? undefined}
          />
          <div
            className="min-w-0"
            role="tabpanel"
            id={getPrimaryAnalyticsPanelId(activePrimaryNavView)}
            aria-labelledby={getPrimaryAnalyticsTabId(activePrimaryNavView)}
            tabIndex={0}
          >
            <ViewErrorBoundary viewKey={view}>
              <Suspense fallback={loadingFallback}>{body}</Suspense>
            </ViewErrorBoundary>
          </div>
        </section>
      </ViewContainer>
    </div>
  )
}
