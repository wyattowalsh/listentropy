import { useMemo, useState } from 'react'

import { EraStackedArea } from '@/components/charts/EraStackedArea'
import { EraTimelineBand } from '@/components/charts/EraTimelineBand'
import { EraDetailPanel, type EraDetailProfile } from '@/components/eras/EraDetailPanel'
import { EraTransitionCard } from '@/components/eras/EraTransitionCard'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { EraData, ProcessedDataModel, StreamRecord } from '@/lib/types'
import { formatHours, formatPercent, toMonthKey } from '@/lib/utils'

interface MusicErasProps {
  data: ProcessedDataModel
}

interface MutableEraProfile {
  plays: number
  totalMs: number
  skips: number
  shuffles: number
  platforms: Set<string>
  countries: Set<string>
  artistPlays: Map<string, number>
  trackPlays: Map<string, number>
}

function monthIndex(key: string): number {
  const [year, month] = key.split('-').map(Number)
  return year * 12 + month - 1
}

function monthsForEra(era: EraData): string[] {
  const start = monthIndex(era.startMonth)
  const end = monthIndex(era.endMonth)
  const months: string[] = []
  for (let index = start; index <= end; index += 1) {
    const year = Math.floor(index / 12)
    const month = (index % 12) + 1
    months.push(`${year}-${String(month).padStart(2, '0')}`)
  }
  return months
}

function createMutableProfile(): MutableEraProfile {
  return {
    plays: 0,
    totalMs: 0,
    skips: 0,
    shuffles: 0,
    platforms: new Set<string>(),
    countries: new Set<string>(),
    artistPlays: new Map<string, number>(),
    trackPlays: new Map<string, number>(),
  }
}

function finalizeProfile(profile: MutableEraProfile): EraDetailProfile {
  const topArtists = [...profile.artistPlays.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, plays]) => ({ label, plays }))
  const topTracks = [...profile.trackPlays.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, plays]) => ({ label, plays }))

  return {
    plays: profile.plays,
    totalMs: profile.totalMs,
    skipRate: profile.plays > 0 ? profile.skips / profile.plays : 0,
    shuffleRate: profile.plays > 0 ? profile.shuffles / profile.plays : 0,
    platformCount: profile.platforms.size,
    countryCount: profile.countries.size,
    topTracks,
    topArtists,
  }
}

function accumulateProfile(profile: MutableEraProfile, record: StreamRecord): void {
  profile.plays += 1
  profile.totalMs += record.ms_played
  profile.skips += record.skipped ? 1 : 0
  profile.shuffles += record.shuffle ? 1 : 0
  if (record.platform) {
    profile.platforms.add(record.platform)
  }
  if (record.conn_country) {
    profile.countries.add(record.conn_country)
  }
  const artist = record.master_metadata_album_artist_name || 'Unknown Artist'
  profile.artistPlays.set(artist, (profile.artistPlays.get(artist) ?? 0) + 1)
  const track = record.master_metadata_track_name || record.episode_name || record.audiobook_title || 'Unknown Track'
  profile.trackPlays.set(`${track} — ${artist}`, (profile.trackPlays.get(`${track} — ${artist}`) ?? 0) + 1)
}

function buildEraProfiles(records: StreamRecord[], eras: EraData[]): Map<string, EraDetailProfile> {
  const eraByMonth = new Map<string, string>()
  for (const era of eras) {
    for (const month of monthsForEra(era)) {
      eraByMonth.set(month, era.id)
    }
  }

  const mutableProfiles = new Map<string, MutableEraProfile>()
  for (const era of eras) {
    mutableProfiles.set(era.id, createMutableProfile())
  }

  for (const record of records) {
    const month = toMonthKey(new Date(record.ts))
    const eraId = eraByMonth.get(month)
    if (!eraId) {
      continue
    }
    const profile = mutableProfiles.get(eraId)
    if (!profile) {
      continue
    }
    accumulateProfile(profile, record)
  }

  const finalized = new Map<string, EraDetailProfile>()
  for (const [eraId, profile] of mutableProfiles.entries()) {
    finalized.set(eraId, finalizeProfile(profile))
  }
  return finalized
}

function changeIntensity(era: EraData): number {
  if (!era.transitionFromPrevious) {
    return 0
  }
  const weighted = era.changeDrivers.reduce((sum, driver) => sum + driver.weight, 0)
  return Math.min(1, Math.max(weighted, era.transitionFromPrevious.confidence))
}

export function MusicEras({ data }: MusicErasProps): JSX.Element {
  const [activeEraId, setActiveEraId] = useState<string | null>(null)

  const eraProfiles = useMemo(() => buildEraProfiles(data.records, data.eras), [data.records, data.eras])

  const resolvedActiveEraId =
    activeEraId && data.eras.some((era) => era.id === activeEraId) ? activeEraId : (data.eras[0]?.id ?? null)
  const activeEraIndex = data.eras.findIndex((era) => era.id === resolvedActiveEraId)
  const activeEra = (activeEraIndex >= 0 ? data.eras[activeEraIndex] : data.eras[0]) ?? null
  const previousEra = activeEraIndex > 0 ? data.eras[activeEraIndex - 1] : null

  const activeProfile = activeEra ? eraProfiles.get(activeEra.id) : undefined
  const previousProfile = previousEra ? eraProfiles.get(previousEra.id) : undefined

  const summary = useMemo(() => {
    const eraCount = data.eras.length
    if (eraCount === 0) {
      return {
        averageConfidence: 0,
        averageDominance: 0,
        averageDiversity: 0,
        totalHours: 0,
        lowConfidenceCount: 0,
      }
    }
    return {
      averageConfidence: data.eras.reduce((sum, era) => sum + era.confidence, 0) / eraCount,
      averageDominance: data.eras.reduce((sum, era) => sum + era.dominanceScore, 0) / eraCount,
      averageDiversity: data.eras.reduce((sum, era) => sum + era.diversityScore, 0) / eraCount,
      totalHours: data.eras.reduce((sum, era) => sum + era.totalMs, 0),
      lowConfidenceCount: data.eras.filter((era) => era.confidence < 0.45).length,
    }
  }, [data.eras])

  const sparseMessage =
    data.eras.length <= 1 && (data.eras[0]?.confidence ?? 0) < 0.45
      ? 'Not enough monthly density for confident era segmentation. Showing a broad fallback era.'
      : null

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Music Eras</CardTitle>
        <CardDescription className="mt-1">
          Artist-led era detection with change scoring, smoothing, and transition diagnostics.
        </CardDescription>
        {sparseMessage ? (
          <div className="mt-3 rounded-theme border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {sparseMessage}
          </div>
        ) : null}
        <div className="mt-4">
          <EraTimelineBand eras={data.eras} activeEraId={activeEra?.id} onSelectEra={setActiveEraId} />
        </div>
        <div className="mt-4">
          <EraStackedArea eras={data.eras} />
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardTitle>Detected Eras</CardTitle>
            <CardDescription className="mt-1">Confidence-weighted timeline segments with transition intensity.</CardDescription>
            <div className="mt-3 space-y-2">
              {data.eras.map((era) => {
                const active = activeEra?.id === era.id
                const intensity = changeIntensity(era)
                return (
                  <button
                    key={era.id}
                    type="button"
                    className={`w-full rounded-theme border p-3 text-left transition-colors ${
                      active ? 'border-accent bg-accent/10' : 'border-border bg-surface-hover hover:border-accent/40'
                    }`}
                    aria-pressed={active}
                    onClick={() => setActiveEraId(era.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text">{era.label}</p>
                        <p className="text-xs text-text-muted">
                          {era.startMonth} → {era.endMonth} · {era.durationMonths} mo
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-text-muted">{Math.round(era.confidence * 100)}% conf</p>
                        <p className="text-xs text-text-muted">{Math.round(intensity * 100)}% change</p>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(6, Math.round(intensity * 100))}%` }} />
                    </div>
                  </button>
                )
              })}
              {data.eras.length === 0 ? (
                <p className="rounded-theme border border-border bg-surface-hover p-3 text-sm text-text-muted">
                  No eras detected yet.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardTitle>Era Intelligence Summary</CardTitle>
            <CardDescription className="mt-1">High-level quality and segmentation signals across all detected eras.</CardDescription>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-theme border border-border bg-surface-hover p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Avg Confidence</p>
                <p className="mt-1 text-sm text-text">{formatPercent(summary.averageConfidence)}</p>
              </div>
              <div className="rounded-theme border border-border bg-surface-hover p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Avg Dominance</p>
                <p className="mt-1 text-sm text-text">{formatPercent(summary.averageDominance)}</p>
              </div>
              <div className="rounded-theme border border-border bg-surface-hover p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Avg Diversity</p>
                <p className="mt-1 text-sm text-text">{formatPercent(summary.averageDiversity)}</p>
              </div>
              <div className="rounded-theme border border-border bg-surface-hover p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Low-confidence Eras</p>
                <p className="mt-1 text-sm text-text">{summary.lowConfidenceCount}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-text-muted">Total era listening covered: {formatHours(summary.totalHours)} hours.</p>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <EraDetailPanel era={activeEra ?? undefined} profile={activeProfile} previousProfile={previousProfile} />
          <EraTransitionCard era={activeEra ?? undefined} previousEra={previousEra ?? undefined} />

          <Card className="min-w-0">
            <CardTitle>Era Summary Table</CardTitle>
            <CardDescription className="mt-1">
              Duration, listening volume, dominance/diversity, and transition confidence across detected eras.
            </CardDescription>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-[0.12em] text-text-muted">
                    <th className="px-2 py-2">Era</th>
                    <th className="px-2 py-2">Duration</th>
                    <th className="px-2 py-2">Hours</th>
                    <th className="px-2 py-2">Dominance</th>
                    <th className="px-2 py-2">Diversity</th>
                    <th className="px-2 py-2">Transition Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.eras.map((era) => (
                    <tr key={era.id} className="border-b border-border/60 text-text">
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          className="truncate text-left hover:text-accent"
                          onClick={() => setActiveEraId(era.id)}
                        >
                          {era.label}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-text-muted">{era.durationMonths} mo</td>
                      <td className="px-2 py-2 text-text-muted">{formatHours(era.totalMs)}</td>
                      <td className="px-2 py-2 text-text-muted">{formatPercent(era.dominanceScore)}</td>
                      <td className="px-2 py-2 text-text-muted">{formatPercent(era.diversityScore)}</td>
                      <td className="px-2 py-2 text-text-muted">
                        {era.transitionFromPrevious ? formatPercent(era.transitionFromPrevious.confidence) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
