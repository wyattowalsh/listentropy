declare module 'qrcode-generator' {
  interface QRCode {
    addData(data: string): void
    make(): void
    createSvgTag(options?: { cellSize?: number; margin?: number }): string
  }

  export default function qrcode(typeNumber: number, errorCorrectionLevel: string): QRCode
}
