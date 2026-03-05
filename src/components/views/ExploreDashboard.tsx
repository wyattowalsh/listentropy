import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { ClockCalendar } from '@/components/views/ClockCalendar'
import { ContextIntelligence } from '@/components/views/ContextIntelligence'
import { ListeningHabits } from '@/components/views/ListeningHabits'
import { ListeningTimeline } from '@/components/views/ListeningTimeline'
import { MusicEras } from '@/components/views/MusicEras'
import { TopCharts } from '@/components/views/TopCharts'
import type { AdvancedHubSection } from '@/components/views/AdvancedHub'
import type { ProcessedDataModel } from '@/lib/types'
import { formatPercent } from '@/lib/utils'

interface ExploreDashboardProps {
  data: ProcessedDataModel
  onOpenAdvancedSection?: (section: AdvancedHubSection) => void
}

type ExploreSectionKey = 'trends' | 'rankings' | 'behavior' | 'context' | 'rhythm' | 'eras'

const EXPLORE_SECTIONS: Array<{ key: ExploreSectionKey; label: string; description: string }> = [
  { key: 'trends', label: 'Trends', description: 'Time-series volume and peaks.' },
  { key: 'rankings', label: 'Rankings', description: 'Artists, tracks, albums.' },
  { key: 'behavior', label: 'Behavior', description: 'Skips, shuffle, sessions.' },
  { key: 'context', label: 'Context', description: 'Country, reasons, devices.' },
  { key: 'rhythm', label: 'Rhythm', description: 'Clock, weekday, calendar.' },
  { key: 'eras', label: 'Eras', description: 'Segmentation and transitions.' },
]

const SECTION_TO_ADVANCED: Record<ExploreSectionKey, AdvancedHubSection> = {
  trends: 'lab',
  rankings: 'artist',
  behavior: 'lab',
  context: 'plugins',
  rhythm: 'lab',
  eras: 'network',
}

function readExploreSectionFromHash(): ExploreSectionKey | null {
  if (typeof window === 'undefined') {
    return null
  }
  const deepLinkedSection = EXPLORE_SECTIONS.find(
    (section) => window.location.hash === `#explore-${section.key}`,
  )
  return deepLinkedSection?.key ?? null
}

export function ExploreDashboard({
  data,
  onOpenAdvancedSection,
}: ExploreDashboardProps): JSX.Element {
  const premiumCardClass =
    'border-border/70 bg-surface/90 shadow-surface transition-[border-color,background-color] duration-fast hover:border-accent/25'
  const sectionClass =
    'scroll-mt-28 space-y-3 rounded-theme border border-border/70 bg-surface/60 p-4 md:p-5'

  const sectionRefs = useRef<Record<ExploreSectionKey, HTMLElement | null>>({
    trends: null,
    rankings: null,
    behavior: null,
    context: null,
    rhythm: null,
    eras: null,
  })

  const metrics = [
    { label: 'Hours', value: Math.round(data.summary.totalHours).toLocaleString() },
    { label: 'Plays', value: data.summary.totalPlays.toLocaleString() },
    { label: 'Artists', value: data.summary.uniqueArtists.toLocaleString() },
    { label: 'Skip', value: formatPercent(data.summary.skipRate) },
    { label: 'Night', value: formatPercent(data.summary.nocturnalShare) },
    { label: 'Travel', value: formatPercent(data.contextAnalytics.country.travelShare) },
    { label: 'Eras', value: data.eras.length.toString() },
    { label: 'Graph nodes', value: data.graphAnalytics.summary.nodeCount.toLocaleString() },
  ]

  const topCluster = data.graphAnalytics.clusters[0]
  const topMotif = data.graphAnalytics.motifs.topPairs[0]
  const [showAllHeroMetrics, setShowAllHeroMetrics] = useState(false)
  const [activeSection, setActiveSection] = useState<ExploreSectionKey>(
    () => readExploreSectionFromHash() ?? 'trends',
  )
  const [inspectedSection, setInspectedSection] = useState<ExploreSectionKey | null>(null)

  const activeSectionMeta = EXPLORE_SECTIONS.find((section) => section.key === activeSection) ?? EXPLORE_SECTIONS[0]
  const activeSectionAnchor = `explore-${activeSection}`
  const activeInspectRegionId = `inspect-${activeSectionAnchor}`
  const highestMonth = data.monthly.length > 0 ? [...data.monthly].sort((a, b) => b.totalMs - a.totalMs)[0] : null
  const sectionDetails: Record<ExploreSectionKey, string[]> = {
    trends: [
      highestMonth
        ? `Peak month ${highestMonth.key} with ${highestMonth.plays.toLocaleString()} plays.`
        : 'Monthly trend data is still sparse.',
      `${Math.round(data.summary.totalHours).toLocaleString()} total hours across ${data.summary.yearsCovered} years.`,
    ],
    rankings: [
      `Top artist ${data.artists[0]?.name ?? 'N/A'} with ${data.artists[0]?.plays.toLocaleString() ?? '0'} plays.`,
      `Top track ${data.tracks[0]?.name ?? 'N/A'} — ${data.tracks[0]?.artist ?? 'N/A'}.`,
    ],
    behavior: [
      `Skip rate ${formatPercent(data.summary.skipRate)} and shuffle rate ${formatPercent(data.summary.shuffleRate)}.`,
      `Average session depth ${data.summary.sessionDepthAvg.toFixed(1)} tracks.`,
    ],
    context: [
      `Home country ${data.contextAnalytics.country.homeCountry ?? 'N/A'} with travel share ${formatPercent(data.contextAnalytics.country.travelShare)}.`,
      `Cross-platform handoffs ${formatPercent(data.contextAnalytics.deviceJourney.crossPlatformSessionShare)}.`,
    ],
    rhythm: [
      `Peak hour ${data.summary.peakHour}:00 with nocturnal share ${formatPercent(data.summary.nocturnalShare)}.`,
      `${data.dayOfWeek[0]?.day ?? 'N/A'} is currently the highest weekday bucket.`,
    ],
    eras: [
      `${data.eras.length.toLocaleString()} eras detected.`,
      data.eras[0]
        ? `${data.eras[0].label}: ${Math.round(data.eras[0].totalMs / 1000 / 60 / 60).toLocaleString()}h.`
        : 'Era diagnostics are not available yet.',
    ],
  }

  useEffect(() => {
    if (!inspectedSection || typeof window === 'undefined') {
      return
    }
    function handleKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setInspectedSection(null)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [inspectedSection])

  function jumpToSection(key: ExploreSectionKey): void {
    const sectionNode = sectionRefs.current[key]
    setActiveSection(key)
    if (inspectedSection) {
      setInspectedSection(key)
    }
    if (typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', `#explore-${key}`)
    }
    sectionNode?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const heading = sectionNode?.querySelector('h2')
    if (heading instanceof HTMLElement) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
  }

  return (
    <div className="space-y-6">
      <Card className={premiumCardClass}>
        <CardTitle as="h2">Explore</CardTitle>
        <CardDescription className="mt-1">
          Combined analytics canvas for trends, rankings, behavior, context, rhythm, and eras with
          focused section takeaways.
        </CardDescription>
        <p className="mt-3 text-sm text-text">
          Start with Trends for volume shifts, then move down the stack for context, behavior, and
          era transitions.
        </p>
      </Card>

      <Card className={premiumCardClass}>
        <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Story summary</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Lead signal</p>
            <p className="mt-1 text-sm text-text">{data.quickInsights[0] ?? 'Explore trends first to find your strongest shifts.'}</p>
          </div>
          <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Top cluster</p>
            <p className="mt-1 text-sm text-text">
              {topCluster
                ? `${topCluster.nodeCount} nodes · ${topCluster.topArtists.slice(0, 2).join(', ') || 'No artist labels'}`
                : 'N/A'}
            </p>
          </div>
          <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Top motif</p>
            <p className="mt-1 text-sm text-text">
              {topMotif ? `${topMotif.sourceLabel} ↔ ${topMotif.targetLabel}` : 'N/A'}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Story waypoints">
          <Button type="button" variant="outline" onClick={() => jumpToSection('trends')}>
            Start with Trends
          </Button>
          <Button type="button" variant="outline" onClick={() => jumpToSection('context')}>
            Continue with Context
          </Button>
          <Button type="button" variant="outline" onClick={() => jumpToSection('eras')}>
            Close on Eras
          </Button>
        </div>
      </Card>

      <div className="sticky top-16 z-20 rounded-theme border border-border/80 bg-bg/90 p-2.5 shadow-surface backdrop-blur">
        <nav className="flex flex-wrap gap-2" aria-label="Explore section navigation">
          {EXPLORE_SECTIONS.map((section) => (
            <Button
              key={section.key}
              variant="ghost"
              className="rounded-full border border-border/60 bg-surface/70 px-3 py-1 text-xs text-text-muted hover:border-accent/40 hover:bg-surface-hover hover:text-text"
              onClick={() => jumpToSection(section.key)}
              aria-current={activeSection === section.key ? 'location' : undefined}
              title={section.description}
            >
              {section.label}
            </Button>
          ))}
        </nav>
      </div>

      <Card className={premiumCardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Active section</p>
            <CardTitle className="mt-1">{activeSectionMeta.label}</CardTitle>
            <CardDescription className="mt-1">{activeSectionMeta.description}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            aria-controls={activeInspectRegionId}
            aria-expanded={inspectedSection === activeSection}
            onClick={() =>
              setInspectedSection((current) => (current === activeSection ? null : activeSection))
            }
          >
            {inspectedSection === activeSection ? 'Hide inspected details' : 'Inspect active section'}
          </Button>
        </div>
        {inspectedSection === activeSection ? (
          <div
            id={activeInspectRegionId}
            role="region"
            aria-label={`${activeSectionMeta.label} drill-down details`}
            className="mt-3 space-y-3 rounded-theme border border-border/70 bg-surface-hover/70 p-3"
          >
            <ul className="list-disc space-y-1 pl-4 text-sm text-text">
              {sectionDetails[activeSection].map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={`#${activeSectionAnchor}`}
                className="text-xs font-medium text-text underline decoration-dotted underline-offset-2 hover:text-accent"
              >
                {`Deep link to ${activeSectionMeta.label}`}
              </a>
              <Button
                type="button"
                variant="ghost"
                className="px-0 text-xs"
                disabled={!onOpenAdvancedSection}
                onClick={() => onOpenAdvancedSection?.(SECTION_TO_ADVANCED[activeSection])}
              >
                {`Open ${activeSectionMeta.label} in Advanced`}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Explore hero metrics">
        {metrics.slice(0, showAllHeroMetrics ? metrics.length : 4).map((metric) => (
          <Card key={metric.label} className={premiumCardClass}>
            <CardDescription className="text-xs uppercase tracking-[0.14em]">{metric.label}</CardDescription>
            <p className="mt-2 font-heading text-2xl tabular-nums text-text">{metric.value}</p>
          </Card>
        ))}
      </section>
      {metrics.length > 4 ? (
        <Button
          type="button"
          variant="ghost"
          className="-mt-3 self-start px-0 text-xs"
          aria-expanded={showAllHeroMetrics}
          onClick={() => setShowAllHeroMetrics((value) => !value)}
        >
          {showAllHeroMetrics ? 'Show fewer metrics' : 'Show all metrics'}
        </Button>
      ) : null}

      <Card className={premiumCardClass}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Network teaser</CardTitle>
            <CardDescription className="mt-1">
              Graph summary without loading the full network view.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => onOpenAdvancedSection?.('network')}
          >
            Open Advanced → Network
          </Button>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-xs text-text-muted">Nodes / edges</p>
            <p className="mt-1 text-sm text-text">
              {data.graphAnalytics.summary.nodeCount.toLocaleString()} / {data.graphAnalytics.summary.edgeCount.toLocaleString()}
            </p>
          </div>
          <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-xs text-text-muted">Connected components</p>
            <p className="mt-1 text-sm text-text">{data.graphAnalytics.summary.connectedComponents}</p>
          </div>
          <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-xs text-text-muted">Top cluster</p>
            <p className="mt-1 text-sm text-text">
              {topCluster ? `${topCluster.nodeCount} nodes · ${topCluster.topArtists.slice(0, 2).join(', ') || 'No artist labels'}` : 'N/A'}
            </p>
          </div>
          <div className="rounded-theme border border-border/70 bg-surface-hover/70 p-3">
            <p className="text-xs text-text-muted">Top motif</p>
            <p className="mt-1 text-sm text-text">
              {topMotif ? `${topMotif.sourceLabel} ↔ ${topMotif.targetLabel} (${topMotif.weight})` : 'N/A'}
            </p>
          </div>
        </div>
      </Card>

      <section
        id="explore-trends"
        ref={(node) => {
          sectionRefs.current.trends = node
        }}
        className={sectionClass}
      >
        <h2 className="font-heading text-xl text-text">Trends</h2>
        <p className="text-sm text-text-muted">Time-series volume, seasonal drift, and timeline peaks.</p>
        <ListeningTimeline data={data} />
      </section>

      <section
        id="explore-rankings"
        ref={(node) => {
          sectionRefs.current.rankings = node
        }}
        className={sectionClass}
      >
        <h2 className="font-heading text-xl text-text">Rankings</h2>
        <p className="text-sm text-text-muted">
          Ranked artists, tracks, and albums with filter controls and fast scan rows.
        </p>
        <div className="overflow-x-auto">
          <div className="min-w-[420px] md:min-w-0">
            <TopCharts data={data} />
          </div>
        </div>
      </section>

      <section
        id="explore-behavior"
        ref={(node) => {
          sectionRefs.current.behavior = node
        }}
        className={sectionClass}
      >
        <h2 className="font-heading text-xl text-text">Behavior</h2>
        <p className="text-sm text-text-muted">
          Skip, shuffle, session depth, and platform behavior patterns over time.
        </p>
        <ListeningHabits data={data} />
      </section>

      <section
        id="explore-context"
        ref={(node) => {
          sectionRefs.current.context = node
        }}
        className={sectionClass}
      >
        <h2 className="font-heading text-xl text-text">Context</h2>
        <p className="text-sm text-text-muted">Country, intent, privacy/offline behavior, and device transitions.</p>
        <ContextIntelligence data={data} />
      </section>

      <section
        id="explore-rhythm"
        ref={(node) => {
          sectionRefs.current.rhythm = node
        }}
        className={sectionClass}
      >
        <h2 className="font-heading text-xl text-text">Rhythm</h2>
        <p className="text-sm text-text-muted">Circadian and weekday listening patterns plus calendar heatmap.</p>
        <ClockCalendar data={data} />
      </section>

      <section
        id="explore-eras"
        ref={(node) => {
          sectionRefs.current.eras = node
        }}
        className={sectionClass}
      >
        <h2 className="font-heading text-xl text-text">Eras</h2>
        <p className="text-sm text-text-muted">Detected eras, transitions, and summary diagnostics.</p>
        <MusicEras data={data} />
      </section>
    </div>
  )
}
