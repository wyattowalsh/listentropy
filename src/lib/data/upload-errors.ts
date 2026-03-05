function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown upload error.'
}

export function normalizeUploadError(error: unknown): string {
  const message = getErrorMessage(error).trim()

  if (
    /end of central directory|not a zip file|invalid zip|corrupted zip|can't find end of central directory/i.test(
      message,
    )
  ) {
    return 'Invalid .zip archive. Upload the original Spotify Extended Streaming History zip.'
  }

  if (
    /no extended streaming history files found|no spotify streaming history files detected in the archive/i.test(
      message,
    )
  ) {
    return 'No Spotify Extended Streaming History files were found. Request a new export from Spotify account privacy settings, then upload the original zip.'
  }

  if (/upload zip is too large/i.test(message)) {
    return 'This zip is too large for in-browser processing. Upload a smaller Extended Streaming History zip.'
  }

  if (/too many entries/i.test(message)) {
    return 'This zip has too many files for safe inspection. Upload the original Spotify history zip only.'
  }

  if (/uncompressed history entry is too large|uncompressed history payload is too large/i.test(message)) {
    return 'A history file is too large after unzip. Re-download your Spotify export and try again.'
  }

  if (/too many records/i.test(message)) {
    return 'This archive contains more history records than the in-browser safety limit allows.'
  }

  const malformedJsonMatch = message.match(/Failed to parse JSON in (.+)$/i)
  if (malformedJsonMatch?.[1]) {
    return `A Spotify history file appears corrupted (${malformedJsonMatch[1]}). Re-download your Spotify export and try again.`
  }

  return 'Upload failed. Choose the original Spotify Extended Streaming History zip and try again.'
}
