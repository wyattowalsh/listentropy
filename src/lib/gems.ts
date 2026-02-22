import { differenceInYears } from 'date-fns'

import {
  FORGOTTEN_GEM_MIN_PLAYS,
  FORGOTTEN_GEM_YEARS,
  RECENT_INACTIVITY_MONTHS,
} from './constants'
import type { ForgottenGem, StreamRecord } from './types'

interface TrackAccumulator {
  track: string
  artist: string
  totalPlays: number
  monthlyPlays: Map<string, number>
  lastPlayed: string
}

function monthDiff(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
}

export function computeForgottenGems(records: StreamRecord[]): ForgottenGem[] {
  const grouped = new Map<string, TrackAccumulator>()
  for (const record of records) {
    if (!record.master_metadata_track_name || !record.master_metadata_album_artist_name) {
      continue
    }
    const key = `${record.master_metadata_track_name}::${record.master_metadata_album_artist_name}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        track: record.master_metadata_track_name,
        artist: record.master_metadata_album_artist_name,
        totalPlays: 0,
        monthlyPlays: new Map(),
        lastPlayed: record.ts,
      })
    }
    const item = grouped.get(key)!
    item.totalPlays += 1
    const month = record.ts.slice(0, 7)
    item.monthlyPlays.set(month, (item.monthlyPlays.get(month) ?? 0) + 1)
    if (new Date(record.ts).getTime() > new Date(item.lastPlayed).getTime()) {
      item.lastPlayed = record.ts
    }
  }

  const now = new Date()
  const inactivityCutoff = new Date(now)
  inactivityCutoff.setMonth(now.getMonth() - RECENT_INACTIVITY_MONTHS)

  return [...grouped.entries()]
    .map(([key, value]) => {
      const sortedPeaks = [...value.monthlyPlays.entries()].sort((a, b) => b[1] - a[1])
      const [peakPeriod, peakPlays] = sortedPeaks[0] ?? ['unknown', 0]
      const peakDate = new Date(`${peakPeriod}-01T00:00:00Z`)
      const yearsSinceLastPlay = differenceInYears(now, new Date(value.lastPlayed))
      const playsLast12Months = [...value.monthlyPlays.entries()].reduce((sum, [month, plays]) => {
        const monthDate = new Date(`${month}-01T00:00:00Z`)
        return monthDiff(monthDate, now) <= RECENT_INACTIVITY_MONTHS ? sum + plays : sum
      }, 0)

      return {
        key,
        track: value.track,
        artist: value.artist,
        totalPlays: value.totalPlays,
        peakPlays,
        peakPeriod,
        lastPlayed: value.lastPlayed,
        yearsSinceLastPlay,
        playsLast12Months,
        peakDate,
      }
    })
    .filter((candidate) => {
      const lastPlayedDate = new Date(candidate.lastPlayed)
      const peakOldEnough = differenceInYears(now, candidate.peakDate) >= FORGOTTEN_GEM_YEARS
      return (
        candidate.totalPlays >= FORGOTTEN_GEM_MIN_PLAYS &&
        peakOldEnough &&
        candidate.playsLast12Months <= 1 &&
        lastPlayedDate.getTime() < inactivityCutoff.getTime()
      )
    })
    .sort((a, b) => b.peakPlays - a.peakPlays || b.totalPlays - a.totalPlays)
    .map((candidate) => ({
      key: candidate.key,
      track: candidate.track,
      artist: candidate.artist,
      totalPlays: candidate.totalPlays,
      peakPlays: candidate.peakPlays,
      peakPeriod: candidate.peakPeriod,
      lastPlayed: candidate.lastPlayed,
      yearsSinceLastPlay: candidate.yearsSinceLastPlay,
    }))
}
