function getLocalStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readLocalStorageItem(key: string): string | null {
  const storage = getLocalStorage()
  if (typeof storage?.getItem !== 'function') {
    return null
  }
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocalStorageItem(key: string, value: string): boolean {
  const storage = getLocalStorage()
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
