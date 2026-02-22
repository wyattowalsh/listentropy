import type { ProcessedDataModel } from '@/lib/types'

interface ForgottenGemCardProps {
  data: ProcessedDataModel
}

export function ForgottenGemCard({ data }: ForgottenGemCardProps): JSX.Element {
  const gem = data.gems[0]
  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">Forgotten Gem</h3>
      {gem ? (
        <>
          <p className="mt-10 font-heading text-4xl text-text">{gem.track}</p>
          <p className="mt-2 text-xl text-text-muted">{gem.artist}</p>

          <div className="mt-10 space-y-2 rounded-theme border border-border bg-surface-hover p-5 text-sm text-text-muted">
            <p>You played this {gem.totalPlays.toLocaleString()} times.</p>
            <p>Peak period: {gem.peakPeriod} ({gem.peakPlays.toLocaleString()} plays)</p>
            <p>Last played: {gem.lastPlayed.slice(0, 10)}</p>
            <p>{gem.yearsSinceLastPlay} years since last play.</p>
          </div>
        </>
      ) : (
        <p className="mt-10 text-lg text-text-muted">No forgotten gems detected yet.</p>
      )}
    </div>
  )
}
