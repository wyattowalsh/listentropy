import type { ProcessedDataModel } from '@/lib/types'

interface TopTracksCardProps {
  data: ProcessedDataModel
}

export function TopTracksCard({ data }: TopTracksCardProps): JSX.Element {
  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">Top Tracks</h3>
      <ol className="mt-8 space-y-4">
        {data.tracks.slice(0, 5).map((track, index) => (
          <li key={track.key} className="flex items-baseline justify-between border-b border-border pb-2">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-sm text-accent">#{index + 1}</span>
                <span className="font-heading text-2xl text-text">{track.name}</span>
              </div>
              <span className="ml-7 text-sm text-text-muted">{track.artist}</span>
            </div>
            <span className="text-sm text-text-muted">{track.plays.toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
