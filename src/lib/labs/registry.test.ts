import { describe, expect, it } from 'vitest'

import { buildDefaultLabDatasetSnapshot, getLabModuleManifest, isModuleSupported, labModuleManifests, labSceneManifests } from '@/lib/labs/registry'
import { makeSyntheticLabSnapshot } from '@/lib/labs/modules/test-helpers'
import { processRecords } from '@/lib/processor'
import { makeSyntheticRecords } from '@/lib/labs/modules/test-helpers'

describe('xenolab registry', () => {
  it('contains featured Train A manifests', () => {
    expect(getLabModuleManifest('sequence-motifs')?.featured).toBe(true)
    expect(getLabModuleManifest('forecast-snapshot')?.featured).toBe(true)
    expect(getLabModuleManifest('forecast-snapshot')?.comingSoon).not.toBe(true)
    expect(getLabModuleManifest('audio-affect-overlay')?.comingSoon).not.toBe(true)
    expect(labSceneManifests.some((scene) => scene.id === 'intent-sankey')).toBe(true)
  })

  it('builds a worker-safe snapshot from processed data', () => {
    const processed = processRecords(makeSyntheticRecords(60))
    const snapshot = buildDefaultLabDatasetSnapshot(processed)
    expect(snapshot.datasetIdentity.fingerprint).toBe(processed.datasetIdentity.fingerprint)
    expect(snapshot.records.length).toBe(processed.records.length)
  })

  it('reports coming-soon modules as unsupported', () => {
    const snapshot = makeSyntheticLabSnapshot()
    const manifest = labModuleManifests.find((item) => item.id === 'session-archetypes')
    expect(manifest).toBeDefined()
    expect(isModuleSupported(manifest!, snapshot)).toMatch(/Coming soon/)
  })

  it('reports enabled forecast-snapshot module as supported', () => {
    const snapshot = makeSyntheticLabSnapshot()
    const manifest = labModuleManifests.find((item) => item.id === 'forecast-snapshot')
    expect(manifest).toBeDefined()
    expect(isModuleSupported(manifest!, snapshot)).toBeNull()
  })
})
