import { describe, expect, it } from 'vitest'

import { normalizePlatform } from './platform'

describe('normalizePlatform', () => {
  it('maps iOS signatures', () => {
    expect(normalizePlatform('iOS 17.2 (iPhone15,2)')).toBe('iOS')
    expect(normalizePlatform('ipad os 17')).toBe('iOS')
    expect(normalizePlatform('ios')).toBe('iOS')
  })

  it('maps macOS signatures', () => {
    expect(normalizePlatform('web_player osx 12')).toBe('macOS')
    expect(normalizePlatform('macOS')).toBe('macOS')
  })

  it('maps smart tv and cast signatures', () => {
    expect(normalizePlatform('Partner google cast_tv;Chromecast')).toBe(
      'Smart TV / Cast',
    )
    expect(normalizePlatform('tizen')).toBe('Smart TV / Cast')
  })

  it('falls back to Other', () => {
    expect(normalizePlatform('car thing prototype')).toBe('Other')
  })
})
