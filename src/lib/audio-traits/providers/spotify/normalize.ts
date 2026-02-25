import type { AudioTraitVector, TrackAudioTraitRecord } from '@/lib/types'

import type { SpotifyAudioFeatureRecord } from '@/lib/audio-traits/providers/spotify/client'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeTempo(tempo: number): number {
  if (!Number.isFinite(tempo) || tempo <= 0) {
    return 0
  }
  return clamp01(tempo / 240)
}

export function toAudioTraitVector(feature: SpotifyAudioFeatureRecord): AudioTraitVector {
  return {
    danceability: clamp01(feature.danceability),
    energy: clamp01(feature.energy),
    valence: clamp01(feature.valence),
    acousticness: clamp01(feature.acousticness),
    instrumentalness: clamp01(feature.instrumentalness),
    speechiness: clamp01(feature.speechiness),
    tempo: normalizeTempo(feature.tempo),
    liveness: clamp01(feature.liveness),
  }
}

export function normalizeSpotifyAudioTraits(
  features: SpotifyAudioFeatureRecord[],
): Record<string, TrackAudioTraitRecord> {
  const fetchedAt = new Date().toISOString()
  const out: Record<string, TrackAudioTraitRecord> = {}
  for (const feature of features) {
    if (!feature?.id) {
      continue
    }
    out[feature.id] = {
      trackId: feature.id,
      providerId: 'spotify-audio-traits',
      traits: toAudioTraitVector(feature),
      fetchedAt,
      sourceVersion: 'spotify-web-api-audio-features-v1',
      tempoBpm: Number.isFinite(feature.tempo) ? feature.tempo : undefined,
    }
  }
  return out
}
