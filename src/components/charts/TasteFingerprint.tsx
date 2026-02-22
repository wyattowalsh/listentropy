interface TasteFingerprintProps {
  values: number[]
}

export function TasteFingerprint({ values }: TasteFingerprintProps): JSX.Element {
  const center = 120
  const radius = 86
  const points = values.map((value, index) => {
    const angle = (index / values.length) * Math.PI * 2 - Math.PI / 2
    const r = radius * (0.35 + value * 0.65)
    const x = center + r * Math.cos(angle)
    const y = center + r * Math.sin(angle)
    return `${x},${y}`
  })

  return (
    <svg viewBox="0 0 240 240" className="h-[240px] w-[240px]">
      <rect x={0} y={0} width={240} height={240} fill="transparent" />
      <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--color-border)" />
      <polygon
        points={points.join(' ')}
        fill="var(--color-accent)"
        fillOpacity={0.24}
        stroke="var(--color-accent)"
        strokeWidth={2}
      />
      <circle cx={center} cy={center} r={3} fill="var(--color-accent)" />
    </svg>
  )
}
