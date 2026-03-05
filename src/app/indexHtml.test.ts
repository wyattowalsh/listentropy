import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('index.html branding', () => {
  it('uses the Listentropy favicon asset instead of Vite default', () => {
    const source = readFileSync('index.html', 'utf8')
    expect(source).toContain('rel="icon"')
    expect(source).toContain('/listentropy-logo.svg')
    expect(source).not.toContain('/vite.svg')
  })
})
