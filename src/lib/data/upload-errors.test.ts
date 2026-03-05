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
    ).toBe(
      'No Spotify Extended Streaming History files were found. Request a new export from Spotify account privacy settings, then upload the original zip.',
    )
  })

  it('normalizes malformed history json errors with file name context', () => {
    const message = normalizeUploadError(
      'Failed to parse JSON in Streaming_History_Audio_2024-2025_0.json',
    )
    expect(message).toContain('Streaming_History_Audio_2024-2025_0.json')
    expect(message).toMatch(/re-download/i)
  })

  it('keeps fallback upload errors concise and actionable', () => {
    expect(normalizeUploadError('something else failed')).toBe(
      'Upload failed. Choose the original Spotify Extended Streaming History zip and try again.',
    )
  })
})
