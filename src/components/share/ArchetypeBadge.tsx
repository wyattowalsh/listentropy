import type { ArchetypeScore } from '@/lib/types'

interface ArchetypeBadgeProps {
  archetype: ArchetypeScore
}

export function ArchetypeBadge({ archetype }: ArchetypeBadgeProps): JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-hover px-3 py-1 text-xs font-semibold text-text">
      <span>{archetype.emoji}</span>
      <span>{archetype.label}</span>
    </span>
  )
}
