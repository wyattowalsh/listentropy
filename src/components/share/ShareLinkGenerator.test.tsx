import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProcessedDataModel } from '@/lib/types'
import { ShareLinkGenerator } from './ShareLinkGenerator'

const recordMetric = vi.fn()

vi.mock('@/store/useThemeStore', () => ({
  useThemeStore: (selector: (state: { themeKey: 'spotify-dark' }) => unknown) =>
    selector({ themeKey: 'spotify-dark' }),
}))

vi.mock('@/store/useSessionMetricsStore', () => ({
  useSessionMetricsStore: (selector: (state: { record: typeof recordMetric }) => unknown) =>
    selector({ record: recordMetric }),
}))

function makeData(): ProcessedDataModel {
  return {
    timezoneMode: 'local',
    summary: {
      totalHours: 123.4,
      totalPlays: 4567,
      uniqueArtists: 89,
      uniqueTracks: 321,
      firstListen: '2019-01-01T00:00:00.000Z',
      lastListen: '2026-01-01T00:00:00.000Z',
      peakHour: 23,
      skipRate: 0.21,
      shuffleRate: 0.54,
      longestStreakDays: 12,
    },
    artists: [
      { name: 'Beyonce', plays: 100 },
      { name: 'Utada Hikaru', plays: 90 },
      { name: 'Adele', plays: 80 },
      { name: 'Bad Bunny', plays: 70 },
      { name: 'Daft Punk', plays: 60 },
    ],
    tracks: [
      { name: 'Track One', artist: 'Beyonce', plays: 50 },
      { name: 'Track Two', artist: 'Utada Hikaru', plays: 40 },
      { name: 'Track Three', artist: 'Adele', plays: 30 },
      { name: 'Track Four', artist: 'Bad Bunny', plays: 20 },
      { name: 'Track Five', artist: 'Daft Punk', plays: 10 },
    ],
    archetypes: {
      primary: { label: 'Night Owl' },
      secondary: [{ label: 'The Streamer' }, { label: 'The Archivist' }],
    },
    taste: {
      dimensions: [
        { score: 0.1 },
        { score: 0.2 },
        { score: 0.3 },
        { score: 0.4 },
        { score: 0.5 },
        { score: 0.6 },
        { score: 0.7 },
      ],
    },
    contextAnalytics: {
      country: {
        homeCountry: 'US',
        domesticShare: 0.8,
        travelShare: 0.2,
      },
      reasons: {
        start: [
          { reason: 'trackdone', count: 30 },
          { reason: 'fwdbtn', count: 10 },
        ],
      },
      offlinePrivacy: {
        offlineRate: 0.05,
        incognitoRate: 0.01,
      },
      deviceJourney: {
        dominantTransition: {
          from: 'iOS',
          to: 'macOS',
          count: 12,
        },
      },
    },
  } as unknown as ProcessedDataModel
}

describe('ShareLinkGenerator', () => {
  const writeText = vi.fn<(text: string) => Promise<void>>()

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined)
    recordMetric.mockReset()
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
  })

  it('gates rich-link reveal and copy until warning is confirmed', async () => {
    render(
      <ShareLinkGenerator
        data={makeData()}
        displayName="Alicia"
        selectedCards={['title', 'numbers']}
        sharePreset="deep-stats"
        onDisplayNameChange={vi.fn()}
      />,
    )

    const copyButton = screen.getByRole('button', { name: /copy share link/i })
    expect(copyButton).toBeEnabled()
    expect(screen.getByText(/\/share#/i, { selector: 'code' })).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/include display name in share payload/i))

    expect(copyButton).toBeDisabled()
    expect(screen.queryByText(/\/share#/i, { selector: 'code' })).not.toBeInTheDocument()

    fireEvent.click(copyButton)
    expect(writeText).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText(/confirm rich share warning/i))

    expect(copyButton).toBeEnabled()
    expect(screen.getByText(/\/share#/i, { selector: 'code' })).toBeInTheDocument()

    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })
    expect(writeText.mock.calls[0]?.[0]).toContain('/share#')
  })
})
