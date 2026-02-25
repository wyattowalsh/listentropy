import { getDaypartForHour, toModeMonthKey } from '@/lib/timezone'
import type {
  ConfidenceScore,
  DaypartKey,
  InsightProvenance,
  LabDatasetSnapshot,
  LabModuleId,
  LabModuleResult,
} from '@/lib/types'

export function round(value: number, digits = 3): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function confidenceFromValue(value: number, reasons: string[]): ConfidenceScore {
  const clamped = clamp01(value)
  return {
    value: round(clamped, 3),
    label: clamped >= 0.75 ? 'high' : clamped >= 0.45 ? 'medium' : 'low',
    reasons,
  }
}

export function buildProvenance(args: {
  moduleId: LabModuleId
  startedAt: number
  sourceFields: string[]
  method: string
  assumptions: string[]
  warnings?: string[]
}): InsightProvenance {
  const end =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()
  return {
    moduleId: args.moduleId,
    computedAt: new Date().toISOString(),
    durationMs: Math.max(0, Math.round(end - args.startedAt)),
    sourceFields: args.sourceFields,
    method: args.method,
    assumptions: args.assumptions,
    warnings: args.warnings ?? [],
  }
}

export function unsupportedResult<TPayload = unknown>(args: {
  moduleId: LabModuleId
  startedAt: number
  message: string
  sourceFields: string[]
  assumptions?: string[]
  warnings?: string[]
}): LabModuleResult<TPayload> {
  return {
    id: args.moduleId,
    status: 'unsupported',
    message: args.message,
    confidence: confidenceFromValue(0.2, ['Insufficient data density for this module.']),
    provenance: buildProvenance({
      moduleId: args.moduleId,
      startedAt: args.startedAt,
      sourceFields: args.sourceFields,
      method: 'descriptive heuristic (unsupported fallback)',
      assumptions: args.assumptions ?? [],
      warnings: [args.message, ...(args.warnings ?? [])],
    }),
  }
}

export function readyResult<TPayload>(args: {
  moduleId: LabModuleId
  startedAt: number
  payload: TPayload
  confidence: ConfidenceScore
  sourceFields: string[]
  method: string
  assumptions: string[]
  warnings?: string[]
  message?: string
}): LabModuleResult<TPayload> {
  return {
    id: args.moduleId,
    status: 'ready',
    payload: args.payload,
    message: args.message,
    confidence: args.confidence,
    provenance: buildProvenance({
      moduleId: args.moduleId,
      startedAt: args.startedAt,
      sourceFields: args.sourceFields,
      method: args.method,
      assumptions: args.assumptions,
      warnings: args.warnings,
    }),
  }
}

export function getStartTime(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

export function monthKeyForTs(ts: string, timezoneMode: LabDatasetSnapshot['timezoneMode']): string {
  return toModeMonthKey(new Date(ts), timezoneMode)
}

export function daypartForTs(ts: string, timezoneMode: LabDatasetSnapshot['timezoneMode']): DaypartKey {
  const date = new Date(ts)
  const hour = timezoneMode === 'utc' ? date.getUTCHours() : date.getHours()
  return getDaypartForHour(hour)
}

export function countBy<T>(items: T[], keyFn: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

export function topShareList(
  map: Map<string, number>,
  total: number,
  limit: number,
): Array<{ label: string; count: number; share: number }> {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count, share: count / Math.max(1, total) }))
}
