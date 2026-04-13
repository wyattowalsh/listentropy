import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TabNav } from './TabNav'

vi.mock('lucide-react', () => ({
  Users: (props: Record<string, unknown>) => <svg data-testid="users-icon" {...props} />,
  BarChart3: (props: Record<string, unknown>) => <svg data-testid="barchart-icon" {...props} />,
  Share2: (props: Record<string, unknown>) => <svg data-testid="share-icon" {...props} />,
}))

describe('TabNav', () => {
  it('keeps the tab accessible name stable and exposes metadata as description', () => {
    render(
      <TabNav
        value="home"
        onChange={vi.fn()}
        metadata={{
          share: {
            badge: 'insights',
            detail: 'story cards + export',
          },
        }}
      />,
    )

    const shareTab = screen.getByRole('tab', { name: /^Share$/ })
    expect(shareTab).toBeVisible()
    expect(shareTab).toHaveAccessibleName('Share')
    expect(shareTab).toHaveAccessibleDescription(/insights/i)
    expect(shareTab).toHaveAccessibleDescription(/story cards \+ export/i)
  })

  it('renders three tabs: Home, My Analytics, and Share', () => {
    render(<TabNav value="home" onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'My Analytics' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Share' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  it('keeps metadata accessibility on a primary tab', () => {
    render(
      <TabNav
        value="home"
        onChange={vi.fn()}
        metadata={{
          home: { badge: 'community', detail: 'aggregate insights' },
        }}
      />,
    )

    const homeTab = screen.getByRole('tab', { name: 'Home' })
    expect(homeTab).toHaveAttribute('aria-selected', 'true')
    expect(homeTab).toHaveAccessibleDescription(/community/i)
    expect(homeTab).toHaveAccessibleDescription(/aggregate insights/i)
  })
})
