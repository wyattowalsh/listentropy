import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { ChronotypeDriftPayload } from '@/lib/types'

interface ChronomapRidgelinesSceneProps {
  payload?: ChronotypeDriftPayload
}

export function ChronomapRidgelinesScene({ payload }: ChronomapRidgelinesSceneProps): JSX.Element {
  if (!payload || payload.monthlyPeaks.length === 0) {
    return (
      <Card>
        <CardTitle>Chronomap Ridgelines</CardTitle>
        <CardDescription className="mt-2">Run the Chronotype Drift module to render this scene.</CardDescription>
      </Card>
    )
  }

  const rows = payload.monthlyPeaks.slice(-12)
  const width = 720
  const height = 360
  const left = 80
  const innerWidth = width - left - 20
  const rowGap = 22

  return (
    <Card className="min-w-0">
      <CardTitle>Chronomap Ridgelines</CardTitle>
      <CardDescription className="mt-1">Monthly peak-hour signatures and daypart drift (last 12 months shown).</CardDescription>
      <div className="mt-4 overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label="Chronomap ridgeline chart">
          {Array.from({ length: 24 }, (_, hour) => {
            const x = left + (hour / 23) * innerWidth
            return (
              <g key={`grid-${hour}`}>
                <line x1={x} y1={20} x2={x} y2={height - 20} stroke="var(--color-border)" strokeOpacity={0.35} />
                <text x={x} y={14} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">{hour}</text>
              </g>
            )
          })}
          {rows.map((row, index) => {
            const y = 36 + index * rowGap
            const peakX = left + (row.peakHour / 23) * innerWidth
            const amp = 6 + row.nocturnalShare * 12
            const path = `M ${left} ${y} C ${peakX - 40} ${y}, ${peakX - 20} ${y - amp}, ${peakX} ${y - amp} C ${peakX + 20} ${y - amp}, ${peakX + 40} ${y}, ${left + innerWidth} ${y}`
            return (
              <g key={row.month}>
                <text x={10} y={y + 4} fontSize="11" fill="var(--color-text)">{row.month}</text>
                <path d={path} fill="none" stroke={`var(--color-chart-${index % 10})`} strokeWidth={2} opacity={0.9}>
                  <title>{`${row.month}: peak ${row.peakHour}:00, nocturnal ${Math.round(row.nocturnalShare * 100)}%`}</title>
                </path>
                <circle cx={peakX} cy={y - amp} r={3.5} fill={`var(--color-chart-${index % 10})`} />
              </g>
            )
          })}
        </svg>
      </div>
    </Card>
  )
}
