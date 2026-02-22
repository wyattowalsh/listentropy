import { describe, expect, it } from 'vitest'

import type { SharePayloadV1, SharePayloadV2, SharePayloadV3, SharePayloadV4 } from '@/lib/types'
import {
  decodeSharePayloadV2,
  decodeSharePayloadV3,
  decodeSharePayloadV4,
  decodeSharePayload,
  encodeSharePayload,
} from './share-encoder'

describe('share payload encoder', () => {
  it('encodes and decodes v2 round trip', () => {
    const payload: SharePayloadV2 = {
      version: 2,
      privacyLevel: 'aggregate',
      checksum: 'pending',
      totalHours: 1234,
      totalPlays: 54321,
      uniqueArtists: 987,
      uniqueTracks: 6543,
      dateRange: ['2011', '2026'],
      topArtists: [
        ['Artist A', 100],
        ['Artist B', 80],
      ],
      topTracks: [
        ['Track A', 'Artist A', 60],
        ['Track B', 'Artist B', 40],
      ],
      archetype: 'Night Owl',
      archetypes: ['Night Owl', 'The Streamer'],
      peakHour: 23,
      skipRate: 0.24,
      shuffleRate: 0.58,
      longestStreak: 17,
      tasteDimensions: [0.2, 0.8, 0.5, 0.9, 0.1, 0.3, 0.7, 0.4, 0.6, 0.2],
      includeName: false,
      anonymize: true,
      generatedAt: '2026-01-01T00:00:00.000Z',
    }

    const encoded = encodeSharePayload(payload)
    const decoded = decodeSharePayload(encoded)

    expect(decoded.version).toBe(2)
    if (decoded.version === 2) {
      expect(decoded.anonymize).toBe(true)
      expect(decoded.topArtists[0]?.[0]).toBe('Artist A')
    }
  })

  it('upgrades v1 payloads to v2 for backwards compatibility', () => {
    const payload: SharePayloadV1 = {
      version: 1,
      privacyLevel: 'aggregate',
      checksum: 'pending',
      totalHours: 1234,
      totalPlays: 54321,
      uniqueArtists: 987,
      uniqueTracks: 6543,
      dateRange: ['2011', '2026'],
      topArtists: [['Artist A', 100]],
      topTracks: [['Track A', 'Artist A', 60]],
      archetype: 'Night Owl',
      peakHour: 23,
      skipRate: 0.24,
      shuffleRate: 0.58,
      longestStreak: 17,
      tasteDimensions: [0.2, 0.8, 0.5],
      includeName: false,
    }

    const encoded = encodeSharePayload(payload)
    const upgraded = decodeSharePayloadV2(encoded)

    expect(upgraded.version).toBe(2)
    expect(upgraded.archetypes[0]).toBe('Night Owl')
    expect(upgraded.anonymize).toBe(false)
  })

  it('encodes and decodes v3 with context snapshot and timezone mode', () => {
    const payload: SharePayloadV3 = {
      version: 3,
      privacyLevel: 'aggregate',
      checksum: 'pending',
      generatedAt: '2026-01-01T00:00:00.000Z',
      timezoneMode: 'utc',
      includeName: false,
      anonymize: false,
      totalHours: 1234,
      totalPlays: 54321,
      uniqueArtists: 987,
      uniqueTracks: 6543,
      dateRange: ['2011', '2026'],
      topArtists: [['Artist A', 100]],
      topTracks: [['Track A', 'Artist A', 60]],
      archetype: 'Night Owl',
      archetypes: ['Night Owl'],
      peakHour: 23,
      skipRate: 0.24,
      shuffleRate: 0.58,
      longestStreak: 17,
      tasteDimensions: [0.2, 0.8, 0.5],
      context: {
        homeCountry: 'US',
        domesticShare: 0.9,
        travelShare: 0.1,
        topReasons: [['trackdone', 100]],
        offlineRate: 0.02,
        incognitoRate: 0.01,
        topDeviceTransition: ['iOS', 'macOS', 42],
      },
    }

    const encoded = encodeSharePayload(payload)
    const decoded = decodeSharePayloadV3(encoded)
    expect(decoded.version).toBe(3)
    expect(decoded.timezoneMode).toBe('utc')
    expect(decoded.context.homeCountry).toBe('US')
  })

  it('upgrades v1 and v2 payloads to v3', () => {
    const v1: SharePayloadV1 = {
      version: 1,
      privacyLevel: 'aggregate',
      checksum: 'pending',
      includeName: false,
      totalHours: 1,
      totalPlays: 2,
      uniqueArtists: 3,
      uniqueTracks: 4,
      dateRange: ['2020', '2021'],
      topArtists: [['A', 1]],
      topTracks: [['T', 'A', 1]],
      archetype: 'Night Owl',
      peakHour: 22,
      skipRate: 0.1,
      shuffleRate: 0.2,
      longestStreak: 3,
      tasteDimensions: [0.1],
    }
    const v2: SharePayloadV2 = {
      version: 2,
      privacyLevel: 'aggregate',
      checksum: 'pending',
      includeName: false,
      anonymize: false,
      generatedAt: '2026-01-01T00:00:00.000Z',
      timezoneMode: 'local',
      totalHours: 1,
      totalPlays: 2,
      uniqueArtists: 3,
      uniqueTracks: 4,
      dateRange: ['2020', '2021'],
      topArtists: [['A', 1]],
      topTracks: [['T', 'A', 1]],
      archetype: 'Night Owl',
      archetypes: ['Night Owl'],
      peakHour: 22,
      skipRate: 0.1,
      shuffleRate: 0.2,
      longestStreak: 3,
      tasteDimensions: [0.1],
    }

    const upgradedFromV1 = decodeSharePayloadV3(encodeSharePayload(v1))
    const upgradedFromV2 = decodeSharePayloadV3(encodeSharePayload(v2))

    expect(upgradedFromV1.version).toBe(3)
    expect(upgradedFromV1.context.homeCountry).toBeNull()
    expect(upgradedFromV2.version).toBe(3)
    expect(upgradedFromV2.timezoneMode).toBe('local')
  })

  it('encodes and decodes v4 with preset, theme, and selected cards', () => {
    const payload: SharePayloadV4 = {
      version: 4,
      privacyLevel: 'aggregate',
      checksum: 'pending',
      generatedAt: '2026-01-01T00:00:00.000Z',
      timezoneMode: 'local',
      includeName: false,
      anonymize: false,
      totalHours: 99,
      totalPlays: 999,
      uniqueArtists: 123,
      uniqueTracks: 456,
      dateRange: ['2018', '2026'],
      topArtists: [['Artist A', 10]],
      topTracks: [['Track A', 'Artist A', 10]],
      archetype: 'Night Owl',
      archetypes: ['Night Owl'],
      peakHour: 23,
      skipRate: 0.11,
      shuffleRate: 0.44,
      longestStreak: 12,
      tasteDimensions: [0.1, 0.2, 0.3],
      context: {
        homeCountry: 'US',
        domesticShare: 0.8,
        travelShare: 0.2,
        topReasons: [['trackdone', 50]],
        offlineRate: 0.03,
        incognitoRate: 0.01,
      },
      selectedCards: ['title', 'numbers', 'archetype'],
      sharePreset: 'quick-flex',
      themeKey: 'editorial-light',
    }

    const encoded = encodeSharePayload(payload)
    const decoded = decodeSharePayload(encoded)
    expect(decoded.version).toBe(4)
    if (decoded.version === 4) {
      expect(decoded.sharePreset).toBe('quick-flex')
      expect(decoded.themeKey).toBe('editorial-light')
      expect(decoded.selectedCards).toEqual(['title', 'numbers', 'archetype'])
    }
  })

  it('upgrades v3 payloads to v4 defaults', () => {
    const v3: SharePayloadV3 = {
      version: 3,
      privacyLevel: 'aggregate',
      checksum: 'pending',
      generatedAt: '2026-01-01T00:00:00.000Z',
      timezoneMode: 'utc',
      includeName: false,
      anonymize: false,
      totalHours: 1,
      totalPlays: 2,
      uniqueArtists: 3,
      uniqueTracks: 4,
      dateRange: ['2020', '2021'],
      topArtists: [['A', 1]],
      topTracks: [['T', 'A', 1]],
      archetype: 'Night Owl',
      archetypes: ['Night Owl'],
      peakHour: 22,
      skipRate: 0.1,
      shuffleRate: 0.2,
      longestStreak: 3,
      tasteDimensions: [0.1],
      context: {
        homeCountry: null,
        domesticShare: 0,
        travelShare: 0,
        topReasons: [],
        offlineRate: 0,
        incognitoRate: 0,
      },
    }

    const upgraded = decodeSharePayloadV4(encodeSharePayload(v3))
    expect(upgraded.version).toBe(4)
    if (upgraded.version === 4) {
      expect(upgraded.selectedCards.length).toBeGreaterThan(0)
      expect(upgraded.sharePreset).toBe('deep-stats')
    }
  })

  it('rejects invalid payloads', () => {
    expect(() => decodeSharePayload('not-valid')).toThrow()
  })
})
