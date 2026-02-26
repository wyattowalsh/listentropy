import type { LabDatasetSnapshot, LabModuleId, LabModuleResult } from '@/lib/types'

import { runCompareEngineModule } from '@/lib/labs/modules/compare'
import { runCounterfactualsModule } from '@/lib/labs/modules/counterfactuals'
import { runAudioAffectOverlayModule } from '@/lib/labs/modules/enrichment'
import { runEraMicroshiftsModule } from '@/lib/labs/modules/eras'
import { runForecastSnapshotModule } from '@/lib/labs/modules/forecast'
import { runNoveltyEconomicsModule } from '@/lib/labs/modules/novelty'
import { runRitualDetectorModule, runSequenceMotifsModule } from '@/lib/labs/modules/sequence'
import { runChronotypeDriftModule, runStabilityChaosModule } from '@/lib/labs/modules/temporal'
import { runUnsupportedModule } from '@/lib/labs/modules/unsupported'

export function runLabModule(
  moduleId: LabModuleId,
  snapshot: LabDatasetSnapshot,
  options?: Record<string, unknown>,
): LabModuleResult {
  void options
  switch (moduleId) {
    case 'sequence-motifs':
      return runSequenceMotifsModule(snapshot)
    case 'ritual-detector':
      return runRitualDetectorModule(snapshot)
    case 'chronotype-drift':
      return runChronotypeDriftModule(snapshot)
    case 'novelty-economics':
      return runNoveltyEconomicsModule(snapshot)
    case 'era-microshifts':
      return runEraMicroshiftsModule(snapshot)
    case 'compare-engine':
      return runCompareEngineModule(snapshot, options)
    case 'counterfactuals':
      return runCounterfactualsModule(snapshot)
    case 'forecast-snapshot':
      return runForecastSnapshotModule(snapshot)
    case 'stability-chaos':
      return runStabilityChaosModule(snapshot)
    case 'audio-affect-overlay':
      return runAudioAffectOverlayModule(snapshot, options)
    case 'session-archetypes':
    case 'bridge-dynamics':
      return runUnsupportedModule(moduleId, snapshot)
    default: {
      const exhaustive: never = moduleId
      return runUnsupportedModule(exhaustive, snapshot)
    }
  }
}
