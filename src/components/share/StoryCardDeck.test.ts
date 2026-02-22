import { describe, expect, it } from 'vitest'

import { STORY_CARD_ORDER } from './story-card-order'

describe('StoryCardDeck order', () => {
  it('keeps deterministic 14-card ordering', () => {
    const order = STORY_CARD_ORDER
    expect(order).toHaveLength(14)
    expect(order).toEqual([
      'title',
      'top-artists',
      'top-tracks',
      'clock',
      'streak',
      'guilty-pleasures',
      'forgotten-gem',
      'archetype',
      'numbers',
      'fingerprint',
      'travel-footprint',
      'intent-signature',
      'device-journey',
      'offline-private',
    ])
  })
})
