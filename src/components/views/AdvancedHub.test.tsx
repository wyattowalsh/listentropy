import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AdvancedHub } from '@/components/views/AdvancedHub'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'

vi.mock('@/components/views/LabWorkbench', () => ({
  LabWorkbench: ({ analysisMode }: { analysisMode?: string }) => <div>LabWorkbench Mock ({analysisMode ?? 'none'})</div>,
}))

vi.mock('@/components/views/MusicUniverse', () => ({
  MusicUniverse: ({ analysisMode }: { analysisMode?: string }) => <div>MusicUniverse Mock ({analysisMode ?? 'none'})</div>,
}))

vi.mock('@/components/views/ArtistDeepDive', () => ({
  ArtistDeepDive: ({ analysisMode }: { analysisMode?: string }) => <div>ArtistDeepDive Mock ({analysisMode ?? 'none'})</div>,
}))

vi.mock('@/components/views/PluginExtras', () => ({
  PluginExtras: ({ analysisMode }: { analysisMode?: string }) => <div>PluginExtras Mock ({analysisMode ?? 'none'})</div>,
}))

const data = processRecords(makeSyntheticRecords(80), { timezoneMode: 'local' })

describe('AdvancedHub', () => {
  it('defaults to Lab section and switches sections via select', async () => {
    const user = userEvent.setup()

    render(<AdvancedHub data={data} />)

    expect(screen.getByRole('heading', { name: 'Advanced' })).toBeInTheDocument()
    expect(screen.getByText('LabWorkbench Mock (simple)')).toBeInTheDocument()
    expect(screen.queryByText('MusicUniverse Mock')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simple' })).toHaveAttribute('aria-pressed', 'true')

    await user.selectOptions(screen.getByLabelText('Advanced section'), 'network')
    expect(screen.getByText('MusicUniverse Mock (simple)')).toBeInTheDocument()
    expect(screen.queryByText('LabWorkbench Mock')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Deep' }))
    expect(screen.getByText('MusicUniverse Mock (deep)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deep' })).toHaveAttribute('aria-pressed', 'true')

    await user.selectOptions(screen.getByLabelText('Advanced section'), 'plugins')
    expect(screen.getByText('PluginExtras Mock (deep)')).toBeInTheDocument()
    expect(screen.queryByText('MusicUniverse Mock')).not.toBeInTheDocument()
  })
})
