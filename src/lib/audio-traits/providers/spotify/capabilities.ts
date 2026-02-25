import type { SpotifyApiCapabilities, SpotifyApiCapabilityStatus } from '@/lib/types'

export function unknownSpotifyCapabilities(): SpotifyApiCapabilities {
  return {
    audioFeatures: 'unknown',
    tracks: 'unknown',
    artists: 'unknown',
    relatedArtists: 'unknown',
  }
}

export function capabilityFromStatus(status: number): SpotifyApiCapabilityStatus {
  if (status === 401) {
    return 'unauthorized'
  }
  if (status === 429) {
    return 'rate-limited'
  }
  if (status === 403 || status === 404) {
    return 'restricted'
  }
  return 'unknown'
}
