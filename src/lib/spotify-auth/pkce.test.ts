import { describe, expect, it } from 'vitest'

import { createOAuthState, createPkceChallenge, createRandomPkceVerifier } from '@/lib/spotify-auth/pkce'

describe('spotify pkce utils', () => {
  it('creates PKCE verifier with RFC-safe characters', () => {
    const verifier = createRandomPkceVerifier(64)
    expect(verifier).toHaveLength(64)
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it('creates OAuth state token', () => {
    const state = createOAuthState(32)
    expect(state).toHaveLength(32)
    expect(state).toMatch(/^[A-Za-z0-9\-._~]+$/)
  })

  it('creates deterministic challenge for a given verifier', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    const challenge = await createPkceChallenge(verifier)
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })
})
