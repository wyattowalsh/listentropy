import { Link } from 'react-router-dom'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { decodeSharePayload, decodeSharePayloadV4 } from '@/lib/share/share-encoder'
import { formatPercent } from '@/lib/utils'
import { applyTheme } from '@/store/useThemeStore'

export function SharePage(): JSX.Element {
  const [hash, setHash] = useState(() =>
    window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash,
  )

  useEffect(() => {
    const onHashChange = (): void => {
      setHash(window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const decoded = useMemo(() => {
    if (!hash) {
      return null
    }
    try {
      const source = decodeSharePayload(hash)
      return {
        payload: decodeSharePayloadV4(hash),
        sourceVersion: source.version,
      }
    } catch {
      return null
    }
  }, [hash])
  const payload = decoded?.payload ?? null
  const sourceVersion = decoded?.sourceVersion ?? null
  const legacyPayload = sourceVersion !== null && sourceVersion < 4
  const hasContextSnapshot = payload
    ? sourceVersion !== null && sourceVersion >= 3
      ? Boolean(
          payload.context.homeCountry ||
          payload.context.topReasons.length > 0 ||
          payload.context.topDeviceTransition ||
          payload.context.domesticShare > 0 ||
          payload.context.travelShare > 0 ||
          payload.context.offlineRate > 0 ||
          payload.context.incognitoRate > 0,
        )
      : false
    : false

  useEffect(() => {
    if (payload?.themeKey) {
      applyTheme(payload.themeKey)
    }
  }, [payload?.themeKey])

  if (!payload) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4">
        <Card className="w-full max-w-xl text-center">
          <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <CardTitle className="mt-3">This link needs a refresh</CardTitle>
          <CardDescription className="mt-2">
            We couldn&apos;t decode this snapshot payload safely. It may be malformed, incomplete, or copied with missing characters.
          </CardDescription>
          <p className="mt-3 text-xs text-text-muted">
            Data privacy: decoding happens in your browser and no private data was processed.
          </p>
          <p className="mt-2 text-xs text-text-muted">
            Link authenticity: shared snapshots are browser-generated and unverified in this release.
          </p>
          <Link to="/" className="mt-4 inline-block text-accent underline">
            Create a new share snapshot
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl space-y-4 px-4 py-10">
      <Card>
        <CardTitle className="text-2xl">Shared Listening Snapshot</CardTitle>
        <CardDescription className="mt-1">
          {payload.includeName && payload.name
            ? `${payload.name}'s profile`
            : 'Anonymous profile'}{' '}
          · {payload.dateRange[0]} — {payload.dateRange[1]} · payload v{payload.version} ·{' '}
          {payload.timezoneMode === 'utc' ? 'UTC' : 'Local Time'} · {payload.themeKey}
        </CardDescription>
      </Card>
      {legacyPayload ? (
        <Card className="border-accent/30 bg-surface-hover/30">
          <CardTitle className="inline-flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-accent" />
            Legacy snapshot upgraded
          </CardTitle>
          <CardDescription className="mt-2">
            This link was generated with payload v{sourceVersion}. We upgraded it in-browser so it renders with the modern /share layout.
          </CardDescription>
        </Card>
      ) : null}
      <Card className="border-border bg-surface-hover/30">
        <CardTitle className="text-sm">Privacy &amp; authenticity notes</CardTitle>
        <CardDescription className="mt-2">
          <span className="font-semibold text-text">Data privacy:</span> this snapshot is decoded in your browser with no upload required to view it.
        </CardDescription>
        <p className="mt-2 text-xs text-text-muted">
          <span className="font-semibold text-text">Link authenticity:</span> share snapshots are browser-generated and unverified in this release.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Total Hours</CardTitle>
          <p className="mt-3 font-heading text-5xl text-accent">
            {payload.totalHours.toLocaleString()}
          </p>
        </Card>
        <Card>
          <CardTitle>Archetype</CardTitle>
          <p className="mt-3 text-2xl text-text">{payload.archetype}</p>
          <p className="mt-1 text-sm text-text-muted">
            Skip {Math.round(payload.skipRate * 100)}% · Shuffle{' '}
            {Math.round(payload.shuffleRate * 100)}%
          </p>
          {payload.archetypes.length > 1 ? (
            <p className="mt-1 text-xs text-text-muted">
              Also: {payload.archetypes.slice(1).join(', ')}
            </p>
          ) : null}
        </Card>
      </div>

      <Card>
        <CardTitle>Top Artists</CardTitle>
        {payload.anonymize ? (
          <p className="mt-2 text-xs text-text-muted">Names were anonymized by the sharer.</p>
        ) : null}
        <ol className="mt-3 space-y-2">
          {payload.topArtists.map(([artist, plays], index) => (
            <li key={artist} className="flex items-center justify-between text-sm text-text">
              <span>
                #{index + 1} {artist}
              </span>
              <span className="text-text-muted">{plays.toLocaleString()} plays</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardTitle>Top Tracks</CardTitle>
        <ol className="mt-3 space-y-2">
          {payload.topTracks.map(([track, artist, plays], index) => (
            <li key={`${track}-${artist}`} className="flex items-center justify-between text-sm text-text">
              <span>
                #{index + 1} {track} — {artist}
              </span>
              <span className="text-text-muted">{plays.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Context Snapshot</CardTitle>
          {hasContextSnapshot ? (
            <>
              <p className="mt-2 text-sm text-text-muted">
                Home country: {payload.context.homeCountry ?? 'N/A'}
              </p>
              <p className="mt-2 text-sm text-text-muted">
                Domestic {formatPercent(payload.context.domesticShare)} · Travel{' '}
                {formatPercent(payload.context.travelShare)}
              </p>
              <p className="mt-2 text-sm text-text-muted">
                Offline {formatPercent(payload.context.offlineRate)} · Incognito{' '}
                {formatPercent(payload.context.incognitoRate)}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-muted">
              Context details were not included in this earlier share format.
            </p>
          )}
        </Card>
        <Card>
          <CardTitle>Top Intent Signals</CardTitle>
          {payload.context.topReasons.length > 0 ? (
            <ol className="mt-3 space-y-2">
              {payload.context.topReasons.map(([reason, count]) => (
                <li key={reason} className="flex items-center justify-between text-sm text-text">
                  <span>{reason}</span>
                  <span className="text-text-muted">{count.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-text-muted">
              Intent reasons were not captured in this snapshot.
            </p>
          )}
          {hasContextSnapshot && payload.context.topDeviceTransition ? (
            <p className="mt-3 text-xs text-text-muted">
              Dominant device handoff: {payload.context.topDeviceTransition[0]} →{' '}
              {payload.context.topDeviceTransition[1]} (
              {payload.context.topDeviceTransition[2].toLocaleString()} sessions)
            </p>
          ) : null}
          <p className="mt-3 text-xs text-text-muted">
            Preset: {payload.sharePreset} · Cards: {payload.selectedCards.length}
          </p>
        </Card>
      </div>

      <div className="pt-2 text-center text-xs uppercase tracking-[0.2em] text-text-muted">
        Discover your own listening story → <Link to="/">Open Listentropy</Link>
      </div>
    </div>
  )
}
