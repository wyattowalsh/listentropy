import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { EraData } from '@/lib/types'
import { formatCompact, formatHours, formatPercent } from '@/lib/utils'

export interface EraDetailProfile {
  plays: number
  totalMs: number
  skipRate: number
  shuffleRate: number
  platformCount: number
  countryCount: number
  topTracks: Array<{ label: string; plays: number }>
  topArtists: Array<{ label: string; plays: number }>
}

interface EraDetailPanelProps {
  era?: EraData
  profile?: EraDetailProfile
  previousProfile?: EraDetailProfile
}

function deltaText(current: number, previous: number, formatter: (value: number) => string): string {
  const delta = current - previous
  const sign = delta > 0 ? '+' : ''
  return `${sign}${formatter(delta)} vs previous`
}

export function EraDetailPanel({
  era,
  profile,
  previousProfile,
}: EraDetailPanelProps): JSX.Element {
  if (!era || !profile) {
    return (
      <Card>
        <CardTitle>Era Detail</CardTitle>
        <CardDescription className="mt-2">Select an era to inspect its profile and changes.</CardDescription>
      </Card>
    )
  }

  const lowConfidence = era.confidence < 0.45

  return (
    <Card className="min-w-0">
      <CardTitle>Era Detail</CardTitle>
      <CardDescription className="mt-1">
        {era.label} · {era.startMonth} → {era.endMonth}
      </CardDescription>

      {lowConfidence ? (
        <div className="mt-3 rounded-theme border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Confidence is low for this era. Sparse or transitional months likely softened boundaries.
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Duration</p>
          <p className="mt-1 text-sm text-text">{era.durationMonths} months</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Total Listening</p>
          <p className="mt-1 text-sm text-text">{formatHours(profile.totalMs)} hours</p>
          {previousProfile ? (
            <p className="mt-1 text-xs text-text-muted">
              {deltaText(profile.totalMs, previousProfile.totalMs, (value) => formatHours(Math.abs(value)))}
            </p>
          ) : null}
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Volume</p>
          <p className="mt-1 text-sm text-text">{formatCompact(profile.plays)} plays</p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Dominance / Diversity</p>
          <p className="mt-1 text-sm text-text">
            {formatPercent(era.dominanceScore)} / {formatPercent(era.diversityScore)}
          </p>
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Skip / Shuffle</p>
          <p className="mt-1 text-sm text-text">
            {formatPercent(profile.skipRate)} / {formatPercent(profile.shuffleRate)}
          </p>
          {previousProfile ? (
            <p className="mt-1 text-xs text-text-muted">
              skip {deltaText(profile.skipRate, previousProfile.skipRate, (v) => formatPercent(Math.abs(v)))} ·
              shuffle {deltaText(profile.shuffleRate, previousProfile.shuffleRate, (v) => formatPercent(Math.abs(v)))}
            </p>
          ) : null}
        </div>
        <div className="rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Context Breadth</p>
          <p className="mt-1 text-sm text-text">
            {profile.platformCount} platforms · {profile.countryCount} countries
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-muted">Dominant Artists</p>
          <ul className="mt-2 space-y-1 text-sm text-text">
            {profile.topArtists.slice(0, 5).map((artist) => (
              <li key={artist.label} className="flex items-center justify-between gap-2">
                <span className="truncate">{artist.label}</span>
                <span className="shrink-0 text-xs text-text-muted">{artist.plays} plays</span>
              </li>
            ))}
            {profile.topArtists.length === 0 ? <li className="text-text-muted">No artist stats in this era.</li> : null}
          </ul>
        </div>
        <div className="min-w-0 rounded-theme border border-border bg-surface-hover p-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-muted">Top Tracks</p>
          <ul className="mt-2 space-y-1 text-sm text-text">
            {profile.topTracks.slice(0, 5).map((track) => (
              <li key={track.label} className="flex items-center justify-between gap-2">
                <span className="truncate">{track.label}</span>
                <span className="shrink-0 text-xs text-text-muted">{track.plays} plays</span>
              </li>
            ))}
            {profile.topTracks.length === 0 ? <li className="text-text-muted">No track stats in this era.</li> : null}
          </ul>
        </div>
      </div>
    </Card>
  )
}
