import type {
  AudioTraitProviderId,
  ProviderCapabilities,
  SpotifyApiCapabilities,
  SpotifyTokenSource,
  TrackAudioTraitRecord,
} from '@/lib/types'

export type AudioTraitProviderResultStatus = 'ready' | 'unsupported' | 'error' | 'partial'

export interface AudioTraitProviderCapabilityContext {
  accessToken?: string
}

export interface AudioTraitProviderFetchInput {
  datasetFingerprint: string
  trackIds: string[]
  accessToken: string
  tokenSource?: SpotifyTokenSource | 'unknown'
  scopes?: string[]
}

export interface AudioTraitProviderResult {
  status: AudioTraitProviderResultStatus
  message: string
  warnings: string[]
  capabilities: SpotifyApiCapabilities | ProviderCapabilities
  traitsByTrackId?: Record<string, TrackAudioTraitRecord>
  provenance: {
    fetchedAt: string
    sourceVersion: string
    providerLabel: string
    tokenSource: SpotifyTokenSource | 'unknown'
    scopes?: string[]
    endpointNotes?: string[]
  }
}

export interface AudioTraitProvider {
  id: AudioTraitProviderId
  name: string
  getCapabilities: (ctx?: AudioTraitProviderCapabilityContext) => Promise<ProviderCapabilities | SpotifyApiCapabilities>
  fetchTraitSnapshot: (input: AudioTraitProviderFetchInput) => Promise<AudioTraitProviderResult>
}
