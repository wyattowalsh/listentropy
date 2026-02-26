import { SHARE_CARD_NAMES } from '@/lib/constants'
import type { SharePreset } from '@/lib/types'

export const SHARE_PRESETS: SharePreset[] = [
  {
    id: 'headline-stats',
    label: 'Headline Stats',
    description: 'Fast shareable brag with headline stats and persona.',
    selectedCards: ['title', 'numbers', 'archetype', 'top-artists'],
    copyTone: 'bold',
  },
  {
    id: 'detailed-stats',
    label: 'Detailed Stats',
    description: 'Broader story arc with context and behavior cards.',
    selectedCards: [...SHARE_CARD_NAMES],
    copyTone: 'detailed',
  },
  {
    id: 'anonymous-highlights',
    label: 'Anonymous Highlights',
    description: 'Privacy-friendly highlights focused on non-identifying signals.',
    selectedCards: ['title', 'numbers', 'clock', 'archetype', 'travel-footprint', 'offline-private'],
    copyTone: 'anonymous',
  },
]

export const DEFAULT_SHARE_PRESET = SHARE_PRESETS[1]

export function getSharePresetById(id: string): SharePreset {
  return SHARE_PRESETS.find((preset) => preset.id === id) ?? DEFAULT_SHARE_PRESET
}

