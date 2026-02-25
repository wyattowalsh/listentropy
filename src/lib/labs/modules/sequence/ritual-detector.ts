import type { LabDatasetSnapshot, RitualDetectorPayload } from '@/lib/types'

import {
  clamp01,
  confidenceFromValue,
  daypartForTs,
  getStartTime,
  monthKeyForTs,
  readyResult,
  round,
  unsupportedResult,
} from '@/lib/labs/modules/utils'

function artistLabel(record: LabDatasetSnapshot['records'][number]): string {
  return record.master_metadata_album_artist_name || record.episode_show_name || record.audiobook_title || 'Unknown Artist'
}

export function runRitualDetectorModule(snapshot: LabDatasetSnapshot) {
  const startedAt = getStartTime()
  if (snapshot.records.length < 50) {
    return unsupportedResult<RitualDetectorPayload>({
      moduleId: 'ritual-detector',
      startedAt,
      message: 'Need at least 50 records to detect recurring rituals.',
      sourceFields: ['records', 'timezoneMode'],
      assumptions: ['Ritual detection relies on repeated month-level behavior.'],
    })
  }

  const ritualMap = new Map<string, {
    daypart: RitualDetectorPayload['rituals'][number]['daypart']
    platform: string
    anchorArtist: string
    months: Set<string>
    totalOccurrences: number
  }>()
  const heatmapMap = new Map<string, number>()

  for (const record of snapshot.records) {
    const month = monthKeyForTs(record.ts, snapshot.timezoneMode)
    const daypart = daypartForTs(record.ts, snapshot.timezoneMode)
    const platform = record.platform || 'Unknown Platform'
    const anchorArtist = artistLabel(record)
    const ritualKey = `${daypart}::${platform}::${anchorArtist}`

    const bucket = ritualMap.get(ritualKey) ?? {
      daypart,
      platform,
      anchorArtist,
      months: new Set<string>(),
      totalOccurrences: 0,
    }
    bucket.months.add(month)
    bucket.totalOccurrences += 1
    ritualMap.set(ritualKey, bucket)

    heatmapMap.set(`${month}::${ritualKey}`, (heatmapMap.get(`${month}::${ritualKey}`) ?? 0) + 1)
  }

  const totalMonths = new Set(snapshot.records.map((record) => monthKeyForTs(record.ts, snapshot.timezoneMode))).size
  const rituals = [...ritualMap.entries()]
    .map(([key, value]) => {
      const activeMonths = value.months.size
      const density = value.totalOccurrences / Math.max(1, snapshot.records.length)
      const stabilityScore = clamp01((activeMonths / Math.max(1, totalMonths)) * 0.6 + density * 8)
      return {
        key,
        daypart: value.daypart,
        platform: value.platform,
        anchorArtist: value.anchorArtist,
        activeMonths,
        totalOccurrences: value.totalOccurrences,
        stabilityScore: round(stabilityScore, 3),
        fragilityScore: round(1 - stabilityScore, 3),
      }
    })
    .filter((ritual) => ritual.totalOccurrences >= 3 && ritual.activeMonths >= 2)
    .sort((a, b) => b.stabilityScore - a.stabilityScore || b.totalOccurrences - a.totalOccurrences || a.key.localeCompare(b.key))
    .slice(0, 18)

  const selectedKeys = new Set(rituals.map((ritual) => ritual.key))
  const ritualHeatmap = [...heatmapMap.entries()]
    .map(([compound, occurrences]) => {
      const [month, ...rest] = compound.split('::')
      const ritualKey = rest.join('::')
      return { month: month || 'unknown', ritualKey, occurrences }
    })
    .filter((row) => selectedKeys.has(row.ritualKey))
    .sort((a, b) => a.month.localeCompare(b.month) || a.ritualKey.localeCompare(b.ritualKey))

  const payload: RitualDetectorPayload = { rituals, ritualHeatmap }
  const confidence = confidenceFromValue(
    Math.min(0.92, (totalMonths / 18) * 0.5 + (rituals.length / 12) * 0.5),
    [
      `${totalMonths} active months observed`,
      `${rituals.length} rituals met recurrence threshold`,
      'Descriptive heuristic over daypart × platform × anchor-artist groups.',
    ],
  )

  return readyResult({
    moduleId: 'ritual-detector',
    startedAt,
    payload,
    confidence,
    sourceFields: ['records', 'timezoneMode'],
    method: 'descriptive heuristic grouping by daypart, platform, and anchor artist',
    assumptions: [
      'Anchor artist is a useful proxy for repeat ritual identity in Train A.',
      'Ritual recurrence threshold (>=3 occurrences across >=2 months) trades recall for noise control.',
    ],
    warnings: rituals.length === 0 ? ['No rituals met the Train A recurrence threshold.'] : [],
    message: rituals.length > 0 ? `Detected ${rituals.length} recurring rituals.` : 'No recurring rituals detected.',
  })
}
