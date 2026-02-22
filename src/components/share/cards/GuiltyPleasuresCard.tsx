import type { ProcessedDataModel } from '@/lib/types'

interface GuiltyPleasuresCardProps {
  data: ProcessedDataModel
}

export function GuiltyPleasuresCard({ data }: GuiltyPleasuresCardProps): JSX.Element {
  const guilty = data.tracks
    .filter((track) => track.plays >= 10 && track.skipRate >= 0.3)
    .sort((a, b) => b.skipRate * b.plays - a.skipRate * a.plays)
    .slice(0, 3)

  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">Guilty Pleasures</h3>
      <p className="mt-2 text-sm text-text-muted">Skipped often, replayed anyway.</p>
      <div className="mt-8 space-y-4">
        {guilty.length === 0 ? (
          <div className="rounded-theme border border-border bg-surface-hover p-4 text-sm text-text-muted">
            No repeat-skip tracks hit the threshold yet.
          </div>
        ) : (
          guilty.map((track, index) => (
            <div key={track.key} className="rounded-theme border border-border bg-surface-hover p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-text-muted">Pick #{index + 1}</p>
              <p className="mt-1 font-heading text-2xl text-text">{track.name}</p>
              <p className="text-sm text-text-muted">{track.artist}</p>
              <p className="mt-2 text-sm text-text-muted">
                {Math.round(track.skipRate * 100)}% skipped · {track.plays.toLocaleString()} plays
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
