import type {
  LabDatasetSnapshot,
  LabModuleId,
  LabModuleManifest,
  LabSceneId,
  LabSceneManifest,
  ProcessedDataModel,
} from '@/lib/types'

export const labModuleManifests: LabModuleManifest[] = [
  {
    id: 'sequence-motifs',
    name: 'Sequence Motifs',
    category: 'sequence',
    perfTier: 'medium',
    dependsOnCore: ['records', 'sessions', 'timezoneMode', 'datasetIdentity'],
    outputVersion: 1,
    description: 'Repeated short listening motifs, surprise jumps, and session openers/closers.',
    featured: true,
  },
  {
    id: 'ritual-detector',
    name: 'Ritual Detector',
    category: 'sequence',
    perfTier: 'light',
    dependsOnCore: ['records', 'timezoneMode', 'datasetIdentity'],
    outputVersion: 1,
    description: 'Recurring daypart-platform-artist routines and ritual stability/fragility.',
    featured: true,
  },
  {
    id: 'chronotype-drift',
    name: 'Chronotype Drift',
    category: 'temporal',
    perfTier: 'medium',
    dependsOnCore: ['records', 'monthly', 'timezoneMode', 'datasetIdentity'],
    outputVersion: 1,
    description: 'Month and year drift in peak hour, nocturnal share, and daypart mix.',
    featured: true,
  },
  {
    id: 'stability-chaos',
    name: 'Stability vs Chaos',
    category: 'temporal',
    perfTier: 'light',
    dependsOnCore: ['summary', 'monthly', 'monthlyBehavior', 'datasetIdentity'],
    outputVersion: 1,
    description: 'Monthly phase-state portrait for intensity, diversity, and skip-driven volatility.',
    featured: true,
  },
  {
    id: 'novelty-economics',
    name: 'Novelty Economics',
    category: 'temporal',
    perfTier: 'light',
    dependsOnCore: ['monthly', 'summary', 'datasetIdentity'],
    outputVersion: 1,
    description: 'Novelty-vs-loyalty cycles and recovery heuristics across months.',
    featured: true,
  },
  {
    id: 'era-microshifts',
    name: 'Era Microshifts',
    category: 'temporal',
    perfTier: 'medium',
    dependsOnCore: ['eras', 'monthlyBehavior', 'records', 'contextAnalytics', 'datasetIdentity', 'timezoneMode'],
    outputVersion: 1,
    description: 'Micro-shift signals nested inside core detected eras.',
    featured: true,
  },
  {
    id: 'counterfactuals',
    name: 'Counterfactuals',
    category: 'compare',
    perfTier: 'medium',
    dependsOnCore: ['records', 'summary', 'contextAnalytics', 'datasetIdentity', 'timezoneMode'],
    outputVersion: 1,
    description: 'Lightweight descriptive simulations (no skips, no shuffle, travel removed, night removed).',
    featured: true,
  },
  {
    id: 'session-archetypes',
    name: 'Session Archetypes',
    category: 'sequence',
    perfTier: 'medium',
    dependsOnCore: ['sessions', 'records', 'datasetIdentity'],
    outputVersion: 1,
    description: 'Future module placeholder for session-level persona clustering.',
    comingSoon: true,
  },
  {
    id: 'bridge-dynamics',
    name: 'Bridge Dynamics',
    category: 'network',
    perfTier: 'heavy',
    dependsOnCore: ['graph', 'graphAnalytics', 'records', 'datasetIdentity'],
    outputVersion: 1,
    description: 'Future module placeholder for evolving bridge/hub topology.',
    comingSoon: true,
  },
  {
    id: 'compare-engine',
    name: 'Compare Engine',
    category: 'compare',
    perfTier: 'medium',
    dependsOnCore: ['datasetIdentity', 'summary', 'contextAnalytics', 'eras', 'archetypes', 'timezoneMode'],
    outputVersion: 1,
    description: 'Local in-session baseline vs current dataset comparison (Train B starter aggregate diff).',
  },
  {
    id: 'forecast-snapshot',
    name: 'Forecast Snapshot',
    category: 'forecast',
    perfTier: 'medium',
    dependsOnCore: ['monthly', 'monthlyBehavior', 'datasetIdentity'],
    outputVersion: 1,
    description: 'Heuristic one-step forecast bands for next-month plays, hours, and behavior rates.',
    featured: true,
  },
  {
    id: 'audio-affect-overlay',
    name: 'Audio Affect Overlay',
    category: 'enrichment',
    perfTier: 'heavy',
    requiresSpotifyApi: true,
    optionalInputs: ['spotify-api-token'],
    dependsOnCore: ['records', 'eras', 'timezoneMode', 'datasetIdentity'],
    outputVersion: 1,
    description: 'Optional enrichment: audio-feature centroids and drift overlays from Spotify traits (endpoint access dependent).',
    featured: true,
  },
]

export const labSceneManifests: LabSceneManifest[] = [
  {
    id: 'intent-sankey',
    name: 'Intent Sankey',
    description: 'Flow-style playback intent transitions using reason_start and reason_end signals.',
    perfTier: 'light',
    featured: true,
    recommendedModules: ['ritual-detector'],
  },
  {
    id: 'chronomap-ridgelines',
    name: 'Chronomap Ridgelines',
    description: 'Temporal ridgelines for chronotype drift and monthly daypart signatures.',
    perfTier: 'medium',
    featured: true,
    recommendedModules: ['chronotype-drift'],
  },
  {
    id: 'entropy-phase-portrait',
    name: 'Entropy Phase Portrait',
    description: 'Monthly state trajectory through intensity/diversity/skip stability space.',
    perfTier: 'light',
    featured: true,
    recommendedModules: ['stability-chaos'],
  },
  {
    id: 'universe-time-slider',
    name: 'Universe Time Slider',
    description: 'Heuristic time-sliced view of graph evolution using yearly and graph summary signals.',
    perfTier: 'medium',
    featured: true,
    recommendedModules: ['sequence-motifs'],
  },
  {
    id: 'era-migration-alluvial',
    name: 'Era Migration Alluvial',
    description: 'Future scene placeholder for era-to-era cluster migration flows.',
    perfTier: 'heavy',
    comingSoon: true,
    recommendedModules: ['era-microshifts'],
  },
]

export function getLabModuleManifest(id: LabModuleId): LabModuleManifest | undefined {
  return labModuleManifests.find((manifest) => manifest.id === id)
}

export function getLabSceneManifest(id: LabSceneId): LabSceneManifest | undefined {
  return labSceneManifests.find((manifest) => manifest.id === id)
}

export function isModuleSupported(manifest: LabModuleManifest, dataset: LabDatasetSnapshot): string | null {
  if (manifest.comingSoon) {
    return 'Coming soon in a future Xenolab train.'
  }
  if (dataset.records.length === 0) {
    return 'No records available in current dataset snapshot.'
  }
  return null
}

export function buildDefaultLabDatasetSnapshot(data: ProcessedDataModel): LabDatasetSnapshot {
  return {
    timezoneMode: data.timezoneMode,
    modelVersion: data.modelVersion,
    datasetIdentity: data.datasetIdentity,
    records: data.records,
    summary: data.summary,
    monthly: data.monthly,
    yearly: data.yearly,
    daily: data.daily,
    hours: data.hours,
    dayOfWeek: data.dayOfWeek,
    sessions: data.sessions,
    monthlyBehavior: data.monthlyBehavior,
    contextAnalytics: data.contextAnalytics,
    eras: data.eras,
    graph: data.graph,
    graphAnalytics: data.graphAnalytics,
    taste: data.taste,
    archetypes: data.archetypes,
  }
}
