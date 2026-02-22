import type { PlatformCategory } from './types'

export function normalizePlatform(raw: string): PlatformCategory {
  const lower = raw.toLowerCase()
  if (lower.includes('iphone') || lower.includes('ipad') || lower === 'ios') {
    return 'iOS'
  }
  if (lower.includes('os x') || lower.includes('osx') || lower.includes('macos')) {
    return 'macOS'
  }
  if (lower.includes('android')) {
    return 'Android'
  }
  if (lower.includes('web_player') || lower.includes('web player')) {
    return 'Web'
  }
  if (lower.includes('windows')) {
    return 'Windows'
  }
  if (lower.includes('xbox')) {
    return 'Xbox'
  }
  if (
    lower.includes('partner') ||
    lower.includes('cast') ||
    lower.includes('tizen') ||
    lower.includes('roku') ||
    lower.includes('comcast')
  ) {
    return 'Smart TV / Cast'
  }
  return 'Other'
}
