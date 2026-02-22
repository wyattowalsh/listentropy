export function UniverseLegend(): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
      <span className="rounded-theme border border-border bg-surface px-2 py-1">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#1DB954]" />
        Artist nodes
      </span>
      <span className="rounded-theme border border-border bg-surface px-2 py-1">
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#A5B4FC]" />
        Track nodes
      </span>
      <span className="rounded-theme border border-border bg-surface px-2 py-1">
        Brightness and size increase with graph centrality / play volume
      </span>
    </div>
  )
}

