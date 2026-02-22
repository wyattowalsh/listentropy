import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { ChartContainer } from '@/components/charts/ChartContainer'
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap'
import { RadialClock } from '@/components/charts/RadialClock'
import { Card, CardTitle } from '@/components/ui/card'
import type { ProcessedDataModel } from '@/lib/types'

interface ClockCalendarProps {
  data: ProcessedDataModel
}

export function ClockCalendar({ data }: ClockCalendarProps): JSX.Element {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Radial Clock</CardTitle>
          <div className="mt-3">
            <RadialClock values={data.hours.map((item) => ({ hour: item.hour, plays: item.plays }))} />
          </div>
        </Card>
        <Card>
          <CardTitle>Day-of-week pattern</CardTitle>
          <ChartContainer ariaLabel="Day of week listening bar chart" className="mt-3" height={310}>
            <BarChart data={data.dayOfWeek} layout="vertical">
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <YAxis type="category" dataKey="day" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="plays" fill="var(--color-chart-1)" />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>

      <Card>
        <CardTitle>Calendar Heatmap</CardTitle>
        <div className="mt-3">
          <CalendarHeatmap data={data.calendar} />
        </div>
      </Card>
    </div>
  )
}
