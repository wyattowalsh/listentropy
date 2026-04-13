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

interface UploadResult {
  datasetId: string
  recordCount: number
  totalParsed: number
  duplicatesSkipped: number
  historyFileCount: number
  dateRange: { start: string | null; end: string | null }
}

interface DatasetState {
  datasets: Dataset[]
  loading: boolean
  uploading: boolean
  uploadProgress: string | null
  error: string | null
  fetchDatasets: () => Promise<void>
  uploadExport: (file: File) => Promise<UploadResult | null>
  deleteDataset: (id: string) => Promise<boolean>
}

export const useDatasetStore = create<DatasetState>((set, get) => ({
  datasets: [],
  loading: false,
  uploading: false,
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
    const csrfToken = useAuthStore.getState().csrfToken
    set({ uploading: true, uploadProgress: 'Uploading...', error: null })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/datasets/upload', {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
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
    const csrfToken = useAuthStore.getState().csrfToken
    try {
      const res = await fetch(`/api/datasets/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
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
}))
