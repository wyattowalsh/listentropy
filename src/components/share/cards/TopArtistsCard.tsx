import type { ProcessedDataModel } from '@/lib/types'

interface TopArtistsCardProps {
  data: ProcessedDataModel
}

export function TopArtistsCard({ data }: TopArtistsCardProps): JSX.Element {
  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">Top Artists</h3>
      <ol className="mt-8 space-y-4">
        {data.artists.slice(0, 5).map((artist, index) => (
          <li key={artist.key} className="flex items-baseline justify-between border-b border-border pb-2">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-sm text-accent">#{index + 1}</span>
              <span className="font-heading text-2xl text-text">{artist.name}</span>
            </div>
            <span className="text-sm text-text-muted">{artist.plays.toLocaleString()} plays</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
