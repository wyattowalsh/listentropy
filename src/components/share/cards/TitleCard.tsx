import type { ProcessedDataModel } from '@/lib/types'

interface TitleCardProps {
  data: ProcessedDataModel
  name: string
}

export function TitleCard({ data, name }: TitleCardProps): JSX.Element {
  return (
    <div className="story-card h-full w-full bg-[radial-gradient(circle_at_top_right,var(--color-accent-muted),transparent_40%),radial-gradient(circle_at_bottom_left,var(--color-surface-hover),transparent_35%)] p-12">
      <p className="font-mono text-sm uppercase tracking-[0.28em] text-text-muted">My Listentropy</p>
      <h2 className="mt-6 font-heading text-5xl font-semibold text-text">{name || 'Anonymous Listener'}</h2>
      <p className="mt-3 text-lg text-text-muted">
        {data.summary.firstListen.slice(0, 4)} — {data.summary.lastListen.slice(0, 4)}
      </p>
      <p className="mt-16 font-heading text-8xl leading-none text-accent">
        {Math.round(data.summary.totalHours).toLocaleString()}
      </p>
      <p className="mt-3 text-lg text-text-muted">hours listened</p>
    </div>
  )
}
