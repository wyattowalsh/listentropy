import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { safeDecodeSharePayloadV4 } from '@/lib/share/share-encoder'
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

  const payload = safeDecodeSharePayloadV4(hash)

  useEffect(() => {
    if (payload?.themeKey) {
      applyTheme(payload.themeKey)
    }
  }, [payload?.themeKey])

  if (!payload) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4">
        <Card className="w-full text-center">
          <CardTitle>Invalid Share Link</CardTitle>
          <CardDescription className="mt-2">
            This link is malformed or expired.
          </CardDescription>
          <Link to="/" className="mt-4 inline-block text-accent underline">
            Back to Listentropy
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
        </Card>
        <Card>
          <CardTitle>Top Intent Signals</CardTitle>
          <ol className="mt-3 space-y-2">
            {payload.context.topReasons.map(([reason, count]) => (
              <li key={reason} className="flex items-center justify-between text-sm text-text">
                <span>{reason}</span>
                <span className="text-text-muted">{count.toLocaleString()}</span>
              </li>
            ))}
          </ol>
          {payload.context.topDeviceTransition ? (
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
