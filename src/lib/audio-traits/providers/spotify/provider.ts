import type { AudioTraitProvider, AudioTraitProviderFetchInput, AudioTraitProviderResult } from '@/lib/audio-traits/providers/types'
import type { SpotifyApiCapabilities } from '@/lib/types'

import { unknownSpotifyCapabilities, capabilityFromStatus } from '@/lib/audio-traits/providers/spotify/capabilities'
import { fetchSpotifyAudioFeaturesByTrackIds, SpotifyApiHttpError } from '@/lib/audio-traits/providers/spotify/client'
import { normalizeSpotifyAudioTraits } from '@/lib/audio-traits/providers/spotify/normalize'

function buildBaseResult(input: AudioTraitProviderFetchInput): Pick<AudioTraitProviderResult, 'warnings' | 'provenance'> {
  return {
    warnings: [],
    provenance: {
      fetchedAt: new Date().toISOString(),
      sourceVersion: 'spotify-web-api-audio-features-v1',
      providerLabel: 'Spotify Web API (audio features)',
      tokenSource: input.tokenSource ?? 'unknown',
      scopes: input.scopes,
      endpointNotes: [],
    },
  }
}

export function createSpotifyAudioTraitProvider(): AudioTraitProvider {
  return {
    id: 'spotify-audio-traits',
    name: 'Spotify Audio Traits',
    async getCapabilities() {
      return unknownSpotifyCapabilities()
    },
    async fetchTraitSnapshot(input) {
      const base = buildBaseResult(input)
      const capabilities: SpotifyApiCapabilities = unknownSpotifyCapabilities()

      if (!input.accessToken.trim()) {
        capabilities.audioFeatures = 'unauthorized'
        return {
          status: 'unsupported',
          message: 'No Spotify access token available for audio trait enrichment.',
          warnings: ['Connect Spotify or provide a manual token to fetch audio traits.'],
          capabilities,
          provenance: base.provenance,
        }
      }

      if (input.trackIds.length === 0) {
        capabilities.audioFeatures = 'available'
        return {
          status: 'ready',
          message: 'No eligible Spotify track IDs were found in this dataset.',
          warnings: ['Dataset has no eligible Spotify music track URIs for audio trait enrichment.'],
          capabilities,
          traitsByTrackId: {},
          provenance: base.provenance,
        }
      }

      try {
        const features = await fetchSpotifyAudioFeaturesByTrackIds(input.accessToken, input.trackIds)
        capabilities.audioFeatures = 'available'
        const traitsByTrackId = normalizeSpotifyAudioTraits(features)
        return {
          status: 'ready',
          message: `Fetched audio traits for ${Object.keys(traitsByTrackId).length.toLocaleString()} tracks.`,
          warnings: base.warnings,
          capabilities,
          traitsByTrackId,
          provenance: base.provenance,
        }
      } catch (error) {
        if (error instanceof SpotifyApiHttpError) {
          capabilities.audioFeatures = capabilityFromStatus(error.status)
          const endpointNotes = [...(base.provenance.endpointNotes ?? [])]
          if (error.retryAfterSeconds !== undefined) {
            endpointNotes.push(`Retry-After ${error.retryAfterSeconds}s`) 
          }
          const messageByStatus: Record<number, string> = {
            401: 'Spotify token was rejected (401). Reconnect or refresh the token.',
            403: 'Spotify audio-features endpoint is restricted for this app/token (403).',
            404: 'Spotify audio-features endpoint is unavailable or restricted (404).',
            429: 'Spotify rate limit hit while fetching audio traits (429).',
          }
          const mappedMessage = messageByStatus[error.status] ?? `Spotify audio trait request failed with ${error.status}.`
          const unsupported = error.status === 403 || error.status === 404 || error.status === 401
          return {
            status: unsupported ? 'unsupported' : 'error',
            message: mappedMessage,
            warnings: [mappedMessage],
            capabilities,
            provenance: {
              ...base.provenance,
              endpointNotes,
            },
          }
        }

        return {
          status: 'error',
          message: (error as Error).message,
          warnings: ['Unexpected Spotify provider failure while fetching audio traits.'],
          capabilities,
          provenance: base.provenance,
        }
      }
    },
  }
}
