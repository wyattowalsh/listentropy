import type { ReactNode } from 'react'

interface ViewContainerProps {
  children: ReactNode
}

export function ViewContainer({ children }: ViewContainerProps): JSX.Element {
  return (
    <main className="mx-auto w-full max-w-[1320px] px-4 pb-12 pt-5 sm:px-5 sm:pt-6 lg:px-6">
      <div className="section-reveal view-enter">{children}</div>
    </main>
  )
}
