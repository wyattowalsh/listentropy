import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TabNav } from './TabNav'

describe('TabNav', () => {
  it('keeps the tab accessible name stable and exposes metadata as description', () => {
    render(
      <TabNav
        value="overview"
        onChange={vi.fn()}
        metadata={{
          artist: {
            badge: 'Artist 7',
            detail: 'search + trend deep dive',
          },
        }}
      />,
    )

    const artistTab = screen.getByRole('tab', { name: /^Artist$/ })
    expect(artistTab).toBeVisible()
    expect(artistTab).toHaveAccessibleName('Artist')
    expect(artistTab).toHaveAccessibleDescription(/Artist 7/)
    expect(artistTab).toHaveAccessibleDescription(/search \+ trend deep dive/i)
  })
})
