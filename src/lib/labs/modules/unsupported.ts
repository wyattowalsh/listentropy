import type { LabDatasetSnapshot, LabModuleId, LabModuleResult } from '@/lib/types'

import { getStartTime, unsupportedResult } from '@/lib/labs/modules/utils'

export function runUnsupportedModule(moduleId: LabModuleId, snapshot: LabDatasetSnapshot): LabModuleResult {
  void snapshot
  const startedAt = getStartTime()
  return unsupportedResult({
    moduleId,
    startedAt,
    message: `${moduleId} is not implemented yet in Train A.`,
    sourceFields: [],
    assumptions: ['Manifest placeholder retained for roadmap visibility.'],
  })
}
