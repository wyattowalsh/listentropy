import JSZip from 'jszip'
import { Check, Copy, Download, Share2 } from 'lucide-react'
import { toBlob } from 'html-to-image'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { downloadBlob } from '@/lib/utils'

interface ExportButtonProps {
  cardRefs: Array<{ key: string; element: HTMLElement | null }>
  activeCardKey: string
  onAssetExported?: (kind: 'download-single' | 'download-all' | 'copy-card' | 'native-share') => void
}

async function renderCardBlob(element: HTMLElement, pixelRatio = 2): Promise<Blob> {
  const blob = await toBlob(element, { cacheBust: true, pixelRatio })
  if (!blob) {
    throw new Error('Failed to render story card image.')
  }
  return blob
}

export function ExportButton({ cardRefs, activeCardKey, onAssetExported }: ExportButtonProps): JSX.Element {
  const [copyState, setCopyState] = useState<'idle' | 'done'>('idle')
  const activeCard = useMemo(
    () => cardRefs.find((card) => card.key === activeCardKey) ?? cardRefs[0],
    [activeCardKey, cardRefs],
  )

  const canUseNativeShare =
    typeof navigator !== 'undefined' &&
    window.isSecureContext &&
    typeof navigator.share === 'function'

  async function downloadSingle(): Promise<void> {
    if (!activeCard?.element) {
      return
    }
    const blob = await renderCardBlob(activeCard.element)
    downloadBlob(blob, `listentropy-${activeCard.key}.png`)
    onAssetExported?.('download-single')
  }

  async function downloadAll(): Promise<void> {
    const zip = new JSZip()
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
  }

  async function copyToClipboard(): Promise<void> {
    if (!activeCard?.element) {
      return
    }
    const blob = await renderCardBlob(activeCard.element)

    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      onAssetExported?.('copy-card')
      setCopyState('done')
      window.setTimeout(() => setCopyState('idle'), 1500)
      return
    }

    const fallbackText = `${window.location.origin}/share`
    await navigator.clipboard.writeText(fallbackText)
    onAssetExported?.('copy-card')
    setCopyState('done')
    window.setTimeout(() => setCopyState('idle'), 1500)
  }

  async function nativeShare(): Promise<void> {
    if (!canUseNativeShare || !activeCard?.element) {
      return
    }

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
      return
    }

    await navigator.share({
      title: 'My Listentropy',
      text: 'Explore my Spotify listening DNA.',
      url: window.location.origin,
    })
    onAssetExported?.('native-share')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button aria-label="Download current story card" onClick={downloadSingle}>
        <Download className="h-4 w-4" />
        Download This Card
      </Button>
      <Button variant="outline" aria-label="Download all story cards as zip" onClick={downloadAll}>
        <Download className="h-4 w-4" />
        Download All
      </Button>
      <Button variant="outline" aria-label="Copy current story card" onClick={copyToClipboard}>
        {copyState === 'done' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copyState === 'done' ? 'Copied' : 'Copy Card'}
      </Button>
      {canUseNativeShare ? (
        <Button variant="outline" aria-label="Share current story card" onClick={nativeShare}>
          <Share2 className="h-4 w-4" />
          Share...
        </Button>
      ) : null}
    </div>
  )
}
