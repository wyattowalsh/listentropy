export function UniverseLegend(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
      <span className="rounded-theme border border-border bg-surface px-2 py-1">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#1DB954]" />
        Artist nodes
      </span>
      <span className="rounded-theme border border-border bg-surface px-2 py-1">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#60A5FA]" />
        Album nodes
      </span>
      <span className="rounded-theme border border-border bg-surface px-2 py-1">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#A5B4FC]" />
        Track nodes
      </span>
      <span className="rounded-theme border border-border bg-surface px-2 py-1">
        <span className="mr-1 inline-block h-4 w-5 align-middle">
          <svg viewBox="0 0 20 8" className="h-2 w-5">
            <path d="M1 4h18" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        Co-listen edge
      </span>
      <span className="rounded-theme border border-border bg-surface px-2 py-1">
        <span className="mr-1 inline-block h-4 w-5 align-middle">
          <svg viewBox="0 0 20 8" className="h-2 w-5">
            <path d="M1 4h18" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        Bridge edge
      </span>
      <span className="rounded-theme border border-border bg-surface px-2 py-1">
        <span className="mr-1 inline-block h-4 w-5 align-middle">
          <svg viewBox="0 0 20 8" className="h-2 w-5">
            <path d="M1 4h18" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        Contains edge
      </span>
      <span className="rounded-theme border border-border bg-surface px-2 py-1">
        Brightness and size increase with graph centrality / play volume
      </span>
    </div>
  )
}
