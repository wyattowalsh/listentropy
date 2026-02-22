import type { ReactNode } from 'react'

import type { PluginManifest, ProcessedDataModel } from '@/lib/types'

export interface PluginContext {
  data: ProcessedDataModel
}

export interface PluginAction {
  id: string
  label: string
  description?: string
}

export interface PluginActionResult {
  status: 'running' | 'success' | 'error'
  message: string
  data?: Record<string, unknown>
}

export interface PluginModule {
  manifest: PluginManifest
  renderPanel?: (context: PluginContext) => ReactNode
  actions?: PluginAction[]
  runAction?: (actionId: string, context: PluginContext) => PluginActionResult | Promise<PluginActionResult>
  run?: (context: PluginContext) => unknown
}

class PluginRegistry {
  private plugins = new Map<string, PluginModule>()

  register(plugin: PluginModule): void {
    if (plugin.manifest.origin !== 'first-party') {
      throw new Error('Only first-party plugins are allowed in v1.')
    }
    this.plugins.set(plugin.manifest.id, plugin)
  }

  list(): PluginModule[] {
    return [...this.plugins.values()]
  }

  get(id: string): PluginModule | undefined {
    return this.plugins.get(id)
  }
}

export const pluginRegistry = new PluginRegistry()
