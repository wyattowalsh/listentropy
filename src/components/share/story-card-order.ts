import { SHARE_CARD_NAMES, SHARE_CARD_REGISTRY } from '@/lib/constants'

export const STORY_CARD_ORDER = SHARE_CARD_NAMES
export const STORY_CARD_REGISTRY = SHARE_CARD_REGISTRY
export type StoryCardKey = (typeof STORY_CARD_ORDER)[number]
