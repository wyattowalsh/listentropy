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

type LabModuleRunner = (snapshot: LabDatasetSnapshot, options?: Record<string, unknown>) => LabModuleResult

const LAB_MODULE_RUNNERS: Record<LabModuleId, LabModuleRunner> = {
  'sequence-motifs': (snapshot) => runSequenceMotifsModule(snapshot),
  'ritual-detector': (snapshot) => runRitualDetectorModule(snapshot),
  'chronotype-drift': (snapshot) => runChronotypeDriftModule(snapshot),
  'novelty-economics': (snapshot) => runNoveltyEconomicsModule(snapshot),
  'era-microshifts': (snapshot) => runEraMicroshiftsModule(snapshot),
  'compare-engine': (snapshot, options) => runCompareEngineModule(snapshot, options),
  counterfactuals: (snapshot) => runCounterfactualsModule(snapshot),
  'forecast-snapshot': (snapshot) => runForecastSnapshotModule(snapshot),
  'stability-chaos': (snapshot) => runStabilityChaosModule(snapshot),
  'audio-affect-overlay': (snapshot, options) => runAudioAffectOverlayModule(snapshot, options),
  'session-archetypes': (snapshot) => runUnsupportedModule('session-archetypes', snapshot),
  'bridge-dynamics': (snapshot) => runUnsupportedModule('bridge-dynamics', snapshot),
}

export function runLabModule(
  moduleId: LabModuleId,
  snapshot: LabDatasetSnapshot,
  options?: Record<string, unknown>,
): LabModuleResult {
  return LAB_MODULE_RUNNERS[moduleId](snapshot, options)
}
