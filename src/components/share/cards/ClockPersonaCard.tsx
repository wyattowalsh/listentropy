import { RadialClock } from '@/components/charts/RadialClock'
import type { ProcessedDataModel } from '@/lib/types'

interface ClockPersonaCardProps {
  data: ProcessedDataModel
}

function personaLabel(peakHour: number): string {
  if (peakHour >= 22 || peakHour <= 4) {
    return 'Night Owl'
  }
  if (peakHour >= 5 && peakHour <= 9) {
    return 'Early Bird'
  }
  return 'All-Day Listener'
}

export function ClockPersonaCard({ data }: ClockPersonaCardProps): JSX.Element {
  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">Listening Clock</h3>
      <p className="mt-2 text-lg text-text-muted">{personaLabel(data.summary.peakHour)}</p>
      <div className="mt-8 flex justify-center">
        <RadialClock values={data.hours.map((item) => ({ hour: item.hour, plays: item.plays }))} />
      </div>
    </div>
  )
}
