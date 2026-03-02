import { AlertTriangle, Check, Link2, ShieldCheck } from 'lucide-react'
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
const HARD_CAP_STRING_LENGTH_STEPS = [96, 64, 40, 24, 12]

function truncateLabel(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }
  if (maxLength <= 1) {
    return value.slice(0, maxLength)
  }
  return `${value.slice(0, maxLength - 1)}…`
}

function buildHardCappedPayload(payload: SharePayloadV4, maxStringLength: number): SharePayloadV4 {
  return {
    ...payload,
    name: payload.name ? truncateLabel(payload.name, maxStringLength) : payload.name,
    topArtists: payload.topArtists.slice(0, 1).map(([artist, plays]) => [truncateLabel(artist, maxStringLength), plays]),
    topTracks: payload.topTracks.slice(0, 1).map(([track, artist, plays]) => [
      truncateLabel(track, maxStringLength),
      truncateLabel(artist, maxStringLength),
      plays,
    ]),
    archetype: truncateLabel(payload.archetype, maxStringLength),
    archetypes: payload.archetypes.slice(0, 1).map((label) => truncateLabel(label, maxStringLength)),
    tasteDimensions: payload.tasteDimensions.slice(0, 4),
    context: {
      ...payload.context,
      homeCountry: payload.context.homeCountry
        ? truncateLabel(payload.context.homeCountry, Math.min(3, maxStringLength))
        : payload.context.homeCountry,
      topReasons: payload.context.topReasons.slice(0, 1).map(([reason, count]) => [truncateLabel(reason, maxStringLength), count]),
      topDeviceTransition: payload.context.topDeviceTransition
        ? [
            truncateLabel(payload.context.topDeviceTransition[0], maxStringLength),
            truncateLabel(payload.context.topDeviceTransition[1], maxStringLength),
            payload.context.topDeviceTransition[2],
          ]
        : payload.context.topDeviceTransition,
    },
    selectedCards: payload.selectedCards.slice(0, 1),
  }
}

export function ShareLinkGenerator({
  data,
  displayName,
  selectedCards,
  sharePreset,
  onDisplayNameChange,
}: ShareLinkGeneratorProps): JSX.Element {
  const [includeName, setIncludeName] = useState(false)
  const [anonymize, setAnonymize] = useState(false)
  const [profileWarningConfirmed, setProfileWarningConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const themeKey = useThemeStore((state) => state.themeKey)
  const recordMetric = useSessionMetricsStore((state) => state.record)
  const profileModePendingConfirmation = includeName && !profileWarningConfirmed

  const payload = useMemo(() => {
    const context = data.contextAnalytics
    const includeNameInPayload = includeName && profileWarningConfirmed
    const build = (compact: boolean): SharePayloadV4 => ({
      version: 4,
      privacyLevel: includeNameInPayload ? 'profiled' : 'aggregate',
      checksum: 'pending',
      generatedAt: new Date().toISOString(),
      timezoneMode: data.timezoneMode,
      name: includeNameInPayload ? displayName.trim() || undefined : undefined,
      includeName: includeNameInPayload,
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
    const compactHash = encodeSharePayload(compact)
    if (compactHash.length <= MAX_HASH_LENGTH) {
      return { payload: compact, hash: compactHash, compactMode: true }
    }

    for (const maxStringLength of HARD_CAP_STRING_LENGTH_STEPS) {
      const capped = buildHardCappedPayload(compact, maxStringLength)
      const cappedHash = encodeSharePayload(capped)
      if (cappedHash.length <= MAX_HASH_LENGTH) {
        return { payload: capped, hash: cappedHash, compactMode: true }
      }
    }

    const finalFallback = buildHardCappedPayload(compact, 8)
    return { payload: finalFallback, hash: encodeSharePayload(finalFallback), compactMode: true }
  }, [anonymize, data, displayName, includeName, profileWarningConfirmed, selectedCards, sharePreset, themeKey])

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

  const canCopyProfileLink = !profileModePendingConfirmation
  const visibleLink = profileModePendingConfirmation ? 'Confirm profile-share warning to generate link.' : link
  const payloadUsage = Math.min(payload.hash.length / MAX_HASH_LENGTH, 1)

  async function copyLink(): Promise<void> {
    if (!canCopyProfileLink) {
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
        <div>
          <h3 className="font-heading text-sm font-semibold text-text">Shareable Link</h3>
          <p className="text-xs text-text-muted">Build and copy a compact browser-generated snapshot link.</p>
        </div>
        <span
          className={`rounded-full border px-2 py-1 text-[11px] uppercase tracking-[0.12em] ${
            includeName
              ? profileWarningConfirmed
                ? 'border-amber-400/50 bg-amber-500/10 text-amber-100'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              : 'border-border bg-surface-hover text-text-muted'
          }`}
        >
          {includeName ? (profileWarningConfirmed ? 'Profile mode' : 'Profile locked') : 'Aggregate mode'}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="inline-flex items-center gap-2 rounded-theme border border-border px-3 py-2 text-xs text-text-muted">
          <input
            aria-label="Include display name in share payload"
            type="checkbox"
            checked={includeName}
            onChange={(event) => {
              setIncludeName(event.currentTarget.checked)
              if (!event.currentTarget.checked) {
                setProfileWarningConfirmed(false)
              }
            }}
          />
          Include display name
        </label>
        <label className="inline-flex items-center gap-2 rounded-theme border border-border px-3 py-2 text-xs text-text-muted">
          <input
            aria-label="Anonymize top artist and track names"
            type="checkbox"
            checked={anonymize}
            onChange={(event) => setAnonymize(event.currentTarget.checked)}
          />
          Anonymize top artists/tracks
        </label>
      </div>

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
              Profile mode includes more identifying profile context. Only share if you are comfortable with that exposure.
            </p>
          </div>
          <label className="mt-2 inline-flex items-center gap-2 text-amber-100">
            <input
              aria-label="Confirm profile share warning"
              type="checkbox"
              checked={profileWarningConfirmed}
              onChange={(event) => setProfileWarningConfirmed(event.currentTarget.checked)}
            />
            I understand and want to generate a profile link.
          </label>
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          Aggregate mode excludes direct identifiers by default.
        </p>
      )}

      <div className="rounded-theme border border-border bg-surface-hover/30 p-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-text">
          <ShieldCheck className="h-4 w-4 text-accent" />
          Data privacy vs authenticity
        </p>
        <ul className="mt-2 space-y-1.5 text-xs text-text-muted">
          <li>
            <span className="font-semibold text-text">Data privacy:</span> aggregate snapshots omit direct identifiers unless you opt in.
          </li>
          <li>
            <span className="font-semibold text-text">Profile confirmation:</span> profile links stay locked until you confirm the warning.
          </li>
          <li>
            <span className="font-semibold text-text">Link authenticity:</span> snapshots are generated in your browser and are unverified in this release.
          </li>
          <li>
            <span className="font-semibold text-text">Payload fallback:</span> compact trimming keeps links inside the safety cap.
          </li>
        </ul>
      </div>

      <div className="space-y-2 rounded-theme border border-border bg-surface-hover/40 p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 overflow-hidden">
          <Button onClick={copyLink} disabled={!canCopyProfileLink}>
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy Share Link'}
          </Button>
          <p className="text-xs text-text-muted">Safe for aggregate sharing by default.</p>
        </div>
        <div className="min-w-0 overflow-hidden">
          <code className="block w-full truncate text-xs text-text-muted">
            {visibleLink}
          </code>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs text-text-muted">
          Link payload size: {payload.hash.length}/{MAX_HASH_LENGTH} chars.
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
          <div
            className={`h-full rounded-full ${payload.compactMode ? 'bg-amber-400/80' : 'bg-accent'}`}
            style={{ width: `${Math.max(8, payloadUsage * 100)}%` }}
          />
        </div>
        <p className="text-xs text-text-muted">
          {payload.compactMode
            ? 'Compact mode is active to keep the share link under the payload cap.'
            : 'If the payload exceeds the budget, compact mode trims list detail automatically.'}
        </p>
      </div>
    </div>
  )
}
