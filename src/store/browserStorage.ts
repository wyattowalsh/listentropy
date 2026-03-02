import { readBrowserStorageItem, writeBrowserStorageItem } from '@/lib/storage/safeBrowserStorage'

export function readLocalStorageItem(key: string): string | null {
  return readBrowserStorageItem('local', key)
}

export function writeLocalStorageItem(key: string, value: string): boolean {
  return writeBrowserStorageItem('local', key, value)
}
