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
  function mockMobileMatchMedia(): () => void {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    return () => {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      })
    }
  }

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

  it('surfaces key insights and defers advanced diagnostics by default on mobile layouts', () => {
    const restoreMatchMedia = mockMobileMatchMedia()

    try {
      render(<MusicUniverse data={data} analysisMode="deep" />)

      expect(screen.getByText('Network at a glance')).toBeInTheDocument()
      const deepBreakdown = screen.getByText('Deep network breakdown', { selector: 'summary' }).closest('details')
      expect(deepBreakdown).not.toBeNull()
      expect(deepBreakdown).not.toHaveAttribute('open')
      const advancedControls = screen
        .getByText('Advanced renderer and density controls', { selector: 'summary' })
        .closest('details')
      expect(advancedControls).not.toBeNull()
      expect(advancedControls).not.toHaveAttribute('open')
      expect(screen.getByRole('textbox', { name: /search artist or track in graph/i })).toBeInTheDocument()
    } finally {
      restoreMatchMedia()
    }
  })
})
