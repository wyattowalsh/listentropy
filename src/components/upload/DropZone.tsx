import { AlertTriangle, CheckCircle2, Sparkles, UploadCloud } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import JSZip from 'jszip'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
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
  demoZipPath?: string
}

const DEMO_CHUNK_SIZE = 20_000

function readDemoRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }
  if (payload && typeof payload === 'object' && Array.isArray((payload as { records?: unknown[] }).records)) {
    return (payload as { records: unknown[] }).records
  }
  throw new Error('Failed to parse demo history JSON payload.')
}

async function buildDemoArchive(records: unknown[]): Promise<File> {
  const zip = new JSZip()
  const chunkCount = Math.max(1, Math.ceil(records.length / DEMO_CHUNK_SIZE))
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const start = chunkIndex * DEMO_CHUNK_SIZE
    const chunk = records.slice(start, start + DEMO_CHUNK_SIZE)
    zip.file(
      `Spotify Extended Streaming History/Streaming_History_Audio_2018-2024_${chunkIndex}.json`,
      JSON.stringify(chunk),
    )
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], 'my_spotify_data.zip', { type: 'application/zip' })
}

export function DropZone({ onFileSelected, demoZipPath }: DropZoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const latestSelectionIdRef = useRef(0)
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
  const [celebration, setCelebration] = useState<{
    fileName: string
    historyFileCount: number
  } | null>(null)

  const selectFile = useCallback(
    async (file: File) => {
      const selectionId = (latestSelectionIdRef.current += 1)
      setCelebration(null)
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
        if (latestSelectionIdRef.current !== selectionId) {
          return
        }
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
        if (latestSelectionIdRef.current !== selectionId) {
          return
        }
        setCelebration({
          fileName: file.name,
          historyFileCount: inspection.historyFileCount,
        })
        onFileSelected(file, { inspection, preparedArchive })
        return
      } catch (error) {
        if (latestSelectionIdRef.current !== selectionId) {
          return
        }
        setPreflight({
          name: file.name,
          sizeBytes: file.size,
          historyFileCount: null,
          historyFiles: [],
          totalEntries: null,
          error: normalizeUploadError(error),
        })
        setCelebration(null)
        return
      } finally {
        if (latestSelectionIdRef.current === selectionId) {
          setIsInspecting(false)
        }
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

  const loadDemoData = useCallback(async () => {
    if (!demoZipPath) {
      return
    }
    const response = await fetch(demoZipPath)
    if (!response.ok) {
      throw new Error(`Failed to fetch demo archive (${response.status})`)
    }
    const records = readDemoRecords(await response.json())
    const file = await buildDemoArchive(records)
    await selectFile(file)
  }, [demoZipPath, selectFile])

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
        Request your data from{' '}
        <a
          href="https://spotify.com/account/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-text underline decoration-dotted underline-offset-2 transition-colors hover:text-accent"
        >
          Spotify account privacy settings
        </a>
        , then upload the original zip. Your data stays in this browser and never leaves your device.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Tooltip content="Upload stays local and never leaves your browser.">
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isInspecting}
          >
            {isInspecting ? 'Inspecting zip...' : 'Choose File'}
          </Button>
        </Tooltip>
        {demoZipPath ? (
          <Tooltip content="Try a safe sample archive preloaded with synthetic listening history.">
            <Button
              type="button"
              variant="outline"
              disabled={isInspecting}
              onClick={() => {
                void loadDemoData().catch((error) => {
                  setCelebration(null)
                  setPreflight({
                    name: 'my_spotify_data.zip',
                    sizeBytes: 0,
                    historyFileCount: null,
                    historyFiles: [],
                    totalEntries: null,
                    error: normalizeUploadError(error),
                  })
                })
              }}
            >
              Use Demo Data
            </Button>
          </Tooltip>
        ) : null}
      </div>
      {celebration ? (
        <div
          role="status"
          aria-live="polite"
          className="celebrate-in mt-4 w-full max-w-xl rounded-theme border border-positive/40 bg-positive/10 p-3 text-left text-xs text-positive"
        >
          <p className="inline-flex items-center gap-1.5 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Upload verified
            <Sparkles className="h-3.5 w-3.5 motion-safe:animate-pulse" />
          </p>
          <p className="mt-1 text-positive/90">
            {celebration.fileName} includes {celebration.historyFileCount} history file
            {celebration.historyFileCount === 1 ? '' : 's'} — launching local processing.
          </p>
        </div>
      ) : null}
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
          {preflight.error ? (
            <div className="mt-2 rounded-theme border border-negative/40 bg-negative/10 p-2">
              <p className="inline-flex items-center gap-1.5 font-semibold text-negative">
                <AlertTriangle className="h-3.5 w-3.5" />
                {/No Spotify Extended Streaming History files were found/i.test(preflight.error)
                  ? 'We couldn\'t find Spotify streaming history files.'
                  : 'Preflight needs attention.'}
              </p>
              <p className="mt-1 text-negative">{preflight.error}</p>
              {/No Spotify Extended Streaming History files were found/i.test(preflight.error) ? (
                <p className="mt-1 text-negative/90">
                  Request a new export from{' '}
                  <a
                    href="https://spotify.com/account/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline decoration-dotted underline-offset-2"
                  >
                    Spotify account privacy settings
                  </a>
                  , then upload the original zip.
                </p>
              ) : null}
            </div>
          ) : null}
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
