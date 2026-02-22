import { AlertTriangle, Check, Link2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { encodeSharePayload } from '@/lib/share/share-encoder'
import type { ProcessedDataModel, SharePayloadV4, SharePresetId } from '@/lib/types'
import { useThemeStore } from '@/store/useThemeStore'
import { useSessionMetricsStore } from '@/store/useSessionMetricsStore'

interface ShareLinkGeneratorProps {
  data: ProcessedDataModel
  displayName: string
  selectedCards: string[]
  sharePreset: SharePresetId
  onDisplayNameChange: (value: string) => void
}

function redactArtist(index: number): string {
  return `Artist #${index + 1}`
}

function redactTrack(index: number): string {
  return `Track #${index + 1}`
}

const MAX_HASH_LENGTH = 2400

export function ShareLinkGenerator({
  data,
  displayName,
  selectedCards,
  sharePreset,
  onDisplayNameChange,
}: ShareLinkGeneratorProps): JSX.Element {
  const [includeName, setIncludeName] = useState(false)
  const [anonymize, setAnonymize] = useState(false)
  const [richConfirmed, setRichConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const themeKey = useThemeStore((state) => state.themeKey)
  const recordMetric = useSessionMetricsStore((state) => state.record)

  const payload = useMemo(() => {
    const context = data.contextAnalytics
    const build = (compact: boolean): SharePayloadV4 => ({
      version: 4,
      privacyLevel: includeName ? 'rich' : 'aggregate',
      checksum: 'pending',
      generatedAt: new Date().toISOString(),
      timezoneMode: data.timezoneMode,
      name: includeName ? displayName.trim() || undefined : undefined,
      includeName,
      anonymize,
      totalHours: Math.round(data.summary.totalHours),
      totalPlays: data.summary.totalPlays,
      uniqueArtists: data.summary.uniqueArtists,
      uniqueTracks: data.summary.uniqueTracks,
      dateRange: [data.summary.firstListen.slice(0, 4), data.summary.lastListen.slice(0, 4)],
      topArtists: data.artists
        .slice(0, compact ? 3 : 5)
        .map((item, index) => [anonymize ? redactArtist(index) : item.name, item.plays]),
      topTracks: data.tracks.slice(0, compact ? 3 : 5).map((item, index) => [
        anonymize ? redactTrack(index) : item.name,
        anonymize ? redactArtist(index) : item.artist,
        item.plays,
      ]),
      archetype: data.archetypes.primary.label,
      archetypes: [data.archetypes.primary.label, ...data.archetypes.secondary.map((entry) => entry.label)].slice(0, compact ? 2 : 4),
      peakHour: data.summary.peakHour,
      skipRate: data.summary.skipRate,
      shuffleRate: data.summary.shuffleRate,
      longestStreak: data.summary.longestStreakDays,
      tasteDimensions: data.taste.dimensions.map((item) => item.score).slice(0, compact ? 6 : 10),
      context: {
        homeCountry: context.country.homeCountry,
        domesticShare: context.country.domesticShare,
        travelShare: context.country.travelShare,
        topReasons: context.reasons.start.slice(0, compact ? 2 : 4).map((item) => [item.reason, item.count]),
        offlineRate: context.offlinePrivacy.offlineRate,
        incognitoRate: context.offlinePrivacy.incognitoRate,
        topDeviceTransition: compact || !context.deviceJourney.dominantTransition
          ? undefined
          : [
              context.deviceJourney.dominantTransition.from,
              context.deviceJourney.dominantTransition.to,
              context.deviceJourney.dominantTransition.count,
            ],
      },
      selectedCards: selectedCards.length > 0 ? selectedCards : ['title', 'numbers', 'archetype'],
      sharePreset,
      themeKey,
    })

    const full = build(false)
    const fullHash = encodeSharePayload(full)
    if (fullHash.length <= MAX_HASH_LENGTH) {
      return { payload: full, hash: fullHash, compactMode: false }
    }
    const compact = build(true)
    return { payload: compact, hash: encodeSharePayload(compact), compactMode: true }
  }, [anonymize, data, displayName, includeName, selectedCards, sharePreset, themeKey])

  const link = useMemo(() => {
    const shareUrl = new URL('share', new URL(import.meta.env.BASE_URL, window.location.origin))
    shareUrl.hash = payload.hash
    return shareUrl.toString()
  }, [payload.hash])

  useEffect(() => {
    recordMetric({
      type: 'share_link_generated',
      timestamp: new Date().toISOString(),
      dedupeKey: `share-hash:${payload.hash}`,
      metadata: {
        compactMode: payload.compactMode,
        cards: payload.payload.selectedCards.length,
        preset: payload.payload.sharePreset,
      },
    })
  }, [payload.compactMode, payload.hash, payload.payload.selectedCards.length, payload.payload.sharePreset, recordMetric])

  const canCopyRichLink = !includeName || richConfirmed

  async function copyLink(): Promise<void> {
    if (!canCopyRichLink) {
      return
    }
    await navigator.clipboard.writeText(link)
    recordMetric({
      type: 'share_link_copied',
      timestamp: new Date().toISOString(),
      metadata: { preset: sharePreset, cards: selectedCards.length || payload.payload.selectedCards.length },
    })
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="min-w-0 space-y-3 rounded-theme border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold text-text">Shareable Link</h3>
        <label className="inline-flex items-center gap-2 text-xs text-text-muted">
          <input
            aria-label="Include display name in share payload"
            type="checkbox"
            checked={includeName}
            onChange={(event) => {
              setIncludeName(event.currentTarget.checked)
              if (!event.currentTarget.checked) {
                setRichConfirmed(false)
              }
            }}
          />
          Include display name
        </label>
      </div>

      <label className="inline-flex items-center gap-2 text-xs text-text-muted">
        <input
          aria-label="Anonymize top artist and track names"
          type="checkbox"
          checked={anonymize}
          onChange={(event) => setAnonymize(event.currentTarget.checked)}
        />
        Anonymize top artists/tracks
      </label>

      {includeName ? (
        <Input
          value={displayName}
          placeholder="Display name (optional)"
          onChange={(event) => onDisplayNameChange(event.currentTarget.value)}
        />
      ) : null}

      {includeName ? (
        <div className="rounded-theme border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-[1px] h-4 w-4" />
            <p>
              Rich mode includes more identifying profile context. Only share if you are comfortable with that exposure.
            </p>
          </div>
          <label className="mt-2 inline-flex items-center gap-2 text-amber-100">
            <input
              aria-label="Confirm rich share warning"
              type="checkbox"
              checked={richConfirmed}
              onChange={(event) => setRichConfirmed(event.currentTarget.checked)}
            />
            I understand and want to generate a rich link.
          </label>
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          Aggregate mode excludes direct identifiers by default.
        </p>
      )}

      <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden">
        <Button variant="outline" onClick={copyLink} disabled={!canCopyRichLink}>
          {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy Share Link'}
        </Button>
        <div className="min-w-0 basis-full overflow-hidden sm:flex-1">
          <code className="block w-full truncate text-xs text-text-muted">
            {link}
          </code>
        </div>
      </div>
      {payload.compactMode ? (
        <p className="text-xs text-text-muted">
          Compact payload mode enabled to keep share-link size manageable.
        </p>
      ) : null}
    </div>
  )
}
