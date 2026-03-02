import { render, screen, waitFor } from '@testing-library/react'
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

vi.mock('@/components/views/ExploreDashboard', () => ({
  ExploreDashboard: () => <div>ExploreDashboard Mock</div>,
}))

vi.mock('@/components/views/ShareStudio', () => ({
  ShareStudio: () => <div>ShareStudio Mock</div>,
}))

vi.mock('@/components/views/AdvancedHub', () => ({
  AdvancedHub: ({ section }: { section?: string }) => <div>{`AdvancedHub Mock (${section ?? 'lab'})`}</div>,
}))

vi.mock('@/components/views/TasteDNA', () => ({
  TasteDNA: ({ onOpenSpotifySetup }: { onOpenSpotifySetup?: () => void }) => (
    <div>
      <p>TasteDNA Mock</p>
      <button type="button" onClick={onOpenSpotifySetup}>Open Advanced Setup</button>
    </div>
  ),
}))

const data = processRecords(makeSyntheticRecords(24), { timezoneMode: 'local' })

describe('DashboardApp shell', () => {
  beforeEach(() => {
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

  it('shows a 4-tab primary nav, no upload-time Spotify prompt, and opens Advanced from header and Taste', async () => {
    const user = userEvent.setup()
    render(<DashboardApp />)

    expect(screen.queryByText(/spotify enrichment setup \(optional\)/i)).not.toBeInTheDocument()

    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Explore' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Taste DNA' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Share' })).toBeInTheDocument()
    expect(screen.queryByLabelText('More views')).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Advanced' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /login with spotify/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(await screen.findByText(/AdvancedHub Mock/i)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Taste DNA' }))
    expect(await screen.findByText('TasteDNA Mock')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Open Advanced Setup' }))
    await waitFor(() => {
      expect(screen.getByText(/AdvancedHub Mock \(lab\)/)).toBeInTheDocument()
    })
  })
})
