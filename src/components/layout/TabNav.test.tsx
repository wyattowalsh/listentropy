import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TabNav } from './TabNav'

describe('TabNav', () => {
  it('keeps the tab accessible name stable and exposes metadata as description', () => {
    render(
      <TabNav
        value="overview"
        onChange={vi.fn()}
        metadata={{
          explore: {
            badge: '6 sections',
            detail: 'charts + timeline + context',
          },
          taste: {
            badge: '10 dims',
            detail: 'dna + spotify enrichment',
          },
        }}
      />,
    )

    const tasteTab = screen.getByRole('tab', { name: /^Taste DNA$/ })
    expect(tasteTab).toBeVisible()
    expect(tasteTab).toHaveAccessibleName('Taste DNA')
    expect(tasteTab).toHaveAccessibleDescription(/10 dims/)
    expect(tasteTab).toHaveAccessibleDescription(/dna \+ spotify enrichment/i)
  })

  it('renders only the 4 primary tabs in pass 2', () => {
    render(<TabNav value="overview" onChange={vi.fn()} />)

    expect(screen.queryByLabelText('More views')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Explore' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Taste DNA' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Share' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(4)
  })

  it('keeps metadata accessibility on a primary tab', () => {
    render(
      <TabNav
        value="explore"
        onChange={vi.fn()}
        metadata={{
          explore: { badge: '6 sections', detail: 'charts + timeline + context' },
        }}
      />,
    )

    const exploreTab = screen.getByRole('tab', { name: 'Explore' })
    expect(exploreTab).toHaveAttribute('aria-selected', 'true')
    expect(exploreTab).toHaveAccessibleDescription(/6 sections/i)
    expect(exploreTab).toHaveAccessibleDescription(/charts \+ timeline \+ context/i)
  })
})
