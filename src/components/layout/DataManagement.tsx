import { useEffect, useState } from 'react'
import { Database, Trash2, Upload, Calendar, FileArchive } from 'lucide-react'
import { useDatasetStore, type Dataset } from '@/store/useDatasetStore'
import { useConsentStore } from '@/store/useConsentStore'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/button'

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleDateString()
}

function DatasetCard({ dataset, onDelete }: { dataset: Dataset; onDelete: (id: string) => void }): JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="rounded-theme border border-border/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <FileArchive className="h-3.5 w-3.5 text-accent" />
            <p className="truncate text-sm font-medium text-text">{dataset.name}</p>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
            <span>{dataset.recordCount.toLocaleString()} records</span>
            {dataset.fileSizeBytes && <span>{formatBytes(dataset.fileSizeBytes)}</span>}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(dataset.dateRange.start)} — {formatDate(dataset.dateRange.end)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium ${
              dataset.status === 'ready' ? 'bg-positive/10 text-positive' :
              dataset.status === 'error' ? 'bg-negative/10 text-negative' :
              'bg-accent/10 text-accent'
            }`}>
              {dataset.status}
            </span>
            <span className="text-text-muted">{dataset.source.replace('_', ' ')}</span>
          </div>
          {dataset.errorMessage && (
            <p className="mt-1 text-xs text-negative">{dataset.errorMessage}</p>
          )}
        </div>
        <div>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-theme p-1.5 text-text-muted transition-colors hover:bg-negative/10 hover:text-negative"
              aria-label="Delete dataset"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                onClick={() => onDelete(dataset.id)}
                className="gap-1 border-negative/40 text-xs text-negative hover:bg-negative/10"
              >
                Delete
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmDelete(false)}
                className="text-xs"
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function DataManagement(): JSX.Element {
  const { status } = useAuthStore()
  const { datasets, loading, uploading, error, fetchDatasets, uploadExport, deleteDataset } = useDatasetStore()
  const { consent, requireConsent } = useConsentStore()
  const fileInputId = 'dataset-upload-input'

  useEffect(() => {
    if (status === 'authenticated') {
      void fetchDatasets()
    }
  }, [status, fetchDatasets])

  function handleFileSelect(file: File) {
    requireConsent(() => {
      void uploadExport(file)
    })
  }

  const readyDatasets = datasets.filter((d) => d.status !== 'deleted')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-text">
          <Database className="h-4 w-4 text-accent" />
          Stored Data
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={fileInputId}>
            <Button
              variant="outline"
              className="gap-1 text-xs cursor-pointer"
              disabled={uploading}
              onClick={() => document.getElementById(fileInputId)?.click()}
            >
              <Upload className="h-3 w-3" />
              {uploading ? 'Uploading...' : 'Upload Export'}
            </Button>
          </label>
          <input
            id={fileInputId}
            type="file"
            className="hidden"
            accept=".zip,application/zip"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelect(file)
              e.currentTarget.value = ''
            }}
          />
        </div>
      </div>

      {consent.persist_history === true && (
        <p className="text-xs text-text-muted">
          Consent granted for server-side history storage. You can revoke this anytime.
        </p>
      )}

      {error && (
        <p className="text-xs text-negative">{error}</p>
      )}

      {loading ? (
        <p className="text-xs text-text-muted">Loading datasets...</p>
      ) : readyDatasets.length === 0 ? (
        <div className="rounded-theme border border-border/40 bg-surface p-4 text-center">
          <p className="text-sm text-text-muted">No datasets stored yet.</p>
          <p className="mt-1 text-xs text-text-muted">
            Upload your Spotify export ZIP to save it to your account.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {readyDatasets.map((dataset) => (
            <DatasetCard
              key={dataset.id}
              dataset={dataset}
              onDelete={(id) => void deleteDataset(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
