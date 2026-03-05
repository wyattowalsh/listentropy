import { describe, expect, it } from 'vitest'

import {
  SPOTIFY_AUDIO_FEATURES_PROXY_MAX_TRACK_IDS,
  SPOTIFY_AUDIO_FEATURES_PROXY_TRACK_ID_CHUNK_SIZE,
  isSpotifyAudioFeaturesProxyUnsupportedError,
  mapSpotifyUpstreamStatusToAudioFeaturesProxyError,
  planSpotifyAudioFeaturesTrackIds,
} from '@/lib/audio-traits/providers/spotify/proxy-contract'

describe('spotify audio features proxy contract', () => {
  it('plans unique track ids with enforced cap and chunk counts', () => {
    const overLimit = SPOTIFY_AUDIO_FEATURES_PROXY_MAX_TRACK_IDS + 5
    const trackIds = Array.from({ length: overLimit }, (_, index) => `track-${index}`)
    trackIds.push('track-0', ' ', '')

    const plan = planSpotifyAudioFeaturesTrackIds(trackIds)

    expect(plan.trackIds.length).toBe(SPOTIFY_AUDIO_FEATURES_PROXY_MAX_TRACK_IDS)
    expect(plan.requestStats.requestedUniqueTrackIds).toBe(overLimit)
    expect(plan.requestStats.cappedUniqueTrackIds).toBe(SPOTIFY_AUDIO_FEATURES_PROXY_MAX_TRACK_IDS)
    expect(plan.requestStats.truncatedTrackIds).toBe(5)
    expect(plan.requestStats.requestChunkCount).toBe(
      Math.ceil(SPOTIFY_AUDIO_FEATURES_PROXY_MAX_TRACK_IDS / SPOTIFY_AUDIO_FEATURES_PROXY_TRACK_ID_CHUNK_SIZE),
    )
    expect(plan.chunks.length).toBe(plan.requestStats.requestChunkCount)
    expect(plan.chunks[0]).toHaveLength(SPOTIFY_AUDIO_FEATURES_PROXY_TRACK_ID_CHUNK_SIZE)
  })

  it('maps upstream statuses to explicit proxy errors', () => {
    expect(mapSpotifyUpstreamStatusToAudioFeaturesProxyError(401)).toMatchObject({
      status: 401,
      error: { code: 'unauthorized' },
    })
    expect(mapSpotifyUpstreamStatusToAudioFeaturesProxyError(403)).toMatchObject({
      status: 403,
      error: { code: 'restricted' },
    })
    expect(mapSpotifyUpstreamStatusToAudioFeaturesProxyError(404)).toMatchObject({
      status: 403,
      error: { code: 'restricted' },
    })
    expect(mapSpotifyUpstreamStatusToAudioFeaturesProxyError(429, 12)).toMatchObject({
      status: 429,
      error: { code: 'rate-limited', retryAfterSeconds: 12 },
    })
    expect(mapSpotifyUpstreamStatusToAudioFeaturesProxyError(503)).toMatchObject({
      status: 503,
      error: { code: 'unavailable' },
    })
  })

  it('marks only unauthorized/restricted errors as unsupported', () => {
    expect(isSpotifyAudioFeaturesProxyUnsupportedError('unauthorized')).toBe(true)
    expect(isSpotifyAudioFeaturesProxyUnsupportedError('restricted')).toBe(true)
    expect(isSpotifyAudioFeaturesProxyUnsupportedError('rate-limited')).toBe(false)
    expect(isSpotifyAudioFeaturesProxyUnsupportedError('unavailable')).toBe(false)
  })
})
