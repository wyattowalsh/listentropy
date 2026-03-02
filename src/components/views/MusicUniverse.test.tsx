import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MusicUniverse } from '@/components/views/MusicUniverse'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'

vi.mock('@/components/graph/Universe2D', () => ({
  Universe2D: () => <div>Universe2D Mock</div>,
}))

vi.mock('@/components/graph/Universe3D', () => ({
  Universe3D: () => <div>Universe3D Mock</div>,
}))

const data = processRecords(makeSyntheticRecords(140), { timezoneMode: 'local' })

describe('MusicUniverse', () => {
  it('provides keyboard fallback navigation for node selection', async () => {
    const user = userEvent.setup()

    render(<MusicUniverse data={data} />)

    const navigator = screen.getByRole('group', { name: 'Graph keyboard navigator' })
    navigator.focus()

    await user.keyboard('{ArrowDown}')

    expect(screen.getByRole('status')).toHaveTextContent(/Selected graph node:/i)
    expect(screen.getByText(/Selected node:/i)).toBeInTheDocument()
  })

  it('keeps deep network breakdown behind an expandable section in simple mode', async () => {
    const user = userEvent.setup()

    render(<MusicUniverse data={data} analysisMode="simple" />)

    const deepBreakdownSummary = screen.getByText('Deep network breakdown', { selector: 'summary' })
    await user.click(deepBreakdownSummary)

    expect(screen.getByText('Top Hubs')).toBeInTheDocument()
  })
})
