import { Suspense, lazy, useEffect, useMemo, useState } from 'react'

import { Header } from '@/components/layout/Header'
import { getPrimaryAnalyticsPanelId, getPrimaryAnalyticsTabId } from '@/components/layout/primary-analytics-tab-ids'
import { TabNav } from '@/components/layout/TabNav'
import { ViewContainer } from '@/components/layout/ViewContainer'
import { ViewErrorBoundary } from '@/components/layout/ViewErrorBoundary'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ParseProgress } from '@/components/upload/ParseProgress'
import { DropZone } from '@/components/upload/DropZone'
import { pluginRegistry } from '@/lib/plugins/runtime'
import { firstPartyPlugins } from '@/features/plugins/firstPartyPlugins'
import { labModuleManifests, labSceneManifests } from '@/lib/labs/registry'
import { applyTheme, useThemeStore } from '@/store/useThemeStore'
import { useDataStore } from '@/store/useDataStore'
import { useExperienceStore } from '@/store/useExperienceStore'
import { useSessionMetricsStore } from '@/store/useSessionMetricsStore'

const OverviewDashboard = lazy(() =>
  import('@/components/views/OverviewDashboard').then((module) => ({
    default: module.OverviewDashboard,
  })),
)
const TopCharts = lazy(() =>
  import('@/components/views/TopCharts').then((module) => ({
    default: module.TopCharts,
  })),
)
const ListeningTimeline = lazy(() =>
  import('@/components/views/ListeningTimeline').then((module) => ({
    default: module.ListeningTimeline,
  })),
)
const ClockCalendar = lazy(() =>
  import('@/components/views/ClockCalendar').then((module) => ({
    default: module.ClockCalendar,
  })),
)
const ArtistDeepDive = lazy(() =>
  import('@/components/views/ArtistDeepDive').then((module) => ({
    default: module.ArtistDeepDive,
  })),
)
const ListeningHabits = lazy(() =>
  import('@/components/views/ListeningHabits').then((module) => ({
    default: module.ListeningHabits,
  })),
)
const ContextIntelligence = lazy(() =>
  import('@/components/views/ContextIntelligence').then((module) => ({
    default: module.ContextIntelligence,
  })),
)
const MusicEras = lazy(() =>
  import('@/components/views/MusicEras').then((module) => ({
    default: module.MusicEras,
  })),
)
const ShareStudio = lazy(() =>
  import('@/components/views/ShareStudio').then((module) => ({
    default: module.ShareStudio,
  })),
)
const MusicUniverse = lazy(() =>
  import('@/components/views/MusicUniverse').then((module) => ({
    default: module.MusicUniverse,
  })),
)
const TasteDNA = lazy(() =>
  import('@/components/views/TasteDNA').then((module) => ({
    default: module.TasteDNA,
  })),
)
const PluginExtras = lazy(() =>
  import('@/components/views/PluginExtras').then((module) => ({
    default: module.PluginExtras,
  })),
)
const LabWorkbench = lazy(() =>
  import('@/components/views/LabWorkbench').then((module) => ({
    default: module.LabWorkbench,
  })),
)

type MainView =
  | 'overview'
  | 'charts'
  | 'timeline'
  | 'clock'
  | 'artist'
  | 'habits'
  | 'context'
  | 'eras'
  | 'share'
  | 'universe'
  | 'taste'
  | 'lab'
  | 'extras'

interface ViewTabMeta {
  badge?: string
  detail?: string
}

interface ViewSpotlight {
  title: string
  description: string
  stats: Array<{ label: string; value: string }>
  shortcuts?: Array<{ label: string; target: MainView }>
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function DashboardApp(): JSX.Element {
  const [view, setView] = useState<MainView>('overview')
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
    const advancedViews: MainView[] = ['charts', 'timeline', 'clock', 'artist', 'habits', 'eras', 'universe', 'lab', 'extras']
    if (advancedViews.includes(view)) {
      recordExperienceBehavior('advanced_tab_visit')
      recordMetric({
        type: 'advanced_tab_visit',
        timestamp: new Date().toISOString(),
        dedupeKey: `advanced-tab:${view}`,
        metadata: { view },
      })
    }
  }, [recordExperienceBehavior, recordMetric, view])

  const body = useMemo(() => {
    if (!data) {
      return null
    }
    if (view === 'overview') {
      return <OverviewDashboard data={data} onOpenContext={() => setView('context')} />
    }
    if (view === 'charts') {
      return <TopCharts data={data} />
    }
    if (view === 'timeline') {
      return <ListeningTimeline data={data} />
    }
    if (view === 'clock') {
      return <ClockCalendar data={data} />
    }
    if (view === 'artist') {
      return <ArtistDeepDive data={data} />
    }
    if (view === 'habits') {
      return <ListeningHabits data={data} onOpenContext={() => setView('context')} />
    }
    if (view === 'context') {
      return <ContextIntelligence data={data} />
    }
    if (view === 'eras') {
      return <MusicEras data={data} />
    }
    if (view === 'share') {
      return <ShareStudio data={data} />
    }
    if (view === 'universe') {
      return <MusicUniverse data={data} />
    }
    if (view === 'taste') {
      return <TasteDNA data={data} />
    }
    if (view === 'lab') {
      return <LabWorkbench data={data} />
    }
    return <PluginExtras data={data} />
  }, [data, view])

  const loadingFallback = (
    <div className="rounded-theme border border-border bg-surface p-6">
      <div className="skeleton h-5 w-32 rounded-sm" />
      <div className="skeleton mt-3 h-4 w-2/3 rounded-sm" />
      <div className="skeleton mt-6 h-64 w-full rounded-sm" />
    </div>
  )

  const tabMetadata = useMemo<Record<MainView, ViewTabMeta> | null>(() => {
    if (!data) {
      return null
    }
    const enabledLabModules = labModuleManifests.filter((manifest) => !manifest.comingSoon).length
    const featuredLabScenes = labSceneManifests.filter((scene) => !scene.comingSoon).length
    const pluginCount = pluginRegistry.list().length
    return {
      overview: {
        badge: `${Math.round(data.summary.totalHours)}h`,
        detail: `${data.summary.totalPlays.toLocaleString()} plays`,
      },
      charts: {
        badge: `${data.artists.length.toLocaleString()} artists`,
        detail: `${data.tracks.length.toLocaleString()} tracks ranked`,
      },
      timeline: {
        badge: `${data.monthly.length} mo`,
        detail: `${data.yearly.length} yearly buckets`,
      },
      clock: {
        badge: pct(data.summary.nocturnalShare),
        detail: 'hour + weekday rhythms',
      },
      artist: {
        badge: data.artists[0]?.name ?? 'Top artist',
        detail: 'search + trend deep dive',
      },
      habits: {
        badge: pct(data.summary.skipRate),
        detail: `${data.sessions.length.toLocaleString()} sessions`,
      },
      context: {
        badge: pct(data.contextAnalytics.country.travelShare),
        detail: data.contextAnalytics.country.homeCountry ?? 'country/context signals',
      },
      eras: {
        badge: `${data.eras.length} eras`,
        detail: data.eras[0] ? 'segmentation + transitions' : 'era detection',
      },
      share: {
        badge: `${data.narrativeInsights.length} insights`,
        detail: 'story cards + export formats',
      },
      universe: {
        badge: `${data.graphAnalytics.summary.nodeCount} nodes`,
        detail: `${data.graphAnalytics.summary.connectedComponents} components`,
      },
      taste: {
        badge: `${data.taste.dimensions.length} dims`,
        detail: 'DNA + Spotify enrichment',
      },
      lab: {
        badge: `${enabledLabModules} modules`,
        detail: `${featuredLabScenes} scenes`,
      },
      extras: {
        badge: `${pluginCount} plugins`,
        detail: 'extensions + experiments',
      },
    }
  }, [data])

  const activeViewSpotlight = useMemo<ViewSpotlight | null>(() => {
    if (!data) {
      return null
    }
    switch (view) {
      case 'overview':
        return {
          title: 'Overview Snapshot',
          description: 'Core listening volume, data quality, and narrative signals at a glance.',
          stats: [
            { label: 'Listening hours', value: Math.round(data.summary.totalHours).toLocaleString() },
            { label: 'Skip rate', value: pct(data.summary.skipRate) },
            { label: 'Night share', value: pct(data.summary.nocturnalShare) },
          ],
          shortcuts: [{ label: 'Open Context', target: 'context' }, { label: 'Open Lab', target: 'lab' }],
        }
      case 'charts':
        return {
          title: 'Leaderboard Scope',
          description: 'Ranked artists, tracks, and albums with fast search and metric mode switching.',
          stats: [
            { label: 'Artists ranked', value: data.artists.length.toLocaleString() },
            { label: 'Tracks ranked', value: data.tracks.length.toLocaleString() },
            { label: 'Albums ranked', value: data.albums.length.toLocaleString() },
          ],
        }
      case 'timeline':
        return {
          title: 'Temporal Coverage',
          description: 'Explore macro drift across monthly and yearly time buckets.',
          stats: [
            { label: 'Monthly buckets', value: data.monthly.length.toString() },
            { label: 'Yearly buckets', value: data.yearly.length.toString() },
            { label: 'Date span', value: `${data.summary.firstListen.slice(0, 7)} → ${data.summary.lastListen.slice(0, 7)}` },
          ],
        }
      case 'clock':
        return {
          title: 'Circadian Patterning',
          description: 'Radial clock, weekday patterns, and calendar heatmaps for routine analysis.',
          stats: [
            { label: 'Nocturnal share', value: pct(data.summary.nocturnalShare) },
            { label: 'Hour bins', value: data.hours.length.toString() },
            { label: 'Day-of-week bins', value: data.dayOfWeek.length.toString() },
          ],
        }
      case 'artist':
        return {
          title: 'Artist Deep Dive',
          description: 'Search-heavy lens for artist-specific trends and top-track composition.',
          stats: [
            { label: 'Indexed artists', value: data.artists.length.toLocaleString() },
            { label: 'Top artist', value: data.artists[0]?.name ?? 'N/A' },
            { label: 'Top artist plays', value: (data.artists[0]?.plays ?? 0).toLocaleString() },
          ],
          shortcuts: [{ label: 'Top Charts', target: 'charts' }],
        }
      case 'habits':
        return {
          title: 'Behavioral Habits',
          description: 'Skip, shuffle, session depth, and platform evolution diagnostics.',
          stats: [
            { label: 'Skip rate', value: pct(data.summary.skipRate) },
            { label: 'Shuffle rate', value: pct(data.summary.shuffleRate) },
            { label: 'Sessions', value: data.sessions.length.toLocaleString() },
          ],
          shortcuts: [{ label: 'Open Context', target: 'context' }],
        }
      case 'context':
        return {
          title: 'Context Intelligence',
          description: 'Country, device, playback reason, and privacy/offline behavior signals.',
          stats: [
            { label: 'Home country', value: data.contextAnalytics.country.homeCountry ?? 'N/A' },
            { label: 'Travel share', value: pct(data.contextAnalytics.country.travelShare) },
            { label: 'Cross-platform handoff', value: pct(data.contextAnalytics.deviceJourney.crossPlatformSessionShare) },
          ],
        }
      case 'eras':
        return {
          title: 'Era Segmentation',
          description: 'Detected eras, confidence, transition intensity, and era summary diagnostics.',
          stats: [
            { label: 'Detected eras', value: data.eras.length.toString() },
            { label: 'Top era confidence', value: data.eras[0] ? pct(data.eras[0].confidence) : 'N/A' },
            { label: 'Covered hours', value: Math.round(data.eras.reduce((sum, era) => sum + era.totalMs, 0) / 1000 / 60 / 60).toLocaleString() },
          ],
          shortcuts: [{ label: 'Open Lab Microshifts', target: 'lab' }],
        }
      case 'share':
        return {
          title: 'Story Export Studio',
          description: 'Build shareable story cards and export text/media from local analytics.',
          stats: [
            { label: 'Narrative insights', value: data.narrativeInsights.length.toString() },
            { label: 'Quick insights', value: data.quickInsights.length.toString() },
            { label: 'Privacy mode', value: 'Local-only' },
          ],
        }
      case 'universe':
        return {
          title: 'Network Universe',
          description: 'Graph topology, hubs, bridges, clusters, and co-listen motifs.',
          stats: [
            { label: 'Nodes', value: data.graphAnalytics.summary.nodeCount.toLocaleString() },
            { label: 'Edges', value: data.graphAnalytics.summary.edgeCount.toLocaleString() },
            { label: 'Components', value: data.graphAnalytics.summary.connectedComponents.toString() },
          ],
          shortcuts: [{ label: 'Open Lab Time Slider', target: 'lab' }],
        }
      case 'taste':
        return {
          title: 'Taste DNA + Enrichment',
          description: 'Behavioral taste profile with optional Spotify-based enhancement overlays.',
          stats: [
            { label: 'Dimensions', value: data.taste.dimensions.length.toString() },
            { label: 'Yearly fingerprints', value: data.taste.yearlyFingerprints.length.toString() },
            { label: 'Archetypes', value: data.archetypes.allScores.length.toString() },
          ],
          shortcuts: [{ label: 'Open Lab Audio Overlay', target: 'lab' }],
        }
      case 'lab':
        return {
          title: 'Xenolab Workbench',
          description: 'Deferred modules, scenes, compare workflows, and explainability-first experiments.',
          stats: [
            { label: 'Enabled modules', value: labModuleManifests.filter((manifest) => !manifest.comingSoon).length.toString() },
            { label: 'Featured scenes', value: labSceneManifests.filter((scene) => !scene.comingSoon).length.toString() },
            { label: 'Dataset fingerprint', value: data.datasetIdentity.fingerprint.slice(0, 8) },
          ],
          shortcuts: [{ label: 'Open Compare', target: 'lab' }, { label: 'Open Taste DNA', target: 'taste' }],
        }
      case 'extras':
        return {
          title: 'Extras + Plugins',
          description: 'First-party plugin actions, developer utilities, and experimental extensions.',
          stats: [
            { label: 'Registered plugins', value: pluginRegistry.list().length.toString() },
            { label: 'Built-in plugins', value: firstPartyPlugins.length.toString() },
            { label: 'Execution', value: 'Local runtime' },
          ],
        }
    }
  }, [data, view])

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
              onClick={reset}
            >
              Try again
            </button>
          </div>
        </ViewContainer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <Header onReset={reset} timezoneMode={timezoneMode} onTimezoneModeChange={setTimezoneMode} />
      <ViewContainer>
        <TabNav
          value={view}
          onChange={(value) => setView(value as MainView)}
          metadata={tabMetadata ?? undefined}
        />
        {activeViewSpotlight ? (
          <Card className="mt-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle>{activeViewSpotlight.title}</CardTitle>
                <CardDescription className="mt-1">{activeViewSpotlight.description}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeViewSpotlight.shortcuts?.map((shortcut) => (
                  <Button
                    key={`${view}:${shortcut.target}:${shortcut.label}`}
                    variant="outline"
                    onClick={() => setView(shortcut.target)}
                    disabled={shortcut.target === view}
                  >
                    {shortcut.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {activeViewSpotlight.stats.map((stat) => (
                <div key={`${view}:${stat.label}`} className="rounded-theme border border-border bg-surface-hover p-3">
                  <p className="text-xs text-text-muted">{stat.label}</p>
                  <p className="mt-1 text-sm text-text">{stat.value}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
        <div
          className="mt-4 min-w-0"
          role="tabpanel"
          id={getPrimaryAnalyticsPanelId(view)}
          aria-labelledby={getPrimaryAnalyticsTabId(view)}
          tabIndex={0}
        >
          <ViewErrorBoundary viewKey={view}>
            <Suspense fallback={loadingFallback}>{body}</Suspense>
          </ViewErrorBoundary>
        </div>
      </ViewContainer>
    </div>
  )
}
