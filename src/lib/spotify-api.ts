interface SpotifyAudioFeature {
  id: string
  danceability: number
  energy: number
  valence: number
  acousticness: number
  instrumentalness: number
  speechiness: number
  tempo: number
  liveness: number
}

interface SpotifyAudioFeaturesResponse {
  audio_features: SpotifyAudioFeature[]
}

interface SpotifyTrackArtistRef {
  id: string
  name: string
}

interface SpotifyTrackMetadata {
  id: string
  artists: SpotifyTrackArtistRef[]
}

interface SpotifyTracksResponse {
  tracks: Array<SpotifyTrackMetadata | null>
}

interface SpotifyArtist {
  id: string
  name: string
  genres: string[]
  popularity: number
}

interface SpotifyArtistsResponse {
  artists: Array<SpotifyArtist | null>
}

interface SpotifyRelatedArtistsResponse {
  artists: SpotifyArtist[]
}

export interface SpotifyEnhancementResult {
  dimensions: Array<{ key: string; label: string; score: number }>
  fetchedTrackCount: number
  genreAffinities?: Array<{ genre: string; share: number }>
  artistAffinities?: Array<{ id: string; name: string; trackRefs: number; genres: string[] }>
  neighborhoodQuality?: {
    score: number
    sampledArtists: number
    overlapCount: number
    endpointSupported: boolean
  } | null
  warnings?: string[]
}

function chunkArray<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export async function fetchSpotifyAudioFeatureProfile(
  token: string,
  trackUris: string[],
): Promise<SpotifyEnhancementResult> {
  const ids = trackUris
    .map((uri) => uri.split(':')[2])
    .filter((value): value is string => Boolean(value))
    .slice(0, 500)

  const allFeatures: SpotifyAudioFeature[] = []
  for (const chunk of chunkArray(ids, 100)) {
    const response = await fetch(
      `https://api.spotify.com/v1/audio-features?ids=${chunk.join(',')}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Spotify API request failed with ${response.status}`)
    }

    const payload = (await response.json()) as SpotifyAudioFeaturesResponse
    allFeatures.push(...payload.audio_features.filter(Boolean))
  }

  const result: SpotifyEnhancementResult = {
    fetchedTrackCount: allFeatures.length,
    dimensions: [
      { key: 'danceability', label: 'Danceability', score: average(allFeatures.map((item) => item.danceability)) },
      { key: 'energy', label: 'Energy', score: average(allFeatures.map((item) => item.energy)) },
      { key: 'valence', label: 'Valence', score: average(allFeatures.map((item) => item.valence)) },
      { key: 'acousticness', label: 'Acousticness', score: average(allFeatures.map((item) => item.acousticness)) },
      { key: 'instrumentalness', label: 'Instrumentalness', score: average(allFeatures.map((item) => item.instrumentalness)) },
      { key: 'speechiness', label: 'Speechiness', score: average(allFeatures.map((item) => item.speechiness)) },
      { key: 'liveness', label: 'Liveness', score: average(allFeatures.map((item) => item.liveness)) },
      {
        key: 'tempo',
        label: 'Tempo',
        score: Math.min(1, average(allFeatures.map((item) => item.tempo)) / 180),
      },
    ],
  }

  try {
    const enriched = await enrichArtistNeighborhood(token, ids)
    result.genreAffinities = enriched.genreAffinities
    result.artistAffinities = enriched.artistAffinities
    result.neighborhoodQuality = enriched.neighborhoodQuality
    if (enriched.warnings.length > 0) {
      result.warnings = enriched.warnings
    }
  } catch {
    result.warnings = [...(result.warnings ?? []), 'Artist affinity enrichment unavailable; showing audio features only.']
  }

  return result
}

async function spotifyGet<T>(token: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    throw new Error(`Spotify API request failed with ${response.status}`)
  }
  return (await response.json()) as T
}

async function enrichArtistNeighborhood(token: string, trackIds: string[]): Promise<{
  genreAffinities: Array<{ genre: string; share: number }>
  artistAffinities: Array<{ id: string; name: string; trackRefs: number; genres: string[] }>
  neighborhoodQuality: SpotifyEnhancementResult['neighborhoodQuality']
  warnings: string[]
}> {
  const warnings: string[] = []
  const tracks: SpotifyTrackMetadata[] = []
  for (const chunk of chunkArray(trackIds.slice(0, 100), 50)) {
    const payload = await spotifyGet<SpotifyTracksResponse>(token, `https://api.spotify.com/v1/tracks?ids=${chunk.join(',')}`)
    tracks.push(...payload.tracks.filter(Boolean) as SpotifyTrackMetadata[])
  }

  const artistRefs = new Map<string, { name: string; trackRefs: number }>()
  for (const track of tracks) {
    for (const artist of track.artists) {
      const current = artistRefs.get(artist.id)
      artistRefs.set(artist.id, {
        name: artist.name,
        trackRefs: (current?.trackRefs ?? 0) + 1,
      })
    }
  }

  const artistIds = [...artistRefs.keys()].slice(0, 50)
  if (artistIds.length === 0) {
    return {
      genreAffinities: [],
      artistAffinities: [],
      neighborhoodQuality: null,
      warnings,
    }
  }

  const artists: SpotifyArtist[] = []
  for (const chunk of chunkArray(artistIds, 50)) {
    const payload = await spotifyGet<SpotifyArtistsResponse>(token, `https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`)
    artists.push(...payload.artists.filter(Boolean) as SpotifyArtist[])
  }

  const genreCounts = new Map<string, number>()
  for (const artist of artists) {
    for (const genre of artist.genres) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1)
    }
  }
  const genreAffinities = [...genreCounts.entries()]
    .map(([genre, count]) => ({ genre, share: count / Math.max(1, artists.length) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 10)

  const artistAffinities = artists
    .map((artist) => ({
      id: artist.id,
      name: artist.name,
      trackRefs: artistRefs.get(artist.id)?.trackRefs ?? 0,
      genres: artist.genres.slice(0, 3),
    }))
    .sort((a, b) => b.trackRefs - a.trackRefs)
    .slice(0, 8)

  let neighborhoodQuality: SpotifyEnhancementResult['neighborhoodQuality'] = null
  try {
    const sampled = artists
      .slice()
      .sort((a, b) => (artistRefs.get(b.id)?.trackRefs ?? 0) - (artistRefs.get(a.id)?.trackRefs ?? 0))
      .slice(0, 3)

    const sampledIds = new Set(sampled.map((artist) => artist.id))
    let overlapCount = 0
    for (const artist of sampled) {
      const related = await spotifyGet<SpotifyRelatedArtistsResponse>(
        token,
        `https://api.spotify.com/v1/artists/${artist.id}/related-artists`,
      )
      overlapCount += related.artists.filter((candidate) => sampledIds.has(candidate.id)).length
    }
    neighborhoodQuality = {
      score: Math.min(1, overlapCount / Math.max(1, sampled.length * 10)),
      sampledArtists: sampled.length,
      overlapCount,
      endpointSupported: true,
    }
  } catch {
    warnings.push('Related artist neighborhood endpoint unavailable; genre affinity overlays still applied.')
    neighborhoodQuality = {
      score: 0,
      sampledArtists: 0,
      overlapCount: 0,
      endpointSupported: false,
    }
  }

  return {
    genreAffinities,
    artistAffinities,
    neighborhoodQuality,
    warnings,
  }
}
