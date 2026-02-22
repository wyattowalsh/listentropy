interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  label?: string
  onChange: (value: number) => void
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  label,
  onChange,
}: SliderProps): JSX.Element {
  return (
    <label className="flex w-full flex-col gap-2 text-sm text-text-muted">
      {label ? <span>{label}</span> : null}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        step={step}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}
