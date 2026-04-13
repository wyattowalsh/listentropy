import { useState } from 'react'
import { Shield, X, Database, BarChart3, Eye } from 'lucide-react'
import { useConsentStore } from '@/store/useConsentStore'
import { Button } from '@/components/ui/button'

export function ConsentDialog(): JSX.Element | null {
  const { showConsentDialog, pendingAction, grantConsent, dismissDialog } = useConsentStore()
  const [persistHistory, setPersistHistory] = useState(true)
  const [persistEnrichment, setPersistEnrichment] = useState(true)
  const [aggregateAnalytics, setAggregateAnalytics] = useState(false)
  const [saving, setSaving] = useState(false)

  if (!showConsentDialog) return null

  async function handleAccept() {
    setSaving(true)
    await grantConsent('persist_history', persistHistory)
    await grantConsent('persist_enrichment', persistEnrichment)
    await grantConsent('aggregate_analytics', aggregateAnalytics)
    setSaving(false)
    const action = pendingAction
    dismissDialog()
    if (persistHistory && action) {
      action()
    }
  }

  function handleDecline() {
    dismissDialog()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={handleDecline}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-theme border border-border/80 bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            <h2 className="font-heading text-lg font-semibold text-text">Data Storage Consent</h2>
          </div>
          <button type="button" onClick={handleDecline} className="rounded-theme p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <p className="text-sm text-text-muted">
            By default, your data is processed entirely in your browser and never leaves your device.
            To save your listening history to your account for future access, we need your permission.
          </p>

          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-theme border border-border/60 p-3 transition-colors hover:bg-surface-hover cursor-pointer">
              <input type="checkbox" checked={persistHistory} onChange={(e) => setPersistHistory(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-accent" />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-text">
                  <Database className="h-3.5 w-3.5 text-accent" />
                  Save listening history
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  Your uploaded Spotify export will be stored securely in your account. You can delete it anytime.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-theme border border-border/60 p-3 transition-colors hover:bg-surface-hover cursor-pointer">
              <input type="checkbox" checked={persistEnrichment} onChange={(e) => setPersistEnrichment(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-accent" />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-text">
                  <Eye className="h-3.5 w-3.5 text-accent" />
                  Save enrichment data
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  Cache audio features and artist metadata fetched from Spotify's API alongside your history.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-theme border border-border/60 p-3 transition-colors hover:bg-surface-hover cursor-pointer">
              <input type="checkbox" checked={aggregateAnalytics} onChange={(e) => setAggregateAnalytics(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-accent" />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-text">
                  <BarChart3 className="h-3.5 w-3.5 text-accent" />
                  Contribute to aggregate analytics
                </div>
                <p className="mt-0.5 text-xs text-text-muted">
                  Allow your anonymized data to be included in cross-user trends and comparisons. Individual data is never exposed.
                </p>
              </div>
            </label>
          </div>

          <div className="rounded-theme border border-border/40 bg-surface p-3">
            <p className="text-xs text-text-muted">
              <strong className="text-text">Your rights:</strong> You can revoke consent, delete individual datasets, or delete your entire account at any time from Account Settings. Deletion is permanent and immediate.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={handleDecline} className="text-sm">
              Keep Local Only
            </Button>
            <Button
              onClick={() => void handleAccept()}
              disabled={saving || !persistHistory}
              className="gap-1 text-sm"
            >
              {saving ? 'Saving...' : 'Save to Account'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
