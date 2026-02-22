import { describe, expect, it } from 'vitest'

import { pluginRegistry, type PluginModule } from './runtime'

function moduleWith(id: string, origin: 'first-party' | 'third-party' = 'first-party'): PluginModule {
  return {
    manifest: {
      id,
      name: id,
      version: '1.0.0',
      origin: origin as PluginModule['manifest']['origin'],
      capabilities: ['readAggregates'],
      description: 'test module',
    },
    actions: [{ id: 'run', label: 'Run' }],
    runAction: () => ({ status: 'success', message: 'done' }),
  }
}

describe('pluginRegistry', () => {
  it('registers and retrieves first-party modules', () => {
    const plugin = moduleWith('test-plugin-runtime-1')
    pluginRegistry.register(plugin)

    expect(pluginRegistry.get('test-plugin-runtime-1')).toBe(plugin)
    expect(pluginRegistry.list().some((item) => item.manifest.id === 'test-plugin-runtime-1')).toBe(true)
    expect(pluginRegistry.get('test-plugin-runtime-1')?.actions?.[0]?.id).toBe('run')
  })

  it('rejects non first-party modules', () => {
    const plugin = moduleWith('test-plugin-runtime-2', 'third-party')
    expect(() => pluginRegistry.register(plugin)).toThrow('Only first-party plugins are allowed in v1.')
  })
})
