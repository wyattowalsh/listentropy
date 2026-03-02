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
    return 'This file could not be read as a valid .zip archive. Upload the original Spotify Extended Streaming History zip file.'
  }

  if (
    /no extended streaming history files found|no spotify streaming history files detected in the archive/i.test(
      message,
    )
  ) {
    return 'No Spotify Extended Streaming History files were found in this archive. Request the Extended Streaming History export from Spotify and upload the original zip.'
  }

  if (/upload zip is too large/i.test(message)) {
    return 'This zip is too large to process safely in-browser. Upload a smaller Extended Streaming History archive.'
  }

  if (/too many entries/i.test(message)) {
    return 'This zip contains too many files to inspect safely. Upload the original Spotify history zip without extra files.'
  }

  if (/uncompressed history entry is too large|uncompressed history payload is too large/i.test(message)) {
    return 'A history file expands beyond the safe in-browser parsing limit. Re-download your Spotify export and try again.'
  }

  if (/too many records/i.test(message)) {
    return 'This archive contains more history records than the in-browser safety limit allows.'
  }

  const malformedJsonMatch = message.match(/Failed to parse JSON in (.+)$/i)
  if (malformedJsonMatch?.[1]) {
    return `A Spotify history file in this zip appears corrupted (${malformedJsonMatch[1]}). Please re-download your Spotify export and try again.`
  }

  return 'We could not process that upload. Check that you selected the original Spotify Extended Streaming History zip file and try again.'
}
