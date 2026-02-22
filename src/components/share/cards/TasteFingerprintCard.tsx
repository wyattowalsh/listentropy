import { TasteFingerprint } from '@/components/charts/TasteFingerprint'
import type { ProcessedDataModel } from '@/lib/types'

interface TasteFingerprintCardProps {
  data: ProcessedDataModel
}

export function TasteFingerprintCard({ data }: TasteFingerprintCardProps): JSX.Element {
  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">Taste Fingerprint</h3>
      <p className="mt-2 text-sm text-text-muted">A generated shape from your listening dimensions.</p>
      <div className="mt-12 flex items-center justify-center">
        <TasteFingerprint values={data.taste.dimensions.map((item) => item.score).slice(0, 10)} />
      </div>
    </div>
  )
}
