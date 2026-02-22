import { SHARE_CARD_NAMES } from '@/lib/constants'

export const STORY_CARD_ORDER = SHARE_CARD_NAMES
export type StoryCardKey = (typeof STORY_CARD_ORDER)[number]
