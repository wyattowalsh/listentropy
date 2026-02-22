import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ViewErrorBoundaryProps {
  viewKey: string
  children: ReactNode
}

interface ViewErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

export class ViewErrorBoundary extends Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  state: ViewErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  }

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message,
    }
  }

  componentDidUpdate(prevProps: ViewErrorBoundaryProps): void {
    if (prevProps.viewKey !== this.props.viewKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: '' })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('View crashed', { error, info })
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="rounded-theme border border-negative/40 bg-surface p-5">
        <h2 className="font-heading text-xl text-negative">This view crashed</h2>
        <p className="mt-2 text-sm text-text-muted">{this.state.errorMessage || 'Unknown rendering error.'}</p>
        <button
          type="button"
          className="mt-4 rounded-theme border border-border px-3 py-2 text-sm text-text"
          onClick={() => this.setState({ hasError: false, errorMessage: '' })}
        >
          Retry View
        </button>
      </div>
    )
  }
}
