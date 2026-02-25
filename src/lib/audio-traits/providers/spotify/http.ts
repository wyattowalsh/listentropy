export class SpotifyApiHttpError extends Error {
  readonly status: number
  readonly endpoint: string
  readonly url: string
  readonly retryAfterSeconds?: number

  constructor(args: {
    status: number
    endpoint: string
    url: string
    retryAfterSeconds?: number
  }) {
    const retrySuffix = args.retryAfterSeconds !== undefined ? ` (Retry-After ${args.retryAfterSeconds}s)` : ''
    super(`Spotify API ${args.endpoint} request failed with ${args.status}${retrySuffix}`)
    this.name = 'SpotifyApiHttpError'
    this.status = args.status
    this.endpoint = args.endpoint
    this.url = args.url
    this.retryAfterSeconds = args.retryAfterSeconds
  }
}

function parseRetryAfterSeconds(headers: Headers | { get(name: string): string | null }): number | undefined {
  const raw = headers.get('Retry-After')
  if (!raw) {
    return undefined
  }
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function spotifyGetJson<T>(args: {
  accessToken: string
  url: string
  endpoint: string
}): Promise<T> {
  const response = await fetch(args.url, {
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
    },
  })
  if (!response.ok) {
    throw new SpotifyApiHttpError({
      status: response.status,
      endpoint: args.endpoint,
      url: args.url,
      retryAfterSeconds: parseRetryAfterSeconds(response.headers),
    })
  }
  return (await response.json()) as T
}
