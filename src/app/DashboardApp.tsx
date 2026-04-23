import { Suspense, lazy, useEffect, useMemo, useState } from 'react'

import { Header } from '@/components/layout/Header'
import { AccountSettings } from '@/components/layout/AccountSettings'
import { getPrimaryAnalyticsPanelId, getPrimaryAnalyticsTabId } from '@/components/layout/primary-analytics-tab-ids'
import { TabNav } from '@/components/layout/TabNav'
import { ViewContainer } from '@/components/layout/ViewContainer'
import { ViewErrorBoundary } from '@/components/layout/ViewErrorBoundary'
import { DropZone } from '@/components/upload/DropZone'
import { ParseProgress } from '@/components/upload/ParseProgress'
import type { AdvancedHubSection } from '@/components/views/AdvancedHub'
import { CommunityDashboard } from '@/components/views/CommunityDashboard'
import { firstPartyPlugins } from '@/features/plugins/firstPartyPlugins'
import { pluginRegistry } from '@/lib/plugins/runtime'
import { useDataStore } from '@/store/useDataStore'
import { useExperienceStore } from '@/store/useExperienceStore'
import { useSessionMetricsStore } from '@/store/useSessionMetricsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useConsentStore } from '@/store/useConsentStore'
import { applyTheme, useThemeStore } from '@/store/useThemeStore'
import { ConsentDialog } from '@/components/consent/ConsentDialog'

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

type MainView = 'home' | 'analytics' | 'share'

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

function OnboardingLanding({ onFileSelected, demoZipPath }: {
  onFileSelected: (file: File, preflight?: unknown) => void
  demoZipPath?: string
}): JSX.Element {
  const authStatus = useAuthStore((state) => state.status)
  const authUser = useAuthStore((state) => state.user)
  const authLogin = useAuthStore((state) => state.login)

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <h1 className="font-heading text-5xl text-text">Listentropy</h1>
        <p className="mt-3 text-base text-text-muted">
          Explore your Spotify listening history with deep analytics, or discover community-wide trends.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-theme border border-border bg-surface p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-text">Upload Export</h3>
          <p className="mt-1 text-xs text-text-muted">
            Drop your Spotify Extended Streaming History zip. Processing happens entirely in your browser.
          </p>
        </div>

        <div className="rounded-theme border border-border bg-surface p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954]/10">
            <svg className="h-5 w-5 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-text">Sign in with Spotify</h3>
          <p className="mt-1 text-xs text-text-muted">
            Connect your Spotify account to persist data, sync history, and access enriched analytics.
          </p>
        </div>

        <div className="rounded-theme border border-border bg-surface p-5 sm:col-span-2 lg:col-span-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-text">Community Insights</h3>
          <p className="mt-1 text-xs text-text-muted">
            View privacy-preserving aggregate trends from opted-in users. No account needed to browse.
          </p>
        </div>
      </div>

      {authStatus === 'authenticated' && authUser ? (
        <div className="rounded-theme border border-positive/30 bg-positive/5 p-4 text-center">
          <p className="text-sm text-text">
            Signed in as <span className="font-medium">{authUser.displayName || 'Spotify User'}</span>
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Upload your export below to start analyzing, or browse community insights.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={authLogin}
            className="inline-flex items-center gap-2 rounded-theme border border-[#1DB954] bg-[#1DB954] px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#1ED760]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
            Continue with Spotify
          </button>
          <span className="text-xs text-text-muted">or upload below</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="rounded-theme border border-border bg-surface p-4 text-left">
          <p className="text-sm font-semibold text-text">Upload preflight</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-text-muted">
            <li>Use the original Spotify Extended Streaming History <code>.zip</code> file.</li>
            <li>Expected files include <code>Streaming_History_Audio_*.json</code> entries.</li>
            <li>Listentropy strips <code>ip_addr</code> and processes data locally in-browser.</li>
          </ul>
        </div>
        <DropZone onFileSelected={onFileSelected} demoZipPath={demoZipPath} />
        <div className="rounded-theme border border-border bg-surface p-4 text-sm text-text-muted">
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

      <section>
        <CommunityDashboard />
      </section>
    </div>
  )
}

export function DashboardApp(): JSX.Element {
  const deepLinkedAdvancedSection = readAdvancedSectionFromHash()
  const [primaryView, setPrimaryView] = useState<MainView>('home')
  const [hasResolvedInitialDataView, setHasResolvedInitialDataView] = useState(false)
  const [advancedSection, setAdvancedSection] = useState<AdvancedHubSection>(
    deepLinkedAdvancedSection ?? 'lab',
  )
  const [showAdvancedTools, setShowAdvancedTools] = useState(deepLinkedAdvancedSection !== null)
  const [showAccountSettings, setShowAccountSettings] = useState(false)
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
  const checkSession = useAuthStore((state) => state.checkSession)
  const authStatus = useAuthStore((state) => state.status)
  const startTokenLifecycle = useAuthStore((state) => state.startTokenLifecycle)
  const fetchConsent = useConsentStore((state) => state.fetchConsent)

  useEffect(() => {
    applyTheme(themeKey)
  }, [themeKey])

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  useEffect(() => {
    return startTokenLifecycle()
  }, [startTokenLifecycle])

  useEffect(() => {
    if (authStatus === 'authenticated') {
      void fetchConsent()
    }
  }, [authStatus, fetchConsent])

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
    if (primaryView === 'share') {
      recordExperienceBehavior('full_tab_visit')
      recordMetric({
        type: 'full_tab_visit',
        timestamp: new Date().toISOString(),
        dedupeKey: `full-tab:${primaryView}`,
        metadata: { view: primaryView },
      })
    }
  }, [recordExperienceBehavior, recordMetric, primaryView])

  function openAdvancedTools(nextSection?: AdvancedHubSection): void {
    if (nextSection) {
      setAdvancedSection(nextSection)
    }
    setShowAdvancedTools(true)
    setPrimaryView('analytics')
  }

  function handleReset(): void {
    setPrimaryView('home')
    setHasResolvedInitialDataView(false)
    setAdvancedSection('lab')
    setShowAdvancedTools(false)
    reset()
  }

  const hasData = mode === 'ready' && data !== null
  const effectivePrimaryView: MainView = hasData && !hasResolvedInitialDataView && primaryView === 'home'
    ? 'analytics'
    : primaryView

  const body = useMemo(() => {
    if (effectivePrimaryView === 'home') {
      return <CommunityDashboard />
    }
    if (effectivePrimaryView === 'share' && data) {
      return <ShareStudio data={data} />
    }
    if (!data) {
      return null
    }
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
  }, [advancedSection, data, effectivePrimaryView, showAdvancedTools])

  const loadingFallback = (
    <div className="rounded-theme border border-border bg-surface p-6">
      <div className="skeleton h-5 w-32 rounded-sm" />
      <div className="skeleton mt-3 h-4 w-2/3 rounded-sm" />
      <div className="skeleton mt-6 h-64 w-full rounded-sm" />
    </div>
  )

  const tabMetadata = useMemo<Record<MainView, ViewTabMeta> | null>(() => {
    return {
      home: {
        badge: 'community',
        detail: 'aggregate insights',
      },
      analytics: data ? {
        badge: `${Math.round(data.summary.totalHours)}h`,
        detail: `${data.summary.totalPlays.toLocaleString()} plays`,
      } : {
        detail: 'upload to unlock',
      },
      share: data ? {
        badge: `${data.narrativeInsights.length} insights`,
        detail: 'story cards + export',
      } : {
        detail: 'requires data',
      },
    }
  }, [data])

  if (mode === 'idle' && !hasData) {
    return (
      <div className="relative min-h-screen bg-bg text-text">
        <ConsentDialog />
        <ViewContainer>
          <OnboardingLanding onFileSelected={ingestZip} demoZipPath={DEMO_ZIP_PATH} />
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

  const activePrimaryNavView = effectivePrimaryView

  return (
    <div className="min-h-screen bg-bg text-text">
        <ConsentDialog />
        <Header
          onReset={handleReset}
          onOpenSettings={() => {
            openAdvancedTools('lab')
          }}
          onOpenAccountSettings={() => setShowAccountSettings(true)}
          timezoneMode={timezoneMode}
          onTimezoneModeChange={setTimezoneMode}
        />
        {showAccountSettings && (
          <AccountSettings onClose={() => setShowAccountSettings(false)} />
        )}
      <ViewContainer>
        <section className="space-y-4 sm:space-y-5">
          <TabNav
            value={activePrimaryNavView}
            onChange={(value) => {
              if (value === 'analytics' && !hasData) return
              if (value === 'share' && !hasData) return
              if (hasData) {
                setHasResolvedInitialDataView(true)
              }
              setPrimaryView(value as MainView)
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
            <ViewErrorBoundary viewKey={activePrimaryNavView}>
              <Suspense fallback={loadingFallback}>{body}</Suspense>
            </ViewErrorBoundary>
          </div>
        </section>
      </ViewContainer>
    </div>
  )
}
