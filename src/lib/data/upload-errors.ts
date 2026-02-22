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

  const malformedJsonMatch = message.match(/Failed to parse JSON in (.+)$/i)
  if (malformedJsonMatch?.[1]) {
    return `A Spotify history file in this zip appears corrupted (${malformedJsonMatch[1]}). Please re-download your Spotify export and try again.`
  }

  return 'We could not process that upload. Check that you selected the original Spotify Extended Streaming History zip file and try again.'
}

