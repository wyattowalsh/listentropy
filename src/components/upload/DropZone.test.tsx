import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { PreparedSpotifyZipArchive } from '@/lib/data/parser'
import type * as ParserModule from '@/lib/data/parser'
import { DropZone } from './DropZone'

const prepareSpotifyZipArchiveMock = vi.fn()

vi.mock('@/lib/data/parser', async () => {
  const actual = await vi.importActual<typeof ParserModule>('@/lib/data/parser')
  return {
    ...actual,
    prepareSpotifyZipArchive: (...args: unknown[]) => prepareSpotifyZipArchiveMock(...args),
  }
})

function makeDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function makePreparedArchive(label: string): PreparedSpotifyZipArchive {
  return {
    zip: {} as PreparedSpotifyZipArchive['zip'],
    entries: [] as PreparedSpotifyZipArchive['entries'],
    historyEntries: [] as PreparedSpotifyZipArchive['historyEntries'],
    inspection: {
      totalEntries: 1,
      historyFileCount: 1,
      historyFiles: [`Streaming_History_Audio_${label}.json`],
    },
  }
}

describe('DropZone', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders Spotify privacy guidance as a safe external link', () => {
    render(<DropZone onFileSelected={vi.fn()} />)

    const privacyLink = screen.getByRole('link', { name: /spotify account privacy settings/i })
    expect(privacyLink).toHaveAttribute('href', 'https://spotify.com/account/privacy')
    expect(privacyLink).toHaveAttribute('target', '_blank')
    expect(privacyLink).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(privacyLink).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
  })

  it('loads the demo zip from the configured default path', async () => {
    prepareSpotifyZipArchiveMock.mockReset().mockResolvedValue(makePreparedArchive('demo'))
    const demoRecords = [
      { ts: '2024-01-01T00:00:00.000Z', ms_played: 120000, master_metadata_track_name: 'Track A' },
      { ts: '2024-01-01T01:00:00.000Z', ms_played: 180000, master_metadata_track_name: 'Track B' },
    ]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(demoRecords),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onFileSelected = vi.fn()
    render(
      <DropZone
        onFileSelected={onFileSelected}
        demoZipPath="/demo-history-large.json"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /use demo data/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/demo-history-large.json')
      expect(onFileSelected).toHaveBeenCalledTimes(1)
    })
    const uploadedFile = onFileSelected.mock.calls[0]?.[0] as File
    expect(uploadedFile).toBeInstanceOf(File)
    expect(uploadedFile.name).toBe('my_spotify_data.zip')
    expect(uploadedFile.type).toBe('application/zip')

    const zip = await JSZip.loadAsync(uploadedFile)
    const historyFiles = Object.keys(zip.files).filter((name) =>
      /^Spotify Extended Streaming History\/Streaming_History_Audio_.*\.json$/i.test(name),
    )
    expect(historyFiles.length).toBeGreaterThan(0)

    const firstHistoryFile = historyFiles[0]
    if (!firstHistoryFile) {
      throw new Error('Expected at least one Spotify history file in demo archive.')
    }
    const payload = JSON.parse(await zip.file(firstHistoryFile)!.async('string'))
    expect(payload).toEqual(demoRecords)
  })

  it('ignores stale async preflight results from an earlier file selection', async () => {
    const first = makeDeferred<PreparedSpotifyZipArchive>()
    const second = makeDeferred<PreparedSpotifyZipArchive>()
    prepareSpotifyZipArchiveMock
      .mockReset()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const onFileSelected = vi.fn()
    const { container } = render(<DropZone onFileSelected={onFileSelected} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const firstFile = new File(['first'], 'first.zip', { type: 'application/zip' })
    const secondFile = new File(['second'], 'second.zip', { type: 'application/zip' })

    fireEvent.change(input, { target: { files: [firstFile] } })
    fireEvent.change(input, { target: { files: [secondFile] } })

    second.resolve(makePreparedArchive('second'))
    await waitFor(() => expect(onFileSelected).toHaveBeenCalledTimes(1))
    expect(onFileSelected.mock.calls[0]?.[0]).toBe(secondFile)

    first.resolve(makePreparedArchive('first'))
    await Promise.resolve()

    expect(onFileSelected).toHaveBeenCalledTimes(1)
  })

  it('shows an action-oriented preflight error when archive has no history files', async () => {
    prepareSpotifyZipArchiveMock.mockReset().mockResolvedValue({
      zip: {} as PreparedSpotifyZipArchive['zip'],
      entries: [] as PreparedSpotifyZipArchive['entries'],
      historyEntries: [] as PreparedSpotifyZipArchive['historyEntries'],
      inspection: {
        totalEntries: 4,
        historyFileCount: 0,
        historyFiles: [],
      },
    } satisfies PreparedSpotifyZipArchive)

    const onFileSelected = vi.fn()
    const { container } = render(<DropZone onFileSelected={onFileSelected} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'missing-history.zip', { type: 'application/zip' })] } })

    await waitFor(() => {
      expect(screen.getByText(/we couldn['’]t find spotify streaming history files/i)).toBeInTheDocument()
    })
    expect(screen.getAllByText(/request a new export from/i)).toHaveLength(2)
    const privacyLinks = screen.getAllByRole('link', { name: /spotify account privacy settings/i })
    expect(privacyLinks).toHaveLength(2)
    for (const link of privacyLinks) {
      expect(link).toHaveAttribute('href', 'https://spotify.com/account/privacy')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
    }
    expect(onFileSelected).not.toHaveBeenCalled()
  })

  it('shows celebratory upload feedback after a valid zip preflight', async () => {
    prepareSpotifyZipArchiveMock.mockReset().mockResolvedValue(makePreparedArchive('celebration'))

    const onFileSelected = vi.fn()
    const { container } = render(<DropZone onFileSelected={onFileSelected} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File(['x'], 'valid.zip', { type: 'application/zip' })] } })

    await waitFor(() => expect(onFileSelected).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('status')).toHaveTextContent(/upload verified/i)
  })
})
