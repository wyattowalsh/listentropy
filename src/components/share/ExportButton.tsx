import JSZip from 'jszip'
import { Check, Copy, Download, Loader2, Share2 } from 'lucide-react'
import { toBlob } from 'html-to-image'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { downloadBlob } from '@/lib/utils'

interface ExportButtonProps {
  cardRefs: Array<{ key: string; element: HTMLElement | null }>
  activeCardKey: string
  onAssetExported?: (kind: 'download-single' | 'download-all' | 'copy-card' | 'native-share') => void
}

type ExportAction = 'download-single' | 'download-all' | 'copy-card' | 'native-share'

async function renderCardBlob(element: HTMLElement, pixelRatio = 2): Promise<Blob> {
  const blob = await toBlob(element, { cacheBust: true, pixelRatio })
  if (!blob) {
    throw new Error('Failed to render story card image.')
  }
  return blob
}

export function ExportButton({ cardRefs, activeCardKey, onAssetExported }: ExportButtonProps): JSX.Element {
  const [copyState, setCopyState] = useState<'idle' | 'done'>('idle')
  const [busyAction, setBusyAction] = useState<ExportAction | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const activeCard = useMemo(
    () => cardRefs.find((card) => card.key === activeCardKey) ?? cardRefs[0],
    [activeCardKey, cardRefs],
  )
  const availableCardCount = useMemo(
    () => cardRefs.filter((card) => card.element).length,
    [cardRefs],
  )
  const hasActiveCard = Boolean(activeCard?.element)
  const hasAnyCards = availableCardCount > 0

  const canUseNativeShare =
    typeof navigator !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator.share === 'function'

  async function downloadSingle(): Promise<void> {
    if (!activeCard?.element) {
      return
    }
    setBusyAction('download-single')
    try {
      const blob = await renderCardBlob(activeCard.element)
      downloadBlob(blob, `listentropy-${activeCard.key}.png`)
      onAssetExported?.('download-single')
      setStatusMessage('Downloaded current card as PNG.')
    } finally {
      setBusyAction(null)
    }
  }

  async function downloadAll(): Promise<void> {
    if (!hasAnyCards) {
      return
    }
    setBusyAction('download-all')
    const zip = new JSZip()
    try {
      for (let index = 0; index < cardRefs.length; index += 1) {
        const item = cardRefs[index]
        if (!item.element) {
          continue
        }
        const blob = await renderCardBlob(item.element)
        zip.file(`${String(index + 1).padStart(2, '0')}-${item.key}.png`, blob)
      }
      const out = await zip.generateAsync({ type: 'blob' })
      downloadBlob(out, 'listentropy-story-cards.zip')
      onAssetExported?.('download-all')
      setStatusMessage('Downloaded full deck as ZIP.')
    } finally {
      setBusyAction(null)
    }
  }

  async function copyToClipboard(): Promise<void> {
    if (!activeCard?.element) {
      return
    }
    setBusyAction('copy-card')
    try {
      const blob = await renderCardBlob(activeCard.element)

      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        onAssetExported?.('copy-card')
        setCopyState('done')
        setStatusMessage('Copied card image to clipboard.')
        window.setTimeout(() => setCopyState('idle'), 1500)
        return
      }

      const fallbackText = `${window.location.origin}/share`
      await navigator.clipboard.writeText(fallbackText)
      onAssetExported?.('copy-card')
      setCopyState('done')
      setStatusMessage('Copied fallback share URL to clipboard.')
      window.setTimeout(() => setCopyState('idle'), 1500)
    } finally {
      setBusyAction(null)
    }
  }

  async function nativeShare(): Promise<void> {
    if (!canUseNativeShare || !activeCard?.element) {
      return
    }
    setBusyAction('native-share')
    try {
      const blob = await renderCardBlob(activeCard.element)
      const file = new File([blob], `listentropy-${activeCard.key}.png`, { type: 'image/png' })
      const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

      if (canShareFile) {
        await navigator.share({
          title: 'My Listentropy',
          text: 'Explore my Spotify listening DNA.',
          files: [file],
        })
        onAssetExported?.('native-share')
        setStatusMessage('Shared current card.')
        return
      }

      await navigator.share({
        title: 'My Listentropy',
        text: 'Explore my Spotify listening DNA.',
        url: window.location.origin,
      })
      onAssetExported?.('native-share')
      setStatusMessage('Opened native share sheet with profile URL.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <p>
          Active card: <span className="text-text">{activeCard?.key ?? 'N/A'}</span>
        </p>
        <p>{availableCardCount} card{availableCardCount === 1 ? '' : 's'} ready to export</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button aria-label="Download current story card" onClick={downloadSingle} disabled={!hasActiveCard || busyAction !== null}>
          {busyAction === 'download-single' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download This Card
        </Button>
        <Button
          variant="outline"
          aria-label="Download all story cards as zip"
          onClick={downloadAll}
          disabled={!hasAnyCards || busyAction !== null}
        >
          {busyAction === 'download-all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Download All (.zip)
        </Button>
        <Button variant="outline" aria-label="Copy current story card" onClick={copyToClipboard} disabled={!hasActiveCard || busyAction !== null}>
          {busyAction === 'copy-card' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : copyState === 'done' ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copyState === 'done' ? 'Copied' : 'Copy Card Image'}
        </Button>
        {canUseNativeShare ? (
          <Button variant="outline" aria-label="Share current story card" onClick={nativeShare} disabled={!hasActiveCard || busyAction !== null}>
            {busyAction === 'native-share' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Share...
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-text-muted">
        Export uses local rendering only. Clipboard image copy falls back to a share URL on unsupported browsers.
      </p>
      {statusMessage ? <p className="text-xs text-accent">{statusMessage}</p> : null}
    </div>
  )
}
