import { UploadCloud } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  prepareSpotifyZipArchive,
  type PreparedSpotifyZipArchive,
  type ZipInspectionResult,
} from '@/lib/data/parser'
import { normalizeUploadError } from '@/lib/data/upload-errors'
import { cn } from '@/lib/utils'

interface ZipUploadPreflightContext {
  inspection: ZipInspectionResult
  preparedArchive: PreparedSpotifyZipArchive
}

interface DropZoneProps {
  onFileSelected: (file: File, preflight?: ZipUploadPreflightContext) => void
}

export function DropZone({ onFileSelected }: DropZoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isInspecting, setIsInspecting] = useState(false)
  const [preflight, setPreflight] = useState<{
    name: string
    sizeBytes: number
    historyFileCount: number | null
    historyFiles: string[]
    totalEntries: number | null
    error: string | null
  } | null>(null)

  const selectFile = useCallback(
    async (file: File) => {
      setPreflight({
        name: file.name,
        sizeBytes: file.size,
        historyFileCount: null,
        historyFiles: [],
        totalEntries: null,
        error: null,
      })
      setIsInspecting(true)
      try {
        const preparedArchive = await prepareSpotifyZipArchive(file)
        const inspection = preparedArchive.inspection
        const missingHistoryFiles = inspection.historyFileCount === 0
        setPreflight({
          name: file.name,
          sizeBytes: file.size,
          historyFileCount: inspection.historyFileCount,
          historyFiles: inspection.historyFiles.slice(0, 4),
          totalEntries: inspection.totalEntries,
          error: missingHistoryFiles
            ? normalizeUploadError('No Spotify streaming history files detected in the archive.')
            : null,
        })
        if (missingHistoryFiles) {
          return
        }
        onFileSelected(file, { inspection, preparedArchive })
        return
      } catch (error) {
        setPreflight({
          name: file.name,
          sizeBytes: file.size,
          historyFileCount: null,
          historyFiles: [],
          totalEntries: null,
          error: normalizeUploadError(error),
        })
        return
      } finally {
        setIsInspecting(false)
      }
    },
    [onFileSelected],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragging(false)
      const file = event.dataTransfer.files[0]
      if (file) {
        void selectFile(file)
      }
    },
    [selectFile],
  )

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'group flex min-h-[260px] flex-col items-center justify-center rounded-theme border-2 border-dashed p-8 text-center transition-colors',
        isDragging ? 'border-accent bg-surface-hover' : 'border-border bg-surface',
      )}
    >
      <UploadCloud className="mb-4 h-12 w-12 text-accent" />
      <h2 className="font-heading text-2xl text-text">Drop your Spotify data export (.zip)</h2>
      <p className="mt-3 max-w-xl text-sm text-text-muted">
        Request your data from Spotify account privacy settings, then upload the original zip.
        Your data stays in this browser.
      </p>
      <div className="mt-4">
        <Button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isInspecting}
        >
          {isInspecting ? 'Inspecting zip...' : 'Choose File'}
        </Button>
      </div>
      {preflight ? (
        <div className="mt-4 w-full max-w-xl rounded-theme border border-border bg-surface-hover p-3 text-left text-xs text-text-muted">
          <p className="font-semibold text-text">Preflight</p>
          <p className="mt-1">
            {preflight.name} · {(preflight.sizeBytes / 1024 / 1024).toFixed(2)} MB
          </p>
          <p className="mt-1">
            {preflight.historyFileCount === null ? 'Inspecting archive entries…' : `${preflight.historyFileCount} history files detected`}
            {preflight.totalEntries !== null ? ` · ${preflight.totalEntries} total entries` : ''}
          </p>
          {preflight.historyFiles.length > 0 ? (
            <ul className="mt-2 list-disc pl-4">
              {preflight.historyFiles.map((file) => (
                <li key={file} className="truncate">
                  {file}
                </li>
              ))}
            </ul>
          ) : null}
          {preflight.error ? <p className="mt-2 text-negative">{preflight.error}</p> : null}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".zip,application/zip,application/x-zip-compressed"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void selectFile(file)
          }
          event.currentTarget.value = ''
        }}
      />
    </div>
  )
}
