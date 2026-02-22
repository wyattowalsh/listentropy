import { formatPercent } from '@/lib/utils'

interface RadialClockProps {
  values: Array<{ hour: number; plays: number }>
}

export function RadialClock({ values }: RadialClockProps): JSX.Element {
  const max = Math.max(...values.map((item) => item.plays), 1)
  const center = 140
  const innerRadius = 46
  const outerRadius = 120

  return (
    <svg viewBox="0 0 280 280" className="h-[280px] w-full" role="img" aria-label="24-hour radial listening clock">
      <circle cx={center} cy={center} r={outerRadius} fill="transparent" stroke="var(--color-border)" strokeWidth="1" />
      {values.map((item) => {
        const startAngle = (item.hour / 24) * Math.PI * 2 - Math.PI / 2
        const endAngle = ((item.hour + 1) / 24) * Math.PI * 2 - Math.PI / 2
        const intensity = item.plays / max
        const radius = innerRadius + (outerRadius - innerRadius) * intensity
        const x1 = center + innerRadius * Math.cos(startAngle)
        const y1 = center + innerRadius * Math.sin(startAngle)
        const x2 = center + radius * Math.cos(startAngle)
        const y2 = center + radius * Math.sin(startAngle)
        const x3 = center + radius * Math.cos(endAngle)
        const y3 = center + radius * Math.sin(endAngle)
        const x4 = center + innerRadius * Math.cos(endAngle)
        const y4 = center + innerRadius * Math.sin(endAngle)
        return (
          <path
            key={item.hour}
            d={`M ${x1} ${y1} L ${x2} ${y2} A ${radius} ${radius} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1}`}
            fill="var(--color-accent)"
            fillOpacity={0.18 + intensity * 0.75}
          />
        )
      })}
      <text x={center} y={center - 10} textAnchor="middle" className="fill-text text-sm font-semibold">
        Listening Clock
      </text>
      <text x={center} y={center + 14} textAnchor="middle" className="fill-text-muted text-xs">
        Peak intensity {formatPercent(max / Math.max(1, values.reduce((sum, item) => sum + item.plays, 0)))}
      </text>
    </svg>
  )
}
