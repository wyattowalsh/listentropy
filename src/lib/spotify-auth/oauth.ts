import type { SpotifyAuthSession, SpotifyTokenSource } from '@/lib/types'

export interface SpotifyPkceConfig {
  clientId: string
  redirectUri: string
}

interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  scope?: string
  expires_in: number
  refresh_token?: string
}

export interface SpotifyAuthCallbackParams {
  code?: string
  state?: string
  error?: string
}

const SPOTIFY_AUTHORIZE_ENDPOINT = 'https://accounts.spotify.com/authorize'
const SPOTIFY_TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token'

function joinBaseUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return new URL(path.replace(/^\//, ''), `${window.location.origin}${normalizedBase}`).toString()
}

export function getSpotifyPkceConfig(): SpotifyPkceConfig {
  const clientId = (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined)?.trim() ?? ''
  const redirectUri = ((import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined)?.trim() || joinBaseUrl('/auth/spotify/callback'))
  return { clientId, redirectUri }
}

export function buildSpotifyAuthorizeUrl(args: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  scopes?: string[]
}): string {
  const url = new URL(SPOTIFY_AUTHORIZE_ENDPOINT)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', args.clientId)
  url.searchParams.set('redirect_uri', args.redirectUri)
  url.searchParams.set('state', args.state)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', args.codeChallenge)
  if (args.scopes && args.scopes.length > 0) {
    url.searchParams.set('scope', args.scopes.join(' '))
  }
  return url.toString()
}

function sessionFromTokenResponse(
  payload: SpotifyTokenResponse,
  tokenSource: SpotifyTokenSource,
): SpotifyAuthSession {
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + Math.max(30, payload.expires_in) * 1000,
    tokenSource,
    scopes: (payload.scope ?? '').split(' ').filter(Boolean),
    grantedAt: new Date().toISOString(),
  }
}

async function postSpotifyToken(body: URLSearchParams): Promise<SpotifyTokenResponse> {
  const response = await fetch(SPOTIFY_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) {
    throw new Error(`Spotify token request failed with ${response.status}`)
  }
  return (await response.json()) as SpotifyTokenResponse
}

export async function exchangeSpotifyPkceCode(args: {
  code: string
  codeVerifier: string
  clientId: string
  redirectUri: string
}): Promise<SpotifyAuthSession> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: args.clientId,
    code_verifier: args.codeVerifier,
  })
  const payload = await postSpotifyToken(body)
  return sessionFromTokenResponse(payload, 'pkce')
}

export async function refreshSpotifyPkceSession(args: {
  refreshToken: string
  clientId: string
}): Promise<SpotifyAuthSession> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: args.refreshToken,
    client_id: args.clientId,
  })
  const payload = await postSpotifyToken(body)
  return sessionFromTokenResponse(payload, 'pkce')
}

export function parseSpotifyAuthCallbackParams(urlString?: string): SpotifyAuthCallbackParams {
  const url = new URL(urlString ?? window.location.href)
  return {
    code: url.searchParams.get('code') ?? undefined,
    state: url.searchParams.get('state') ?? undefined,
    error: url.searchParams.get('error') ?? undefined,
  }
}

export function clearSpotifyAuthCallbackParamsFromUrl(): void {
  if (typeof window === 'undefined') {
    return
  }
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  url.searchParams.delete('error')
  window.history.replaceState({}, document.title, url.toString())
}
