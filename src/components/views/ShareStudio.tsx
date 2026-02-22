import { useEffect, useMemo, useState } from 'react'

import { ExportButton } from '@/components/share/ExportButton'
import { ShareLinkGenerator } from '@/components/share/ShareLinkGenerator'
import { ShareTextCopy } from '@/components/share/ShareTextCopy'
import { StoryCardDeck, type StoryAspect } from '@/components/share/StoryCardDeck'
import type { StoryCardKey } from '@/components/share/story-card-order'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DEFAULT_SHARE_PRESET, SHARE_PRESETS, getSharePresetById } from '@/lib/share/presets'
import { downloadBlob } from '@/lib/utils'
import type { ProcessedDataModel, SharePresetId } from '@/lib/types'
import { useExperienceStore } from '@/store/useExperienceStore'
import {
  computeShareCompletionRate,
  exportSessionMetricsJson,
  useSessionMetricsStore,
} from '@/store/useSessionMetricsStore'

interface ShareStudioProps {
  data: ProcessedDataModel
}

export function ShareStudio({ data }: ShareStudioProps): JSX.Element {
  const [cardRefs, setCardRefs] = useState<Array<{ key: string; element: HTMLElement | null }>>([])
  const [displayName, setDisplayName] = useState('')
  const [aspect, setAspect] = useState<StoryAspect>('story')
  const [showBranding, setShowBranding] = useState(true)
  const [showQr, setShowQr] = useState(false)
  const [activeCardKey, setActiveCardKey] = useState<StoryCardKey>('title')
  const [presetId, setPresetId] = useState<SharePresetId>(DEFAULT_SHARE_PRESET.id)
  const [selectedCardKeys, setSelectedCardKeys] = useState<StoryCardKey[]>(
    DEFAULT_SHARE_PRESET.selectedCards as StoryCardKey[],
  )
  const recordBehavior = useExperienceStore((state) => state.recordBehavior)
  const metrics = useSessionMetricsStore((state) => state.metrics)
  const recordMetric = useSessionMetricsStore((state) => state.record)

  const activePreset = useMemo(() => getSharePresetById(presetId), [presetId])

  useEffect(() => {
    recordMetric({
      type: 'share_tab_open',
      timestamp: new Date().toISOString(),
      dedupeKey: 'tab:share',
    })
  }, [recordMetric])

  function applyPreset(id: SharePresetId): void {
    const preset = getSharePresetById(id)
    setPresetId(id)
    setSelectedCardKeys(preset.selectedCards as StoryCardKey[])
    recordBehavior('share_action')
  }

  function toggleCard(cardKey: StoryCardKey): void {
    setSelectedCardKeys((current) => {
      const has = current.includes(cardKey)
      const next = has
        ? current.filter((item) => item !== cardKey)
        : [...current, cardKey]
      const deduped = Array.from(new Set(next))
      if (deduped.length === 0) {
        return current
      }
      return deduped
    })
  }

  function exportMetricsJson(): void {
    const blob = new Blob([exportSessionMetricsJson(metrics)], { type: 'application/json' })
    downloadBlob(blob, 'listentropy-session-metrics.json')
  }

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_92%_8%,color-mix(in_srgb,var(--color-accent)_16%,transparent),transparent_42%)]" />
        <div className="relative">
        <CardTitle>Share Studio</CardTitle>
        <p className="mt-1 text-sm text-text-muted">
          Build a 14-card story deck, export visuals, and generate safe share links.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em]">
          <span className="rounded-full border border-border bg-surface-hover px-2 py-1 text-text-muted">
            Local-first
          </span>
          <span className="rounded-full border border-border bg-surface-hover px-2 py-1 text-text-muted">
            No backend required
          </span>
          <span className="rounded-full border border-border bg-surface-hover px-2 py-1 text-text-muted">
            Share payload v4
          </span>
          {metrics.counts.upload_complete > 0 ? (
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-1 text-accent">
              Session share completion {Math.round(computeShareCompletionRate(metrics) * 100)}%
            </span>
          ) : null}
        </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          <Card className="relative">
            <CardTitle>Story Controls</CardTitle>
            <div className="mt-3 grid gap-2">
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">Share Presets</p>
              <div className="flex flex-wrap gap-2">
                {SHARE_PRESETS.map((preset) => (
                  <Button
                    key={preset.id}
                    variant={presetId === preset.id ? 'default' : 'outline'}
                    onClick={() => applyPreset(preset.id)}
                    className={presetId === preset.id ? 'shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-accent)_35%,transparent)]' : ''}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-text-muted">{activePreset.description}</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                value={displayName}
                placeholder="Display name (optional)"
                onChange={(event) => setDisplayName(event.currentTarget.value)}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant={aspect === 'story' ? 'default' : 'outline'}
                  onClick={() => setAspect('story')}
                  aria-label="Use story 9 by 16 aspect ratio"
                >
                  Story 9:16
                </Button>
                <Button
                  variant={aspect === 'square' ? 'default' : 'outline'}
                  onClick={() => setAspect('square')}
                  aria-label="Use square 1 by 1 aspect ratio"
                >
                  Square 1:1
                </Button>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={showBranding}
                  onChange={(event) => setShowBranding(event.currentTarget.checked)}
                />
                Show Listentropy branding
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={showQr}
                  onChange={(event) => setShowQr(event.currentTarget.checked)}
                />
                Add QR code
              </label>
            </div>
            <div className="mt-4">
              <p className="text-xs uppercase tracking-[0.14em] text-text-muted">
                Included cards ({selectedCardKeys.length})
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(
                  [
                    'title',
                    'top-artists',
                    'top-tracks',
                    'clock',
                    'streak',
                    'guilty-pleasures',
                    'forgotten-gem',
                    'archetype',
                    'numbers',
                    'fingerprint',
                    'travel-footprint',
                    'intent-signature',
                    'device-journey',
                    'offline-private',
                  ] as StoryCardKey[]
                ).map((cardKey) => (
                  <label key={cardKey} className="inline-flex items-center gap-2 text-xs text-text-muted">
                    <input
                      type="checkbox"
                      checked={selectedCardKeys.includes(cardKey)}
                      onChange={() => toggleCard(cardKey)}
                    />
                    <span className="capitalize">{cardKey.replaceAll('-', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </Card>

          <StoryCardDeck
            data={data}
            displayName={displayName}
            aspect={aspect}
            showBranding={showBranding}
            showQr={showQr}
            selectedCardKeys={selectedCardKeys}
            onCardsReady={setCardRefs}
            onActiveCardKeyChange={setActiveCardKey}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <Card>
            <CardTitle>Export</CardTitle>
            <div className="mt-3">
              <ExportButton
                cardRefs={cardRefs}
                activeCardKey={activeCardKey}
                onAssetExported={(kind) => {
                  recordBehavior('share_action')
                  recordMetric({
                    type: 'asset_exported',
                    timestamp: new Date().toISOString(),
                    metadata: { kind },
                  })
                }}
              />
            </div>
          </Card>
          <ShareLinkGenerator
            data={data}
            displayName={displayName}
            selectedCards={selectedCardKeys}
            sharePreset={presetId}
            onDisplayNameChange={setDisplayName}
          />
          <Card>
            <CardTitle>Copy text formats</CardTitle>
            <div className="mt-3">
              <ShareTextCopy
                data={data}
                presetId={presetId}
                onCopied={() => {
                  recordBehavior('share_action')
                }}
              />
            </div>
          </Card>
          <Card>
            <CardTitle>Session Share Funnel</CardTitle>
            <div className="mt-3 grid gap-2 text-sm text-text-muted">
              <p>Uploads completed: {metrics.counts.upload_complete}</p>
              <p>Share tab opens: {metrics.counts.share_tab_open}</p>
              <p>Links generated: {metrics.counts.share_link_generated}</p>
              <p>Links copied: {metrics.counts.share_link_copied}</p>
              <p>Assets exported: {metrics.counts.asset_exported}</p>
              <p className="text-text">
                Share completion rate: {Math.round(computeShareCompletionRate(metrics) * 100)}%
              </p>
            </div>
            <div className="mt-3">
              <Button variant="outline" onClick={exportMetricsJson}>
                Export Session Metrics JSON
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
