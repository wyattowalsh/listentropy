import { create } from 'zustand'
import { useAuthStore } from './useAuthStore'

export interface Dataset {
  id: string
  name: string
  source: 'spotify_export' | 'spotify_api' | 'merged'
  status: 'processing' | 'ready' | 'error' | 'deleted'
  recordCount: number
  fileSizeBytes: number | null
  dateRange: { start: string | null; end: string | null }
  historyFileCount: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface ProvenanceEvent {
  id: string
  dataset_id: string
  event_type: string
  source: string
  record_count: number
  details: Record<string, unknown>
  created_at: string
}

interface UploadResult {
  datasetId: string
  recordCount: number
  totalParsed: number
  duplicatesSkipped: number
  historyFileCount: number
  dateRange: { start: string | null; end: string | null }
}

interface ApiTrack {
  ts: string
  trackName: string
  artistName: string
  albumName: string
  spotifyUri: string
  msPlayed: number
  platform?: string
}

interface DatasetState {
  datasets: Dataset[]
  provenance: ProvenanceEvent[]
  loading: boolean
  uploading: boolean
  merging: boolean
  ingesting: boolean
  uploadProgress: string | null
  error: string | null
  fetchDatasets: () => Promise<void>
  uploadExport: (file: File) => Promise<UploadResult | null>
  deleteDataset: (id: string) => Promise<boolean>
  mergeDatasets: (datasetIds: string[]) => Promise<boolean>
  ingestApiData: (tracks: ApiTrack[]) => Promise<boolean>
  syncSpotify: () => Promise<boolean>
  fetchProvenance: (datasetId?: string) => Promise<void>
}

function getCsrfHeader(): Record<string, string> {
  const csrfToken = useAuthStore.getState().csrfToken
  return csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
}

export const useDatasetStore = create<DatasetState>((set, get) => ({
  datasets: [],
  provenance: [],
  loading: false,
  uploading: false,
  merging: false,
  ingesting: false,
  uploadProgress: null,
  error: null,

  fetchDatasets: async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/datasets', { credentials: 'include' })
      if (!res.ok) {
        set({ loading: false, error: 'Failed to load datasets' })
        return
      }
      const data = await res.json()
      set({ datasets: data.datasets, loading: false })
    } catch {
      set({ loading: false, error: 'Failed to load datasets' })
    }
  },

  uploadExport: async (file) => {
    set({ uploading: true, uploadProgress: 'Uploading...', error: null })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/datasets/upload', {
        method: 'POST',
        credentials: 'include',
        headers: getCsrfHeader(),
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        set({ uploading: false, uploadProgress: null, error: data.error || 'Upload failed' })
        return null
      }

      const result: UploadResult = await res.json()
      set({ uploading: false, uploadProgress: null })
      await get().fetchDatasets()
      return result
    } catch {
      set({ uploading: false, uploadProgress: null, error: 'Upload failed' })
      return null
    }
  },

  deleteDataset: async (id) => {
    try {
      const res = await fetch(`/api/datasets/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeader(),
        },
      })
      if (res.ok) {
        await get().fetchDatasets()
        return true
      }
      return false
    } catch {
      return false
    }
  },

  ingestApiData: async (tracks) => {
    set({ ingesting: true, error: null })
    try {
      const res = await fetch('/api/datasets/ingest-api', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeader(),
        },
        body: JSON.stringify({ tracks }),
      })
      if (!res.ok) {
        const data = await res.json()
        set({ ingesting: false, error: data.error || 'API ingestion failed' })
        return false
      }
      set({ ingesting: false })
      await get().fetchDatasets()
      return true
    } catch {
      set({ ingesting: false, error: 'API ingestion failed' })
      return false
    }
  },

  syncSpotify: async () => {
    set({ ingesting: true, error: null })
    try {
      const res = await fetch('/api/datasets/sync-spotify', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeader(),
        },
      })
      if (!res.ok) {
        const data = await res.json()
        set({ ingesting: false, error: data.error || 'Spotify sync failed' })
        return false
      }
      set({ ingesting: false })
      await get().fetchDatasets()
      return true
    } catch {
      set({ ingesting: false, error: 'Spotify sync failed' })
      return false
    }
  },

  mergeDatasets: async (datasetIds) => {
    set({ merging: true, error: null })
    try {
      const res = await fetch('/api/datasets/merge', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeader(),
        },
        body: JSON.stringify({ datasetIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        set({ merging: false, error: data.error || 'Merge failed' })
        return false
      }
      set({ merging: false })
      await get().fetchDatasets()
      return true
    } catch {
      set({ merging: false, error: 'Merge failed' })
      return false
    }
  },

  fetchProvenance: async (datasetId) => {
    try {
      const url = datasetId
        ? `/api/datasets/provenance?datasetId=${datasetId}`
        : '/api/datasets/provenance'
      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        set({ provenance: data.provenance })
      }
    } catch {
      /* Provenance is supplementary; keep the current UI state on fetch failure. */
    }
  },
}))
