import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { EraTimelineBand } from '@/components/charts/EraTimelineBand'
import type { EraData } from '@/lib/types'

const eras: EraData[] = [
  {
    id: 'era-1',
    label: 'Era One',
    startMonth: '2024-01',
    endMonth: '2024-03',
    dominantArtists: ['Artist One'],
    totalMs: 1000,
    confidence: 0.8,
    durationMonths: 3,
    dominanceScore: 0.5,
    diversityScore: 0.5,
    changeDrivers: [],
  },
]

describe('EraTimelineBand', () => {
  it('exposes each era segment as an interactive button', async () => {
    const onSelectEra = vi.fn()
    const user = userEvent.setup()

    render(<EraTimelineBand eras={eras} activeEraId="era-1" onSelectEra={onSelectEra} />)

    const eraButton = screen.getByRole('button', { name: /era one/i })
    await user.click(eraButton)

    expect(onSelectEra).toHaveBeenCalledWith('era-1')
  })
})
