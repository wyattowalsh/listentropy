export function UniverseLegend(): JSX.Element {
  return (
    <div className="space-y-2 rounded-theme border border-border bg-surface-hover p-3 text-xs text-text-muted">
      <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Legend</p>
      <div className="grid gap-2 md:grid-cols-3">
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Nodes</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-theme border border-border bg-surface px-2 py-1">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#1DB954]" />
              Artist
            </span>
            <span className="rounded-theme border border-border bg-surface px-2 py-1">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#60A5FA]" />
              Album
            </span>
            <span className="rounded-theme border border-border bg-surface px-2 py-1">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#A5B4FC]" />
              Track
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Edges</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-theme border border-border bg-surface px-2 py-1">
              <span className="mr-1 inline-block h-4 w-5 align-middle">
                <svg viewBox="0 0 20 8" className="h-2 w-5">
                  <path d="M1 4h18" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              Co-listen
            </span>
            <span className="rounded-theme border border-border bg-surface px-2 py-1">
              <span className="mr-1 inline-block h-4 w-5 align-middle">
                <svg viewBox="0 0 20 8" className="h-2 w-5">
                  <path d="M1 4h18" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              Bridge
            </span>
            <span className="rounded-theme border border-border bg-surface px-2 py-1">
              <span className="mr-1 inline-block h-4 w-5 align-middle">
                <svg viewBox="0 0 20 8" className="h-2 w-5">
                  <path d="M1 4h18" stroke="#64748B" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              Contains
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">Visual encoding</p>
          <p className="rounded-theme border border-border bg-surface px-2 py-1">
            Brightness and size increase with graph centrality and play volume.
          </p>
        </div>
      </div>
    </div>
  )
}
