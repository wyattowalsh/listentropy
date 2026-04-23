import { readFileSync } from 'node:fs'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TabNav } from '@/components/layout/TabNav'
import { SharePage } from '@/components/share/SharePage'
import {
  INVALID_SHARE_TITLE,
  PRIMARY_ANALYTICS_TABS,
} from '../../tests/e2e/helpers/auditContract.mjs'

const applyThemeMock = vi.fn()

vi.mock('react-router-dom', () => ({
  Link: ({ to, className, children }: { to: string; className?: string; children: ReactNode }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@/store/useThemeStore', () => ({
  applyTheme: (...args: unknown[]) => applyThemeMock(...args),
}))

describe('real-data audit contract', () => {
  beforeEach(() => {
    applyThemeMock.mockReset()
    window.history.replaceState({}, '', '/share')
  })

  it('uses the shared audit contract in the harness source', () => {
    const source = readFileSync('scripts/audit/run-real-data-audit.mjs', 'utf8')

    expect(source).toContain('auditContract.mjs')
    expect(source).not.toContain("name: 'Overview'")
    expect(source).not.toContain("name: 'Invalid Share Link'")
  })

  it('matches the current primary analytics shell labels', () => {
    render(<TabNav value="dashboard" onChange={() => {}} />)

    expect(screen.getByRole('tab', { name: PRIMARY_ANALYTICS_TABS.dashboard })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: PRIMARY_ANALYTICS_TABS.share })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Overview' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Explore' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Taste DNA' })).not.toBeInTheDocument()
  })

  it('matches the current invalid share recovery heading', () => {
    window.history.replaceState({}, '', '/share#not-valid')
    render(<SharePage />)

    expect(screen.getByRole('heading', { name: INVALID_SHARE_TITLE })).toBeInTheDocument()
  })
})
