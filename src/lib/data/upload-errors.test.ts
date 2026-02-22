import { describe, expect, it } from 'vitest'

import { normalizeUploadError } from './upload-errors'

describe('normalizeUploadError', () => {
  it('normalizes invalid zip parser errors', () => {
    expect(
      normalizeUploadError(new Error("Can't find end of central directory : is this a zip file ?")),
    ).toMatch(/valid \.zip archive/i)
  })

  it('normalizes missing spotify history files', () => {
    expect(
      normalizeUploadError('No Extended Streaming History files found.'),
    ).toMatch(/Extended Streaming History/i)
  })

  it('normalizes malformed history json errors with file name context', () => {
    const message = normalizeUploadError(
      'Failed to parse JSON in Streaming_History_Audio_2024-2025_0.json',
    )
    expect(message).toContain('Streaming_History_Audio_2024-2025_0.json')
    expect(message).toMatch(/re-download/i)
  })
})

