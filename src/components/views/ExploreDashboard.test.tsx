import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ExploreDashboard } from '@/components/views/ExploreDashboard'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'

vi.mock('@/components/views/ListeningTimeline', () => ({
  ListeningTimeline: () => <div>ListeningTimeline Mock</div>,
}))

vi.mock('@/components/views/TopCharts', () => ({
  TopCharts: () => <div>TopCharts Mock</div>,
}))

vi.mock('@/components/views/ListeningHabits', () => ({
  ListeningHabits: () => <div>ListeningHabits Mock</div>,
}))

vi.mock('@/components/views/ContextIntelligence', () => ({
  ContextIntelligence: () => <div>ContextIntelligence Mock</div>,
}))

vi.mock('@/components/views/ClockCalendar', () => ({
  ClockCalendar: () => <div>ClockCalendar Mock</div>,
}))

vi.mock('@/components/views/MusicEras', () => ({
  MusicEras: () => <div>MusicEras Mock</div>,
}))

const data = processRecords(makeSyntheticRecords(120), { timezoneMode: 'local' })

describe('ExploreDashboard', () => {
  it('renders merged sections and routes the network teaser CTA to Advanced', async () => {
    const onOpenAdvancedSection = vi.fn()
    const user = userEvent.setup()

    render(<ExploreDashboard data={data} onOpenAdvancedSection={onOpenAdvancedSection} />)

    expect(screen.getByRole('heading', { name: 'Explore' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trends' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rankings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Behavior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Context' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rhythm' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eras' })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Trends' })).toBeInTheDocument()
    expect(screen.getByText('ListeningTimeline Mock')).toBeInTheDocument()
    expect(screen.getByText('TopCharts Mock')).toBeInTheDocument()
    expect(screen.getByText('ListeningHabits Mock')).toBeInTheDocument()
    expect(screen.getByText('ContextIntelligence Mock')).toBeInTheDocument()
    expect(screen.getByText('ClockCalendar Mock')).toBeInTheDocument()
    expect(screen.getByText('MusicEras Mock')).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Network teaser' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /open advanced → network/i }))
    expect(onOpenAdvancedSection).toHaveBeenCalledWith('network')
  })

  it('uses progressive disclosure for hero metrics with accessible expansion state', async () => {
    const user = userEvent.setup()

    render(<ExploreDashboard data={data} />)

    const toggleButton = screen.getByRole('button', { name: 'Show all metrics' })
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Graph nodes')).not.toBeInTheDocument()

    await user.click(toggleButton)
    expect(screen.getByRole('button', { name: 'Show fewer metrics' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Graph nodes')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show fewer metrics' }))
    expect(screen.getByRole('button', { name: 'Show all metrics' })).toHaveAttribute('aria-expanded', 'false')
  })
})
