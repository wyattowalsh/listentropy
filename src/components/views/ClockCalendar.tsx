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
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { ProcessedDataModel } from '@/lib/types'

interface ClockCalendarProps {
  data: ProcessedDataModel
}

export function ClockCalendar({ data }: ClockCalendarProps): JSX.Element {
  const premiumCardClass =
    'border-border/70 bg-surface/90 shadow-surface transition-[border-color,background-color] duration-fast hover:border-accent/25'
  const topHour =
    data.hours.length > 0 ? [...data.hours].sort((a, b) => b.plays - a.plays)[0] : null
  const topDay =
    data.dayOfWeek.length > 0 ? [...data.dayOfWeek].sort((a, b) => b.plays - a.plays)[0] : null

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <Card className={premiumCardClass}>
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Busiest clock hour</p>
          <p className="mt-2 text-lg text-text">{topHour ? `${topHour.hour}:00 (${topHour.plays} plays)` : 'N/A'}</p>
        </Card>
        <Card className={premiumCardClass}>
          <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Most active weekday</p>
          <p className="mt-2 text-lg text-text">{topDay ? `${topDay.day} (${topDay.plays} plays)` : 'N/A'}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={premiumCardClass}>
          <CardTitle>Radial Clock</CardTitle>
          <CardDescription className="mt-1">24-hour listening distribution by play count.</CardDescription>
          <div className="mt-3">
            <RadialClock values={data.hours.map((item) => ({ hour: item.hour, plays: item.plays }))} />
          </div>
        </Card>
        <Card className={premiumCardClass}>
          <CardTitle>Day-of-week pattern</CardTitle>
          <CardDescription className="mt-1">Relative weekday listening intensity across the week.</CardDescription>
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

      <Card className={premiumCardClass}>
        <CardTitle>Calendar Heatmap</CardTitle>
        <CardDescription className="mt-1">Daily activity map for spotting streaks and breaks.</CardDescription>
        <div className="mt-3">
          <CalendarHeatmap data={data.calendar} />
        </div>
      </Card>
    </div>
  )
}
