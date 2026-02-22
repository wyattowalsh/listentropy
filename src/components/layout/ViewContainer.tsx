import type { ReactNode } from 'react'

interface ViewContainerProps {
  children: ReactNode
}

export function ViewContainer({ children }: ViewContainerProps): JSX.Element {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-12 pt-4">
      <div className="view-enter">{children}</div>
    </main>
  )
}
