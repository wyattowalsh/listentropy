import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { StabilityChaosPayload } from '@/lib/types'

interface EntropyPhasePortraitSceneProps {
  payload?: StabilityChaosPayload
}

export function EntropyPhasePortraitScene({ payload }: EntropyPhasePortraitSceneProps): JSX.Element {
  if (!payload || payload.monthlyState.length === 0) {
    return (
      <Card>
        <CardTitle>Entropy Phase Portrait</CardTitle>
        <CardDescription className="mt-2">Run the Stability vs Chaos module to render this scene.</CardDescription>
      </Card>
    )
  }

  const width = 520
  const height = 360
  const left = 50
  const bottom = 28
  const innerW = width - left - 18
  const innerH = height - 20 - bottom

  return (
    <Card className="min-w-0">
      <CardTitle>Entropy Phase Portrait</CardTitle>
      <CardDescription className="mt-1">Monthly state trajectory across intensity, diversity, and chaos.</CardDescription>
      <div className="mt-4 overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label="Entropy phase portrait scatter chart">
          <line x1={left} y1={height - bottom} x2={width - 12} y2={height - bottom} stroke="var(--color-border)" />
          <line x1={left} y1={18} x2={left} y2={height - bottom} stroke="var(--color-border)" />
          <text x={width / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">Diversity</text>
          <text x={16} y={height / 2} textAnchor="middle" fontSize="11" fill="var(--color-text-muted)" transform={`rotate(-90 16 ${height / 2})`}>Intensity</text>
          {payload.monthlyState.map((row, index) => {
            const x = left + row.diversity * innerW
            const y = 18 + (1 - row.intensity) * innerH
            const r = 4 + row.chaosScore * 7
            const fill = row.chaosScore > 0.55 ? 'var(--color-negative)' : `var(--color-chart-${index % 10})`
            const prev = payload.monthlyState[index - 1]
            const prevX = prev ? left + prev.diversity * innerW : null
            const prevY = prev ? 18 + (1 - prev.intensity) * innerH : null
            return (
              <g key={row.month}>
                {prev && prevX !== null && prevY !== null ? (
                  <line x1={prevX} y1={prevY} x2={x} y2={y} stroke="var(--color-border)" strokeDasharray="3 2" />
                ) : null}
                <circle cx={x} cy={y} r={r} fill={fill} opacity={0.7}>
                  <title>{`${row.month}: intensity ${Math.round(row.intensity * 100)}%, diversity ${Math.round(row.diversity * 100)}%, chaos ${Math.round(row.chaosScore * 100)}%`}</title>
                </circle>
                <text x={x + 8} y={y + 3} fontSize="10" fill="var(--color-text-muted)">{row.month.slice(5)}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </Card>
  )
}
