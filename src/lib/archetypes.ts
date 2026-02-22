import type {
  ArchetypeKey,
  ArchetypeResult,
  ArchetypeScore,
  ProcessedDataSummary,
} from './types'

interface ArchetypeDefinition {
  key: ArchetypeKey
  label: string
  emoji: string
  score: (summary: ProcessedDataSummary) => number
  rationale: (summary: ProcessedDataSummary) => string
}

const archetypes: ArchetypeDefinition[] = [
  {
    key: 'night-owl',
    label: 'Night Owl',
    emoji: '🌙',
    score: (s) => s.nocturnalShare,
    rationale: (s) => `${Math.round(s.nocturnalShare * 100)}% of plays happen after 10PM.`,
  },
  {
    key: 'dawn-patrol',
    label: 'Dawn Patrol',
    emoji: '🌅',
    score: (s) => Math.max(0, 1 - s.nocturnalShare - 0.3),
    rationale: () => 'Early-day listening dominates your routine.',
  },
  {
    key: 'obsessive',
    label: 'The Obsessive',
    emoji: '🔁',
    score: (s) => Math.min(1, s.topTrackPlayCount / 500),
    rationale: (s) => `Your top track has ${s.topTrackPlayCount} plays.`,
  },
  {
    key: 'explorer',
    label: 'The Explorer',
    emoji: '🗺️',
    score: (s) => Math.min(1, s.uniqueArtists / 5000 + (1 - s.top10ArtistShare)),
    rationale: (s) => `${s.uniqueArtists.toLocaleString()} unique artists across your history.`,
  },
  {
    key: 'loyalist',
    label: 'The Loyalist',
    emoji: '🏔️',
    score: (s) => s.top20ArtistShare,
    rationale: (s) => `${Math.round(s.top20ArtistShare * 100)}% of plays stay with your top artists.`,
  },
  {
    key: 'skipper',
    label: 'The Skipper',
    emoji: '⏭️',
    score: (s) => s.skipRate,
    rationale: (s) => `${Math.round(s.skipRate * 100)}% skip rate.`,
  },
  {
    key: 'shuffle-brain',
    label: 'Shuffle Brain',
    emoji: '🔀',
    score: (s) => s.shuffleRate,
    rationale: (s) => `${Math.round(s.shuffleRate * 100)}% of listens use shuffle.`,
  },
  {
    key: 'streamer',
    label: 'The Streamer',
    emoji: '📡',
    score: (s) => Math.min(1, s.totalHours / 1000),
    rationale: (s) => `${Math.round(s.totalHours).toLocaleString()} total hours streamed.`,
  },
  {
    key: 'binger',
    label: 'The Binger',
    emoji: '⚡',
    score: (s) => s.bingeFactor,
    rationale: (s) => `Binge factor score: ${Math.round(s.bingeFactor * 100)}.`,
  },
  {
    key: 'genre-fluid',
    label: 'Genre Fluid',
    emoji: '🎭',
    score: (s) => s.eclecticism,
    rationale: (s) => `Eclecticism score: ${Math.round(s.eclecticism * 100)}.`,
  },
  {
    key: 'archivist',
    label: 'The Archivist',
    emoji: '🏛️',
    score: (s) => Math.min(1, s.yearsCovered / 10),
    rationale: (s) => `${s.yearsCovered} years of listening history.`,
  },
  {
    key: 'curator',
    label: 'The Curator',
    emoji: '🎯',
    score: (s) => Math.min(1, (1 - s.shuffleRate) * (s.sessionDepthAvg / 10)),
    rationale: (s) => `Low-shuffle deep sessions (${s.sessionDepthAvg.toFixed(1)} tracks/session).`,
  },
]

const FORCE_PRIORITY: ArchetypeKey[] = ['skipper', 'obsessive', 'night-owl']
const TIE_BREAK_PRIORITY: ArchetypeKey[] = [
  'night-owl',
  'dawn-patrol',
  'obsessive',
  'explorer',
  'loyalist',
  'skipper',
  'shuffle-brain',
  'streamer',
  'binger',
  'genre-fluid',
  'archivist',
  'curator',
]

function toScore(definition: ArchetypeDefinition, summary: ProcessedDataSummary): ArchetypeScore {
  return {
    key: definition.key,
    label: definition.label,
    emoji: definition.emoji,
    score: Number(definition.score(summary).toFixed(4)),
    rationale: definition.rationale(summary),
  }
}

export function computeArchetypes(summary: ProcessedDataSummary): ArchetypeResult {
  const scored = archetypes.map((definition) => toScore(definition, summary))
  const tieBreakOrder = new Map(TIE_BREAK_PRIORITY.map((key, index) => [key, index]))

  const forcedPrimary = FORCE_PRIORITY.find((key) => {
    if (key === 'skipper') {
      return summary.skipRate > 0.4
    }
    if (key === 'obsessive') {
      return summary.topTrackPlayCount > 500
    }
    if (key === 'night-owl') {
      return summary.nocturnalShare > 0.4
    }
    return false
  })

  const sorted = [...scored].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }
    return (tieBreakOrder.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
      (tieBreakOrder.get(b.key) ?? Number.MAX_SAFE_INTEGER)
  })
  const topScore = sorted[0]?.score ?? 0
  const tiedTop = sorted.filter((item) => item.score === topScore)
  const tieBreakUsed = tiedTop.length > 1

  if (forcedPrimary) {
    const primary = sorted.find((item) => item.key === forcedPrimary) ?? sorted[0]
    const secondary = sorted.filter((item) => item.key !== forcedPrimary).slice(0, 2)
    return {
      primary,
      secondary,
      allScores: sorted,
      tieBreak: {
        used: tieBreakUsed,
        reason: tieBreakUsed
          ? 'Multiple archetypes had identical top scores; deterministic key priority applied.'
          : 'Force-priority rule applied based on explicit threshold.',
      },
    }
  }

  return {
    primary: sorted[0],
    secondary: sorted.slice(1, 3),
    allScores: sorted,
    tieBreak: {
      used: tieBreakUsed,
      reason: tieBreakUsed
        ? 'Multiple archetypes had identical top scores; deterministic key priority applied.'
        : 'Highest score selected without tie.',
    },
  }
}
