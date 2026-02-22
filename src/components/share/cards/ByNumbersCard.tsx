import type { ProcessedDataModel } from '@/lib/types'

interface ByNumbersCardProps {
  data: ProcessedDataModel
}

export function ByNumbersCard({ data }: ByNumbersCardProps): JSX.Element {
  const stats = [
    ['Plays', data.summary.totalPlays.toLocaleString()],
    ['Hours', Math.round(data.summary.totalHours).toLocaleString()],
    ['Artists', data.summary.uniqueArtists.toLocaleString()],
    ['Tracks', data.summary.uniqueTracks.toLocaleString()],
    ['Skip Rate', `${Math.round(data.summary.skipRate * 100)}%`],
    ['Shuffle', `${Math.round(data.summary.shuffleRate * 100)}%`],
  ]
  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">By The Numbers</h3>
      <div className="mt-8 grid grid-cols-2 gap-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-theme border border-border bg-surface-hover p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{label}</p>
            <p className="mt-2 font-heading text-3xl text-text">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
