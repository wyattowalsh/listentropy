import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { encodeSharePayload } from '@/lib/share/share-encoder'
import type { SharePayloadV2, SharePayloadV4 } from '@/lib/types'
import { SharePage } from './SharePage'

const applyThemeMock = vi.fn()

vi.mock('react-router-dom', () => ({
  Link: ({ to, className, children }: { to: string; className?: string; children: ReactNode }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@/store/useThemeStore', () => ({
  applyTheme: (...args: unknown[]) => applyThemeMock(...args),
}))

function setShareHash(hash: string): void {
  window.history.replaceState({}, '', `/share#${hash}`)
}

describe('SharePage', () => {
  beforeEach(() => {
    applyThemeMock.mockReset()
    window.history.replaceState({}, '', '/share')
  })

  it('shows a premium recovery state for invalid share hashes', () => {
    setShareHash('not-valid')
    render(<SharePage />)

    expect(screen.getByText(/this link needs a refresh/i)).toBeInTheDocument()
    expect(screen.getByText(/couldn't decode this snapshot payload safely/i)).toBeInTheDocument()
    expect(screen.getByText(/data privacy: decoding happens in your browser/i)).toBeInTheDocument()
    expect(screen.getByText(/link authenticity: shared snapshots are browser-generated and unverified/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create a new share snapshot/i })).toHaveAttribute('href', '/')
  })

  it('upgrades legacy payloads with a harmonized context placeholder', () => {
    const legacyPayload: SharePayloadV2 = {
      version: 2,
      privacyLevel: 'aggregate',
      checksum: 'pending',
      generatedAt: '2025-01-01T00:00:00.000Z',
      timezoneMode: 'local',
      includeName: false,
      anonymize: false,
      totalHours: 42,
      totalPlays: 420,
      uniqueArtists: 32,
      uniqueTracks: 128,
      dateRange: ['2020', '2024'],
      topArtists: [['Artist A', 100]],
      topTracks: [['Track A', 'Artist A', 60]],
      archetype: 'Night Owl',
      archetypes: ['Night Owl'],
      peakHour: 22,
      skipRate: 0.2,
      shuffleRate: 0.4,
      longestStreak: 10,
      tasteDimensions: [0.2, 0.3, 0.4],
    }

    setShareHash(encodeSharePayload(legacyPayload))
    render(<SharePage />)

    expect(screen.getByText(/legacy snapshot upgraded/i)).toBeInTheDocument()
    expect(screen.getByText(/generated with payload v2/i)).toBeInTheDocument()
    expect(screen.getByText(/context details were not included in this earlier share format/i)).toBeInTheDocument()
    expect(screen.getByText(/#1 Artist A/i)).toBeInTheDocument()
  })

  it('keeps full context rendering for current payloads without downgrade messaging', () => {
    const payloadV4: SharePayloadV4 = {
      version: 4,
      privacyLevel: 'aggregate',
      checksum: 'pending',
      generatedAt: '2026-01-01T00:00:00.000Z',
      timezoneMode: 'utc',
      includeName: false,
      anonymize: false,
      totalHours: 84,
      totalPlays: 840,
      uniqueArtists: 64,
      uniqueTracks: 256,
      dateRange: ['2021', '2026'],
      topArtists: [['Artist B', 120]],
      topTracks: [['Track B', 'Artist B', 72]],
      archetype: 'Curator',
      archetypes: ['Curator'],
      peakHour: 21,
      skipRate: 0.15,
      shuffleRate: 0.35,
      longestStreak: 14,
      tasteDimensions: [0.1, 0.2, 0.3],
      context: {
        homeCountry: 'US',
        domesticShare: 0.8,
        travelShare: 0.2,
        topReasons: [['trackdone', 12]],
        offlineRate: 0.04,
        incognitoRate: 0.02,
        topDeviceTransition: ['iOS', 'macOS', 8],
      },
      selectedCards: ['title', 'numbers'],
      sharePreset: 'headline-stats',
      themeKey: 'spotify-dark',
    }

    setShareHash(encodeSharePayload(payloadV4))
    render(<SharePage />)

    expect(screen.getByText(/privacy & authenticity notes/i)).toBeInTheDocument()
    expect(screen.getByText(/this snapshot is decoded in your browser with no upload required to view it/i)).toBeInTheDocument()
    expect(screen.getByText(/share snapshots are browser-generated and unverified in this release/i)).toBeInTheDocument()
    expect(screen.getByText(/home country: US/i)).toBeInTheDocument()
    expect(screen.queryByText(/legacy snapshot upgraded/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/earlier share format/i)).not.toBeInTheDocument()
  })
})
