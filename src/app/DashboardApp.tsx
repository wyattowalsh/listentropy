import { Suspense, lazy, useEffect, useMemo, useState } from 'react'

import { Header } from '@/components/layout/Header'
import { getPrimaryAnalyticsPanelId, getPrimaryAnalyticsTabId } from '@/components/layout/primary-analytics-tab-ids'
import { TabNav } from '@/components/layout/TabNav'
import { ViewContainer } from '@/components/layout/ViewContainer'
import { ViewErrorBoundary } from '@/components/layout/ViewErrorBoundary'
import { DropZone } from '@/components/upload/DropZone'
import { ParseProgress } from '@/components/upload/ParseProgress'
import type { AdvancedHubSection } from '@/components/views/AdvancedHub'
import { firstPartyPlugins } from '@/features/plugins/firstPartyPlugins'
import { pluginRegistry } from '@/lib/plugins/runtime'
import { useDataStore } from '@/store/useDataStore'
import { useExperienceStore } from '@/store/useExperienceStore'
import { useSessionMetricsStore } from '@/store/useSessionMetricsStore'
import { applyTheme, useThemeStore } from '@/store/useThemeStore'

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
const AdvancedHub = lazy(() =>
  import('@/components/views/AdvancedHub').then((module) => ({
    default: module.AdvancedHub,
  })),
)

type MainView = 'dashboard' | 'share'

type PrimaryMainView = MainView

interface ViewTabMeta {
  badge?: string
  detail?: string
}

const ADVANCED_HASH_PREFIX = '#advanced/'
const ADVANCED_SECTIONS: AdvancedHubSection[] = ['lab', 'network', 'artist', 'plugins']
const DEMO_ZIP_PATH = `${import.meta.env.BASE_URL}demo-history-large.json`

function readAdvancedSectionFromHash(): AdvancedHubSection | null {
  if (typeof window === 'undefined') {
    return null
  }
  if (!window.location.hash.startsWith(ADVANCED_HASH_PREFIX)) {
    return null
  }
  const candidate = window.location.hash.slice(ADVANCED_HASH_PREFIX.length) as AdvancedHubSection
  return ADVANCED_SECTIONS.includes(candidate) ? candidate : null
}

function syncAdvancedHash(section: AdvancedHubSection | null): void {
  if (typeof window === 'undefined') {
    return
  }
  const { pathname, search, hash } = window.location
  if (section) {
    const nextHash = `${ADVANCED_HASH_PREFIX}${section}`
    if (hash !== nextHash) {
      window.history.replaceState(window.history.state, '', `${pathname}${search}${nextHash}`)
    }
    return
  }
  if (hash.startsWith(ADVANCED_HASH_PREFIX)) {
    window.history.replaceState(window.history.state, '', `${pathname}${search}`)
  }
}

export function DashboardApp(): JSX.Element {
  const deepLinkedAdvancedSection = readAdvancedSectionFromHash()
  const [primaryView, setPrimaryView] = useState<PrimaryMainView>('dashboard')
  const [advancedSection, setAdvancedSection] = useState<AdvancedHubSection>(
    deepLinkedAdvancedSection ?? 'lab',
  )
  const [showAdvancedTools, setShowAdvancedTools] = useState(deepLinkedAdvancedSection !== null)
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
  const view: MainView = primaryView

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
    syncAdvancedHash(showAdvancedTools ? advancedSection : null)
  }, [advancedSection, showAdvancedTools])

  useEffect(() => {
    const fullViews: MainView[] = ['share']
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

  function openAdvancedTools(nextSection?: AdvancedHubSection): void {
    if (nextSection) {
      setAdvancedSection(nextSection)
    }
    setShowAdvancedTools(true)
    setPrimaryView('dashboard')
  }

  const body = useMemo(() => {
    if (!data) {
      return null
    }
    if (view === 'dashboard') {
      return (
        <div className="space-y-6">
          <OverviewDashboard data={data} />
          <section className="rounded-theme border border-border bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-heading text-xl text-text">Advanced tools</h2>
                <p className="mt-1 text-sm text-text-muted">
                  Reveal Xenolab, network, artist deep dive, and plugin extras without leaving Dashboard.
                </p>
              </div>
              <button
                type="button"
                className="rounded-theme border border-border px-3 py-2 text-sm transition hover:border-accent/45 hover:text-accent"
                aria-expanded={showAdvancedTools}
                onClick={() => {
                  setShowAdvancedTools((value) => !value)
                }}
              >
                {showAdvancedTools ? 'Hide advanced tools' : 'Show advanced tools'}
              </button>
            </div>
            {showAdvancedTools ? (
              <div className="mt-4">
                <AdvancedHub
                  data={data}
                  section={advancedSection}
                  onSectionChange={setAdvancedSection}
                />
              </div>
            ) : null}
          </section>
        </div>
      )
    }
    return <ShareStudio data={data} />
  }, [advancedSection, data, showAdvancedTools, view])

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
      dashboard: {
        badge: `${Math.round(data.summary.totalHours)}h`,
        detail: `${data.summary.totalPlays.toLocaleString()} plays · ${data.eras.length} eras`,
      },
      share: {
        badge: `${data.narrativeInsights.length} insights`,
        detail: 'story cards + export formats',
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
            <DropZone onFileSelected={ingestZip} demoZipPath={DEMO_ZIP_PATH} />
            <div className="mt-5 rounded-theme border border-border bg-surface p-4 text-sm text-text-muted">
              <p className="font-semibold text-text">How to get your Spotify export</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>
                  Go to{' '}
                  <a
                    href="https://spotify.com/account/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-text underline decoration-dotted underline-offset-2 transition-colors hover:text-accent"
                  >
                    spotify.com/account/privacy
                  </a>{' '}
                  and sign in.
                </li>
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
    setPrimaryView('dashboard')
    setAdvancedSection('lab')
    setShowAdvancedTools(false)
    reset()
  }
  const activePrimaryNavView = primaryView

  return (
    <div className="min-h-screen bg-bg text-text">
        <Header
          onReset={handleReset}
          onOpenSettings={() => {
            openAdvancedTools('lab')
          }}
        timezoneMode={timezoneMode}
        onTimezoneModeChange={setTimezoneMode}
      />
      <ViewContainer>
        <section className="space-y-4 sm:space-y-5">
          <TabNav
            value={activePrimaryNavView}
            onChange={(value) => {
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
