import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Line, LineChart } from 'recharts'

import { ChartContainer } from './ChartContainer'

describe('ChartContainer', () => {
  it('renders with explicit height and aria label for chart accessibility', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 640,
      height: 220,
      top: 0,
      left: 0,
      right: 640,
      bottom: 220,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

    render(
      <div style={{ width: 640 }}>
        <ChartContainer height={220} ariaLabel="Example chart">
          <LineChart data={[{ x: 1, y: 2 }]}>
            <Line dataKey="y" />
          </LineChart>
        </ChartContainer>
      </div>,
    )

    const container = screen.getByRole('img', { name: 'Example chart' })
    expect(container).toBeInTheDocument()
    expect(container).toHaveStyle({ height: '220px' })
  })
})
