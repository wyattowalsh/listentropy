export type BrowserStorageKind = 'local' | 'session'

type StorageHandle = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function getBrowserStorage(kind: BrowserStorageKind): StorageHandle | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function readStorageItem(storage: StorageHandle | null, key: string): string | null {
  if (typeof storage?.getItem !== 'function') {
    return null
  }
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorageItem(storage: StorageHandle | null, key: string, value: string): boolean {
  if (typeof storage?.setItem !== 'function') {
    return false
  }
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStorageItem(storage: StorageHandle | null, key: string): boolean {
  if (typeof storage?.removeItem !== 'function') {
    return false
  }
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function readBrowserStorageItem(kind: BrowserStorageKind, key: string): string | null {
  return readStorageItem(getBrowserStorage(kind), key)
}

export function writeBrowserStorageItem(kind: BrowserStorageKind, key: string, value: string): boolean {
  return writeStorageItem(getBrowserStorage(kind), key, value)
}

export function removeBrowserStorageItem(kind: BrowserStorageKind, key: string): boolean {
  return removeStorageItem(getBrowserStorage(kind), key)
}
