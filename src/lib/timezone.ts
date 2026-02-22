import { getISOWeek, getISOWeekYear } from 'date-fns'

import type { DaypartKey, TimezoneMode } from '@/lib/types'

function utcWeekParts(date: Date): { weekYear: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day + 3)

  const weekYear = d.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)

  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / 604_800_000)
  return { weekYear, week }
}

export function getModeYear(date: Date, timezoneMode: TimezoneMode): number {
  return timezoneMode === 'utc' ? date.getUTCFullYear() : date.getFullYear()
}

export function getModeMonth(date: Date, timezoneMode: TimezoneMode): number {
  return timezoneMode === 'utc' ? date.getUTCMonth() : date.getMonth()
}

export function getModeDate(date: Date, timezoneMode: TimezoneMode): number {
  return timezoneMode === 'utc' ? date.getUTCDate() : date.getDate()
}

export function getModeDay(date: Date, timezoneMode: TimezoneMode): number {
  return timezoneMode === 'utc' ? date.getUTCDay() : date.getDay()
}

export function getModeHour(date: Date, timezoneMode: TimezoneMode): number {
  return timezoneMode === 'utc' ? date.getUTCHours() : date.getHours()
}

export function toModeMonthKey(date: Date, timezoneMode: TimezoneMode): string {
  return `${getModeYear(date, timezoneMode)}-${String(getModeMonth(date, timezoneMode) + 1).padStart(2, '0')}`
}

export function toModeDateKey(date: Date, timezoneMode: TimezoneMode): string {
  return `${getModeYear(date, timezoneMode)}-${String(getModeMonth(date, timezoneMode) + 1).padStart(2, '0')}-${String(getModeDate(date, timezoneMode)).padStart(2, '0')}`
}

export function toModeIsoWeekKey(date: Date, timezoneMode: TimezoneMode): string {
  const parts =
    timezoneMode === 'utc'
      ? utcWeekParts(date)
      : { weekYear: getISOWeekYear(date), week: getISOWeek(date) }
  return `${parts.weekYear}-W${String(parts.week).padStart(2, '0')}`
}

export function getDaypartForHour(hour: number): DaypartKey {
  if (hour < 6) {
    return 'late-night'
  }
  if (hour < 12) {
    return 'morning'
  }
  if (hour < 18) {
    return 'afternoon'
  }
  return 'evening'
}

