import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DashboardApp } from '@/app/DashboardApp'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'
import { useDataStore } from '@/store/useDataStore'
import { useSessionMetricsStore } from '@/store/useSessionMetricsStore'
import { useSpotifyAuthStore } from '@/store/useSpotifyAuthStore'

vi.mock('@/features/plugins/firstPartyPlugins', () => ({
  firstPartyPlugins: [],
}))

vi.mock('@/lib/plugins/runtime', () => ({
  pluginRegistry: {
    get: vi.fn(),
    register: vi.fn(),
    list: vi.fn(() => []),
  },
}))

vi.mock('@/components/views/OverviewDashboard', () => ({
  OverviewDashboard: () => <div>OverviewDashboard Mock</div>,
}))

vi.mock('@/components/views/ShareStudio', () => ({
  ShareStudio: () => <div>ShareStudio Mock</div>,
}))

vi.mock('@/components/views/AdvancedHub', () => ({
  AdvancedHub: ({ section }: { section?: string }) => <div>{`AdvancedHub Mock (${section ?? 'lab'})`}</div>,
}))

const data = processRecords(makeSyntheticRecords(24), { timezoneMode: 'local' })

describe('DashboardApp shell', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    useSessionMetricsStore.getState().reset()
    useSpotifyAuthStore.setState({
      status: 'disconnected',
      session: null,
      error: null,
    })
    useDataStore.setState({
      mode: 'ready',
      progress: null,
      data,
      error: null,
      timezoneMode: 'local',
    })
  })

  it('keeps advanced tools inside dashboard flow behind progressive disclosure', async () => {
    const user = userEvent.setup()
    render(<DashboardApp />)

    expect(screen.queryByText(/spotify enrichment setup \(optional\)/i)).not.toBeInTheDocument()

    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Share' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Settings' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('More views')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Advanced' })).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: /login with spotify/i })).toBeInTheDocument()
    expect(screen.queryByText(/AdvancedHub Mock/i)).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /show advanced tools/i }))
    expect(await screen.findByText(/AdvancedHub Mock/i)).toBeInTheDocument()
    expect(window.location.hash).toBe('#advanced/lab')

    await user.click(screen.getByRole('button', { name: /hide advanced tools/i }))
    expect(window.location.hash).toBe('')
  })

  it('hydrates advanced section from deep-link hash on initial load', async () => {
    window.history.replaceState({}, '', '/#advanced/network')

    render(<DashboardApp />)

    expect(await screen.findByText('AdvancedHub Mock (network)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /hide advanced tools/i })).toBeInTheDocument()
  })

  it('renders onboarding with external Spotify privacy link and demo-data CTA', () => {
    useDataStore.setState({
      mode: 'idle',
      progress: null,
      data: null,
      error: null,
      timezoneMode: 'local',
    })
    render(<DashboardApp />)

    const privacyLink = screen.getByRole('link', { name: /spotify\.com\/account\/privacy/i })
    expect(privacyLink).toHaveAttribute('href', 'https://spotify.com/account/privacy')
    expect(privacyLink).toHaveAttribute('target', '_blank')
    expect(privacyLink).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(privacyLink).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
    expect(screen.getByRole('button', { name: /use demo data/i })).toBeInTheDocument()
  })
})
