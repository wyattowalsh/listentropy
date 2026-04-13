import { useEffect } from 'react'
import { Users, TrendingUp, Music2, Clock, Disc3, BarChart3, Shield } from 'lucide-react'
import { useAggregateStore } from '@/store/useAggregateStore'

const ARCHETYPE_META: Record<string, { label: string; emoji: string }> = {
  'night-owl': { label: 'Night Owl', emoji: '🌙' },
  'dawn-patrol': { label: 'Dawn Patrol', emoji: '🌅' },
  'explorer': { label: 'Explorer', emoji: '🗺️' },
  'loyalist': { label: 'Loyalist', emoji: '🏔️' },
  'skipper': { label: 'Skipper', emoji: '⏭️' },
  'shuffle-brain': { label: 'Shuffle Brain', emoji: '🔀' },
  'streamer': { label: 'Streamer', emoji: '📡' },
  'curator': { label: 'Curator', emoji: '🎯' },
}

function StatCard({ icon, label, value, detail }: {
  icon: React.ReactNode
  label: string
  value: string
  detail?: string
}): JSX.Element {
  return (
    <div className="rounded-theme border border-border/60 bg-surface p-4">
      <div className="flex items-center gap-2 text-text-muted">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 font-heading text-2xl font-semibold text-text">{value}</p>
      {detail && <p className="mt-1 text-xs text-text-muted">{detail}</p>}
    </div>
  )
}

function TopItemsList({ title, icon, items, metricLabel }: {
  title: string
  icon: React.ReactNode
  items: Array<{ name: string; value: number; suppressed: boolean }>
  metricLabel: string
}): JSX.Element {
  const maxValue = Math.max(...items.filter((i) => !i.suppressed).map((i) => i.value), 1)

  return (
    <div className="rounded-theme border border-border/60 bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-medium text-text">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-text-muted">No data available</p>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 10).map((item, i) => (
            <div key={`${item.name}-${i}`} className="group">
              <div className="flex items-center justify-between text-xs">
                <span className="min-w-0 truncate text-text">
                  <span className="mr-2 text-text-muted">{i + 1}.</span>
                  {item.suppressed ? (
                    <span className="italic text-text-muted">[suppressed for privacy]</span>
                  ) : (
                    item.name
                  )}
                </span>
                {!item.suppressed && (
                  <span className="ml-2 shrink-0 text-text-muted">
                    {item.value.toLocaleString()} {metricLabel}
                  </span>
                )}
              </div>
              {!item.suppressed && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border/40">
                  <div
                    className="h-full rounded-full bg-accent/60 transition-all"
                    style={{ width: `${(item.value / maxValue) * 100}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HourlyChart({ data }: {
  data: Array<{ hour: number; plays: number }>
}): JSX.Element {
  const maxPlays = Math.max(...data.map((d) => d.plays), 1)

  return (
    <div className="rounded-theme border border-border/60 bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-medium text-text">Listening by Hour (UTC)</h3>
      </div>
      <div className="flex h-32 items-end gap-px">
        {Array.from({ length: 24 }, (_, h) => {
          const entry = data.find((d) => d.hour === h)
          const plays = entry?.plays ?? 0
          const height = maxPlays > 0 ? (plays / maxPlays) * 100 : 0
          return (
            <div
              key={h}
              className="group relative flex flex-1 flex-col items-center"
              title={`${h}:00 — ${plays.toLocaleString()} plays`}
            >
              <div className="w-full min-w-0">
                <div
                  className="w-full rounded-t-sm bg-accent/50 transition-colors group-hover:bg-accent/80"
                  style={{ height: `${Math.max(height, 2)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-text-muted">
        <span>0:00</span>
        <span>6:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  )
}

function ArchetypeChart({ data }: {
  data: Array<{ archetype: string; count: number; suppressed: boolean }>
}): JSX.Element {
  const total = data.reduce((s, d) => s + d.count, 0)
  const visible = data.filter((d) => !d.suppressed && d.count > 0)

  return (
    <div className="rounded-theme border border-border/60 bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Disc3 className="h-4 w-4 text-accent" />
        <h3 className="text-sm font-medium text-text">Listener Archetypes</h3>
      </div>
      {visible.length === 0 ? (
        <p className="text-xs text-text-muted">No archetype data available</p>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => {
            const meta = ARCHETYPE_META[item.archetype] ?? { label: item.archetype, emoji: '' }
            const pct = total > 0 ? (item.count / total) * 100 : 0
            return (
              <div key={item.archetype}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text">
                    {meta.emoji} {meta.label}
                  </span>
                  <span className="text-text-muted">{Math.round(pct)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                  <div
                    className="h-full rounded-full bg-accent/60 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PrivacyBadge(): JSX.Element {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-surface px-3 py-1 text-xs text-text-muted">
      <Shield className="h-3 w-3 text-positive" />
      Privacy-preserving aggregates
    </div>
  )
}

export function CommunityDashboard(): JSX.Element {
  const { available, loading, error, cohortSize, snapshotData, fetchAll } = useAggregateStore()

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl text-text">Community Insights</h2>
          <PrivacyBadge />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-theme border border-border/60 bg-surface p-4">
              <div className="skeleton h-4 w-24 rounded-sm" />
              <div className="skeleton mt-3 h-8 w-16 rounded-sm" />
              <div className="skeleton mt-2 h-3 w-32 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-theme border border-negative/40 bg-surface p-6 text-center">
        <p className="text-sm text-negative">{error}</p>
      </div>
    )
  }

  if (!available) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl text-text">Community Insights</h2>
          <PrivacyBadge />
        </div>
        <div className="rounded-theme border border-border/60 bg-surface p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-text-muted/40" />
          <p className="mt-3 text-sm text-text-muted">
            Community insights will appear here once enough users have opted in to aggregate analytics.
          </p>
          <p className="mt-1 text-xs text-text-muted">
            At least 5 contributors are needed to ensure privacy-preserving aggregation.
          </p>
        </div>
      </div>
    )
  }

  const topArtists = snapshotData.top_artists
  const topTracks = snapshotData.top_tracks
  const hourlyPatterns = snapshotData.hourly_patterns
  const archetypes = snapshotData.archetype_distribution
  const platformDist = snapshotData.platform_distribution
  const listeningTrends = snapshotData.listening_trends

  const artistItems = topArtists?.facts
    .filter((f) => f.metricName === 'total_plays')
    .map((f) => ({ name: f.dimensionValue, value: f.metricValue, suppressed: f.suppressed })) ?? []

  const trackItems = topTracks?.facts
    .filter((f) => f.metricName === 'total_plays')
    .map((f) => ({ name: f.dimensionValue, value: f.metricValue, suppressed: f.suppressed })) ?? []

  const hourlyData = hourlyPatterns?.facts
    .filter((f) => f.metricName === 'total_plays' && !f.suppressed)
    .map((f) => ({ hour: parseInt(f.dimensionValue, 10), plays: f.metricValue })) ?? []

  const archetypeData = archetypes?.facts
    .filter((f) => f.metricName === 'user_count')
    .map((f) => ({ archetype: f.dimensionValue, count: f.metricValue, suppressed: f.suppressed })) ?? []

  const platformItems = platformDist?.facts
    .filter((f) => f.metricName === 'total_plays')
    .map((f) => ({ name: f.dimensionValue, value: f.metricValue, suppressed: f.suppressed })) ?? []

  const totalPlays = listeningTrends?.facts
    .filter((f) => f.metricName === 'total_plays' && !f.suppressed)
    .reduce((s, f) => s + f.metricValue, 0) ?? 0

  const totalMs = listeningTrends?.facts
    .filter((f) => f.metricName === 'total_ms' && !f.suppressed)
    .reduce((s, f) => s + f.metricValue, 0) ?? 0

  const totalHours = Math.round(totalMs / 3600000)
  const monthCount = new Set(
    listeningTrends?.facts
      .filter((f) => f.metricName === 'total_plays' && !f.suppressed)
      .map((f) => f.dimensionValue) ?? [],
  ).size

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl text-text">Community Insights</h2>
          <p className="mt-1 text-xs text-text-muted">
            Aggregated from {cohortSize} contributors
          </p>
        </div>
        <PrivacyBadge />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Contributors"
          value={cohortSize.toString()}
          detail="opted in to aggregates"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Total Plays"
          value={totalPlays.toLocaleString()}
          detail={`across ${monthCount} months`}
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Listening Hours"
          value={totalHours.toLocaleString()}
        />
        <StatCard
          icon={<Music2 className="h-4 w-4" />}
          label="Top Artists"
          value={artistItems.filter((a) => !a.suppressed).length.toString()}
          detail="in community rotation"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TopItemsList
          title="Top Artists"
          icon={<Music2 className="h-4 w-4 text-accent" />}
          items={artistItems}
          metricLabel="plays"
        />
        <TopItemsList
          title="Top Tracks"
          icon={<Disc3 className="h-4 w-4 text-accent" />}
          items={trackItems}
          metricLabel="plays"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <HourlyChart data={hourlyData} />
        <ArchetypeChart data={archetypeData} />
      </div>

      {platformItems.length > 0 && (
        <TopItemsList
          title="Listening Platforms"
          icon={<BarChart3 className="h-4 w-4 text-accent" />}
          items={platformItems}
          metricLabel="plays"
        />
      )}
    </div>
  )
}
