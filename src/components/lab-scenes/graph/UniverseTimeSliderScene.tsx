import { useMemo, useState } from 'react'

import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { LabDatasetSnapshot } from '@/lib/types'
import { buildGraphTimeSlices } from '@/lib/labs/graph-time-slices'
import { formatCompact } from '@/lib/utils'

interface UniverseTimeSliderSceneProps {
  snapshot: LabDatasetSnapshot
}

export function UniverseTimeSliderScene({ snapshot }: UniverseTimeSliderSceneProps): JSX.Element {
  const slices = useMemo(() => buildGraphTimeSlices(snapshot), [snapshot])
  const [index, setIndex] = useState(0)

  if (slices.length === 0) {
    return (
      <Card>
        <CardTitle>Universe Time Slider</CardTitle>
        <CardDescription className="mt-2">Not enough yearly history to render time slices.</CardDescription>
      </Card>
    )
  }

  const safeIndex = Math.min(index, slices.length - 1)
  const active = slices[safeIndex]

  return (
    <Card className="min-w-0">
      <CardTitle>Universe Time Slider</CardTitle>
      <CardDescription className="mt-1">
        Train A heuristic view of graph evolution using yearly intensity, diversity, and bridge pressure.
      </CardDescription>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <input
            className="w-full accent-[var(--color-accent)]"
            type="range"
            min={0}
            max={Math.max(0, slices.length - 1)}
            step={1}
            value={safeIndex}
            onChange={(event) => setIndex(Number(event.currentTarget.value))}
            aria-label="Select yearly graph slice"
          />
          <div className="mt-3 overflow-x-auto">
            <svg width={640} height={240} role="img" aria-label="Yearly graph slice trend lines">
              <line x1={40} y1={200} x2={620} y2={200} stroke="var(--color-border)" />
              <line x1={40} y1={20} x2={40} y2={200} stroke="var(--color-border)" />
              {slices.map((slice, sliceIndex) => {
                const x = 60 + (sliceIndex / Math.max(1, slices.length - 1)) * 540
                const yIntensity = 200 - slice.normalizedIntensity * 160
                const yDiversity = 200 - slice.normalizedDiversity * 160
                const yBridge = 200 - slice.estimatedBridgePressure * 160
                const activeStroke = sliceIndex === safeIndex ? 1 : 0.45
                return (
                  <g key={slice.year}>
                    <text x={x} y={216} fontSize="10" textAnchor="middle" fill="var(--color-text-muted)">{slice.year}</text>
                    <circle cx={x} cy={yIntensity} r={4} fill="var(--color-chart-0)" opacity={activeStroke} />
                    <circle cx={x} cy={yDiversity} r={4} fill="var(--color-chart-1)" opacity={activeStroke} />
                    <circle cx={x} cy={yBridge} r={4} fill="var(--color-chart-2)" opacity={activeStroke} />
                  </g>
                )
              })}
            </svg>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
            <span className="rounded-theme border border-border px-2 py-1">Intensity (chart-0)</span>
            <span className="rounded-theme border border-border px-2 py-1">Diversity (chart-1)</span>
            <span className="rounded-theme border border-border px-2 py-1">Bridge Pressure (chart-2)</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Active slice</p>
            <p className="mt-1 text-lg text-text">{active.year}</p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Plays</p>
            <p className="mt-1 text-sm text-text">{formatCompact(active.plays)}</p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Unique artists</p>
            <p className="mt-1 text-sm text-text">{formatCompact(active.uniqueArtists)}</p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-3">
            <p className="text-xs text-text-muted">Estimated bridge pressure</p>
            <p className="mt-1 text-sm text-text">{Math.round(active.estimatedBridgePressure * 100)}%</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
