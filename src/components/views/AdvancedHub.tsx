import { useState } from 'react'

import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { ArtistDeepDive } from '@/components/views/ArtistDeepDive'
import { LabWorkbench } from '@/components/views/LabWorkbench'
import { MusicUniverse } from '@/components/views/MusicUniverse'
import { PluginExtras } from '@/components/views/PluginExtras'
import type { ProcessedDataModel } from '@/lib/types'

export type AdvancedHubSection = 'lab' | 'network' | 'artist' | 'plugins'

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
  const activeSection = section ?? internalSection

  function selectSection(next: AdvancedHubSection): void {
    onSectionChange?.(next)
    if (section === undefined) {
      setInternalSection(next)
    }
  }

  let content: JSX.Element
  if (activeSection === 'network') {
    content = <MusicUniverse data={data} />
  } else if (activeSection === 'artist') {
    content = <ArtistDeepDive data={data} />
  } else if (activeSection === 'plugins') {
    content = <PluginExtras data={data} />
  } else {
    content = <LabWorkbench data={data} />
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Advanced</CardTitle>
        <CardDescription className="mt-1">
          Experimental tools, deep inspection, and developer-oriented surfaces.
        </CardDescription>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
        </div>
      </Card>

      <div data-testid={`advanced-section-${activeSection}`}>
        {content}
      </div>
    </div>
  )
}
