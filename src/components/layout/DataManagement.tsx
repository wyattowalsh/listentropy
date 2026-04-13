import { useEffect, useState } from 'react'
import { Database, Trash2, Upload, Calendar, FileArchive, GitMerge, History, ShieldOff, ChevronDown, ChevronUp, Radio } from 'lucide-react'
import { useDatasetStore, type Dataset, type ProvenanceEvent } from '@/store/useDatasetStore'
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

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

function ProvenanceList({ events }: { events: ProvenanceEvent[] }): JSX.Element {
  if (events.length === 0) {
    return <p className="text-xs text-text-muted">No provenance events recorded.</p>
  }

  return (
    <div className="space-y-1.5">
      {events.map((ev) => (
        <div key={ev.id} className="flex items-start gap-2 rounded-theme border border-border/40 bg-surface p-2 text-xs">
          <History className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <span className="font-medium text-text">{ev.event_type}</span>
            <span className="mx-1 text-text-muted">from</span>
            <span className="text-text">{ev.source}</span>
            {ev.record_count > 0 && (
              <span className="ml-1 text-text-muted">({ev.record_count.toLocaleString()} records)</span>
            )}
            <div className="mt-0.5 text-text-muted">{formatTimestamp(ev.created_at)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function DatasetCard({ dataset, onDelete, selected, onToggleSelect }: {
  dataset: Dataset
  onDelete: (id: string) => void
  selected: boolean
  onToggleSelect: (id: string) => void
}): JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className={`rounded-theme border p-3 transition-colors ${selected ? 'border-accent bg-accent/5' : 'border-border/60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {dataset.status === 'ready' && (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleSelect(dataset.id)}
              className="mt-1 h-4 w-4 rounded accent-accent"
            />
          )}
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

function ConsentControls(): JSX.Element {
  const { consent, grantConsent } = useConsentStore()
  const [revoking, setRevoking] = useState<string | null>(null)

  const consentItems = [
    { key: 'persist_history' as const, label: 'History storage' },
    { key: 'persist_enrichment' as const, label: 'Enrichment data' },
    { key: 'aggregate_analytics' as const, label: 'Aggregate analytics' },
  ]

  const activeConsents = consentItems.filter((c) => consent[c.key] === true)
  if (activeConsents.length === 0) return <></>

  async function handleRevoke(key: 'persist_history' | 'persist_enrichment' | 'aggregate_analytics') {
    setRevoking(key)
    await grantConsent(key, false)
    setRevoking(null)
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-text-muted">Active Consent</p>
      {activeConsents.map((c) => (
        <div key={c.key} className="flex items-center justify-between rounded-theme border border-border/40 bg-surface px-3 py-2">
          <span className="text-xs text-text">{c.label}</span>
          <button
            type="button"
            onClick={() => void handleRevoke(c.key)}
            disabled={revoking === c.key}
            className="inline-flex items-center gap-1 text-xs text-negative transition-colors hover:text-negative/80 disabled:opacity-50"
          >
            <ShieldOff className="h-3 w-3" />
            {revoking === c.key ? 'Revoking...' : 'Revoke'}
          </button>
        </div>
      ))}
    </div>
  )
}

export function DataManagement(): JSX.Element {
  const { status } = useAuthStore()
  const { datasets, provenance, loading, uploading, merging, ingesting, error, fetchDatasets, uploadExport, deleteDataset, mergeDatasets, syncSpotify, fetchProvenance } = useDatasetStore()
  const { consent, requireConsent } = useConsentStore()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showProvenance, setShowProvenance] = useState(false)
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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleMerge() {
    const ids = Array.from(selectedIds)
    const success = await mergeDatasets(ids)
    if (success) setSelectedIds(new Set())
  }

  async function handleSyncSpotify() {
    requireConsent(async () => {
      await syncSpotify()
    })
  }

  function handleToggleProvenance() {
    if (!showProvenance) {
      void fetchProvenance()
    }
    setShowProvenance((v) => !v)
  }

  const readyDatasets = datasets.filter((d) => d.status !== 'deleted')
  const canMerge = selectedIds.size >= 2

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-text">
          <Database className="h-4 w-4 text-accent" />
          Stored Data
        </div>
        <div className="flex items-center gap-2">
          {canMerge && (
            <Button
              variant="outline"
              className="gap-1 text-xs"
              disabled={merging}
              onClick={() => void handleMerge()}
            >
              <GitMerge className="h-3 w-3" />
              {merging ? 'Merging...' : `Merge ${selectedIds.size} datasets`}
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-1 text-xs"
            disabled={ingesting}
            onClick={() => void handleSyncSpotify()}
          >
            <Radio className="h-3 w-3" />
            {ingesting ? 'Syncing...' : 'Sync Spotify'}
          </Button>
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

      <ConsentControls />

      {consent.persist_history === true && !datasets.some(() => true) && (
        <p className="text-xs text-text-muted">
          Consent granted for server-side history storage. You can revoke this anytime above.
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
              selected={selectedIds.has(dataset.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      <div className="border-t border-border/40 pt-2">
        <button
          type="button"
          onClick={handleToggleProvenance}
          className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
        >
          <History className="h-3 w-3" />
          Data Provenance
          {showProvenance ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showProvenance && (
          <div className="mt-2">
            <ProvenanceList events={provenance} />
          </div>
        )}
      </div>
    </div>
  )
}
