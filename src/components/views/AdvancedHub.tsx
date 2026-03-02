import { useState } from 'react'

import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { ArtistDeepDive } from '@/components/views/ArtistDeepDive'
import { LabWorkbench } from '@/components/views/LabWorkbench'
import { MusicUniverse } from '@/components/views/MusicUniverse'
import { PluginExtras } from '@/components/views/PluginExtras'
import type { ProcessedDataModel } from '@/lib/types'

export type AdvancedHubSection = 'lab' | 'network' | 'artist' | 'plugins'
export type AdvancedHubAnalysisMode = 'simple' | 'deep'

interface AdvancedHubProps {
  data: ProcessedDataModel
  section?: AdvancedHubSection
  onSectionChange?: (section: AdvancedHubSection) => void
}

const SECTION_LABELS: Record<AdvancedHubSection, string> = {
  lab: 'Lab',
  network: 'Network',
  artist: 'Artist Search',
  plugins: 'Plugins',
}

export function AdvancedHub({
  data,
  section,
  onSectionChange,
}: AdvancedHubProps): JSX.Element {
  const [internalSection, setInternalSection] = useState<AdvancedHubSection>('lab')
  const [analysisMode, setAnalysisMode] = useState<AdvancedHubAnalysisMode>('simple')
  const activeSection = section ?? internalSection

  function selectSection(next: AdvancedHubSection): void {
    onSectionChange?.(next)
    if (section === undefined) {
      setInternalSection(next)
    }
  }

  let content: JSX.Element
  if (activeSection === 'network') {
    content = <MusicUniverse data={data} analysisMode={analysisMode} />
  } else if (activeSection === 'artist') {
    content = <ArtistDeepDive data={data} analysisMode={analysisMode} />
  } else if (activeSection === 'plugins') {
    content = <PluginExtras data={data} analysisMode={analysisMode} />
  } else {
    content = <LabWorkbench data={data} analysisMode={analysisMode} />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle as="h2">Advanced</CardTitle>
        <CardDescription className="mt-1">
          Experimental tools, deep inspection, and developer-oriented surfaces.
        </CardDescription>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label htmlFor="advanced-hub-section" className="text-xs text-text-muted">
            Section
          </label>
          <Select
            id="advanced-hub-section"
            aria-label="Advanced section"
            className="min-w-[14rem]"
            value={activeSection}
            onChange={(event) => selectSection(event.currentTarget.value as AdvancedHubSection)}
          >
            <option value="lab">{SECTION_LABELS.lab}</option>
            <option value="network">{SECTION_LABELS.network}</option>
            <option value="artist">{SECTION_LABELS.artist}</option>
            <option value="plugins">{SECTION_LABELS.plugins}</option>
          </Select>
          <fieldset className="flex items-center gap-1" aria-label="Analysis depth">
            <legend className="sr-only">Analysis mode</legend>
            <button
              type="button"
              aria-pressed={analysisMode === 'simple'}
              className={`min-h-10 rounded-theme border px-3 py-2 text-xs uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                analysisMode === 'simple'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-muted hover:text-text'
              }`}
              onClick={() => setAnalysisMode('simple')}
            >
              Simple
            </button>
            <button
              type="button"
              aria-pressed={analysisMode === 'deep'}
              className={`min-h-10 rounded-theme border px-3 py-2 text-xs uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] ${
                analysisMode === 'deep'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-text-muted hover:text-text'
              }`}
              onClick={() => setAnalysisMode('deep')}
            >
              Deep
            </button>
          </fieldset>
        </div>
      </Card>

      <div data-testid={`advanced-section-${activeSection}`}>
        {content}
      </div>
    </div>
  )
}
