import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { OverviewDashboard } from '@/components/views/OverviewDashboard'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'

vi.mock('recharts', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    Bar: Wrapper,
    BarChart: Wrapper,
    Cell: Wrapper,
    Line: Wrapper,
    LineChart: Wrapper,
    Pie: Wrapper,
    PieChart: Wrapper,
    Tooltip: Wrapper,
    XAxis: Wrapper,
    YAxis: Wrapper,
  }
})

vi.mock('@/components/charts/ChartContainer', () => ({
  ChartContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

const data = processRecords(makeSyntheticRecords(180), { timezoneMode: 'local' })

describe('OverviewDashboard', () => {
  it('uses progressive disclosure toggles for insights and data quality diagnostics', async () => {
    const user = userEvent.setup()
    const thirdInsightTitle = data.narrativeInsights[2]?.title
    expect(thirdInsightTitle).toBeTruthy()

    render(<OverviewDashboard data={data} />)

    const insightsToggle = screen.getByRole('button', { name: 'Show more insights' })
    expect(insightsToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(thirdInsightTitle!)).not.toBeInTheDocument()

    await user.click(insightsToggle)
    expect(screen.getByRole('button', { name: 'Show fewer insights' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(thirdInsightTitle!)).toBeInTheDocument()

    const qualityToggle = screen.getByRole('button', { name: 'Show all quality signals' })
    expect(qualityToggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Missing track name rate')).not.toBeInTheDocument()

    await user.click(qualityToggle)
    expect(screen.getByRole('button', { name: 'Show fewer quality signals' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Missing track name rate')).toBeInTheDocument()
  })
})
