import { createContext, useContext, useId } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

import { getTabsPanelId, getTabsTabId } from '@/components/ui/tab-ids'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  idBase: string
}

const TabsContext = createContext<TabsContextValue | null>(null)

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  className?: string
  idBase?: string
}

export function Tabs({
  value,
  onValueChange,
  children,
  className,
  idBase,
}: TabsProps): JSX.Element {
  const generatedId = useId().replaceAll(':', '')
  const resolvedIdBase = idBase ?? `tabs-${generatedId}`
  return (
    <TabsContext.Provider value={{ value, onValueChange, idBase: resolvedIdBase }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(
        'flex w-full max-w-full min-w-0 items-center gap-2 overflow-x-auto rounded-theme border border-border bg-surface p-1 shadow-surface transition-[background-color,border-color,box-shadow] duration-normal ease-standard',
        className,
      )}
      {...props}
    />
  )
}

interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

export function TabsTrigger({
  value,
  className,
  children,
  onClick,
  onKeyDown,
  ...props
}: TabsTriggerProps): JSX.Element {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('TabsTrigger must be used within Tabs')
  }
  const tabsContext = context
  const isActive = context.value === value
  const tabId = getTabsTabId(context.idBase, value)
  const panelId = getTabsPanelId(context.idBase, value)

  function focusSiblingTab(current: HTMLElement, direction: 'next' | 'prev'): void {
    const list = current.closest('[role="tablist"]')
    if (!list) {
      return
    }
    const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]'))
    if (tabs.length === 0) {
      return
    }
    const currentIndex = tabs.indexOf(current)
    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1 + tabs.length) % tabs.length
        : (currentIndex - 1 + tabs.length) % tabs.length
    const next = tabs[nextIndex]
    next?.focus()
    const nextValue = next?.dataset.value
    if (nextValue) {
      tabsContext.onValueChange(nextValue)
    }
  }

  return (
    <button
      role="tab"
      id={tabId}
      aria-controls={panelId}
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      data-value={value}
      className={cn(
        'control-interactive relative whitespace-nowrap rounded-theme px-control-x py-control-y text-sm leading-tight transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-standard after:pointer-events-none after:absolute after:inset-x-2 after:bottom-1 after:h-px after:origin-center after:scale-x-0 after:bg-current/65 after:transition-transform after:duration-fast after:ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)] aria-selected:after:scale-x-100',
        isActive ? 'bg-accent text-accent-contrast font-semibold shadow-interactive' : 'text-text-muted hover:text-text',
        className,
      )}
      onClick={(event) => {
        tabsContext.onValueChange(value)
        onClick?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          focusSiblingTab(event.currentTarget, 'next')
          return
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          focusSiblingTab(event.currentTarget, 'prev')
          return
        }
        if (event.key === 'Home') {
          event.preventDefault()
          const list = event.currentTarget.closest('[role="tablist"]')
          const first = list?.querySelector<HTMLElement>('[role="tab"]')
          first?.focus()
          if (first?.dataset.value) {
            tabsContext.onValueChange(first.dataset.value)
          }
          return
        }
        if (event.key === 'End') {
          event.preventDefault()
          const list = event.currentTarget.closest('[role="tablist"]')
          const tabs = list ? Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')) : []
          const last = tabs[tabs.length - 1]
          last?.focus()
          if (last?.dataset.value) {
            tabsContext.onValueChange(last.dataset.value)
          }
        }
        onKeyDown?.(event)
      }}
      {...props}
    >
      {children}
    </button>
  )
}

interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: TabsContentProps): JSX.Element | null {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('TabsContent must be used within Tabs')
  }
  if (context.value !== value) {
    return null
  }
  const panelId = getTabsPanelId(context.idBase, value)
  const tabId = getTabsTabId(context.idBase, value)
  return (
    <div
      role="tabpanel"
      id={panelId}
      aria-labelledby={tabId}
      tabIndex={0}
      className={cn('view-enter', className)}
      {...props}
    >
      {children}
    </div>
  )
}
