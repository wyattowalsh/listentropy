import { fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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
})
