import type { CounterfactualsPayload, LabDatasetSnapshot } from '@/lib/types'

import {
  confidenceFromValue,
  getStartTime,
  readyResult,
  round,
  unsupportedResult,
} from '@/lib/labs/modules/utils'

function entropy(counts: number[]): number {
  const total = counts.reduce((sum, value) => sum + value, 0)
  if (total === 0) {
    return 0
  }
  const h = counts.reduce((sum, count) => {
    if (count <= 0) {
      return sum
    }
    const p = count / total
    return sum - p * Math.log2(p)
  }, 0)
  return h / Math.log2(Math.max(2, counts.length))
}

function computeLiteSummary(records: LabDatasetSnapshot['records'], timezoneMode: LabDatasetSnapshot['timezoneMode']) {
  const totalPlays = records.length
  const skipped = records.filter((record) => record.skipped).length
  const shuffled = records.filter((record) => record.shuffle).length
  const nocturnal = records.filter((record) => {
    const date = new Date(record.ts)
    const hour = timezoneMode === 'utc' ? date.getUTCHours() : date.getHours()
    return hour >= 22 || hour < 4
  }).length
  const artistCounts = new Map<string, number>()
  const countryCounts = new Map<string, number>()
  for (const record of records) {
    const artist = record.master_metadata_album_artist_name || 'Unknown Artist'
    artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1)
    const country = record.conn_country || 'ZZ'
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1)
  }
  const top10ArtistShare = [...artistCounts.values()]
    .sort((a, b) => b - a)
    .slice(0, 10)
    .reduce((sum, value) => sum + value, 0) / Math.max(1, totalPlays)
  const topCountry = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const travelShare = topCountry
    ? 1 - ((countryCounts.get(topCountry) ?? 0) / Math.max(1, totalPlays))
    : 0

  return {
    totalPlays,
    skipRate: skipped / Math.max(1, totalPlays),
    shuffleRate: shuffled / Math.max(1, totalPlays),
    nocturnalShare: nocturnal / Math.max(1, totalPlays),
    top10ArtistShare,
    eclecticism: entropy([...artistCounts.values()]),
    travelShare,
  }
}

export function runCounterfactualsModule(snapshot: LabDatasetSnapshot) {
  const startedAt = getStartTime()
  if (snapshot.records.length < 20) {
    return unsupportedResult<CounterfactualsPayload>({
      moduleId: 'counterfactuals',
      startedAt,
      message: 'Need at least 20 records for counterfactual deltas to be informative.',
      sourceFields: ['records', 'summary', 'contextAnalytics'],
      assumptions: ['Train A counterfactuals are lightweight descriptive simulations.'],
    })
  }

  const baseline = computeLiteSummary(snapshot.records, snapshot.timezoneMode)

  type ScenarioId = CounterfactualsPayload['scenarios'][number]['id']
  interface ScenarioSpec {
    id: ScenarioId
    label: string
    filter: (record: LabDatasetSnapshot['records'][number]) => boolean
    eligibleWhen: boolean
    note: string
  }

  const scenarios: CounterfactualsPayload['scenarios'] = ([
    {
      id: 'no-skips',
      label: 'No Skips',
      filter: (record: LabDatasetSnapshot['records'][number]) => !record.skipped,
      eligibleWhen: snapshot.records.some((record) => record.skipped),
      note: 'Excludes skipped rows from the descriptive summary baseline.',
    },
    {
      id: 'no-shuffle',
      label: 'No Shuffle',
      filter: (record: LabDatasetSnapshot['records'][number]) => !record.shuffle,
      eligibleWhen: snapshot.records.some((record) => record.shuffle),
      note: 'Excludes shuffle rows to approximate non-shuffle behavior profile.',
    },
    {
      id: 'travel-removed',
      label: 'Travel Removed',
      filter: (record: LabDatasetSnapshot['records'][number]) => {
        const home = snapshot.contextAnalytics.country.homeCountry
        return home ? (record.conn_country || 'ZZ') === home : true
      },
      eligibleWhen: snapshot.contextAnalytics.country.homeCountry !== null,
      note: 'Keeps rows from home-country footprint only (heuristic).',
    },
    {
      id: 'night-removed',
      label: 'Night Removed',
      filter: (record: LabDatasetSnapshot['records'][number]) => {
        const date = new Date(record.ts)
        const hour = snapshot.timezoneMode === 'utc' ? date.getUTCHours() : date.getHours()
        return !(hour >= 22 || hour < 4)
      },
      eligibleWhen: snapshot.summary.nocturnalShare > 0,
      note: 'Excludes late-night listening rows (22:00-03:59).',
    },
  ] satisfies ScenarioSpec[]).map((scenario) => {
    const filtered = snapshot.records.filter(scenario.filter)
    const eligibility = !scenario.eligibleWhen
      ? 'unsupported'
      : filtered.length === snapshot.records.length
        ? 'partial'
        : filtered.length < 10
          ? 'partial'
          : 'eligible'
    const simulated = filtered.length > 0 ? computeLiteSummary(filtered, snapshot.timezoneMode) : baseline
    const notes = [scenario.note]
    if (eligibility !== 'eligible') {
      notes.push(eligibility === 'unsupported' ? 'Source data does not contain enough qualifying rows.' : 'Simulation is partial due to low or unchanged qualifying rows.')
    }
    if (scenario.id === 'travel-removed') {
      notes.push(`Travel share (internal check): baseline ${Math.round(baseline.travelShare * 100)}% → ${Math.round(simulated.travelShare * 100)}%`)
    }
    return {
      id: scenario.id,
      label: scenario.label,
      eligibility,
      summaryDelta: {
        totalPlaysDelta: simulated.totalPlays - baseline.totalPlays,
        skipRateDelta: round(simulated.skipRate - baseline.skipRate, 4),
        shuffleRateDelta: round(simulated.shuffleRate - baseline.shuffleRate, 4),
        nocturnalShareDelta: round(simulated.nocturnalShare - baseline.nocturnalShare, 4),
        top10ArtistShareDelta: round(simulated.top10ArtistShare - baseline.top10ArtistShare, 4),
        eclecticismDelta: round(simulated.eclecticism - baseline.eclecticism, 4),
      },
      notes,
    }
  })

  const confidence = confidenceFromValue(
    Math.min(0.88, (snapshot.records.length / 5000) * 0.6 + (scenarios.filter((s) => s.eligibility === 'eligible').length / 4) * 0.4),
    [
      `${snapshot.records.length} records in baseline simulation`,
      `${scenarios.filter((scenario) => scenario.eligibility === 'eligible').length} eligible scenarios`,
      'Descriptive lightweight recalculation (not predictive, not causal).',
    ],
  )

  return readyResult({
    moduleId: 'counterfactuals',
    startedAt,
    payload: { scenarios },
    confidence,
    sourceFields: ['records', 'summary', 'contextAnalytics.country'],
    method: 'descriptive heuristic counterfactual filtering with lightweight summary recomputation',
    assumptions: [
      'Train A counterfactuals exclude rows and recompute a small summary subset instead of full pipeline reruns.',
      'Travel removal uses current home-country heuristic from core context analytics.',
    ],
    warnings: scenarios.some((scenario) => scenario.eligibility !== 'eligible') ? ['One or more counterfactual scenarios are partial or unsupported.'] : [],
    message: `Computed ${scenarios.length} counterfactual scenarios.`,
  })
}
