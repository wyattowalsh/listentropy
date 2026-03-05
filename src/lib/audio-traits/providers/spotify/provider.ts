import type { AudioTraitProvider, AudioTraitProviderFetchInput, AudioTraitProviderResult } from '@/lib/audio-traits/providers/types'
import type { SpotifyApiCapabilities } from '@/lib/types'

import { unknownSpotifyCapabilities, capabilityFromStatus } from '@/lib/audio-traits/providers/spotify/capabilities'
import {
  fetchSpotifyAudioFeaturesByTrackIds,
  fetchSpotifyAudioFeaturesViaProxy,
  SpotifyApiHttpError,
} from '@/lib/audio-traits/providers/spotify/client'
import {
  isSpotifyAudioFeaturesProxyUnsupportedError,
  mapSpotifyUpstreamStatusToAudioFeaturesProxyError,
} from '@/lib/audio-traits/providers/spotify/proxy-contract'
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
      const fallbackAccessToken = input.accessToken.trim()

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
        const { features, requestStats } = await fetchSpotifyAudioFeaturesViaProxy(input.trackIds)
        capabilities.audioFeatures = 'available'
        const traitsByTrackId = normalizeSpotifyAudioTraits(features)
        const endpointNotes = [...(base.provenance.endpointNotes ?? [])]
        const warnings = [...base.warnings]
        endpointNotes.push(
          `Audio features requested for ${requestStats.requestedUniqueTrackIds.toLocaleString()} unique track IDs across ${requestStats.requestChunkCount.toLocaleString()} request chunk(s).`,
        )
        if (requestStats.truncatedTrackIds > 0) {
          warnings.push(
            `Audio trait enrichment capped at ${requestStats.cappedUniqueTrackIds.toLocaleString()} unique track IDs; ${requestStats.truncatedTrackIds.toLocaleString()} additional IDs were skipped.`,
          )
          endpointNotes.push(
            `Track ID cap applied: ${requestStats.cappedUniqueTrackIds.toLocaleString()} of ${requestStats.requestedUniqueTrackIds.toLocaleString()} unique IDs processed.`,
          )
        }
        return {
          status: 'ready',
          message: `Fetched audio traits for ${Object.keys(traitsByTrackId).length.toLocaleString()} tracks.`,
          warnings,
          capabilities,
          traitsByTrackId,
          provenance: {
            ...base.provenance,
            endpointNotes,
          },
        }
      } catch (error) {
        if (error instanceof SpotifyApiHttpError) {
          const mappedProxyError = mapSpotifyUpstreamStatusToAudioFeaturesProxyError(error.status, error.retryAfterSeconds)
          const endpointNotes = [...(base.provenance.endpointNotes ?? [])]
          if (mappedProxyError.error.retryAfterSeconds !== undefined) {
            endpointNotes.push(`Retry-After ${mappedProxyError.error.retryAfterSeconds}s`)
          }
          const mappedMessage = mappedProxyError.error.message
          const unsupported = isSpotifyAudioFeaturesProxyUnsupportedError(mappedProxyError.error.code)

          if (unsupported && fallbackAccessToken) {
            try {
              const { features, requestStats } = await fetchSpotifyAudioFeaturesByTrackIds(fallbackAccessToken, input.trackIds)
              capabilities.audioFeatures = 'available'
              const traitsByTrackId = normalizeSpotifyAudioTraits(features)
              endpointNotes.push(
                `Optional ${input.tokenSource ?? 'unknown'} token fallback used after proxy ${mappedProxyError.error.code}.`,
              )
              endpointNotes.push(
                `Fallback audio features requested for ${requestStats.requestedUniqueTrackIds.toLocaleString()} unique track IDs across ${requestStats.requestChunkCount.toLocaleString()} request chunk(s).`,
              )
              if (requestStats.truncatedTrackIds > 0) {
                endpointNotes.push(
                  `Fallback cap applied: ${requestStats.cappedUniqueTrackIds.toLocaleString()} of ${requestStats.requestedUniqueTrackIds.toLocaleString()} unique IDs processed.`,
                )
              }
              return {
                status: 'ready',
                message: `Fetched audio traits for ${Object.keys(traitsByTrackId).length.toLocaleString()} tracks via optional token fallback.`,
                warnings: [
                  `Primary backend enrichment was ${mappedProxyError.error.code}; optional token fallback was used.`,
                ],
                capabilities,
                traitsByTrackId,
                provenance: {
                  ...base.provenance,
                  endpointNotes,
                },
              }
            } catch (fallbackError) {
              if (fallbackError instanceof SpotifyApiHttpError) {
                capabilities.audioFeatures = capabilityFromStatus(fallbackError.status)
                const mappedFallbackError = mapSpotifyUpstreamStatusToAudioFeaturesProxyError(
                  fallbackError.status,
                  fallbackError.retryAfterSeconds,
                )
                if (mappedFallbackError.error.retryAfterSeconds !== undefined) {
                  endpointNotes.push(`Fallback Retry-After ${mappedFallbackError.error.retryAfterSeconds}s`)
                }
                const fallbackUnsupported = isSpotifyAudioFeaturesProxyUnsupportedError(mappedFallbackError.error.code)
                return {
                  status: fallbackUnsupported ? 'unsupported' : 'error',
                  message: mappedFallbackError.error.message,
                  warnings: [mappedMessage, mappedFallbackError.error.message],
                  capabilities,
                  provenance: {
                    ...base.provenance,
                    endpointNotes,
                  },
                }
              }
              capabilities.audioFeatures = capabilityFromStatus(error.status)
              return {
                status: 'error',
                message: (fallbackError as Error).message,
                warnings: [mappedMessage, 'Unexpected Spotify fallback failure while fetching audio traits.'],
                capabilities,
                provenance: {
                  ...base.provenance,
                  endpointNotes,
                },
              }
            }
          }

          capabilities.audioFeatures = capabilityFromStatus(error.status)
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
