import { downloadBlob, formatPercent } from '@/lib/utils'
import type { PluginActionResult, PluginModule } from '@/lib/plugins/runtime'

function formatDelta(current: number, previous: number): string {
  const diff = current - previous
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${diff.toLocaleString()}`
}

function buildSnapshot(data: Parameters<NonNullable<PluginModule['renderPanel']>>[0]['data']) {
  return {
    createdAt: new Date().toISOString(),
    totalPlays: data.summary.totalPlays,
    totalHours: Math.round(data.summary.totalHours),
    uniqueArtists: data.summary.uniqueArtists,
    skipRate: data.summary.skipRate,
  }
}

type PluginActionContext = Parameters<NonNullable<PluginModule['runAction']>>[1]
type PluginActionHandler = (context: PluginActionContext) => PluginActionResult | Promise<PluginActionResult>

function runMappedPluginAction(
  actionId: string,
  handlers: Record<string, PluginActionHandler>,
  context: PluginActionContext,
): PluginActionResult | Promise<PluginActionResult> {
  const handler = handlers[actionId]
  if (!handler) {
    return { status: 'error', message: `Unknown action: ${actionId}` }
  }
  return handler(context)
}

export const snapshotComparePlugin: PluginModule = {
  manifest: {
    id: 'snapshot-compare',
    name: 'Snapshot Compare',
    version: '1.0.0',
    origin: 'first-party',
    capabilities: ['readAggregates', 'addPanel', 'runAction'],
    description: 'Compares baseline summary metrics between two imported snapshots.',
  },
  renderPanel: ({ data }) =>
    `Peak hour ${data.summary.peakHour}:00, ${data.summary.uniqueArtists.toLocaleString()} artists discovered.`,
  actions: [
    {
      id: 'capture-compare',
      label: 'Capture/Compare Snapshot',
      description: 'Stores current snapshot and compares against prior snapshot in session.',
    },
  ],
  runAction: (actionId, context) =>
    runMappedPluginAction(
      actionId,
      {
        'capture-compare': ({ data }) => {
          const key = 'listentropy-snapshot-compare'
          const current = buildSnapshot(data)
          const previousRaw = sessionStorage.getItem(key)
          sessionStorage.setItem(key, JSON.stringify(current))
          if (!previousRaw) {
            return { status: 'success', message: 'Baseline snapshot captured. Run again after importing another dataset.' }
          }
          try {
            const previous = JSON.parse(previousRaw) as ReturnType<typeof buildSnapshot>
            return {
              status: 'success',
              message: `Compared to ${previous.createdAt.slice(0, 10)} | plays ${formatDelta(current.totalPlays, previous.totalPlays)} | hours ${formatDelta(current.totalHours, previous.totalHours)} | artists ${formatDelta(current.uniqueArtists, previous.uniqueArtists)} | skip ${Math.round((current.skipRate - previous.skipRate) * 100)}pp`,
              data: { previousCreatedAt: previous.createdAt },
            }
          } catch {
            return { status: 'success', message: 'Snapshot overwritten; previous snapshot was malformed.' }
          }
        },
      },
      context,
    ),
}

export const anomalyDetectorPlugin: PluginModule = {
  manifest: {
    id: 'anomaly-detector',
    name: 'Anomaly Detector',
    version: '1.0.0',
    origin: 'first-party',
    capabilities: ['readAggregates', 'addPanel', 'runAction'],
    description: 'Highlights atypical spikes and unusual skip behavior.',
  },
  renderPanel: ({ data }) =>
    `Skip volatility: ${formatPercent(data.summary.skipRate)} overall with ${data.skipStats.byArtist.length} high-skip artists.`,
  actions: [
    {
      id: 'scan-anomalies',
      label: 'Run anomaly scan',
      description: 'Finds unusual monthly skip and offline spikes.',
    },
  ],
  runAction: (actionId, context) =>
    runMappedPluginAction(
      actionId,
      {
        'scan-anomalies': ({ data }) => {
          const monthly = data.monthlyBehavior
          const skipBaseline = data.summary.skipRate
          const offlineBaseline = data.contextAnalytics.offlinePrivacy.offlineRate
          const anomalies = monthly.filter(
            (point) =>
              point.plays >= 200 &&
              (point.skipRate > skipBaseline * 1.4 || point.offlineRate > Math.max(offlineBaseline * 2, 0.03)),
          )
          if (anomalies.length === 0) {
            return { status: 'success', message: 'No high-confidence anomalies detected in monthly behavior.' }
          }
          const top = anomalies
            .slice(0, 3)
            .map((item) => `${item.key} (skip ${Math.round(item.skipRate * 100)}%, offline ${Math.round(item.offlineRate * 100)}%)`)
            .join(' · ')
          return { status: 'success', message: `Detected ${anomalies.length} anomalies: ${top}`, data: { count: anomalies.length } }
        },
      },
      context,
    ),
}

export const smartRediscoveryPlugin: PluginModule = {
  manifest: {
    id: 'rediscovery-queue',
    name: 'Rediscovery Queue',
    version: '1.0.0',
    origin: 'first-party',
    capabilities: ['readAggregates', 'addPanel', 'addShareCard', 'runAction'],
    description: 'Surfaces forgotten gems and era transitions for rediscovery.',
  },
  renderPanel: ({ data }) =>
    `${data.gems.length} forgotten gems ready to revisit.`,
  actions: [
    {
      id: 'build-rediscovery-queue',
      label: 'Build rediscovery queue',
      description: 'Creates a compact queue from forgotten gems and current era context.',
    },
  ],
  runAction: (actionId, context) =>
    runMappedPluginAction(
      actionId,
      {
        'build-rediscovery-queue': ({ data }) => {
          const gems = data.gems.slice(0, 5)
          const eras = data.eras.slice(-2).map((item) => item.label).join(' → ')
          const queue = gems.map((item) => `${item.track} — ${item.artist}`).join(' | ')
          return {
            status: 'success',
            message: gems.length === 0
              ? 'No forgotten gems available for rediscovery.'
              : `Queue (${gems.length}): ${queue}${eras ? ` | Era transition: ${eras}` : ''}`,
          }
        },
      },
      context,
    ),
}

export const playlistSeedExportPlugin: PluginModule = {
  manifest: {
    id: 'playlist-seed-export',
    name: 'Playlist Seed Export',
    version: '1.0.0',
    origin: 'first-party',
    capabilities: ['readAggregates', 'exportData', 'addPanel', 'runAction'],
    description: 'Exports URI seeds for playlist generation.',
  },
  renderPanel: ({ data }) =>
    `${data.tracks.slice(0, 20).length} top tracks ready as playlist seeds.`,
  actions: [
    {
      id: 'export-csv',
      label: 'Export Seeds CSV',
      description: 'Downloads top track seeds as CSV.',
    },
    {
      id: 'export-json',
      label: 'Export Seeds JSON',
      description: 'Downloads top track seeds as JSON.',
    },
  ],
  runAction: (actionId, context) =>
    runMappedPluginAction(
      actionId,
      {
        'export-csv': ({ data }) => {
          const rows = data.tracks.slice(0, 50).map((track) => {
            const uri = data.trackUriIndex[`${track.name}::${track.artist}`] ?? ''
            return {
              track: track.name,
              artist: track.artist,
              plays: track.plays,
              uri,
            }
          })
          const header = 'track,artist,plays,uri'
          const lines = rows.map((row) =>
            `"${row.track.replaceAll('"', '""')}","${row.artist.replaceAll('"', '""')}",${row.plays},"${row.uri}"`,
          )
          downloadBlob(new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }), 'listentropy-playlist-seeds.csv')
          return { status: 'success', message: 'Downloaded CSV seeds for top tracks.', data: { rows: rows.length, format: 'csv' } }
        },
        'export-json': ({ data }) => {
          const rows = data.tracks.slice(0, 50).map((track) => {
            const uri = data.trackUriIndex[`${track.name}::${track.artist}`] ?? ''
            return {
              track: track.name,
              artist: track.artist,
              plays: track.plays,
              uri,
            }
          })
          downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), 'listentropy-playlist-seeds.json')
          return { status: 'success', message: 'Downloaded JSON seeds for top tracks.', data: { rows: rows.length, format: 'json' } }
        },
      },
      context,
    ),
}

export const firstPartyPlugins: PluginModule[] = [
  snapshotComparePlugin,
  anomalyDetectorPlugin,
  smartRediscoveryPlugin,
  playlistSeedExportPlugin,
]
