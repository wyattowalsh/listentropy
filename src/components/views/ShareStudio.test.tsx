import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ShareStudio } from '@/components/views/ShareStudio'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { createEmptySessionMetrics } from '@/lib/metrics/session-metrics'
import { processRecords } from '@/lib/processor'

const recordBehavior = vi.fn()
const recordMetric = vi.fn()
const metrics = createEmptySessionMetrics()

vi.mock('@/components/share/ExportButton', () => ({
  ExportButton: () => <button type="button">ExportButton Mock</button>,
}))

vi.mock('@/components/share/ShareLinkGenerator', () => ({
  ShareLinkGenerator: () => <div>ShareLinkGenerator Mock</div>,
}))

vi.mock('@/components/share/ShareTextCopy', () => ({
  ShareTextCopy: () => <div>ShareTextCopy Mock</div>,
}))

vi.mock('@/components/share/StoryCardDeck', () => ({
  StoryCardDeck: () => <div>StoryCardDeck Mock</div>,
}))

vi.mock('@/store/useExperienceStore', () => ({
  useExperienceStore: (selector: (state: { recordBehavior: typeof recordBehavior }) => unknown) =>
    selector({ recordBehavior }),
}))

vi.mock('@/store/useSessionMetricsStore', async () => {
  const actual = await vi.importActual('@/store/useSessionMetricsStore')
  return {
    ...(actual as Record<string, unknown>),
    useSessionMetricsStore: (
      selector: (state: { metrics: typeof metrics; record: typeof recordMetric }) => unknown,
    ) => selector({ metrics, record: recordMetric }),
  }
})

const data = processRecords(makeSyntheticRecords(48), { timezoneMode: 'local' })

describe('ShareStudio', () => {
  beforeEach(() => {
    recordBehavior.mockReset()
    recordMetric.mockReset()
  })

  it('keeps the preset → deck → export path visible and hides advanced deck controls by default', () => {
    render(<ShareStudio data={data} />)

    expect(screen.getByText(/^step 1 · preset$/i)).toBeInTheDocument()
    expect(screen.getByText(/^step 2 · deck$/i)).toBeInTheDocument()
    expect(screen.getAllByText(/^step 3 · export & share$/i)).toHaveLength(2)
    expect(screen.getByRole('button', { name: /show deck presentation options/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByRole('textbox', { name: /display name/i })).not.toBeInTheDocument()
  })

  it('reveals secondary controls only when explicitly expanded', async () => {
    const user = userEvent.setup()

    render(<ShareStudio data={data} />)

    expect(screen.queryByRole('heading', { name: /copy text formats/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /session share funnel/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show deck presentation options/i }))
    expect(screen.getByRole('textbox', { name: /display name/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /show secondary tools/i }))
    expect(screen.getByRole('heading', { name: /copy text formats/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /session share funnel/i })).toBeInTheDocument()
  })
})
