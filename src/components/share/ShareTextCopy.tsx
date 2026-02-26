import { Check, Copy } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { getSharePresetById } from '@/lib/share/presets'
import type { ProcessedDataModel, SharePresetId } from '@/lib/types'

interface ShareTextCopyProps {
  data: ProcessedDataModel
  presetId?: SharePresetId
  onCopied?: () => void
}

function formatTwitter(data: ProcessedDataModel): string {
  const topArtist = data.artists[0]
  return [
    'My Listentropy 🎵',
    '',
    `${Math.round(data.summary.totalHours).toLocaleString()} hours of music since ${data.summary.firstListen.slice(0, 4)}`,
    `${data.summary.totalPlays.toLocaleString()} plays across ${data.summary.uniqueArtists.toLocaleString()} artists`,
    `Top artist: ${topArtist ? `${topArtist.name} (${topArtist.plays.toLocaleString()} plays)` : 'N/A'}`,
    `Night owl: ${Math.round(data.summary.nocturnalShare * 100)}% after 10PM`,
    `Skip rate: ${Math.round(data.summary.skipRate * 100)}%`,
    `Travel share: ${Math.round(data.contextAnalytics.country.travelShare * 100)}%`,
    '',
    'Discover yours → listentropy.com',
  ].join('\n')
}

function formatReddit(data: ProcessedDataModel): string {
  const artists = data.artists.slice(0, 5)
  return [
    '## My Listening DNA',
    '',
    `🎧 **${Math.round(data.summary.totalHours).toLocaleString()} hours** | ${data.summary.totalPlays.toLocaleString()} plays | ${data.summary.uniqueArtists.toLocaleString()} artists`,
    '',
    '**Top 5 Artists:**',
    ...artists.map((artist, index) => `${index + 1}. ${artist.name} — ${artist.plays.toLocaleString()} plays`),
    '',
    `**Personality:** ${data.archetypes.primary.label} ${data.archetypes.primary.emoji}`,
    `**Home country:** ${data.contextAnalytics.country.homeCountry ?? 'N/A'} · **Travel share:** ${Math.round(data.contextAnalytics.country.travelShare * 100)}%`,
    '',
    'Visualize your own data → listentropy.com',
  ].join('\n')
}

function formatDiscord(data: ProcessedDataModel): string {
  const topArtist = data.artists[0]
  return `🎵 ${Math.round(data.summary.totalHours).toLocaleString()}hrs listened | Top: ${
    topArtist ? `${topArtist.name} (${Math.round(topArtist.plays / 100) / 10}K plays)` : 'N/A'
  } | ${data.archetypes.primary.label} ${data.archetypes.primary.emoji} | listentropy.com`
}

function formatVerbose(data: ProcessedDataModel): string {
  const transition = data.contextAnalytics.deviceJourney.dominantTransition
  return [
    'Listentropy Listening Summary',
    '',
    `Timezone mode: ${data.timezoneMode === 'utc' ? 'UTC' : 'Local Time'}`,
    `Hours listened: ${Math.round(data.summary.totalHours).toLocaleString()}`,
    `Total plays: ${data.summary.totalPlays.toLocaleString()}`,
    `Unique artists/tracks: ${data.summary.uniqueArtists.toLocaleString()} / ${data.summary.uniqueTracks.toLocaleString()}`,
    `Peak hour: ${data.summary.peakHour}:00`,
    `Skip/shuffle: ${Math.round(data.summary.skipRate * 100)}% / ${Math.round(data.summary.shuffleRate * 100)}%`,
    `Home country: ${data.contextAnalytics.country.homeCountry ?? 'N/A'}`,
    `Travel share: ${Math.round(data.contextAnalytics.country.travelShare * 100)}%`,
    `Offline/incognito: ${Math.round(data.contextAnalytics.offlinePrivacy.offlineRate * 100)}% / ${Math.round(data.contextAnalytics.offlinePrivacy.incognitoRate * 100)}%`,
    transition
      ? `Dominant device transition: ${transition.from} -> ${transition.to} (${transition.count.toLocaleString()})`
      : 'Dominant device transition: N/A',
    '',
    'Discover yours -> listentropy.com',
  ].join('\n')
}

export function ShareTextCopy({ data, presetId = 'detailed-stats', onCopied }: ShareTextCopyProps): JSX.Element {
  const [copied, setCopied] = useState<string | null>(null)
  const preset = getSharePresetById(presetId)
  const snippets = useMemo(
    () => ({
      preset: [
        `${preset.label} • ${Math.round(data.summary.totalHours).toLocaleString()}h`,
        `${data.archetypes.primary.label} ${data.archetypes.primary.emoji}`,
        `Travel ${Math.round(data.contextAnalytics.country.travelShare * 100)}% • Skip ${Math.round(data.summary.skipRate * 100)}%`,
        'listentropy.com',
      ].join(' | '),
      twitter: formatTwitter(data),
      reddit: formatReddit(data),
      discord: formatDiscord(data),
      verbose: formatVerbose(data),
    }),
    [data, preset],
  )

  async function copy(label: string, text: string): Promise<void> {
    await navigator.clipboard.writeText(text)
    onCopied?.()
    setCopied(label)
    window.setTimeout(() => setCopied(null), 1600)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(Object.entries(snippets) as Array<[string, string]>).map(([label, text]) => (
        <Button
          key={label}
          variant="outline"
          onClick={() => copy(label, text)}
          className="capitalize"
        >
          {copied === label ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Copy {label}
        </Button>
      ))}
    </div>
  )
}
