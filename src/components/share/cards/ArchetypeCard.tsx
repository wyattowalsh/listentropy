import { ArchetypeBadge } from '@/components/share/ArchetypeBadge'
import type { ProcessedDataModel } from '@/lib/types'

interface ArchetypeCardProps {
  data: ProcessedDataModel
}

export function ArchetypeCard({ data }: ArchetypeCardProps): JSX.Element {
  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">Listener Archetype</h3>
      <div className="mt-8">
        <ArchetypeBadge archetype={data.archetypes.primary} />
      </div>
      <p className="mt-5 max-w-xl text-lg text-text-muted">{data.archetypes.primary.rationale}</p>
      <div className="mt-10 flex flex-wrap gap-2">
        {data.archetypes.secondary.map((secondary) => (
          <ArchetypeBadge key={secondary.key} archetype={secondary} />
        ))}
      </div>
    </div>
  )
}
