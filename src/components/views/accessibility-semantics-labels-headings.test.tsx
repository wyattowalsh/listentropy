import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { GraphControls } from '@/components/graph/GraphControls'
import { CardTitle } from '@/components/ui/card'
import { ArtistDeepDive } from '@/components/views/ArtistDeepDive'
import { PluginExtras } from '@/components/views/PluginExtras'
import { ShareStudio } from '@/components/views/ShareStudio'
import { TopCharts } from '@/components/views/TopCharts'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getTotalSize: () => 0,
    getVirtualItems: () => [],
  }),
}))

vi.mock('recharts', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    Bar: Wrapper,
    BarChart: Wrapper,
    CartesianGrid: Wrapper,
    Line: Wrapper,
    LineChart: Wrapper,
    Tooltip: Wrapper,
    XAxis: Wrapper,
    YAxis: Wrapper,
  }
})

vi.mock('@/components/charts/ChartContainer', () => ({
  ChartContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/share/ExportButton', () => ({
  ExportButton: () => <button type="button">Export</button>,
}))

vi.mock('@/components/share/ShareLinkGenerator', () => ({
  ShareLinkGenerator: () => <div>ShareLinkGenerator</div>,
}))

vi.mock('@/components/share/ShareTextCopy', () => ({
  ShareTextCopy: () => <div>ShareTextCopy</div>,
}))

vi.mock('@/components/share/StoryCardDeck', () => ({
  StoryCardDeck: () => <div>StoryCardDeck</div>,
}))

const data = processRecords(makeSyntheticRecords(24), { timezoneMode: 'local' })
const suggestedArtistName = [...data.artists].sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name))[0]?.name ?? ''

describe('a11y semantics labels and headings', () => {
  it('adds an explicit label to the TopCharts search input', () => {
    render(<TopCharts data={data} />)

    expect(screen.getByRole('textbox', { name: /search leaderboard/i })).toBeInTheDocument()
  })

  it('adds an explicit label to the ArtistDeepDive search input', () => {
    render(<ArtistDeepDive data={data} />)

    expect(screen.getByRole('textbox', { name: /search artist/i })).toBeInTheDocument()
  })

  it('shows deterministic recovery guidance when artist search has no result', async () => {
    const user = userEvent.setup()
    render(<ArtistDeepDive data={data} />)

    await user.clear(screen.getByRole('textbox', { name: /search artist/i }))
    await user.type(screen.getByRole('textbox', { name: /search artist/i }), 'z')

    expect(screen.getByText(/no artist matched “z”/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Try top artist: ${suggestedArtistName}` })).toBeInTheDocument()
  })

  it('recovers from no-result state via clear search action', async () => {
    const user = userEvent.setup()
    render(<ArtistDeepDive data={data} />)

    await user.clear(screen.getByRole('textbox', { name: /search artist/i }))
    await user.type(screen.getByRole('textbox', { name: /search artist/i }), 'z')
    await user.click(screen.getByRole('button', { name: /clear search/i }))

    expect(screen.getByRole('textbox', { name: /search artist/i })).toHaveValue('')
    expect(screen.queryByText(/no artist matched/i)).not.toBeInTheDocument()
    expect(screen.getByText('Selected Artist')).toBeInTheDocument()
  })

  it('recovers from no-result state via top-artist suggestion', async () => {
    const user = userEvent.setup()
    render(<ArtistDeepDive data={data} />)

    await user.clear(screen.getByRole('textbox', { name: /search artist/i }))
    await user.type(screen.getByRole('textbox', { name: /search artist/i }), 'z')
    await user.click(screen.getByRole('button', { name: `Try top artist: ${suggestedArtistName}` }))

    expect(screen.getByRole('textbox', { name: /search artist/i })).toHaveValue(suggestedArtistName)
    expect(screen.queryByText(/no artist matched/i)).not.toBeInTheDocument()
  })

  it('adds an explicit label to the PluginExtras filter input', () => {
    render(<PluginExtras data={data} />)

    expect(screen.getByRole('textbox', { name: /filter plugins/i })).toBeInTheDocument()
  })

  it('adds explicit labels and semantic heading levels in ShareStudio', async () => {
    const user = userEvent.setup()
    render(<ShareStudio data={data} />)

    await user.click(screen.getByRole('button', { name: /show deck presentation options/i }))
    expect(screen.getByRole('textbox', { name: /display name/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /share studio/i })).toBeInTheDocument()
  })

  it('adds an explicit label to the graph search input', () => {
    render(
      <GraphControls
        mode="2d"
        onModeChange={vi.fn()}
        maxNodes={200}
        onMaxNodesChange={vi.fn()}
        maxEdges={100}
        onMaxEdgesChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        showContainsEdges
        showCoListenEdges
        onShowContainsEdgesChange={vi.fn()}
        onShowCoListenEdgesChange={vi.fn()}
        webglSupported
        onResetCamera={vi.fn()}
        onRetry3D={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox', { name: /search artist or track in graph/i })).toBeInTheDocument()
  })

  it('lets CardTitle render as a caller-defined semantic heading level', () => {
    render(<CardTitle {...({ as: 'h2' } as any)}>Semantic Card Heading</CardTitle>)

    expect(screen.getByRole('heading', { level: 2, name: /semantic card heading/i })).toBeInTheDocument()
  })
})
