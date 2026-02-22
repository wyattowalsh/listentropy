import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { EraData } from '@/lib/types'
import { ChartContainer } from './ChartContainer'

interface EraStackedAreaProps {
  eras: EraData[]
}

export function EraStackedArea({ eras }: EraStackedAreaProps): JSX.Element {
  const data = eras.map((era) => ({
    label: `${era.startMonth}→${era.endMonth}`,
    totalMs: era.totalMs,
    era: era.label,
    confidence: Math.round(era.confidence * 100),
    dominance: Math.round(era.dominanceScore * 100),
    diversity: Math.round(era.diversityScore * 100),
    durationMonths: era.durationMonths,
  }))

  return (
    <ChartContainer height={288} ariaLabel="Music eras stacked area chart">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="eraFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="var(--color-chart-0)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--color-chart-0)" stopOpacity={0.15} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
        <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
        <YAxis
          yAxisId="left"
          tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
          tickFormatter={(value) => `${Math.round(Number(value) / 1000 / 60 / 60)}h`}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 100]}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          formatter={(value, name) => {
            const numericValue = typeof value === 'number' ? value : 0
            if (name === 'totalMs') {
              return [`${Math.round(numericValue / 1000 / 60 / 60)} hours`, 'Total Listening']
            }
            if (name === 'confidence') {
              return [`${numericValue}%`, 'Era Confidence']
            }
            if (name === 'dominance') {
              return [`${numericValue}%`, 'Dominance']
            }
            return [numericValue, String(name)]
          }}
          labelFormatter={(label, payload) => {
            const row = payload?.[0]?.payload as typeof data[number] | undefined
            if (!row) {
              return typeof label === 'string' ? label : String(label ?? '')
            }
            return `${row.era} (${row.durationMonths} mo)`
          }}
        />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="totalMs"
          stroke="var(--color-chart-0)"
          fill="url(#eraFill)"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="confidence"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="dominance"
          stroke="var(--color-chart-2)"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
