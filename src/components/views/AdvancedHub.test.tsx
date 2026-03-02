import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AdvancedHub } from '@/components/views/AdvancedHub'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'

vi.mock('@/components/views/LabWorkbench', () => ({
  LabWorkbench: () => <div>LabWorkbench Mock</div>,
}))

vi.mock('@/components/views/MusicUniverse', () => ({
  MusicUniverse: () => <div>MusicUniverse Mock</div>,
}))

vi.mock('@/components/views/ArtistDeepDive', () => ({
  ArtistDeepDive: () => <div>ArtistDeepDive Mock</div>,
}))

vi.mock('@/components/views/PluginExtras', () => ({
  PluginExtras: () => <div>PluginExtras Mock</div>,
}))

const data = processRecords(makeSyntheticRecords(80), { timezoneMode: 'local' })

describe('AdvancedHub', () => {
  it('defaults to Lab section and switches sections via select', async () => {
    const user = userEvent.setup()

    render(<AdvancedHub data={data} />)

    expect(screen.getByRole('heading', { name: 'Advanced' })).toBeInTheDocument()
    expect(screen.getByText('LabWorkbench Mock')).toBeInTheDocument()
    expect(screen.queryByText('MusicUniverse Mock')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Advanced section'), 'network')
    expect(screen.getByText('MusicUniverse Mock')).toBeInTheDocument()
    expect(screen.queryByText('LabWorkbench Mock')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Advanced section'), 'plugins')
    expect(screen.getByText('PluginExtras Mock')).toBeInTheDocument()
    expect(screen.queryByText('MusicUniverse Mock')).not.toBeInTheDocument()
  })
})
