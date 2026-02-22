import { Line, LineChart } from 'recharts'

import { ChartContainer } from './ChartContainer'

interface SparkLineProps {
  data: number[]
  color?: string
}

export function SparkLine({ data, color = 'var(--color-accent)' }: SparkLineProps): JSX.Element {
  return (
    <ChartContainer height={48} ariaLabel="Sparkline trend">
      <LineChart data={data.map((value, index) => ({ index, value }))}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
