function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function getCrypto(): Crypto {
  if (typeof globalThis.crypto === 'undefined') {
    throw new Error('Web Crypto is unavailable in this environment')
  }
  return globalThis.crypto
}

export function createRandomPkceVerifier(length = 64): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const crypto = getCrypto()
  const values = new Uint8Array(length)
  crypto.getRandomValues(values)
  let output = ''
  for (let index = 0; index < length; index += 1) {
    output += chars[values[index] % chars.length]
  }
  return output
}

export async function createPkceChallenge(codeVerifier: string): Promise<string> {
  const crypto = getCrypto()
  if (!crypto.subtle) {
    throw new Error('Web Crypto subtle API is unavailable in this environment')
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return base64UrlEncode(new Uint8Array(digest))
}

export function createOAuthState(length = 32): string {
  return createRandomPkceVerifier(length)
}
