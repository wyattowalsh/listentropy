import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('DashboardApp lazy loading boundaries', () => {
  it('keeps heavy views behind React.lazy imports', () => {
    const source = readFileSync('src/app/DashboardApp.tsx', 'utf8')

    expect(source).toContain("import('@/components/views/MusicUniverse')")
    expect(source).toContain("import('@/components/views/TasteDNA')")
    expect(source).toContain("<Suspense fallback={loadingFallback}>")
  })
})
