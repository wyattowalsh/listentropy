import type { ProcessedDataModel } from '@/lib/types'

interface StreakCardProps {
  data: ProcessedDataModel
}

export function StreakCard({ data }: StreakCardProps): JSX.Element {
  const peakDay = [...data.daily].sort((a, b) => b.totalMs - a.totalMs)[0]
  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">The Streak</h3>
      <p className="mt-10 font-heading text-8xl leading-none text-accent">
        {data.summary.longestStreakDays}
      </p>
      <p className="mt-3 text-xl text-text-muted">days straight</p>

      {peakDay ? (
        <div className="mt-16 rounded-theme border border-border bg-surface-hover p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-text-muted">Biggest Day</p>
          <p className="mt-3 font-heading text-3xl text-text">
            {(peakDay.totalMs / 1000 / 60 / 60).toFixed(1)} hours
          </p>
          <p className="mt-1 text-sm text-text-muted">{peakDay.date}</p>
        </div>
      ) : null}
    </div>
  )
}
