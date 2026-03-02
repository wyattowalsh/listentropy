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
  analysisMode?: 'simple' | 'deep'
}

export function PluginExtras({ data, analysisMode = 'deep' }: PluginExtrasProps): JSX.Element {
  const plugins = pluginRegistry.list()
  const isSimpleMode = analysisMode === 'simple'
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
      'rediscovery-queue': 'creator',
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

  const activeActions = Object.values(pending).filter(Boolean).length
  const successCount = Object.values(messages).filter((entry) => entry.status === 'success').length
  const errorCount = Object.values(messages).filter((entry) => entry.status === 'error').length

  function actionStatusTone(status: PluginActionResult['status']): string {
    switch (status) {
      case 'running': return 'border-accent/40 bg-accent/10 text-accent'
      case 'success': return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      case 'error': return 'border-negative/40 bg-negative/10 text-negative'
    }
  }

  function actionStatusLabel(status: PluginActionResult['status']): string {
    switch (status) {
      case 'running': return 'Running'
      case 'success': return 'Complete'
      case 'error': return 'Error'
    }
  }

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
        <CardTitle as="h2">Plugin Extras</CardTitle>
        <CardDescription className="mt-1">
          Explore first-party plugin panels, then run actions for analysis/export workflows.
          {isSimpleMode ? ' Panel output is collapsed by default for a lighter scan.' : ''}
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
            aria-label="Filter plugins"
            placeholder="Filter plugins..."
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <Select
            aria-label="Sort plugins"
            value={sortBy}
            onChange={(event) => setSortBy(event.currentTarget.value as 'name' | 'capabilities')}
          >
            <option value="name">Sort by name</option>
            <option value="capabilities">Sort by capabilities</option>
          </Select>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div className="rounded-theme border border-border bg-surface-hover p-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Visible</p>
            <p className="mt-1 text-sm text-text">{visiblePlugins.length}</p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Running</p>
            <p className="mt-1 text-sm text-text">{activeActions}</p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Succeeded</p>
            <p className="mt-1 text-sm text-text">{successCount}</p>
          </div>
          <div className="rounded-theme border border-border bg-surface-hover p-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Errors</p>
            <p className="mt-1 text-sm text-text">{errorCount}</p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {visiblePlugins.map((plugin) => (
          <Card key={plugin.manifest.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{plugin.manifest.name}</CardTitle>
                <CardDescription className="mt-1">{plugin.manifest.description}</CardDescription>
              </div>
              <span className="rounded-theme border border-border bg-surface-hover px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-text-muted">
                {plugin.manifest.capabilities.length} caps
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
              {plugin.manifest.capabilities.map((capability) => (
                <span key={capability} className="rounded-theme border border-border bg-surface-hover px-2 py-1">
                  {capability}
                </span>
              ))}
            </div>

            <details className="mt-3 rounded-theme border border-border bg-surface-hover p-2" open={!isSimpleMode}>
              <summary className="cursor-pointer text-xs uppercase tracking-[0.12em] text-text-muted">Panel Output</summary>
              <div className="mt-2 text-sm text-text-muted">
                {plugin.renderPanel?.({ data }) ?? 'No panel output configured.'}
              </div>
            </details>

            {plugin.actions && plugin.actions.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {plugin.actions.map((action) => (
                  <Button
                    key={action.id}
                    variant="outline"
                    onClick={() => runAction(plugin.manifest.id, action.id)}
                    disabled={pending[`${plugin.manifest.id}:${action.id}`]}
                    title={action.description}
                  >
                    {pending[`${plugin.manifest.id}:${action.id}`] ? 'Running…' : action.label}
                  </Button>
                ))}
              </div>
            ) : null}

            {messages[plugin.manifest.id] ? (
              <div className={`mt-3 rounded-theme border px-2 py-1 text-xs ${actionStatusTone(messages[plugin.manifest.id].status)}`}>
                <span className="mr-2 uppercase tracking-[0.12em]">{actionStatusLabel(messages[plugin.manifest.id].status)}</span>
                <span>{messages[plugin.manifest.id].message}</span>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  )
}
