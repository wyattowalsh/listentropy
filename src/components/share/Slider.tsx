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
      {label ? (
        <span className="text-xs uppercase tracking-[0.12em] text-text-muted">
          {label}
        </span>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        step={step}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-hover accent-accent"
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <div className="flex items-center justify-between text-[11px] text-text-muted">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </label>
  )
}
