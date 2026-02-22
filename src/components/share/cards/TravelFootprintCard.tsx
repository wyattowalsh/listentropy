import type { ProcessedDataModel } from '@/lib/types'

interface TravelFootprintCardProps {
  data: ProcessedDataModel
}

export function TravelFootprintCard({ data }: TravelFootprintCardProps): JSX.Element {
  const countries = data.contextAnalytics.country.topCountries.slice(0, 5)
  return (
    <div className="story-card h-full w-full bg-surface p-10">
      <h3 className="font-heading text-4xl font-semibold text-text">Travel Footprint</h3>
      <p className="mt-2 text-sm text-text-muted">
        Home base {data.contextAnalytics.country.homeCountry ?? 'N/A'} · travel share{' '}
        {Math.round(data.contextAnalytics.country.travelShare * 100)}%
      </p>
      <ol className="mt-8 space-y-3">
        {countries.map((item, index) => (
          <li key={item.country} className="flex items-center justify-between rounded-theme border border-border bg-surface-hover p-3 text-sm">
            <span className="text-text">
              #{index + 1} {item.country}
            </span>
            <span className="text-text-muted">{item.plays.toLocaleString()} plays</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
