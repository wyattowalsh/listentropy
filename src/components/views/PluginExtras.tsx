import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { PluginActionResult } from '@/lib/plugins/runtime'
import { pluginRegistry } from '@/lib/plugins/runtime'
import type { ProcessedDataModel } from '@/lib/types'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'

interface PluginExtrasProps {
  data: ProcessedDataModel
}

export function PluginExtras({ data }: PluginExtrasProps): JSX.Element {
  const plugins = pluginRegistry.list()
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'capabilities'>('name')
  const [personaPreset, setPersonaPreset] = useState<'all' | 'creator' | 'analyst'>('all')
  const [messages, setMessages] = useState<Record<string, PluginActionResult>>({})
  const [pending, setPending] = useState<Record<string, boolean>>({})

  const visiblePlugins = useMemo(() => {
    const personaMap: Record<string, 'creator' | 'analyst'> = {
      'playlist-seed-export': 'creator',
      'snapshot-compare': 'analyst',
      'anomaly-detector': 'analyst',
      'smart-rediscovery': 'creator',
    }
    const lowered = query.trim().toLowerCase()
    const filtered = plugins.filter((plugin) => {
      const haystack = `${plugin.manifest.name} ${plugin.manifest.description} ${plugin.manifest.capabilities.join(' ')}`.toLowerCase()
      const personaPass = personaPreset === 'all' || personaMap[plugin.manifest.id] === personaPreset
      return haystack.includes(lowered) && personaPass
    })
    if (sortBy === 'capabilities') {
      return [...filtered].sort((a, b) => b.manifest.capabilities.length - a.manifest.capabilities.length)
    }
    return [...filtered].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))
  }, [personaPreset, plugins, query, sortBy])

  async function runAction(pluginId: string, actionId: string): Promise<void> {
    const plugin = pluginRegistry.get(pluginId)
    if (!plugin?.runAction) {
      return
    }
      setPending((state) => ({ ...state, [`${pluginId}:${actionId}`]: true }))
      setMessages((state) => ({ ...state, [pluginId]: { status: 'running', message: 'Running…' } }))
      try {
        const result = await plugin.runAction(actionId, { data })
        setMessages((state) => ({ ...state, [pluginId]: result }))
      } catch (error) {
        setMessages((state) => ({
          ...state,
          [pluginId]: { status: 'error', message: (error as Error).message },
        }))
      } finally {
        setPending((state) => ({ ...state, [`${pluginId}:${actionId}`]: false }))
      }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Plugin Extras</CardTitle>
        <CardDescription className="mt-1">
          Explore first-party plugin panels, then run actions for analysis/export workflows.
        </CardDescription>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant={personaPreset === 'all' ? 'default' : 'outline'} onClick={() => setPersonaPreset('all')}>
            All
          </Button>
          <Button variant={personaPreset === 'creator' ? 'default' : 'outline'} onClick={() => setPersonaPreset('creator')}>
            Creator Preset
          </Button>
          <Button variant={personaPreset === 'analyst' ? 'default' : 'outline'} onClick={() => setPersonaPreset('analyst')}>
            Analyst Preset
          </Button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr,180px]">
          <Input
            value={query}
            placeholder="Filter plugins..."
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <Select value={sortBy} onChange={(event) => setSortBy(event.currentTarget.value as 'name' | 'capabilities')}>
            <option value="name">Sort by name</option>
            <option value="capabilities">Sort by capabilities</option>
          </Select>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {visiblePlugins.map((plugin) => (
        <Card key={plugin.manifest.id}>
          <CardTitle>{plugin.manifest.name}</CardTitle>
          <CardDescription className="mt-1">{plugin.manifest.description}</CardDescription>
          <div className="mt-3 text-sm text-text-muted">
            {plugin.renderPanel?.({ data }) ?? 'No panel output configured.'}
          </div>
          {plugin.actions && plugin.actions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {plugin.actions.map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  onClick={() => runAction(plugin.manifest.id, action.id)}
                  disabled={pending[`${plugin.manifest.id}:${action.id}`]}
                >
                  {pending[`${plugin.manifest.id}:${action.id}`] ? 'Running…' : action.label}
                </Button>
              ))}
            </div>
          ) : null}
          {messages[plugin.manifest.id] ? (
            <p className={`mt-3 text-xs ${messages[plugin.manifest.id].status === 'error' ? 'text-negative' : 'text-text-muted'}`}>
              {messages[plugin.manifest.id].message}
            </p>
          ) : null}
        </Card>
        ))}
      </div>
    </div>
  )
}
