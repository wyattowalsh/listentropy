function toDomIdSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-')
}

export function getTabsTabId(idBase: string, value: string): string {
  return `${idBase}-tab-${toDomIdSegment(value)}`
}

export function getTabsPanelId(idBase: string, value: string): string {
  return `${idBase}-panel-${toDomIdSegment(value)}`
}

