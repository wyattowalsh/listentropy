export type ContentType = 'music' | 'podcast' | 'audiobook'
export type TimezoneMode = 'local' | 'utc'
export type ExperienceLevel = 'guided' | 'advanced'
export type ThemeKey = 'spotify-dark' | 'editorial-light' | 'brutalist' | 'midnight'
export type SharePresetId = 'quick-flex' | 'deep-stats' | 'anonymous-brag'

export type PlatformCategory =
  | 'iOS'
  | 'macOS'
  | 'Android'
  | 'Web'
  | 'Windows'
  | 'Xbox'
  | 'Smart TV / Cast'
  | 'Other'

export interface RawSpotifyRecord {
  ts: string
  platform: string
  ms_played: number
  conn_country: string
  ip_addr: string
  master_metadata_track_name: string | null
  master_metadata_album_artist_name: string | null
  master_metadata_album_album_name: string | null
  spotify_track_uri: string | null
  episode_name: string | null
  episode_show_name: string | null
  spotify_episode_uri: string | null
  audiobook_title: string | null
  audiobook_uri: string | null
  audiobook_chapter_uri: string | null
  audiobook_chapter_title: string | null
  reason_start: string
  reason_end: string
  shuffle: boolean
  skipped: boolean | null
  offline: boolean
  offline_timestamp: number | null
  incognito_mode: boolean
}

export interface StreamRecord extends Omit<RawSpotifyRecord, 'ip_addr' | 'skipped'> {
  skipped: boolean
  content_type: ContentType
}

export interface ArtistStats {
  key: string
  name: string
  plays: number
  totalMs: number
  hours: number
  firstListen: string
  lastListen: string
  skipRate: number
}

export interface TrackStats {
  key: string
  name: string
  artist: string
  plays: number
  totalMs: number
  hours: number
  firstListen: string
  lastListen: string
  skipRate: number
}

export interface AlbumStats {
  key: string
  name: string
  artist: string
  plays: number
  totalMs: number
  hours: number
  firstListen: string
  lastListen: string
}

export interface TimeBucket {
  key: string
  date: string
  plays: number
  totalMs: number
  uniqueArtists: number
}

export interface PlatformStats {
  platform: PlatformCategory
  plays: number
  totalMs: number
}

export interface SessionData {
  id: string
  startTime: string
  endTime: string
  trackCount: number
  totalMs: number
  platform: PlatformCategory
  tracks: string[]
}

export interface SkipStats {
  overall: number
  byHour: number[]
  byArtist: Array<{ name: string; skipRate: number; plays: number }>
}

export interface MonthlyBehaviorPoint {
  key: string
  plays: number
  skipRate: number
  shuffleRate: number
  offlineRate: number
  incognitoRate: number
}

export type ArtistMonthlyTrends = Record<string, Record<string, number>>

export interface CountryAnalytics {
  homeCountry: string | null
  topCountries: Array<{ country: string; plays: number; totalMs: number; share: number }>
  domesticShare: number
  travelShare: number
  timeline: Array<{ key: string; topCountry: string; totalPlays: number; countryCount: number }>
}

export interface ReasonAnalytics {
  start: Array<{ reason: string; count: number; share: number }>
  end: Array<{ reason: string; count: number; share: number }>
  transitions: Array<{ from: string; to: string; count: number; share: number }>
}

export interface OfflinePrivacyAnalytics {
  offlineRate: number
  incognitoRate: number
  offlineTimestampCoverage: number
  inconsistentOfflineTimestampCount: number
}

export interface DeviceJourneyAnalytics {
  transitions: Array<{ from: PlatformCategory; to: PlatformCategory; count: number; share: number }>
  dominantTransition: { from: PlatformCategory; to: PlatformCategory; count: number; share: number } | null
  crossPlatformSessionShare: number
}

export interface ContextAnalytics {
  country: CountryAnalytics
  reasons: ReasonAnalytics
  offlinePrivacy: OfflinePrivacyAnalytics
  deviceJourney: DeviceJourneyAnalytics
  sessionDayparts: {
    transitions: Array<{ from: DaypartKey; to: DaypartKey; count: number; share: number }>
    dominantTransition: { from: DaypartKey; to: DaypartKey; count: number; share: number } | null
  }
  intentPersistence: {
    longestReasonStartStreak: { reason: string; count: number } | null
    topStartReasonStreaks: Array<{ reason: string; count: number }>
  }
  countryVolatilityIndex: number
}

export type DaypartKey = 'late-night' | 'morning' | 'afternoon' | 'evening'

export interface DataQualitySummary {
  unknownCountryRate: number
  missingTrackNameRate: number
  missingArtistNameRate: number
  missingTrackUriRate: number
  offlineTimestampInconsistencyRate: number
  historySignals: {
    offlineRows: number
    incognitoRows: number
    countriesObserved: number
  }
}

export interface NarrativeInsight {
  id: string
  title: string
  description: string
  confidence: 'low' | 'medium' | 'high'
  why: string[]
  category: 'habit' | 'context' | 'taste' | 'share'
}

export interface EraData {
  id: string
  label: string
  startMonth: string
  endMonth: string
  dominantArtists: string[]
  totalMs: number
  confidence: number
  durationMonths: number
  dominanceScore: number
  diversityScore: number
  changeDrivers: Array<{
    key: 'artist-turnover' | 'dominance-shift' | 'behavior-shift' | 'context-shift' | 'sparse-data'
    weight: number
    description: string
  }>
  topArrivals?: string[]
  topDepartures?: string[]
  transitionFromPrevious?: {
    confidence: number
    summary: string
  }
}

export interface ForgottenGem {
  key: string
  track: string
  artist: string
  peakPlays: number
  totalPlays: number
  peakPeriod: string
  lastPlayed: string
  yearsSinceLastPlay: number
}

export interface GraphNode {
  id: string
  type: 'artist' | 'album' | 'track'
  label: string
  playCount: number
  totalMs: number
  firstListen: string
  cluster?: string
  degree?: number
  weightedDegree?: number
  communityId?: string
  layout?: {
    x: number
    y: number
    z?: number
  }
}

export interface GraphEdge {
  source: string
  target: string
  type: 'contains' | 'co-listened'
  weight: number
  normalizedWeight?: number
  communityBridge?: boolean
}

export interface GraphAnalytics {
  summary: {
    nodeCount: number
    edgeCount: number
    artistCount: number
    trackCount: number
    averageDegree: number
    averageWeightedDegree: number
    connectedComponents: number
    artistTrackRatio: number
  }
  hubs: Array<{
    nodeId: string
    label: string
    type: GraphNode['type']
    degree: number
    weightedDegree: number
    playCount: number
  }>
  bridges: Array<{
    nodeId: string
    label: string
    type: GraphNode['type']
    bridgeScore: number
    bridgeEdgeCount: number
    communityCount: number
  }>
  clusters: Array<{
    communityId: string
    nodeCount: number
    artistCount: number
    trackCount: number
    totalPlayCount: number
    topArtists: string[]
  }>
  motifs: {
    topPairs: Array<{
      sourceId: string
      sourceLabel: string
      targetId: string
      targetLabel: string
      weight: number
    }>
  }
  bridgedEdges: Array<{
    sourceId: string
    targetId: string
    weight: number
    communityBridge: boolean
  }>
}

export type GraphFallbackReason = 'webgl-unsupported' | 'renderer-init-failed' | 'manual'

export interface GraphRendererStatus {
  renderer: '3d' | '2d'
  fallbackReason?: GraphFallbackReason
  state?: 'probing' | '3d-ready' | '3d-failed' | '2d-manual' | '2d-unsupported'
  diagnosticMessage?: string
}

export interface TasteDimension {
  key: string
  label: string
  score: number
}

export interface TasteProfile {
  dimensions: TasteDimension[]
  yearlyFingerprints: Array<{
    year: string
    dimensions: TasteDimension[]
  }>
}

export interface ArchetypeScore {
  key: ArchetypeKey
  label: string
  emoji: string
  score: number
  rationale: string
}

export type ArchetypeKey =
  | 'night-owl'
  | 'dawn-patrol'
  | 'obsessive'
  | 'explorer'
  | 'loyalist'
  | 'skipper'
  | 'shuffle-brain'
  | 'streamer'
  | 'binger'
  | 'genre-fluid'
  | 'archivist'
  | 'curator'

export interface ArchetypeResult {
  primary: ArchetypeScore
  secondary: ArchetypeScore[]
  allScores: ArchetypeScore[]
  tieBreak: {
    used: boolean
    reason: string
  }
}

export interface StageProvenance {
  stage:
    | 'artists'
    | 'tracks'
    | 'albums'
    | 'time-series'
    | 'sessions'
    | 'summary'
    | 'taste'
    | 'archetypes'
    | 'platform'
    | 'graph'
    | 'gems'
    | 'eras'
    | 'skip'
    | 'context'
  durationMs: number
  outputCount: number
}

export interface ProcessingDiagnostics {
  inputRecords: number
  validRecords: number
  droppedRecords: number
  contentMix: Record<ContentType, number>
  warnings: string[]
}

export interface ProcessedDataSummary {
  totalMs: number
  totalPlays: number
  totalHours: number
  uniqueArtists: number
  uniqueTracks: number
  uniqueAlbums: number
  firstListen: string
  lastListen: string
  skipRate: number
  shuffleRate: number
  peakHour: number
  nocturnalShare: number
  longestStreakDays: number
  topTrackPlayCount: number
  top10ArtistShare: number
  top20ArtistShare: number
  bingeFactor: number
  eclecticism: number
  yearsCovered: number
  sessionDepthAvg: number
}

export interface ProcessedDataModel {
  timezoneMode: TimezoneMode
  modelVersion: number
  datasetIdentity: DatasetIdentity
  records: StreamRecord[]
  summary: ProcessedDataSummary
  artists: ArtistStats[]
  tracks: TrackStats[]
  albums: AlbumStats[]
  yearly: TimeBucket[]
  monthly: TimeBucket[]
  weekly: TimeBucket[]
  daily: TimeBucket[]
  hours: Array<{ hour: number; plays: number; totalMs: number }>
  dayOfWeek: Array<{ day: string; plays: number; totalMs: number }>
  calendar: Array<{ date: string; plays: number; totalMs: number }>
  platform: PlatformStats[]
  sessions: SessionData[]
  skipStats: SkipStats
  monthlyBehavior: MonthlyBehaviorPoint[]
  artistMonthlyTrends: ArtistMonthlyTrends
  trackUriIndex: Record<string, string>
  contextAnalytics: ContextAnalytics
  dataQuality: DataQualitySummary
  narrativeInsights: NarrativeInsight[]
  eras: EraData[]
  gems: ForgottenGem[]
  graph: { nodes: GraphNode[]; edges: GraphEdge[] }
  graphAnalytics: GraphAnalytics
  taste: TasteProfile
  archetypes: ArchetypeResult
  quickInsights: string[]
  sessionMetricsSnapshot: SessionMetrics
  diagnostics: ProcessingDiagnostics
  stageProvenance: StageProvenance[]
}

export type LabModuleId =
  | 'sequence-motifs'
  | 'ritual-detector'
  | 'chronotype-drift'
  | 'novelty-economics'
  | 'session-archetypes'
  | 'bridge-dynamics'
  | 'era-microshifts'
  | 'compare-engine'
  | 'counterfactuals'
  | 'forecast-lite'
  | 'stability-chaos'
  | 'audio-affect-overlay'

export type LabSceneId =
  | 'intent-sankey'
  | 'chronomap-ridgelines'
  | 'entropy-phase-portrait'
  | 'universe-time-slider'
  | 'era-migration-alluvial'

export type LabModuleStatus = 'idle' | 'running' | 'ready' | 'error' | 'unsupported'
export type LabPerfTier = 'light' | 'medium' | 'heavy'
export type LabModuleCategory = 'sequence' | 'temporal' | 'network' | 'compare' | 'forecast' | 'visual' | 'enrichment'
export type LabOptionalInput = 'spotify-api-token' | 'ics-calendar' | 'weather-csv'

export type SpotifyAuthStatus = 'disconnected' | 'authorizing' | 'connected' | 'refreshing' | 'error'
export type SpotifyTokenSource = 'pkce' | 'manual-token'
export type SpotifyApiCapabilityStatus = 'available' | 'restricted' | 'unauthorized' | 'rate-limited' | 'unknown'

export interface SpotifyAuthSession {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  tokenSource: SpotifyTokenSource
  scopes: string[]
  grantedAt: string
}

export interface SpotifyApiCapabilities {
  audioFeatures: SpotifyApiCapabilityStatus
  tracks: SpotifyApiCapabilityStatus
  artists: SpotifyApiCapabilityStatus
  relatedArtists: SpotifyApiCapabilityStatus
}

export type ProviderCapabilityStatus = SpotifyApiCapabilityStatus

export interface ProviderCapabilities {
  audioTraits: ProviderCapabilityStatus
  tracks: ProviderCapabilityStatus
  artists: ProviderCapabilityStatus
}

export type AudioTraitProviderId = 'spotify-audio-traits' | 'csv-audio-traits'

export type AudioTraitMetricKey =
  | 'danceability'
  | 'energy'
  | 'valence'
  | 'acousticness'
  | 'instrumentalness'
  | 'speechiness'
  | 'tempo'
  | 'liveness'

export type AudioTraitVector = Record<AudioTraitMetricKey, number>

export interface TrackAudioTraitRecord {
  trackId: string
  providerId: AudioTraitProviderId
  traits: AudioTraitVector
  fetchedAt: string
  sourceVersion: string
  tempoBpm?: number
}

export interface AudioTraitCoverage {
  recordRowsTotal: number
  musicRowsEligible: number
  rowsWithTrackUri: number
  rowsMatchedToTrait: number
  rowsCoverageShare: number
  uniqueTrackIdsRequested: number
  uniqueTrackIdsResolved: number
  uniqueTrackCoverageShare: number
  podcastRowsExcluded: number
  localRowsExcluded: number
}

export interface AudioTraitSnapshot {
  providerId: AudioTraitProviderId
  datasetFingerprint: string
  traitsByTrackId: Record<string, TrackAudioTraitRecord>
  coverage: AudioTraitCoverage
  capabilities: SpotifyApiCapabilities | ProviderCapabilities
  warnings: string[]
  provenance: {
    fetchedAt: string
    sourceVersion: string
    providerLabel: string
    tokenSource: SpotifyTokenSource | 'unknown'
    scopes?: string[]
    endpointNotes?: string[]
  }
}

export interface DatasetIdentity {
  id: string
  fingerprint: string
  importedAt: string
  recordCount: number
  timezoneMode: TimezoneMode
}

export interface InsightProvenance {
  moduleId: LabModuleId | 'core'
  computedAt: string
  durationMs: number
  sourceFields: string[]
  method: string
  assumptions: string[]
  warnings: string[]
}

export interface ConfidenceScore {
  value: number
  label: 'low' | 'medium' | 'high'
  reasons: string[]
}

export interface LabModuleManifest {
  id: LabModuleId
  name: string
  category: LabModuleCategory
  perfTier: LabPerfTier
  requiresSpotifyApi?: boolean
  optionalInputs?: LabOptionalInput[]
  dependsOnCore: Array<keyof ProcessedDataModel>
  outputVersion: number
  description: string
  featured?: boolean
  comingSoon?: boolean
}

export interface LabSceneManifest {
  id: LabSceneId
  name: string
  description: string
  perfTier: LabPerfTier
  featured?: boolean
  comingSoon?: boolean
  recommendedModules?: LabModuleId[]
}

export interface LabModuleResult<TPayload = unknown> {
  id: LabModuleId
  status: LabModuleStatus
  payload?: TPayload
  error?: string
  message?: string
  confidence?: ConfidenceScore
  provenance?: InsightProvenance
}

export interface SequenceMotifsPayload {
  motifs: Array<{
    key: string
    type: 'track' | 'artist'
    length: number
    occurrences: number
    sampleSequence: string[]
    distinctSessionCount: number
    recurrenceScore: number
  }>
  surpriseJumps: Array<{
    fromLabel: string
    toLabel: string
    count: number
    rarityScore: number
  }>
  sessionOpeners: Array<{ label: string; count: number; share: number }>
  sessionClosers: Array<{ label: string; count: number; share: number }>
}

export interface RitualDetectorPayload {
  rituals: Array<{
    key: string
    daypart: DaypartKey
    platform: string
    anchorArtist: string
    activeMonths: number
    totalOccurrences: number
    stabilityScore: number
    fragilityScore: number
  }>
  ritualHeatmap: Array<{
    month: string
    ritualKey: string
    occurrences: number
  }>
}

export interface ChronotypeDriftPayload {
  monthlyPeaks: Array<{
    month: string
    peakHour: number
    nocturnalShare: number
    daypartShares: Record<DaypartKey, number>
  }>
  yearlyDrift: Array<{
    year: string
    avgPeakHour: number
    nocturnalShare: number
    stabilityIndex: number
  }>
  driftSummary: {
    peakHourDriftHours: number
    chronotypeDirection: 'earlier' | 'later' | 'stable'
    confidenceBasisMonths: number
  }
}

export interface StabilityChaosPayload {
  monthlyState: Array<{
    month: string
    intensity: number
    diversity: number
    skipRate: number
    chaosScore: number
    stabilityScore: number
  }>
  transitions: Array<{
    fromMonth: string
    toMonth: string
    distance: number
    regimeChange: boolean
  }>
  summary: {
    calmMonths: number
    volatileMonths: number
    maxChaosMonth: string | null
  }
}

export interface NoveltyEconomicsPayload {
  monthlyNovelty: Array<{
    month: string
    uniqueArtists: number
    repeatArtistShare: number
    noveltyScore: number
    loyaltyReboundScore: number
  }>
  cycles: Array<{
    startMonth: string
    endMonth: string
    phase: 'novelty' | 'loyalty' | 'mixed'
    strength: number
  }>
  summary: {
    noveltyDebtIndex: number
    recoveryIndex: number
    dominantMode: 'novelty' | 'loyalty' | 'balanced'
  }
}

export interface EraMicroshiftsPayload {
  microshifts: Array<{
    eraId: string
    eraLabel: string
    month: string
    shiftScore: number
    drivers: Array<'artist-turnover' | 'skip-change' | 'shuffle-change' | 'context-change'>
    note: string
  }>
  eraVolatility: Array<{
    eraId: string
    eraLabel: string
    volatilityScore: number
    microshiftCount: number
  }>
}

export interface CounterfactualsPayload {
  scenarios: Array<{
    id: 'no-skips' | 'no-shuffle' | 'travel-removed' | 'night-removed'
    label: string
    eligibility: 'eligible' | 'partial' | 'unsupported'
    summaryDelta: {
      totalPlaysDelta: number
      skipRateDelta: number
      shuffleRateDelta: number
      nocturnalShareDelta: number
      top10ArtistShareDelta: number
      eclecticismDelta: number
    }
    notes: string[]
  }>
}

export type CompareEngineScopeId = 'all' | 'night' | 'offline' | 'weekend' | 'travel'
export type CompareEngineEraSelectionMode = 'auto-latest' | 'manual' | 'fallback'

export interface CompareEnginePayload {
  baseline: {
    fingerprint: string
    recordCount: number
    timezoneMode: TimezoneMode
  }
  current: {
    fingerprint: string
    recordCount: number
    timezoneMode: TimezoneMode
  }
  summaryDelta: {
    totalPlaysDelta: number
    totalHoursDelta: number
    skipRateDelta: number
    shuffleRateDelta: number
    nocturnalShareDelta: number
    top10ArtistShareDelta: number
    eclecticismDelta: number
    uniqueArtistsDelta: number
    sessionDepthAvgDelta: number
    travelShareDelta: number
  }
  topMetricShifts: Array<{
    key:
      | 'totalPlays'
      | 'totalHours'
      | 'skipRate'
      | 'shuffleRate'
      | 'nocturnalShare'
      | 'top10ArtistShare'
      | 'eclecticism'
      | 'uniqueArtists'
      | 'sessionDepthAvg'
      | 'travelShare'
    label: string
    delta: number
    absDelta: number
    direction: 'up' | 'down' | 'flat'
  }>
  eraDelta: {
    baselineEraCount: number
    currentEraCount: number
    delta: number
  }
  archetypeDelta: {
    baselinePrimaryKey: ArchetypeKey
    baselinePrimaryLabel: string
    currentPrimaryKey: ArchetypeKey
    currentPrimaryLabel: string
    changed: boolean
  }
  archetypeScoreShifts: Array<{
    key: ArchetypeKey
    label: string
    baselineScore: number
    currentScore: number
    delta: number
    absDelta: number
    direction: 'up' | 'down' | 'flat'
  }>
  eraPairDeltas: Array<{
    pairIndex: number
    baselineEraId: string | null
    baselineEraLabel: string | null
    currentEraId: string | null
    currentEraLabel: string | null
    durationMonthsDelta: number
    dominanceScoreDelta: number
    diversityScoreDelta: number
    confidenceDelta: number
  }>
  eraVsEra: {
    selection: {
      mode: CompareEngineEraSelectionMode
      baselineEraId: string | null
      currentEraId: string | null
    }
    baselineEra: {
      id: string
      label: string
      startMonth: string
      endMonth: string
      durationMonths: number
      dominanceScore: number
      diversityScore: number
      confidence: number
    } | null
    currentEra: {
      id: string
      label: string
      startMonth: string
      endMonth: string
      durationMonths: number
      dominanceScore: number
      diversityScore: number
      confidence: number
    } | null
    delta: {
      durationMonthsDelta: number
      dominanceScoreDelta: number
      diversityScoreDelta: number
      confidenceDelta: number
    }
    dominantArtistOverlap: {
      overlapShare: number
      rankWeightedOverlapScore: number
      sharedDominantArtists: string[]
      rankAlignedSharedArtists: Array<{
        artist: string
        baselineRank: number
        currentRank: number
        rankDistance: number
      }>
      baselineOnlyDominantArtists: string[]
      currentOnlyDominantArtists: string[]
    }
    changeDriverOverlap: {
      overlapShare: number
      sharedDriverKeys: Array<EraData['changeDrivers'][number]['key']>
      baselineOnlyDriverKeys: Array<EraData['changeDrivers'][number]['key']>
      currentOnlyDriverKeys: Array<EraData['changeDrivers'][number]['key']>
    }
    notes: string[]
  }
  archetypeTournament: {
    rankings: Array<{
      rank: number
      key: ArchetypeKey
      label: string
      baselineScore: number
      currentScore: number
      delta: number
      absDelta: number
      winner: 'baseline' | 'current' | 'tie'
      direction: 'up' | 'down' | 'flat'
    }>
    summary: {
      totalArchetypes: number
      currentWins: number
      baselineWins: number
      ties: number
      topSwingKey: ArchetypeKey | null
      topSwingLabel: string | null
    }
  }
  scope: {
    id: CompareEngineScopeId
    label: string
  }
  sliceDelta: {
    baselineRecords: number
    currentRecords: number
    totalHoursDelta: number
    skipRateDelta: number
    shuffleRateDelta: number
    uniqueArtistsDelta: number
    nocturnalShareDelta: number
  }
  notes: string[]
}

export interface ForecastLitePayload {
  nextMonth: string
  horizonMonths: 1
  bands: {
    plays: { low: number; mid: number; high: number }
    totalHours: { low: number; mid: number; high: number }
    skipRate: { low: number; mid: number; high: number }
    shuffleRate: { low: number; mid: number; high: number }
  }
  trendSignals: Array<{
    key: 'plays' | 'totalHours' | 'skipRate' | 'shuffleRate'
    label: string
    direction: 'up' | 'down' | 'flat'
    strength: number
    basisMonths: number
  }>
  anomalyRisk: {
    level: 'low' | 'medium' | 'high'
    score: number
    reasons: string[]
  }
  basisMonths: string[]
}

export interface AudioAffectOverlayPayload {
  coverage: AudioTraitCoverage
  overallCentroid: AudioTraitVector
  daypartCentroids: Record<DaypartKey, AudioTraitVector & { sampleRows: number }>
  eraCentroids: Array<{
    eraId: string
    eraLabel: string
    sampleRows: number
    centroid: AudioTraitVector
    spread: Partial<Record<AudioTraitMetricKey, number>>
  }>
  skipTraitDeltas?: {
    matchedSkippedRows: number
    matchedCompletedRows: number
    deltas: Partial<Record<AudioTraitMetricKey, number>>
  }
  capabilities: SpotifyApiCapabilities | ProviderCapabilities
  notes: string[]
}

export interface LabModulePayloadMap {
  'sequence-motifs': SequenceMotifsPayload
  'ritual-detector': RitualDetectorPayload
  'chronotype-drift': ChronotypeDriftPayload
  'novelty-economics': NoveltyEconomicsPayload
  'session-archetypes': unknown
  'bridge-dynamics': unknown
  'era-microshifts': EraMicroshiftsPayload
  'compare-engine': CompareEnginePayload
  'counterfactuals': CounterfactualsPayload
  'forecast-lite': ForecastLitePayload
  'stability-chaos': StabilityChaosPayload
  'audio-affect-overlay': AudioAffectOverlayPayload
}

export interface LabDatasetSnapshot {
  timezoneMode: ProcessedDataModel['timezoneMode']
  modelVersion: ProcessedDataModel['modelVersion']
  datasetIdentity: ProcessedDataModel['datasetIdentity']
  records: ProcessedDataModel['records']
  summary: ProcessedDataModel['summary']
  monthly: ProcessedDataModel['monthly']
  yearly: ProcessedDataModel['yearly']
  daily: ProcessedDataModel['daily']
  hours: ProcessedDataModel['hours']
  dayOfWeek: ProcessedDataModel['dayOfWeek']
  sessions: ProcessedDataModel['sessions']
  monthlyBehavior: ProcessedDataModel['monthlyBehavior']
  contextAnalytics: ProcessedDataModel['contextAnalytics']
  eras: ProcessedDataModel['eras']
  graph: ProcessedDataModel['graph']
  graphAnalytics: ProcessedDataModel['graphAnalytics']
  taste: ProcessedDataModel['taste']
  archetypes: ProcessedDataModel['archetypes']
}

export type LabCompareSnapshotSource = 'captured-current' | 'imported-zip'

export interface LabCompareSnapshotEntry {
  id: string
  fingerprint: string
  source: LabCompareSnapshotSource
  label: string
  savedAt: string
  snapshot: LabDatasetSnapshot
}

export interface LabWorkerRunModuleRequest {
  type: 'lab:run-module'
  requestId: string
  moduleId: LabModuleId
  dataset: LabDatasetSnapshot
  options?: Record<string, unknown>
}

export type LabWorkerRequest = LabWorkerRunModuleRequest

export type LabWorkerResponse =
  | {
      type: 'lab:progress'
      requestId: string
      moduleId: LabModuleId
      progress: number
      message?: string
    }
  | {
      type: 'lab:complete'
      requestId: string
      moduleId: LabModuleId
      result: LabModuleResult
    }
  | {
      type: 'lab:error'
      requestId: string
      moduleId?: LabModuleId
      error: string
    }

export interface SharePayloadV1 {
  version: 1
  privacyLevel: 'aggregate' | 'rich'
  checksum: string
  name?: string
  includeName: boolean
  totalHours: number
  totalPlays: number
  uniqueArtists: number
  uniqueTracks: number
  dateRange: [string, string]
  topArtists: [string, number][]
  topTracks: [string, string, number][]
  archetype: string
  peakHour: number
  skipRate: number
  shuffleRate: number
  longestStreak: number
  tasteDimensions: number[]
}

export interface SharePayloadV2 {
  version: 2
  privacyLevel: 'aggregate' | 'rich'
  checksum: string
  name?: string
  includeName: boolean
  anonymize: boolean
  generatedAt: string
  timezoneMode?: TimezoneMode
  totalHours: number
  totalPlays: number
  uniqueArtists: number
  uniqueTracks: number
  dateRange: [string, string]
  topArtists: [string, number][]
  topTracks: [string, string, number][]
  archetype: string
  archetypes: string[]
  peakHour: number
  skipRate: number
  shuffleRate: number
  longestStreak: number
  tasteDimensions: number[]
}

export interface SharePayloadV3 {
  version: 3
  privacyLevel: 'aggregate' | 'rich'
  checksum: string
  name?: string
  includeName: boolean
  anonymize: boolean
  generatedAt: string
  timezoneMode: TimezoneMode
  totalHours: number
  totalPlays: number
  uniqueArtists: number
  uniqueTracks: number
  dateRange: [string, string]
  topArtists: [string, number][]
  topTracks: [string, string, number][]
  archetype: string
  archetypes: string[]
  peakHour: number
  skipRate: number
  shuffleRate: number
  longestStreak: number
  tasteDimensions: number[]
  context: {
    homeCountry: string | null
    domesticShare: number
    travelShare: number
    topReasons: [string, number][]
    offlineRate: number
    incognitoRate: number
    topDeviceTransition?: [string, string, number]
  }
}

export interface SharePayloadV4 extends Omit<SharePayloadV3, 'version'> {
  version: 4
  selectedCards: string[]
  sharePreset: SharePresetId
  themeKey: ThemeKey
}

export type SharePayload = SharePayloadV1 | SharePayloadV2 | SharePayloadV3 | SharePayloadV4

export type ParseProgress =
  | {
      stage: 'loading'
      filesParsed: number
      totalFiles: number
      recordsParsed: number
    }
  | {
      stage: 'parsing'
      filesParsed: number
      totalFiles: number
      recordsParsed: number
      currentFile?: string
    }
  | {
      stage:
        | 'aggregation'
        | 'artists'
        | 'tracks'
        | 'albums'
        | 'time-series'
        | 'sessions'
        | 'summary'
        | 'taste'
        | 'archetypes'
        | 'platform'
        | 'graph'
        | 'gems'
        | 'eras'
        | 'skip'
        | 'context'
      filesParsed: number
      totalFiles: number
      recordsParsed: number
    }

export interface ParseOptions {
  onProgress?: (progress: ParseProgress) => void
}

export type SessionMetricEventType =
  | 'upload_complete'
  | 'share_tab_open'
  | 'share_link_generated'
  | 'share_link_copied'
  | 'asset_exported'
  | 'advanced_mode_enabled'
  | 'advanced_tab_visit'
  | 'universe_mode_switched'
  | 'universe_3d_init_success'
  | 'universe_3d_init_failed'

export interface SessionMetricEvent {
  type: SessionMetricEventType
  timestamp: string
  dedupeKey?: string
  metadata?: Record<string, string | number | boolean | null>
}

export interface SessionMetrics {
  startedAt: string
  counts: Record<SessionMetricEventType, number>
  events: SessionMetricEvent[]
}

export interface SharePreset {
  id: SharePresetId
  label: string
  description: string
  selectedCards: string[]
  copyTone: 'bold' | 'detailed' | 'anonymous'
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  origin: 'first-party'
  capabilities: Array<'readAggregates' | 'addPanel' | 'addShareCard' | 'exportData' | 'runAction'>
  description: string
}
