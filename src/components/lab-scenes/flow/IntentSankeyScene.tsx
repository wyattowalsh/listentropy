import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { ProcessedDataModel } from '@/lib/types'
import { formatPercent } from '@/lib/utils'

interface IntentSankeySceneProps {
  data: ProcessedDataModel
}

interface FlowRow {
  from: string
  to: string
  count: number
  share: number
}

function topRows(data: ProcessedDataModel): FlowRow[] {
  return data.contextAnalytics.reasons.transitions.slice(0, 8)
}

export function IntentSankeyScene({ data }: IntentSankeySceneProps): JSX.Element {
  const rows = topRows(data)
  if (rows.length === 0) {
    return (
      <Card>
        <CardTitle>Intent Sankey</CardTitle>
        <CardDescription className="mt-2">Not enough reason transition data to render this scene.</CardDescription>
      </Card>
    )
  }

  const maxCount = Math.max(...rows.map((row) => row.count))
  const height = 320
  const startX = 90
  const endX = 520

  return (
    <Card className="min-w-0">
      <CardTitle>Intent Sankey</CardTitle>
      <CardDescription className="mt-1">
        Heuristic flow view of reason_start → reason_end transitions from core context analytics.
      </CardDescription>
      <div className="mt-4 overflow-x-auto">
        <svg width={620} height={height} role="img" aria-label="Intent transition flow diagram">
          <text x={20} y={20} fill="var(--color-text-muted)" fontSize="11">reason_start</text>
          <text x={endX + 10} y={20} fill="var(--color-text-muted)" fontSize="11">reason_end</text>
          {rows.map((row, index) => {
            const y = 44 + index * 34
            const thickness = 4 + (row.count / Math.max(1, maxCount)) * 14
            const curveMidX = (startX + endX) / 2
            const path = `M ${startX} ${y} C ${curveMidX - 60} ${y}, ${curveMidX + 60} ${y}, ${endX} ${y}`
            return (
              <g key={`${row.from}-${row.to}-${index}`}>
                <text x={20} y={y + 4} fill="var(--color-text)" fontSize="12">{row.from}</text>
                <text x={endX + 10} y={y + 4} fill="var(--color-text)" fontSize="12">{row.to}</text>
                <path
                  d={path}
                  stroke={`var(--color-chart-${index % 10})`}
                  strokeWidth={thickness}
                  fill="none"
                  strokeLinecap="round"
                  opacity={0.75}
                >
                  <title>{`${row.from} → ${row.to}: ${row.count.toLocaleString()} (${formatPercent(row.share)})`}</title>
                </path>
                <text x={curveMidX - 16} y={y - 8} fill="var(--color-text-muted)" fontSize="10">
                  {formatPercent(row.share)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </Card>
  )
}
