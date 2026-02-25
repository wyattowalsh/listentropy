import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type StorageMock = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear' | 'key'> & {
  length: number
}

function createStorageMock(overrides: Partial<StorageMock> = {}): StorageMock {
  return {
    length: 0,
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(() => null),
    ...overrides,
  }
}

function installLocalStorage(mockStorage: StorageMock): void {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: mockStorage,
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: mockStorage,
  })
}

describe('useThemeStore', () => {
  const originalLocalStorage = window.localStorage

  beforeEach(() => {
    vi.resetModules()
    installLocalStorage(createStorageMock())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    installLocalStorage(originalLocalStorage as unknown as StorageMock)
    document.documentElement.removeAttribute('style')
  })

  it('falls back to default theme when localStorage reads are denied', async () => {
    installLocalStorage(
      createStorageMock({
        getItem: vi.fn(() => {
          throw new DOMException('Access denied', 'SecurityError')
        }),
      }),
    )

    const { useThemeStore } = await import('./useThemeStore')

    expect(useThemeStore.getState().themeKey).toBe('spotify-dark')
  })

  it('updates theme state even when localStorage writes are denied', async () => {
    installLocalStorage(
      createStorageMock({
        setItem: vi.fn(() => {
          throw new DOMException('Access denied', 'SecurityError')
        }),
      }),
    )

    const { useThemeStore } = await import('./useThemeStore')

    expect(() => useThemeStore.getState().setTheme('midnight')).not.toThrow()
    expect(useThemeStore.getState().themeKey).toBe('midnight')
  })
})
