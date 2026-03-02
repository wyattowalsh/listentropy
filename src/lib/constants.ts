export const MIN_VALID_LISTEN_MS = 30_000
export const SESSION_GAP_MINUTES = 30
export const FORGOTTEN_GEM_MIN_PLAYS = 10
export const FORGOTTEN_GEM_YEARS = 2
export const RECENT_INACTIVITY_MONTHS = 12
export const DEFAULT_MAX_GRAPH_NODES = 400
export const SHARE_CARD_REGISTRY = [
  { key: 'title', title: 'Title' },
  { key: 'top-artists', title: 'Top Artists' },
  { key: 'top-tracks', title: 'Top Tracks' },
  { key: 'clock', title: 'The Clock' },
  { key: 'streak', title: 'The Streak' },
  { key: 'guilty-pleasures', title: 'Guilty Pleasures' },
  { key: 'forgotten-gem', title: 'Forgotten Gem' },
  { key: 'archetype', title: 'Personality' },
  { key: 'numbers', title: 'By The Numbers' },
  { key: 'fingerprint', title: 'Taste Fingerprint' },
  { key: 'travel-footprint', title: 'Travel Footprint' },
  { key: 'intent-signature', title: 'Intent Signature' },
  { key: 'device-journey', title: 'Device Journey' },
  { key: 'offline-private', title: 'Offline & Private Moments' },
] as const

export const SHARE_CARD_NAMES: ReadonlyArray<(typeof SHARE_CARD_REGISTRY)[number]['key']> = SHARE_CARD_REGISTRY.map(
  (card) => card.key,
)

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
