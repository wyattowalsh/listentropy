import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TabNav } from './TabNav'

describe('TabNav', () => {
  it('keeps the tab accessible name stable and exposes metadata as description', () => {
    render(
      <TabNav
        value="dashboard"
        onChange={vi.fn()}
        metadata={{
          share: {
            badge: 'insights',
            detail: 'story cards + export formats',
          },
        }}
      />,
    )

    const shareTab = screen.getByRole('tab', { name: /^Share$/ })
    expect(shareTab).toBeVisible()
    expect(shareTab).toHaveAccessibleName('Share')
    expect(shareTab).toHaveAccessibleDescription(/insights/i)
    expect(shareTab).toHaveAccessibleDescription(/story cards \+ export formats/i)
  })

  it('renders only the dashboard and share tabs in the consolidated IA', () => {
    render(<TabNav value="dashboard" onChange={vi.fn()} />)

    expect(screen.queryByLabelText('More views')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Share' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Settings' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Overview' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Explore' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Taste DNA' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })

  it('keeps metadata accessibility on a primary tab', () => {
    render(
      <TabNav
        value="dashboard"
        onChange={vi.fn()}
        metadata={{
          dashboard: { badge: 'ready', detail: 'overview analytics' },
        }}
      />,
    )

    const dashboardTab = screen.getByRole('tab', { name: 'Dashboard' })
    expect(dashboardTab).toHaveAttribute('aria-selected', 'true')
    expect(dashboardTab).toHaveAccessibleDescription(/ready/i)
    expect(dashboardTab).toHaveAccessibleDescription(/overview analytics/i)
  })
})
