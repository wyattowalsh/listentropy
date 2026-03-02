import { useRef } from 'react'

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

export function ExploreDashboard({
  data,
  onOpenAdvancedSection,
}: ExploreDashboardProps): JSX.Element {
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

  function jumpToSection(key: ExploreSectionKey): void {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Explore</CardTitle>
        <CardDescription className="mt-1">
          Combined analytics canvas for trends, rankings, behavior, context, rhythm, and eras.
        </CardDescription>
      </Card>

      <div className="sticky top-16 z-20 rounded-theme border border-border bg-bg/95 p-2 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {EXPLORE_SECTIONS.map((section) => (
            <Button
              key={section.key}
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() => jumpToSection(section.key)}
              title={section.description}
            >
              {section.label}
            </Button>
          ))}
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Explore hero metrics">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardDescription>{metric.label}</CardDescription>
            <p className="mt-2 font-heading text-2xl text-text">{metric.value}</p>
          </Card>
        ))}
      </section>

      <Card>
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
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Nodes / edges</p>
            <p className="mt-1 text-sm text-text">
              {data.graphAnalytics.summary.nodeCount.toLocaleString()} / {data.graphAnalytics.summary.edgeCount.toLocaleString()}
            </p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Connected components</p>
            <p className="mt-1 text-sm text-text">{data.graphAnalytics.summary.connectedComponents}</p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Top cluster</p>
            <p className="mt-1 text-sm text-text">
              {topCluster ? `${topCluster.nodeCount} nodes · ${topCluster.topArtists.slice(0, 2).join(', ') || 'No artist labels'}` : 'N/A'}
            </p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
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
        className="scroll-mt-28 space-y-2"
      >
        <h2 className="font-heading text-xl text-text">Trends</h2>
        <p className="text-sm text-text-muted">Time-series volume and seasonal drift.</p>
        <ListeningTimeline data={data} />
      </section>

      <section
        id="explore-rankings"
        ref={(node) => {
          sectionRefs.current.rankings = node
        }}
        className="scroll-mt-28 space-y-2"
      >
        <h2 className="font-heading text-xl text-text">Rankings</h2>
        <p className="text-sm text-text-muted">Ranked artists, tracks, and albums with search and metric switches.</p>
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
        className="scroll-mt-28 space-y-2"
      >
        <h2 className="font-heading text-xl text-text">Behavior</h2>
        <p className="text-sm text-text-muted">Skips, shuffle, sessions, and platform patterns.</p>
        <ListeningHabits data={data} />
      </section>

      <section
        id="explore-context"
        ref={(node) => {
          sectionRefs.current.context = node
        }}
        className="scroll-mt-28 space-y-2"
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
        className="scroll-mt-28 space-y-2"
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
        className="scroll-mt-28 space-y-2"
      >
        <h2 className="font-heading text-xl text-text">Eras</h2>
        <p className="text-sm text-text-muted">Detected eras, transitions, and summary diagnostics.</p>
        <MusicEras data={data} />
      </section>
    </div>
  )
}
