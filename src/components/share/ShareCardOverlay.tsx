import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

interface ShareCardOverlayProps {
  showBranding: boolean
  showQr: boolean
  qrUrl: string
}

function buildQrSvgDataUri(value: string): string {
  const generator = qrcode(0, 'L')
  generator.addData(value)
  generator.make()
  const svg = generator.createSvgTag({ cellSize: 2, margin: 0 })
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function ShareCardOverlay({ showBranding, showQr, qrUrl }: ShareCardOverlayProps): JSX.Element | null {
  const qrSrc = useMemo(() => (showQr ? buildQrSvgDataUri(qrUrl) : ''), [showQr, qrUrl])

  if (!showBranding && !showQr) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
      {showBranding ? (
        <div className="rounded-md border border-border/70 bg-bg/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Listentropy
        </div>
      ) : (
        <span />
      )}
      {showQr ? (
        <div className="rounded-md border border-border/70 bg-white/95 p-2">
          <img src={qrSrc} alt="QR code to listentropy.com" className="h-16 w-16" />
        </div>
      ) : null}
    </div>
  )
}
